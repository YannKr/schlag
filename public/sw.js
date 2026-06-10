/**
 * Service worker for Schlag web — offline app-shell caching.
 *
 * Strategy:
 * - Navigation requests (HTML): network-first with cache fallback, so users
 *   always get the latest build when online but can still load the app
 *   offline.
 * - Same-origin static assets (/_expo/static/*, /assets/*, favicon): cache-
 *   first. These are content-hashed and served with immutable Cache-Control
 *   (see public/_headers), so a cached copy is always valid. The asset cache
 *   is capped at MAX_ASSET_ENTRIES so hashed assets don't accumulate across
 *   deploys forever.
 * - Cross-origin requests (CDN fonts, MediaPipe WASM, pose model) are NOT
 *   intercepted — the camera feature legitimately requires network.
 *
 * Only clean responses are cached: status 200 (no opaque/partial 206),
 * not redirected (a captive portal must not poison the shell, and serving
 * a cached redirected response for a navigation is rejected by browsers),
 * and same-origin.
 *
 * Bump CACHE_NAME to invalidate all cached entries on the next deploy.
 */

const CACHE_NAME = 'schlag-v1';

/** Cap on cached static assets; oldest entries are evicted beyond this. */
const MAX_ASSET_ENTRIES = 80;

/**
 * Precached so the app shell is available offline after first install.
 * `cache: 'reload'` bypasses the browser HTTP cache so a stale shell is
 * never precached.
 */
const PRECACHE_REQUESTS = [new Request('/', { cache: 'reload' })];

/** True for same-origin, content-hashed (immutable) static assets. */
function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_expo/static/') ||
      url.pathname.startsWith('/assets/') ||
      url.pathname === '/favicon.ico')
  );
}

/** True when a response is safe to cache and replay later. */
function isCacheable(response) {
  return (
    response.status === 200 &&
    !response.redirected &&
    new URL(response.url).origin === self.location.origin
  );
}

/** Cache a static asset, then evict the oldest assets beyond the cap. */
async function putStaticAsset(request, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);

  // cache.keys() order approximates insertion order; evict oldest first.
  // The app shell ('/') never matches isStaticAsset, so it is never evicted.
  const keys = await cache.keys();
  const assetKeys = keys.filter((key) => isStaticAsset(new URL(key.url)));
  const excess = assetKeys.length - MAX_ASSET_ENTRIES;
  if (excess > 0) {
    await Promise.all(assetKeys.slice(0, excess).map((key) => cache.delete(key)));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_REQUESTS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigations: network-first, fall back to the cached app shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheable(response)) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put('/', copy))
            );
          }
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error()))
    );
    return;
  }

  // Immutable static assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (isCacheable(response)) {
            event.waitUntil(putStaticAsset(request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else (including all cross-origin requests) passes through.
});
