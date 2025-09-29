// Gestionnaire central des notifications MedAlert

const EventEmitter = require('events');
const { NOTIFICATION_CHANNELS, PRIORITY_LEVELS, NOTIFICATION_STATUS, ALERT_TYPES } = require('./types');
const AlertTemplateEngine = require('./templates/alertTemplates');

/**
 * Gestionnaire central pour toutes les notifications MedAlert
 * Gère la distribution multi-canal, les priorités et les analytics
 */
class NotificationManager extends EventEmitter {
  constructor(database, logger = console) {
    super();
    this.db = database;
    this.logger = logger;
    this.channels = new Map();
    this.activeNotifications = new Map();
    this.analytics = {
      sent: 0,
      delivered: 0,
      failed: 0,
      byChannel: {},
      byPriority: {}
    };

    // Initialiser les analytics par canal
    Object.values(NOTIFICATION_CHANNELS).forEach(channel => {
      this.analytics.byChannel[channel] = { sent: 0, delivered: 0, failed: 0 };
    });

    // Initialiser les analytics par priorité
    Object.values(PRIORITY_LEVELS).forEach(priority => {
      this.analytics.byPriority[priority] = { sent: 0, delivered: 0, failed: 0 };
    });

    this.logger.info('NotificationManager initialisé');
  }

  /**
   * Enregistre un canal de notification
   */
  registerChannel(channelType, channelInstance) {
    if (!Object.values(NOTIFICATION_CHANNELS).includes(channelType)) {
      throw new Error(`Type de canal invalide: ${channelType}`);
    }

    this.channels.set(channelType, channelInstance);
    this.logger.info(`Canal ${channelType} enregistré`);

    // Écouter les événements du canal
    channelInstance.on('notification_sent', (data) => {
      this.handleNotificationSent(channelType, data);
    });

    channelInstance.on('notification_delivered', (data) => {
      this.handleNotificationDelivered(channelType, data);
    });

    channelInstance.on('notification_failed', (data) => {
      this.handleNotificationFailed(channelType, data);
    });
  }

  /**
   * Envoie une notification sur tous les canaux appropriés
   */
  async sendNotification(alert, options = {}) {
    const {
      priority = this.determinePriority(alert),
      channels = null, // null = tous les canaux actifs
      userId = null,
      skipAnalytics = false
    } = options;

    const notificationId = this.generateNotificationId();
    const timestamp = Date.now();

    this.logger.info(`Envoi notification ${notificationId} pour alerte ${alert.id}`);

    // Déterminer les canaux à utiliser
    const targetChannels = channels || await this.getActiveChannelsForUser(userId);

    // Créer l'entrée de suivi
    const notification = {
      id: notificationId,
      alertId: alert.id,
      priority: priority,
      channels: targetChannels,
      timestamp: timestamp,
      status: NOTIFICATION_STATUS.PENDING,
      results: {}
    };

    this.activeNotifications.set(notificationId, notification);

    // Envoyer sur chaque canal
    const sendPromises = targetChannels.map(async (channelType) => {
      const channel = this.channels.get(channelType);
      if (!channel) {
        this.logger.warn(`Canal ${channelType} non disponible`);
        return { channelType, success: false, error: 'Canal non disponible' };
      }

      try {
        // Générer le contenu spécifique au canal
        const content = this.generateChannelContent(alert, channelType, priority);

        // Envoyer la notification
        const result = await channel.send(content, { userId, priority });

        // Enregistrer en base de données
        if (!skipAnalytics) {
          await this.recordNotification(notificationId, alert.id, userId, channelType, NOTIFICATION_STATUS.SENT);
        }

        return { channelType, success: true, result };
      } catch (error) {
        this.logger.error(`Erreur envoi ${channelType}:`, error);

        if (!skipAnalytics) {
          await this.recordNotification(notificationId, alert.id, userId, channelType, NOTIFICATION_STATUS.FAILED, error.message);
        }

        return { channelType, success: false, error: error.message };
      }
    });

    // Attendre tous les envois
    const results = await Promise.allSettled(sendPromises);

    // Mettre à jour le statut global
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    notification.status = successCount > 0 ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.FAILED;
    notification.results = results;

    // Émettre l'événement global
    this.emit('notification_processed', {
      notificationId,
      alertId: alert.id,
      priority,
      channelsUsed: targetChannels.length,
      successCount,
      results
    });

    // Mettre à jour les analytics
    if (!skipAnalytics) {
      this.updateAnalytics(priority, targetChannels, successCount);
    }

    return {
      notificationId,
      success: successCount > 0,
      channelsUsed: targetChannels.length,
      successCount,
      results: results.map(r => r.value || r.reason)
    };
  }

  /**
   * Envoie des notifications en lot pour plusieurs utilisateurs
   */
  async sendBulkNotifications(alert, userIds, options = {}) {
    const bulkId = this.generateNotificationId();
    this.logger.info(`Envoi bulk ${bulkId} pour ${userIds.length} utilisateurs`);

    const bulkPromises = userIds.map(userId =>
      this.sendNotification(alert, { ...options, userId })
    );

    const results = await Promise.allSettled(bulkPromises);

    this.emit('bulk_notification_completed', {
      bulkId,
      alertId: alert.id,
      userCount: userIds.length,
      results
    });

    return {
      bulkId,
      userCount: userIds.length,
      results: results.map(r => r.value || r.reason)
    };
  }

