// Système d'analytics et monitoring des notifications

const EventEmitter = require('events');
const { ALERT_TYPES, PRIORITY_LEVELS, NOTIFICATION_CHANNELS, NOTIFICATION_STATUS } = require('../types');

/**
 * Système complet d'analytics pour les notifications
 * Collecte, analyse et présente les métriques de performance
 */
class NotificationAnalytics extends EventEmitter {
  constructor(database, config = {}) {
    super();

    this.database = database;
    this.config = {
      enableRealTimeMetrics: true,
      metricsRetentionDays: 90,
      aggregationInterval: 60000, // 1 minute
      enablePredictiveAnalytics: true,
      ...config
    };

    // Cache des métriques en temps réel
    this.realTimeMetrics = {
      totalSent: 0,
      totalDelivered: 0,
      totalFailed: 0,
      averageDeliveryTime: 0,
      channelStats: new Map(),
      priorityStats: new Map(),
      recentActivity: []
    };

    // Métriques historiques
    this.historicalData = {
      daily: new Map(),
      hourly: new Map(),
      trends: new Map()
    };

    this.aggregationTimer = null;
    this.lastAggregation = Date.now();
  }

  /**
   * Initialise le système d'analytics
   */
  async initialize() {
    try {
      console.log('[NotificationAnalytics] Initialisation...');

      // Charger les métriques existantes
      await this.loadHistoricalMetrics();

      // Démarrer l'agrégation en temps réel
      if (this.config.enableRealTimeMetrics) {
        this.startRealTimeAggregation();
      }

      // Nettoyer les anciennes données
      await this.cleanupOldMetrics();

      console.log('[NotificationAnalytics] Initialisé avec succès');

    } catch (error) {
      console.error('[NotificationAnalytics] Erreur d\'initialisation:', error);
      throw error;
    }
  }

  /**
   * Enregistre l'envoi d'une notification
   */
  recordNotificationSent(notificationData) {
    if (!this.config.enableRealTimeMetrics) return;

    const now = Date.now();

    // Mettre à jour les compteurs globaux
    this.realTimeMetrics.totalSent++;

    // Stats par canal
    const channel = notificationData.channelType;
    if (!this.realTimeMetrics.channelStats.has(channel)) {
      this.realTimeMetrics.channelStats.set(channel, {
        sent: 0,
        delivered: 0,
        failed: 0,
        averageTime: 0
      });
    }
    this.realTimeMetrics.channelStats.get(channel).sent++;

    // Stats par priorité
    const priority = notificationData.priority;
    if (!this.realTimeMetrics.priorityStats.has(priority)) {
      this.realTimeMetrics.priorityStats.set(priority, {
        sent: 0,
        delivered: 0,
        failed: 0
      });
    }
    this.realTimeMetrics.priorityStats.get(priority).sent++;

    // Activité récente
    this.realTimeMetrics.recentActivity.unshift({
      type: 'sent',
      timestamp: now,
      channel,
      priority,
      notificationId: notificationData.notificationId
    });

    // Limiter l'historique récent
    if (this.realTimeMetrics.recentActivity.length > 100) {
      this.realTimeMetrics.recentActivity = this.realTimeMetrics.recentActivity.slice(0, 50);
    }

    // Émettre l'événement
    this.emit('notification_sent', notificationData);
  }

  /**
   * Enregistre la délivrance d'une notification
   */
  recordNotificationDelivered(notificationData, deliveryTime) {
    if (!this.config.enableRealTimeMetrics) return;

    const now = Date.now();

    // Mettre à jour les compteurs globaux
    this.realTimeMetrics.totalDelivered++;

    // Calculer le temps de délivrance moyen
    const currentAvg = this.realTimeMetrics.averageDeliveryTime;
    const count = this.realTimeMetrics.totalDelivered;
    this.realTimeMetrics.averageDeliveryTime = ((currentAvg * (count - 1)) + deliveryTime) / count;

    // Stats par canal
    const channel = notificationData.channelType;
    if (this.realTimeMetrics.channelStats.has(channel)) {
      const stats = this.realTimeMetrics.channelStats.get(channel);
      stats.delivered++;

      // Temps moyen par canal
      const channelAvg = stats.averageTime;
      const channelCount = stats.delivered;
      stats.averageTime = ((channelAvg * (channelCount - 1)) + deliveryTime) / channelCount;
    }

    // Stats par priorité
    const priority = notificationData.priority;
    if (this.realTimeMetrics.priorityStats.has(priority)) {
      this.realTimeMetrics.priorityStats.get(priority).delivered++;
    }

    // Activité récente
    this.realTimeMetrics.recentActivity.unshift({
      type: 'delivered',
      timestamp: now,
      channel,
      priority,
      deliveryTime,
      notificationId: notificationData.notificationId
    });

    this.emit('notification_delivered', { ...notificationData, deliveryTime });
  }

