// Templates dynamiques pour les notifications MedAlert

const { ALERT_TYPES, PRIORITY_LEVELS, PRIORITY_CONFIG, ALERT_TEMPLATES } = require('../types');

/**
 * Génère le contenu d'une notification selon le type et le canal
 */
class AlertTemplateEngine {
  /**
   * Génère le template pour une notification Push
   */
  static generatePushNotification(alert, priority = PRIORITY_LEVELS.MEDIUM) {
    const template = ALERT_TEMPLATES[alert.type] || ALERT_TEMPLATES[ALERT_TYPES.MEDICAL_INFO];
    const config = PRIORITY_CONFIG[priority];

    return {
      title: `${template.icon} ${template.title}`,
      body: this.truncateMessage(alert.originalMessage, 150),
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      image: this.getAlertImage(alert.type),
      vibrate: config.vibration,
      sound: config.sound,
      tag: `medalert-${alert.id}`,
      renotify: true,
      requireInteraction: config.urgent,
      actions: template.actionButtons.slice(0, 2).map(btn => ({
        action: btn.action,
        title: btn.label,
        icon: this.getActionIcon(btn.action)
      })),
      data: {
        alertId: alert.id,
        type: alert.type,
        priority: priority,
        timestamp: Date.now(),
        location: alert.location,
        zone: alert.zone
      }
    };
  }

  /**
   * Génère un embed Discord riche
   */
  static generateDiscordEmbed(alert, priority = PRIORITY_LEVELS.MEDIUM) {
    const template = ALERT_TEMPLATES[alert.type] || ALERT_TEMPLATES[ALERT_TYPES.MEDICAL_INFO];
    const config = PRIORITY_CONFIG[priority];

    const embed = {
      title: `${template.icon} ${template.title}`,
      description: alert.originalMessage,
      color: parseInt(config.color.replace('#', ''), 16),
      timestamp: new Date(alert.createdAt || Date.now()).toISOString(),
      footer: {
        text: 'MedAlert System',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png'
      },
      fields: [
        {
          name: '👤 Auteur',
          value: alert.username || 'Anonyme',
          inline: true
        },
        {
          name: '🆔 ID Alerte',
          value: `#${alert.id}`,
          inline: true
        },
        {
          name: '⚠️ Priorité',
          value: this.getPriorityEmoji(priority) + ' ' + priority.toUpperCase(),
          inline: true
        }
      ]
    };

    // Ajouter des champs optionnels
    if (alert.location) {
      embed.fields.push({
        name: '📍 Localisation',
        value: alert.location,
        inline: true
      });
    }

    if (alert.injuryType) {
      embed.fields.push({
        name: '🩹 Type de Blessure',
        value: alert.injuryType,
        inline: true
      });
    }

    if (alert.zone) {
      embed.fields.push({
        name: '🌌 Zone',
        value: alert.zone.toUpperCase(),
        inline: true
      });
    }

    return embed;
  }

