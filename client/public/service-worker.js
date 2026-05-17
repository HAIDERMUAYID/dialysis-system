const CACHE_NAME = 'd-irs-v3';
const APP_SHELL = ['/', '/dialysis', '/manifest.json', '/images/ministry-logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const reqUrl = new URL(event.request.url);

  // Never intercept webpack dev server / HMR assets
  if (
    reqUrl.pathname.includes('hot-update') ||
    reqUrl.pathname.startsWith('/sockjs-node') ||
    reqUrl.pathname.endsWith('.hot-update.js') ||
    reqUrl.pathname.endsWith('.hot-update.json')
  ) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/dialysis', copy)).catch(() => null);
          return response;
        })
        .catch(() => caches.match('/dialysis').then((res) => res || caches.match('/')))
    );
    return;
  }

  if (reqUrl.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((networkRes) => {
          if (!networkRes || networkRes.status !== 200) return networkRes;
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => null);
          return networkRes;
        })
        .catch(() => caches.match('/'));
    })
  );
});
