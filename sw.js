// ═══════════════════════════════════════════════════════════
// DAGOSPEAK SERVICE WORKER v21 (Corrigé & Stabilisé)
// ══════════════════════════════════════════════════════════
const CACHE_NAME = 'dagospeak-v21';
const STATIC_ASSETS = [
  '/', '/index.html', '/manifest.webmanifest',
  '/assets/dagospeak-logo.svg', '/assets/hero-bg.png',
  '/assets/teacher-3d.png', '/assets/users-3d.png',
  '/src/ui/styles/tokens.css', '/src/ui/styles/base.css',
  '/content/fr/manifest.json',
  '/content/fr/vocabulary/alphabet1.json', '/content/fr/vocabulary/alphabet2.json',
  '/content/fr/vocabulary/survival.json', '/content/fr/vocabulary/family.json',
  '/content/fr/vocabulary/market.json', '/content/fr/vocabulary/numbers.json',
  '/content/fr/vocabulary/numbers2.json', '/content/fr/vocabulary/colors.json',
  '/content/fr/vocabulary/days.json', '/content/fr/vocabulary/months.json',
  '/content/fr/vocabulary/greetings.json', '/content/fr/vocabulary/body.json',
  '/content/fr/dialogues/survival_dialogue.json', '/content/fr/dialogues/family_dialogue.json',
  '/content/fr/dialogues/market_dialogue.json', '/content/fr/dialogues/numbers_dialogue.json',
  '/content/fr/dialogues/numbers2_dialogue.json', '/content/fr/dialogues/colors_dialogue.json',
  '/content/fr/dialogues/days_dialogue.json', '/content/fr/dialogues/months_dialogue.json',
  '/content/fr/dialogues/greetings_dialogue.json', '/content/fr/dialogues/body_dialogue.json'
];

// 1. INSTALLATION
self.addEventListener('install', (event) => {
  console.log('[SW v21] 📦 Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of STATIC_ASSETS) {
        try { await cache.add(url); }
        catch (err) { console.warn('[SW v21] ⚠️ Échec cache:', url); }
      }
    })
  );
});

// 2. ACTIVATION
self.addEventListener('activate', (event) => {
  console.log('[SW v21] 🚀 Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. INTERCEPTION DES REQUÊTES (Sans erreur de clone)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Navigation (SPA Fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
 are;
    }

    // Retourne le cache immédiatement, met à jour en arrière-plan
    return cachedResponse;
  }

  // Fallback par défaut
  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).catch(() => new Response('', { status: 503 }))
    )
  );
});

// 4. MESSAGE : Activation forcée par l'utilisateur
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});