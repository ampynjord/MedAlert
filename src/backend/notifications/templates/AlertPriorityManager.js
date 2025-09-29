// Gestionnaire intelligent des priorités et urgences d'alertes

const { ALERT_TYPES, PRIORITY_LEVELS, PRIORITY_CONFIG } = require('../types');

/**
 * Gestionnaire qui détermine automatiquement les priorités des alertes
 * et applique les règles métier en fonction du contexte
 */
class AlertPriorityManager {
  constructor(config = {}) {
    this.config = {
      escalationRules: true,
      zonePriorityBonus: true,
      timeBasedPriority: true,
      userContextPriority: true,
      ...config
    };

    // Règles de priorité par type d'alerte
    this.typeBasePriorities = {
      [ALERT_TYPES.EMERGENCY]: PRIORITY_LEVELS.CRITICAL,
      [ALERT_TYPES.EVACUATION]: PRIORITY_LEVELS.HIGH,
      [ALERT_TYPES.MEDICAL_INFO]: PRIORITY_LEVELS.MEDIUM,
      [ALERT_TYPES.MAINTENANCE]: PRIORITY_LEVELS.LOW,
      [ALERT_TYPES.TRAINING]: PRIORITY_LEVELS.INFO
    };

    // Mots-clés critiques qui augmentent la priorité
    this.criticalKeywords = [
      'urgence', 'emergency', 'critique', 'critical', 'danger', 'mortel',
      'évacuation', 'evacuation', 'incendie', 'fire', 'explosion',
      'toxique', 'toxic', 'contamination', 'radiation', 'chimique'
    ];

    // Zones critiques qui augmentent la priorité
    this.criticalZones = [
      'medical_bay', 'engine_room', 'bridge', 'life_support',
      'reactor', 'hangar', 'cargo_bay', 'security'
    ];

    // Cache des priorités calculées
    this.priorityCache = new Map();
  }

  /**
   * Détermine la priorité d'une alerte
   */
  determinePriority(alert, context = {}) {
    const cacheKey = this.generateCacheKey(alert, context);

    if (this.priorityCache.has(cacheKey)) {
      return this.priorityCache.get(cacheKey);
    }

    // Priorité de base selon le type
    let priority = this.getBasePriority(alert.type);

    // Appliquer les règles d'escalation
    if (this.config.escalationRules) {
      priority = this.applyEscalationRules(priority, alert, context);
    }

    // Bonus de zone
    if (this.config.zonePriorityBonus && alert.zone) {
      priority = this.applyZonePriorityBonus(priority, alert.zone);
    }

    // Priorité basée sur le temps
    if (this.config.timeBasedPriority) {
      priority = this.applyTimeBasedPriority(priority, alert.created_at, context.currentTime);
    }

    // Priorité basée sur le contexte utilisateur
    if (this.config.userContextPriority && context.user) {
      priority = this.applyUserContextPriority(priority, context.user, alert);
    }

    // Mettre en cache
    this.priorityCache.set(cacheKey, priority);

    return priority;
  }

  /**
   * Récupère la priorité de base selon le type
   */
  getBasePriority(alertType) {
    return this.typeBasePriorities[alertType] || PRIORITY_LEVELS.MEDIUM;
  }

  /**
   * Applique les règles d'escalation basées sur le contenu
   */
  applyEscalationRules(basePriority, alert, context) {
    let priority = basePriority;

    // Analyser le titre et la description pour des mots-clés critiques
    const content = `${alert.title} ${alert.description}`.toLowerCase();

    for (const keyword of this.criticalKeywords) {
      if (content.includes(keyword.toLowerCase())) {
        priority = this.escalatePriority(priority, 1);
        break; // Un seul escalation par analyse de mots-clés
      }
    }

    // Escalation basée sur la répétition d'alertes similaires
    if (context.recentSimilarAlerts && context.recentSimilarAlerts > 2) {
      priority = this.escalatePriority(priority, 1);
    }

    // Escalation si plusieurs alertes simultanées dans la même zone
    if (context.simultaneousAlertsInZone && context.simultaneousAlertsInZone > 1) {
      priority = this.escalatePriority(priority, 1);
    }

    return priority;
  }

  /**
   * Applique un bonus de priorité selon la zone
   */
  applyZonePriorityBonus(basePriority, zone) {
    if (this.criticalZones.includes(zone.toLowerCase())) {
      return this.escalatePriority(basePriority, 1);
    }
    return basePriority;
  }

