# ⚕️ MedAlert - Star Citizen Medical Alert System

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

Système d'alertes médicales avancé pour Star Citizen avec interface web holographique, bot Discord, gestion des utilisateurs, système d'assignation des alertes et notifications push en temps réel.

---

## ✨ Fonctionnalités principales

### 🎯 Alertes médicales
- ⚡ **Alertes en temps réel** via Discord bot et interface web
- 🎨 **Interface holographique** inspirée de Star Citizen
- 🏷️ **Système de tiers** (T1: Critique, T2: Modéré, T3: Léger)
- 🔔 **Notifications push natives** (Web Push API)
- 📱 **PWA installable** sur mobile et desktop
- 🔄 **Auto-refresh** toutes les 3 secondes

### 👥 Gestion des utilisateurs
- 🔐 **Authentification Discord OAuth2** avec JWT
- 👑 **Système de rôles** (Admin / Medic)
- 🛡️ **Vérification du serveur Discord** (guild membership)
- 🎛️ **Interface d'administration** pour gérer les permissions
- 📊 **Suivi des connexions** (lastLogin)

### 📋 Assignation des alertes
- 🤝 **Prise en charge collaborative** des alertes
- 👤 **Vue "Mes Alertes"** pour suivre ses assignations
- 📊 **Dashboard admin** pour voir toutes les assignations de l'équipe
- 🔄 **Statut en temps réel** (disponible / assignée)
- 🔓 **Libération des alertes** par l'assigné ou un admin

### 🖥️ Panneau System Control
- 📊 **Statistiques système en temps réel** (uptime, DB size, alertes)
- 📜 **Logs système** avec rafraîchissement automatique
- ⚙️ **Monitoring des services** (Backend, Discord, DB, Push)
- 📈 **Métriques de performance** (CPU, mémoire, alertes/heure)
- 🔧 **Outils de diagnostic** et export de données

---

## 🚀 Démarrage rapide

### 📋 Prérequis
- 🐳 **Docker & Docker Compose**
- 🤖 **Bot Discord** (voir configuration ci-dessous)
- 🦊 **Firefox** ou Chrome (recommandé pour les notifications push)

### ⚡ Installation en 3 étapes

1. **Cloner le projet**
   ```bash
   git clone <repo-url>
   cd MedAlert
   ```

2. **Configurer l'environnement**
   ```bash
   # Copier le template
   cp .env.example .env

   # Éditer .env avec vos credentials Discord et VAPID
   nano .env
   ```

3. **Lancer l'application**
   ```bash
   docker compose up -d
   ```

🎉 **C'est tout !** Les certificats SSL sont générés automatiquement.

### 🌐 Accès

- **Interface web** : https://localhost (ou https://localhost:443)
- **Interface web alternative** : https://localhost:8443
- **API directe** : https://localhost:3443

⚠️ **Note** : Acceptez le certificat auto-signé dans votre navigateur (Avancé → Continuer).

---

## 🤖 Configuration Discord

### Créer le bot Discord

1. Aller sur https://discord.com/developers/applications
2. Cliquer sur **"New Application"**
3. Nommer votre application (ex: "MedAlert")
4. Aller dans l'onglet **"Bot"** → **"Add Bot"**
5. **Copier le token** (bouton "Reset Token" puis "Copy")
6. **Noter l'Application ID** depuis l'onglet "General Information"
7. Dans l'onglet **"OAuth2"**, copier le **Client Secret**
8. Dans l'onglet **"OAuth2"** → **"Redirects"**, ajouter :
   - `https://localhost:3443/auth/discord/callback` (dev)
   - `https://medalert.votredomaine.com/auth/discord/callback` (prod)

### Configurer le fichier `.env`

Éditez `.env` et remplissez :
```env
# Discord Bot
DISCORD_TOKEN=votre_token_copié_étape_5
DISCORD_CLIENT_ID=votre_application_id_étape_6
DISCORD_CLIENT_SECRET=votre_client_secret_étape_7
DISCORD_GUILD_ID=id_de_votre_serveur_discord

# URLs (adapter selon votre environnement)
DOMAIN=localhost  # ou medalert.votredomaine.com en production
FRONTEND_URL=https://localhost:8443
BACKEND_AUTH_URL=https://localhost:3443

# VAPID (générer avec: npx web-push generate-vapid-keys)
VAPID_PUBLIC_KEY=votre_cle_publique
VAPID_PRIVATE_KEY=votre_cle_privee
VAPID_SUBJECT=mailto:votre_email@example.com

# JWT (générer avec: openssl rand -base64 64)
JWT_SECRET=votre_secret_jwt_securise
```

