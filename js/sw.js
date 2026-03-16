const CACHE = 'lingji-v1';
const ASSETS = [
    './', './index.html',
    './css/style.css', './css/widgets.css', './css/apps.css', './css/statusbar.css',
    './js/app.js', './js/grid.js', './js/widgets.js', './js/statusbar.js'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', e => {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
