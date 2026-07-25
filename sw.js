const CACHE_NAME = 'dagospeak-v15'; // ✅ Incrémentation forcée

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/dagospeak-logo.svg',
  '/assets/hero-bg.png',
  '/src/app.js',
  '/src/ui/styles/tokens.css',
  '/src/ui/styles/base.css',
  '/content/fr/manifest.json',
  '/content/fr/vocabulary/survival.json',
  '/content/fr/vocabulary/numbers.json',
  '/content/fr/vocabulary/family.json',
  '/content/fr/vocabulary/market.json',
  '/content/fr/vocabulary/colors.json',
  '/content/fr/dialogues/survival_dialogue.json',
  '/content/fr/dialogues/numbers_dialogue.json',
  '/content/fr/dialogues/family_dialogue.json',
  '/content/fr/dialogues/market_dialogue.json',
  '/content/fr/dialogues/colors_dialogue.json'
];

console.log('[SW] 🚀 Service Worker v15 chargé');

self.addEventListener('install', (event) => {
  console.log('[SW] 📥 Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] ⚠️ Échec cache:', url);
        }
      }
    })
  );
  self.skipWaiting(); // ✅ Force l'activation immédiate
});

self.addEventListener('activate', (event) => {
  console.log('[SW] ⚡ Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 🗑️ Suppression:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // ✅ Prend le contrôle immédiat
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok && request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/index.html') || new Response('Offline', { status: 503 });
        }
        const contentType = request.destination === 'script' ? 'application/javascript' :
                            request.destination === 'style' ? 'text/css' :
                            request.destination === 'image' ? 'image/svg+xml' : 'text/plain';
        return new Response('', { status: 503, headers: { 'Content-Type': contentType } });
      });
    })
  );
});

// ✅ NOTIFICATION DE MISE À JOUR AUX CLIENTS
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});