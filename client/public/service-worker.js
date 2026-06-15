const CACHE_NAME = 'd-irs-v5';
const API_CACHE = 'd-irs-api-v5';
const APP_SHELL = [
  '/',
  '/dialysis',
  '/manifest.json',
  '/images/ministry-logo.png',
  '/images/pwa-icon-192.png',
  '/images/pwa-icon-512.png',
  '/images/pwa-icon-192-maskable.png',
  '/images/pwa-icon-512-maskable.png',
];

/** face-api weights — copied to public/models/face-api on build */
const FACE_MODEL_ASSETS = [
  '/models/face-api/ssd_mobilenetv1_model-weights_manifest.json',
  '/models/face-api/ssd_mobilenetv1_model.bin',
  '/models/face-api/face_landmark_68_model-weights_manifest.json',
  '/models/face-api/face_landmark_68_model.bin',
  '/models/face-api/face_recognition_model-weights_manifest.json',
  '/models/face-api/face_recognition_model.bin',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL).catch(() => null);
      await Promise.all(
        FACE_MODEL_ASSETS.map((url) =>
          cache.add(url).catch(() => null)
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE).map((k) => caches.delete(k))
        )
      )
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

  // face-api weights: cache-first (offline after first sync)
  if (reqUrl.pathname.startsWith('/api/dialysis/patients') || reqUrl.pathname.startsWith('/api/dialysis/sessions')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(event.request, copy)).catch(() => null);
          }
          return response;
        })
        .catch(() =>
          caches.open(API_CACHE).then((cache) => cache.match(event.request)).then((cached) => {
            if (cached) return cached;
            throw new Error('offline');
          })
        )
    );
    return;
  }

  if (reqUrl.pathname.startsWith('/models/face-api/')) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              const copy = networkRes.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => null);
            }
            return networkRes;
          })
      )
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