  /**
   * Génère le contenu spécifique à chaque canal
   */
  generateChannelContent(alert, channelType, priority) {
    switch (channelType) {
      case NOTIFICATION_CHANNELS.PUSH:
        return AlertTemplateEngine.generatePushNotification(alert, priority);

      case NOTIFICATION_CHANNELS.DISCORD:
        return AlertTemplateEngine.generateDiscordEmbed(alert, priority);

      case NOTIFICATION_CHANNELS.EMAIL:
        return AlertTemplateEngine.generateEmailTemplate(alert, priority);

      case NOTIFICATION_CHANNELS.WEBSOCKET:
        return AlertTemplateEngine.generateWebSocketNotification(alert, priority);

      default:
        throw new Error(`Canal non supporté: ${channelType}`);
    }
  }

  /**
   * Détermine automatiquement la priorité d'une alerte
   */
  determinePriority(alert) {
    const message = (alert.originalMessage || '').toLowerCase();

    // Mots-clés critiques
    if (/urgent|critique|mort|décès|inconscient|arrêt|hémorragie/i.test(message)) {
      return PRIORITY_LEVELS.CRITICAL;
    }

    // Mots-clés haute priorité
    if (/évacuation|blessure grave|accident|secours|immédiat/i.test(message)) {
      return PRIORITY_LEVELS.HIGH;
    }

    // Mots-clés priorité normale
    if (/médecin|soins|assistance|aide/i.test(message)) {
      return PRIORITY_LEVELS.MEDIUM;
    }

    // Type d'alerte spécifique
    if (alert.type === ALERT_TYPES.EMERGENCY) return PRIORITY_LEVELS.CRITICAL;
    if (alert.type === ALERT_TYPES.EVACUATION) return PRIORITY_LEVELS.HIGH;
    if (alert.type === ALERT_TYPES.MAINTENANCE) return PRIORITY_LEVELS.LOW;
    if (alert.type === ALERT_TYPES.TRAINING) return PRIORITY_LEVELS.INFO;

    return PRIORITY_LEVELS.MEDIUM;
  }

  /**
   * Récupère les canaux actifs pour un utilisateur
   */
  async getActiveChannelsForUser(userId = null) {
    if (!userId) {
      // Retourner tous les canaux disponibles si pas d'utilisateur spécifique
      return Array.from(this.channels.keys());
    }

    try {
      // Récupérer les préférences utilisateur depuis la base
      const preferences = await this.getUserNotificationPreferences(userId);
      return preferences.activeChannels || Array.from(this.channels.keys());
    } catch (error) {
      this.logger.warn(`Impossible de récupérer les préférences pour ${userId}:`, error);
      return Array.from(this.channels.keys());
    }
  }

  /**
   * Récupère les préférences de notification d'un utilisateur
   */
  async getUserNotificationPreferences(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT notification_preferences
        FROM users
        WHERE id = ? OR discord_id = ? OR username = ?
      `;

      this.db.get(query, [userId, userId, userId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          // Préférences par défaut
          resolve({
            activeChannels: Array.from(this.channels.keys()),
            quietHours: { start: '22:00', end: '08:00' },
            priorityThreshold: PRIORITY_LEVELS.LOW
          });
          return;
        }

        try {
          const preferences = JSON.parse(row.notification_preferences || '{}');
          resolve(preferences);
        } catch (parseError) {
          reject(parseError);
        }
      });
    });
  }

  /**
   * Enregistre une notification dans l'historique
   */
  async recordNotification(notificationId, alertId, userId, channel, status, error = null) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_history
        (notification_id, alert_id, user_id, channel_type, status, sent_at, error_message)
        VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
      `;

      this.db.run(query, [notificationId, alertId, userId, channel, status, error], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Met à jour les analytics
   */
  updateAnalytics(priority, channels, successCount) {
    this.analytics.sent += channels.length;
    this.analytics.delivered += successCount;
    this.analytics.failed += (channels.length - successCount);

    // Analytics par priorité
    this.analytics.byPriority[priority].sent += channels.length;
    this.analytics.byPriority[priority].delivered += successCount;
    this.analytics.byPriority[priority].failed += (channels.length - successCount);

    // Analytics par canal
    channels.forEach(channel => {
      this.analytics.byChannel[channel].sent += 1;
    });
  }

  /**
   * Gestionnaires d'événements des canaux
   */
  handleNotificationSent(channelType, data) {
    this.logger.debug(`Notification envoyée via ${channelType}:`, data);
    this.emit('channel_notification_sent', { channel: channelType, ...data });
  }

  handleNotificationDelivered(channelType, data) {
    this.logger.debug(`Notification délivrée via ${channelType}:`, data);
    this.analytics.byChannel[channelType].delivered += 1;
    this.emit('channel_notification_delivered', { channel: channelType, ...data });
  }

  handleNotificationFailed(channelType, data) {
    this.logger.warn(`Échec notification via ${channelType}:`, data);
    this.analytics.byChannel[channelType].failed += 1;
    this.emit('channel_notification_failed', { channel: channelType, ...data });
  }

  /**
   * Utilitaires
   */
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Récupère les statistiques en temps réel
   */
  getAnalytics() {
    return {
      ...this.analytics,
      activeNotifications: this.activeNotifications.size,
      registeredChannels: Array.from(this.channels.keys()),
      uptime: process.uptime()
    };
  }

  /**
   * Nettoyage des notifications anciennes
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 heures

    for (const [id, notification] of this.activeNotifications) {
      if (now - notification.timestamp > maxAge) {
        this.activeNotifications.delete(id);
      }
    }

    this.logger.info(`Nettoyage: ${this.activeNotifications.size} notifications actives`);
  }
}

module.exports = NotificationManager;