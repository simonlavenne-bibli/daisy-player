// ================================================================
// LUMIÈRE AUDIO — sw.js (racine du projet)
// v6 — Version incrémentée pour forcer l'invalidation du cache
//       et servir les nouvelles ressources CSS/JS immédiatement.
// ================================================================

const CACHE_NAME = 'lumiere-audio-v6';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/ui.js',
  './js/player.js',
  './js/parser.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', (e) => {
  // skipWaiting : le nouveau SW prend le contrôle immédiatement
  // sans attendre la fermeture de tous les onglets.
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Asset non mis en cache :', url, err)
          )
        )
      );
    })
  );
});

self.addEventListener('activate', (e) => {
  // Supprime tous les anciens caches (v1, v2, v3, v4, v5…)
  e.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Suppression ancien cache :', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
