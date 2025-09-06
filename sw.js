self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || "Nearby Facility";
  const body = data.body || "Something useful nearby";
  event.waitUntil(
    self.registration.showNotification(title, { body })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/'));
});
