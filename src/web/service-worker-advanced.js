// Service Worker avancé pour MedAlert PWA
// Gestion intelligente du cache, notifications push et synchronisation background

const CACHE_VERSION = 'medalert-v2.1.0';
const CACHE_NAMES = {
  static: `${CACHE_VERSION}-static`,
  dynamic: `${CACHE_VERSION}-dynamic`,
  api: `${CACHE_VERSION}-api`,
  images: `${CACHE_VERSION}-images`,
  audio: `${CACHE_VERSION}-audio`
};

// Ressources critiques à mettre en cache immédiatement
const CRITICAL_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/audio/critical-alert.mp3',
  '/audio/high-alert.mp3',
  '/audio/medium-alert.mp3'
];

// Ressources API à mettre en cache
const API_CACHE_PATTERNS = [
  /\/api\/alerts$/,
  /\/api\/user\/preferences$/,
  /\/api\/notifications\/history$/
];

// Configuration du cache
const CACHE_CONFIG = {
  maxEntries: {
    dynamic: 50,
    api: 100,
    images: 30,
    audio: 10
  },
  maxAge: {
    static: 7 * 24 * 60 * 60 * 1000,    // 7 jours
    dynamic: 1 * 24 * 60 * 60 * 1000,   // 1 jour
    api: 5 * 60 * 1000,                 // 5 minutes
    images: 7 * 24 * 60 * 60 * 1000,    // 7 jours
    audio: 30 * 24 * 60 * 60 * 1000     // 30 jours
  }
};

// État global du service worker
let notificationQueue = [];
let isOnline = true;
let lastSync = Date.now();

/**
 * INSTALLATION
 */
self.addEventListener('install', event => {
  console.log('[SW] Installation en cours...');

  event.waitUntil(
    (async () => {
      try {
        // Ouvrir tous les caches
        const caches = await Promise.all([
          caches.open(CACHE_NAMES.static),
          caches.open(CACHE_NAMES.dynamic),
          caches.open(CACHE_NAMES.api),
          caches.open(CACHE_NAMES.images),
          caches.open(CACHE_NAMES.audio)
        ]);

        // Mettre en cache les ressources critiques
        await caches[0].addAll(CRITICAL_RESOURCES);

        console.log('[SW] Ressources critiques mises en cache');

        // Forcer l'activation immédiate
        await self.skipWaiting();

      } catch (error) {
        console.error('[SW] Erreur lors de l\'installation:', error);
      }
    })()
  );
});

/**
 * ACTIVATION
 */
self.addEventListener('activate', event => {
  console.log('[SW] Activation en cours...');

  event.waitUntil(
    (async () => {
      try {
        // Nettoyer les anciens caches
        await cleanupOldCaches();

        // Prendre le contrôle immédiatement
        await self.clients.claim();

        // Initialiser l'état
        await initializeServiceWorker();

        console.log('[SW] Activation terminée');

      } catch (error) {
        console.error('[SW] Erreur lors de l\'activation:', error);
      }
    })()
  );
});

/**
 * REQUETES FETCH
 */
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignorer les requêtes non-HTTP
  if (!request.url.startsWith('http')) {
    return;
  }

  // Stratégie en fonction du type de ressource
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  } else if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isAudioRequest(request)) {
    event.respondWith(handleAudioRequest(request));
  } else {
    event.respondWith(handleStaticRequest(request));
  }
});

/**
 * NOTIFICATIONS PUSH
 */
self.addEventListener('push', event => {
  console.log('[SW] Push reçu:', event.data?.text());

  if (!event.data) {
    return;
  }

  try {
    const payload = event.data.json();
    event.waitUntil(handlePushNotification(payload));
  } catch (error) {
    console.error('[SW] Erreur parsing push:', error);
  }
});

/**
 * CLICKS SUR NOTIFICATIONS
 */
self.addEventListener('notificationclick', event => {
  console.log('[SW] Click notification:', event.notification.tag);

  event.notification.close();

  event.waitUntil(
    handleNotificationClick(event.notification, event.action)
  );
});

/**
 * FERMETURE DE NOTIFICATIONS
 */
self.addEventListener('notificationclose', event => {
  console.log('[SW] Notification fermée:', event.notification.tag);

  // Enregistrer l'événement pour les analytics
  trackNotificationEvent('closed', event.notification.data);
});

/**
 * SYNCHRONISATION BACKGROUND
 */
self.addEventListener('sync', event => {
  console.log('[SW] Sync background:', event.tag);

  if (event.tag === 'medalert-sync') {
    event.waitUntil(performBackgroundSync());
  } else if (event.tag === 'medalert-analytics') {
    event.waitUntil(syncAnalytics());
  }
});

/**
 * MESSAGES DE LA PAGE
 */
