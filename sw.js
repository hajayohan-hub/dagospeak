// ═══════════════════════════════════════════════════════════
// DAGOSPEAK SERVICE WORKER v25 (CORRIGÉ - Attente du clic utilisateur)
// ══════════════════════════════════════════════════════════
const CACHE_NAME = 'dagospeak-v25';
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

// 1. INSTALLATION (SANS skipWaiting - on attend le clic utilisateur)
self.addEventListener('install', (event) => {
  console.log('[SW v25] 📦 Installation en cours...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    // ✅ PAS de self.skipWaiting() ici ! Le SW reste en état 'waiting'
  );
});

// 2. ACTIVATION
self.addEventListener('activate', (event) => {
  console.log('[SW v25] 🚀 Activation...');
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
    )).then(() => self.clients.claim())
  );
});

// 3. INTERCEPTION DES REQUÊTES
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || caches.match('/index.html'));
    })
  );
});

// 4. MESSAGE : Activation UNIQUEMENT quand l'utilisateur clique "Averina"
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW v25] ✅ Message SKIP_WAITING reçu. Activation...');
    self.skipWaiting(); // ✅ ICI seulement, après le clic
  }
});