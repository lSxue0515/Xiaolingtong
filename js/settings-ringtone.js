(function () {
    'use strict';

    var DB_NAME = 'lingji_db';
    var DB_VERSION = 1;
    var STORE_NAME = 'images';
    var RING_KEY = '_ringtone';

    var ICONS_CHECK = '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

    function openDB(callback) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        req.onsuccess = function (e) { callback(null, e.target.result); };
        req.onerror = function () { callback(new Error('DB error')); };
    }

    var RingtoneSettings = {

        _audioEl: null,
        _blobUrl: null,

        buildPage: function () {
            var S = window.Settings;
            var saved = S.loadSetting('ringtone') || {};

            var html = S.subHeader('铃声设置') + '<div class="settings-body">';

            /* 当前铃声 */
            html += '<div class="sf-label">当前铃声</div>';
            html += '<div class="sf-info-card" id="sf-ring-info">' +
                '<div class="sf-info-row"><span>铃声</span><span id="sf-ring-name">' + (saved.fileName || '未设置') + '</span></div>' +
                '<div class="sf-info-row"><span>大小</span><span id="sf-ring-size">' + (saved.fileSize || '-') + '</span></div>' +
                '</div>';

            /* 导入铃声 */
            html += '<div class="sf-label">导入铃声</div>';
            html += '<label class="sf-wp-action-card" id="sf-ring-import-label">' +
                '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
                '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
                '<span class="sf-wp-action-name">选择 MP3 文件</span>' +
                '<span class="sf-wp-action-hint">支持 MP3 格式</span>' +
                '<input type="file" accept="audio/mpeg,audio/mp3,.mp3" id="sf-ring-file" style="display:none">' +
                '</label>';

            /* 试听 */
            html += '<div class="sf-label">试听</div>';
            html += '<div class="sf-ring-player" id="sf-ring-player">' +
                '<button class="sf-ring-play-btn" id="sf-ring-play" disabled>' +
                '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
                '</button>' +
                '<div class="sf-ring-progress" id="sf-ring-progress">' +
                '<div class="sf-ring-bar" id="sf-ring-bar"></div>' +
                '</div>' +
                '<button class="sf-ring-stop-btn" id="sf-ring-stop" disabled>' +
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>' +
                '</button>' +
                '</div>';

            html += '<div class="sf-status" id="sf-ring-status"></div>';

            /* 移除 */
            html += '<button class="sf-danger-btn" id="sf-ring-remove">移除当前铃声</button>';

            html += '</div>';
            return html;
        },

        initPage: function (sub) {
            var S = window.Settings;
            var self = this;

            /* 尝试加载已有铃声用于试听 */
            self.loadRingtoneForPlay(sub);

            /* 导入 */
            var fileInput = sub.querySelector('#sf-ring-file');
            if (fileInput) {
                fileInput.addEventListener('change', function () {
                    var file = fileInput.files[0];
                    if (!file) return;
                    self.importRingtone(sub, file);
                    fileInput.value = '';
                });
            }

            /* 播放 */
            var playBtn = sub.querySelector('#sf-ring-play');
            if (playBtn) {
                playBtn.addEventListener('click', function () {
                    self.togglePlay(sub);
                });
            }

            /* 停止 */
            var stopBtn = sub.querySelector('#sf-ring-stop');
            if (stopBtn) {
                stopBtn.addEventListener('click', function () {
                    self.stopPlay(sub);
                });
            }

            /* 移除 */
            var removeBtn = sub.querySelector('#sf-ring-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', function () {
                    self.removeRingtone(sub);
                });
            }
        },

        loadRingtoneForPlay: function (sub) {
            var self = this;
            var playBtn = sub.querySelector('#sf-ring-play');
            var stopBtn = sub.querySelector('#sf-ring-stop');

            openDB(function (err, db) {
                if (err) return;
                var tx = db.transaction(STORE_NAME, 'readonly');
                var req = tx.objectStore(STORE_NAME).get(RING_KEY);
                req.onsuccess = function () {
                    if (req.result) {
                        if (self._blobUrl) URL.revokeObjectURL(self._blobUrl);
                        self._blobUrl = URL.createObjectURL(req.result);
                        if (playBtn) playBtn.disabled = false;
                        if (stopBtn) stopBtn.disabled = false;
                    }
                };
            });
        },

        importRingtone: function (sub, file) {
            var S = window.Settings;
            var self = this;
            var status = sub.querySelector('#sf-ring-status');
            var nameEl = sub.querySelector('#sf-ring-name');
            var sizeEl = sub.querySelector('#sf-ring-size');
            var playBtn = sub.querySelector('#sf-ring-play');
            var stopBtn = sub.querySelector('#sf-ring-stop');

            if (!file.type.match(/audio/)) {
                S.toast('请选择音频文件');
                return;
            }
            if (file.size > 20 * 1024 * 1024) {
                S.toast('文件过大，请选择小于20MB的文件');
                return;
            }

            if (status) { status.textContent = '正在导入...'; status.className = 'sf-status sf-status-loading'; }

            var blob = file.slice(0, file.size, file.type);

            openDB(function (err, db) {
                if (err) {
                    S.toast('保存失败');
                    return;
                }
                var tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(blob, RING_KEY);
                tx.oncomplete = function () {
                    var sizeKB = (file.size / 1024).toFixed(1);
                    var sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                    var sizeText = file.size > 1024 * 1024 ? sizeMB + ' MB' : sizeKB + ' KB';

                    S.saveSetting('ringtone', { fileName: file.name, fileSize: sizeText });

                    if (nameEl) nameEl.textContent = file.name;
                    if (sizeEl) sizeEl.textContent = sizeText;

                    if (self._blobUrl) URL.revokeObjectURL(self._blobUrl);
                    self._blobUrl = URL.createObjectURL(blob);
                    if (playBtn) playBtn.disabled = false;
                    if (stopBtn) stopBtn.disabled = false;

                    if (status) { status.textContent = '铃声已导入  ·  ' + sizeText; status.className = 'sf-status sf-status-success'; }
                    S.toast('铃声已导入');
                };
            });
        },

        togglePlay: function (sub) {
            var self = this;
            if (!self._blobUrl) return;

            if (self._audioEl && !self._audioEl.paused) {
                self._audioEl.pause();
                self.updatePlayIcon(sub, false);
                return;
            }

            if (!self._audioEl) {
                self._audioEl = new Audio();
                self._audioEl.addEventListener('ended', function () {
                    self.updatePlayIcon(sub, false);
                    var bar = sub.querySelector('#sf-ring-bar');
                    if (bar) bar.style.width = '0%';
                });
                self._audioEl.addEventListener('timeupdate', function () {
                    var bar = sub.querySelector('#sf-ring-bar');
                    if (bar && self._audioEl.duration) {
                        bar.style.width = (self._audioEl.currentTime / self._audioEl.duration * 100) + '%';
                    }
                });
            }

            self._audioEl.src = self._blobUrl;
            self._audioEl.play();
            self.updatePlayIcon(sub, true);
        },

        stopPlay: function (sub) {
            if (this._audioEl) {
                this._audioEl.pause();
                this._audioEl.currentTime = 0;
            }
            this.updatePlayIcon(sub, false);
            var bar = sub.querySelector('#sf-ring-bar');
            if (bar) bar.style.width = '0%';
        },

        updatePlayIcon: function (sub, playing) {
            var btn = sub.querySelector('#sf-ring-play');
            if (!btn) return;
            if (playing) {
                btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
            } else {
                btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            }
        },

        removeRingtone: function (sub) {
            var S = window.Settings;
            var self = this;
            var nameEl = sub.querySelector('#sf-ring-name');
            var sizeEl = sub.querySelector('#sf-ring-size');
            var playBtn = sub.querySelector('#sf-ring-play');
            var stopBtn = sub.querySelector('#sf-ring-stop');
            var status = sub.querySelector('#sf-ring-status');

            self.stopPlay(sub);

            openDB(function (err, db) {
                if (err) return;
                var tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).delete(RING_KEY);
                tx.oncomplete = function () {
                    S.saveSetting('ringtone', {});
                    if (self._blobUrl) { URL.revokeObjectURL(self._blobUrl); self._blobUrl = null; }
                    if (nameEl) nameEl.textContent = '未设置';
                    if (sizeEl) sizeEl.textContent = '-';
                    if (playBtn) playBtn.disabled = true;
                    if (stopBtn) stopBtn.disabled = true;
                    if (status) { status.textContent = '铃声已移除'; status.className = 'sf-status sf-status-success'; }
                    S.toast('铃声已移除');
                };
            });
        }
    };

    window.RingtoneSettings = RingtoneSettings;
})();