### Générer les clés VAPID

```bash
npx web-push generate-vapid-keys
```

Copiez les clés générées dans votre `.env`.

### Inviter le bot sur votre serveur

1. Copier votre `DISCORD_CLIENT_ID` depuis `.env`
2. Aller sur https://discord.com/oauth2/authorize?client_id=VOTRE_CLIENT_ID&scope=bot%20applications.commands&permissions=2048
3. Remplacer `VOTRE_CLIENT_ID` par votre ID
4. Sélectionner votre serveur Discord et autoriser le bot

### Obtenir l'ID du serveur Discord

1. Dans Discord, activer le **Mode Développeur** : 
   - **Paramètres** → **Avancés** → **Mode développeur**
2. Clic droit sur le nom de votre serveur → **Copier l'identifiant**
3. Coller cet ID dans `DISCORD_GUILD_ID` du `.env`

---

## 🎯 Utilisation

### 📢 Commande `/alert` sur Discord

```bash
/alert tier:T1 motif:"Blessure par balle" localisation:"Stanton > Hurston > Lorville" equipe:"Red Cross"
```

### 🩹 Système de tiers

| Tier | Priorité | Couleur | Description |
|------|----------|---------|-------------|
| **T1** | 🔴 Haute | Rouge | Blessure grave, intervention urgente |
| **T2** | 🟠 Moyenne | Orange | Blessure modérée |
| **T3** | 🟡 Basse | Jaune | Blessure légère |

### 🖥️ Interface Web - Modules disponibles

#### 📋 **ALERTS** (Medic + Admin)
- Affichage des alertes en temps réel
- Cartes colorées selon le tier
- Bouton **"PRENDRE EN CHARGE"** pour assigner une alerte
- Bouton **"LIBÉRER"** pour relâcher une alerte
- Badges d'assignation avec nom de l'utilisateur

#### 🤝 **MES ALERTES** (Medic + Admin)
- Liste de vos alertes prises en charge
- Vue admin : toutes les assignations de l'équipe
- Statut et timestamp d'assignation
- Libération rapide des alertes

#### 🏥 **MEDICAL** (Medic + Admin)
- Statistiques médicales
- Protocoles et procédures
- Dashboard médical

#### 👥 **USERS** (Admin uniquement)
- Liste de tous les utilisateurs connectés
- **Badges de rôles** : � ADMIN, ⚕️ MEDIC
- **Checkboxes interactives** pour modifier les rôles
- Affichage de la dernière connexion
- Mise à jour en temps réel via API

#### 📊 **ANALYTICS** (Admin uniquement)
- Statistiques d'utilisation
- Graphiques et tendances
- Analyse des alertes

#### ⚙️ **SYSTEMS** (Admin uniquement)
- **État système** : Operational / Checking
- **Uptime** : Temps réel de fonctionnement du serveur
- **Taille de la base de données** : Taille réelle SQLite
- **Sync Status** : État de synchronisation
- **Modules système** : Backend, DB, Discord, Service Worker, Push, Nginx
- **Performances** : Alertes/h, alertes 24h, alertes lues/non lues
- **Logs système en temps réel** (rafraîchissement auto 5s)
- **Contrôles** : Refresh, Test Notifications, Enable Push, Clear Cache, Export, Diagnostic

### 👥 Système de rôles

MedAlert utilise un système de permissions avancé basé sur les rôles :

| Rôle | Badge | Accès aux modules | Description |
|------|-------|-------------------|-------------|
| **Admin** | 👑 | Tous les modules | Accès complet + gestion des utilisateurs |
| **Medic** | ⚕️ | Alerts, Medical, Mes Alertes | Accès limité aux fonctions médicales |

#### Configuration des rôles

**Attribution automatique :**
- Les rôles sont lus depuis la base de données lors de la connexion
- Par défaut, tous les nouveaux utilisateurs ont le rôle **Medic**
- L'utilisateur `ampynjord` a automatiquement **Admin + Medic**

**Modifier les rôles (interface web) :**
1. Se connecter en tant qu'Admin
2. Accéder au module **USERS**
3. Cocher/décocher les rôles souhaités pour chaque utilisateur
4. Les changements sont appliqués immédiatement en base de données

