(function () {
    'use strict';

    var DB_NAME = 'lingji_db';
    var DB_VERSION = 1;
    var STORE_NAME = 'images';
    var WP_KEY = '_wallpaper';

    /* ====== IndexedDB 辅助 ====== */
    function openDB(callback) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = function (e) { callback(null, e.target.result); };
        req.onerror = function () { callback(new Error('IndexedDB 打开失败')); };
    }

    function saveWallpaperBlob(blob, callback) {
        openDB(function (err, db) {
            if (err) { if (callback) callback(err); return; }
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(blob, WP_KEY);
            tx.oncomplete = function () { if (callback) callback(null); };
            tx.onerror = function () { if (callback) callback(new Error('写入失败')); };
        });
    }

    function loadWallpaperBlob(callback) {
        openDB(function (err, db) {
            if (err) { callback(err); return; }
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                callback(null, null);
                return;
            }
            var tx = db.transaction(STORE_NAME, 'readonly');
            var req = tx.objectStore(STORE_NAME).get(WP_KEY);
            req.onsuccess = function () { callback(null, req.result || null); };
            req.onerror = function () { callback(new Error('读取失败')); };
        });
    }

    function removeWallpaperBlob(callback) {
        openDB(function (err, db) {
            if (err) { if (callback) callback(err); return; }
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                if (callback) callback(null);
                return;
            }
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(WP_KEY);
            tx.oncomplete = function () { if (callback) callback(null); };
            tx.onerror = function () { if (callback) callback(new Error('删除失败')); };
        });
    }

    /* ====== 壁纸设置模块 ====== */
    var WallpaperSettings = {

        /* 保存当前预览 URL（用于释放） */
        _previewUrl: null,

        buildPage: function () {
            var S = window.Settings;
            var saved = S.loadSetting('wallpaper') || {};

            var html = S.subHeader('壁纸设置') + '<div class="settings-body">';

            /* 板块标题 */
            html += '<div class="sf-section-title">' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="2"/>' +
                '<path d="M21 15l-5-5L5 21"/></svg>' +
                '<span>壁纸管理</span></div>';

            /* 当前壁纸预览 */
            html += '<div class="sf-label">当前壁纸预览</div>';
            html += '<div class="sf-wp-preview-wrap" id="sf-wp-preview-wrap">' +
                '<div class="sf-wp-preview" id="sf-wp-preview">' +
                '<div class="sf-wp-preview-inner" id="sf-wp-preview-inner">' +
                '<div class="sf-wp-loading" id="sf-wp-loading">加载中...</div>' +
                '</div>' +
                /* 状态栏模拟 */
                '<div class="sf-wp-statusbar">' +
                '<span>9:41</span>' +
                '<div class="sf-wp-island"></div>' +
                '<span>100%</span>' +
                '</div>' +
                /* 预览信息覆盖层 */
                '<div class="sf-wp-info" id="sf-wp-info"></div>' +
                '</div></div>';

            /* 更换壁纸 */
            html += '<div class="sf-label">更换壁纸</div>';
            html += '<div class="sf-wp-actions">';

            /* 从相册选择 */
            html += '<label class="sf-wp-action-card" id="sf-wp-pick-label">' +
                '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="2"/>' +
                '<path d="M21 15l-5-5L5 21"/></svg>' +
                '<span class="sf-wp-action-name">从相册选择</span>' +
                '<span class="sf-wp-action-hint">支持 JPG、PNG、WebP</span>' +
                '<input type="file" accept="image/jpeg,image/png,image/webp,image/*" id="sf-wp-file" style="display:none">' +
                '</label>';

            html += '</div>';

            /* 处理状态 */
            html += '<div class="sf-status" id="sf-wp-status"></div>';

            /* 移除壁纸 */
            html += '<div class="sf-label">壁纸操作</div>';
            html += '<button class="sf-danger-btn" id="sf-wp-remove">移除当前壁纸（恢复默认）</button>';

            html += '</div>';
            return html;
        },

        initPage: function (sub) {
            var S = window.Settings;
            var self = this;

            /* 加载当前壁纸预览 */
            self.loadPreview(sub);

            /* 选择图片 */
            var fileInput = sub.querySelector('#sf-wp-file');
            if (fileInput) {
                fileInput.addEventListener('change', function () {
                    var file = fileInput.files[0];
                    if (!file) return;
                    self.applyWallpaper(sub, file);
                });
            }

            /* 移除壁纸 */
            var removeBtn = sub.querySelector('#sf-wp-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', function () {
                    self.removeWallpaper(sub);
                });
            }
        },

        /* 加载当前壁纸预览 */
        loadPreview: function (sub) {
            var S = window.Settings;
            var saved = S.loadSetting('wallpaper') || {};
            var previewInner = sub.querySelector('#sf-wp-preview-inner');
            var loading = sub.querySelector('#sf-wp-loading');
            var info = sub.querySelector('#sf-wp-info');
            var self = this;

            if (saved.type === 'custom') {
                /* 从 IndexedDB 读取自定义壁纸 */
                loadWallpaperBlob(function (err, blob) {
                    if (err || !blob) {
                        if (loading) loading.textContent = '无法加载壁纸';
                        if (info) info.textContent = '自定义壁纸（数据丢失）';
                        return;
                    }

                    /* 释放旧 URL */
                    if (self._previewUrl) {
                        URL.revokeObjectURL(self._previewUrl);
                    }

                    var url = URL.createObjectURL(blob);
                    self._previewUrl = url;

                    if (loading) loading.style.display = 'none';
                    previewInner.style.backgroundImage = 'url(' + url + ')';
                    previewInner.style.backgroundSize = 'cover';
                    previewInner.style.backgroundPosition = 'center';

                    /* 显示图片信息 */
                    var sizeKB = (blob.size / 1024).toFixed(1);
                    var sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
                    var sizeText = blob.size > 1024 * 1024 ? sizeMB + ' MB' : sizeKB + ' KB';

                    var img = new Image();
                    img.onload = function () {
                        if (info) info.textContent = img.naturalWidth + ' × ' + img.naturalHeight + '  ·  ' + sizeText;
                    };
                    img.src = url;
                });

            } else if (saved.type === 'color' && saved.color) {
                /* 纯色壁纸 */
                if (loading) loading.style.display = 'none';
                previewInner.style.background = saved.color;
                if (info) info.textContent = '纯色壁纸  ·  ' + saved.color;

            } else {
                /* 默认壁纸 */
                if (loading) loading.style.display = 'none';

                /* 获取当前实际背景 */
                var container = document.getElementById('phone-container');
                var currentBg = container ? getComputedStyle(container).backgroundColor : '#d4d4d4';
                previewInner.style.background = currentBg;
                if (info) info.textContent = '默认壁纸';
            }
        },

        /* 更换壁纸 —— 原图存储，不做任何压缩 */
        applyWallpaper: function (sub, file) {
            var S = window.Settings;
            var self = this;
            var status = sub.querySelector('#sf-wp-status');
            var previewInner = sub.querySelector('#sf-wp-preview-inner');
            var loading = sub.querySelector('#sf-wp-loading');
            var info = sub.querySelector('#sf-wp-info');

            if (status) {
                status.textContent = '正在处理壁纸...';
                status.className = 'sf-status sf-status-loading';
            }

            /* 验证文件 */
            if (!file.type.match(/^image\/(jpeg|png|webp|gif|bmp)/)) {
                S.toast('请选择图片文件');
                if (status) {
                    status.textContent = '不支持的文件格式';
                    status.className = 'sf-status sf-status-error';
                }
                return;
            }

            /* 文件大小限制 20MB */
            if (file.size > 20 * 1024 * 1024) {
                S.toast('图片过大，请选择小于20MB的图片');
                if (status) {
                    status.textContent = '文件超过20MB限制';
                    status.className = 'sf-status sf-status-error';
                }
                return;
            }

            /*
             * 核心原则：绝对不压缩、不转码
             * 直接以原始 Blob 存入 IndexedDB
             * 这样无论图片多大、画质多高，都100%保留
             */
            var originalBlob = file.slice(0, file.size, file.type);

            /* 先预览 */
            if (self._previewUrl) {
                URL.revokeObjectURL(self._previewUrl);
            }
            var previewUrl = URL.createObjectURL(originalBlob);
            self._previewUrl = previewUrl;

            if (loading) loading.style.display = 'none';
            previewInner.style.backgroundImage = 'url(' + previewUrl + ')';
            previewInner.style.backgroundSize = 'cover';
            previewInner.style.backgroundPosition = 'center';

            /* 显示尺寸信息 */
            var sizeKB = (file.size / 1024).toFixed(1);
            var sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            var sizeText = file.size > 1024 * 1024 ? sizeMB + ' MB' : sizeKB + ' KB';

            var img = new Image();
            img.onload = function () {
                if (info) info.textContent = img.naturalWidth + ' × ' + img.naturalHeight + '  ·  ' + sizeText;
            };
            img.src = previewUrl;

            /* 存入 IndexedDB（原图，不做任何处理） */
            saveWallpaperBlob(originalBlob, function (err) {
                if (err) {
                    console.error('[壁纸] 存储失败:', err);
                    if (status) {
                        status.textContent = '壁纸存储失败';
                        status.className = 'sf-status sf-status-error';
                    }
                    S.toast('壁纸保存失败');
                    return;
                }

                /* 保存设置 */
                S.saveSetting('wallpaper', { type: 'custom' });

                /* 立即应用到主页面背景 */
                self.applyToBackground(previewUrl);

                if (status) {
                    status.textContent = '壁纸已更换  ·  ' + sizeText + '（原图无损）';
                    status.className = 'sf-status sf-status-success';
                }
                S.toast('壁纸已更换');
            });
        },

        /* 应用壁纸到全局背景 */
        applyToBackground: function (url) {
            var container = document.getElementById('phone-container');
            if (!container) return;

            /* 只修改 phone-container 的 background-image，保留其他背景属性 */
            container.style.backgroundImage = 'url(' + url + ')';
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
            container.style.backgroundRepeat = 'no-repeat';

            /* 更新 CSS 变量让子元素知道有壁纸 */
            document.documentElement.style.setProperty('--has-wallpaper', '1');
        },

        /* 移除壁纸，恢复默认 */
        removeWallpaper: function (sub) {
            var S = window.Settings;
            var self = this;
            var previewInner = sub.querySelector('#sf-wp-preview-inner');
            var loading = sub.querySelector('#sf-wp-loading');
            var info = sub.querySelector('#sf-wp-info');
            var status = sub.querySelector('#sf-wp-status');

            /* 从 IndexedDB 删除 */
            removeWallpaperBlob(function (err) {
                if (err) {
                    console.error('[壁纸] 删除失败:', err);
                }

                /* 清除设置 */
                S.saveSetting('wallpaper', {});

                /* 释放预览 URL */
                if (self._previewUrl) {
                    URL.revokeObjectURL(self._previewUrl);
                    self._previewUrl = null;
                }

                /* 恢复默认背景 */
                var defaultBg = '#d4d4d4';
                var container = document.getElementById('phone-container');
                if (container) {
                    container.style.backgroundImage = 'none';
                    container.style.backgroundSize = '';
                    container.style.backgroundPosition = '';
                    container.style.backgroundRepeat = '';
                    container.style.background = defaultBg;
                }

                document.documentElement.style.setProperty('--bg', defaultBg);
                document.documentElement.style.removeProperty('--has-wallpaper');

                /* 更新预览 */
                if (loading) loading.style.display = 'none';
                previewInner.style.backgroundImage = 'none';
                previewInner.style.background = defaultBg;
                if (info) info.textContent = '默认壁纸';

                if (status) {
                    status.textContent = '已恢复默认壁纸';
                    status.className = 'sf-status sf-status-success';
                }
                S.toast('壁纸已移除');
            });
        }
    };

    window.WallpaperSettings = WallpaperSettings;
})();