  /**
   * Applique une priorité basée sur le temps
   */
  applyTimeBasedPriority(basePriority, alertTime, currentTime = Date.now()) {
    const alertAge = currentTime - new Date(alertTime).getTime();
    const hoursOld = alertAge / (1000 * 60 * 60);

    // Escalation si l'alerte n'a pas été traitée depuis longtemps
    if (hoursOld > 24) {
      return this.escalatePriority(basePriority, 2); // Très vieille alerte
    } else if (hoursOld > 6) {
      return this.escalatePriority(basePriority, 1); // Alerte ancienne
    }

    return basePriority;
  }

  /**
   * Applique une priorité basée sur le contexte utilisateur
   */
  applyUserContextPriority(basePriority, user, alert) {
    // Escalation pour les rôles critiques
    const criticalRoles = ['medical_officer', 'security_officer', 'captain', 'engineer'];

    if (user.role && criticalRoles.includes(user.role.toLowerCase())) {
      // Si l'alerte concerne directement le domaine de l'utilisateur
      if (this.alertRelevantToUserRole(alert, user.role)) {
        return this.escalatePriority(basePriority, 1);
      }
    }

    // Escalation si l'utilisateur est dans la zone de l'alerte
    if (user.currentZone && alert.zone && user.currentZone === alert.zone) {
      return this.escalatePriority(basePriority, 1);
    }

    return basePriority;
  }

  /**
   * Vérifie si une alerte est pertinente pour le rôle d'un utilisateur
   */
  alertRelevantToUserRole(alert, userRole) {
    const roleRelevance = {
      'medical_officer': [ALERT_TYPES.EMERGENCY, ALERT_TYPES.MEDICAL_INFO],
      'security_officer': [ALERT_TYPES.EMERGENCY, ALERT_TYPES.EVACUATION],
      'engineer': [ALERT_TYPES.MAINTENANCE, ALERT_TYPES.EMERGENCY],
      'captain': Object.values(ALERT_TYPES) // Le capitaine reçoit tout en priorité
    };

    return roleRelevance[userRole]?.includes(alert.type) || false;
  }

  /**
   * Escalade une priorité d'un ou plusieurs niveaux
   */
  escalatePriority(currentPriority, levels = 1) {
    const priorityOrder = [
      PRIORITY_LEVELS.INFO,
      PRIORITY_LEVELS.LOW,
      PRIORITY_LEVELS.MEDIUM,
      PRIORITY_LEVELS.HIGH,
      PRIORITY_LEVELS.CRITICAL
    ];

    const currentIndex = priorityOrder.indexOf(currentPriority);
    const newIndex = Math.min(currentIndex + levels, priorityOrder.length - 1);

    return priorityOrder[newIndex];
  }

  /**
   * Réduit une priorité d'un ou plusieurs niveaux
   */
  degradePriority(currentPriority, levels = 1) {
    const priorityOrder = [
      PRIORITY_LEVELS.INFO,
      PRIORITY_LEVELS.LOW,
      PRIORITY_LEVELS.MEDIUM,
      PRIORITY_LEVELS.HIGH,
      PRIORITY_LEVELS.CRITICAL
    ];

    const currentIndex = priorityOrder.indexOf(currentPriority);
    const newIndex = Math.max(currentIndex - levels, 0);

    return priorityOrder[newIndex];
  }

  /**
   * Détermine les canaux appropriés selon la priorité
   */
  getChannelsForPriority(priority, userPreferences = {}) {
    const config = PRIORITY_CONFIG[priority];
    const channels = [];

    // Canaux de base selon la priorité
    if (config.channels.push && userPreferences.enablePush !== false) {
      channels.push('push');
    }

    if (config.channels.discord && userPreferences.enableDiscord !== false) {
      channels.push('discord');
    }

    if (config.channels.email && userPreferences.enableEmail !== false) {
      channels.push('email');
    }

    if (config.channels.websocket) {
      channels.push('websocket');
    }

    // Pour les priorités critiques, forcer tous les canaux
    if (priority === PRIORITY_LEVELS.CRITICAL) {
      if (!channels.includes('push') && userPreferences.enablePush !== false) {
        channels.push('push');
      }
      if (!channels.includes('discord') && userPreferences.enableDiscord !== false) {
        channels.push('discord');
      }
      if (!channels.includes('websocket')) {
        channels.push('websocket');
      }
    }

    return channels;
  }

