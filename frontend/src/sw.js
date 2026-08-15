import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Precaching provided by VitePWA
precacheAndRoute(self.__WB_MANIFEST || [])

// Runtime Caching for API calls
registerRoute(
  ({ url }) => url.pathname.startsWith('/api'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 // 1 day
      })
    ],
    networkTimeoutSeconds: 10
  })
)

// Push Notification Handling
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json()
      event.waitUntil(
        self.registration.showNotification(data.title || 'AniSearch', {
          body: data.body || 'Nuovi contenuti disponibili!',
          icon: data.icon || '/logo.png',
          data: { url: data.url || '/' }
        })
      )
    } catch (err) {
      console.error('Error parsing push data', err)
    }
  }
})

// Notification Click Handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((windowClients) => {
        // Se c'è già una finestra aperta con questo URL, focalizzala
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i]
          if (client.url === event.notification.data.url && 'focus' in client) {
            return client.focus()
          }
        }
        // Altrimenti apri una nuova finestra
        if (self.clients.openWindow) {
          return self.clients.openWindow(event.notification.data.url)
        }
      })
    )
  }
})
