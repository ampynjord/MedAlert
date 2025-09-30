# ⚕️ MedAlert - Star Citizen Medical Alert System

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

Système d'alertes médicales pour Star Citizen avec interface web holographique et bot Discord.

## 🚀 Installation

### 📋 Prérequis
- 🐳 Docker Desktop
- 🤖 Bot Discord (instructions ci-dessous)
- 🦊 **Firefox** (recommandé pour les notifications push)

### 🤖 Créer le bot Discord
1. **Aller sur** https://discord.com/developers/applications
2. **Cliquer** sur "New Application"
3. **Nommer** votre application (ex: "MedAlert")
4. **Aller** dans l'onglet "Bot"
5. **Cliquer** sur "Add Bot"
6. **Copier** le token (bouton "Copy" sous "Token")
7. **Noter** l'Application ID depuis l'onglet "General Information"

### ⚙️ Configuration
1. 📥 Cloner le projet
2. 🔧 Créer le fichier `src/discord/.env` avec :
   ```env
   DISCORD_TOKEN=votre_token_copié_étape_6
   CLIENT_ID=votre_application_id_étape_7
   API_BASE_URL=http://backend:3000
   NODE_ENV=development
   ```
3. 🔐 Générer les certificats SSL (pour HTTPS) :
   ```bash
   # Créer le répertoire certs s'il n'existe pas
   mkdir -p certs

   # Générer un certificat auto-signé pour localhost
   openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
     -keyout certs/localhost-key.pem \
     -out certs/localhost-cert.pem \
     -subj "/CN=localhost"
   ```
4. 🚀 Lancer l'écosystème:
   ```bash
   docker compose up --build
   ```

### 🌐 Accès
- 🖥️ **Interface web** : http://localhost:8090
- 🔗 **API** : http://localhost:3000/health

### 🔔 Configuration des notifications push

**⚠️ Important pour recevoir les alertes :**

**Windows :**
1. **Paramètres Windows** → **Système** → **Notifications et actions**
2. **Activer** "Obtenir des notifications de la part des applications et des expéditeurs"
3. **Trouver Firefox** dans la liste et **l'activer**
4. **Désactiver** le mode "Ne pas déranger" si activé

**Firefox :**
1. **Ouvrir** http://localhost:8090
2. **Autoriser** les notifications quand Firefox demande
3. **Si refusé**, aller dans **Paramètres** → **Vie privée et sécurité** → **Permissions** → **Notifications**
4. **Ajouter** `http://localhost:8090` et **Autoriser**

## 🎯 Utilisation

### 🤖 Discord
**Inviter le bot :**
1. Copier votre `CLIENT_ID` depuis `src/discord/.env`
2. Aller sur https://discordapi.com/permissions.html#0
3. Coller votre CLIENT_ID dans le champ "Client ID"
4. Sélectionner les permissions : `Send Messages`, `Use Slash Commands`, `Embed Links`
5. Copier l'URL générée et l'ouvrir dans votre navigateur
6. Sélectionner votre serveur Discord et autoriser le bot

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
# Ajouter l'utilisateur au groupe docker (Linux/Debian)
sudo usermod -aG docker debian
# Redémarrer la session pour appliquer les changements

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