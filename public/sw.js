/* Minimal offline-first service worker (no Workbox).
   - Caches app navigations and static JSON under /Data/
   - Network-first for app shell, cache-first for /Data/
*/

const CACHE_NAME = 'bigyear-cache-v4'

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      // Use relative URLs so this works under GitHub Pages subpaths (/repo/).
      await cache.addAll([
        './',
        './manifest.webmanifest',
        './images/default.jpeg',
        './images/aves/default.jpeg',
        './images/mammalia/default.jpeg',
        './images/amphibia/default.jpeg',
        './images/reptilia/default.jpeg',
        './images/insecta/default.jpeg',
      ])
      self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) cache.put(request, response.clone())
  return response
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    if (response && response.ok) cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    throw new Error('Network unavailable and no cache match')
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // SPA navigation: serve cached root (Vite will handle routing client-side).
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst('./'))
    return
  }

  // GitHub Pages hosts under /<repo>/, so /Data/ becomes /<repo>/Data/.
  if (url.pathname.includes('/Data/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(networkFirst(request))
})