self.addEventListener('message', event => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(clearAllCaches());
      break;

    case 'SYNC_NOTIFICATIONS':
      event.waitUntil(syncNotifications());
      break;

    case 'PLAY_ALERT_SOUND':
      playAlertSound(data?.priority || 'medium');
      break;

    case 'UPDATE_PREFERENCES':
      updateUserPreferences(data);
      break;

    default:
      console.warn('[SW] Type de message inconnu:', type);
  }
});

// === FONCTIONS UTILITAIRES ===

/**
 * Nettoie les anciens caches
 */
async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => !Object.values(CACHE_NAMES).includes(name));

  await Promise.all(
    oldCaches.map(cacheName => caches.delete(cacheName))
  );

  console.log(`[SW] ${oldCaches.length} anciens caches supprimés`);
}

/**
 * Initialise le service worker
 */
async function initializeServiceWorker() {
  // Vérifier l'état du réseau
  isOnline = navigator.onLine;

  // Enregistrer les événements réseau
  self.addEventListener('online', () => {
    isOnline = true;
    console.log('[SW] Connexion rétablie');
    performBackgroundSync();
  });

  self.addEventListener('offline', () => {
    isOnline = false;
    console.log('[SW] Connexion perdue');
  });

  // Démarrer la synchronisation périodique
  startPeriodicSync();
}

/**
 * Gère les requêtes API avec cache intelligent
 */
async function handleApiRequest(request) {
  const cache = await caches.open(CACHE_NAMES.api);

  if (request.method === 'GET') {
    try {
      // Stratégie: Network First avec fallback cache
      const networkResponse = await fetch(request);

      if (networkResponse.ok) {
        // Mettre en cache la réponse
        const responseClone = networkResponse.clone();
        await cache.put(request, responseClone);

        // Nettoyer le cache si nécessaire
        await cleanCache(cache, CACHE_CONFIG.maxEntries.api);
      }

      return networkResponse;

    } catch (error) {
      console.warn('[SW] Erreur réseau API, utilisation du cache:', error);

      const cachedResponse = await cache.match(request);
      if (cachedResponse) {
        // Ajouter un header pour indiquer que c'est du cache
        const response = cachedResponse.clone();
        response.headers.set('X-Cache-Status', 'from-cache');
        return response;
      }

      // Retourner une réponse d'erreur structurée
      return new Response(
        JSON.stringify({ error: 'Service temporairement indisponible', offline: true }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } else {
    // Pour les requêtes POST/PUT/DELETE, essayer le réseau uniquement
    try {
      return await fetch(request);
    } catch (error) {
      // Ajouter à la queue pour synchronisation ultérieure
      if (request.method === 'POST') {
        await queueRequest(request);
      }

      throw error;
    }
  }
}

/**
 * Gère les requêtes de ressources statiques
 */
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAMES.static);

  // Stratégie: Cache First avec Network Fallback
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;

  } catch (error) {
    // Fallback pour les pages
    if (request.destination === 'document') {
      const fallbackResponse = await cache.match('/index.html');
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }

    throw error;
  }
}

/**
 * Gère les requêtes d'images
 */
async function handleImageRequest(request) {
  const cache = await caches.open(CACHE_NAMES.images);

  // Cache First pour les images
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      await cleanCache(cache, CACHE_CONFIG.maxEntries.images);
    }

    return networkResponse;

  } catch (error) {
    // Retourner une image placeholder
    return await cache.match('/icon-192.png') || new Response('', { status: 404 });
  }
}

/**
 * Gère les requêtes audio
 */
async function handleAudioRequest(request) {
  const cache = await caches.open(CACHE_NAMES.audio);

  // Cache First pour l'audio
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;

  } catch (error) {
    console.warn('[SW] Audio non disponible:', request.url);
    return new Response('', { status: 404 });
  }
}

/**
 * Gère les notifications push
 */
async function handlePushNotification(payload) {
  const {
    title,
    body,
    icon = '/icon-192.png',
    badge = '/badge-72.png',
    tag,
    data = {},
    actions = [],
    requireInteraction = false,
    vibrate,
    sound
  } = payload;

  // Options de notification
  const options = {
    body,
    icon,
    badge,
    tag: tag || 'medalert-default',
    data: {
      ...data,
      timestamp: Date.now(),
      url: data.url || '/'
    },
    requireInteraction,
    renotify: true,
    actions: actions.slice(0, 2), // Maximum 2 actions
    vibrate: vibrate || [200, 100, 200]
  };

  // Afficher la notification
  await self.registration.showNotification(title, options);

  // Jouer le son si spécifié
  if (sound) {
    await playAlertSound(data.priority || 'medium');
  }

  // Notifier les clients actifs
  await notifyClients('notification_received', payload);

  // Enregistrer pour les analytics
  await trackNotificationEvent('received', data);
}

