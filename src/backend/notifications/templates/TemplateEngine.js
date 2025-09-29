// Moteur de templates dynamiques pour les notifications

const { ALERT_TYPES, PRIORITY_LEVELS } = require('../types');

/**
 * Moteur de templates avancé pour générer des notifications personnalisées
 * Supporte les variables dynamiques, conditions et formatage par canal
 */
class TemplateEngine {
  constructor(config = {}) {
    this.config = {
      enableCache: true,
      maxCacheSize: 1000,
      enableCustomTemplates: true,
      defaultLocale: 'fr',
      ...config
    };

    // Cache des templates compilés
    this.templateCache = new Map();

    // Templates par défaut
    this.defaultTemplates = new Map();
    this.initializeDefaultTemplates();

    // Fonctions helper disponibles dans les templates
    this.helpers = {
      formatDate: this.formatDate.bind(this),
      formatDuration: this.formatDuration.bind(this),
      capitalize: this.capitalize.bind(this),
      truncate: this.truncate.bind(this),
      colorizeByPriority: this.colorizeByPriority.bind(this),
      getEmoji: this.getEmoji.bind(this),
      formatZone: this.formatZone.bind(this),
      pluralize: this.pluralize.bind(this)
    };

    // Variables globales disponibles dans tous les templates
    this.globalVariables = {
      appName: 'MedAlert',
      version: '2.0',
      supportUrl: 'https://medalert.com/support',
      timestamp: () => new Date().toISOString()
    };
  }

