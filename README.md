# ⚕️ MedAlert - Star Citizen Medical Alert System

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

Système d'alertes médicales pour Star Citizen avec interface web holographique et bot Discord.

## 🚀 Installation

### 📋 Prérequis
- 🐳 Docker Desktop
- 🤖 Token Discord Bot ([Discord Developer Portal](https://discord.com/developers/applications))

### ⚙️ Configuration
1. 📥 Cloner le projet
2. 🔧 Configurer le bot Discord dans `src/discord/.env`:
   ```env
   DISCORD_TOKEN=VOTRE_TOKEN_DISCORD
   CLIENT_ID=VOTRE_CLIENT_ID
   API_BASE_URL=http://backend:3000
   ```
3. 🚀 Lancer l'écosystème:
   ```bash
   docker-compose up --build
   ```

### 🌐 Accès
- 🖥️ **Interface web** : http://localhost:8090
- 🔗 **API** : http://localhost:3000/health

## 🎯 Utilisation

### 🤖 Discord
**Inviter le bot :**
1. Récupérer le `CLIENT_ID` depuis `src/discord/.env`
2. Aller sur https://discordapi.com/permissions.html#0
3. Sélectionner les permissions : `Send Messages`, `Use Slash Commands`, `Embed Links`
4. Utiliser l'URL générée pour inviter le bot

**Commande `/alert` :**
```bash
/alert tier:T1 motif:"Description" localisation:"Lieu" equipe:"Organisation"
```

### 🩹 Système de tiers
| Tier | Priorité | Couleur | Description |
|------|----------|---------|-------------|
| **T1** | 🔴 Haute | Rouge | Blessure grave, intervention urgente |
| **T2** | 🟠 Moyenne | Orange | Blessure modérée |
| **T3** | 🟡 Basse | Jaune | Blessure légère |

### 🖥️ Interface Web
- 🧭 Navigation entre modules (Alerts, Medical, Analytics, Systems, Comms)
- ⚡ Alertes en temps réel avec cartes colorées selon le tier
- 🔔 Notifications push natives

## 🏗️ Architecture

```
Discord ◄─► Bot ◄─► Backend API ◄─► SQLite DB
              │           ▲
              ▼           │
        Web Interface ◄─► Nginx Proxy
```

### 📁 Structure
```
MedAlert/
├── src/
│   ├── backend/          # API Express + SQLite
│   ├── discord/          # Bot Discord
│   └── web/              # Interface web
├── nginx/                # Reverse proxy
├── certs/                # Certificats SSL
└── docker-compose.yml
```

## 🔗 API

```http
GET  /health                    # Status
GET  /api/alerts               # Liste des alertes
POST /api/alerts               # Créer une alerte
GET  /api/vapid-key           # Clé publique notifications
POST /api/subscribe           # S'abonner aux notifications
```

## 🛠️ Développement

### 🐳 Scripts Docker
```bash
# Démarrer
docker-compose up --build

# Redémarrer un service
docker-compose restart discord-bot

# Voir les logs
docker-compose logs -f backend

# Reset base de données
docker-compose down
docker volume rm medalert_database-data
docker-compose up --build
```

---

<div align="center">

### ⚕️ MedAlert v1.0
**Développé par ampynjord pour la communauté Star Citizen**

![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red)
![Star Citizen](https://img.shields.io/badge/Star%20Citizen-Medical%20Division-blue)

</div>