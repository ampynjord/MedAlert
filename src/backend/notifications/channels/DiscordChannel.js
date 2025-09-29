// Canal de notification Discord avec webhooks et bot intégré

const { WebhookClient, EmbedBuilder } = require('discord.js');
const BaseChannel = require('./BaseChannel');
const { PRIORITY_LEVELS, PRIORITY_CONFIG } = require('../types');

/**
 * Canal pour les notifications Discord
 * Supporte les webhooks, embeds riches et boutons d'action
 */
class DiscordChannel extends BaseChannel {
  constructor(config = {}) {
    super('discord', config);

    this.webhooks = new Map(); // Webhooks par serveur/canal
    this.botClient = null; // Client bot Discord (optionnel)
    this.messageTemplates = new Map();

    // Configuration par défaut
    this.defaultConfig = {
      allowMentions: false,
      embedColor: '#1bb6ff',
      maxEmbedFields: 25,
      maxContentLength: 2000,
      ...config.defaults
    };
  }

  /**
   * Initialise le canal Discord
   */
  async initialize() {
    try {
      // Initialiser les webhooks
      await this.initializeWebhooks();

      // Initialiser le bot Discord si configuré
      if (this.config.botToken) {
        await this.initializeBot();
      }

      console.log(`[DiscordChannel] Initialisé avec ${this.webhooks.size} webhooks`);

    } catch (error) {
      console.error('[DiscordChannel] Erreur d\'initialisation:', error);
      throw error;
    }
  }

  /**
   * Initialise les webhooks Discord
   */
  async initializeWebhooks() {
    if (!this.config.webhooks || !Array.isArray(this.config.webhooks)) {
      console.warn('[DiscordChannel] Aucun webhook configuré');
      return;
    }

    for (const webhookConfig of this.config.webhooks) {
      try {
        const webhook = new WebhookClient({
          id: webhookConfig.id,
          token: webhookConfig.token
        });

        // Tester le webhook
        await this.testWebhook(webhook, webhookConfig.name);

        this.webhooks.set(webhookConfig.name || webhookConfig.id, {
          client: webhook,
          config: webhookConfig,
          lastUsed: null,
          errorCount: 0
        });

        console.log(`[DiscordChannel] Webhook '${webhookConfig.name}' connecté`);

      } catch (error) {
        console.error(`[DiscordChannel] Erreur webhook '${webhookConfig.name}':`, error);
      }
    }
  }

