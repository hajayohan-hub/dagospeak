/**
 * DagoSpeak Service Worker
 * Stratégie : 
 * - App Shell : Stale-While-Revalidate (rapide, puis mise à jour)
 * - Contenu pédagogique : Cache-First (ultra-rapide, pas de réseau si disponible)
 */

const CACHE_VERSION = 'v1';
const APP_CACHE = `dagospeak-app-${CACHE_VERSION}`;
const CONTENT_CACHE = `dagospeak-content-${CACHE_VERSION}`;

// Fichiers essentiels pour que l'app se lance hors-ligne
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/src/app.js',
  '/src/core/event-bus.js',
  '/src/core/container.js',
  '/src/core/logger.js',
  '/src/ui/components/ds-button.js',
  '/src/ui/styles/tokens.css',
  '/src/ui/styles/base.css',
  '/assets/icons/icon-192.svg'
];

// 1. Installation : pré-cache de l'App Shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key.startsWith('dagospeak-') && !key.endsWith(CACHE_VERSION))
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interception des requêtes
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Stratégie Cache-First pour le contenu pédagogique et les médias
  if (url.pathname.startsWith('/content/') || url.pathname.match(/\.(mp3|json|svg|png|webp)$/)) {
    event.respondWith(cacheFirst(event.request, CONTENT_CACHE));
    return;
  }

  // Stratégie Stale-While-Revalidate pour le reste (HTML, JS, CSS)
  event.respondWith(staleWhileRevalidate(event.request, APP_CACHE));
});

// 4. Background Sync (pour sauvegarder la progression hors-ligne)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    console.log('[SW] Background Sync : synchronisation de la progression...');
    event.waitUntil(syncProgressToServer());
  }
});

// --- Helpers de stratégie de cache ---

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-First échec réseau:', error);
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse); // Fallback sur le cache si réseau échoue

  return cachedResponse || fetchPromise;
}

async function syncProgressToServer() {
  // Simulation : ici on lirait IndexedDB et on enverrait les données au serveur
  console.log('[SW] Données synchronisées avec succès (simulation).');
}