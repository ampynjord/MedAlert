# ⚕️ MedAlert - Star Citizen Medical Alert System

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

Système d'alertes médicales pour Star Citizen avec interface web holographique, bot Discord et notifications push.

---

## 🚀 Démarrage rapide

### 📋 Prérequis
- 🐳 **Docker & Docker Compose**
- 🤖 **Bot Discord** (voir configuration ci-dessous)
- 🦊 **Firefox** (recommandé pour les notifications push)

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

### Configurer le fichier `.env`

Éditez `.env` et remplissez :
```env
# Discord
DISCORD_TOKEN=votre_token_copié_étape_5
DISCORD_CLIENT_ID=votre_application_id_étape_6
DISCORD_CLIENT_SECRET=votre_client_secret_étape_7
DISCORD_GUILD_ID=id_de_votre_serveur_discord

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

### 🖥️ Interface Web

- 🧭 Navigation entre modules (Alerts, Medical, Analytics, Systems, Comms)
- ⚡ Alertes en temps réel avec cartes colorées selon le tier
- 🔔 Notifications push natives (Web Push API)
- 🎨 Interface holographique inspirée de Star Citizen
- 📱 PWA (Progressive Web App) - installable sur mobile et desktop
- 🔄 Auto-refresh toutes les 10 secondes

### 👥 Système de rôles

MedAlert utilise un système de permissions basé sur les rôles :

| Rôle | Badge | Accès aux modules | Description |
|------|-------|-------------------|-------------|
| **Admin** | 👑 | Alerts, Medical, Analytics, Systems | Accès complet à tous les modules |
| **Medic** | ⚕️ | Alerts, Medical | Accès limité aux alertes et systèmes médicaux |

**Configuration des rôles :**
- Les rôles sont attribués automatiquement lors de la connexion Discord
- Par défaut, tous les utilisateurs ont le rôle **Medic**
- L'utilisateur `ampynjord` a automatiquement les rôles **Admin + Medic**
- Pour ajouter d'autres admins, modifiez la fonction `getUserRoles()` dans `src/backend/server.js`

**Permissions par module :**
```
✅ Alerts    → Medic + Admin
✅ Medical   → Medic + Admin
🔒 Analytics → Admin uniquement
🔒 Systems   → Admin uniquement
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

```http
# Santé de l'API
GET  /health

# Alertes
GET  /api/alerts              # Liste des 50 dernières alertes
POST /api/alerts              # Créer une alerte

# Notifications Push
GET  /api/vapid-key           # Clé publique VAPID
POST /api/subscribe           # S'abonner aux notifications
POST /api/test-push           # Tester une notification (dev)
```

### 🐳 Services Docker

| Service | Port(s) | Description |
|---------|---------|-------------|
| **cert-generator** | - | Génère les certificats SSL au démarrage |
| **backend** | 3000, 3443 | API Express + SQLite + Web Push |
| **discord-bot** | - | Bot Discord avec slash commands |
| **web** | 8090, 8443 | Frontend PWA + Service Worker |
| **nginx** | 80, 443, 8444 | Reverse proxy HTTPS |

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

## 🎨 Personnalisation

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