**Modifier les rôles (base de données) :**
```bash
# Accéder au conteneur backend
docker exec -it medalert-backend sh

# Installer sqlite3
apk add sqlite

# Modifier les rôles
sqlite3 /app/database/medals.db "UPDATE users SET roles = 'admin,medic' WHERE username = 'username';"

# Vérifier
sqlite3 /app/database/medals.db "SELECT username, roles FROM users;"
```

**Permissions détaillées par module :**
```
✅ Alerts        → Medic + Admin
✅ Mes Alertes   → Medic + Admin  
✅ Medical       → Medic + Admin
🔒 Users         → Admin uniquement
🔒 Analytics     → Admin uniquement
🔒 Systems       → Admin uniquement
```

### 🔔 Configuration des notifications push

**Windows :**
1. **Paramètres Windows** → **Système** → **Notifications**
2. Activer "Obtenir des notifications"
3. Trouver **Firefox** dans la liste et l'activer
4. Désactiver le mode "Ne pas déranger"

**Firefox :**
1. Ouvrir https://localhost
2. Autoriser les notifications quand demandé
3. Si refusé : **Paramètres** → **Vie privée** → **Permissions** → **Notifications** → Ajouter `https://localhost`

**Chrome/Edge :**
1. Ouvrir https://localhost
2. Cliquer sur l'icône 🔒 dans la barre d'adresse
3. Autoriser les notifications

---

## 🌍 Déploiement en production (VPS)

### Prérequis
- VPS avec Docker installé
- Sous-domaine configuré : `medalert.votredomaine.com`
- Ports ouverts : **80**, **443**

### 1. Configuration DNS

Créer un enregistrement DNS de type **A** :
```
Type: A
Nom: medalert
Valeur: [IP de votre VPS]
TTL: 300
```

Exemple pour `medalert.ampynjord.bzh` :
```
medalert.ampynjord.bzh → 137.74.40.159
```

### 2. Transférer les fichiers

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'certs' \
  ./MedAlert/ user@votre-vps:/home/user/MedAlert/
```

### 3. Configurer le domaine

Sur le VPS, éditer `.env` :
```bash
cd /home/user/MedAlert
nano .env
```

**Modifier UNIQUEMENT ces lignes** :
```env
NODE_ENV=production
DOMAIN=medalert.votredomaine.com
```

**⚠️ Important** : Ne changez pas les autres variables (ports, URLs internes, etc.)

### 4. Lancer en production

```bash
docker compose up -d
```

🎉 Les certificats SSL sont générés automatiquement pour votre domaine !

### 5. Utiliser Let's Encrypt (recommandé)

```bash
# Installer certbot
sudo apt update && sudo apt install certbot

# Arrêter nginx temporairement
docker compose stop nginx

# Générer le certificat
sudo certbot certonly --standalone -d medalert.votredomaine.com

# Copier les certificats
sudo cp /etc/letsencrypt/live/medalert.votredomaine.com/fullchain.pem certs/medalert.votredomaine.com-cert.pem
sudo cp /etc/letsencrypt/live/medalert.votredomaine.com/privkey.pem certs/medalert.votredomaine.com-key.pem

