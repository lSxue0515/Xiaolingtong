(function () {
    'use strict';

    /* ========== SVG 图标 ========== */
    var ICONS = {
        back: '<path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
        arrow: '<path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
        check: '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
        api: '<path d="M10 20v-6a2 2 0 012-2h0a2 2 0 012 2v6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M6 20v-8a2 2 0 012-2h0a2 2 0 012 2v8" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M14 20v-4a2 2 0 012-2h0a2 2 0 012 2v4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        voice: '<rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M5 10a7 7 0 0014 0" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        wallpaper: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="8.5" cy="8.5" r="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
        appicon: '<rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        font: '<path d="M4 7V4h16v3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="20" x2="16" y2="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        ringtone: '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>',
        data: '<ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" stroke="currentColor" stroke-width="1.5" fill="none"/>',
        plus: '<line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
        screen: '<rect x="2" y="4" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
    };

    function svgIcon(name, w, h) {
        return '<svg viewBox="0 0 24 24" width="' + (w || 16) + '" height="' + (h || 16) + '">' + ICONS[name] + '</svg>';
    }

    /* ========== 菜单配置 ========== */
    var MENU_ITEMS = [
        { id: 'api', icon: 'api', cls: 'si-api', name: 'API 设置', desc: '接口地址与密钥配置' },
        { id: 'voice', icon: 'voice', cls: 'si-voice', name: '语音设置', desc: '语音引擎与发音人' },
        { id: 'wallpaper', icon: 'wallpaper', cls: 'si-wallpaper', name: '更换壁纸', desc: '主题背景与自定义图片' },
        { id: 'appicon', icon: 'appicon', cls: 'si-appicon', name: '应用图标设置', desc: '图标样式与布局' },
        { id: 'font', icon: 'font', cls: 'si-font', name: '字体设置', desc: '字体风格与标签颜色' },
        { id: 'ringtone', icon: 'ringtone', cls: 'si-ringtone', name: '铃声设置', desc: '导入与试听提示音' },
        { id: 'screen', icon: 'screen', cls: 'si-screen', name: '屏幕调整', desc: '滤镜风格与布局管理' },
        { id: 'data', icon: 'data', cls: 'si-data', name: '数据管理', desc: '备份恢复与出厂设置' }
    ];

    /* ========== 预设壁纸色 ========== */
    var WALLPAPERS = [
        { id: 'w1', color: '#d4d4d4', name: '银灰' },
        { id: 'w2', color: '#c8bfb0', name: '暖沙' },
        { id: 'w3', color: '#b8c5d0', name: '雾蓝' },
        { id: 'w4', color: '#c0ccbe', name: '薄荷' },
        { id: 'w5', color: '#d4c0c8', name: '玫瑰' },
        { id: 'w6', color: '#c5c0d4', name: '薰衣草' },
        { id: 'w7', color: '#d0c8b8', name: '奶茶' },
        { id: 'w8', color: '#b5bfb0', name: '苔绿' },
        { id: 'w9', color: '#2c2c2e', name: '深黑' }
    ];

    /* ========== 字体选项 ========== */
    var FONTS = [
        { id: 'system', name: '系统默认', value: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'PingFang SC', sans-serif" },
        { id: 'serif', name: '衬线体', value: "Georgia, 'Noto Serif SC', 'Source Han Serif SC', serif" },
        { id: 'rounded', name: '圆体', value: "'SF Pro Rounded', 'PingFang SC', 'Nunito', sans-serif" },
        { id: 'mono', name: '等宽体', value: "'SF Mono', 'Menlo', 'Courier New', monospace" }
    ];

    /* ========== 字号选项 ========== */
    var FONT_SIZES = [
        { id: 'small', name: '小', scale: 0.9 },
        { id: 'medium', name: '标准', scale: 1.0 },
        { id: 'large', name: '大', scale: 1.1 },
        { id: 'xlarge', name: '特大', scale: 1.2 }
    ];

    /* ========== Settings 模块 ========== */
    var S = {
        el: null,
        currentSub: null,

        init: function () {
            this.buildPage();
            this.bindOpen();
        },

        /* 构建主页面 */
        buildPage: function () {
            var container = document.getElementById('phone-container');
            if (!container) return;

            var page = document.createElement('div');
            page.id = 'settings-page';

            /* header */
            var header = '<div class="settings-header">' +
                '<button class="settings-back" id="settings-close">' + svgIcon('back') + '</button>' +
                '<span class="settings-title">设置</span></div>';

            /* body */
            var body = '<div class="settings-body"><div class="settings-group">';
            for (var i = 0; i < MENU_ITEMS.length; i++) {
                var m = MENU_ITEMS[i];
                body += '<div class="settings-item ' + m.cls + '" data-setting="' + m.id + '">' +
                    '<div class="settings-item-icon">' + svgIcon(m.icon) + '</div>' +
                    '<div class="settings-item-text">' +
                    '<div class="settings-item-name">' + m.name + '</div>' +
                    '<div class="settings-item-desc">' + m.desc + '</div></div>' +
                    '<svg class="settings-item-arrow" viewBox="0 0 24 24">' + ICONS.arrow + '</svg></div>';
            }
            body += '</div></div>';

            /* toast */
            var toast = '<div class="settings-toast" id="settings-toast"></div>';

            page.innerHTML = header + body + toast;
            container.appendChild(page);

            this.el = page;
            this.bindEvents();
        },

        /* 绑定事件 */
        bindEvents: function () {
            var self = this;

            /* 关闭 */
            document.getElementById('settings-close').addEventListener('click', function () {
                self.close();
            });

            /* 菜单项点击 */
            var items = this.el.querySelectorAll('.settings-item[data-setting]');
            for (var i = 0; i < items.length; i++) {
                (function (item) {
                    item.addEventListener('click', function () {
                        var id = item.getAttribute('data-setting');
                        self.openSub(id);
                    });
                })(items[i]);
            }
        },

        /* 打开设置 */
        open: function () {
            if (this.el) this.el.classList.add('open');
        },

        /* 关闭设置 */
        close: function () {
            if (this.currentSub) {
                this.closeSub();
                return;
            }
            if (this.el) this.el.classList.remove('open');
        },

        /* 打开二级页 */
        openSub: function (id) {
            var self = this;
            var html = '';

            switch (id) {
                case 'api': html = this.buildApiPage(); break;
                case 'voice': html = this.buildVoicePage(); break;
                case 'wallpaper': html = this.buildWallpaperPage(); break;
                case 'appicon': html = this.buildAppiconPage(); break;
                case 'font': html = this.buildFontPage(); break;
                case 'ringtone': html = this.buildRingtonePage(); break;
                case 'screen': html = this.buildScreenPage(); break;
                case 'data': html = this.buildDataPage(); break;
            }

            if (!html) return;

            var sub = document.createElement('div');
            sub.className = 'settings-sub';
            sub.innerHTML = html;
            this.el.appendChild(sub);

            /* 绑定返回 */
            sub.querySelector('.settings-back').addEventListener('click', function () {
                self.closeSub();
            });

            /* 触发动画 */
            requestAnimationFrame(function () {
                sub.classList.add('open');
            });

            this.currentSub = sub;

            /* 初始化子页逻辑 */
            this.initSub(id, sub);
        },

        closeSub: function () {
            var sub = this.currentSub;
            if (!sub) return;
            sub.classList.remove('open');
            this.currentSub = null;
            setTimeout(function () {
                if (sub.parentNode) sub.parentNode.removeChild(sub);
            }, 320);
        },

        /* Toast */
        toast: function (msg) {
            var t = document.getElementById('settings-toast');
            if (!t) return;
            t.textContent = msg;
            t.classList.add('show');
            clearTimeout(t._timer);
            t._timer = setTimeout(function () {
                t.classList.remove('show');
            }, 1800);
        },

        /* ========== 各二级页构建 ========== */

        subHeader: function (title) {
            return '<div class="settings-header">' +
                '<button class="settings-back">' + svgIcon('back') + '</button>' +
                '<span class="settings-title">' + title + '</span></div>';
        },

        /* HTML转义工具 */
        escapeHtml: function (str) {
            if (!str) return '';
            return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        },

        /* --- API 设置（委托给独立模块） --- */
        buildApiPage: function () {
            if (window.ApiSettings) return window.ApiSettings.buildPage();
            return '';
        },

        /* --- 语音设置（委托给独立模块） --- */
        buildVoicePage: function () {
            if (window.VoiceSettings) return window.VoiceSettings.buildPage();
            return '';
        },

        /* --- 壁纸设置（委托给独立模块） --- */
        buildWallpaperPage: function () {
            if (window.WallpaperSettings) return window.WallpaperSettings.buildPage();
            return '';
        },

        /* --- 应用图标设置（委托给独立模块） --- */
        buildAppiconPage: function () {
            if (window.AppiconSettings) return window.AppiconSettings.buildPage();
            return '';
        },

        /* --- 字体设置（委托给独立模块） --- */
        buildFontPage: function () {
            if (window.FontSettings) return window.FontSettings.buildPage();
            return '';
        },

        /* --- 铃声设置（委托给独立模块） --- */
        buildRingtonePage: function () {
            if (window.RingtoneSettings) return window.RingtoneSettings.buildPage();
            return '';
        },

        /* --- 屏幕调整（委托给独立模块） --- */
        buildScreenPage: function () {
            if (window.ScreenSettings) return window.ScreenSettings.buildPage();
            return '';
        },
        /* --- 数据管理（委托给独立模块） --- */
        buildDataPage: function () {
            if (window.DataSettings) return window.DataSettings.buildPage();
            return '';
        },

        /* ========== 初始化子页逻辑 ========== */
        initSub: function (id, sub) {
            var self = this;

            switch (id) {
                case 'api':
                    if (window.ApiSettings) window.ApiSettings.initPage(sub);
                    break;

                case 'voice':
                    if (window.VoiceSettings) window.VoiceSettings.initPage(sub);
                    break;

                case 'wallpaper':
                    if (window.WallpaperSettings) window.WallpaperSettings.initPage(sub);
                    break;

                case 'appicon':
                    if (window.AppiconSettings) window.AppiconSettings.initPage(sub);
                    break;

                case 'font':
                    if (window.FontSettings) window.FontSettings.initPage(sub);
                    break;

                case 'ringtone':
                    if (window.RingtoneSettings) window.RingtoneSettings.initPage(sub);
                    break;

                case 'screen':
                    if (window.ScreenSettings) window.ScreenSettings.initPage(sub);
                    break;

                case 'data':
                    if (window.DataSettings) window.DataSettings.initPage(sub);
                    break;
            }
        },

        /* 选择组绑定（单选互斥） */
        bindSelectGroup: function (sub, attr) {
            var items = sub.querySelectorAll('[' + attr + ']');
            for (var i = 0; i < items.length; i++) {
                (function (item) {
                    item.addEventListener('click', function () {
                        for (var k = 0; k < items.length; k++) items[k].classList.remove('active');
                        item.classList.add('active');
                    });
                })(items[i]);
            }
        },

        /* ========== 设置持久化 ========== */
        saveSetting: function (key, val) {
            try {
                var all = JSON.parse(localStorage.getItem('lingji_settings') || '{}');
                all[key] = val;
                localStorage.setItem('lingji_settings', JSON.stringify(all));
            } catch (e) { /* ignore */ }
        },

        loadSetting: function (key) {
            try {
                var all = JSON.parse(localStorage.getItem('lingji_settings') || '{}');
                return all[key] || null;
            } catch (e) { return null; }
        },

        /* ========== 应用设置 ========== */
        applyIconSettings: function (cfg) {
            var icons = document.querySelectorAll('.icon-img');
            var radius;
            switch (cfg.shape) {
                case 'circle': radius = '50%'; break;
                case 'squircle': radius = '22%'; break;
                default: radius = '14px';
            }
            for (var i = 0; i < icons.length; i++) {
                icons[i].style.borderRadius = radius;
            }

            var root = document.documentElement;
            switch (cfg.size) {
                case 'small': root.style.setProperty('--icon-size', '38px'); break;
                case 'large': root.style.setProperty('--icon-size', '52px'); break;
                default: root.style.setProperty('--icon-size', '46px');
            }
        },

        applyFontSettings: function (cfg) {
            var root = document.documentElement;

            /* 字体 */
            for (var i = 0; i < FONTS.length; i++) {
                if (FONTS[i].id === cfg.family) {
                    root.style.fontFamily = FONTS[i].value;
                    break;
                }
            }

            /* 字号 */
            for (var j = 0; j < FONT_SIZES.length; j++) {
                if (FONT_SIZES[j].id === cfg.size) {
                    root.style.fontSize = (FONT_SIZES[j].scale * 100) + '%';
                    break;
                }
            }
        },

        applyWallpaper: function () {
            var saved = this.loadSetting('wallpaper');
            if (!saved) return;

            if (saved.type === 'color' && saved.color) {
                document.documentElement.style.setProperty('--bg', saved.color);
                var container = document.getElementById('phone-container');
                if (container) container.style.background = saved.color;
            } else if (saved.type === 'custom') {
                /* 从 IndexedDB 读取原图 */
                try {
                    var req = indexedDB.open('lingji_db', 1);
                    req.onupgradeneeded = function (e) {
                        var db = e.target.result;
                        if (!db.objectStoreNames.contains('images')) {
                            db.createObjectStore('images');
                        }
                    };
                    req.onsuccess = function (e) {
                        var db = e.target.result;
                        if (!db.objectStoreNames.contains('images')) return;
                        var tx = db.transaction('images', 'readonly');
                        var get = tx.objectStore('images').get('_wallpaper');
                        get.onsuccess = function () {
                            if (get.result) {
                                var url = URL.createObjectURL(get.result);
                                var container = document.getElementById('phone-container');
                                if (container) {
                                    container.style.backgroundImage = 'url(' + url + ')';
                                    container.style.backgroundSize = 'cover';
                                    container.style.backgroundPosition = 'center';
                                    container.style.backgroundRepeat = 'no-repeat';
                                }
                                document.documentElement.style.setProperty('--has-wallpaper', '1');
                            }
                        };
                    };
                } catch (err) { /* ignore */ }
            }
        },

        /* 启动时应用所有保存的设置 */
        applyAll: function () {
            var icon = this.loadSetting('appicon');
            if (icon) this.applyIconSettings(icon);

            var font = this.loadSetting('font');
            if (font) this.applyFontSettings(font);

            this.applyWallpaper();

            /* 应用自定义图标图片 */
            if (window.AppiconSettings) window.AppiconSettings.applyAllIcons();

            /* 应用字体颜色 */
            if (window.FontSettings) window.FontSettings.applyAll();

            /* 应用屏幕滤镜与状态栏 */
            if (window.ScreenSettings) window.ScreenSettings.applyAll();
        },

        /* ========== 数据管理 ========== */
        calcStorageSize: function (sub) {
            /* localStorage */
            var lsEl = sub.querySelector('#sf-ls-size');
            try {
                var ls = localStorage.getItem('lingji_settings') || '';
                var ls2 = localStorage.getItem('lingji') || '';
                var total = (ls.length + ls2.length) * 2;
                lsEl.textContent = self.formatBytes(total);
            } catch (e) {
                lsEl.textContent = '无法计算';
            }

            /* IndexedDB */
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

        formatBytes: function (bytes) {
            if (bytes === 0) return '0 B';
            var k = 1024;
            var sizes = ['B', 'KB', 'MB', 'GB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        },

        exportSettings: function () {
            try {
                var data = localStorage.getItem('lingji_settings') || '{}';
                var blob = new Blob([data], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'lingji-settings.json';
                a.click();
                URL.revokeObjectURL(url);
                this.toast('设置已导出');
            } catch (e) {
                this.toast('导出失败');
            }
        },

        clearImageCache: function () {
            try {
                var req = indexedDB.open('lingji_db', 1);
                req.onsuccess = function (e) {
                    var db = e.target.result;
                    if (db.objectStoreNames.contains('images')) {
                        var tx = db.transaction('images', 'readwrite');
                        tx.objectStore('images').clear();
                    }
                };
            } catch (e) { /* ignore */ }
        },

        /* 绑定设置图标打开 */
        bindOpen: function () {
            /* 由 app.js 调用 */
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        S.init();
        S.applyAll();
    });
    window.Settings = S;
})();
