/* Offline cache. The cache name follows the build number in js/version.js,
 * so bumping the build replaces the cached app. */
importScripts('js/version.js');

var CACHE = 'robotcalc-' + ROBOTCALC_BUILD;
var FILES = [
  './',
  'index.html',
  'css/style.css',
  'js/version.js',
  'js/triangle-math.js',
  'js/triangle-ui.js',
  'js/app.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-180.png',
  'icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (cache) {
    return cache.addAll(FILES.map(function (f) { return new Request(f, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request);
  }));
});
