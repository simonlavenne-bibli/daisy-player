// ================================================================
// LUMIÈRE AUDIO v2 — service-worker.js
// Stratégie : Cache First pour assets statiques
// ================================================================

const CACHE_NAME    = 'lumiere-audio-v2';
const CACHE_TIMEOUT = 5000; // ms avant de tomber en fallback cache

const ASSETS_TO_PRECACHE = [
    './',
    './index.html',
    './css/style.css',
    './js/main.js',
    './js/player.js',
    './js/ui.js',
    './js/parser.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    // JSZip en local (copié dans vendor/)
    './js/vendor/jszip.min.js',
];

// ── Installation : mise en cache des assets essentiels ─────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pré-mise en cache des assets...');
            return Promise.allSettled(
                ASSETS_TO_PRECACHE.map(url =>
                    cache.add(url).catch(err =>
                        console.warn('[SW] Asset non mis en cache :', url, err)
                    )
                )
            );
        }).then(() => {
            console.log('[SW] Installation terminée.');
            return self.skipWaiting();
        })
    );
});

// ── Activation : suppression des anciens caches ─────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => {
                        console.log('[SW] Suppression ancien cache :', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Activation terminée.');
            return self.clients.claim();
        })
    );
});

// ── Interception des requêtes : Cache First ────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Ignorer les requêtes non-GET et les protocoles non-http(s)
    if (request.method !== 'GET') return;
    if (!url.protocol.startsWith('http')) return;

    // Ne pas mettre en cache les blobs (fichiers audio chargés)
    if (url.protocol === 'blob:') return;

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Ressource en cache → servie immédiatement
                // On rafraîchit en arrière-plan pour la prochaine visite
                _refreshCacheInBackground(request);
                return cachedResponse;
            }

            // Pas en cache → réseau
            return fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok) {
                    const cloned = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, cloned));
                }
                return networkResponse;
            }).catch(() => {
                // Hors ligne et pas en cache
                if (request.destination === 'document') {
                    return caches.match('./index.html');
                }
                return new Response(
                    JSON.stringify({ error: 'Hors ligne — ressource non disponible' }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                );
            });
        })
    );
});

// ── Mise à jour silencieuse en arrière-plan ────────────────────
function _refreshCacheInBackground(request) {
    fetch(request).then(response => {
        if (response && response.ok) {
            caches.open(CACHE_NAME).then(cache => cache.put(request, response));
        }
    }).catch(() => { /* silencieux si hors ligne */ });
}

// ── Messages depuis l'application ─────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});
