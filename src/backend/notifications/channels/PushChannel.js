// Canal de notification Web Push avec gestion avancée

const webpush = require('web-push');
const BaseChannel = require('./BaseChannel');
const { NOTIFICATION_STATUS } = require('../types');

/**
 * Canal pour les notifications Web Push
 * Gère les abonnements, la délivrance et la compatibilité multi-navigateur
 */
class PushChannel extends BaseChannel {
  constructor(config = {}) {
    super('push', config);

    this.vapidKeys = null;
    this.subscriptions = new Map(); // Cache des abonnements actifs
    this.pendingSubscriptions = new Set(); // Abonnements en cours de validation

    // Configuration par défaut
    this.defaultOptions = {
      TTL: 60 * 60 * 24, // 24 heures
      urgency: 'normal',
      gcmAPIKey: config.gcmAPIKey,
      ...config.defaultOptions
    };
  }

  /**
   * Initialise le canal Web Push
   */
  async initialize() {
    try {
      // Charger les clés VAPID
      await this.loadVapidKeys();

      // Configurer web-push
      webpush.setVapidDetails(
        this.config.vapidSubject || 'mailto:admin@medalert.com',
        this.vapidKeys.publicKey,
        this.vapidKeys.privateKey
      );

      if (this.config.gcmAPIKey) {
        webpush.setGCMAPIKey(this.config.gcmAPIKey);
      }

      // Charger les abonnements existants
      await this.loadSubscriptions();

      // Nettoyer les abonnements expirés
      await this.cleanupExpiredSubscriptions();

      console.log(`[PushChannel] Initialisé avec ${this.subscriptions.size} abonnements`);

    } catch (error) {
      console.error('[PushChannel] Erreur d\'initialisation:', error);
      throw error;
    }
  }

  /**
   * Charge les clés VAPID
   */
  async loadVapidKeys() {
    if (this.config.vapidKeys) {
      this.vapidKeys = this.config.vapidKeys;
    } else if (this.config.vapidKeysPath) {
      const fs = require('fs').promises;
      const vapidData = await fs.readFile(this.config.vapidKeysPath, 'utf8');
      this.vapidKeys = JSON.parse(vapidData);
    } else {
      throw new Error('Clés VAPID non configurées');
    }

    if (!this.vapidKeys.publicKey || !this.vapidKeys.privateKey) {
      throw new Error('Clés VAPID invalides');
    }
  }

