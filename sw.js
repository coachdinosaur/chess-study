/**
 * CD Digital Chess Study - Service Worker
 * Provides offline resilience and fast caching for Stockfish WASM,
 * opening databases, spreadsheet tools, and piece assets.
 */

const CACHE_NAME = 'cd-chess-cache-v1';

const PRECACHE_ASSETS = [
  './assets/pieces/app_icon.png',
  './assets/pieces/mpchess/wK.svg',
  './assets/pieces/mpchess/wQ.svg',
  './assets/pieces/mpchess/wR.svg',
  './assets/pieces/mpchess/wB.svg',
  './assets/pieces/mpchess/wN.svg',
  './assets/pieces/mpchess/wP.svg',
  './assets/pieces/mpchess/bK.svg',
  './assets/pieces/mpchess/bQ.svg',
  './assets/pieces/mpchess/bR.svg',
  './assets/pieces/mpchess/bB.svg',
  './assets/pieces/mpchess/bN.svg',
  './assets/pieces/mpchess/bP.svg',
  './assets/top-players.json',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('SW: Precache partial failure:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only intercept GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Bypass third-party APIs (Supabase, Lichess Tablebase, local scanner)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('lichess.ovh') ||
    url.port === '8765' ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // 1. Heavy Static Assets: Cache-First (WASM, TSV, Vendor JS, Piece SVGs, GLB models)
  const isHeavyStaticAsset =
    url.pathname.endsWith('.wasm') ||
    url.pathname.endsWith('.tsv') ||
    url.pathname.endsWith('.glb') ||
    url.pathname.includes('/vendor/') ||
    url.pathname.includes('/assets/pieces/');

  if (isHeavyStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          if (cachedResponse) return cachedResponse;
          throw err;
        }
      })
    );
    return;
  }

  // 2. Core App Files (HTML, CSS, Root JS Modules): Stale-While-Revalidate / Network-First
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        throw err;
      }
    })
  );
});
