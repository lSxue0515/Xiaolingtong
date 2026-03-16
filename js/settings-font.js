(function () {
    'use strict';

    var ICONS_CHECK = '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';

    var FONTS = [
        { id: 'system', name: '系统默认', value: "-apple-system,BlinkMacSystemFont,'SF Pro Display','Helvetica Neue','PingFang SC',sans-serif" },
        { id: 'serif', name: '衬线体', value: "Georgia,'Noto Serif SC','Source Han Serif SC',serif" },
        { id: 'rounded', name: '圆体', value: "'SF Pro Rounded','PingFang SC','Nunito',sans-serif" },
        { id: 'mono', name: '等宽体', value: "'SF Mono','Menlo','Courier New',monospace" }
    ];

    var FONT_SIZES = [
        { id: 'small', name: '小', scale: 0.9 },
        { id: 'medium', name: '标准', scale: 1.0 },
        { id: 'large', name: '大', scale: 1.1 },
        { id: 'xlarge', name: '特大', scale: 1.2 }
    ];

    var LABEL_COLORS = [
        { id: 'default', name: '默认（深灰）', color: '' },
        { id: 'white', name: '纯白', color: '#ffffff' },
        { id: 'black', name: '纯黑', color: '#000000' },
        { id: 'cream', name: '奶油白', color: '#f5f0e8' },
        { id: 'pink', name: '樱花粉', color: '#e8a0b4' },
        { id: 'blue', name: '天空蓝', color: '#7eb8d8' },
        { id: 'mint', name: '薄荷绿', color: '#88c8a8' },
        { id: 'lavender', name: '薰衣草紫', color: '#b0a0d0' },
        { id: 'gold', name: '琥珀金', color: '#d4a848' },
        { id: 'coral', name: '珊瑚橘', color: '#e08860' }
    ];

    var FontSettings = {

        buildPage: function () {
            var S = window.Settings;
            var saved = S.loadSetting('font') || {};

            var html = S.subHeader('字体设置') + '<div class="settings-body">';

            /* 自定义字体 URL */
            html += '<div class="sf-label">自定义字体（TTF 格式 URL）</div>';
            html += '<div class="sf-input-wrap">' +
                '<input class="sf-input" id="sf-font-url" type="url" placeholder="https://example.com/font.ttf" value="' + S.escapeHtml(saved.customUrl || '') + '">' +
                '</div>';
            html += '<div class="sf-hint">输入 .ttf 字体文件的直链地址，留空则使用下方预设字体</div>';

            /* 预设字体风格 */
            html += '<div class="sf-label">预设字体风格</div><div class="sf-select-group">';
            for (var i = 0; i < FONTS.length; i++) {
                var act = (saved.family === FONTS[i].id) ? ' active' : ((!saved.family && !saved.customUrl && i === 0) ? ' active' : '');
                html += '<div class="sf-select-item' + act + '" data-font-family="' + FONTS[i].id + '">' +
                    '<span class="sf-name" style="font-family:' + FONTS[i].value + '">' + FONTS[i].name + '</span>' +
                    '<svg class="sf-check" viewBox="0 0 24 24">' + ICONS_CHECK + '</svg></div>';
            }
            html += '</div>';

            /* 字号 */
            html += '<div class="sf-label">字号</div><div class="sf-select-group">';
            for (var j = 0; j < FONT_SIZES.length; j++) {
                var act2 = (saved.size === FONT_SIZES[j].id) ? ' active' : ((!saved.size && j === 1) ? ' active' : '');
                html += '<div class="sf-select-item' + act2 + '" data-font-size="' + FONT_SIZES[j].id + '">' +
                    '<span class="sf-name">' + FONT_SIZES[j].name + '</span>' +
                    '<svg class="sf-check" viewBox="0 0 24 24">' + ICONS_CHECK + '</svg></div>';
            }
            html += '</div>';

            /* 字体预览 */
            html += '<div class="sf-label">字体预览</div>';
            html += '<div class="sf-font-preview" id="sf-font-preview">' +
                '<div class="sf-font-preview-text" id="sf-font-preview-text">灵机一动 ABC abc 123 你好世界</div>' +
                '</div>';

            /* 图标标签颜色 */
            html += '<div class="sf-label">应用图标标签颜色</div>';
            html += '<div class="sf-hint">仅更换应用图标下方文字的颜色，不影响其他区域</div>';
            html += '<div class="sf-color-grid" id="sf-color-grid">';
            for (var k = 0; k < LABEL_COLORS.length; k++) {
                var lc = LABEL_COLORS[k];
                var isActive = (saved.labelColor === lc.id) || (!saved.labelColor && k === 0);
                html += '<div class="sf-color-item' + (isActive ? ' active' : '') + '" data-label-color="' + lc.id + '" title="' + lc.name + '">' +
                    '<div class="sf-color-swatch" style="background:' + (lc.color || '#666') + ';' + (lc.id === 'default' ? 'border:1px dashed #aaa;' : '') + '"></div>' +
                    '<span class="sf-color-name">' + lc.name + '</span>' +
                    '</div>';
            }
            html += '</div>';

            html += '<button class="sf-save-btn" id="sf-font-save">保存字体设置</button></div>';
            return html;
        },

        initPage: function (sub) {
            var S = window.Settings;
            var self = this;

            S.bindSelectGroup(sub, 'data-font-family');
            S.bindSelectGroup(sub, 'data-font-size');

            /* 颜色选择 */
            var colorItems = sub.querySelectorAll('[data-label-color]');
            for (var i = 0; i < colorItems.length; i++) {
                (function (item) {
                    item.addEventListener('click', function () {
                        for (var k = 0; k < colorItems.length; k++) colorItems[k].classList.remove('active');
                        item.classList.add('active');
                    });
                })(colorItems[i]);
            }

            /* URL 变化时更新预览 */
            var urlInput = sub.querySelector('#sf-font-url');
            var previewText = sub.querySelector('#sf-font-preview-text');
            if (urlInput) {
                urlInput.addEventListener('input', function () {
                    self.updatePreview(sub);
                });
            }

            /* 预设字体点击时更新预览 */
            var fontItems = sub.querySelectorAll('[data-font-family]');
            for (var j = 0; j < fontItems.length; j++) {
                fontItems[j].addEventListener('click', function () {
                    self.updatePreview(sub);
                });
            }

            /* 初始预览 */
            self.updatePreview(sub);

            /* 保存 */
            sub.querySelector('#sf-font-save').addEventListener('click', function () {
                var fam = sub.querySelector('[data-font-family].active');
                var sz = sub.querySelector('[data-font-size].active');
                var lc = sub.querySelector('[data-label-color].active');
                var customUrl = (urlInput ? urlInput.value.trim() : '');

                var cfg = {
                    family: fam ? fam.getAttribute('data-font-family') : 'system',
                    size: sz ? sz.getAttribute('data-font-size') : 'medium',
                    labelColor: lc ? lc.getAttribute('data-label-color') : 'default',
                    customUrl: customUrl
                };

                S.saveSetting('font', cfg);
                S.applyFontSettings(cfg);
                self.applyLabelColor(cfg.labelColor);

                if (customUrl) {
                    self.loadCustomFont(customUrl);
                }

                S.toast('字体设置已保存');
            });
        },

        updatePreview: function (sub) {
            var previewText = sub.querySelector('#sf-font-preview-text');
            if (!previewText) return;

            var urlInput = sub.querySelector('#sf-font-url');
            var customUrl = urlInput ? urlInput.value.trim() : '';

            if (customUrl && customUrl.match(/\.ttf(\?|$)/i)) {
                var fontName = 'preview-font-' + Date.now();
                var style = document.createElement('style');
                style.textContent = '@font-face{font-family:"' + fontName + '";src:url("' + customUrl + '") format("truetype");font-display:swap;}';
                document.head.appendChild(style);
                previewText.style.fontFamily = '"' + fontName + '", sans-serif';
            } else {
                var active = sub.querySelector('[data-font-family].active');
                if (active) {
                    var famId = active.getAttribute('data-font-family');
                    for (var i = 0; i < FONTS.length; i++) {
                        if (FONTS[i].id === famId) {
                            previewText.style.fontFamily = FONTS[i].value;
                            break;
                        }
                    }
                }
            }
        },

        loadCustomFont: function (url) {
            if (!url) return;
            var existing = document.getElementById('custom-font-style');
            if (existing) existing.remove();

            var style = document.createElement('style');
            style.id = 'custom-font-style';
            style.textContent = '@font-face{font-family:"CustomUserFont";src:url("' + url + '") format("truetype");font-display:swap;}';
            document.head.appendChild(style);
            document.documentElement.style.fontFamily = '"CustomUserFont", sans-serif';
        },

        applyLabelColor: function (colorId) {
            var color = '';
            for (var i = 0; i < LABEL_COLORS.length; i++) {
                if (LABEL_COLORS[i].id === colorId) {
                    color = LABEL_COLORS[i].color;
                    break;
                }
            }

            /* 仅修改 .icon-label 的颜色，不碰任何其他元素 */
            var labels = document.querySelectorAll('.icon-label');
            for (var j = 0; j < labels.length; j++) {
                if (color) {
                    labels[j].style.color = color;
                } else {
                    labels[j].style.color = '';
                }
            }
        },

        /* 启动时应用 */
        applyAll: function () {
            var S = window.Settings;
            var cfg = S.loadSetting('font') || {};

            if (cfg.labelColor) {
                this.applyLabelColor(cfg.labelColor);
            }
            if (cfg.customUrl) {
                this.loadCustomFont(cfg.customUrl);
            }
        }
    };

    window.FontSettings = FontSettings;
})();
