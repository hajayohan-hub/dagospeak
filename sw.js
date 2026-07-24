const CACHE_NAME = 'dagospeak-v14'; // ✅ Incrémentation forcée

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

console.log('[SW] 🚀 Fichier sw.js chargé. Version:', CACHE_NAME);

self.addEventListener('install', (event) => {
  console.log('[SW] 📥 Événement "install" déclenché.');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] 📂 Cache ouvert:', CACHE_NAME);
      for (const url of urlsToCache) {
        try {
          console.log('[SW] 🔄 Tentative de cache:', url);
          await cache.add(url);
          console.log('[SW] ✅ Mis en cache avec succès:', url);
        } catch (err) {
          console.warn('[SW] ⚠️ ÉCHEC du cache pour:', url, '->', err.message);
        }
      }
      console.log('[SW] 🏁 Fin de la boucle de mise en cache.');
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] ⚡ Événement "activate" déclenché.');
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
    }).then(() => {
      console.log('[SW] 🎯 Activation terminée, prise de contrôle des pages.');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // Servi depuis le cache
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok && request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback hors-ligne robuste
        if (request.mode === 'navigate') {
          return caches.match('/index.html') || new Response('Page hors-ligne', { status: 503 });
        }
        const contentType = request.destination === 'script' ? 'application/javascript' :
                            request.destination === 'style' ? 'text/css' :
                            request.destination === 'image' ? 'image/svg+xml' : 'text/plain';
        return new Response(`/* Offline fallback */`, {
          status: 503,
          headers: { 'Content-Type': contentType }
        });
      });
    })
  );
});