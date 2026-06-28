// Cache version — bump this string to force old caches to be wiped on next visit.
const CACHE_NAME = 'anisearch-cache-v2';

const PRECACHE = [
  '/',
  '/index.html',
  '/favicon.png',
  '/logo.png',
];

// ── Install: pre-cache shell assets ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())   // become active immediately
  );
});

// ── Activate: delete old caches ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: NETWORK-FIRST ─────────────────────────────────────────────────────
// Always hit the network. The cache is ONLY used as an offline fallback.
// This guarantees that code/style updates are picked up on every normal reload
// without needing Ctrl+Shift+R.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Let the browser handle non-http schemes (chrome-extension://, etc.)
  if (!request.url.startsWith('http')) return;

  // Pass through cross-origin requests (fonts, CDN, backend API on Render…)
  if (url.hostname !== self.location.hostname) return;

  // Pass through backend API paths
  if (url.pathname.startsWith('/api') || url.pathname.includes('/download')) return;

  // Navigation requests — network first, fall back to cached root for offline SPA.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
    return;
  }

  // All other requests — NETWORK FIRST, cache as offline fallback.
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Refresh the cache entry so the offline fallback stays fresh.
        // Cache only: HTTP 200 (ok), GET requests, non-media and non-partial contents
        const isGet = request.method === 'GET';
        const isOk = networkResponse.ok && networkResponse.status === 200;
        const isMedia = request.url.match(/\.(mp4|webm|ogg|mp3|wav|mov)$/i) || networkResponse.headers.get('content-type')?.includes('video') || networkResponse.headers.get('content-type')?.includes('audio');

        if (isGet && isOk && !isMedia) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache).catch(() => {});
          });
        }
        return networkResponse;
      })
      .catch(() =>
        caches.match(request).then(
          (cached) => cached ?? new Response('Offline', { status: 503 })
        )
      )
  );
});
