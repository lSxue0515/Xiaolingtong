(function () {
    'use strict';

    var DB_NAME = 'lingji_db';
    var DB_VERSION = 1;
    var STORE_NAME = 'images';
    var ICON_PREFIX = '_appicon_';

    var ICONS_CHECK = '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

    /* 所有可更换图标的APP列表 */
    var APP_LIST = [
        { id: 'settings', name: '设置' },
        { id: 'theater', name: '线下剧场' },
        { id: 'music', name: '音乐' },
        { id: 'mood', name: '心绪回响' },
        { id: 'chat', name: 'Chat' },
        { id: 'novel', name: '柿子小说' },
        { id: 'worldbook', name: '世界书' }
    ];

    /* 图标形状选项 */
    var SHAPES = [
        { id: 'rounded', name: '圆角矩形' },
        { id: 'circle', name: '圆形' },
        { id: 'squircle', name: '超椭圆' }
    ];

    /* 图标大小选项 */
    var SIZES = [
        { id: 'small', name: '小' },
        { id: 'medium', name: '标准' },
        { id: 'large', name: '大' }
    ];

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

    function saveIconBlob(appId, blob, callback) {
        openDB(function (err, db) {
            if (err) { if (callback) callback(err); return; }
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(blob, ICON_PREFIX + appId);
            tx.oncomplete = function () { if (callback) callback(null); };
            tx.onerror = function () { if (callback) callback(new Error('写入失败')); };
        });
    }

    function loadIconBlob(appId, callback) {
        openDB(function (err, db) {
            if (err) { callback(err); return; }
            var tx = db.transaction(STORE_NAME, 'readonly');
            var req = tx.objectStore(STORE_NAME).get(ICON_PREFIX + appId);
            req.onsuccess = function () { callback(null, req.result || null); };
            req.onerror = function () { callback(new Error('读取失败')); };
        });
    }

    function removeIconBlob(appId, callback) {
        openDB(function (err, db) {
            if (err) { if (callback) callback(err); return; }
            var tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(ICON_PREFIX + appId);
            tx.oncomplete = function () { if (callback) callback(null); };
            tx.onerror = function () { if (callback) callback(new Error('删除失败')); };
        });
    }

    /* ====== 应用图标设置模块 ====== */
    var AppiconSettings = {

        /* 用于释放的 blob URL 集合 */
        _blobUrls: {},

        buildPage: function () {
            var S = window.Settings;
            var saved = S.loadSetting('appicon') || {};

            var html = S.subHeader('应用图标设置') + '<div class="settings-body">';

            /* 板块标题 */
            html += '<div class="sf-section-title">' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>' +
                '<rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>' +
                '<span>图标管理</span></div>';

            /* 图标形状 */
            html += '<div class="sf-label">图标形状</div><div class="sf-select-group">';
            for (var i = 0; i < SHAPES.length; i++) {
                var act = (saved.shape === SHAPES[i].id) ? ' active' : ((!saved.shape && i === 0) ? ' active' : '');
                html += '<div class="sf-select-item' + act + '" data-icon-shape="' + SHAPES[i].id + '">' +
                    '<span class="sf-name">' + SHAPES[i].name + '</span>' +
                    '<svg class="sf-check" viewBox="0 0 24 24">' + ICONS_CHECK + '</svg></div>';
            }
            html += '</div>';

            /* 图标大小 */
            html += '<div class="sf-label">图标大小</div><div class="sf-select-group">';
            for (var j = 0; j < SIZES.length; j++) {
                var act2 = (saved.size === SIZES[j].id) ? ' active' : ((!saved.size && j === 1) ? ' active' : '');
                html += '<div class="sf-select-item' + act2 + '" data-icon-size="' + SIZES[j].id + '">' +
                    '<span class="sf-name">' + SIZES[j].name + '</span>' +
                    '<svg class="sf-check" viewBox="0 0 24 24">' + ICONS_CHECK + '</svg></div>';
            }
            html += '</div>';

            /* 保存形状和大小 */
            html += '<button class="sf-save-btn" id="sf-icon-save">保存形状与大小</button>';

            /* 自定义图标图片 */
            html += '<div class="sf-label">自定义图标图片</div>';
            html += '<div class="sf-hint">点击可更换对应APP的图标图片，支持 JPG、PNG、WebP，原图无损存储</div>';
            html += '<div class="sf-appicon-list" id="sf-appicon-list">';

            for (var k = 0; k < APP_LIST.length; k++) {
                var app = APP_LIST[k];
                html += '<div class="sf-appicon-row" data-appicon-id="' + app.id + '">' +
                    '<div class="sf-appicon-preview" id="sf-appicon-preview-' + app.id + '">' +
                    '<div class="sf-appicon-placeholder">?</div>' +
                    '</div>' +
                    '<div class="sf-appicon-info">' +
                    '<div class="sf-appicon-name">' + app.name + '</div>' +
                    '<div class="sf-appicon-status" id="sf-appicon-status-' + app.id + '">加载中...</div>' +
                    '</div>' +
                    '<div class="sf-appicon-actions">' +
                    '<label class="sf-appicon-btn sf-appicon-change">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
                    '<span>更换</span>' +
                    '<input type="file" accept="image/jpeg,image/png,image/webp,image/*" class="sf-appicon-file" data-app="' + app.id + '" style="display:none">' +
                    '</label>' +
                    '<button class="sf-appicon-btn sf-appicon-reset" data-reset="' + app.id + '">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                    '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/></svg>' +
                    '<span>还原</span>' +
                    '</button>' +
                    '</div>' +
                    '</div>';
            }

            html += '</div>';

            /* 全部还原 */
            html += '<button class="sf-danger-btn" id="sf-appicon-reset-all">全部还原为默认图标</button>';

            html += '</div>';
            return html;
        },

        initPage: function (sub) {
            var S = window.Settings;
            var self = this;

            /* 形状/大小选择 */
            S.bindSelectGroup(sub, 'data-icon-shape');
            S.bindSelectGroup(sub, 'data-icon-size');

            /* 保存形状/大小 */
            var saveBtn = sub.querySelector('#sf-icon-save');
            if (saveBtn) {
                saveBtn.addEventListener('click', function () {
                    var shape = sub.querySelector('[data-icon-shape].active');
                    var size = sub.querySelector('[data-icon-size].active');
                    var cfg = S.loadSetting('appicon') || {};
                    cfg.shape = shape ? shape.getAttribute('data-icon-shape') : 'rounded';
                    cfg.size = size ? size.getAttribute('data-icon-size') : 'medium';
                    S.saveSetting('appicon', cfg);
                    S.applyIconSettings(cfg);
                    S.toast('图标设置已保存');
                });
            }

            /* 加载各 APP 图标预览 */
            for (var i = 0; i < APP_LIST.length; i++) {
                (function (app) {
                    self.loadIconPreview(sub, app.id);
                })(APP_LIST[i]);
            }

            /* 更换图标文件输入 */
            var fileInputs = sub.querySelectorAll('.sf-appicon-file');
            for (var j = 0; j < fileInputs.length; j++) {
                (function (input) {
                    input.addEventListener('change', function () {
                        var file = input.files[0];
                        if (!file) return;
                        var appId = input.getAttribute('data-app');
                        self.changeIcon(sub, appId, file);
                        /* 清空 input 以便再次选同一文件 */
                        input.value = '';
                    });
                })(fileInputs[j]);
            }

            /* 单个还原 */
            var resetBtns = sub.querySelectorAll('.sf-appicon-reset');
            for (var k = 0; k < resetBtns.length; k++) {
                (function (btn) {
                    btn.addEventListener('click', function () {
                        var appId = btn.getAttribute('data-reset');
                        self.resetIcon(sub, appId);
                    });
                })(resetBtns[k]);
            }

            /* 全部还原 */
            var resetAllBtn = sub.querySelector('#sf-appicon-reset-all');
            if (resetAllBtn) {
                resetAllBtn.addEventListener('click', function () {
                    self.resetAllIcons(sub);
                });
            }
        },

        /* 加载单个图标预览 */
        loadIconPreview: function (sub, appId) {
            var preview = sub.querySelector('#sf-appicon-preview-' + appId);
            var status = sub.querySelector('#sf-appicon-status-' + appId);
            var self = this;

            loadIconBlob(appId, function (err, blob) {
                if (err || !blob) {
                    /* 无自定义图标，显示默认SVG */
                    if (status) status.textContent = '使用默认图标';
                    self.showDefaultPreview(preview, appId);
                    return;
                }

                var url = URL.createObjectURL(blob);
                self._blobUrls[appId] = url;

                preview.innerHTML = '<img src="' + url + '" class="sf-appicon-img" alt="">';

                var sizeKB = (blob.size / 1024).toFixed(1);
                var sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
                var sizeText = blob.size > 1024 * 1024 ? sizeMB + ' MB' : sizeKB + ' KB';

                if (status) status.textContent = '自定义  ·  ' + sizeText;
            });
        },

        /* 显示默认预览（从主页面获取原始SVG） */
        showDefaultPreview: function (preview, appId) {
            var appEl = document.querySelector('.app-icon[data-app="' + appId + '"] .icon-img');
            if (appEl) {
                var svg = appEl.querySelector('svg');
                if (svg) {
                    preview.innerHTML = '<div class="sf-appicon-svg">' + svg.outerHTML + '</div>';
                    return;
                }
                /* 可能已经是自定义图片 */
                var img = appEl.querySelector('img');
                if (img) {
                    preview.innerHTML = '<img src="' + img.src + '" class="sf-appicon-img" alt="">';
                    return;
                }
            }
            preview.innerHTML = '<div class="sf-appicon-placeholder">?</div>';
        },

        /* 更换图标 */
        changeIcon: function (sub, appId, file) {
            var S = window.Settings;
            var self = this;

            if (!file.type.match(/^image\//)) {
                S.toast('请选择图片文件');
                return;
            }

            /* 容量限制 10MB */
            if (file.size > 10 * 1024 * 1024) {
                S.toast('图片过大，请选择小于10MB的图片');
                return;
            }

            /* 原始 Blob，不做任何压缩或转码 */
            var originalBlob = file.slice(0, file.size, file.type);

            /* 释放旧 URL */
            if (self._blobUrls[appId]) {
                URL.revokeObjectURL(self._blobUrls[appId]);
            }

            var previewUrl = URL.createObjectURL(originalBlob);
            self._blobUrls[appId] = previewUrl;

            /* 更新设置页预览 */
            var preview = sub.querySelector('#sf-appicon-preview-' + appId);
            var status = sub.querySelector('#sf-appicon-status-' + appId);

            if (preview) {
                preview.innerHTML = '<img src="' + previewUrl + '" class="sf-appicon-img" alt="">';
            }

            var sizeKB = (file.size / 1024).toFixed(1);
            var sizeMB = (file.size / (1024 * 1024)).toFixed(2);
            var sizeText = file.size > 1024 * 1024 ? sizeMB + ' MB' : sizeKB + ' KB';

            if (status) {
                status.textContent = '保存中...';
            }

            /* 存入 IndexedDB（原图，零压缩） */
            saveIconBlob(appId, originalBlob, function (err) {
                if (err) {
                    S.toast('图标保存失败');
                    if (status) status.textContent = '保存失败';
                    return;
                }

                /* 记录到设置（标记哪些APP使用了自定义图标） */
                var cfg = S.loadSetting('appicon') || {};
                if (!cfg.customIcons) cfg.customIcons = {};
                cfg.customIcons[appId] = true;
                S.saveSetting('appicon', cfg);

                /* 应用到主界面 —— 仅修改目标图标，不碰其他任何元素 */
                self.applyIconToDOM(appId, previewUrl);

                if (status) status.textContent = '自定义  ·  ' + sizeText;
                S.toast(self.getAppName(appId) + ' 图标已更换');
            });
        },

        /* 还原单个图标 */
        resetIcon: function (sub, appId) {
            var S = window.Settings;
            var self = this;

            removeIconBlob(appId, function (err) {
                if (err) console.error('[图标] 删除失败:', err);

                /* 更新设置 */
                var cfg = S.loadSetting('appicon') || {};
                if (cfg.customIcons) {
                    delete cfg.customIcons[appId];
                    S.saveSetting('appicon', cfg);
                }

                /* 释放 URL */
                if (self._blobUrls[appId]) {
                    URL.revokeObjectURL(self._blobUrls[appId]);
                    delete self._blobUrls[appId];
                }

                /* 恢复DOM中的默认SVG图标 */
                self.restoreDefaultIcon(appId);

                /* 更新预览 */
                var preview = sub.querySelector('#sf-appicon-preview-' + appId);
                var status = sub.querySelector('#sf-appicon-status-' + appId);
                if (preview) self.showDefaultPreview(preview, appId);
                if (status) status.textContent = '使用默认图标';

                S.toast(self.getAppName(appId) + ' 图标已还原');
            });
        },

        /* 全部还原 */
        resetAllIcons: function (sub) {
            var S = window.Settings;
            var self = this;
            var count = APP_LIST.length;
            var done = 0;

            for (var i = 0; i < APP_LIST.length; i++) {
                (function (appId) {
                    removeIconBlob(appId, function () {
                        if (self._blobUrls[appId]) {
                            URL.revokeObjectURL(self._blobUrls[appId]);
                            delete self._blobUrls[appId];
                        }
                        self.restoreDefaultIcon(appId);

                        var preview = sub.querySelector('#sf-appicon-preview-' + appId);
                        var status = sub.querySelector('#sf-appicon-status-' + appId);
                        if (preview) self.showDefaultPreview(preview, appId);
                        if (status) status.textContent = '使用默认图标';

                        done++;
                        if (done >= count) {
                            var cfg = S.loadSetting('appicon') || {};
                            cfg.customIcons = {};
                            S.saveSetting('appicon', cfg);
                            S.toast('所有图标已还原');
                        }
                    });
                })(APP_LIST[i].id);
            }
        },

        /* 将自定义图标应用到主页面 DOM —— 只操作目标 .icon-img，不碰其他任何元素 */
        applyIconToDOM: function (appId, imgUrl) {
            var iconImg = document.querySelector('.app-icon[data-app="' + appId + '"] .icon-img');
            if (!iconImg) return;

            /* 保存原始 SVG（如果还没保存过） */
            if (!iconImg.getAttribute('data-original-svg') && iconImg.querySelector('svg')) {
                iconImg.setAttribute('data-original-svg', iconImg.innerHTML);
            }

            /* 替换为自定义图片 —— 只改 innerHTML，不碰 style.background 等属性 */
            iconImg.innerHTML = '<img src="' + imgUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;" alt="">';
        },

        /* 恢复默认SVG图标 */
        restoreDefaultIcon: function (appId) {
            var iconImg = document.querySelector('.app-icon[data-app="' + appId + '"] .icon-img');
            if (!iconImg) return;

            var originalSvg = iconImg.getAttribute('data-original-svg');
            if (originalSvg) {
                iconImg.innerHTML = originalSvg;
                iconImg.removeAttribute('data-original-svg');
            }
        },

        /* 启动时应用所有自定义图标 */
        applyAllIcons: function () {
            var S = window.Settings;
            var cfg = S.loadSetting('appicon') || {};
            var customs = cfg.customIcons || {};
            var self = this;

            var appIds = Object.keys(customs);
            if (appIds.length === 0) return;

            openDB(function (err, db) {
                if (err) return;

                for (var i = 0; i < appIds.length; i++) {
                    (function (appId) {
                        var tx = db.transaction(STORE_NAME, 'readonly');
                        var req = tx.objectStore(STORE_NAME).get(ICON_PREFIX + appId);
                        req.onsuccess = function () {
                            if (req.result) {
                                var url = URL.createObjectURL(req.result);
                                self._blobUrls[appId] = url;
                                self.applyIconToDOM(appId, url);
                            }
                        };
                    })(appIds[i]);
                }
            });
        },

        /* 辅助：获取APP名称 */
        getAppName: function (appId) {
            for (var i = 0; i < APP_LIST.length; i++) {
                if (APP_LIST[i].id === appId) return APP_LIST[i].name;
            }
            return appId;
        }
    };

    window.AppiconSettings = AppiconSettings;
})();
