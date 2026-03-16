(function () {
    'use strict';

    var DB_NAME = 'lingji_db';
    var DB_VERSION = 1;
    var STORE_NAME = 'images';

    function openDB(callback) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        req.onsuccess = function (e) { callback(null, e.target.result); };
        req.onerror = function () { callback(new Error('DB error')); };
    }

    var DataSettings = {

        buildPage: function () {
            var S = window.Settings;
            var html = S.subHeader('数据管理') + '<div class="settings-body">';

            /* 存储信息 */
            html += '<div class="sf-label">存储信息</div>';
            html += '<div class="sf-info-card" id="sf-data-info">' +
                '<div class="sf-info-row"><span>本地设置</span><span id="sf-ls-size">计算中...</span></div>' +
                '<div class="sf-info-row"><span>图片/音频缓存</span><span id="sf-idb-size">计算中...</span></div>' +
                '</div>';

            /* 备份 */
            html += '<div class="sf-label">备份数据</div>';
            html += '<div class="sf-hint">备份所有数据，包括壁纸、小组件样式、应用图标、聊天记录等</div>';
            html += '<button class="sf-save-btn" id="sf-backup-btn">备份所有数据</button>';

            /* 导入 */
            html += '<div class="sf-label">导入数据</div>';
            html += '<div class="sf-hint">导入之前备份的 .json 文件以恢复全部数据</div>';
            html += '<label class="sf-wp-action-card" id="sf-import-label">' +
                '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
                '<span class="sf-wp-action-name">选择备份文件</span>' +
                '<span class="sf-wp-action-hint">.json 格式</span>' +
                '<input type="file" accept=".json,application/json" id="sf-import-file" style="display:none">' +
                '</label>';

            html += '<div class="sf-status" id="sf-data-status"></div>';

            /* 危险区域 */
            html += '<div class="sf-label" style="color:#c44;">危险区域</div>';
            html += '<button class="sf-danger-btn" id="sf-factory-reset">清除所有数据（出厂设置）</button>';
            html += '<div class="sf-hint" style="color:#c44;">此操作不可逆，将清除所有设置、壁纸、图标、铃声、聊天记录等全部数据</div>';

            html += '</div>';
            return html;
        },

        initPage: function (sub) {
            var S = window.Settings;
            var self = this;

            self.calcStorageSize(sub);

            /* 备份 */
            sub.querySelector('#sf-backup-btn').addEventListener('click', function () {
                self.backupAll(sub);
            });

            /* 导入 */
            var importFile = sub.querySelector('#sf-import-file');
            if (importFile) {
                importFile.addEventListener('change', function () {
                    var file = importFile.files[0];
                    if (!file) return;
                    self.importBackup(sub, file);
                    importFile.value = '';
                });
            }

            /* 出厂设置 */
            sub.querySelector('#sf-factory-reset').addEventListener('click', function () {
                if (!confirm('⚠️ 确定清除所有数据？此操作不可逆！\n\n将删除：设置、壁纸、图标、铃声、聊天记录等全部数据。')) return;
                if (!confirm('再次确认：真的要恢复出厂设置吗？')) return;
                self.factoryReset();
            });
        },

        calcStorageSize: function (sub) {
            var S = window.Settings;
            var lsEl = sub.querySelector('#sf-ls-size');
            try {
                var total = 0;
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);
                    total += (key.length + localStorage.getItem(key).length) * 2;
                }
                lsEl.textContent = S.formatBytes(total);
            } catch (e) {
                lsEl.textContent = '无法计算';
            }

            var idbEl = sub.querySelector('#sf-idb-size');
            if (navigator.storage && navigator.storage.estimate) {
                navigator.storage.estimate().then(function (est) {
                    idbEl.textContent = S.formatBytes(est.usage || 0);
                }).catch(function () {
                    idbEl.textContent = '无法计算';
                });
            } else {
                idbEl.textContent = '不支持查询';
            }
        },

        /* 备份所有数据（localStorage + IndexedDB blobs → 单个 JSON） */
        backupAll: function (sub) {
            var S = window.Settings;
            var status = sub.querySelector('#sf-data-status');
            if (status) { status.textContent = '正在备份...'; status.className = 'sf-status sf-status-loading'; }

            /* 1. 收集 localStorage */
            var lsData = {};
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var key = localStorage.key(i);
                    lsData[key] = localStorage.getItem(key);
                }
            } catch (e) { /* ignore */ }

            /* 2. 收集 IndexedDB blobs */
            openDB(function (err, db) {
                if (err) {
                    self.finishBackup(sub, lsData, {});
                    return;
                }
                var tx = db.transaction(STORE_NAME, 'readonly');
                var store = tx.objectStore(STORE_NAME);
                var allKeys = store.getAllKeys();
                var blobData = {};
                var pending = 0;

                allKeys.onsuccess = function () {
                    var keys = allKeys.result || [];
                    if (keys.length === 0) {
                        finishBackup(sub, lsData, blobData);
                        return;
                    }
                    pending = keys.length;
                    for (var j = 0; j < keys.length; j++) {
                        (function (k) {
                            var getReq = store.get(k);
                            getReq.onsuccess = function () {
                                if (getReq.result instanceof Blob) {
                                    var reader = new FileReader();
                                    reader.onload = function () {
                                        blobData[k] = {
                                            type: getReq.result.type,
                                            data: reader.result /* base64 data URL */
                                        };
                                        pending--;
                                        if (pending <= 0) finishBackup(sub, lsData, blobData);
                                    };
                                    reader.readAsDataURL(getReq.result);
                                } else {
                                    pending--;
                                    if (pending <= 0) finishBackup(sub, lsData, blobData);
                                }
                            };
                            getReq.onerror = function () {
                                pending--;
                                if (pending <= 0) finishBackup(sub, lsData, blobData);
                            };
                        })(keys[j]);
                    }
                };

                allKeys.onerror = function () {
                    finishBackup(sub, lsData, blobData);
                };
            });

            function finishBackup(sub2, ls, blobs) {
                var backup = {
                    version: 1,
                    timestamp: new Date().toISOString(),
                    localStorage: ls,
                    indexedDB: blobs
                };
                var json = JSON.stringify(backup);
                var blob = new Blob([json], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'lingji-backup-' + new Date().toISOString().slice(0, 10) + '.json';
                a.click();
                URL.revokeObjectURL(url);

                var st = sub2.querySelector('#sf-data-status');
                if (st) { st.textContent = '备份完成  ·  ' + S.formatBytes(json.length); st.className = 'sf-status sf-status-success'; }
                S.toast('数据已备份');
            }
        },

        /* 导入备份 */
        importBackup: function (sub, file) {
            var S = window.Settings;
            var status = sub.querySelector('#sf-data-status');
            if (status) { status.textContent = '正在导入...'; status.className = 'sf-status sf-status-loading'; }

            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var backup = JSON.parse(reader.result);
                    if (!backup.localStorage) throw new Error('无效备份文件');

                    /* 恢复 localStorage */
                    var ls = backup.localStorage;
                    for (var key in ls) {
                        if (ls.hasOwnProperty(key)) {
                            localStorage.setItem(key, ls[key]);
                        }
                    }

                    /* 恢复 IndexedDB blobs */
                    var blobs = backup.indexedDB || {};
                    var blobKeys = Object.keys(blobs);
                    if (blobKeys.length === 0) {
                        if (status) { status.textContent = '导入完成，即将刷新...'; status.className = 'sf-status sf-status-success'; }
                        S.toast('数据已恢复');
                        setTimeout(function () { location.reload(); }, 1500);
                        return;
                    }

                    openDB(function (err, db) {
                        if (err) {
                            S.toast('IndexedDB 恢复失败');
                            setTimeout(function () { location.reload(); }, 1500);
                            return;
                        }
                        var pending = blobKeys.length;
                        for (var i = 0; i < blobKeys.length; i++) {
                            (function (k) {
                                var item = blobs[k];
                                /* 将 base64 data URL 转回 Blob */
                                var parts = item.data.split(',');
                                var mime = parts[0].match(/:(.*?);/)[1];
                                var bstr = atob(parts[1]);
                                var n = bstr.length;
                                var u8arr = new Uint8Array(n);
                                for (var x = 0; x < n; x++) u8arr[x] = bstr.charCodeAt(x);
                                var restoredBlob = new Blob([u8arr], { type: mime });

                                var tx = db.transaction(STORE_NAME, 'readwrite');
                                tx.objectStore(STORE_NAME).put(restoredBlob, k);
                                tx.oncomplete = function () {
                                    pending--;
                                    if (pending <= 0) {
                                        if (status) { status.textContent = '导入完成，即将刷新...'; status.className = 'sf-status sf-status-success'; }
                                        S.toast('数据已恢复');
                                        setTimeout(function () { location.reload(); }, 1500);
                                    }
                                };
                            })(blobKeys[i]);
                        }
                    });

                } catch (e) {
                    if (status) { status.textContent = '导入失败：文件格式错误'; status.className = 'sf-status sf-status-error'; }
                    S.toast('导入失败');
                }
            };
            reader.readAsText(file);
        },

        /* 出厂设置 */
        factoryReset: function () {
            /* 清除 localStorage */
            try { localStorage.clear(); } catch (e) { /* ignore */ }

            /* 清除 IndexedDB */
            try {
                var req = indexedDB.deleteDatabase(DB_NAME);
                req.onsuccess = function () { location.reload(); };
                req.onerror = function () { location.reload(); };
                req.onblocked = function () { location.reload(); };
            } catch (e) {
                location.reload();
            }
        }
    };

    window.DataSettings = DataSettings;
})();