  /**
   * Initialise les templates par défaut
   */
  initializeDefaultTemplates() {
    // Templates pour notifications Push
    this.defaultTemplates.set('push_emergency', {
      title: '🚨 {{alert.title}}',
      body: '{{alert.description}} - Zone: {{formatZone alert.zone}}',
      icon: '/icons/emergency.png',
      badge: '/icons/badge-emergency.png',
      tag: 'emergency-{{alert.id}}',
      requireInteraction: true,
      actions: [
        { action: 'acknowledge', title: 'Accusé réception' },
        { action: 'details', title: 'Voir détails' }
      ]
    });

    this.defaultTemplates.set('push_medical_info', {
      title: '🏥 {{alert.title}}',
      body: '{{truncate alert.description 100}}',
      icon: '/icons/medical.png',
      badge: '/icons/badge-medical.png',
      tag: 'medical-{{alert.id}}'
    });

    this.defaultTemplates.set('push_maintenance', {
      title: '🔧 {{alert.title}}',
      body: 'Maintenance programmée - {{formatZone alert.zone}}',
      icon: '/icons/maintenance.png',
      tag: 'maintenance-{{alert.id}}'
    });

    // Templates pour Discord
    this.defaultTemplates.set('discord_emergency', {
      title: '🚨 ALERTE URGENTE - {{alert.title}}',
      description: '**{{alert.description}}**\\n\\n📍 **Zone :** {{formatZone alert.zone}}\\n⏰ **Heure :** {{formatDate alert.created_at}}',
      color: '#FF0000',
      fields: [
        {
          name: '🎯 Type d\'alerte',
          value: '{{capitalize alert.type}}',
          inline: true
        },
        {
          name: '⚡ Priorité',
          value: '{{colorizeByPriority alert.priority}}',
          inline: true
        },
        {
          name: '📊 Statut',
          value: '{{capitalize alert.status}}',
          inline: true
        }
      ],
      footer: {
        text: 'MedAlert System • {{formatDate timestamp}}',
        icon_url: 'https://medalert.com/icons/logo.png'
      }
    });

    this.defaultTemplates.set('discord_medical_info', {
      title: '🏥 Information Médicale - {{alert.title}}',
      description: '{{alert.description}}',
      color: '#00A2FF',
      fields: [
        {
          name: '📍 Zone',
          value: '{{formatZone alert.zone}}',
          inline: true
        },
        {
          name: '⏰ Créée le',
          value: '{{formatDate alert.created_at}}',
          inline: true
        }
      ]
    });

    // Templates pour Email
    this.defaultTemplates.set('email_emergency', {
      subject: '🚨 ALERTE URGENTE - {{alert.title}}',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #FF0000; color: white; padding: 20px; text-align: center;">
            <h1>🚨 ALERTE URGENTE</h1>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <h2>{{alert.title}}</h2>
            <p style="font-size: 16px; line-height: 1.6;">{{alert.description}}</p>

            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Zone</td>
                <td style="padding: 10px; border: 1px solid #ddd;">{{formatZone alert.zone}}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Type</td>
                <td style="padding: 10px; border: 1px solid #ddd;">{{capitalize alert.type}}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Priorité</td>
                <td style="padding: 10px; border: 1px solid #ddd;">{{capitalize alert.priority}}</td>
              </tr>
              <tr>
                <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Créée le</td>
                <td style="padding: 10px; border: 1px solid #ddd;">{{formatDate alert.created_at}}</td>
              </tr>
            </table>

            <div style="text-align: center; margin: 30px 0;">
              <a href="{{appUrl}}/alerts/{{alert.id}}" style="background: #007BFF; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Voir l'alerte</a>
            </div>
          </div>
          <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
            MedAlert System - {{formatDate timestamp}}
          </div>
        </div>
      `,
      text: `
        ALERTE URGENTE: {{alert.title}}

        {{alert.description}}

        Zone: {{formatZone alert.zone}}
        Type: {{capitalize alert.type}}
        Priorité: {{capitalize alert.priority}}
        Créée le: {{formatDate alert.created_at}}

        Voir l'alerte: {{appUrl}}/alerts/{{alert.id}}

        --
        MedAlert System
      `
    });

    // Templates pour WebSocket
    this.defaultTemplates.set('websocket_emergency', {
      type: 'alert',
      event: 'emergency_alert',
      data: {
        id: '{{alert.id}}',
        title: '{{alert.title}}',
        description: '{{alert.description}}',
        zone: '{{alert.zone}}',
        priority: '{{alert.priority}}',
        type: '{{alert.type}}',
        created_at: '{{alert.created_at}}',
        requiresAck: true,
        sound: 'emergency',
        vibration: [200, 100, 200, 100, 200]
      }
    });
  }

  /**
   * Génère une notification à partir d'un template
   */
  async generateNotification(templateKey, channelType, data, options = {}) {
    try {
      // Construire la clé complète du template
      const fullTemplateKey = `${channelType}_${templateKey}`;

      // Récupérer le template
      const template = await this.getTemplate(fullTemplateKey, options.customTemplate);

      if (!template) {
        throw new Error(`Template non trouvé: ${fullTemplateKey}`);
      }

      // Préparer les variables
      const variables = this.prepareVariables(data, options);

      // Compiler et exécuter le template
      const result = this.compileTemplate(template, variables);

      return {
        ...result,
        templateUsed: fullTemplateKey,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[TemplateEngine] Erreur génération notification:', error);

      // Fallback vers un template simple
      return this.generateFallbackNotification(channelType, data);
    }
  }

  /**
   * Récupère un template (cache ou défaut)
   */
  async getTemplate(templateKey, customTemplate = null) {
    // Template personnalisé fourni
    if (customTemplate) {
      return customTemplate;
    }

    // Template en cache
    if (this.config.enableCache && this.templateCache.has(templateKey)) {
      return this.templateCache.get(templateKey);
    }

    // Template par défaut
    if (this.defaultTemplates.has(templateKey)) {
      const template = this.defaultTemplates.get(templateKey);

      if (this.config.enableCache) {
        this.templateCache.set(templateKey, template);
      }

      return template;
    }

    return null;
  }

  /**
   * Prépare les variables pour le template
   */
  prepareVariables(data, options) {
    return {
      ...this.globalVariables,
      ...data,
      ...options.variables,
      // Helpers disponibles dans les templates
      ...this.helpers,
      // Variables computed
      timestamp: new Date().toISOString(),
      appUrl: options.appUrl || 'https://medalert.com'
    };
  }

  /**
   * Compile un template avec les variables
   */
  compileTemplate(template, variables) {
    if (typeof template === 'string') {
      return this.interpolateString(template, variables);
    }

    if (Array.isArray(template)) {
      return template.map(item => this.compileTemplate(item, variables));
    }

    if (typeof template === 'object' && template !== null) {
      const result = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.compileTemplate(value, variables);
      }
      return result;
    }

    return template;
  }

  /**
   * Interpole une chaîne avec les variables
   */
  interpolateString(template, variables) {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
      try {
        const trimmedExpr = expression.trim();

        // Gérer les expressions simples (variable.property)
        if (trimmedExpr.includes('.')) {
          return this.resolveNestedProperty(trimmedExpr, variables);
        }

        // Gérer les fonctions helper (formatDate variable)
        if (trimmedExpr.includes(' ')) {
          return this.evaluateHelperFunction(trimmedExpr, variables);
        }

        // Variable simple
        return variables[trimmedExpr] || match;

      } catch (error) {
        console.warn(`[TemplateEngine] Erreur interpolation "${expression}":`, error);
        return match;
      }
    });
  }

  /**
   * Résout une propriété imbriquée (ex: alert.title)
   */
  resolveNestedProperty(path, variables) {
    return path.split('.').reduce((obj, key) => {
      return obj && obj[key] !== undefined ? obj[key] : undefined;
    }, variables);
  }

  /**
   * Évalue une fonction helper
   */
  evaluateHelperFunction(expression, variables) {
    const parts = expression.split(' ');
    const helperName = parts[0];
    const args = parts.slice(1);

    if (this.helpers[helperName]) {
      const resolvedArgs = args.map(arg =>
        arg.includes('.') ? this.resolveNestedProperty(arg, variables) : variables[arg] || arg
      );

      return this.helpers[helperName](...resolvedArgs);
    }

    return expression;
  }

  /**
   * Génère une notification de fallback en cas d'erreur
   */
  generateFallbackNotification(channelType, data) {
    const alert = data.alert || {};

    const fallbacks = {
      push: {
        title: alert.title || 'Nouvelle alerte',
        body: alert.description || 'Alerte MedAlert',
        icon: '/icons/default.png'
      },
      discord: {
        title: alert.title || 'Nouvelle alerte',
        description: alert.description || 'Alerte MedAlert',
        color: '#007BFF'
      },
      email: {
        subject: alert.title || 'Nouvelle alerte',
        text: `${alert.title || 'Nouvelle alerte'}\\n\\n${alert.description || 'Alerte MedAlert'}`
      },
      websocket: {
        type: 'alert',
        data: {
          id: alert.id,
          title: alert.title || 'Nouvelle alerte',
          description: alert.description || 'Alerte MedAlert'
        }
      }
    };

    return fallbacks[channelType] || fallbacks.push;
  }

  // === FONCTIONS HELPER ===

  /**
   * Formate une date
   */
  formatDate(date, format = 'full') {
    if (!date) return '';

    const d = new Date(date);
    const locale = this.config.defaultLocale;

    switch (format) {
      case 'short':
        return d.toLocaleDateString(locale);
      case 'time':
        return d.toLocaleTimeString(locale);
      case 'full':
      default:
        return d.toLocaleString(locale);
    }
  }

  /**
   * Formate une durée
   */
  formatDuration(milliseconds) {
    if (!milliseconds) return '';

    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}j ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}min`;
    if (minutes > 0) return `${minutes}min`;
    return `${seconds}s`;
  }

  /**
   * Met en forme le nom d'une zone
   */
  formatZone(zone) {
    if (!zone) return 'Non spécifiée';

    return zone
      .split('_')
      .map(word => this.capitalize(word))
      .join(' ');
  }

  /**
   * Capitalise un texte
   */
  capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  /**
   * Tronque un texte
   */
  truncate(text, length = 100) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  /**
   * Colorise selon la priorité
   */
  colorizeByPriority(priority) {
    const colors = {
      [PRIORITY_LEVELS.CRITICAL]: '🔴 CRITIQUE',
      [PRIORITY_LEVELS.HIGH]: '🟠 ÉLEVÉE',
      [PRIORITY_LEVELS.MEDIUM]: '🟡 MOYENNE',
      [PRIORITY_LEVELS.LOW]: '🟢 FAIBLE',
      [PRIORITY_LEVELS.INFO]: '🔵 INFO'
    };

    return colors[priority] || priority;
  }

  /**
   * Récupère un emoji selon le type d'alerte
   */
  getEmoji(alertType) {
    const emojis = {
      [ALERT_TYPES.EMERGENCY]: '🚨',
      [ALERT_TYPES.EVACUATION]: '🚪',
      [ALERT_TYPES.MEDICAL_INFO]: '🏥',
      [ALERT_TYPES.MAINTENANCE]: '🔧',
      [ALERT_TYPES.TRAINING]: '🎓'
    };

    return emojis[alertType] || '📢';
  }

  /**
   * Pluralise un mot selon un nombre
   */
  pluralize(count, singular, plural = null) {
    if (count === 1) return singular;
    return plural || (singular + 's');
  }

  /**
   * Ajoute un template personnalisé
   */
  addCustomTemplate(key, template) {
    if (!this.config.enableCustomTemplates) {
      throw new Error('Templates personnalisés désactivés');
    }

    this.defaultTemplates.set(key, template);

    if (this.config.enableCache) {
      this.templateCache.delete(key); // Invalider le cache
    }
  }

  /**
   * Supprime un template personnalisé
   */
  removeCustomTemplate(key) {
    this.defaultTemplates.delete(key);
    this.templateCache.delete(key);
  }

  /**
   * Liste tous les templates disponibles
   */
  listTemplates() {
    return Array.from(this.defaultTemplates.keys());
  }

  /**
   * Valide un template
   */
  validateTemplate(template) {
    const errors = [];

    if (typeof template !== 'object') {
      errors.push('Le template doit être un objet');
      return errors;
    }

    // Validation spécifique par type de canal
    if (template.title && typeof template.title !== 'string') {
      errors.push('Le titre doit être une chaîne de caractères');
    }

    if (template.description && typeof template.description !== 'string') {
      errors.push('La description doit être une chaîne de caractères');
    }

    return errors;
  }

  /**
   * Nettoie le cache des templates
   */
  clearCache() {
    this.templateCache.clear();
  }

  /**
   * Récupère les statistiques du moteur
   */
  getStats() {
    return {
      cacheSize: this.templateCache.size,
      totalTemplates: this.defaultTemplates.size,
      cacheEnabled: this.config.enableCache,
      customTemplatesEnabled: this.config.enableCustomTemplates
    };
  }
}

module.exports = TemplateEngine;