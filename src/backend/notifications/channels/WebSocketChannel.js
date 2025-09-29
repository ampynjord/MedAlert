// Canal de notification WebSocket pour communications temps réel

const WebSocket = require('ws');
const BaseChannel = require('./BaseChannel');
const { PRIORITY_LEVELS } = require('../types');

/**
 * Canal pour les notifications WebSocket en temps réel
 * Gère les connexions, les rooms et la distribution sélective
 */
class WebSocketChannel extends BaseChannel {
  constructor(config = {}) {
    super('websocket', config);

    this.server = null;
    this.clients = new Map(); // Map<websocket, clientInfo>
    this.rooms = new Map(); // Map<roomName, Set<websocket>>
    this.userSockets = new Map(); // Map<userId, Set<websocket>>

    // Configuration par défaut
    this.defaultConfig = {
      port: 8080,
      heartbeatInterval: 30000, // 30 secondes
      maxConnections: 1000,
      allowedOrigins: ['*'],
      ...config
    };

    this.heartbeatTimer = null;
    this.stats.connections = 0;
    this.stats.maxConcurrent = 0;
  }

  /**
   * Initialise le serveur WebSocket
   */
  async initialize() {
    try {
      // Créer le serveur WebSocket
      this.server = new WebSocket.Server({
        port: this.defaultConfig.port,
        verifyClient: (info) => this.verifyClient(info)
      });

      // Configurer les événements
      this.server.on('connection', (ws, request) => this.handleConnection(ws, request));
      this.server.on('error', (error) => this.handleServerError(error));

      // Démarrer le heartbeat
      this.startHeartbeat();

      console.log(`[WebSocketChannel] Serveur démarré sur le port ${this.defaultConfig.port}`);

    } catch (error) {
      console.error('[WebSocketChannel] Erreur d\'initialisation:', error);
      throw error;
    }
  }

  /**
   * Vérifie l'autorisation d'une connexion
   */
  verifyClient(info) {
    // Vérifier l'origine si configuré
    if (this.defaultConfig.allowedOrigins.length > 0 && !this.defaultConfig.allowedOrigins.includes('*')) {
      const origin = info.origin || info.req.headers.origin;
      if (!this.defaultConfig.allowedOrigins.includes(origin)) {
        console.warn(`[WebSocketChannel] Origine refusée: ${origin}`);
        return false;
      }
    }

    // Vérifier le nombre maximum de connexions
    if (this.clients.size >= this.defaultConfig.maxConnections) {
      console.warn('[WebSocketChannel] Limite de connexions atteinte');
      return false;
    }

    return true;
  }

