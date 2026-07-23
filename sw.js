const CACHE_NAME = 'dagospeak-v9';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
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

// ✅ URL du modèle Vosk (sera mis en cache après le premier téléchargement)
const VOSK_MODEL_URL = 'https://cdn.jsdelivr.net/gh/alphacep/vosk-models@master/vosk-model-small-fr-0.22.zip';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Mise en cache des fichiers essentiels...');
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] ⚠️ Échec du cache:', url);
        }
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
  const url = new URL(request.url);

  // ✅ STRATÉGIE SPÉCIALE POUR LE MODÈLE VOSK : Cache First avec fallback Network
  if (request.url === VOSK_MODEL_URL) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] ✅ Modèle Vosk servi depuis le cache');
          return cachedResponse;
        }
        console.log('[SW] 📥 Téléchargement du modèle Vosk...');
        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
              console.log('[SW] ✅ Modèle Vosk mis en cache pour le mode hors-ligne');
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Autres stratégies existantes...
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  if (url.pathname.includes('/content/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response;
        return fetch(request).catch(() => new Response(JSON.stringify({ error: "Hors ligne" }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
      })
    );
    return;
  }

  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response;
        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => new Response("/* Offline */", { status: 503, headers: { 'Content-Type': request.destination === 'script' ? 'application/javascript' : 'text/css' } }));
      })
    );
    return;
  }

  event.respondWith(caches.match(request).then((response) => response || fetch(request).catch(() => new Response("Offline", { status: 503 }))));
});