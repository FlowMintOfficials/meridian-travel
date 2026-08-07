/* Meridian service worker.
 *
 * Strategy:
 *   - App shell (HTML / JS / CSS) is cached on install and served
 *     stale-while-revalidate so the app opens instantly even offline.
 *   - Third-party API calls (Frankfurter, Open-Meteo) are network-first
 *     with a cache fallback so the last-known rates and forecasts are
 *     available in airplane mode.
 *
 * Bump CACHE_VERSION when you ship a new build so old assets get purged.
 */

const CACHE_VERSION = 'meridian-v2'
const APP_SHELL = ['./', './index.html', './favicon.svg', './manifest.json']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Same-origin app shell + assets — stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(req)
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => cached)
        return cached || network
      }),
    )
    return
  }

  // Currency / weather APIs — network first, cache last
  if (url.hostname.endsWith('frankfurter.app') || url.hostname.endsWith('open-meteo.com')) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        try {
          const res = await fetch(req)
          if (res.ok) cache.put(req, res.clone())
          return res
        } catch (err) {
          const cached = await cache.match(req)
          if (cached) return cached
          throw err
        }
      }),
    )
  }
})
