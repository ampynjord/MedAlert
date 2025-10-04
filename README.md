# ⚕️ MedAlert - Star Citizen Medical Alert System

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Traefik](https://img.shields.io/badge/Traefik-24A1C1?style=for-the-badge&logo=traefikproxy&logoColor=white)

Système d'alertes médicales avancé pour Star Citizen avec interface web holographique, bot Discord, gestion des utilisateurs et notifications push en temps réel.

**Architecture moderne avec Traefik v3 + Let's Encrypt automatique.**

---

## ✨ Fonctionnalités principales

- ⚡ **Alertes en temps réel** via Discord bot et interface web
- 🎨 **Interface holographique** inspirée de Star Citizen
- 🔐 **Authentification Discord OAuth2** avec JWT
- 👑 **Système de rôles** (Admin / Medic)
- 🤝 **Assignation collaborative** des alertes
- 🔔 **Notifications push natives** (Web Push API)
- 📱 **PWA installable** sur mobile et desktop
- 📊 **Panneau d'administration** complet
- 🔒 **SSL automatique** via Traefik + Let's Encrypt

---

## 🚀 Démarrage rapide

### 📋 Prérequis
- 🐳 Docker & Docker Compose
- 🤖 Bot Discord configuré
- 🌐 Traefik en reverse proxy (voir ~/apps/traefik)

### ⚡ Installation

```bash
# 1. Cloner le projet
git clone <repo-url> ~/apps/medalert
cd ~/apps/medalert

# 2. Configurer l'environnement
cp .env.example .env
nano .env

# 3. Lancer l'application
docker compose up -d
```

### 🌐 Accès
- **Production** : https://medalert.ampynjord.bzh
- **API** : https://medalert.ampynjord.bzh/api

---

## 🤖 Configuration Discord

### Créer le bot

1. https://discord.com/developers/applications → **New Application**
2. Onglet **Bot** → **Add Bot** → Copier le **token**
3. Onglet **OAuth2** → Copier le **Client Secret**
4. Onglet **OAuth2 → Redirects** → Ajouter :
   - `https://medalert.ampynjord.bzh/auth/discord/callback`

### Configurer .env

```env
DISCORD_TOKEN=votre_token_bot
DISCORD_CLIENT_ID=votre_application_id
DISCORD_CLIENT_SECRET=votre_client_secret
DISCORD_GUILD_ID=id_de_votre_serveur

# Générer avec: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com

# Générer avec: openssl rand -base64 64
JWT_SECRET=...
SESSION_SECRET=...
```

### Inviter le bot

```
https://discord.com/oauth2/authorize?client_id=VOTRE_CLIENT_ID&scope=bot%20applications.commands&permissions=2048
```

---

## 🎯 Utilisation

### 📢 Commande Discord

```
/alert tier:T1 motif:"Blessure par balle" localisation:"Hurston > Lorville" equipe:"Red Cross"
```

### 🏥 Système de tiers

| Tier | Priorité | Description |
|------|----------|-------------|
| **T1** | 🔴 Haute | Blessure grave, intervention urgente |
| **T2** | 🟠 Moyenne | Blessure modérée |
| **T3** | 🟡 Basse | Blessure légère |

### 👥 Système de rôles

| Rôle | Badge | Accès |
|------|-------|-------|
| **Admin** | 👑 | Tous les modules + gestion utilisateurs |
| **Medic** | ⚕️ | Alerts, Medical, Mes Alertes |

---

## 🏗️ Architecture

```
INTERNET
   │
   ▼
Traefik (Port 443) ◄── SSL Let's Encrypt
   │
   ├──► Web (HTTP :8090)
   │
   └──► Backend (HTTP :3000) ◄──► Discord Bot
            │
            ▼
         SQLite DB
```

### 🔄 Flux de données

1. **Alerte Discord** → Bot → Backend → SQLite → Push notifications
2. **Interface Web** → Traefik (HTTPS) → Web/Backend (HTTP) → SQLite
3. **SSL** : Géré uniquement par Traefik, communication HTTP interne

### 📁 Structure

```
medalert/
├── .env
├── docker-compose.yml
├── src/
│   ├── backend/        # API Express + SQLite
│   ├── discord/        # Bot Discord
│   └── web/            # Frontend PWA
```

### 🐳 Services Docker

| Service | Port | Description |
|---------|------|-------------|
| backend | 3000 (HTTP interne) | API Express + JWT + OAuth2 |
| web | 8090 (HTTP interne) | Frontend PWA |
| discord-bot | - | Bot Discord |

**Traefik** (externe) écoute sur 80/443 et gère SSL.

---

## 🔗 API Endpoints

### Authentification
```
GET  /auth/discord
GET  /auth/discord/callback
```

### Alertes
```
GET  /api/alerts
POST /api/alerts
POST /api/alerts/:id/assign
POST /api/alerts/:id/unassign
GET  /api/alerts/my-assignments
```

### Utilisateurs (Admin)
```
GET  /api/users
PUT  /api/users/:discordId/roles
```

### Système (Admin)
```
GET  /health
GET  /api/config
GET  /api/system/stats
GET  /api/system/logs
```

### Push
```
GET  /api/vapid-key
POST /api/subscribe
POST /api/test-push
```

---

## 🛠️ Développement

### Scripts Docker

```bash
# Démarrer
docker compose up -d

# Rebuild
docker compose up -d --build

# Logs
docker compose logs -f backend

# Statut
docker compose ps

# Arrêter
docker compose down

# Reset complet
docker compose down -v && docker compose up -d --build
```

### Variables .env principales

```env
NODE_ENV=production
DOMAIN=medalert.ampynjord.bzh
PORT=3000
WEB_PORT=8090
BACKEND_URL=http://backend:3000
API_URL=http://backend:3000
FRONTEND_URL=https://medalert.ampynjord.bzh
BACKEND_AUTH_URL=https://medalert.ampynjord.bzh
DB_PATH=/app/database/medals.db
```

---

## 🗄️ Base de données SQLite

### Table alerts
```sql
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY,
    author TEXT,
    tier TEXT,
    motif TEXT,
    localisation TEXT,
    equipe TEXT,
    assignedTo TEXT,
    assignedToUsername TEXT,
    assignedAt DATETIME,
    status TEXT DEFAULT 'open',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table users
```sql
CREATE TABLE users (
    discordId TEXT PRIMARY KEY,
    username TEXT,
    avatar TEXT,
    roles TEXT DEFAULT 'medic',
    lastLogin DATETIME
);
```

---

## 🔧 Debugging

### Bot Discord ne répond pas
```bash
docker compose logs discord-bot | grep connecté
```

### Notifications push
```bash
docker compose logs backend | grep VAPID
curl -X POST https://medalert.ampynjord.bzh/api/test-push
```

### Reset base de données
```bash
docker compose down
docker volume rm medalert_database-data
docker compose up -d
```

---

## 🛡️ Sécurité

### Checklist production

- ✅ JWT_SECRET fort (64+ caractères)
- ✅ SESSION_SECRET unique
- ✅ VAPID keys générées
- ✅ SSL Let's Encrypt via Traefik
- ✅ Firewall UFW (ports 22, 80, 443)
- ✅ Fail2ban actif
- ✅ Headers de sécurité (HSTS, CSP)

### Configuration UFW

```bash
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 📱 Installation PWA

1. Ouvrir https://medalert.ampynjord.bzh
2. Menu → "Ajouter à l'écran d'accueil"
3. Activer les notifications

---

## 🔄 Mise à jour

```bash
ssh debian@ampynjord.bzh -p 29204
cd ~/apps/medalert
git pull
docker compose down
docker compose up -d --build
docker compose ps
```

---

## 📊 Stack technologique

- **Backend** : Node.js 18, Express, SQLite3, Passport, JWT, web-push
- **Frontend** : HTML5, CSS3, JavaScript, Service Worker, PWA
- **Bot** : Discord.js v14
- **Infrastructure** : Docker Compose, Traefik v3, Let's Encrypt

---

## 📞 Support

- 🐛 Issues : GitHub
- 💡 Pull requests bienvenues
- 📧 Contact : Discord - ampynjord

---

<div align="center">

### ⚕️ MedAlert v1.0

**Développé par ampynjord pour la communauté Star Citizen**

![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red)
![Star Citizen](https://img.shields.io/badge/Star%20Citizen-Medical-blue)

**Node.js • Express • SQLite • Discord.js • Traefik • Docker**

</div>
