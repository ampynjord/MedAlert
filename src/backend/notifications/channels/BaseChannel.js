// Classe de base pour tous les canaux de notification

const EventEmitter = require('events');
const { NOTIFICATION_STATUS } = require('../types');

/**
 * Classe de base abstraite pour tous les canaux de notification
 */
class BaseChannel extends EventEmitter {
  constructor(name, config = {}) {
    super();
    this.name = name;
    this.config = config;
    this.isActive = false;
    this.stats = {
      sent: 0,
      delivered: 0,
      failed: 0,
      lastActivity: null
    };
    this.retryQueue = new Map();
  }

  /**
   * Initialise le canal (à surcharger)
   */
  async initialize() {
    throw new Error('La méthode initialize() doit être implémentée par les classes dérivées');
  }

  /**
   * Envoie une notification (à surcharger)
   */
  async send(content, options = {}) {
    throw new Error('La méthode send() doit être implémentée par les classes dérivées');
  }

  /**
   * Valide le contenu avant envoi (à surcharger si nécessaire)
   */
  validateContent(content) {
    if (!content) {
      throw new Error('Le contenu de la notification est requis');
    }
    return true;
  }

  /**
   * Gère l'envoi avec retry automatique
   */
  async sendWithRetry(content, options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      userId = null,
      priority = 'medium'
    } = options;

    let lastError;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        this.validateContent(content);
        const result = await this.send(content, options);

        // Succès
        this.updateStats('sent');
        this.emit('notification_sent', {
          channel: this.name,
          content,
          result,
          attempt,
          userId
        });

        return result;

      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt <= maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Backoff exponentiel
          await this.sleep(delay);
        }
      }
    }

    // Échec final
    this.updateStats('failed');
    this.emit('notification_failed', {
      channel: this.name,
      content,
      error: lastError,
      attempts: attempt,
      userId
    });

    throw lastError;
  }

  /**
   * Met à jour les statistiques du canal
   */
  updateStats(type) {
    this.stats[type]++;
    this.stats.lastActivity = new Date();
  }

  /**
   * Marque une notification comme délivrée
   */
  markAsDelivered(notificationId, data = {}) {
    this.updateStats('delivered');
    this.emit('notification_delivered', {
      channel: this.name,
      notificationId,
      ...data
    });
  }

  /**
   * Active le canal
   */
  async activate() {
    if (!this.isActive) {
      await this.initialize();
      this.isActive = true;
      this.emit('channel_activated', { channel: this.name });
    }
  }

  /**
   * Désactive le canal
   */
  async deactivate() {
    if (this.isActive) {
      this.isActive = false;
      this.emit('channel_deactivated', { channel: this.name });
    }
  }

  /**
   * Vérifie la santé du canal
   */
  async healthCheck() {
    return {
      name: this.name,
      isActive: this.isActive,
      stats: this.stats,
      config: this.getPublicConfig(),
      lastCheck: new Date()
    };
  }

  /**
   * Retourne la configuration publique (sans secrets)
   */
  getPublicConfig() {
    // À surcharger pour filtrer les informations sensibles
    return { ...this.config };
  }

  /**
   * Utilitaire pour attendre
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Formate les erreurs pour le logging
   */
  formatError(error) {
    return {
      message: error.message,
      code: error.code,
      status: error.status || error.statusCode,
      stack: this.config.debug ? error.stack : undefined
    };
  }

  /**
   * Nettoyage des ressources
   */
  async cleanup() {
    this.retryQueue.clear();
    this.removeAllListeners();
  }
}

module.exports = BaseChannel;