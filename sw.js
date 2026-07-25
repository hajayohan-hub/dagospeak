const CACHE_NAME = 'dagospeak-v15';
const ASSETS_TO_CACHE = [
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

// 1. INSTALL : on cache les assets statiques UNIQUEMENT (pas le code JS/CSS)
self.addEventListener('install', (event) => {
  console.log('[SW] Installation de', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of ASSETS_TO_CACHE) {
        try { await cache.add(url); } catch (e) { console.warn('[SW] Cache échoué:', url); }
      }
    }).then(() => self.skipWaiting()) // ✅ Force l'activation immédiate
  );
});

// 2. ACTIVATE : on supprime les vieux caches + on prend le contrôle + on notifie
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation de', CACHE_NAME);
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim()) // ✅ Prend le contrôle de toutes les pages
      .then(() => {
        // ✅ Notifie TOUTES les pages ouvertes qu'une nouvelle version est prête
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then(clients => {
            clients.forEach(client => client.postMessage({ type: 'NEW_VERSION_READY' }));
          });
      })
  );
});

// 3. FETCH : stratégie différenciée
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // A. Assets statiques (images, contenu JSON) → Cache First
  if (request.destination === 'image' ||
      url.pathname.includes('/content/') ||
      ASSETS_TO_CACHE.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(r => r || fetch(request).then(res => {
        if (res.ok) { const c = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, c)); }
        return res;
      }).catch(() => new Response('', { status: 503 })))
    );
    return;
  }

  // B. Code JS/CSS → NETWORK FIRST TOUJOURS (pas de cache pour le code)
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request).then(res => {
        if (res.ok) {
          const c = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, c));
        }
        return res;
      }).catch(() => caches.match(request).then(r => r || new Response('/* offline */', { status: 503, headers: { 'Content-Type': 'text/javascript' } })))
    );
    return;
  }

  // C. Navigation HTML → Network First
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // D. Fallback
  event.respondWith(
    caches.match(request).then(r => r || fetch(request).catch(() => new Response('', { status: 503 })))
  );
});