const CACHE_NAME = 'dagospeak-v13'; // ✅ Incrémentation pour forcer la mise à jour

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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Mise en cache des fichiers essentiels...');
      for (const url of urlsToCache) {
        try { await cache.add(url); }
        catch (err) { console.warn('[SW] ⚠️ Échec du cache:', url); }
      }
    })
  );
  self.skipWaiting();
});

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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 🛡️ STRATÉGIE UNIVERSELLE 100% ROBUSTE : Cache First -> Network -> Fallback Response
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // 1. Si c'est dans le cache, on le sert immédiatement (Mode hors-ligne garanti)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. Sinon, on essaie le réseau
      return fetch(request).then((networkResponse) => {
        // Si la réponse est valide, on la met en cache pour la prochaine fois
        if (networkResponse && networkResponse.ok && request.method === 'GET') {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // 3. ⚠️ CRUCIAL : En mode hors-ligne, si ni le cache ni le réseau ne fonctionnent,
        // on DOIT retourner une Response valide pour éviter le crash "Failed to convert value to 'Response'"

        if (request.mode === 'navigate') {
          return caches.match('/index.html') || new Response('Page non disponible hors-ligne', { status: 503 });
        }

        // Fallback générique silencieux pour les scripts, styles, images, etc.
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