  /**
   * Détermine les options d'envoi selon la priorité
   */
  getSendOptionsForPriority(priority) {
    const config = PRIORITY_CONFIG[priority];

    return {
      urgency: config.urgency,
      retryAttempts: config.retryAttempts,
      retryDelay: config.retryDelay,
      requireDeliveryConfirmation: priority === PRIORITY_LEVELS.CRITICAL,
      allowBatching: priority === PRIORITY_LEVELS.INFO || priority === PRIORITY_LEVELS.LOW,
      maxDelay: config.maxDelay || 0
    };
  }

  /**
   * Génère une clé de cache pour une alerte et son contexte
   */
  generateCacheKey(alert, context) {
    const alertHash = `${alert.type}_${alert.zone}_${alert.title.substring(0, 20)}`;
    const contextHash = `${context.user?.role || 'none'}_${context.recentSimilarAlerts || 0}`;
    const timeHash = Math.floor(Date.now() / (1000 * 60 * 60)); // Cache par heure

    return `${alertHash}_${contextHash}_${timeHash}`;
  }

  /**
   * Analyse le contexte pour une alerte donnée
   */
  async analyzeAlertContext(alert, database) {
    const context = {};

    if (database) {
      try {
        // Compter les alertes similaires récentes
        context.recentSimilarAlerts = await this.countRecentSimilarAlerts(alert, database);

        // Compter les alertes simultanées dans la même zone
        context.simultaneousAlertsInZone = await this.countSimultaneousAlertsInZone(alert, database);

      } catch (error) {
        console.warn('[AlertPriorityManager] Erreur analyse contexte:', error);
      }
    }

    context.currentTime = Date.now();
    return context;
  }

  /**
   * Compte les alertes similaires récentes
   */
  async countRecentSimilarAlerts(alert, database) {
    return new Promise((resolve) => {
      const query = `
        SELECT COUNT(*) as count
        FROM alerts
        WHERE type = ?
        AND zone = ?
        AND created_at > datetime('now', '-1 hour')
        AND id != ?
      `;

      database.get(query, [alert.type, alert.zone, alert.id], (err, row) => {
        resolve(err ? 0 : (row?.count || 0));
      });
    });
  }

  /**
   * Compte les alertes simultanées dans la même zone
   */
  async countSimultaneousAlertsInZone(alert, database) {
    return new Promise((resolve) => {
      const query = `
        SELECT COUNT(*) as count
        FROM alerts
        WHERE zone = ?
        AND status = 'active'
        AND created_at > datetime('now', '-30 minutes')
        AND id != ?
      `;

      database.get(query, [alert.zone, alert.id], (err, row) => {
        resolve(err ? 0 : (row?.count || 0));
      });
    });
  }

  /**
   * Nettoie le cache des priorités
   */
  clearCache() {
    this.priorityCache.clear();
  }

  /**
   * Récupère les statistiques du gestionnaire de priorité
   */
  getStats() {
    return {
      cacheSize: this.priorityCache.size,
      escalationRulesEnabled: this.config.escalationRules,
      zonePriorityBonusEnabled: this.config.zonePriorityBonus,
      timeBasedPriorityEnabled: this.config.timeBasedPriority,
      userContextPriorityEnabled: this.config.userContextPriority
    };
  }

  /**
   * Met à jour la configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.clearCache(); // Vider le cache car les règles ont changé
  }

  /**
   * Valide une priorité
   */
  isValidPriority(priority) {
    return Object.values(PRIORITY_LEVELS).includes(priority);
  }

  /**
   * Compare deux priorités
   */
  comparePriorities(priority1, priority2) {
    const priorityOrder = [
      PRIORITY_LEVELS.INFO,
      PRIORITY_LEVELS.LOW,
      PRIORITY_LEVELS.MEDIUM,
      PRIORITY_LEVELS.HIGH,
      PRIORITY_LEVELS.CRITICAL
    ];

    const index1 = priorityOrder.indexOf(priority1);
    const index2 = priorityOrder.indexOf(priority2);

    if (index1 < index2) return -1;
    if (index1 > index2) return 1;
    return 0;
  }
}

module.exports = AlertPriorityManager;