/**
 * Gère les clics sur notifications
 */
async function handleNotificationClick(notification, action) {
  const data = notification.data || {};
  let url = data.url || '/';

  // Traiter les actions spécifiques
  if (action) {
    switch (action) {
      case 'respond':
        url = `/alert/${data.alertId}/respond`;
        break;
      case 'view_details':
        url = `/alert/${data.alertId}`;
        break;
      case 'share_location':
        // Implémenter le partage de localisation
        await handleLocationShare(data);
        return;
      default:
        url = data.url || '/';
    }
  }

  // Ouvrir ou focuser la fenêtre
  const clients = await self.clients.matchAll({ type: 'window' });

  for (const client of clients) {
    if (client.url === url && 'focus' in client) {
      await client.focus();
      return;
    }
  }

  // Ouvrir une nouvelle fenêtre
  if (self.clients.openWindow) {
    await self.clients.openWindow(url);
  }

  // Enregistrer l'interaction
  await trackNotificationEvent('clicked', { action, ...data });
}

/**
 * Effectue une synchronisation en arrière-plan
 */
async function performBackgroundSync() {
  console.log('[SW] Synchronisation en arrière-plan...');

  try {
    // Synchroniser les requêtes en attente
    await processPendingRequests();

    // Mettre à jour les données critiques
    await updateCriticalData();

    // Nettoyer les caches expirés
    await cleanExpiredCaches();

    lastSync = Date.now();
    console.log('[SW] Synchronisation terminée');

  } catch (error) {
    console.error('[SW] Erreur synchronisation:', error);
  }
}

/**
 * Traite les requêtes en attente
 */
async function processPendingRequests() {
  const queue = [...notificationQueue];
  notificationQueue = [];

  for (const request of queue) {
    try {
      await fetch(request);
      console.log('[SW] Requête synchronisée:', request.url);
    } catch (error) {
      console.warn('[SW] Échec synchronisation requête:', error);
      notificationQueue.push(request); // Remettre en queue
    }
  }
}

/**
 * Met en queue une requête pour synchronisation ultérieure
 */
async function queueRequest(request) {
  const requestData = {
    url: request.url,
    method: request.method,
    headers: [...request.headers.entries()],
    body: await request.text()
  };

  notificationQueue.push(requestData);
  console.log('[SW] Requête mise en queue:', request.url);
}

/**
 * Nettoie un cache selon sa taille maximum
 */
async function cleanCache(cache, maxEntries) {
  const keys = await cache.keys();

  if (keys.length > maxEntries) {
    const keysToDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

/**
 * Nettoie les caches expirés
 */
async function cleanExpiredCaches() {
  const now = Date.now();

  for (const [cacheType, maxAge] of Object.entries(CACHE_CONFIG.maxAge)) {
    const cacheName = CACHE_NAMES[cacheType];
    if (!cacheName) continue;

    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const dateHeader = response.headers.get('date');
        if (dateHeader) {
          const responseDate = new Date(dateHeader).getTime();
          if (now - responseDate > maxAge) {
            await cache.delete(request);
          }
        }
      }
    }
  }
}

/**
 * Joue un son d'alerte
 */
async function playAlertSound(priority) {
  try {
    const soundFile = `/audio/${priority}-alert.mp3`;
    const audio = new Audio(soundFile);
    await audio.play();
  } catch (error) {
    console.warn('[SW] Impossible de jouer le son:', error);
  }
}

/**
 * Notifie tous les clients actifs
 */
async function notifyClients(type, data) {
  const clients = await self.clients.matchAll();

  for (const client of clients) {
    client.postMessage({ type, data });
  }
}

/**
 * Enregistre un événement de notification pour les analytics
 */
async function trackNotificationEvent(eventType, data) {
  // Stocker dans IndexedDB pour synchronisation ultérieure
  const event = {
    type: eventType,
    timestamp: Date.now(),
    data: data
  };

  // Implémenter le stockage IndexedDB
  console.log('[SW] Event tracked:', event);
}

/**
 * Utilitaires de détection de type de requête
 */
function isImageRequest(request) {
  return request.destination === 'image' ||
         /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(request.url);
}

function isAudioRequest(request) {
  return request.destination === 'audio' ||
         /\.(mp3|wav|ogg|m4a)$/i.test(request.url);
}

/**
 * Démarre la synchronisation périodique
 */
function startPeriodicSync() {
  // Synchronisation toutes les 5 minutes si en ligne
  setInterval(() => {
    if (isOnline && Date.now() - lastSync > 5 * 60 * 1000) {
      performBackgroundSync();
    }
  }, 5 * 60 * 1000);
}

/**
 * Efface tous les caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('[SW] Tous les caches effacés');
}

console.log('[SW] Service Worker MedAlert v2.1.0 chargé');