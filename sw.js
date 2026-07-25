const CACHE_NAME = 'dagospeak-v16'; // Version incrémentée pour forcer le nettoyage

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/dagospeak-logo.svg',
  '/assets/hero-bg.png',
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

// 1. INSTALL
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    .then(() => self.skipWaiting())
  );
});

// 2. ACTIVATE
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 3. FETCH (Stratégie ultra-robuste)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // ✅ Astuce cruciale : On ignore les ?v=15 pour le cache
  const cleanUrl = url.origin + url.pathname;

  // A. Navigation HTML
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // B. Assets statiques et Contenu JSON (Cache First)
  if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/content/')) {
    event.respondWith(
      caches.match(cleanUrl).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(cleanUrl, clone));
          }
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // C. JS, CSS, API (Network First - JAMAIS de cache pour le code)
  event.respondWith(
    fetch(req).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(cleanUrl, clone));
      }
      return res;
    }).catch(() =>
      caches.match(cleanUrl).then((r) => r || new Response('Offline', { status: 503 }))
    )
  );
});