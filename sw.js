// ═══════════════════════════════════════════════════════════
// DAGOSPEAK SERVICE WORKER v19 (Optimisé & Robuste)
// ══════════════════════════════════════════════════════════
const CACHE_NAME = 'dagospeak-v19';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/dagospeak-logo.svg',
  '/assets/hero-bg.png',
  '/assets/teacher-3d.png',
  '/assets/users-3d.png',
  '/src/ui/styles/tokens.css',
  '/src/ui/styles/base.css',
  '/content/fr/manifest.json',
  '/content/fr/vocabulary/alphabet1.json',
  '/content/fr/vocabulary/alphabet2.json',
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

// 1. INSTALLATION : Mise en cache agressive des assets critiques
self.addEventListener('install', (event) => {
  console.log('[SW v19] 📦 Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // addAll est plus robuste et atomique que la boucle for
      await cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW v19] ⚠️ Échec partiel du cache:', err);
      });
    }).then(() => self.skipWaiting()) // Force l'activation immédiate
  );
});

// 2. ACTIVATION : Nettoyage des anciens caches et prise de contrôle
self.addEventListener('activate', (event) => {
  console.log('[SW v19] 🚀 Activation et nettoyage...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim()) // Prend le contrôle des pages ouvertes
    .then(() => {
      // Notifie toutes les fenêtres ouvertes qu'une nouvelle version est prête
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
          });
        });
    })
  );
});

// 3. INTERCEPTION : Stratégies de cache intelligentes
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET ou externes
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // STRATÉGIE A : Navigation (SPA Fallback)
  // Network-first, sinon sert index.html (évite l'écran "Hors ligne" du navigateur)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html')) // Fallback ultime pour SPA
    );
    return;
  }

  // STRATÉGIE B : Assets Statiques (JS, CSS, Images, JSON)
  // Stale-While-Revalidate : Rapide (cache) + Mise à jour en arrière-plan
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    url.pathname.includes('/content/') ||
    STATIC_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => cached); // Si échec réseau, on garde le cache

        // Renvoie le cache immédiatement s'il existe, sinon attend le réseau
        return cached || fetchPromise;
      })
    );
    return;
  }

  // STRATÉGIE C : Tout le reste (Fallback sécurisé)
  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).catch(() => new Response('', { status: 503 }))
    )
  );
});

// 4. MESSAGE : Écoute la commande de l'utilisateur pour forcer la mise à jour
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING_AND_RELOAD') {
    self.skipWaiting();
  }
});