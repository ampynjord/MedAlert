// Gestionnaire des préférences utilisateur pour les notifications

const EventEmitter = require('events');
const { ALERT_TYPES, PRIORITY_LEVELS, NOTIFICATION_CHANNELS } = require('../types');

/**
 * Gestionnaire complet des préférences de notification utilisateur
 * Gère les canaux, horaires, priorités et filtres personnalisés
 */
class UserPreferencesManager extends EventEmitter {
  constructor(database, config = {}) {
    super();

    this.database = database;
    this.config = {
      enableScheduling: true,
      enableZoneFilters: true,
      enablePriorityFilters: true,
      defaultQuietHours: { start: '22:00', end: '07:00' },
      maxCustomFilters: 10,
      ...config
    };

    // Cache des préférences utilisateur
    this.preferencesCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    // Préférences par défaut
    this.defaultPreferences = {
      channels: {
        push: { enabled: true, priority: [PRIORITY_LEVELS.HIGH, PRIORITY_LEVELS.CRITICAL] },
        discord: { enabled: true, priority: [PRIORITY_LEVELS.MEDIUM, PRIORITY_LEVELS.HIGH, PRIORITY_LEVELS.CRITICAL] },
        email: { enabled: false, priority: [PRIORITY_LEVELS.CRITICAL] },
        websocket: { enabled: true, priority: Object.values(PRIORITY_LEVELS) }
      },
      alertTypes: {
        [ALERT_TYPES.EMERGENCY]: { enabled: true, channels: ['push', 'discord', 'websocket'] },
        [ALERT_TYPES.EVACUATION]: { enabled: true, channels: ['push', 'discord', 'websocket'] },
        [ALERT_TYPES.MEDICAL_INFO]: { enabled: true, channels: ['push', 'websocket'] },
        [ALERT_TYPES.MAINTENANCE]: { enabled: true, channels: ['websocket'] },
        [ALERT_TYPES.TRAINING]: { enabled: false, channels: ['websocket'] }
      },
      scheduling: {
        quietHours: this.config.defaultQuietHours,
        timezone: 'Europe/Paris',
        doNotDisturb: false,
        emergencyOverride: true // Les urgences passent même en mode silencieux
      },
      filters: {
        zones: [], // Zones spécifiques à surveiller (vide = toutes)
        excludeZones: [], // Zones à exclure
        keywords: [], // Mots-clés à surveiller
        excludeKeywords: [], // Mots-clés à ignorer
        customRules: [] // Règles personnalisées
      },
      delivery: {
        batchNotifications: false, // Grouper les notifications non-urgentes
        maxBatchSize: 5,
        batchDelay: 300000, // 5 minutes
        requireReadConfirmation: false,
        soundEnabled: true,
        vibrationEnabled: true
      }
    };
  }

  /**
   * Récupère les préférences d'un utilisateur
   */
  async getUserPreferences(userId) {
    // Vérifier le cache
    const cacheKey = `user_${userId}`;
    if (this.preferencesCache.has(cacheKey)) {
      const cached = this.preferencesCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.preferences;
      }
    }

