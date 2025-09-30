// Service worker minimal pour MedAlert PWA
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  clients.claim();
});

self.addEventListener('fetch', event => {
  // Stratégie réseau d'abord, fallback offline possible
  event.respondWith(
    fetch(event.request).catch(() => new Response('Hors ligne', { status: 503, statusText: 'Offline' }))
  );
});

// Réception de messages pour afficher une notification
self.addEventListener('message', event => {
  console.log('SW: message reçu', event.data);
  if (event.data && event.data.type === 'alert-notification') {
    self.registration.showNotification(event.data.title, {
      body: event.data.body,
      icon: event.data.icon || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='192' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' fill='%23000'/%3E%3Ctext x='96' y='120' font-size='80' text-anchor='middle' fill='%2300d4ff'%3E⚕️%3C/text%3E%3C/svg%3E",
      vibrate: [200, 100, 200],
      tag: 'medalert',
      renotify: true
    });
    // Demande à la page de jouer le son si possible
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'play-alert-sound' });
      });
    });
  }
});
