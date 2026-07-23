const CACHE_NAME = 'dagospeak-v11'; // ✅ Incrémenté pour forcer la mise à jour

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

const VOSK_MODEL_URL = '/vosk-model-small-fr-0.22.tar.gz';

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
    }).then(() => {
      self.clients.claim();
      // ✅ Notification de nouvelle version aux onglets ouverts
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "NEW_VERSION" });
        });
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. MODÈLE VOSK : Cache First (pour le hors-ligne)
  if (request.url === VOSK_MODEL_URL) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // 2. SCRIPTS & STYLES : Network First (pour avoir vos mises à jour de code)
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
        .catch(() => caches.match(request))
    );
    return;
  }

  // 3. DONNÉES JSON : Cache First, fallback Network
  if (url.pathname.includes('/content/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response;
        return fetch(request).catch(() => new Response(JSON.stringify({ error: "Hors ligne" }), { status: 503, headers: { 'Content-Type': 'application/json' } }));
      })
    );
    return;
  }

  // 4. TOUT LE RESTE : Cache First, fallback Network
  event.respondWith(
    caches.match(request).then((response) => response || fetch(request).catch(() => new Response("Offline", { status: 503 })))
  );
});