  /**
   * Charge les abonnements depuis la base de données
   */
  async loadSubscriptions() {
    return new Promise((resolve, reject) => {
      if (!this.config.database) {
        resolve();
        return;
      }

      const query = `
        SELECT id, user_id, endpoint, auth_keys, created_at, last_used
        FROM subscriptions
        WHERE channel_type = 'push' AND is_active = 1
      `;

      this.config.database.all(query, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        rows.forEach(row => {
          try {
            const subscription = {
              id: row.id,
              userId: row.user_id,
              endpoint: row.endpoint,
              keys: JSON.parse(row.auth_keys),
              createdAt: new Date(row.created_at),
              lastUsed: row.last_used ? new Date(row.last_used) : null
            };

            this.subscriptions.set(row.endpoint, subscription);
          } catch (parseError) {
            console.warn('[PushChannel] Abonnement invalide ignoré:', row.id, parseError);
          }
        });

        resolve();
      });
    });
  }

  /**
   * Envoie une notification push
   */
  async send(content, options = {}) {
    const {
      userId = null,
      urgency = 'normal',
      TTL = this.defaultOptions.TTL,
      badge,
      topic
    } = options;

    // Déterminer les abonnements cibles
    const targetSubscriptions = userId
      ? this.getSubscriptionsForUser(userId)
      : Array.from(this.subscriptions.values());

    if (targetSubscriptions.length === 0) {
      throw new Error('Aucun abonnement push trouvé');
    }

    console.log(`[PushChannel] Envoi vers ${targetSubscriptions.length} abonnements`);

    // Préparer le payload
    const payload = JSON.stringify({
      ...content,
      timestamp: Date.now(),
      medalert: true
    });

    // Options de push
    const pushOptions = {
      TTL,
      urgency,
      ...this.defaultOptions
    };

    if (badge) pushOptions.badge = badge;
    if (topic) pushOptions.topic = topic;

    // Envoyer à tous les abonnements
    const results = await Promise.allSettled(
      targetSubscriptions.map(subscription =>
        this.sendToSubscription(subscription, payload, pushOptions)
      )
    );

    // Analyser les résultats
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;

    // Traiter les échecs pour nettoyer les abonnements invalides
    await this.processFailedNotifications(results, targetSubscriptions);

    return {
      totalSubscriptions: targetSubscriptions.length,
      successful,
      failed,
      details: results.map((result, index) => ({
        subscription: targetSubscriptions[index].endpoint,
        success: result.status === 'fulfilled',
        error: result.status === 'rejected' ? result.reason.message : null
      }))
    };
  }

  /**
   * Envoie à un abonnement spécifique
   */
  async sendToSubscription(subscription, payload, options) {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys
    };

    try {
      const result = await webpush.sendNotification(pushSubscription, payload, options);

      // Mettre à jour la date de dernière utilisation
      await this.updateSubscriptionLastUsed(subscription.id);

      return result;
    } catch (error) {
      // Logger l'erreur avec le contexte
      console.warn(`[PushChannel] Échec envoi vers ${subscription.endpoint}:`, error.message);
      throw error;
    }
  }

  /**
   * Traite les notifications échouées
   */
  async processFailedNotifications(results, subscriptions) {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const subscription = subscriptions[i];

      if (result.status === 'rejected') {
        const error = result.reason;

        // Codes d'erreur indiquant un abonnement invalide/expiré
        if (error.statusCode === 410 || // Gone
            error.statusCode === 404 || // Not Found
            error.statusCode === 400) { // Bad Request

          console.log(`[PushChannel] Suppression abonnement expiré: ${subscription.endpoint}`);
          await this.removeSubscription(subscription.endpoint);
        }
      }
    }
  }

  /**
   * Ajoute un nouvel abonnement
   */
  async addSubscription(subscriptionData, userId = null) {
    const { endpoint, keys } = subscriptionData;

    // Vérifier si l'abonnement existe déjà
    if (this.subscriptions.has(endpoint)) {
      console.log('[PushChannel] Abonnement déjà existant:', endpoint);
      return false;
    }

    // Valider l'abonnement
    if (!this.validateSubscription(subscriptionData)) {
      throw new Error('Abonnement invalide');
    }

    try {
      // Sauvegarder en base de données
      const subscriptionId = await this.saveSubscriptionToDatabase(subscriptionData, userId);

      // Ajouter au cache
      const subscription = {
        id: subscriptionId,
        userId,
        endpoint,
        keys,
        createdAt: new Date(),
        lastUsed: null
      };

      this.subscriptions.set(endpoint, subscription);

      console.log(`[PushChannel] Nouvel abonnement ajouté: ${endpoint}`);

      // Envoyer une notification de bienvenue
      await this.sendWelcomeNotification(subscription);

      return true;
    } catch (error) {
      console.error('[PushChannel] Erreur ajout abonnement:', error);
      throw error;
    }
  }

  /**
   * Supprime un abonnement
   */
  async removeSubscription(endpoint) {
    if (!this.subscriptions.has(endpoint)) {
      return false;
    }

    try {
      // Supprimer de la base de données
      await this.removeSubscriptionFromDatabase(endpoint);

      // Supprimer du cache
      this.subscriptions.delete(endpoint);

      console.log(`[PushChannel] Abonnement supprimé: ${endpoint}`);
      return true;
    } catch (error) {
      console.error('[PushChannel] Erreur suppression abonnement:', error);
      throw error;
    }
  }

  /**
   * Valide un abonnement
   */
  validateSubscription(subscription) {
    return subscription &&
           typeof subscription.endpoint === 'string' &&
           subscription.endpoint.length > 0 &&
           subscription.keys &&
           typeof subscription.keys.p256dh === 'string' &&
           typeof subscription.keys.auth === 'string';
  }

  /**
   * Sauvegarde un abonnement en base
   */
  async saveSubscriptionToDatabase(subscription, userId) {
    if (!this.config.database) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscriptions (user_id, channel_type, endpoint, auth_keys, created_at, is_active)
        VALUES (?, 'push', ?, ?, datetime('now'), 1)
      `;

      const authKeys = JSON.stringify(subscription.keys);

      this.config.database.run(query, [userId, subscription.endpoint, authKeys], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Supprime un abonnement de la base
   */
  async removeSubscriptionFromDatabase(endpoint) {
    if (!this.config.database) {
      return;
    }

    return new Promise((resolve, reject) => {
      const query = `UPDATE subscriptions SET is_active = 0 WHERE endpoint = ?`;

      this.config.database.run(query, [endpoint], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Met à jour la date de dernière utilisation
   */
  async updateSubscriptionLastUsed(subscriptionId) {
    if (!this.config.database || !subscriptionId) {
      return;
    }

    return new Promise((resolve, reject) => {
      const query = `UPDATE subscriptions SET last_used = datetime('now') WHERE id = ?`;

      this.config.database.run(query, [subscriptionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Récupère les abonnements pour un utilisateur
   */
  getSubscriptionsForUser(userId) {
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.userId === userId || sub.userId === userId.toString());
  }

  /**
   * Nettoie les abonnements expirés
   */
  async cleanupExpiredSubscriptions() {
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 jours
    const now = Date.now();
    const toRemove = [];

    for (const [endpoint, subscription] of this.subscriptions) {
      const lastActivity = subscription.lastUsed || subscription.createdAt;
      if (now - lastActivity.getTime() > maxAge) {
        toRemove.push(endpoint);
      }
    }

    for (const endpoint of toRemove) {
      await this.removeSubscription(endpoint);
    }

    if (toRemove.length > 0) {
      console.log(`[PushChannel] Nettoyage: ${toRemove.length} abonnements expirés supprimés`);
    }
  }

  /**
   * Envoie une notification de bienvenue
   */
  async sendWelcomeNotification(subscription) {
    try {
      const welcomeContent = {
        title: '🎉 Notifications MedAlert Activées',
        body: 'Vous recevrez maintenant les alertes médicales en temps réel.',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'medalert-welcome',
        data: {
          type: 'welcome',
          timestamp: Date.now()
        }
      };

      await this.sendToSubscription(
        subscription,
        JSON.stringify(welcomeContent),
        { urgency: 'low', TTL: 60 * 60 }
      );
    } catch (error) {
      console.warn('[PushChannel] Impossible d\'envoyer la notification de bienvenue:', error);
    }
  }

  /**
   * Statistiques détaillées du canal
   */
  getDetailedStats() {
    const base = this.healthCheck();

    return {
      ...base,
      subscriptions: {
        total: this.subscriptions.size,
        byUser: this.getSubscriptionsByUser(),
        recent: this.getRecentSubscriptions(7) // 7 derniers jours
      },
      vapidKeys: {
        configured: !!this.vapidKeys,
        publicKey: this.vapidKeys ? this.vapidKeys.publicKey.substring(0, 20) + '...' : null
      }
    };
  }

  /**
   * Récupère les abonnements par utilisateur
   */
  getSubscriptionsByUser() {
    const byUser = {};
    for (const subscription of this.subscriptions.values()) {
      const userId = subscription.userId || 'anonymous';
      byUser[userId] = (byUser[userId] || 0) + 1;
    }
    return byUser;
  }

  /**
   * Récupère les abonnements récents
   */
  getRecentSubscriptions(days) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return Array.from(this.subscriptions.values())
      .filter(sub => sub.createdAt > cutoff)
      .length;
  }

  /**
   * Configuration publique (sans clés privées)
   */
  getPublicConfig() {
    return {
      vapidSubject: this.config.vapidSubject,
      publicKey: this.vapidKeys ? this.vapidKeys.publicKey : null,
      defaultTTL: this.defaultOptions.TTL,
      gcmConfigured: !!this.config.gcmAPIKey
    };
  }

  /**
   * Nettoyage des ressources
   */
  async cleanup() {
    this.subscriptions.clear();
    this.pendingSubscriptions.clear();
    await super.cleanup();
  }
}

module.exports = PushChannel;