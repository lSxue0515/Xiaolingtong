(function () {
    'use strict';

    var SB = {
        init: function () {
            this.tick();
            setInterval(this.tick.bind(this), 30000);
            this.battery();
            this.theme();
        },

        tick: function () {
            var d = new Date();
            var h = String(d.getHours()).padStart(2, '0');
            var m = String(d.getMinutes()).padStart(2, '0');
            var el = document.getElementById('status-time');
            if (el) el.textContent = h + ':' + m;
        },

        battery: function () {
            if (!navigator.getBattery) return;
            navigator.getBattery().then(function (b) {
                var el = document.getElementById('battery-percent');
                var set = function () {
                    if (el) el.textContent = Math.round(b.level * 100) + '%';
                };
                set();
                b.addEventListener('levelchange', set);
            });
        },

        theme: function () {
            var bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
            var rgb = this.hex(bg);
            if (!rgb) return;
            var lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
            var bar = document.getElementById('status-bar');
            if (bar) bar.style.color = lum > 0.5 ? '#1a1a1a' : '#fff';
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute('content', bg);
        },

        hex: function (c) {
            if (c[0] !== '#') return null;
            var h = c.slice(1);
            if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
            return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
        }
    };

    document.addEventListener('DOMContentLoaded', function () { SB.init(); });
    window.StatusBar = SB;
})();