  /**
   * Génère un template email HTML
   */
  static generateEmailTemplate(alert, priority = PRIORITY_LEVELS.MEDIUM, recipientName = 'Médecin') {
    const template = ALERT_TEMPLATES[alert.type] || ALERT_TEMPLATES[ALERT_TYPES.MEDICAL_INFO];
    const config = PRIORITY_CONFIG[priority];

    return {
      subject: `${template.icon} [${priority.toUpperCase()}] ${template.title} - #${alert.id}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MedAlert - ${template.title}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0e1a; color: #eaf6ff; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #181c26; border-radius: 12px; overflow: hidden; border: 2px solid ${config.color}; }
            .header { background: linear-gradient(135deg, ${config.color}22, ${config.color}44); padding: 25px; text-align: center; border-bottom: 2px solid ${config.color}; }
            .content { padding: 30px; }
            .alert-badge { display: inline-block; background: ${config.color}; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-bottom: 20px; }
            .message { background: #23273a; padding: 20px; border-radius: 8px; border-left: 4px solid ${config.color}; margin: 20px 0; font-size: 16px; line-height: 1.6; }
            .details { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 25px 0; }
            .detail-item { background: #2d3748; padding: 15px; border-radius: 8px; }
            .detail-label { font-weight: bold; color: #7fa7c7; font-size: 12px; text-transform: uppercase; }
            .detail-value { margin-top: 5px; font-size: 14px; }
            .actions { text-align: center; margin-top: 30px; }
            .btn { display: inline-block; padding: 12px 24px; margin: 5px; border-radius: 6px; text-decoration: none; font-weight: bold; transition: all 0.3s; }
            .btn-primary { background: ${config.color}; color: white; }
            .btn-secondary { background: #4a5568; color: white; }
            .footer { background: #131720; padding: 20px; text-align: center; font-size: 12px; color: #7fa7c7; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">${template.icon} MedAlert ${template.title}</h1>
              <div class="alert-badge">${priority.toUpperCase()} PRIORITY</div>
            </div>

            <div class="content">
              <p>Bonjour ${recipientName},</p>
              <p>Une nouvelle alerte médicale vient d'être émise dans le système MedAlert.</p>

              <div class="message">
                ${alert.originalMessage}
              </div>

              <div class="details">
                <div class="detail-item">
                  <div class="detail-label">Auteur</div>
                  <div class="detail-value">${alert.username || 'Anonyme'}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">ID Alerte</div>
                  <div class="detail-value">#${alert.id}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Date</div>
                  <div class="detail-value">${new Date(alert.createdAt || Date.now()).toLocaleString('fr-FR')}</div>
                </div>
                ${alert.location ? `
                <div class="detail-item">
                  <div class="detail-label">Localisation</div>
                  <div class="detail-value">${alert.location}</div>
                </div>` : ''}
                ${alert.injuryType ? `
                <div class="detail-item">
                  <div class="detail-label">Type de Blessure</div>
                  <div class="detail-value">${alert.injuryType}</div>
                </div>` : ''}
                ${alert.zone ? `
                <div class="detail-item">
                  <div class="detail-label">Zone</div>
                  <div class="detail-value">${alert.zone.toUpperCase()}</div>
                </div>` : ''}
              </div>

              <div class="actions">
                <a href="{MEDALERT_URL}/alert/${alert.id}" class="btn btn-primary">Voir l'Alerte</a>
                <a href="{MEDALERT_URL}/dashboard" class="btn btn-secondary">Dashboard</a>
              </div>
            </div>

            <div class="footer">
              <p>MedAlert System - Star Citizen Medical Division</p>
              <p>Cette notification a été générée automatiquement.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: this.generatePlainTextEmail(alert, priority, recipientName)
    };
  }

  /**
   * Génère une notification WebSocket pour temps réel
   */
  static generateWebSocketNotification(alert, priority = PRIORITY_LEVELS.MEDIUM) {
    const template = ALERT_TEMPLATES[alert.type] || ALERT_TEMPLATES[ALERT_TYPES.MEDICAL_INFO];
    const config = PRIORITY_CONFIG[priority];

    return {
      type: 'new_alert',
      alert: {
        ...alert,
        template: template,
        priority: priority,
        config: config
      },
      timestamp: Date.now(),
      requiresAction: config.urgent
    };
  }

  // Méthodes utilitaires
  static truncateMessage(message, maxLength) {
    if (!message) return '';
    return message.length > maxLength
      ? message.substring(0, maxLength - 3) + '...'
      : message;
  }

  static getAlertImage(alertType) {
    const images = {
      [ALERT_TYPES.EMERGENCY]: '/images/emergency.jpg',
      [ALERT_TYPES.EVACUATION]: '/images/evacuation.jpg',
      [ALERT_TYPES.MEDICAL_INFO]: '/images/medical-info.jpg',
      [ALERT_TYPES.MAINTENANCE]: '/images/maintenance.jpg',
      [ALERT_TYPES.TRAINING]: '/images/training.jpg'
    };
    return images[alertType] || '/images/default-alert.jpg';
  }

  static getActionIcon(action) {
    const icons = {
      respond: '/icons/respond.png',
      share_location: '/icons/location.png',
      accept_mission: '/icons/accept.png',
      view_details: '/icons/details.png',
      read_more: '/icons/read.png',
      acknowledge: '/icons/check.png',
      participate: '/icons/participate.png',
      skip: '/icons/skip.png'
    };
    return icons[action] || '/icons/default.png';
  }

  static getPriorityEmoji(priority) {
    const emojis = {
      [PRIORITY_LEVELS.CRITICAL]: '🔴',
      [PRIORITY_LEVELS.HIGH]: '🟠',
      [PRIORITY_LEVELS.MEDIUM]: '🟡',
      [PRIORITY_LEVELS.LOW]: '🟢',
      [PRIORITY_LEVELS.INFO]: '🔵'
    };
    return emojis[priority] || '⚪';
  }

  static generatePlainTextEmail(alert, priority, recipientName) {
    return `
MedAlert - Nouvelle Alerte ${priority.toUpperCase()}

Bonjour ${recipientName},

Une nouvelle alerte médicale vient d'être émise :

Message: ${alert.originalMessage}
Auteur: ${alert.username || 'Anonyme'}
ID: #${alert.id}
Date: ${new Date(alert.createdAt || Date.now()).toLocaleString('fr-FR')}
${alert.location ? `Localisation: ${alert.location}` : ''}
${alert.injuryType ? `Type de blessure: ${alert.injuryType}` : ''}
${alert.zone ? `Zone: ${alert.zone.toUpperCase()}` : ''}

Pour plus de détails, consultez: {MEDALERT_URL}/alert/${alert.id}

---
MedAlert System - Star Citizen Medical Division
    `.trim();
  }
}

module.exports = AlertTemplateEngine;