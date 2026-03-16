(function () {
    'use strict';

    var App = {
        init: function () {
            this.sw();
            this.clicks();
            this.touch();
            this.layout();
            window.addEventListener('resize', this.layout.bind(this));
        },

        sw: function () {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('./sw.js').catch(function () { });
            }
        },

        clicks: function () {
            var icons = document.querySelectorAll('.app-icon[data-app]');
            var names = {
                settings: '设置',
                theater: '线下剧场',
                music: '音乐',
                mood: '心绪回响',
                chat: 'Chat',
                novel: '柿子小说',
                worldbook: '世界书'
            };
            for (var i = 0; i < icons.length; i++) {
                (function (icon) {
                    icon.addEventListener('click', function () {
                        var app = icon.getAttribute('data-app');

                        if (app === 'settings' && window.Settings) {
                            window.Settings.open();
                            return;
                        }
                        if (app === 'chat' && window.ChatApp) {
                            window.ChatApp.open();
                            return;
                        }

                        console.log('打开: ' + (names[app] || app));
                    });
                })(icons[i]);
            }
        },

        touch: function () {
            var last = 0;
            document.addEventListener('touchend', function (e) {
                var now = Date.now();
                if (now - last <= 300) e.preventDefault();
                last = now;
            }, { passive: false });

            document.addEventListener('contextmenu', function (e) {
                if (e.target.tagName === 'IMG') e.preventDefault();
            });
        },

        layout: function () {
            var container = document.getElementById('phone-container');
            var top = document.getElementById('top-widget');
            var dock = document.getElementById('dock');
            if (!container || !top || !dock) return;

            requestAnimationFrame(function () {
                var ch = container.offsetHeight;
                var dh = dock.offsetHeight;
                var safeTop = 52;
                if (window.innerWidth <= 500) {
                    safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 44;
                }
                var gap = 8;
                var pad = 6;
                var avail = ch - safeTop - pad - dh - pad;

                /* 顶部组件：可用高度的 30%，最高 155px */
                var topH = Math.min(Math.round(avail * 0.30), 155);
                top.style.height = topH + 'px';
            });
        }
    };

    document.addEventListener('DOMContentLoaded', function () { App.init(); });
    window.App = App;
})();
