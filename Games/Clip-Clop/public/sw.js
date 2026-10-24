/* Offline cache for the Clip-Clop homage game.
   Strategy:
   - Content-hashed build assets (…-Ab12Cd34.js) are immutable -> cache-first.
   - Everything else (HTML, manifest, icon) is network-first with a cache
     fallback, so a redeploy is picked up immediately instead of serving a
     stale index.html that references assets which no longer exist.
   The cache name changes with deploys; old caches are purged on activate. */
const CACHE = 'clip-clop-v2';
const CORE = ['./', './index.html', './icon.svg', './clip-clop.webmanifest'];
const HASHED = /-[A-Za-z0-9_-]{8}\.(?:js|mjs|css|woff2?|png|jpg|webp|svg)$/;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;   // never touch cross-origin

  if (HASHED.test(url.pathname)) {
    // immutable build asset: cache-first
    e.respondWith(
      caches.match(e.request).then(hit =>
        hit || fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
      )
    );
    return;
  }

  // documents & misc: network-first, fall back to cache when offline
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() =>
      caches.match(e.request).then(hit => hit || caches.match('./index.html'))
    )
  );
});
