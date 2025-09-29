// Bot Discord minimal pour MedAlert
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const BACKEND_URL = process.env.BACKEND_URL || 'https://backend:3443';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

// Configuration axios pour HTTPS avec certificats auto-signés
const httpsAgent = new https.Agent({
  rejectUnauthorized: false // Accepter les certificats auto-signés en développement
});

axios.defaults.httpsAgent = httpsAgent;

client.once('ready', () => {
  console.log(`🤖 Bot connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith('!alerte')) return;

  const alertContent = message.content.replace('!alerte', '').trim();
  if (!alertContent) {
    message.reply('Merci de préciser le message d\'alerte.');
    return;
  }

  try {
    console.log(`🔒 Envoi HTTPS vers: ${BACKEND_URL}/api/alerts`);
    const res = await axios.post(`${BACKEND_URL}/api/alerts`, {
      originalMessage: alertContent,
      userId: message.author.id,
      username: message.author.username,
      location: null,
      injuryType: null,
      priority: null
    }, {
      httpsAgent, // Utiliser l'agent HTTPS configuré
      timeout: 10000 // Timeout de 10 secondes
    });
    // Création de l'embed médical/sci-fi
    const embed = new EmbedBuilder()
      .setTitle('🚨 Nouvelle Alerte Médicale')
      .setDescription(alertContent)
      .setColor('#00e6e6') // Bleu-vert médical/sci-fi
      .addFields(
        { name: 'Auteur', value: `${message.author.username}`, inline: true },
        { name: 'ID Alerte', value: `${res.data.id}`, inline: true },
        { name: 'Date', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false }
      )
      .setFooter({ text: 'MedAlert', iconURL: 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png' })
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/2965/2965567.png');
    message.reply({ embeds: [embed] });
    console.log(`✅ Alerte envoyée avec succès via HTTPS (ID: ${res.data.id})`);
  } catch (err) {
    console.error('❌ Erreur lors de l\'envoi de l\'alerte HTTPS:', err.message);
    if (err.response) {
      console.error(`Status: ${err.response.status}, Data:`, err.response.data);
    }
    message.reply('Erreur lors de l\'enregistrement de l\'alerte. Vérifiez la connexion HTTPS au backend.');
  }
});

client.login(DISCORD_TOKEN);