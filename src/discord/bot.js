// Bot Discord MedAlert avec Slash Commands
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const BACKEND_URL = process.env.BACKEND_URL || 'https://backend:3443';
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID; // ID du bot Discord

// Configuration axios pour HTTPS avec certificats auto-signés
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

axios.defaults.httpsAgent = httpsAgent;

// Définition des tiers de blessure Star Citizen (T1-T3)
const INJURY_TIERS = {
  'T1': {
    name: 'Blessure grave',
    color: '#FF0000', // Rouge pour T1 (priorité haute)
    icon: '🔴',
    priority: 'high',
    description: 'Blessures graves, intervention urgente requise'
  },
  'T2': {
    name: 'Blessure modérée',
    color: '#FF8000', // Orange pour T2 (priorité moyenne)
    icon: '🔶',
    priority: 'medium',
    description: 'Blessures nécessitant une attention médicale'
  },
  'T3': {
    name: 'Blessure légère',
    color: '#FFFF00', // Jaune pour T3 (priorité basse)
    icon: '⚠️',
    priority: 'low',
    description: 'Blessures superficielles, soins basiques'
  }
};

// Commande slash /alert
const alertCommand = new SlashCommandBuilder()
  .setName('alert')
  .setDescription('Créer une alerte médicale structurée')
  .addStringOption(option =>
    option.setName('tier')
      .setDescription('Niveau de blessure (T1-T3)')
      .setRequired(true)
      .addChoices(
        { name: 'T1', value: 'T1' },
        { name: 'T2', value: 'T2' },
        { name: 'T3', value: 'T3' }
      )
  )
  .addStringOption(option =>
    option.setName('motif')
      .setDescription('Motif de l\'alerte (optionnel)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('localisation')
      .setDescription('Localisation de l\'incident (optionnel)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('equipe')
      .setDescription('Équipe ou organisation (optionnel)')
      .setRequired(false)
  );

// Enregistrement des commandes slash
async function deployCommands() {
  const commands = [alertCommand];
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  try {
    console.log('🔄 Déploiement des commandes slash...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Commandes slash déployées avec succès');
  } catch (error) {
    console.error('❌ Erreur lors du déploiement des commandes:', error);
  }
}

// Fonction pour créer un embed structuré selon le tier
function createTierEmbed(tier, motif, localisation, equipe, user, alertId) {
  const tierInfo = INJURY_TIERS[tier];

  const embed = new EmbedBuilder()
    .setTitle(`${tierInfo.icon} ALERTE MEDICALE - ${tier}`)
    .setColor(tierInfo.color)
    .setDescription(tierInfo.description)
    .setTimestamp()
    .setFooter({
      text: 'ampynjord - MedAlert',
      iconURL: 'https://cdn-icons-png.flaticon.com/512/2965/2965567.png'
    })
    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2965/2965567.png');

  // Champs principaux
  embed.addFields(
    { name: '🏷️ Tier', value: `**${tier}**`, inline: true },
    { name: '🆔 ID', value: `\`${alertId}\``, inline: true },
    { name: '👤 Demandeur', value: `<@${user.id}>`, inline: true }
  );

  // Champs optionnels avec espacement
  if (motif) {
    embed.addFields({ name: '📋 Motif', value: `\`\`\`${motif}\`\`\``, inline: false });
  }

  if (localisation || equipe) {
    const locationField = localisation ? `📍 **Localisation:** ${localisation}` : '';
    const teamField = equipe ? `👥 **Équipe:** ${equipe}` : '';
    const combined = [locationField, teamField].filter(Boolean).join('\n');
    if (combined) {
      embed.addFields({ name: '\u200B', value: combined, inline: false });
    }
  }

  // Le tier représente déjà la priorité (T1=haute, T3=basse)

  // Ligne de séparation visuelle pour T1 (priorité la plus haute)
  if (tier === 'T1') {
    embed.addFields({ name: '\u200B', value: '**🔴 ATTENTION: Cette alerte nécessite une réponse immédiate 🔴**', inline: false });
  }

  return embed;
}

// Gestionnaire d'événements
client.once('ready', async () => {
  console.log(`🤖 Bot connecté en tant que ${client.user.tag}`);
  await deployCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'alert') {
    const tier = interaction.options.getString('tier');
    const motif = interaction.options.getString('motif') || '';
    const localisation = interaction.options.getString('localisation') || '';
    const equipe = interaction.options.getString('equipe') || '';

    try {
      console.log(`🔒 Envoi HTTPS vers: ${BACKEND_URL}/api/alerts`);

      // Construction du message pour le backend
      const originalMessage = [
        `[${tier}] ${INJURY_TIERS[tier].name}`,
        motif && `Motif: ${motif}`,
        localisation && `Localisation: ${localisation}`,
        equipe && `Équipe: ${equipe}`
      ].filter(Boolean).join(' | ');

      const alertData = {
        originalMessage,
        userId: interaction.user.id,
        username: interaction.user.username,
        location: localisation || null,
        injuryType: tier,
        priority: INJURY_TIERS[tier].priority,
        motif: motif || null,
        equipe: equipe || null,
        tier: tier
      };

      const response = await axios.post(`${BACKEND_URL}/api/alerts`, alertData, {
        httpsAgent,
        timeout: 10000
      });

      // Création de l'embed structuré
      const embed = createTierEmbed(tier, motif, localisation, equipe, interaction.user, response.data.id);

      await interaction.reply({ embeds: [embed] });
      console.log(`✅ Alerte ${tier} envoyée avec succès (ID: ${response.data.id})`);

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'alerte:', error.message);

      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Erreur de connexion')
        .setDescription('Impossible de créer l\'alerte. Vérifiez la connexion au backend MedAlert.')
        .setColor('#ff0040')
        .setTimestamp();

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

// Gestion des erreurs
client.on('error', error => {
  console.error('❌ Erreur Discord.js:', error);
});

process.on('unhandledRejection', error => {
  console.error('❌ Rejection non gérée:', error);
});

client.login(DISCORD_TOKEN);