// ===== Lawyer Tech ERP — Service Worker =====
// PWA Offline Support + Cache Strategy

const CACHE_NAME = 'lawyer-tech-v1'
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/login',
  '/manifest.json',
  '/images/logo.png',
]

// Install — pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

// Fetch — Network First for API, Cache First for static
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and API requests (always fresh)
  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return
  if (url.hostname.includes('vercel.app') && url.pathname.startsWith('/api/')) return

  // Network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // Offline fallback for navigation
          if (request.mode === 'navigate') {
            return caches.match('/dashboard')
          }
        })
      })
  )
})

// Background Sync for failed mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-changes') {
    console.log('[SW] Background sync triggered')
  }
})
