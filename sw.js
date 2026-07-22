const CACHE_NAME = 'dagospeak-v6'; // ✅ Incrémentation pour forcer le nettoyage du cache v5

// Liste des fichiers ESSENTIELS à mettre en cache pour le mode hors-ligne
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
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

// 1. INSTALLATION : Pré-cache agressif de toutes les données
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Mise en cache des fichiers essentiels pour le mode hors-ligne...');
      // Boucle avec try/catch : si un fichier manque, les autres sont quand même mis en cache
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
          console.log('[SW] ✅ Mis en cache:', url);
        } catch (err) {
          console.warn('[SW] ⚠️ Échec du cache (fichier manistant ou bloqué):', url);
        }
      }
    })
  );
  self.skipWaiting(); // Force l'activation immédiate
});

// 2. ACTIVATION : Nettoyage des anciens caches (v1 à v5)
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
    }).then(() => self.clients.claim()) // Prend le contrôle immédiat des pages ouvertes
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

  // 🟡 STRATÉGIE B : JSON (Données) -> CACHE FIRST (Crucial pour le hors-ligne)
  if (url.pathname.includes('/content/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse; // ✅ Servi instantanément depuis le cache (fonctionne hors-ligne)
        }
        // Sinon, on essaie le réseau
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          // 🛡️ FILET DE SÉCURITÉ : Ne jamais renvoyer undefined
          return new Response(JSON.stringify({ error: "Hors ligne et données non disponibles" }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        });
      })
    );
    return;
  }

  // 🔵 STRATÉGIE C : JS et CSS -> Network First, fallback Cache (pour voir vos mises à jour de code)
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

  // 🟣 STRATÉGIE D : Images et Fonts -> Cache First
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