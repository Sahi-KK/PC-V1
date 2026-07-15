self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json()
      
      const options = {
        body: data.body || 'You have a new notification from IIMR Academic Calendar.',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/'
        }
      }
      
      event.waitUntil(
        self.registration.showNotification(data.title || 'IIMR Academic Calendar', options)
      )
    } catch (e) {
      // If it's not JSON
      event.waitUntil(
        self.registration.showNotification('IIMR Academic Calendar', {
          body: event.data.text()
        })
      )
    }
  }
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    )
  } else {
    event.waitUntil(
      clients.openWindow('/')
    )
  }
})
