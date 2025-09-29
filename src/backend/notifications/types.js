// Types et constantes pour le système de notifications MedAlert

/**
 * Types d'alertes médicales
 */
const ALERT_TYPES = {
  EMERGENCY: 'emergency',           // Urgence médicale critique
  EVACUATION: 'evacuation',        // Évacuation médicale
  MEDICAL_INFO: 'medical_info',     // Information médicale
  MAINTENANCE: 'maintenance',       // Maintenance système
  TRAINING: 'training'             // Formation/exercice
};

/**
 * Niveaux de priorité
 */
const PRIORITY_LEVELS = {
  CRITICAL: 'critical',    // Rouge - Action immédiate
  HIGH: 'high',           // Orange - Action urgente
  MEDIUM: 'medium',       // Jaune - Action normale
  LOW: 'low',             // Vert - Information
  INFO: 'info'            // Bleu - Information uniquement
};

/**
 * Canaux de notification disponibles
 */
const NOTIFICATION_CHANNELS = {
  PUSH: 'push',           // Web Push notifications
  DISCORD: 'discord',     // Discord bot/webhooks
  EMAIL: 'email',         // Email SMTP
  WEBSOCKET: 'websocket', // Temps réel WebSocket
  WEBHOOK: 'webhook'      // Webhooks externes
};

/**
 * Statuts de notification
 */
const NOTIFICATION_STATUS = {
  PENDING: 'pending',     // En attente
  SENT: 'sent',          // Envoyé
  DELIVERED: 'delivered', // Délivré
  FAILED: 'failed',      // Échec
  RETRY: 'retry'         // En cours de retry
};

/**
 * Zones Star Citizen pour géolocalisation
 */
const SC_ZONES = {
  STANTON: 'stanton',
  CRUSADER: 'crusader',
  HURSTON: 'hurston',
  MICROTECH: 'microtech',
  ARCCORP: 'arccorp',
  DEEP_SPACE: 'deep_space',
  UNKNOWN: 'unknown'
};

/**
 * Configuration des priorités avec couleurs et comportements
 */
const PRIORITY_CONFIG = {
  [PRIORITY_LEVELS.CRITICAL]: {
    color: '#ff1744',
    sound: 'critical-alert.mp3',
    vibration: [300, 100, 300, 100, 300],
    retryCount: 5,
    retryDelay: 1000,
    urgent: true
  },
  [PRIORITY_LEVELS.HIGH]: {
    color: '#ff9100',
    sound: 'high-alert.mp3',
    vibration: [200, 100, 200],
    retryCount: 3,
    retryDelay: 3000,
    urgent: true
  },
  [PRIORITY_LEVELS.MEDIUM]: {
    color: '#ffc107',
    sound: 'medium-alert.mp3',
    vibration: [100, 50, 100],
    retryCount: 2,
    retryDelay: 5000,
    urgent: false
  },
  [PRIORITY_LEVELS.LOW]: {
    color: '#4caf50',
    sound: 'low-alert.mp3',
    vibration: [100],
    retryCount: 1,
    retryDelay: 10000,
    urgent: false
  },
  [PRIORITY_LEVELS.INFO]: {
    color: '#2196f3',
    sound: null,
    vibration: null,
    retryCount: 1,
    retryDelay: 30000,
    urgent: false
  }
};

/**
 * Configuration des templates d'alertes
 */
const ALERT_TEMPLATES = {
  [ALERT_TYPES.EMERGENCY]: {
    icon: '🚨',
    title: 'Urgence Médicale',
    actionButtons: [
      { action: 'respond', label: 'Répondre', style: 'primary' },
      { action: 'share_location', label: 'Partager Position', style: 'secondary' }
    ]
  },
  [ALERT_TYPES.EVACUATION]: {
    icon: '⚕️',
    title: 'Évacuation Médicale',
    actionButtons: [
      { action: 'accept_mission', label: 'Accepter Mission', style: 'primary' },
      { action: 'view_details', label: 'Voir Détails', style: 'secondary' }
    ]
  },
  [ALERT_TYPES.MEDICAL_INFO]: {
    icon: '💊',
    title: 'Information Médicale',
    actionButtons: [
      { action: 'read_more', label: 'Lire Plus', style: 'secondary' }
    ]
  },
  [ALERT_TYPES.MAINTENANCE]: {
    icon: '🔧',
    title: 'Maintenance Système',
    actionButtons: [
      { action: 'acknowledge', label: 'Accusé Réception', style: 'secondary' }
    ]
  },
  [ALERT_TYPES.TRAINING]: {
    icon: '🎯',
    title: 'Exercice Formation',
    actionButtons: [
      { action: 'participate', label: 'Participer', style: 'primary' },
      { action: 'skip', label: 'Ignorer', style: 'secondary' }
    ]
  }
};

module.exports = {
  ALERT_TYPES,
  PRIORITY_LEVELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUS,
  SC_ZONES,
  PRIORITY_CONFIG,
  ALERT_TEMPLATES
};