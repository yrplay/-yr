/* Notification Click Handler imported by Workbox in production builds */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    '/?view=staff-attendance';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client && 'focus' in client) {
            try {
              client.postMessage({
                type: 'GHAITH_NOTIFICATION_CLICK',
                url: targetUrl
              });
            } catch (e) {
              // ignore
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
