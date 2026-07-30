// ═══════════════════════════════════════════════════════════
// DAGOSPEAK SERVICE WORKER v18
// Stratégie Hybride : Cache-First + Stale-While-Revalidate + Network-First
// ══════════════════════════════════════════════════════════
const CACHE_NAME = 'dagospeak-v18'; // ⚠️ Incrémenter à chaque déploiement majeur

// Liste des assets critiques à pré-cacher (Cache-First)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/dagospeak-logo.svg',
  '/assets/hero-bg.png',
  '/src/ui/styles/tokens.css',
  '/src/ui/styles/base.css',
  '/content/fr/manifest.json',
  '/content/fr/vocabulary/survival.json',
  '/content/fr/vocabulary/family.json',
  '/content/fr/vocabulary/market.json',
  '/content/fr/vocabulary/numbers.json',
  '/content/fr/vocabulary/numbers2.json',
  '/content/fr/vocabulary/colors.json',
  '/content/fr/vocabulary/days.json',
  '/content/fr/vocabulary/months.json',
  '/content/fr/vocabulary/greetings.json',
  '/content/fr/vocabulary/body.json',
  '/content/fr/vocabulary/alphabet1.json', // ✅ Ajouté
  '/content/fr/vocabulary/alphabet2.json', // ✅ Ajouté
  '/content/fr/dialogues/survival_dialogue.json',
  '/content/fr/dialogues/family_dialogue.json',
  '/content/fr/dialogues/market_dialogue.json',
  '/content/fr/dialogues/numbers_dialogue.json',
  '/content/fr/dialogues/numbers2_dialogue.json',
  '/content/fr/dialogues/colors_dialogue.json',
  '/content/fr/dialogues/days_dialogue.json',
  '/content/fr/dialogues/months_dialogue.json',
  '/content/fr/dialogues/greetings_dialogue.json',
  '/content/fr/dialogues/body_dialogue.json'
];

// ═══════════════════════════════════════════════════════════
// 1. INSTALL : Pré-cache les assets statiques
// ══════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('[SW v18] 📦 Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[SW v18] 📂 Ouverture du cache:', CACHE_NAME);
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
          console.log('[SW v18] ✅ Caché:', url);
        } catch (err) {
          console.warn('[SW v18] ️ Échec cache:', url, err.message);
        }
      }
    }).then(() => {
      console.log('[SW v18]  skipWaiting()');
      return self.skipWaiting();
    })
  );
});

// ══════════════════════════════════════════════════════════
// 2. ACTIVATE : Nettoie les vieux caches + prend le contrôle
// ══════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('[SW v18] 🚀 Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW v18] 🗑️ Suppression:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW v18] 🎯 clients.claim()');
      return self.clients.claim();
    }).then(() => {
      // Notifie toutes les pages ouvertes qu'une nouvelle version est prête
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((client) => {
            console.log('[SW v18] 📢 Notification NEW_VERSION à:', client.url);
            client.postMessage({ type: 'NEW_VERSION' });
          });
        });
    })
  );
});

// ═══════════════════════════════════════════════════════════
// 3. FETCH : Stratégie hybride selon le type de requête
// ═══════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore les requêtes non-GET et les URLs externes
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // ───────────────────────────────────────────────────────
  // STRATÉGIE A : CACHE-FIRST
  // Pour : Images, Contenu JSON (vocabulaire, dialogues)
  // ───────────────────────────────────────────────────────
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.includes('/content/') ||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          // Retourne le cache immédiatement, met à jour en arrière-plan
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          }).catch(() => null);
          return cached; // ✅ Retourne le cache SANS attendre
        }
        // Pas en cache, on fetch et on cache pour la prochaine fois
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // ───────────────────────────────────────────────────────
  // STRATÉGIE B : STALE-WHILE-REVALIDATE
  // Pour : Code JS, CSS
  // ───────────────────────────────────────────────────────
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => {
          // Si le réseau échoue et qu'on a le cache, on le retourne
          if (cached) return cached;
          // Sinon, fallback vide (✅ Coquille corrigée : '/* offline */')
          return new Response(
            '/* offline */',
            {
              status: 503,
              headers: { 'Content-Type': request.destination === 'script' ? 'application/javascript' : 'text/css' }
            }
          );
        });
        // Retourne le cache s'il existe, sinon attend le réseau
        return cached || fetchPromise;
      })
    );
    return;
  }

  // ───────────────────────────────────────────────────────
  // STRATÉGIE C : NETWORK-FIRST
  // Pour : Navigation HTML
  // ───────────────────────────────────────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Hors-ligne : sert la page d'accueil depuis le cache
        return caches.match('/index.html') || new Response('Page hors-ligne', { status: 503 });
      })
    );
    return;
  }

  // ───────────────────────────────────────────────────────
  // STRATÉGIE D : FALLBACK
  // Pour : Tout le reste
  // ──────────────────────────────────────────────────────
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => new Response('', { status: 503 }));
    })
  );
});

// ═══════════════════════════════════════════════════════════
// 4. MESSAGE : Répond aux messages de l'app
// ═══════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW v18] ⏭️ Skip waiting activé par l\'utilisateur');
    self.skipWaiting();
  }
});