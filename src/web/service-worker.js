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
      icon: event.data.icon || '/icon-192.png',
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
