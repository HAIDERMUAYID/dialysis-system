/**
 * Service Worker for PWA
 * يدعم التخزين المؤقت والوضع غير المتصل
 */

const CACHE_NAME = 'al-hakeem-hospital-v2';
const urlsToCache = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js',
  '/images/ministry-logo.png',
  '/manifest.json',
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Cache install failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event — للمسارات (SPA): الشبكة أولاً ثم الصفحة الرئيسية من الكاش؛ للثابتات: كاش ثم شبكة
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) return response;
          return caches.match('/');
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }).catch(() => {
      if (event.request.destination === 'document') {
        return caches.match('/');
      }
    })
  );
});
