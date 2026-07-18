const CACHE_NAME = 'dagospeak-v3'; // Version incrémentée pour forcer le nettoyage de l'ancien cache

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.svg',
  '/src/app.js',
  '/src/ui/styles/tokens.css',
  '/src/ui/styles/base.css',
  '/src/ui/components/ds-button.js',
  '/src/ui/components/ds-quiz.js',
  '/src/core/event-bus.js',
  '/src/core/container.js',
  '/src/core/logger.js',
  '/src/storage/dago-db.js',
  '/src/data/content-loader.js',
  '/src/business/router.js',
  '/src/business/roles.js',
  '/src/engines/learning/srs.js',
  '/src/engines/gamification/index.js',
  '/src/engines/pronunciation/shadowing.js',
  '/src/payments/gateway.js',
  '/src/payments/providers/mobile-money.js',
  '/content/fr/manifest.json'
];

// 1. INSTALLATION : Mise en cache fichier par fichier (tolérant aux erreurs)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW] Cache ouvert');
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
          console.log('[SW] ✅ Mis en cache:', url);
        } catch (err) {
          console.warn('[SW] ⚠️ Échec du cache (fichier manquant ou bloqué):', url);
        }
      }
    })
  );
  self.skipWaiting(); // Force l'activation immédiate
});

// 2. ACTIVATION : Nettoyage des anciens caches et pré-chargement des JSON
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // a. Nettoyer les anciens caches (v1, v2, etc.)
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 🗑️ Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );

      // b. Pré-chargement des contenus JSON essentiels
      const cache = await caches.open(CACHE_NAME);
      const contentFiles = [
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

      for (const file of contentFiles) {
        try {
          await cache.add(file);
          console.log('[SW] ✅ Pré-caché (JSON):', file);
        } catch (err) {
          console.warn('[SW] ⚠️ Impossible de pré-cacher:', file);
        }
      }

      self.clients.claim(); // Prend le contrôle immédiat des pages ouvertes
    })()
  );
});

// 3. FETCH : Stratégie hybride (Cache First pour l'app, Network First pour les données)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Pour les fichiers JSON du contenu : Network First (toujours essayer d'avoir la dernière version)
  if (url.pathname.includes('/content/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Si le réseau échoue (hors-ligne), on sert depuis le cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Pour toutes les autres ressources (HTML, JS, CSS, Images) : Cache First
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Servi depuis le cache (ultra-rapide et hors-ligne)
        }
        // Sinon, on essaie le réseau
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
  );
});