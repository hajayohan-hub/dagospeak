const CACHE_NAME = 'dagospeak-v4'; // ⚠️ INCRÉMENTÉ pour forcer le nettoyage du cache corrompu

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

// 2. ACTIVATION : Nettoyage agressif des anciennes versions (v1, v2, v3...)
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

// 3. FETCH : Stratégies de cache professionnelles et dynamiques
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 🟢 STRATÉGIE A : HTML (Navigation) -> Network First, fallback Cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
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

  // 🔵 STRATÉGIE C : JS, CSS, Images, Fonts -> Stale While Revalidate
  // (Sert le cache instantanément, mais met à jour le cache en arrière-plan)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse); // Fallback si hors-ligne

          // Renvoie le cache s'il existe, sinon attend le réseau
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // ⚪ STRATÉGIE D : Tout le reste -> Cache First, fallback Network
  event.respondWith(
    caches.match(request).then((response) => response || fetch(request))
  );
});