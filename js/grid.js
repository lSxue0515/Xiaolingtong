(function () {
    'use strict';

    var Grid = {
        cols: 4,
        cellSize: 56,
        gap: 10,

        init: function () {
            this.calc();
            window.addEventListener('resize', this.calc.bind(this));
        },

        calc: function () {
            var container = document.getElementById('phone-container');
            if (!container) return;
            var w = container.offsetWidth;
            var padding = 14 * 2;
            var contentW = w - padding;
            this.cols = w >= 768 ? 5 : 4;
            var iconSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--icon-size')) || 56;
            var maxCell = (contentW - (this.cols - 1) * this.gap) / this.cols;
            this.cellSize = Math.min(iconSize, maxCell);
        },

        widgetPx: function (gw, gh) {
            return {
                w: this.cellSize * gw + this.gap * (gw - 1),
                h: this.cellSize * gh + this.gap * (gh - 1)
            };
        }
    };

    document.addEventListener('DOMContentLoaded', function () { Grid.init(); });
    window.Grid = Grid;
})();
