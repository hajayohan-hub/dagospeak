// ═══════════════════════════════════════════════════════════
// DAGOSPEAK SERVICE WORKER v28 — PRODUCTION
// Offline-first + détection de mise à jour quasi instantanée en ligne
// ══════════════════════════════════════════════════════════

// ⚠️ Change ce numéro à CHAQUE déploiement — c'est ce qui déclenche
// la détection de mise à jour (le navigateur compare ce fichier octet
// par octet à la version active).
const CACHE_VERSION = 'v35';
const CACHE_NAME = `dagospeak-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/', '/index.html', '/manifest.webmanifest',
  '/assets/dagospeak-logo.svg', '/assets/hero-bg.png',
  '/assets/teacher-3d.png', '/assets/users-3d.png',
  '/src/ui/styles/tokens.css', '/src/ui/styles/base.css',
  '/content/fr/manifest.json',

  // Vocabulary
  '/content/fr/vocabulary/alphabet1.json', '/content/fr/vocabulary/alphabet2.json',
  '/content/fr/vocabulary/survival.json', '/content/fr/vocabulary/family.json',
  '/content/fr/vocabulary/market.json', '/content/fr/vocabulary/numbers.json',
  '/content/fr/vocabulary/numbers2.json', '/content/fr/vocabulary/colors.json',
  '/content/fr/vocabulary/days.json', '/content/fr/vocabulary/months.json',
  '/content/fr/vocabulary/greetings.json', '/content/fr/vocabulary/body.json',
  '/content/fr/vocabulary/pronouns_basic.json',

  // Dictionary
  '/content/fr/dictionary/market.json', '/content/fr/dictionary/family.json',
  '/content/fr/dictionary/survival.json', '/content/fr/dictionary/numbers.json',
  '/content/fr/dictionary/colors.json', '/content/fr/dictionary/days.json',
  '/content/fr/dictionary/months.json', '/content/fr/dictionary/greetings.json',
  '/content/fr/dictionary/body.json', '/content/fr/dictionary/numbers2.json',
  '/content/fr/dictionary/alphabet1.json', '/content/fr/dictionary/alphabet2.json',
  '/content/fr/dictionary/pronouns_basic.json',

  // ✅ TOUS les dialogues Conversation Live
   '/content/fr/conversations/greetings_01.json',
  '/content/fr/conversations/market_01.json', 
  '/content/fr/conversations/family_01.json',
  '/content/fr/conversations/numbers_01.json',
  '/content/fr/conversations/colors_01.json',
  '/content/fr/conversations/survival_01.json',
  '/content/fr/conversations/body_01.json',
    '/content/fr/conversations/days_01.json',
  '/content/fr/conversations/months_01.json',
  '/content/fr/conversations/pronouns_basic_01.json',
  '/content/fr/conversations/alphabet_01.json',
  '/content/fr/conversations/numbers2_01.json',

      // ✅ Teacher Avatar (SVG + Renderer)
    '/src/ui/components/teacher-avatar-svg.js',
    '/src/ui/components/teacher-avatar-renderer.js',

    // ✅ STT Manager pour Conversation Live
    '/src/core/stt-manager.js',

  '/content/fr/levels.json', '/content/fr/exams.json',
];

// ═══════════════════════════════════════════════════════════
// 1. INSTALLATION — pré-cache résilient, PAS de skipWaiting()
// ═══════════════════════════════════════════════════════════
// Le SW reste volontairement en état "waiting" tant que l'utilisateur
// n'a pas cliqué sur le bouton de mise à jour. C'est la garantie
// anti-perte-de-données (voir explication précédente).
    self.addEventListener('install', (event) => {
      console.log(`[SW ${CACHE_VERSION}] 📦 Installation...`);
      event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
          const results = await Promise.allSettled(
            STATIC_ASSETS.map((url) => cache.add(url))
          );
          results.forEach((r, i) => {
            if (r.status === 'rejected') {
              console.warn(`[SW ${CACHE_VERSION}] ⚠️ Échec cache:`, STATIC_ASSETS[i]);
            }
          });
              console.log(`[SW ${CACHE_VERSION}] ✅ Pré-cache terminé (en attente du clic utilisateur)`);
        })
      );
      // ✅ Pas de skipWaiting() ici - on attend le clic utilisateur
    });

// ═══════════════════════════════════════════════════════════
// 2. ACTIVATION — nettoyage des vieux caches + prise de contrôle
// ═══════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log(`[SW ${CACHE_VERSION}] 🚀 Activation...`);
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => {
          console.log(`[SW ${CACHE_VERSION}] 🗑️ Suppression ancien cache:`, n);
          return caches.delete(n);
        })
      );
      await self.clients.claim();
      console.log(`[SW ${CACHE_VERSION}] ✅ Actif et aux commandes`);
    })()
  );
});

// ═══════════════════════════════════════════════════════════
// 3. FETCH — stratégies différenciées par type de ressource
// ═══════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // On ne gère que le GET same-origin — le reste part au réseau normalement
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // --- Navigations (HTML) : network-first ---
  // "Instantané en ligne" = toujours essayer le réseau en premier pour le HTML,
  // afin que la page elle-même reflète la dernière version dès qu'elle est en ligne.
  // Fallback sur le cache uniquement hors-ligne.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // --- Assets statiques (JS, CSS, images, contenu JSON) : stale-while-revalidate ---
  // Réponse instantanée depuis le cache (perçu comme "instantané"),
  // tout en revalidant en tâche de fond dès que le réseau est disponible.
  const isStaticAsset =
    ['script', 'style', 'image'].includes(request.destination) ||
    url.pathname.startsWith('/content/') ||
    STATIC_ASSETS.includes(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => cached); // hors-ligne → on retombe sur le cache
        return cached || networkFetch;
      })
    );
    return;
  }

  // --- Tout le reste : cache-first avec fallback réseau ---
  event.respondWith(
    caches.match(request).then(
      (cached) => cached || fetch(request).catch(() => new Response('', { status: 503 }))
    )
  );
});

// ═══════════════════════════════════════════════════════════
// 4. MESSAGES — le seul déclencheur de skipWaiting()
// ═══════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log(`[SW ${CACHE_VERSION}] ✅ SKIP_WAITING reçu → activation`);
    self.skipWaiting();
  }
});