  /**
   * Enregistre l'échec d'une notification
   */
  recordNotificationFailed(notificationData, error) {
    if (!this.config.enableRealTimeMetrics) return;

    const now = Date.now();

    // Mettre à jour les compteurs globaux
    this.realTimeMetrics.totalFailed++;

    // Stats par canal
    const channel = notificationData.channelType;
    if (this.realTimeMetrics.channelStats.has(channel)) {
      this.realTimeMetrics.channelStats.get(channel).failed++;
    }

    // Stats par priorité
    const priority = notificationData.priority;
    if (this.realTimeMetrics.priorityStats.has(priority)) {
      this.realTimeMetrics.priorityStats.get(priority).failed++;
    }

    // Activité récente
    this.realTimeMetrics.recentActivity.unshift({
      type: 'failed',
      timestamp: now,
      channel,
      priority,
      error: error.message,
      notificationId: notificationData.notificationId
    });

    this.emit('notification_failed', { ...notificationData, error });
  }

  /**
   * Démarre l'agrégation en temps réel
   */
  startRealTimeAggregation() {
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.config.aggregationInterval);

    console.log('[NotificationAnalytics] Agrégation temps réel démarrée');
  }

  /**
   * Agrège les métriques pour l'historique
   */
  async aggregateMetrics() {
    try {
      const now = new Date();
      const dateKey = this.getDateKey(now, 'daily');
      const hourKey = this.getDateKey(now, 'hourly');

      // Récupérer les données récentes depuis la base
      const recentData = await this.getRecentNotificationData();

      // Agréger par jour
      await this.aggregateByPeriod(recentData, 'daily', dateKey);

      // Agréger par heure
      await this.aggregateByPeriod(recentData, 'hourly', hourKey);

      // Sauvegarder en base
      await this.saveAggregatedMetrics();

      this.lastAggregation = Date.now();

    } catch (error) {
      console.error('[NotificationAnalytics] Erreur agrégation:', error);
    }
  }

  /**
   * Récupère les données récentes de notifications
   */
  async getRecentNotificationData() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT
          nh.channel_type,
          nh.status,
          nh.sent_at,
          nh.delivered_at,
          nh.error_message,
          a.type as alert_type,
          a.priority,
          a.zone,
          (julianday(nh.delivered_at) - julianday(nh.sent_at)) * 86400000 as delivery_time_ms
        FROM notification_history nh
        JOIN alerts a ON nh.alert_id = a.id
        WHERE nh.sent_at >= datetime('now', '-1 hour')
        ORDER BY nh.sent_at DESC
      `;

      this.database.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Agrège les données par période
   */
  async aggregateByPeriod(data, period, periodKey) {
    const aggregated = {
      date: periodKey,
      total_sent: 0,
      total_delivered: 0,
      total_failed: 0,
      avg_delivery_time: 0,
      channels: {},
      priorities: {},
      alert_types: {},
      zones: {}
    };

    let totalDeliveryTime = 0;
    let deliveredCount = 0;

    for (const row of data) {
      aggregated.total_sent++;

      if (row.status === NOTIFICATION_STATUS.SENT) {
        aggregated.total_delivered++;
        if (row.delivery_time_ms) {
          totalDeliveryTime += row.delivery_time_ms;
          deliveredCount++;
        }
      } else if (row.status === NOTIFICATION_STATUS.FAILED) {
        aggregated.total_failed++;
      }

      // Par canal
      if (!aggregated.channels[row.channel_type]) {
        aggregated.channels[row.channel_type] = { sent: 0, delivered: 0, failed: 0 };
      }
      aggregated.channels[row.channel_type].sent++;
      if (row.status === NOTIFICATION_STATUS.SENT) {
        aggregated.channels[row.channel_type].delivered++;
      } else if (row.status === NOTIFICATION_STATUS.FAILED) {
        aggregated.channels[row.channel_type].failed++;
      }

      // Par priorité
      if (!aggregated.priorities[row.priority]) {
        aggregated.priorities[row.priority] = { sent: 0, delivered: 0, failed: 0 };
      }
      aggregated.priorities[row.priority].sent++;
      if (row.status === NOTIFICATION_STATUS.SENT) {
        aggregated.priorities[row.priority].delivered++;
      } else if (row.status === NOTIFICATION_STATUS.FAILED) {
        aggregated.priorities[row.priority].failed++;
      }

      // Par type d'alerte
      if (!aggregated.alert_types[row.alert_type]) {
        aggregated.alert_types[row.alert_type] = { sent: 0, delivered: 0, failed: 0 };
      }
      aggregated.alert_types[row.alert_type].sent++;
      if (row.status === NOTIFICATION_STATUS.SENT) {
        aggregated.alert_types[row.alert_type].delivered++;
      } else if (row.status === NOTIFICATION_STATUS.FAILED) {
        aggregated.alert_types[row.alert_type].failed++;
      }

      // Par zone
      if (row.zone) {
        if (!aggregated.zones[row.zone]) {
          aggregated.zones[row.zone] = { sent: 0, delivered: 0, failed: 0 };
        }
        aggregated.zones[row.zone].sent++;
        if (row.status === NOTIFICATION_STATUS.SENT) {
          aggregated.zones[row.zone].delivered++;
        } else if (row.status === NOTIFICATION_STATUS.FAILED) {
          aggregated.zones[row.zone].failed++;
        }
      }
    }

    // Calculer le temps moyen de délivrance
    if (deliveredCount > 0) {
      aggregated.avg_delivery_time = totalDeliveryTime / deliveredCount;
    }

    // Stocker dans le cache historique
    this.historicalData[period].set(periodKey, aggregated);
  }

  /**
   * Sauvegarde les métriques agrégées en base
   */
  async saveAggregatedMetrics() {
    // Sauvegarder les données quotidiennes
    for (const [date, data] of this.historicalData.daily) {
      await this.saveAggregatedData(date, 'daily', data);
    }

    // Sauvegarder les données horaires
    for (const [date, data] of this.historicalData.hourly) {
      await this.saveAggregatedData(date, 'hourly', data);
    }
  }

  /**
   * Sauvegarde des données agrégées
   */
  async saveAggregatedData(date, period, data) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO notification_analytics (
          date, period, total_sent, total_delivered, total_failed,
          avg_delivery_time, breakdown_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;

      const breakdownData = JSON.stringify({
        channels: data.channels,
        priorities: data.priorities,
        alert_types: data.alert_types,
        zones: data.zones
      });

      this.database.run(query, [
        date,
        period,
        data.total_sent,
        data.total_delivered,
        data.total_failed,
        data.avg_delivery_time,
        breakdownData
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
   * Récupère les métriques en temps réel
   */
  getRealTimeMetrics() {
    const total = this.realTimeMetrics.totalSent;
    const successRate = total > 0 ? (this.realTimeMetrics.totalDelivered / total) * 100 : 0;
    const failureRate = total > 0 ? (this.realTimeMetrics.totalFailed / total) * 100 : 0;

    return {
      summary: {
        totalSent: this.realTimeMetrics.totalSent,
        totalDelivered: this.realTimeMetrics.totalDelivered,
        totalFailed: this.realTimeMetrics.totalFailed,
        successRate: Math.round(successRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
        averageDeliveryTime: Math.round(this.realTimeMetrics.averageDeliveryTime)
      },
      channels: Object.fromEntries(this.realTimeMetrics.channelStats),
      priorities: Object.fromEntries(this.realTimeMetrics.priorityStats),
      recentActivity: this.realTimeMetrics.recentActivity.slice(0, 20)
    };
  }

  /**
   * Récupère les métriques historiques
   */
  async getHistoricalMetrics(period = 'daily', limit = 30) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT *
        FROM notification_analytics
        WHERE period = ?
        ORDER BY date DESC
        LIMIT ?
      `;

      this.database.all(query, [period, limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const processedRows = rows.map(row => ({
            ...row,
            breakdown_data: JSON.parse(row.breakdown_data || '{}')
          }));
          resolve(processedRows);
        }
      });
    });
  }

  /**
   * Récupère les tendances et analytics avancées
   */
  async getAdvancedAnalytics(timeRange = '7d') {
    try {
      const [
        trends,
        channelPerformance,
        priorityDistribution,
        peakHours,
        zoneActivity
      ] = await Promise.all([
        this.calculateTrends(timeRange),
        this.getChannelPerformance(timeRange),
        this.getPriorityDistribution(timeRange),
        this.getPeakHours(timeRange),
        this.getZoneActivity(timeRange)
      ]);

      return {
        timeRange,
        generatedAt: new Date().toISOString(),
        trends,
        channelPerformance,
        priorityDistribution,
        peakHours,
        zoneActivity,
        insights: this.generateInsights({
          trends,
          channelPerformance,
          priorityDistribution
        })
      };

    } catch (error) {
      console.error('[NotificationAnalytics] Erreur analytics avancées:', error);
      throw error;
    }
  }

  /**
   * Calcule les tendances
   */
  async calculateTrends(timeRange) {
    const days = this.parseTimeRange(timeRange);
    const data = await this.getHistoricalMetrics('daily', days);

    if (data.length < 2) {
      return { direction: 'insufficient_data', change: 0 };
    }

    const recent = data.slice(0, Math.ceil(days / 2));
    const older = data.slice(Math.ceil(days / 2));

    const recentAvg = recent.reduce((sum, d) => sum + d.total_sent, 0) / recent.length;
    const olderAvg = older.reduce((sum, d) => sum + d.total_sent, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    return {
      direction: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
      change: Math.round(change * 100) / 100,
      recentAverage: Math.round(recentAvg),
      previousAverage: Math.round(olderAvg)
    };
  }

  /**
   * Récupère les performances par canal
   */
  async getChannelPerformance(timeRange) {
    const days = this.parseTimeRange(timeRange);
    const data = await this.getHistoricalMetrics('daily', days);

    const channelStats = {};

    for (const day of data) {
      for (const [channel, stats] of Object.entries(day.breakdown_data.channels || {})) {
        if (!channelStats[channel]) {
          channelStats[channel] = { sent: 0, delivered: 0, failed: 0 };
        }

        channelStats[channel].sent += stats.sent || 0;
        channelStats[channel].delivered += stats.delivered || 0;
        channelStats[channel].failed += stats.failed || 0;
      }
    }

    // Calculer les taux de succès
    for (const channel in channelStats) {
      const stats = channelStats[channel];
      stats.successRate = stats.sent > 0 ? (stats.delivered / stats.sent) * 100 : 0;
      stats.failureRate = stats.sent > 0 ? (stats.failed / stats.sent) * 100 : 0;
    }

    return channelStats;
  }

  /**
   * Récupère la distribution des priorités
   */
  async getPriorityDistribution(timeRange) {
    const days = this.parseTimeRange(timeRange);
    const data = await this.getHistoricalMetrics('daily', days);

    const priorityStats = {};

    for (const day of data) {
      for (const [priority, stats] of Object.entries(day.breakdown_data.priorities || {})) {
        if (!priorityStats[priority]) {
          priorityStats[priority] = { sent: 0, delivered: 0, failed: 0 };
        }

        priorityStats[priority].sent += stats.sent || 0;
        priorityStats[priority].delivered += stats.delivered || 0;
        priorityStats[priority].failed += stats.failed || 0;
      }
    }

    // Calculer les pourcentages
    const total = Object.values(priorityStats).reduce((sum, stats) => sum + stats.sent, 0);

    for (const priority in priorityStats) {
      const stats = priorityStats[priority];
      stats.percentage = total > 0 ? (stats.sent / total) * 100 : 0;
    }

    return priorityStats;
  }

  /**
   * Récupère les heures de pic
   */
  async getPeakHours(timeRange) {
    return new Promise((resolve, reject) => {
      const days = this.parseTimeRange(timeRange);
      const hoursAgo = days * 24;

      const query = `
        SELECT
          strftime('%H', sent_at) as hour,
          COUNT(*) as count
        FROM notification_history
        WHERE sent_at >= datetime('now', '-${hoursAgo} hours')
        GROUP BY hour
        ORDER BY count DESC
      `;

      this.database.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            hour: parseInt(row.hour),
            count: row.count
          })));
        }
      });
    });
  }

  /**
   * Récupère l'activité par zone
   */
  async getZoneActivity(timeRange) {
    return new Promise((resolve, reject) => {
      const days = this.parseTimeRange(timeRange);

      const query = `
        SELECT
          a.zone,
          COUNT(*) as alert_count,
          COUNT(nh.id) as notification_count,
          AVG(CASE WHEN nh.status = 'sent' THEN 1.0 ELSE 0.0 END) as success_rate
        FROM alerts a
        LEFT JOIN notification_history nh ON a.id = nh.alert_id
        WHERE a.created_at >= datetime('now', '-${days} days')
        AND a.zone IS NOT NULL
        GROUP BY a.zone
        ORDER BY notification_count DESC
      `;

      this.database.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            zone: row.zone,
            alertCount: row.alert_count,
            notificationCount: row.notification_count,
            successRate: Math.round((row.success_rate || 0) * 100)
          })));
        }
      });
    });
  }

  /**
   * Génère des insights automatiques
   */
  generateInsights(analytics) {
    const insights = [];

    // Analyse des tendances
    if (analytics.trends.direction === 'increasing' && analytics.trends.change > 20) {
      insights.push({
        type: 'warning',
        title: 'Volume de notifications en hausse',
        message: `Le volume de notifications a augmenté de ${analytics.trends.change}% récemment.`,
        recommendation: 'Vérifiez s\'il y a une augmentation d\'incidents ou d\'alertes système.'
      });
    }

    // Analyse des canaux
    for (const [channel, stats] of Object.entries(analytics.channelPerformance)) {
      if (stats.successRate < 80) {
        insights.push({
          type: 'error',
          title: `Performance dégradée du canal ${channel}`,
          message: `Le taux de succès du canal ${channel} est de ${stats.successRate.toFixed(1)}%.`,
          recommendation: `Vérifiez la configuration et la connectivité du canal ${channel}.`
        });
      }
    }

    // Analyse des priorités
    const criticalPercentage = analytics.priorityDistribution[PRIORITY_LEVELS.CRITICAL]?.percentage || 0;
    if (criticalPercentage > 30) {
      insights.push({
        type: 'warning',
        title: 'Proportion élevée d\'alertes critiques',
        message: `${criticalPercentage.toFixed(1)}% des notifications sont critiques.`,
        recommendation: 'Vérifiez si les niveaux de priorité sont correctement configurés.'
      });
    }

    return insights;
  }

  /**
   * Parse une chaîne de période en nombre de jours
   */
  parseTimeRange(timeRange) {
    const match = timeRange.match(/^(\d+)([dwmy])$/);
    if (!match) return 7; // Défaut 7 jours

    const [, amount, unit] = match;
    const multipliers = { d: 1, w: 7, m: 30, y: 365 };

    return parseInt(amount) * multipliers[unit];
  }

  /**
   * Génère une clé de date pour l'agrégation
   */
  getDateKey(date, period) {
    switch (period) {
      case 'hourly':
        return date.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      case 'daily':
        return date.toISOString().substring(0, 10); // YYYY-MM-DD
      case 'monthly':
        return date.toISOString().substring(0, 7); // YYYY-MM
      default:
        return date.toISOString().substring(0, 10);
    }
  }

  /**
   * Charge les métriques historiques
   */
  async loadHistoricalMetrics() {
    const [dailyData, hourlyData] = await Promise.all([
      this.getHistoricalMetrics('daily', 30),
      this.getHistoricalMetrics('hourly', 48)
    ]);

    // Charger dans le cache
    for (const data of dailyData) {
      this.historicalData.daily.set(data.date, data);
    }

    for (const data of hourlyData) {
      this.historicalData.hourly.set(data.date, data);
    }
  }

  /**
   * Nettoie les anciennes métriques
   */
  async cleanupOldMetrics() {
    const retentionDays = this.config.metricsRetentionDays;

    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM notification_analytics
        WHERE date < datetime('now', '-${retentionDays} days')
      `;

      this.database.run(query, function(err) {
        if (err) {
          reject(err);
        } else {
          if (this.changes > 0) {
            console.log(`[NotificationAnalytics] ${this.changes} métriques anciennes supprimées`);
          }
          resolve();
        }
      });
    });
  }

  /**
   * Arrête les timers et nettoie les ressources
   */
  cleanup() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    this.removeAllListeners();
    console.log('[NotificationAnalytics] Nettoyage terminé');
  }
}

module.exports = NotificationAnalytics;