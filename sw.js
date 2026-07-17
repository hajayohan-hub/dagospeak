const CACHE_NAME = 'dagospeak-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg',
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

// Installation : mise en cache de toutes les ressources statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cache ouvert');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => {
        console.warn('[SW] Erreur de cache:', err);
      })
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie de fetch : Cache First pour les ressources statiques, Network First pour le contenu
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Pour les fichiers JSON du contenu : Network First (toujours essayer de récupérer la dernière version)
  if (url.pathname.includes('/content/') && url.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Si la réponse est valide, on la met en cache
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Si le réseau échoue, on sert depuis le cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Pour toutes les autres ressources : Cache First (rapide et hors-ligne)
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si c'est en cache, on le sert
        if (response) {
          return response;
        }
        // Sinon, on essaie le réseau
        return fetch(event.request).then((response) => {
          // Si la réponse est valide, on la met en cache pour la prochaine fois
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

// Pré-chargement des contenus essentiels après installation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Liste des fichiers de contenu à pré-cacher
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

      // Tenter de mettre en cache chaque fichier (ignore les erreurs si un fichier manque)
      for (const file of contentFiles) {
        try {
          await cache.add(file);
          console.log('[SW] Pré-caché:', file);
        } catch (err) {
          console.warn('[SW] Impossible de pré-cacher:', file);
        }
      }
    })()
  );
});