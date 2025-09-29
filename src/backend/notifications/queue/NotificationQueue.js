// Système de queue des notifications avec retry logic et priorité

const EventEmitter = require('events');
const { PRIORITY_LEVELS, NOTIFICATION_STATUS } = require('../types');

/**
 * Gestionnaire de queue des notifications avec retry automatique
 * Prend en charge les priorités, la planification et la gestion des échecs
 */
class NotificationQueue extends EventEmitter {
  constructor(config = {}) {
    super();

    this.database = config.database;
    this.notificationManager = config.notificationManager;

    // Configuration par défaut
    this.config = {
      maxRetries: 3,
      retryDelays: [1000, 5000, 15000], // 1s, 5s, 15s
      batchSize: 10,
      processingInterval: 2000,
      maxProcessingTime: 30000, // 30 secondes max par notification
      priorityWeights: {
        [PRIORITY_LEVELS.CRITICAL]: 1,
        [PRIORITY_LEVELS.HIGH]: 2,
        [PRIORITY_LEVELS.MEDIUM]: 3,
        [PRIORITY_LEVELS.LOW]: 4,
        [PRIORITY_LEVELS.INFO]: 5
      },
      ...config
    };

    // État du processeur
    this.isProcessing = false;
    this.processingTimer = null;
    this.activeJobs = new Map(); // Map<jobId, { startTime, timeout }>

    // Statistiques
    this.stats = {
      processed: 0,
      successful: 0,
      failed: 0,
      retried: 0,
      currentQueueSize: 0
    };
  }

  /**
   * Initialise la queue
   */
  async initialize() {
    try {
      // Créer la table si nécessaire (sera fait par les migrations)
      console.log('[NotificationQueue] Initialisation...');

      // Récupérer les notifications en attente
      await this.loadPendingNotifications();

      // Démarrer le processeur
      this.startProcessor();

      // Nettoyer les jobs orphelins
      await this.cleanupOrphanedJobs();

      console.log(`[NotificationQueue] Initialisé avec ${this.stats.currentQueueSize} notifications en attente`);

    } catch (error) {
      console.error('[NotificationQueue] Erreur d\'initialisation:', error);
      throw error;
    }
  }

  /**
   * Ajoute une notification à la queue
   */
  async enqueue(alertId, userId, channelType, priority, payload, options = {}) {
    const notificationId = this.generateNotificationId();
    const scheduledAt = options.delay ? new Date(Date.now() + options.delay) : new Date();

    const queueItem = {
      notification_id: notificationId,
      alert_id: alertId,
      user_id: userId,
      channel_type: channelType,
      priority: priority,
      scheduled_at: scheduledAt.toISOString(),
      status: NOTIFICATION_STATUS.PENDING,
      retry_count: 0,
      max_retries: options.maxRetries || this.config.maxRetries,
      payload: JSON.stringify(payload),
      created_at: new Date().toISOString()
    };

    try {
      await this.saveToDatabase(queueItem);
      this.stats.currentQueueSize++;

      console.log(`[NotificationQueue] Notification mise en queue: ${notificationId} (${channelType}, ${priority})`);

      // Déclencher le traitement si pas déjà en cours
      if (!this.isProcessing) {
        this.processQueue();
      }

      return notificationId;

    } catch (error) {
      console.error('[NotificationQueue] Erreur ajout queue:', error);
      throw error;
    }
  }

  /**
   * Démarre le processeur de queue
   */
  startProcessor() {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }

    this.processingTimer = setInterval(() => {
      if (!this.isProcessing) {
        this.processQueue();
      }
    }, this.config.processingInterval);