    try {
      // Charger depuis la base de données
      const preferences = await this.loadUserPreferencesFromDB(userId);

      // Fusionner avec les préférences par défaut
      const mergedPreferences = this.mergeWithDefaults(preferences);

      // Mettre en cache
      this.preferencesCache.set(cacheKey, {
        preferences: mergedPreferences,
        timestamp: Date.now()
      });

      return mergedPreferences;

    } catch (error) {
      console.error('[UserPreferencesManager] Erreur chargement préférences:', error);
      return this.defaultPreferences;
    }
  }

  /**
   * Sauvegarde les préférences d'un utilisateur
   */
  async saveUserPreferences(userId, preferences) {
    try {
      // Valider les préférences
      const validationErrors = this.validatePreferences(preferences);
      if (validationErrors.length > 0) {
        throw new Error(`Préférences invalides: ${validationErrors.join(', ')}`);
      }

      // Fusionner avec les préférences existantes
      const existingPreferences = await this.getUserPreferences(userId);
      const mergedPreferences = this.deepMerge(existingPreferences, preferences);

      // Sauvegarder en base
      await this.saveUserPreferencesToDB(userId, mergedPreferences);

      // Mettre à jour le cache
      const cacheKey = `user_${userId}`;
      this.preferencesCache.set(cacheKey, {
        preferences: mergedPreferences,
        timestamp: Date.now()
      });

      // Émettre un événement
      this.emit('preferences_updated', { userId, preferences: mergedPreferences });

      console.log(`[UserPreferencesManager] Préférences sauvegardées pour l'utilisateur ${userId}`);
      return mergedPreferences;

    } catch (error) {
      console.error('[UserPreferencesManager] Erreur sauvegarde préférences:', error);
      throw error;
    }
  }

  /**
   * Charge les préférences depuis la base de données
   */
  async loadUserPreferencesFromDB(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT notification_preferences
        FROM users
        WHERE id = ?
      `;

      this.database.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row && row.notification_preferences) {
          try {
            resolve(JSON.parse(row.notification_preferences));
          } catch (parseError) {
            console.warn('[UserPreferencesManager] Erreur parsing préférences, utilisation défaut');
            resolve({});
          }
        } else {
          resolve({});
        }
      });
    });
  }

  /**
   * Sauvegarde les préférences en base de données
   */
  async saveUserPreferencesToDB(userId, preferences) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE users
        SET notification_preferences = ?, updated_at = datetime('now')
        WHERE id = ?
      `;

      this.database.run(query, [JSON.stringify(preferences), userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Détermine si un utilisateur doit recevoir une notification
   */
  async shouldReceiveNotification(userId, alert, notificationChannel, currentTime = new Date()) {
    try {
      const preferences = await this.getUserPreferences(userId);

      // Vérifier si le canal est activé
      if (!this.isChannelEnabled(preferences, notificationChannel, alert.priority)) {
        return false;
      }

      // Vérifier si le type d'alerte est activé
      if (!this.isAlertTypeEnabled(preferences, alert.type, notificationChannel)) {
        return false;
      }

      // Vérifier les heures silencieuses
      if (this.isInQuietHours(preferences, currentTime) && !this.isEmergencyOverride(preferences, alert)) {
        return false;
      }

      // Vérifier les filtres de zone
      if (!this.passesZoneFilter(preferences, alert.zone)) {
        return false;
      }

      // Vérifier les filtres de mots-clés
      if (!this.passesKeywordFilter(preferences, alert)) {
        return false;
      }

      // Vérifier les règles personnalisées
      if (!this.passesCustomRules(preferences, alert)) {
        return false;
      }

      return true;

    } catch (error) {
      console.error('[UserPreferencesManager] Erreur vérification notification:', error);
      return true; // En cas d'erreur, autoriser la notification par défaut
    }
  }

  /**
   * Vérifie si un canal est activé pour une priorité donnée
   */
  isChannelEnabled(preferences, channel, priority) {
    const channelPrefs = preferences.channels[channel];
    if (!channelPrefs || !channelPrefs.enabled) {
      return false;
    }

    return channelPrefs.priority.includes(priority);
  }

  /**
   * Vérifie si un type d'alerte est activé pour un canal
   */
  isAlertTypeEnabled(preferences, alertType, channel) {
    const alertTypePrefs = preferences.alertTypes[alertType];
    if (!alertTypePrefs || !alertTypePrefs.enabled) {
      return false;
    }

    return alertTypePrefs.channels.includes(channel);
  }

  /**
   * Vérifie si on est dans les heures silencieuses
   */
  isInQuietHours(preferences, currentTime) {
    if (!this.config.enableScheduling || preferences.scheduling.doNotDisturb) {
      return preferences.scheduling.doNotDisturb;
    }

    const quietHours = preferences.scheduling.quietHours;
    if (!quietHours.start || !quietHours.end) {
      return false;
    }

    const now = currentTime.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: preferences.scheduling.timezone
    });

    const start = quietHours.start;
    const end = quietHours.end;

    // Gérer le cas où les heures silencieuses passent minuit
    if (start > end) {
      return now >= start || now <= end;
    } else {
      return now >= start && now <= end;
    }
  }

  /**
   * Vérifie si l'alerte peut passer outre les heures silencieuses
   */
  isEmergencyOverride(preferences, alert) {
    return preferences.scheduling.emergencyOverride &&
           (alert.priority === PRIORITY_LEVELS.CRITICAL || alert.type === ALERT_TYPES.EMERGENCY);
  }

  /**
   * Vérifie les filtres de zone
   */
  passesZoneFilter(preferences, alertZone) {
    if (!this.config.enableZoneFilters) {
      return true;
    }

    const filters = preferences.filters;

    // Si des zones spécifiques sont définies
    if (filters.zones.length > 0) {
      if (!filters.zones.includes(alertZone)) {
        return false;
      }
    }

    // Vérifier les zones exclues
    if (filters.excludeZones.length > 0) {
      if (filters.excludeZones.includes(alertZone)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Vérifie les filtres de mots-clés
   */
  passesKeywordFilter(preferences, alert) {
    const filters = preferences.filters;
    const content = `${alert.title} ${alert.description}`.toLowerCase();

    // Vérifier les mots-clés à surveiller
    if (filters.keywords.length > 0) {
      const hasKeyword = filters.keywords.some(keyword =>
        content.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) {
        return false;
      }
    }

    // Vérifier les mots-clés à exclure
    if (filters.excludeKeywords.length > 0) {
      const hasExcludedKeyword = filters.excludeKeywords.some(keyword =>
        content.includes(keyword.toLowerCase())
      );
      if (hasExcludedKeyword) {
        return false;
      }
    }

    return true;
  }

  /**
   * Vérifie les règles personnalisées
   */
  passesCustomRules(preferences, alert) {
    const customRules = preferences.filters.customRules;

    for (const rule of customRules) {
      if (!this.evaluateCustomRule(rule, alert)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Évalue une règle personnalisée
   */
  evaluateCustomRule(rule, alert) {
    try {
      switch (rule.type) {
        case 'priority_zone':
          return rule.zones.includes(alert.zone) && rule.priorities.includes(alert.priority);

        case 'time_restriction':
          const now = new Date();
          const hour = now.getHours();
          return hour >= rule.startHour && hour <= rule.endHour;

        case 'frequency_limit':
          // Cette règle nécessiterait un tracking des notifications récentes
          return true; // Simplified for now

        default:
          return true;
      }
    } catch (error) {
      console.warn('[UserPreferencesManager] Erreur évaluation règle personnalisée:', error);
      return true;
    }
  }

  /**
   * Ajoute une règle personnalisée
   */
  async addCustomRule(userId, rule) {
    const preferences = await this.getUserPreferences(userId);

    if (preferences.filters.customRules.length >= this.config.maxCustomFilters) {
      throw new Error(`Limite de ${this.config.maxCustomFilters} règles personnalisées atteinte`);
    }

    const ruleWithId = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...rule
    };

    preferences.filters.customRules.push(ruleWithId);
    await this.saveUserPreferences(userId, preferences);

    return ruleWithId;
  }

  /**
   * Supprime une règle personnalisée
   */
  async removeCustomRule(userId, ruleId) {
    const preferences = await this.getUserPreferences(userId);

    preferences.filters.customRules = preferences.filters.customRules.filter(
      rule => rule.id !== ruleId
    );

    await this.saveUserPreferences(userId, preferences);
  }

  /**
   * Met à jour les heures silencieuses
   */
  async updateQuietHours(userId, startTime, endTime) {
    const preferences = await this.getUserPreferences(userId);

    preferences.scheduling.quietHours = {
      start: startTime,
      end: endTime
    };

    await this.saveUserPreferences(userId, preferences);
  }

  /**
   * Active/désactive un canal de notification
   */
  async toggleChannel(userId, channel, enabled, priorities = null) {
    const preferences = await this.getUserPreferences(userId);

    if (!preferences.channels[channel]) {
      throw new Error(`Canal inconnu: ${channel}`);
    }

    preferences.channels[channel].enabled = enabled;

    if (priorities) {
      preferences.channels[channel].priority = priorities;
    }

    await this.saveUserPreferences(userId, preferences);
  }

  /**
   * Met à jour les préférences d'un type d'alerte
   */
  async updateAlertTypePreferences(userId, alertType, enabled, channels = null) {
    const preferences = await this.getUserPreferences(userId);

    if (!preferences.alertTypes[alertType]) {
      throw new Error(`Type d'alerte inconnu: ${alertType}`);
    }

    preferences.alertTypes[alertType].enabled = enabled;

    if (channels) {
      preferences.alertTypes[alertType].channels = channels;
    }

    await this.saveUserPreferences(userId, preferences);
  }

  /**
   * Exporte les préférences d'un utilisateur
   */
  async exportUserPreferences(userId) {
    const preferences = await this.getUserPreferences(userId);

    return {
      userId,
      exportedAt: new Date().toISOString(),
      version: '2.0',
      preferences
    };
  }

  /**
   * Importe les préférences d'un utilisateur
   */
  async importUserPreferences(userId, exportedData) {
    if (!exportedData.preferences) {
      throw new Error('Données d\'importation invalides');
    }

    const validationErrors = this.validatePreferences(exportedData.preferences);
    if (validationErrors.length > 0) {
      throw new Error(`Préférences invalides: ${validationErrors.join(', ')}`);
    }

    await this.saveUserPreferences(userId, exportedData.preferences);

    console.log(`[UserPreferencesManager] Préférences importées pour l'utilisateur ${userId}`);
  }

  /**
   * Valide les préférences utilisateur
   */
  validatePreferences(preferences) {
    const errors = [];

    // Valider la structure des canaux
    if (preferences.channels) {
      for (const [channel, config] of Object.entries(preferences.channels)) {
        if (!Object.values(NOTIFICATION_CHANNELS).includes(channel)) {
          errors.push(`Canal inconnu: ${channel}`);
        }

        if (config.priority && !Array.isArray(config.priority)) {
          errors.push(`Priorités du canal ${channel} doivent être un tableau`);
        }
      }
    }

    // Valider les types d'alerte
    if (preferences.alertTypes) {
      for (const [alertType, config] of Object.entries(preferences.alertTypes)) {
        if (!Object.values(ALERT_TYPES).includes(alertType)) {
          errors.push(`Type d'alerte inconnu: ${alertType}`);
        }

        if (config.channels && !Array.isArray(config.channels)) {
          errors.push(`Canaux du type ${alertType} doivent être un tableau`);
        }
      }
    }

    // Valider les heures silencieuses
    if (preferences.scheduling?.quietHours) {
      const { start, end } = preferences.scheduling.quietHours;
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

      if (start && !timeRegex.test(start)) {
        errors.push('Format d\'heure de début invalide (HH:MM attendu)');
      }

      if (end && !timeRegex.test(end)) {
        errors.push('Format d\'heure de fin invalide (HH:MM attendu)');
      }
    }

    return errors;
  }

  /**
   * Fusionne les préférences avec les valeurs par défaut
   */
  mergeWithDefaults(userPreferences) {
    return this.deepMerge(this.defaultPreferences, userPreferences);
  }

  /**
   * Fusion profonde de deux objets
   */
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Récupère les statistiques des préférences
   */
  async getPreferencesStats() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN notification_preferences IS NOT NULL THEN 1 END) as users_with_prefs,
          COUNT(CASE WHEN notification_preferences LIKE '%"doNotDisturb":true%' THEN 1 END) as dnd_users
        FROM users
      `;

      this.database.get(query, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            totalUsers: row.total_users,
            usersWithPreferences: row.users_with_prefs,
            dndUsers: row.dnd_users,
            cacheSize: this.preferencesCache.size
          });
        }
      });
    });
  }

  /**
   * Nettoie le cache des préférences
   */
  clearCache() {
    this.preferencesCache.clear();
  }

  /**
   * Nettoie les préférences expirées du cache
   */
  cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, cached] of this.preferencesCache) {
      if (now - cached.timestamp > this.cacheTimeout) {
        this.preferencesCache.delete(key);
      }
    }
  }

  /**
   * Nettoyage des ressources
   */
  cleanup() {
    this.clearCache();
    this.removeAllListeners();
  }
}

module.exports = UserPreferencesManager;