  /**
   * Initialise le bot Discord (optionnel)
   */
  async initializeBot() {
    const { Client, GatewayIntentBits } = require('discord.js');

    this.botClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
      ]
    });

    this.botClient.on('ready', () => {
      console.log(`[DiscordChannel] Bot connecté: ${this.botClient.user.tag}`);
    });

    this.botClient.on('error', (error) => {
      console.error('[DiscordChannel] Erreur bot:', error);
    });

    await this.botClient.login(this.config.botToken);
  }

  /**
   * Teste un webhook
   */
  async testWebhook(webhook, name) {
    try {
      await webhook.send({
        content: `🔧 Test de connexion MedAlert - ${new Date().toLocaleString('fr-FR')}`,
        username: 'MedAlert System'
      });
      return true;
    } catch (error) {
      if (error.code !== 10015) { // Ignore "Unknown Webhook" lors des tests
        throw error;
      }
      return false;
    }
  }

  /**
   * Envoie une notification Discord
   */
  async send(content, options = {}) {
    const {
      webhookName = 'default',
      userId = null,
      priority = PRIORITY_LEVELS.MEDIUM,
      allowMentions = this.defaultConfig.allowMentions
    } = options;

    // Construire le message Discord
    const discordMessage = this.buildDiscordMessage(content, priority, options);

    // Déterminer les webhooks cibles
    const targetWebhooks = webhookName === 'all'
      ? Array.from(this.webhooks.values())
      : [this.webhooks.get(webhookName)].filter(Boolean);

    if (targetWebhooks.length === 0) {
      throw new Error(`Aucun webhook Discord trouvé: ${webhookName}`);
    }

    console.log(`[DiscordChannel] Envoi vers ${targetWebhooks.length} webhooks`);

    // Envoyer à tous les webhooks cibles
    const results = await Promise.allSettled(
      targetWebhooks.map(webhookData =>
        this.sendToWebhook(webhookData, discordMessage, options)
      )
    );

    // Analyser les résultats
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;

    return {
      totalWebhooks: targetWebhooks.length,
      successful,
      failed,
      details: results.map((result, index) => ({
        webhook: targetWebhooks[index].config.name,
        success: result.status === 'fulfilled',
        messageId: result.status === 'fulfilled' ? result.value.id : null,
        error: result.status === 'rejected' ? result.reason.message : null
      }))
    };
  }

  /**
   * Construit le message Discord
   */
  buildDiscordMessage(content, priority, options) {
    const priorityConfig = PRIORITY_CONFIG[priority];

    // Créer l'embed principal
    const embed = new EmbedBuilder()
      .setTitle(content.title)
      .setDescription(content.description || content.body)
      .setColor(parseInt(priorityConfig.color.replace('#', ''), 16))
      .setTimestamp(content.timestamp ? new Date(content.timestamp) : new Date())
      .setFooter({
        text: 'MedAlert System',
        iconURL: 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png'
      });

    // Ajouter les champs
    if (content.fields && Array.isArray(content.fields)) {
      const fields = content.fields.slice(0, this.defaultConfig.maxEmbedFields);
      embed.addFields(fields);
    }

    // Ajouter une image si présente
    if (content.image) {
      embed.setImage(content.image);
    }

    // Ajouter un thumbnail
    if (content.thumbnail) {
      embed.setThumbnail(content.thumbnail);
    }

    // Construire le message complet
    const message = {
      embeds: [embed],
      username: options.username || 'MedAlert',
      avatarURL: options.avatarURL || 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png'
    };

    // Ajouter du contenu textuel si nécessaire
    if (options.mentionEveryone && priority === PRIORITY_LEVELS.CRITICAL) {
      message.content = '@everyone ';
    }

    if (options.additionalContent) {
      message.content = (message.content || '') + options.additionalContent;
    }

    // Limiter la longueur du contenu
    if (message.content && message.content.length > this.defaultConfig.maxContentLength) {
      message.content = message.content.substring(0, this.defaultConfig.maxContentLength - 3) + '...';
    }

    return message;
  }

  /**
   * Envoie à un webhook spécifique
   */
  async sendToWebhook(webhookData, message, options) {
    const { client, config } = webhookData;

    try {
      const result = await client.send(message);

      // Mettre à jour les statistiques du webhook
      webhookData.lastUsed = new Date();
      webhookData.errorCount = 0;

      return result;

    } catch (error) {
      webhookData.errorCount++;

      // Si trop d'erreurs, marquer le webhook comme inactif temporairement
      if (webhookData.errorCount >= 5) {
        console.warn(`[DiscordChannel] Webhook '${config.name}' temporairement désactivé (trop d'erreurs)`);
        webhookData.temporarilyDisabled = true;
        setTimeout(() => {
          webhookData.temporarilyDisabled = false;
          webhookData.errorCount = 0;
        }, 5 * 60 * 1000); // 5 minutes
      }

      throw error;
    }
  }

  /**
   * Envoie un message privé via le bot (si disponible)
   */
  async sendDirectMessage(userId, content, options = {}) {
    if (!this.botClient) {
      throw new Error('Bot Discord non configuré');
    }

    try {
      const user = await this.botClient.users.fetch(userId);
      const discordMessage = this.buildDiscordMessage(content, options.priority || PRIORITY_LEVELS.MEDIUM, options);

      // Les messages privés ne supportent que les embeds
      const dmResult = await user.send({ embeds: discordMessage.embeds });

      return {
        success: true,
        messageId: dmResult.id,
        user: user.tag
      };

    } catch (error) {
      console.error(`[DiscordChannel] Erreur MP vers ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Ajoute un webhook dynamiquement
   */
  async addWebhook(name, webhookId, webhookToken, testConnection = true) {
    try {
      const webhook = new WebhookClient({
        id: webhookId,
        token: webhookToken
      });

      if (testConnection) {
        await this.testWebhook(webhook, name);
      }

      this.webhooks.set(name, {
        client: webhook,
        config: { name, id: webhookId, token: webhookToken },
        lastUsed: null,
        errorCount: 0
      });

      console.log(`[DiscordChannel] Webhook '${name}' ajouté dynamiquement`);
      return true;

    } catch (error) {
      console.error(`[DiscordChannel] Erreur ajout webhook '${name}':`, error);
      throw error;
    }
  }

  /**
   * Supprime un webhook
   */
  removeWebhook(name) {
    if (this.webhooks.has(name)) {
      this.webhooks.get(name).client.destroy();
      this.webhooks.delete(name);
      console.log(`[DiscordChannel] Webhook '${name}' supprimé`);
      return true;
    }
    return false;
  }

  /**
   * Envoie une notification de test
   */
  async sendTestNotification(webhookName = 'default') {
    const testContent = {
      title: '🧪 Test de Notification MedAlert',
      description: 'Ceci est un test du système de notifications Discord.',
      fields: [
        {
          name: '📅 Date',
          value: new Date().toLocaleString('fr-FR'),
          inline: true
        },
        {
          name: '⚙️ Version',
          value: 'MedAlert v2.0',
          inline: true
        },
        {
          name: '📊 Statut',
          value: 'Système opérationnel',
          inline: true
        }
      ]
    };

    return await this.send(testContent, {
      webhookName,
      priority: PRIORITY_LEVELS.INFO,
      username: 'MedAlert Test'
    });
  }

  /**
   * Statistiques détaillées du canal
   */
  getDetailedStats() {
    const base = super.healthCheck();

    const webhookStats = {};
    for (const [name, data] of this.webhooks) {
      webhookStats[name] = {
        active: !data.temporarilyDisabled,
        lastUsed: data.lastUsed,
        errorCount: data.errorCount,
        id: data.config.id
      };
    }

    return {
      ...base,
      webhooks: {
        total: this.webhooks.size,
        active: Array.from(this.webhooks.values()).filter(w => !w.temporarilyDisabled).length,
        stats: webhookStats
      },
      bot: {
        connected: this.botClient ? this.botClient.isReady() : false,
        user: this.botClient ? this.botClient.user?.tag : null
      }
    };
  }

  /**
   * Configuration publique (sans tokens)
   */
  getPublicConfig() {
    return {
      webhooksConfigured: this.webhooks.size,
      botConfigured: !!this.config.botToken,
      defaultEmbedColor: this.defaultConfig.embedColor,
      allowMentions: this.defaultConfig.allowMentions
    };
  }

  /**
   * Nettoyage des ressources
   */
  async cleanup() {
    // Fermer tous les webhooks
    for (const webhookData of this.webhooks.values()) {
      try {
        webhookData.client.destroy();
      } catch (error) {
        console.warn('[DiscordChannel] Erreur fermeture webhook:', error);
      }
    }
    this.webhooks.clear();

    // Déconnecter le bot
    if (this.botClient) {
      try {
        await this.botClient.destroy();
      } catch (error) {
        console.warn('[DiscordChannel] Erreur déconnexion bot:', error);
      }
    }

    await super.cleanup();
  }
}

module.exports = DiscordChannel;