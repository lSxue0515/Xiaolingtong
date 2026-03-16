(function () {
    'use strict';

    var ICONS_CHECK = '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

    var FILTERS = [
        { id: 'none', name: '无滤镜', css: 'none' },
        { id: 'cream', name: '奶油风', css: 'saturate(0.85) brightness(1.06) contrast(0.92) sepia(0.08)' },
        { id: 'night', name: '夜间风', css: 'brightness(0.7) saturate(0.6) sepia(0.15) hue-rotate(10deg)' },
        { id: 'ins', name: 'INS 风', css: 'contrast(1.05) saturate(1.15) brightness(1.03) sepia(0.04)' },
        { id: 'real', name: '真实风', css: 'contrast(1.08) saturate(1.02) brightness(1.0)' },
        { id: 'food', name: '美食风', css: 'saturate(1.3) brightness(1.05) contrast(1.02) sepia(0.06) hue-rotate(-5deg)' },
        { id: 'dopamine', name: '多巴胺风', css: 'saturate(1.5) brightness(1.08) contrast(1.05)' },
        { id: 'winter', name: '寒冬风', css: 'saturate(0.6) brightness(1.02) contrast(1.0) hue-rotate(15deg) sepia(0.05)' },
        { id: 'vintage', name: '复古风', css: 'sepia(0.25) saturate(0.85) contrast(1.05) brightness(0.95)' },
        { id: 'bw', name: '黑白风', css: 'grayscale(1) contrast(1.1) brightness(1.02)' }
    ];

    var ScreenSettings = {

        buildPage: function () {
            var S = window.Settings;
            var saved = S.loadSetting('screen') || {};

            var html = S.subHeader('屏幕调整') + '<div class="settings-body">';

            /* 屏幕滤镜 */
            html += '<div class="sf-label">屏幕滤镜</div>';
            html += '<div class="sf-hint">为主屏幕应用视觉滤镜风格</div>';
            html += '<div class="sf-filter-grid" id="sf-filter-grid">';
            for (var i = 0; i < FILTERS.length; i++) {
                var f = FILTERS[i];
                var isActive = (saved.filter === f.id) || (!saved.filter && i === 0);
                html += '<div class="sf-filter-item' + (isActive ? ' active' : '') + '" data-filter="' + f.id + '">' +
                    '<div class="sf-filter-preview" style="filter:' + f.css + '">' +
                    '<div class="sf-filter-demo"></div>' +
                    '</div>' +
                    '<span class="sf-filter-name">' + f.name + '</span>' +
                    '</div>';
            }
            html += '</div>';

            /* 隐藏状态栏 */
            html += '<div class="sf-label">状态栏</div>';
            var hideChecked = saved.hideStatusBar ? ' checked' : '';
            html += '<div class="sf-toggle-row">' +
                '<span class="sf-toggle-text">隐藏顶部状态栏</span>' +
                '<label class="sf-toggle">' +
                '<input type="checkbox" id="sf-hide-statusbar"' + hideChecked + '>' +
                '<span class="sf-toggle-slider"></span>' +
                '</label></div>';

            html += '<button class="sf-save-btn" id="sf-screen-save">保存设置</button>';
            html += '<button class="sf-danger-btn" id="sf-screen-reset">清除所有屏幕设置</button>';

            html += '</div>';
            return html;
        },

        initPage: function (sub) {
            var S = window.Settings;
            var self = this;

            /* 滤镜选择 */
            var filterItems = sub.querySelectorAll('[data-filter]');
            for (var i = 0; i < filterItems.length; i++) {
                (function (item) {
                    item.addEventListener('click', function () {
                        for (var k = 0; k < filterItems.length; k++) filterItems[k].classList.remove('active');
                        item.classList.add('active');
                    });
                })(filterItems[i]);
            }

            /* 保存 */
            sub.querySelector('#sf-screen-save').addEventListener('click', function () {
                var activeFilter = sub.querySelector('[data-filter].active');
                var hideStatusBar = sub.querySelector('#sf-hide-statusbar').checked;

                var cfg = {
                    filter: activeFilter ? activeFilter.getAttribute('data-filter') : 'none',
                    hideStatusBar: hideStatusBar
                };

                S.saveSetting('screen', cfg);
                self.applyFilter(cfg.filter);
                self.applyStatusBar(cfg.hideStatusBar);
                S.toast('屏幕设置已保存');
            });

            /* 清除 */
            sub.querySelector('#sf-screen-reset').addEventListener('click', function () {
                if (!confirm('确定清除所有屏幕设置？')) return;
                S.saveSetting('screen', {});
                self.applyFilter('none');
                self.applyStatusBar(false);
                S.toast('屏幕设置已清除');
            });
        },

        applyFilter: function (filterId) {
            var css = 'none';
            for (var i = 0; i < FILTERS.length; i++) {
                if (FILTERS[i].id === filterId) { css = FILTERS[i].css; break; }
            }
            var homeScreen = document.getElementById('home-screen');
            if (homeScreen) {
                homeScreen.style.filter = css;
                homeScreen.style.webkitFilter = css;
            }
        },

        applyStatusBar: function (hide) {
            var sb = document.getElementById('status-bar');
            if (sb) {
                sb.style.display = hide ? 'none' : '';
            }
        },

        /* 启动时应用 */
        applyAll: function () {
            var S = window.Settings;
            var cfg = S.loadSetting('screen') || {};
            if (cfg.filter) this.applyFilter(cfg.filter);
            if (cfg.hideStatusBar) this.applyStatusBar(true);
        }
    };

    window.ScreenSettings = ScreenSettings;
})();
