// ✅ INCRÉMENTATION DU CACHE : Force le nettoyage de l'ancien cache corrompu (v4)
const CACHE_NAME = 'dagospeak-v5';

// 1. INSTALLATION : On ne pré-cache que l'essentiel absolu (le shell de l'app)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.webmanifest'
      ]);
    })
  );
  self.skipWaiting(); // Force l'activation immédiate du nouveau SW
});

// 2. ACTIVATION : Nettoyage agressif des anciennes versions (v1, v2, v3, v4...)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 🗑️ Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Prend le contrôle immédiat
  );
});

// 3. FETCH : Stratégies de cache professionnelles
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 🟢 STRATÉGIE A : HTML (Navigation) -> Network First, fallback Cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 🟡 STRATÉGIE B : JSON (Données) -> Network First, fallback Cache
  if (url.pathname.includes('/content/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 🔵 STRATÉGIE C : JS et CSS -> Network First (CRUCIAL pour le développement)
  // Cela garantit que vous voyez vos corrections de code immédiatement.
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)) // Fallback hors-ligne
    );
    return;
  }

  // 🟣 STRATÉGIE D : Images et Fonts -> Cache First (pour la rapidité)
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // ⚪ STRATÉGIE E : Tout le reste -> Cache First, fallback Network
  event.respondWith(
    caches.match(request).then((response) => response || fetch(request))
  );
});