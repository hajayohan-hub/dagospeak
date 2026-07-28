// ═══════════════════════════════════════════════════════════
// DAGOSPEAK SERVICE WORKER v18 - VERSION PRODUCTION
// Stratégie Hybride : Cache-First + Stale-While-Revalidate + Network-First
// ══════════════════════════════════════════════════════════

const CACHE_NAME = 'dagospeak-v18';

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
// 1. INSTALL
// ═══════════════════════════════════════════════════════════
self.addEventListener('install', (event) => {
  console.log('[SW v18] 📦 Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn('[SW] ⚠️ Échec cache:', url);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// ═══════════════════════════════════════════════════════════
// 2. ACTIVATE
// ═══════════════════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  console.log('[SW v18] 🚀 Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
      .then(() => {
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clients) => {
            clients.forEach((client) => {
              client.postMessage({ type: 'NEW_VERSION' });
            });
          });
      })
  );
});

// ═══════════════════════════════════════════════════════════
// 3. FETCH
// ═══════════════════════════════════════════════════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // A. CACHE-FIRST : Images, JSON
  if (request.destination === 'image' || request.destination === 'font' || url.pathname.includes('/content/') || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
            }
          }).catch(() => null);
          return cached;
        }
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

  // B. STALE-WHILE-REVALIDATE : JS, CSS
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse.clone()));
          }
          return networkResponse;
        }).catch(() => {
          if (cached) return cached;
          // ✅ Coquille corrigée ici
          return new Response('/* offline */', {
            status: 503,
            headers: { 'Content-Type': request.destination === 'script' ? 'application/javascript' : 'text/css' }
          });
        });
        return cached || fetchPromise;
      })
    );
    return;
  }

  // C. NETWORK-FIRST : Navigation HTML
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => caches.match('/index.html') || new Response('Page hors-ligne', { status: 503 }))
    );
    return;
  }

  // D. FALLBACK
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).catch(() => new Response('', { status: 503 })))
  );
});

// ═══════════════════════════════════════════════════════════
// 4. MESSAGE
// ═══════════════════════════════════════════════════════════
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});