# Relancer
docker compose up -d
```

**Renouvellement automatique :**
```bash
sudo crontab -e
# Ajouter :
0 3 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/medalert.votredomaine.com/*.pem /home/user/MedAlert/certs/ && cd /home/user/MedAlert && docker compose restart nginx
```

---

## 🏗️ Architecture

```
┌─────────────┐
│   Discord   │
│   Users     │
└──────┬──────┘
       │
       ▼
┌─────────────┐       ┌──────────────┐
│ Discord Bot │◄─────►│ Backend API  │
└─────────────┘       │  (Express)   │
                      │              │
┌─────────────┐       │  + SQLite DB │
│ Web Browser │◄──┐   └──────┬───────┘
└─────────────┘   │          │
                  │          │
                  ▼          ▼
              ┌──────────────────┐
              │  Nginx Reverse   │
              │      Proxy       │
              │   (HTTPS/SSL)    │
              └──────────────────┘
```

### 🔄 Flux de données

1. **Alerte Discord** → Bot → Backend API → SQLite
2. **Notification Push** → Backend → Web Push API → Navigateurs abonnés
3. **Interface Web** → Nginx → Web Service → API Backend → SQLite

### 📁 Structure du projet

```
MedAlert/
├── .env                      # Configuration unique (créé depuis .env.example)
├── .env.example              # Template de configuration
├── docker-compose.yml        # Orchestration des services
│
├── certs/                    # Génération automatique des certificats SSL
│   ├── Dockerfile
│   ├── generate-certs.sh     # Script de génération
│   ├── localhost-cert.pem    # Auto-généré au premier lancement
│   └── localhost-key.pem     # Auto-généré au premier lancement
│
├── src/
│   ├── backend/              # API Express + SQLite
│   │   ├── server.js         # Serveur principal HTTPS
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── .dockerignore
│   │
│   ├── discord/              # Bot Discord
│   │   ├── bot.js            # Bot avec slash commands
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── web/                  # Frontend PWA
│       ├── index.html        # Interface holographique
│       ├── service-worker.js # Service Worker PWA
│       ├── manifest.json     # Manifest PWA
│       ├── server.js         # Serveur web HTTPS
│       ├── package.json
│       └── Dockerfile
│
└── nginx/                    # Reverse proxy
    ├── nginx.conf            # Configuration unifiée (dev + prod)
    └── Dockerfile
```

### 🔗 API Endpoints

#### Authentification
```http
GET  /auth/discord                # Initier OAuth2 Discord
GET  /auth/discord/callback       # Callback OAuth2
GET  /auth/error                  # Page d'erreur auth
```

#### Alertes
```http
GET  /api/alerts                  # Liste des 50 dernières alertes
POST /api/alerts                  # Créer une alerte
POST /api/alerts/:id/assign       # Prendre en charge une alerte (auth requis)
POST /api/alerts/:id/unassign     # Libérer une alerte (auth requis)
GET  /api/alerts/my-assignments   # Mes alertes assignées (auth requis)
GET  /api/alerts/all-assignments  # Toutes les assignations (admin only)
```

#### Utilisateurs
```http
GET  /api/users                   # Liste des utilisateurs (admin only)
PUT  /api/users/:discordId/roles  # Modifier les rôles (admin only)
```

#### Système
```http
GET  /health                      # Santé de l'API
GET  /api/config                  # Configuration publique
GET  /api/system/stats            # Statistiques système (admin only)
GET  /api/system/logs             # Logs système (admin only)
GET  /api/system/performance      # Métriques de performance (admin only)
```

#### Notifications Push
```http
GET  /api/vapid-key               # Clé publique VAPID
POST /api/subscribe               # S'abonner aux notifications
POST /api/test-push               # Tester une notification (dev)
```

### 🐳 Services Docker

| Service | Port(s) | Description |
|---------|---------|-------------|
| **cert-generator** | - | Génère les certificats SSL au démarrage |
| **backend** | 3000, 3443 | API Express + SQLite + JWT + OAuth2 |
| **discord-bot** | - | Bot Discord avec slash commands |
| **web** | 8090, 8443 | Frontend PWA + Service Worker |
| **nginx** | 80, 443, 8444 | Reverse proxy HTTPS |

### 🗄️ Base de données (SQLite)

#### Table `alerts`
```sql
CREATE TABLE alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    tier TEXT NOT NULL,
    title TEXT,
    motif TEXT NOT NULL,
    localisation TEXT NOT NULL,
    equipe TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    assignedTo TEXT,              -- Discord ID de l'utilisateur assigné
    assignedToUsername TEXT,      -- Username Discord de l'assigné
    assignedAt DATETIME,          -- Timestamp d'assignation
    status TEXT DEFAULT 'open'    -- 'open', 'assigned', 'completed'
);
```

#### Table `users`
```sql
CREATE TABLE users (
    discordId TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    discriminator TEXT,
    avatar TEXT,
    email TEXT,
    roles TEXT DEFAULT 'medic',   -- Rôles séparés par virgules: 'admin,medic'
    lastLogin DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🛠️ Développement

### Scripts Docker utiles

```bash
# Démarrer tous les services
docker compose up

# Démarrer en arrière-plan
docker compose up -d

# Rebuild complet
docker compose up -d --build

# Voir les logs
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f backend
docker compose logs -f discord-bot
docker compose logs -f nginx

# Statut des services
docker compose ps

# Redémarrer un service
docker compose restart backend

# Arrêter tout
docker compose down

# Reset complet (⚠️ efface la base de données)
docker compose down -v
docker compose up -d --build
```

### Variables d'environnement

Toutes les configurations sont dans `.env` :

```env
# Environnement
NODE_ENV=development|production
DOMAIN=localhost|medalert.votredomaine.com

# Backend
PORT=3000                    # Port HTTP (redirection)
HTTPS_PORT=3443             # Port HTTPS backend
BACKEND_HOST=backend        # Hostname interne Docker
BACKEND_URL=https://backend:3443

# Ports publics (modifiables)
PUBLIC_HTTP_PORT=80
PUBLIC_HTTPS_PORT=443
PUBLIC_WEB_HTTP_PORT=8090
PUBLIC_WEB_HTTPS_PORT=8443
PUBLIC_NGINX_ALT_PORT=8444

# Conteneurs internes (ne pas modifier)
WEB_HOST=web
WEB_INTERNAL_PORT=8443
API_URL=https://backend:3443

# Discord
DISCORD_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_GUILD_ID=...

# Sécurité
JWT_SECRET=...              # openssl rand -base64 64
VAPID_PUBLIC_KEY=...        # npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:...

# Base de données
DB_PATH=/app/database/medals.db
```

### Vérifications

```bash
# Statut des services
docker compose ps

# Vérifier les certificats générés
ls -la certs/

# Tester l'API
curl -k https://localhost:3443/health
curl -k https://localhost/api/alerts

# Vérifier les logs de génération des certificats
docker compose logs cert-generator

# Vérifier les ports utilisés
netstat -tuln | grep -E ':(80|443|3443|8443)'
```

---

## 🔧 Debugging

### Problèmes courants

**❌ "ERR_CERT_AUTHORITY_INVALID"**
- Normal avec certificats auto-signés en développement
- Cliquer sur "Avancé" → "Continuer" dans le navigateur
- En production, utiliser Let's Encrypt

**❌ "ERR_CONNECTION_REFUSED"**
```bash
# Vérifier que Docker tourne
docker compose ps

# Vérifier les logs
docker compose logs nginx
docker compose logs backend

# Vérifier les ports
netstat -tuln | grep 443
```

**❌ Nginx ne démarre pas**
```bash
# Vérifier les logs
docker compose logs nginx

# Vérifier les certificats
ls -la certs/*.pem

# Régénérer les certificats
docker compose down
rm certs/*.pem
docker compose up -d
```

**❌ Le bot Discord ne répond pas**
```bash
# Vérifier les logs
docker compose logs discord-bot

# Vérifier la connexion
docker compose logs discord-bot | grep "connecté"

# Vérifier le DISCORD_TOKEN dans .env
cat .env | grep DISCORD_TOKEN
```

**❌ Notifications push ne fonctionnent pas**
```bash
# Vérifier que les clés VAPID sont configurées
docker compose logs backend | grep VAPID

# Tester les notifications
curl -k -X POST https://localhost/api/test-push \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Notification de test"}'
```

**❌ Base de données corrompue**
```bash
docker compose down
docker volume rm medalert_database-data
docker compose up -d
```

**❌ Erreur "DOMAIN variable is missing"**
```bash
# Vérifier que DOMAIN est défini dans .env
cat .env | grep DOMAIN

# Si vide, définir:
echo "DOMAIN=localhost" >> .env
docker compose down && docker compose up -d
```

---

## 🛡️ Sécurité

### Domaines autorisés

Le système n'accepte QUE les domaines suivants :
- ✅ `localhost` et `127.0.0.1` (développement local)
- ✅ `medalert.ampynjord.bzh` (production)
- ✅ `*.medalert.ampynjord.bzh` (sous-domaines)

Tous les autres domaines sont **bloqués avec une erreur 403** par Nginx.

### Checklist de sécurité pour la production

- ✅ **JWT_SECRET** : Générer une nouvelle clé forte (`openssl rand -base64 64`)
- ✅ **VAPID Keys** : Générer avec `npx web-push generate-vapid-keys`
- ✅ **SSL/TLS** : Utiliser Let's Encrypt au lieu des certificats auto-signés
- ✅ **Firewall** : Configurer UFW pour limiter l'accès
- ✅ **SSH** : Désactiver l'accès root, utiliser des clés SSH
- ✅ **Fail2ban** : Protection contre les attaques par force brute
- ✅ **Mises à jour** : `docker compose pull` régulièrement
- ✅ **HTTPS uniquement** : Redirection HTTP → HTTPS forcée
- ✅ **Headers de sécurité** : HSTS, CSP, X-Frame-Options configurés

### Configuration UFW (pare-feu)

```bash
# Activer UFW
sudo ufw enable

# Autoriser les ports nécessaires
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirection)
sudo ufw allow 443/tcp   # HTTPS

# Vérifier
sudo ufw status
```

### Headers de sécurité (déjà configurés)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: ... (restrictive)
```

---

## 📱 Accès mobile

### Réseau local (WiFi)

Pour tester sur mobile (même réseau WiFi) :

```bash
# Trouver votre IP locale
ip addr show  # Linux
ipconfig      # Windows
ifconfig      # Mac

# L'IP sera du type 192.168.1.X
# Accéder depuis le mobile : https://192.168.1.X:443
```

⚠️ Accepter le certificat auto-signé sur mobile aussi.

### Installation PWA

1. Ouvrir https://localhost (ou votre domaine) sur mobile
2. Menu navigateur → "Ajouter à l'écran d'accueil"
3. L'app s'installera comme une application native
4. Activer les notifications dans les paramètres de l'app

---

## 🔄 Mise à jour

### En développement local

```bash
git pull
docker compose down
docker compose up -d --build
```

### Sur le VPS de production

```bash
# Se connecter au VPS
ssh user@votre-vps

# Aller dans le dossier
cd /home/user/MedAlert

# Récupérer les modifications
git pull

# Reconstruire et relancer
docker compose down
docker compose up -d --build

# Vérifier
docker compose ps
docker compose logs -f
```

---

## �️ Architecture technique

### Stack technologique

#### Backend
- **Node.js 18** (Alpine Linux) - Runtime JavaScript
- **Express.js** - Framework web minimaliste
- **SQLite3** - Base de données embarquée
- **Passport.js** - Authentification OAuth2 Discord
- **jsonwebtoken** - Gestion des tokens JWT
- **web-push** - Notifications push VAPID
- **HTTPS natif** - Serveur sécurisé avec TLS

#### Frontend
- **HTML5 / CSS3 / Vanilla JavaScript** - Pas de framework
- **Service Worker API** - Cache et notifications
- **Web Push API** - Notifications natives du navigateur
- **Fetch API** - Requêtes HTTP asynchrones
- **localStorage** - Stockage local du JWT
- **PWA (Progressive Web App)** - Application installable

#### Bot Discord
- **Discord.js v14** - Bibliothèque Discord officielle
- **Slash Commands** - Commandes Discord modernes
- **SQLite3** - Base de données partagée avec le backend

#### Infrastructure
- **Docker Compose** - Orchestration des conteneurs
- **Nginx** - Reverse proxy et terminaison SSL
- **OpenSSL** - Génération automatique de certificats

### Architecture microservices

```
┌─────────────────────────────────────────────────────────────┐
│                         INTERNET                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   Nginx (Port 443)   │ ◄── Reverse Proxy + SSL
        └──────────┬──────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
  ┌────▼────┐           ┌─────▼─────┐
  │   Web   │           │  Backend  │
  │  :8443  │──────────▶│   :3443   │
  └─────────┘           └─────┬─────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐   ┌─────▼─────┐  ┌─────▼─────┐
        │  Discord  │   │  SQLite   │  │ Web Push  │
        │    Bot    │   │    DB     │  │   VAPID   │
        └───────────┘   └───────────┘  └───────────┘
                              │
                        ┌─────▼─────┐
                        │   users   │
                        │  alerts   │
                        └───────────┘
```

### Flux d'authentification OAuth2

```
1. User ──────────────────▶ GET /auth/discord
                              │
2. Backend ────────────────▶ Discord OAuth2 Server
                              │
3. User ◀─────────────────── Discord Login Page
   (Authorize App)            │
                              │
4. Discord ────────────────▶ GET /auth/discord/callback?code=XXX
                              │
5. Backend ────────────────▶ POST https://discord.com/api/oauth2/token
   (Exchange code)            │
                              │
6. Discord ────────────────▶ { access_token, refresh_token }
                              │
7. Backend ────────────────▶ GET https://discord.com/api/users/@me
   (Get user profile)         GET https://discord.com/api/users/@me/guilds
                              │
8. Backend checks guild       │
   membership                 │
                              │
9. Backend generates JWT      │
   with roles from DB         │
                              │
10. Backend ───────────────▶ Redirect to frontend/?token=JWT
                              │
11. Frontend stores JWT       │
    in localStorage           │
```

### Système de permissions

```javascript
// Vérification en cascade
Token JWT → verifyToken() → req.user
             ↓
          req.user.roles → requireRole('admin') → Access granted/denied
```

**Flow complet :**
1. Frontend envoie `Authorization: Bearer <JWT>` dans les headers
2. Middleware `verifyToken` décode le JWT et vérifie la signature
3. Payload JWT est stocké dans `req.user` (contient roles)
4. Middleware `requireRole` vérifie si `req.user.roles` contient le rôle requis
5. Si oui → exécution de la route, sinon → 403 Forbidden

### Gestion des logs système

Le backend maintient un tableau circulaire de 100 logs en mémoire :

```javascript
const systemLogs = [
  {
    timestamp: "2025-10-01T14:31:18.000Z",
    level: "success",  // success, info, warning, error
    message: "Database connection: stable"
  },
  // ... 99 autres logs
];
```

Les logs sont automatiquement ajoutés lors :
- Du démarrage du serveur
- De la création d'une alerte
- D'erreurs système
- D'événements importants

### Notifications push (VAPID)

**Serveur :**
```javascript
// Configuration VAPID
webpush.setVapidDetails(
  'mailto:admin@medalert.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Envoi notification
webpush.sendNotification(subscription, JSON.stringify({
  title: "Nouvelle alerte T1",
  body: "Blessure grave - Hurston",
  icon: "/icon-192.png",
  badge: "/badge-72.png",
  vibrate: [200, 100, 200],
  tag: 'medalert',
  renotify: true
}));
```

**Client (Service Worker) :**
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json();
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: data.vibrate,
    tag: data.tag,
    renotify: data.renotify
  });
});
```

---

## �🎨 Personnalisation

### Couleurs de l'interface

Modifier `src/web/index.html` section `:root` :

```css
:root {
    --holo-cyan: #00ffff;    /* Couleur principale */
    --holo-blue: #0080ff;    /* Couleur secondaire */
    --holo-red: #ff0040;     /* Alertes critiques */
    /* ... */
}
```

### Messages du bot Discord

Modifier `src/discord/bot.js` :
- Fonction `createTierEmbed()` pour les embeds
- Section `INJURY_TIERS` pour les descriptions des tiers

### Textes de l'interface

Modifier `src/web/index.html` :
- Section `<header>` pour le logo
- Section `<nav>` pour les menus
- Section `<main>` pour le contenu

---

## 📊 Statistiques

L'interface affiche en temps réel :
- **Total Alerts** : Nombre total d'alertes
- **Active Alerts** : Alertes de moins de 24h
- **Priority High** : Nombre d'alertes T1 (critiques)
- **Backend Status** : État de connexion à l'API
- **Push Status** : État des notifications

---

## 📞 Support & Contribution

- 🐛 **Bugs** : Ouvrir une issue sur GitHub
- 💡 **Suggestions** : Pull requests bienvenues !
- 📧 **Contact** : Discord - ampynjord

### Contribuer

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add some AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

## 📝 Changelog

### Version 1.0.0 (Actuelle)
- ✅ Interface holographique Star Citizen
- ✅ Bot Discord avec slash commands
- ✅ Notifications push Web Push API
- ✅ Système de tiers (T1-T3)
- ✅ PWA installable
- ✅ Certificats SSL auto-générés
- ✅ Architecture HTTPS complète
- ✅ Configuration unifiée dev/prod
- ✅ Docker Compose orchestration
- ✅ Domaines sécurisés et whitelist

---

<div align="center">

### ⚕️ MedAlert v1.0
**Développé par ampynjord pour la communauté Star Citizen**

![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red)
![Star Citizen](https://img.shields.io/badge/Star%20Citizen-Medical%20Division-blue)

**Technologies utilisées :**

Node.js • Express • SQLite • Discord.js • Web Push API • Docker • Nginx • HTTPS/SSL

</div>

---

## 📜 Changelog

### Version 2.0.0 (Octobre 2025) - 🎉 Major Update

#### 🆕 Nouvelles fonctionnalités
- ✅ **Authentification Discord OAuth2** avec JWT
- ✅ **Système de rôles avancé** (Admin / Medic)
- ✅ **Gestion des utilisateurs** (interface admin)
- ✅ **Assignation collaborative des alertes**
- ✅ **Module "Mes Alertes"** pour le suivi personnel
- ✅ **Vérification du serveur Discord** (guild membership)
- ✅ **Panneau System Control** avec données en temps réel
- ✅ **Logs système** avec rafraîchissement automatique
- ✅ **Statistiques système** (uptime, DB size, performances)
- ✅ **API sécurisée** avec middlewares verifyToken et requireRole
- ✅ **Boutons "Prendre en charge" / "Libérer"** sur les alertes
- ✅ **Badges de statut** (disponible / assignée)

#### 🔧 Améliorations
- ⚡ Passage de 10s à 3s pour l'auto-refresh des alertes
- 🎨 Interface utilisateur enrichie avec badges et couleurs dynamiques
- 🔐 Sécurité renforcée avec validation des rôles côté serveur
- 📊 Tableaux de bord enrichis pour les admins
- 🔄 Rafraîchissement intelligent (seulement sur le panneau actif)
- 💾 Persistence des rôles en base de données
- 📝 Logs détaillés avec niveaux (success, info, warning, error)

#### 🐛 Corrections
- ✅ Fix: Middleware requireRole ne vérifiait pas le token JWT
- ✅ Fix: Les rôles n'étaient pas lus depuis la base de données
- ✅ Fix: Erreur 401 au lieu de 403 pour les endpoints admin
- ✅ Fix: Messages d'erreur plus explicites dans l'interface

### Version 1.0.0 (Initial Release)

#### Fonctionnalités initiales
- ⚡ Système d'alertes médicales via Discord
- 🎨 Interface web holographique Star Citizen
- 🔔 Notifications push natives
- 📱 PWA installable
- 🤖 Bot Discord avec slash commands
- 💾 Base de données SQLite
- 🔒 HTTPS avec certificats auto-signés
- 🐳 Déploiement Docker Compose

---

## 👥 Contributeurs

- **ampynjord** - Créateur et mainteneur principal
  - Architecture système et microservices
  - Interface holographique Star Citizen
  - Système de rôles et permissions
  - Intégration Discord OAuth2
  - Système d'assignation collaborative

---

## 📄 Licence

Ce projet est sous licence **MIT**. Voir le fichier `LICENSE` pour plus de détails.

---

## 🙏 Remerciements

- **Cloud Imperium Games** - Pour l'univers Star Citizen qui a inspiré l'interface
- **Discord.js** - Pour l'excellente bibliothèque Discord
- **Express.js** - Pour le framework web minimaliste et performant
- **La communauté Star Citizen** - Pour le feedback et les tests

---

## 🔗 Liens utiles

- 🌟 **Star Citizen** : https://robertsspaceindustries.com
- 🤖 **Discord.js Documentation** : https://discord.js.org
- 🔔 **Web Push API** : https://developer.mozilla.org/en-US/docs/Web/API/Push_API
- 🐳 **Docker Documentation** : https://docs.docker.com
- 🔐 **Passport.js** : https://www.passportjs.org

---

## 📞 Support

Pour obtenir de l'aide ou signaler un bug :

1. 📋 Ouvrir une **Issue** sur GitHub
2. 💬 Rejoindre le serveur Discord du projet
3. 📧 Contacter **ampynjord** directement

---

## 🚀 Roadmap

### 🔮 Fonctionnalités futures

#### Version 2.1.0
- [ ] **Historique des alertes** avec filtres avancés
- [ ] **Export des données** en CSV/JSON
- [ ] **Statistiques avancées** (graphiques, tendances)
- [ ] **Notifications Discord** personnalisables par utilisateur
- [ ] **Mode sombre/clair** basculable

#### Version 3.0.0
- [ ] **Système de messagerie** intégré (chat en temps réel)
- [ ] **Géolocalisation** des alertes sur une carte 3D
- [ ] **Intégration StarMap** pour les localisations Star Citizen
- [ ] **API publique** pour les applications tierces
- [ ] **Multi-tenancy** (plusieurs organisations)
- [ ] **Application mobile native** (React Native)

#### Améliorations continues
- [ ] **Tests automatisés** (Jest, Cypress)
- [ ] **CI/CD** avec GitHub Actions
- [ ] **Monitoring** avec Prometheus + Grafana
- [ ] **Backup automatique** de la base de données
- [ ] **Rate limiting** sur l'API
- [ ] **Webhooks** pour les intégrations externes

---

<div align="center">

**Fait avec ❤️ pour la communauté Star Citizen**

⭐ **N'oubliez pas de mettre une étoile si vous aimez le projet !** ⭐

**Star Citizen™** est une marque déposée de Cloud Imperium Games Corporation.  
Ce projet est un outil communautaire non officiel.

</div>