    console.log('[NotificationQueue] Processeur démarré');
  }

  /**
   * Traite la queue des notifications
   */
  async processQueue() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Récupérer les notifications à traiter
      const notifications = await this.getNextNotifications();

      if (notifications.length === 0) {
        return;
      }

      console.log(`[NotificationQueue] Traitement de ${notifications.length} notifications`);

      // Traiter en parallèle (avec limite)
      const promises = notifications.map(notification =>
        this.processNotification(notification)
      );

      await Promise.allSettled(promises);

    } catch (error) {
      console.error('[NotificationQueue] Erreur traitement queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Traite une notification individuelle
   */
  async processNotification(notification) {
    const startTime = Date.now();
    const jobId = notification.notification_id;

    // Créer un timeout pour cette notification
    const timeout = setTimeout(() => {
      console.warn(`[NotificationQueue] Timeout pour ${jobId}`);
      this.handleNotificationTimeout(jobId);
    }, this.config.maxProcessingTime);

    this.activeJobs.set(jobId, { startTime, timeout });

    try {
      // Marquer comme en cours de traitement
      await this.updateNotificationStatus(jobId, NOTIFICATION_STATUS.PROCESSING);

      // Parser le payload
      const payload = JSON.parse(notification.payload);

      // Envoyer via le NotificationManager
      const result = await this.notificationManager.sendToChannel(
        notification.channel_type,
        payload,
        {
          userId: notification.user_id,
          priority: notification.priority,
          notificationId: jobId
        }
      );

      // Vérifier le succès
      if (result && result.successful > 0) {
        await this.handleNotificationSuccess(notification, result);
      } else {
        await this.handleNotificationFailure(notification, new Error('Aucune notification envoyée avec succès'));
      }

    } catch (error) {
      await this.handleNotificationFailure(notification, error);
    } finally {
      // Nettoyer le timeout et le job actif
      clearTimeout(timeout);
      this.activeJobs.delete(jobId);

      // Mettre à jour les statistiques
      this.stats.processed++;
      this.stats.currentQueueSize = Math.max(0, this.stats.currentQueueSize - 1);
    }
  }

  /**
   * Gère le succès d'une notification
   */
  async handleNotificationSuccess(notification, result) {
    try {
      await this.updateNotificationStatus(
        notification.notification_id,
        NOTIFICATION_STATUS.SENT,
        null, // pas d'erreur
        { deliveryResult: result }
      );

      // Enregistrer dans l'historique
      await this.recordToHistory(notification, NOTIFICATION_STATUS.SENT, result);

      this.stats.successful++;

      console.log(`[NotificationQueue] ✓ Notification envoyée: ${notification.notification_id}`);

      // Émettre un événement de succès
      this.emit('notification_sent', {
        notificationId: notification.notification_id,
        alertId: notification.alert_id,
        channelType: notification.channel_type,
        result
      });

    } catch (error) {
      console.error('[NotificationQueue] Erreur enregistrement succès:', error);
    }
  }

  /**
   * Gère l'échec d'une notification
   */
  async handleNotificationFailure(notification, error) {
    const currentRetry = notification.retry_count;
    const maxRetries = notification.max_retries;

    console.warn(`[NotificationQueue] ✗ Échec notification ${notification.notification_id}: ${error.message} (retry ${currentRetry}/${maxRetries})`);

    try {
      if (currentRetry < maxRetries) {
        // Programmer un retry
        await this.scheduleRetry(notification, error);
        this.stats.retried++;
      } else {
        // Échec définitif
        await this.updateNotificationStatus(
          notification.notification_id,
          NOTIFICATION_STATUS.FAILED,
          error.message
        );

        // Enregistrer dans l'historique
        await this.recordToHistory(notification, NOTIFICATION_STATUS.FAILED, null, error.message);

        this.stats.failed++;

        // Émettre un événement d'échec
        this.emit('notification_failed', {
          notificationId: notification.notification_id,
          alertId: notification.alert_id,
          channelType: notification.channel_type,
          error: error.message,
          retryCount: currentRetry
        });
      }
    } catch (updateError) {
      console.error('[NotificationQueue] Erreur mise à jour échec:', updateError);
    }
  }

  /**
   * Programme un retry pour une notification
   */
  async scheduleRetry(notification, error) {
    const retryCount = notification.retry_count + 1;
    const delay = this.config.retryDelays[Math.min(retryCount - 1, this.config.retryDelays.length - 1)];
    const scheduledAt = new Date(Date.now() + delay);

    await this.updateNotificationForRetry(
      notification.notification_id,
      retryCount,
      scheduledAt,
      error.message
    );

    console.log(`[NotificationQueue] Retry programmé pour ${notification.notification_id} dans ${delay}ms`);
  }

  /**
   * Récupère les prochaines notifications à traiter
   */
  async getNextNotifications() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM notification_queue
        WHERE status = ?
        AND scheduled_at <= datetime('now')
        ORDER BY
          CASE priority
            WHEN '${PRIORITY_LEVELS.CRITICAL}' THEN 1
            WHEN '${PRIORITY_LEVELS.HIGH}' THEN 2
            WHEN '${PRIORITY_LEVELS.MEDIUM}' THEN 3
            WHEN '${PRIORITY_LEVELS.LOW}' THEN 4
            WHEN '${PRIORITY_LEVELS.INFO}' THEN 5
            ELSE 6
          END,
          scheduled_at ASC
        LIMIT ?
      `;

      this.database.all(query, [NOTIFICATION_STATUS.PENDING, this.config.batchSize], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Sauvegarde une notification en base
   */
  async saveToDatabase(queueItem) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_queue (
          notification_id, alert_id, user_id, channel_type, priority,
          scheduled_at, status, retry_count, max_retries, payload
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        queueItem.notification_id,
        queueItem.alert_id,
        queueItem.user_id,
        queueItem.channel_type,
        queueItem.priority,
        queueItem.scheduled_at,
        queueItem.status,
        queueItem.retry_count,
        queueItem.max_retries,
        queueItem.payload
      ];

      this.database.run(query, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Met à jour le statut d'une notification
   */
  async updateNotificationStatus(notificationId, status, errorMessage = null, metadata = null) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE notification_queue
        SET status = ?,
            processing_at = CASE WHEN ? = '${NOTIFICATION_STATUS.PROCESSING}' THEN datetime('now') ELSE processing_at END,
            completed_at = CASE WHEN ? IN ('${NOTIFICATION_STATUS.SENT}', '${NOTIFICATION_STATUS.FAILED}') THEN datetime('now') ELSE completed_at END,
            error_message = ?,
            metadata = ?
        WHERE notification_id = ?
      `;

      this.database.run(query, [
        status,
        status,
        status,
        errorMessage,
        metadata ? JSON.stringify(metadata) : null,
        notificationId
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Met à jour une notification pour retry
   */
  async updateNotificationForRetry(notificationId, retryCount, scheduledAt, errorMessage) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE notification_queue
        SET status = ?,
            retry_count = ?,
            scheduled_at = ?,
            error_message = ?,
            processing_at = NULL
        WHERE notification_id = ?
      `;

      this.database.run(query, [
        NOTIFICATION_STATUS.PENDING,
        retryCount,
        scheduledAt.toISOString(),
        errorMessage,
        notificationId
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Enregistre dans l'historique
   */
  async recordToHistory(notification, status, deliveryResult = null, errorMessage = null) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_history (
          notification_id, alert_id, user_id, channel_type, status,
          sent_at, delivered_at, error_message, retry_count, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const now = new Date().toISOString();
      const metadata = deliveryResult ? JSON.stringify(deliveryResult) : null;

      this.database.run(query, [
        notification.notification_id,
        notification.alert_id,
        notification.user_id,
        notification.channel_type,
        status,
        status === NOTIFICATION_STATUS.SENT ? now : null,
        status === NOTIFICATION_STATUS.SENT ? now : null,
        errorMessage,
        notification.retry_count,
        metadata
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Charge les notifications en attente au démarrage
   */
  async loadPendingNotifications() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COUNT(*) as count
        FROM notification_queue
        WHERE status IN (?, ?)
      `;

      this.database.get(query, [NOTIFICATION_STATUS.PENDING, NOTIFICATION_STATUS.PROCESSING], (err, row) => {
        if (err) {
          reject(err);
        } else {
          this.stats.currentQueueSize = row?.count || 0;
          resolve();
        }
      });
    });
  }

  /**
   * Nettoie les jobs orphelins (en cours de traitement mais pas actifs)
   */
  async cleanupOrphanedJobs() {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE notification_queue
        SET status = ?, processing_at = NULL
        WHERE status = ?
        AND processing_at < datetime('now', '-5 minutes')
      `;

      this.database.run(query, [NOTIFICATION_STATUS.PENDING, NOTIFICATION_STATUS.PROCESSING], function(err) {
        if (err) {
          reject(err);
        } else {
          if (this.changes > 0) {
            console.log(`[NotificationQueue] ${this.changes} jobs orphelins nettoyés`);
          }
          resolve();
        }
      });
    });
  }

  /**
   * Gère les timeouts de notification
   */
  async handleNotificationTimeout(notificationId) {
    if (this.activeJobs.has(notificationId)) {
      const job = this.activeJobs.get(notificationId);
      clearTimeout(job.timeout);
      this.activeJobs.delete(notificationId);

      console.warn(`[NotificationQueue] Timeout notification ${notificationId}`);

      // Remettre en attente pour retry
      await this.updateNotificationStatus(notificationId, NOTIFICATION_STATUS.PENDING, 'Timeout de traitement');
    }
  }

  /**
   * Génère un ID unique pour les notifications
   */
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Récupère les statistiques de la queue
   */
  getStats() {
    return {
      ...this.stats,
      activeJobs: this.activeJobs.size,
      isProcessing: this.isProcessing,
      config: {
        batchSize: this.config.batchSize,
        maxRetries: this.config.maxRetries,
        processingInterval: this.config.processingInterval
      }
    };
  }

  /**
   * Récupère l'état détaillé de la queue
   */
  async getDetailedStatus() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT
          status,
          channel_type,
          priority,
          COUNT(*) as count,
          MIN(scheduled_at) as oldest,
          MAX(scheduled_at) as newest
        FROM notification_queue
        WHERE status != '${NOTIFICATION_STATUS.SENT}'
        GROUP BY status, channel_type, priority
        ORDER BY status, priority
      `;

      this.database.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            stats: this.getStats(),
            queueBreakdown: rows || [],
            activeJobs: Array.from(this.activeJobs.keys())
          });
        }
      });
    });
  }

  /**
   * Arrête le processeur de queue
   */
  async stop() {
    console.log('[NotificationQueue] Arrêt du processeur...');

    // Arrêter le timer
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }

    // Attendre la fin des jobs actifs
    const maxWait = 30000; // 30 secondes max
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && (Date.now() - startTime) < maxWait) {
      console.log(`[NotificationQueue] Attente fin de ${this.activeJobs.size} jobs actifs...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Forcer l'arrêt des jobs restants
    for (const [jobId, job] of this.activeJobs) {
      clearTimeout(job.timeout);
      console.warn(`[NotificationQueue] Arrêt forcé du job ${jobId}`);
    }
    this.activeJobs.clear();

    console.log('[NotificationQueue] Processeur arrêté');
  }

  /**
   * Nettoyage des ressources
   */
  async cleanup() {
    await this.stop();
    this.removeAllListeners();
  }
}

module.exports = NotificationQueue;