  /**
   * Gère une nouvelle connexion
   */
  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ip: request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      connectedAt: new Date(),
      lastActivity: new Date(),
      userId: null,
      rooms: new Set(),
      subscriptions: new Set()
    };

    // Ajouter le client
    this.clients.set(ws, clientInfo);
    this.stats.connections++;
    this.stats.maxConcurrent = Math.max(this.stats.maxConcurrent, this.clients.size);

    console.log(`[WebSocketChannel] Nouvelle connexion: ${clientId} (${this.clients.size} actives)`);

    // Configurer les événements du client
    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', (code, reason) => this.handleDisconnection(ws, code, reason));
    ws.on('error', (error) => this.handleClientError(ws, error));
    ws.on('pong', () => this.handlePong(ws));

    // Envoyer un message de bienvenue
    this.sendToClient(ws, {
      type: 'connection_established',
      clientId: clientId,
      serverTime: Date.now()
    });

    this.emit('client_connected', { clientId, clientInfo });
  }

  /**
   * Gère un message reçu d'un client
   */
  handleMessage(ws, data) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) return;

    clientInfo.lastActivity = new Date();

    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'authenticate':
          this.handleAuthentication(ws, message);
          break;

        case 'subscribe':
          this.handleSubscription(ws, message);
          break;

        case 'unsubscribe':
          this.handleUnsubscription(ws, message);
          break;

        case 'join_room':
          this.handleJoinRoom(ws, message);
          break;

        case 'leave_room':
          this.handleLeaveRoom(ws, message);
          break;

        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
          break;

        default:
          console.warn(`[WebSocketChannel] Type de message inconnu: ${message.type}`);
      }

    } catch (error) {
      console.error('[WebSocketChannel] Erreur parsing message:', error);
      this.sendToClient(ws, {
        type: 'error',
        message: 'Format de message invalide'
      });
    }
  }

  /**
   * Gère l'authentification d'un client
   */
  handleAuthentication(ws, message) {
    const clientInfo = this.clients.get(ws);
    const { userId, token } = message;

    // Valider le token (à implémenter selon votre système d'auth)
    if (this.validateAuthToken(userId, token)) {
      clientInfo.userId = userId;

      // Ajouter à la map des utilisateurs
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(ws);

      this.sendToClient(ws, {
        type: 'authentication_success',
        userId: userId
      });

      console.log(`[WebSocketChannel] Client ${clientInfo.id} authentifié: ${userId}`);

    } else {
      this.sendToClient(ws, {
        type: 'authentication_failed',
        message: 'Token invalide'
      });
    }
  }

  /**
   * Gère l'abonnement à des types de notifications
   */
  handleSubscription(ws, message) {
    const clientInfo = this.clients.get(ws);
    const { subscriptions } = message;

    if (Array.isArray(subscriptions)) {
      subscriptions.forEach(sub => clientInfo.subscriptions.add(sub));

      this.sendToClient(ws, {
        type: 'subscription_success',
        subscriptions: Array.from(clientInfo.subscriptions)
      });
    }
  }

  /**
   * Gère le désabonnement
   */
  handleUnsubscription(ws, message) {
    const clientInfo = this.clients.get(ws);
    const { subscriptions } = message;

    if (Array.isArray(subscriptions)) {
      subscriptions.forEach(sub => clientInfo.subscriptions.delete(sub));

      this.sendToClient(ws, {
        type: 'unsubscription_success',
        subscriptions: Array.from(clientInfo.subscriptions)
      });
    }
  }

  /**
   * Gère l'entrée dans une room
   */
  handleJoinRoom(ws, message) {
    const clientInfo = this.clients.get(ws);
    const { room } = message;

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }

    this.rooms.get(room).add(ws);
    clientInfo.rooms.add(room);

    this.sendToClient(ws, {
      type: 'room_joined',
      room: room,
      memberCount: this.rooms.get(room).size
    });

    console.log(`[WebSocketChannel] Client ${clientInfo.id} rejoint la room '${room}'`);
  }

  /**
   * Gère la sortie d'une room
   */
  handleLeaveRoom(ws, message) {
    const clientInfo = this.clients.get(ws);
    const { room } = message;

    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(ws);
      clientInfo.rooms.delete(room);

      // Supprimer la room si vide
      if (this.rooms.get(room).size === 0) {
        this.rooms.delete(room);
      }

      this.sendToClient(ws, {
        type: 'room_left',
        room: room
      });
    }
  }

  /**
   * Gère la déconnexion d'un client
   */
  handleDisconnection(ws, code, reason) {
    const clientInfo = this.clients.get(ws);
    if (!clientInfo) return;

    console.log(`[WebSocketChannel] Déconnexion: ${clientInfo.id} (code: ${code})`);

    // Supprimer des rooms
    clientInfo.rooms.forEach(room => {
      if (this.rooms.has(room)) {
        this.rooms.get(room).delete(ws);
        if (this.rooms.get(room).size === 0) {
          this.rooms.delete(room);
        }
      }
    });

    // Supprimer de la map des utilisateurs
    if (clientInfo.userId && this.userSockets.has(clientInfo.userId)) {
      this.userSockets.get(clientInfo.userId).delete(ws);
      if (this.userSockets.get(clientInfo.userId).size === 0) {
        this.userSockets.delete(clientInfo.userId);
      }
    }

    // Supprimer le client
    this.clients.delete(ws);

    this.emit('client_disconnected', { clientId: clientInfo.id, code, reason });
  }

  /**
   * Envoie une notification WebSocket
   */
  async send(content, options = {}) {
    const {
      userId = null,
      room = null,
      subscription = null,
      priority = PRIORITY_LEVELS.MEDIUM
    } = options;

    // Déterminer les clients cibles
    let targetClients = [];

    if (userId) {
      // Envoyer à un utilisateur spécifique
      if (this.userSockets.has(userId)) {
        targetClients = Array.from(this.userSockets.get(userId));
      }
    } else if (room) {
      // Envoyer à une room
      if (this.rooms.has(room)) {
        targetClients = Array.from(this.rooms.get(room));
      }
    } else if (subscription) {
      // Envoyer à tous les clients abonnés
      targetClients = Array.from(this.clients.keys()).filter(ws => {
        const clientInfo = this.clients.get(ws);
        return clientInfo && clientInfo.subscriptions.has(subscription);
      });
    } else {
      // Broadcast à tous les clients
      targetClients = Array.from(this.clients.keys());
    }

    if (targetClients.length === 0) {
      throw new Error('Aucun client WebSocket trouvé pour les critères spécifiés');
    }

    console.log(`[WebSocketChannel] Envoi vers ${targetClients.length} clients`);

    // Préparer le message
    const message = {
      ...content,
      priority,
      timestamp: Date.now(),
      type: content.type || 'notification'
    };

    // Envoyer à tous les clients cibles
    const results = await Promise.allSettled(
      targetClients.map(ws => this.sendToClient(ws, message))
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;

    return {
      totalClients: targetClients.length,
      successful,
      failed,
      details: results.map((result, index) => ({
        client: this.clients.get(targetClients[index])?.id,
        success: result.status === 'fulfilled',
        error: result.status === 'rejected' ? result.reason.message : null
      }))
    };
  }

  /**
   * Envoie un message à un client spécifique
   */
  sendToClient(ws, message) {
    return new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Connexion WebSocket fermée'));
        return;
      }

      try {
        ws.send(JSON.stringify(message), (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Diffuse un message à tous les clients d'une room
   */
  async broadcastToRoom(room, message) {
    if (!this.rooms.has(room)) {
      return { successful: 0, failed: 0 };
    }

    const clients = Array.from(this.rooms.get(room));
    return await this.send(message, { room });
  }

  /**
   * Démarre le système de heartbeat
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();

      for (const [ws, clientInfo] of this.clients) {
        // Vérifier l'inactivité (2x l'intervalle de heartbeat)
        if (now - clientInfo.lastActivity.getTime() > this.defaultConfig.heartbeatInterval * 2) {
          console.log(`[WebSocketChannel] Client inactif détecté: ${clientInfo.id}`);
          ws.terminate();
          continue;
        }

        // Envoyer un ping
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }
    }, this.defaultConfig.heartbeatInterval);
  }

  /**
   * Gère la réception d'un pong
   */
  handlePong(ws) {
    const clientInfo = this.clients.get(ws);
    if (clientInfo) {
      clientInfo.lastActivity = new Date();
    }
  }

  /**
   * Valide un token d'authentification
   */
  validateAuthToken(userId, token) {
    // Implémentation basique - à remplacer par votre système d'auth
    return token && token.length > 10;
  }

  /**
   * Gère les erreurs serveur
   */
  handleServerError(error) {
    console.error('[WebSocketChannel] Erreur serveur:', error);
    this.emit('server_error', error);
  }

  /**
   * Gère les erreurs client
   */
  handleClientError(ws, error) {
    const clientInfo = this.clients.get(ws);
    console.error(`[WebSocketChannel] Erreur client ${clientInfo?.id}:`, error);
  }

  /**
   * Génère un ID unique pour un client
   */
  generateClientId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Statistiques détaillées du canal
   */
  getDetailedStats() {
    const base = super.healthCheck();

    const roomStats = {};
    for (const [roomName, clients] of this.rooms) {
      roomStats[roomName] = clients.size;
    }

    return {
      ...base,
      server: {
        running: this.server !== null,
        port: this.defaultConfig.port
      },
      connections: {
        active: this.clients.size,
        maxConcurrent: this.stats.maxConcurrent,
        total: this.stats.connections
      },
      rooms: {
        count: this.rooms.size,
        stats: roomStats
      },
      users: {
        authenticated: this.userSockets.size
      }
    };
  }

  /**
   * Configuration publique
   */
  getPublicConfig() {
    return {
      port: this.defaultConfig.port,
      maxConnections: this.defaultConfig.maxConnections,
      heartbeatInterval: this.defaultConfig.heartbeatInterval
    };
  }

  /**
   * Nettoyage des ressources
   */
  async cleanup() {
    // Arrêter le heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Fermer toutes les connexions
    for (const ws of this.clients.keys()) {
      ws.terminate();
    }

    // Fermer le serveur
    if (this.server) {
      this.server.close();
    }

    // Nettoyer les maps
    this.clients.clear();
    this.rooms.clear();
    this.userSockets.clear();

    await super.cleanup();
  }
}

module.exports = WebSocketChannel;