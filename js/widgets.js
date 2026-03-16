(function () {
    'use strict';

    /* ========== IndexedDB 无损图片存储 ========== */
    var DB_NAME = 'lingji_db';
    var DB_VER = 1;
    var STORE_IMG = 'images';
    var STORE_TEXT = 'texts';
    var _db = null;

    function openDB(cb) {
        if (_db) return cb(_db);
        var req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_IMG)) {
                db.createObjectStore(STORE_IMG);
            }
            if (!db.objectStoreNames.contains(STORE_TEXT)) {
                db.createObjectStore(STORE_TEXT);
            }
        };
        req.onsuccess = function (e) {
            _db = e.target.result;
            cb(_db);
        };
        req.onerror = function () {
            console.warn('IndexedDB open failed, falling back to memory only');
            cb(null);
        };
    }

    /* 存原始文件 Blob（无损、无大小限制） */
    function saveBlob(key, blob) {
        openDB(function (db) {
            if (!db) return;
            var tx = db.transaction(STORE_IMG, 'readwrite');
            tx.objectStore(STORE_IMG).put(blob, key);
        });
    }

    /* 读取 Blob 并转为 ObjectURL */
    function loadBlob(key, cb) {
        openDB(function (db) {
            if (!db) return cb(null);
            var tx = db.transaction(STORE_IMG, 'readonly');
            var req = tx.objectStore(STORE_IMG).get(key);
            req.onsuccess = function () {
                if (req.result) {
                    cb(URL.createObjectURL(req.result));
                } else {
                    cb(null);
                }
            };
            req.onerror = function () { cb(null); };
        });
    }

    /* 存文字 */
    function saveText(key, val) {
        openDB(function (db) {
            if (!db) {
                try {
                    var d = JSON.parse(localStorage.getItem('lingji') || '{}');
                    d[key] = val;
                    localStorage.setItem('lingji', JSON.stringify(d));
                } catch (e) { /* ignore */ }
                return;
            }
            var tx = db.transaction(STORE_TEXT, 'readwrite');
            tx.objectStore(STORE_TEXT).put(val, key);
        });
    }

    /* 读文字 */
    function loadText(key, cb) {
        openDB(function (db) {
            if (!db) {
                try {
                    var d = JSON.parse(localStorage.getItem('lingji') || '{}');
                    cb(d[key] || null);
                } catch (e) { cb(null); }
                return;
            }
            var tx = db.transaction(STORE_TEXT, 'readonly');
            var req = tx.objectStore(STORE_TEXT).get(key);
            req.onsuccess = function () { cb(req.result || null); };
            req.onerror = function () { cb(null); };
        });
    }


    /* ========== 主组件逻辑 ========== */
    var W = {
        playing: false,

        /* 所有图片 target id */
        photoTargets: ['main-photo', 'sub-photo', 'vinyl-cover', 'p2-photo'],
        /* 所有文字 target id */
        textTargets: ['bubble-text', 'p2-text'],

        init: function () {
            this.photos();
            this.texts();
            this.player();
            this.loadAll();
        },

        /* ===== 图片：读取原始文件 Blob 存入 IndexedDB ===== */
        photos: function () {
            var inputs = document.querySelectorAll('.photo-input');
            for (var i = 0; i < inputs.length; i++) {
                (function (input) {
                    input.addEventListener('change', function () {
                        var file = input.files[0];
                        if (!file) return;
                        var tid = input.getAttribute('data-target');

                        /* 直接存原始 Blob（不压缩、不转 base64） */
                        saveBlob(tid, file);

                        /* 立即显示 */
                        var url = URL.createObjectURL(file);
                        W.applyImage(tid, url);
                    });
                })(inputs[i]);
            }
        },

        applyImage: function (tid, url) {
            var img = document.getElementById(tid);
            if (!img) return;
            img.src = url;
            img.style.display = 'block';
            var empty = document.getElementById(tid + '-empty');
            if (empty) empty.classList.add('hidden');
        },

        /* ===== 文字编辑 ===== */
        texts: function () {
            var bubble = document.getElementById('tw-bubble');
            if (bubble) {
                bubble.addEventListener('click', function (e) {
                    if (e.target.closest('.photo-input')) return;
                    W.editText('编辑气泡文字', 'bubble-text');
                });
            }
            var cap = document.getElementById('p2-caption');
            if (cap) {
                cap.addEventListener('click', function () {
                    W.editText('编辑文字', 'p2-text');
                });
            }
        },

        editText: function (title, targetId) {
            var modal = document.getElementById('edit-modal');
            var el = document.getElementById(targetId);
            if (!modal || !el) return;

            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-body').innerHTML =
                '<textarea id="edit-ta">' + el.textContent + '</textarea>';
            modal.classList.remove('hidden');

            var ta = document.getElementById('edit-ta');
            ta.focus();
            ta.setSelectionRange(ta.value.length, ta.value.length);

            var close = function () { modal.classList.add('hidden'); unbind(); };
            var ok = function () {
                var v = ta.value.trim();
                if (v) {
                    el.textContent = v;
                    saveText(targetId, v);
                }
                close();
            };

            var btnOk = document.getElementById('modal-ok');
            var btnNo = document.getElementById('modal-cancel');
            var mask = modal.querySelector('.modal-mask');

            btnOk.addEventListener('click', ok);
            btnNo.addEventListener('click', close);
            mask.addEventListener('click', close);

            function unbind() {
                btnOk.removeEventListener('click', ok);
                btnNo.removeEventListener('click', close);
                mask.removeEventListener('click', close);
            }
        },

        /* ===== 播放器 ===== */
        player: function () {
            var btn = document.getElementById('play-btn');
            var disc = document.getElementById('vinyl-disc');
            var arm = document.getElementById('vinyl-arm');
            var icon = document.getElementById('play-icon');
            if (!btn) return;

            btn.addEventListener('click', function () {
                W.playing = !W.playing;
                if (W.playing) {
                    icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
                    disc.classList.add('spin');
                    arm.classList.add('on');
                } else {
                    icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
                    disc.classList.remove('spin');
                    arm.classList.remove('on');
                }
            });
        },

        /* ===== 页面加载时恢复所有数据 ===== */
        loadAll: function () {
            /* 恢复图片 */
            for (var i = 0; i < this.photoTargets.length; i++) {
                (function (tid) {
                    loadBlob(tid, function (url) {
                        if (url) W.applyImage(tid, url);
                    });
                })(this.photoTargets[i]);
            }

            /* 恢复文字 */
            for (var j = 0; j < this.textTargets.length; j++) {
                (function (tid) {
                    loadText(tid, function (val) {
                        if (val) {
                            var el = document.getElementById(tid);
                            if (el) el.textContent = val;
                        }
                    });
                })(this.textTargets[j]);
            }
        }
    };

    document.addEventListener('DOMContentLoaded', function () { W.init(); });
    window.Widgets = W;
})();
