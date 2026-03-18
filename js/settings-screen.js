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

            /* ── 屏幕位置偏移 ── */
            html += '<div class="sf-label">屏幕位置适配</div>';
            html += '<div class="sf-hint">iOS 添加到主屏幕后，如果内容被顶得太高，可在此向下调整屏幕起始位置</div>';

            var offsetVal = (saved.offsetTop !== undefined) ? saved.offsetTop : 0;

            html += '<div class="sf-offset-wrap">' +
                /* 减少按钮 */
                '<button class="sf-offset-btn" id="sf-offset-minus">' +
                '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
                '</button>' +
                /* 数值显示 */
                '<div class="sf-offset-display">' +
                '<span id="sf-offset-val">' + offsetVal + '</span>' +
                '<span class="sf-offset-unit">px</span>' +
                '</div>' +
                /* 增加按钮 */
                '<button class="sf-offset-btn" id="sf-offset-plus">' +
                '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
                '</button>' +
                '</div>';

            /* 快捷预设 */
            html += '<div class="sf-offset-presets">' +
                '<button class="sf-preset-btn" data-offset="0">重置 0</button>' +
                '<button class="sf-preset-btn" data-offset="20">+20</button>' +
                '<button class="sf-preset-btn" data-offset="44">+44</button>' +
                '<button class="sf-preset-btn" data-offset="54">+54</button>' +
                '<button class="sf-preset-btn" data-offset="59">+59</button>' +
                '</div>';

            html += '<div class="sf-hint" style="margin-top:4px">💡 灵动岛机型推荐 +54，刘海机型推荐 +44，无刘海推荐 0</div>';

            /* ── 屏幕滤镜 ── */
            html += '<div class="sf-label" style="margin-top:20px">屏幕滤镜</div>';
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

            /* ── 隐藏状态栏 ── */
            html += '<div class="sf-label" style="margin-top:20px">状态栏</div>';
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
            var saved = S.loadSetting('screen') || {};

            /* ── 偏移步进控制 ── */
            var STEP = 1;
            var MAX = 120;
            var MIN = -30;
            var currentOffset = (saved.offsetTop !== undefined) ? saved.offsetTop : 0;
            var valEl = sub.querySelector('#sf-offset-val');

            function updateOffsetDisplay() {
                valEl.textContent = currentOffset;
                /* 实时预览 */
                self.applyOffset(currentOffset);
            }

            sub.querySelector('#sf-offset-minus').addEventListener('click', function () {
                currentOffset = Math.max(MIN, currentOffset - STEP);
                updateOffsetDisplay();
            });

            sub.querySelector('#sf-offset-plus').addEventListener('click', function () {
                currentOffset = Math.min(MAX, currentOffset + STEP);
                updateOffsetDisplay();
            });

            /* 长按快速调节 */
            function bindLongPress(btn, fn) {
                var timer = null;
                var interval = null;
                btn.addEventListener('mousedown', startHold);
                btn.addEventListener('touchstart', startHold, { passive: true });
                function startHold() {
                    timer = setTimeout(function () {
                        interval = setInterval(function () { fn(); }, 80);
                    }, 400);
                }
                function stopHold() {
                    clearTimeout(timer);
                    clearInterval(interval);
                }
                btn.addEventListener('mouseup', stopHold);
                btn.addEventListener('mouseleave', stopHold);
                btn.addEventListener('touchend', stopHold);
                btn.addEventListener('touchcancel', stopHold);
            }

            bindLongPress(sub.querySelector('#sf-offset-minus'), function () {
                currentOffset = Math.max(MIN, currentOffset - STEP);
                updateOffsetDisplay();
            });
            bindLongPress(sub.querySelector('#sf-offset-plus'), function () {
                currentOffset = Math.min(MAX, currentOffset + STEP);
                updateOffsetDisplay();
            });

            /* 快捷预设 */
            var presetBtns = sub.querySelectorAll('.sf-preset-btn');
            for (var pi = 0; pi < presetBtns.length; pi++) {
                (function (btn) {
                    btn.addEventListener('click', function () {
                        currentOffset = parseInt(btn.getAttribute('data-offset'), 10);
                        updateOffsetDisplay();
                    });
                })(presetBtns[pi]);
            }

            /* ── 滤镜选择 ── */
            var filterItems = sub.querySelectorAll('[data-filter]');
            for (var i = 0; i < filterItems.length; i++) {
                (function (item) {
                    item.addEventListener('click', function () {
                        for (var k = 0; k < filterItems.length; k++) filterItems[k].classList.remove('active');
                        item.classList.add('active');
                    });
                })(filterItems[i]);
            }

            /* ── 保存 ── */
            sub.querySelector('#sf-screen-save').addEventListener('click', function () {
                var activeFilter = sub.querySelector('[data-filter].active');
                var hideStatusBar = sub.querySelector('#sf-hide-statusbar').checked;

                var cfg = {
                    filter: activeFilter ? activeFilter.getAttribute('data-filter') : 'none',
                    hideStatusBar: hideStatusBar,
                    offsetTop: currentOffset
                };

                S.saveSetting('screen', cfg);
                self.applyFilter(cfg.filter);
                self.applyStatusBar(cfg.hideStatusBar);
                self.applyOffset(cfg.offsetTop);
                S.toast('屏幕设置已保存 ✓');
            });

            /* ── 清除 ── */
            sub.querySelector('#sf-screen-reset').addEventListener('click', function () {
                if (!confirm('确定清除所有屏幕设置？')) return;
                currentOffset = 0;
                updateOffsetDisplay();
                S.saveSetting('screen', {});
                self.applyFilter('none');
                self.applyStatusBar(false);
                self.applyOffset(0);
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

        /* ── 应用屏幕垂直偏移（用 translateY 平移整个手机壳） ── */
        applyOffset: function (px) {
            var val = parseInt(px, 10) || 0;

            /* 优先移动 phone-shell，其次 phone-container */
            var target = document.getElementById('phone-shell') ||
                document.getElementById('phone-container');
            if (!target) return;

            if (val === 0) {
                target.style.transform = '';
                target.style.webkitTransform = '';
            } else {
                target.style.transform = 'translateY(' + val + 'px)';
                target.style.webkitTransform = 'translateY(' + val + 'px)';
            }
        },

        /* 启动时应用 */
        applyAll: function () {
            var S = window.Settings;
            var cfg = S.loadSetting('screen') || {};
            if (cfg.filter) this.applyFilter(cfg.filter);
            if (cfg.hideStatusBar) this.applyStatusBar(true);
            if (cfg.offsetTop) this.applyOffset(cfg.offsetTop);  /* ← 新增 */
        }
    };

    window.ScreenSettings = ScreenSettings;
})();
