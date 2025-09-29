// Moniteur de performance et santé de la queue des notifications

const EventEmitter = require('events');

/**
 * Moniteur en temps réel de la queue des notifications
 * Surveille les performances, détecte les problèmes et génère des alertes
 */
class QueueMonitor extends EventEmitter {
  constructor(queue, config = {}) {
    super();

    this.queue = queue;
    this.config = {
      monitoringInterval: 30000, // 30 secondes
      performanceWindow: 300000, // 5 minutes de fenêtre pour les métriques
      alertThresholds: {
        queueSizeWarning: 100,
        queueSizeCritical: 500,
        failureRateWarning: 0.1, // 10%
        failureRateCritical: 0.25, // 25%
        avgProcessingTimeWarning: 5000, // 5 secondes
        avgProcessingTimeCritical: 15000, // 15 secondes
        stuckJobsWarning: 10, // Jobs bloqués pendant plus de 10 minutes
      },
      ...config
    };

    // Métriques de performance
    this.metrics = {
      processedNotifications: [],
      failedNotifications: [],
      processingTimes: [],
      queueSizes: [],
      channelStats: new Map(),
      priorityStats: new Map()
    };

    // État des alertes
    this.activeAlerts = new Set();
    this.alertHistory = [];

    this.monitoringTimer = null;
    this.isMonitoring = false;
  }

  /**
   * Démarre le monitoring
   */
  start() {
    if (this.isMonitoring) {
      return;
    }

    console.log('[QueueMonitor] Démarrage du monitoring...');

    // Écouter les événements de la queue
    this.queue.on('notification_sent', (data) => this.recordSuccess(data));
    this.queue.on('notification_failed', (data) => this.recordFailure(data));

    // Démarrer le monitoring périodique
    this.monitoringTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.monitoringInterval);

