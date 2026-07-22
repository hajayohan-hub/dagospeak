const CACHE_NAME = 'dagospeak-v7'; // ✅ Incrémentation pour forcer un nettoyage total

// Liste des fichiers ESSENTIELS pour que l'application fonctionne hors-ligne
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/src/app.js', // ✅ CRUCIAL : Doit être pré-caché !
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

// 1. INSTALLATION : Pré-cache agressif
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

// 2. ACTIVATION : Nettoyage des anciens caches (v1 à v6)
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

// 3. FETCH : Stratégies de cache robustes avec filets de sécurité
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 🟢 STRATÉGIE A : HTML -> Network First, fallback Cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 🟡 STRATÉGIE B : JSON (Données) -> Cache First, fallback Network
  if (url.pathname.includes('/content/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response; // Servi instantanément depuis le cache
        return fetch(request).catch(() => {
          // ✅ FILET DE SÉCURITÉ : Renvoie une réponse valide au lieu de undefined
          return new Response(JSON.stringify({ error: "Hors ligne" }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        });
      })
    );
    return;
  }

  // 🔵 STRATÉGIE C : JS et CSS -> CACHE FIRST (Indispensable pour le hors-ligne)
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response; // ✅ Trouvé dans le cache, on le sert (fonctionne hors-ligne)

        // Sinon, on essaie le réseau et on met en cache pour la prochaine fois
        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => {
          // ✅ FILET DE SÉCURITÉ ULTIME : Empêche l'erreur "Failed to convert value to 'Response'"
          if (request.destination === 'script') {
            return new Response("/* Offline fallback */", { status: 503, headers: { 'Content-Type': 'application/javascript' } });
          }
          return new Response("/* Offline fallback */", { status: 503, headers: { 'Content-Type': 'text/css' } });
        });
      })
    );
    return;
  }

  // 🟣 STRATÉGIE D : Images et Icônes -> Cache First, fallback Network
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) return response;
        return fetch(request).catch(() => {
          // ✅ FILET DE SÉCURITÉ pour les images
          return new Response("", { status: 404, headers: { 'Content-Type': 'image/svg+xml' } });
        });
      })
    );
    return;
  }

  // ⚪ STRATÉGIE E : Tout le reste -> Cache First
  event.respondWith(
    caches.match(request).then((response) => response || fetch(request).catch(() => new Response("Offline", { status: 503 })))
  );
});