    this.isMonitoring = true;
    console.log('[QueueMonitor] Monitoring actif');
  }

  /**
   * Arrête le monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('[QueueMonitor] Arrêt du monitoring...');

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.queue.removeAllListeners('notification_sent');
    this.queue.removeAllListeners('notification_failed');

    this.isMonitoring = false;
    console.log('[QueueMonitor] Monitoring arrêté');
  }

  /**
   * Enregistre une notification envoyée avec succès
   */
  recordSuccess(data) {
    const now = Date.now();

    this.metrics.processedNotifications.push({
      timestamp: now,
      notificationId: data.notificationId,
      channelType: data.channelType,
      alertId: data.alertId,
      processingTime: data.processingTime || 0
    });

    // Mettre à jour les stats par canal
    this.updateChannelStats(data.channelType, 'success');

    // Nettoyer les anciennes métriques
    this.cleanOldMetrics();
  }

  /**
   * Enregistre une notification échouée
   */
  recordFailure(data) {
    const now = Date.now();

    this.metrics.failedNotifications.push({
      timestamp: now,
      notificationId: data.notificationId,
      channelType: data.channelType,
      alertId: data.alertId,
      error: data.error,
      retryCount: data.retryCount
    });

    // Mettre à jour les stats par canal
    this.updateChannelStats(data.channelType, 'failure');

    // Nettoyer les anciennes métriques
    this.cleanOldMetrics();
  }

  /**
   * Met à jour les statistiques par canal
   */
  updateChannelStats(channelType, result) {
    if (!this.metrics.channelStats.has(channelType)) {
      this.metrics.channelStats.set(channelType, {
        success: 0,
        failure: 0,
        lastUpdate: Date.now()
      });
    }

    const stats = this.metrics.channelStats.get(channelType);
    stats[result]++;
    stats.lastUpdate = Date.now();
  }

  /**
   * Effectue un contrôle de santé complet
   */
  async performHealthCheck() {
    try {
      console.log('[QueueMonitor] Contrôle de santé...');

      // Récupérer l'état actuel de la queue
      const queueStatus = await this.queue.getDetailedStatus();
      const queueStats = queueStatus.stats;

      // Enregistrer la taille de la queue
      this.metrics.queueSizes.push({
        timestamp: Date.now(),
        size: queueStats.currentQueueSize,
        activeJobs: queueStats.activeJobs
      });

      // Vérifier les seuils d'alerte
      await this.checkAlertThresholds(queueStats, queueStatus);

      // Analyser les tendances
      this.analyzeTrends();

      // Nettoyer les anciennes métriques
      this.cleanOldMetrics();

    } catch (error) {
      console.error('[QueueMonitor] Erreur lors du contrôle de santé:', error);
    }
  }

  /**
   * Vérifie les seuils d'alerte
   */
  async checkAlertThresholds(queueStats, queueStatus) {
    const thresholds = this.config.alertThresholds;

    // Vérifier la taille de la queue
    if (queueStats.currentQueueSize >= thresholds.queueSizeCritical) {
      this.triggerAlert('queue_size_critical', {
        currentSize: queueStats.currentQueueSize,
        threshold: thresholds.queueSizeCritical,
        severity: 'critical'
      });
    } else if (queueStats.currentQueueSize >= thresholds.queueSizeWarning) {
      this.triggerAlert('queue_size_warning', {
        currentSize: queueStats.currentQueueSize,
        threshold: thresholds.queueSizeWarning,
        severity: 'warning'
      });
    } else {
      this.resolveAlert('queue_size_critical');
      this.resolveAlert('queue_size_warning');
    }

    // Vérifier le taux d'échec
    const failureRate = this.calculateFailureRate();
    if (failureRate >= thresholds.failureRateCritical) {
      this.triggerAlert('failure_rate_critical', {
        currentRate: failureRate,
        threshold: thresholds.failureRateCritical,
        severity: 'critical'
      });
    } else if (failureRate >= thresholds.failureRateWarning) {
      this.triggerAlert('failure_rate_warning', {
        currentRate: failureRate,
        threshold: thresholds.failureRateWarning,
        severity: 'warning'
      });
    } else {
      this.resolveAlert('failure_rate_critical');
      this.resolveAlert('failure_rate_warning');
    }

    // Vérifier les jobs bloqués
    const stuckJobs = await this.detectStuckJobs();
    if (stuckJobs.length > 0) {
      this.triggerAlert('stuck_jobs', {
        jobCount: stuckJobs.length,
        jobs: stuckJobs,
        severity: 'warning'
      });
    } else {
      this.resolveAlert('stuck_jobs');
    }
  }

  /**
   * Calcule le taux d'échec récent
   */
  calculateFailureRate() {
    const now = Date.now();
    const windowStart = now - this.config.performanceWindow;

    const recentSuccess = this.metrics.processedNotifications
      .filter(n => n.timestamp >= windowStart).length;

    const recentFailures = this.metrics.failedNotifications
      .filter(n => n.timestamp >= windowStart).length;

    const total = recentSuccess + recentFailures;
    return total > 0 ? recentFailures / total : 0;
  }

  /**
   * Détecte les jobs bloqués
   */
  async detectStuckJobs() {
    const stuckJobs = [];
    const maxProcessingTime = this.config.alertThresholds.stuckJobsWarning * 60 * 1000; // en ms

    try {
      const queueStatus = await this.queue.getDetailedStatus();

      // Vérifier les jobs actifs depuis trop longtemps
      for (const jobId of queueStatus.activeJobs) {
        // Cette logique nécessiterait l'accès aux détails des jobs actifs
        // Pour simplifier, on compte sur le timeout interne de la queue
      }

      // Vérifier les jobs en processing depuis trop longtemps dans la DB
      // Cette requête serait faite directement sur la base

    } catch (error) {
      console.error('[QueueMonitor] Erreur détection jobs bloqués:', error);
    }

    return stuckJobs;
  }

  /**
   * Déclenche une alerte
   */
  triggerAlert(alertType, data) {
    if (this.activeAlerts.has(alertType)) {
      return; // Alerte déjà active
    }

    const alert = {
      type: alertType,
      severity: data.severity,
      message: this.generateAlertMessage(alertType, data),
      data: data,
      timestamp: new Date(),
      resolved: false
    };

    this.activeAlerts.add(alertType);
    this.alertHistory.push(alert);

    console.warn(`[QueueMonitor] 🚨 ALERTE ${alert.severity.toUpperCase()}: ${alert.message}`);

    // Émettre l'événement d'alerte
    this.emit('alert_triggered', alert);

    // Limiter l'historique des alertes
    if (this.alertHistory.length > 100) {
      this.alertHistory = this.alertHistory.slice(-50);
    }
  }

  /**
   * Résout une alerte
   */
  resolveAlert(alertType) {
    if (!this.activeAlerts.has(alertType)) {
      return; // Alerte pas active
    }

    this.activeAlerts.delete(alertType);

    // Marquer la dernière alerte de ce type comme résolue
    for (let i = this.alertHistory.length - 1; i >= 0; i--) {
      if (this.alertHistory[i].type === alertType && !this.alertHistory[i].resolved) {
        this.alertHistory[i].resolved = true;
        this.alertHistory[i].resolvedAt = new Date();
        break;
      }
    }

    console.info(`[QueueMonitor] ✅ Alerte résolue: ${alertType}`);
    this.emit('alert_resolved', { type: alertType, resolvedAt: new Date() });
  }

  /**
   * Génère un message d'alerte
   */
  generateAlertMessage(alertType, data) {
    switch (alertType) {
      case 'queue_size_warning':
        return `Taille de queue élevée: ${data.currentSize} notifications en attente (seuil: ${data.threshold})`;

      case 'queue_size_critical':
        return `Taille de queue critique: ${data.currentSize} notifications en attente (seuil: ${data.threshold})`;

      case 'failure_rate_warning':
        return `Taux d'échec élevé: ${(data.currentRate * 100).toFixed(1)}% (seuil: ${(data.threshold * 100).toFixed(1)}%)`;

      case 'failure_rate_critical':
        return `Taux d'échec critique: ${(data.currentRate * 100).toFixed(1)}% (seuil: ${(data.threshold * 100).toFixed(1)}%)`;

      case 'stuck_jobs':
        return `${data.jobCount} jobs bloqués détectés`;

      default:
        return `Alerte ${alertType}`;
    }
  }

  /**
   * Analyse les tendances
   */
  analyzeTrends() {
    // Analyser la tendance de la taille de la queue
    const queueSizeTrend = this.calculateTrend(
      this.metrics.queueSizes.map(q => ({ timestamp: q.timestamp, value: q.size }))
    );

    // Analyser la tendance du taux d'échec
    const failureRateTrend = this.calculateFailureRateTrend();

    // Émettre les tendances
    this.emit('trends_updated', {
      queueSize: queueSizeTrend,
      failureRate: failureRateTrend,
      timestamp: Date.now()
    });
  }

  /**
   * Calcule une tendance (croissante, stable, décroissante)
   */
  calculateTrend(dataPoints) {
    if (dataPoints.length < 2) {
      return 'insufficient_data';
    }

    const recent = dataPoints.slice(-5); // 5 derniers points
    if (recent.length < 2) {
      return 'insufficient_data';
    }

    const first = recent[0].value;
    const last = recent[recent.length - 1].value;
    const change = ((last - first) / first) * 100;

    if (Math.abs(change) < 5) {
      return 'stable';
    } else if (change > 0) {
      return 'increasing';
    } else {
      return 'decreasing';
    }
  }

  /**
   * Calcule la tendance du taux d'échec
   */
  calculateFailureRateTrend() {
    const now = Date.now();
    const intervals = 5; // 5 intervalles de mesure
    const intervalDuration = this.config.performanceWindow / intervals;

    const rates = [];
    for (let i = 0; i < intervals; i++) {
      const end = now - (i * intervalDuration);
      const start = end - intervalDuration;

      const successCount = this.metrics.processedNotifications
        .filter(n => n.timestamp >= start && n.timestamp < end).length;

      const failureCount = this.metrics.failedNotifications
        .filter(n => n.timestamp >= start && n.timestamp < end).length;

      const total = successCount + failureCount;
      const rate = total > 0 ? failureCount / total : 0;

      rates.unshift({ timestamp: end, value: rate });
    }

    return this.calculateTrend(rates);
  }

  /**
   * Nettoie les anciennes métriques
   */
  cleanOldMetrics() {
    const cutoff = Date.now() - this.config.performanceWindow;

    // Nettoyer les notifications traitées
    this.metrics.processedNotifications = this.metrics.processedNotifications
      .filter(n => n.timestamp >= cutoff);

    // Nettoyer les notifications échouées
    this.metrics.failedNotifications = this.metrics.failedNotifications
      .filter(n => n.timestamp >= cutoff);

    // Nettoyer les tailles de queue
    this.metrics.queueSizes = this.metrics.queueSizes
      .filter(q => q.timestamp >= cutoff);
  }

  /**
   * Récupère les métriques de performance
   */
  getPerformanceMetrics() {
    const now = Date.now();
    const windowStart = now - this.config.performanceWindow;

    const recentSuccess = this.metrics.processedNotifications
      .filter(n => n.timestamp >= windowStart);

    const recentFailures = this.metrics.failedNotifications
      .filter(n => n.timestamp >= windowStart);

    const recentQueueSizes = this.metrics.queueSizes
      .filter(q => q.timestamp >= windowStart);

    return {
      timeWindow: this.config.performanceWindow,
      notifications: {
        successful: recentSuccess.length,
        failed: recentFailures.length,
        total: recentSuccess.length + recentFailures.length,
        failureRate: this.calculateFailureRate()
      },
      queue: {
        currentSize: recentQueueSizes.length > 0 ? recentQueueSizes[recentQueueSizes.length - 1].size : 0,
        averageSize: recentQueueSizes.length > 0 ?
          recentQueueSizes.reduce((sum, q) => sum + q.size, 0) / recentQueueSizes.length : 0,
        maxSize: recentQueueSizes.length > 0 ? Math.max(...recentQueueSizes.map(q => q.size)) : 0
      },
      channels: Object.fromEntries(this.metrics.channelStats),
      activeAlerts: Array.from(this.activeAlerts),
      alertHistory: this.alertHistory.slice(-10) // 10 dernières alertes
    };
  }

  /**
   * Génère un rapport de santé complet
   */
  async generateHealthReport() {
    const queueStatus = await this.queue.getDetailedStatus();
    const metrics = this.getPerformanceMetrics();

    return {
      timestamp: new Date(),
      status: this.getOverallHealth(),
      queue: queueStatus,
      metrics: metrics,
      alerts: {
        active: Array.from(this.activeAlerts),
        recent: this.alertHistory.slice(-5)
      },
      recommendations: this.generateRecommendations(metrics)
    };
  }

  /**
   * Évalue la santé globale du système
   */
  getOverallHealth() {
    if (this.activeAlerts.has('queue_size_critical') ||
        this.activeAlerts.has('failure_rate_critical')) {
      return 'critical';
    }

    if (this.activeAlerts.size > 0) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * Génère des recommandations basées sur les métriques
   */
  generateRecommendations(metrics) {
    const recommendations = [];

    if (metrics.notifications.failureRate > 0.1) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'Taux d\'échec élevé détecté. Vérifiez la configuration des canaux de notification.'
      });
    }

    if (metrics.queue.averageSize > 50) {
      recommendations.push({
        type: 'capacity',
        priority: 'medium',
        message: 'Taille de queue moyenne élevée. Considérez augmenter la fréquence de traitement.'
      });
    }

    if (this.metrics.channelStats.size > 0) {
      for (const [channel, stats] of this.metrics.channelStats) {
        const channelFailureRate = stats.failure / (stats.success + stats.failure);
        if (channelFailureRate > 0.2) {
          recommendations.push({
            type: 'channel',
            priority: 'high',
            message: `Canal ${channel} a un taux d'échec de ${(channelFailureRate * 100).toFixed(1)}%. Vérifiez sa configuration.`
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Nettoyage des ressources
   */
  cleanup() {
    this.stop();
    this.removeAllListeners();
    this.metrics.channelStats.clear();
    this.metrics.priorityStats.clear();
  }
}

module.exports = QueueMonitor;