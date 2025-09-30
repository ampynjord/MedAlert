# ⚕️ MedAlert - Star Citizen Medical Alert System

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

Système d'alertes médicales pour Star Citizen avec interface web holographique et bot Discord.

---

## 🚀 Démarrage rapide

### 📋 Prérequis
- 🐳 Docker & Docker Compose
- 🤖 Bot Discord (voir configuration ci-dessous)
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

   # Éditer .env avec vos credentials Discord
   nano .env
   ```

3. **Lancer l'application**
   ```bash
   docker compose up -d --build
   ```

🎉 **C'est tout !** Les certificats SSL sont générés automatiquement.

### 🌐 Accès

- **Interface web** : https://localhost:8443
- **API** : https://localhost:443

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

### Configurer le fichier `.env`

Éditez `.env` et remplissez :
```env
DISCORD_TOKEN=votre_token_copié_étape_5
DISCORD_CLIENT_ID=votre_application_id_étape_6
DISCORD_CLIENT_SECRET=votre_client_secret
DISCORD_GUILD_ID=id_de_votre_serveur_discord
```

### Inviter le bot sur votre serveur

1. Copier votre `DISCORD_CLIENT_ID` depuis `.env`
2. Aller sur https://discordapi.com/permissions.html#0
3. Coller votre CLIENT_ID
4. Sélectionner les permissions : `Send Messages`, `Use Slash Commands`, `Embed Links`
5. Copier l'URL générée et l'ouvrir dans votre navigateur
6. Sélectionner votre serveur Discord et autoriser le bot

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
- 🔔 Notifications push natives
- 🎨 Interface holographique inspirée de Star Citizen

### 🔔 Configuration des notifications push

**Windows :**
1. **Paramètres Windows** → **Système** → **Notifications**
2. Activer "Obtenir des notifications"
3. Trouver **Firefox** dans la liste et l'activer
4. Désactiver le mode "Ne pas déranger"

**Firefox :**
1. Ouvrir https://localhost:8443
2. Autoriser les notifications quand demandé
3. Si refusé : **Paramètres** → **Vie privée** → **Permissions** → **Notifications** → Ajouter `https://localhost:8443`

---

## 🌍 Déploiement en production (VPS)

### Prérequis
- VPS avec Docker installé
- Nom de domaine pointant vers votre VPS
- Ports ouverts : **80**, **443**, **8090**, **8443**

### 1. Transférer les fichiers

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'certs' \
  ./MedAlert/ user@votre-vps:/home/user/MedAlert/
```

### 2. Configurer le domaine

Sur le VPS :
```bash
cd /home/user/MedAlert
nano .env
```

Modifier :
```env
NODE_ENV=production
DOMAIN=votre-domaine.com
```

### 3. Lancer en production

```bash
docker compose up -d --build
```

🎉 Les certificats SSL sont générés automatiquement !

### 4. Utiliser Let's Encrypt (recommandé)

```bash
# Installer certbot
sudo apt update && sudo apt install certbot

# Arrêter nginx temporairement
docker compose stop nginx

# Générer le certificat
sudo certbot certonly --standalone -d votre-domaine.com

# Copier les certificats
sudo cp /etc/letsencrypt/live/votre-domaine.com/fullchain.pem certs/votre-domaine.com-cert.pem
sudo cp /etc/letsencrypt/live/votre-domaine.com/privkey.pem certs/votre-domaine.com-key.pem

# Relancer nginx
docker compose up -d
```

**Renouvellement automatique :**
```bash
sudo crontab -e
# Ajouter :
0 3 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/votre-domaine.com/*.pem /home/user/MedAlert/certs/ && docker compose restart nginx
```

---

## 🏗️ Architecture

```
Discord ◄─► Bot ◄─► Backend API ◄─► SQLite DB
              │           ▲
              ▼           │
        Web Interface ◄─► Nginx Proxy
```

### 📁 Structure du projet

```
MedAlert/
├── .env                  # Configuration unique (généré depuis .env.example)
├── .env.example          # Template de configuration
├── docker-compose.yml    # Orchestration Docker
├── certs/                # Certificats SSL auto-générés
│   ├── Dockerfile
│   └── generate-certs.sh
├── src/
│   ├── backend/          # API Express + SQLite
│   ├── discord/          # Bot Discord
│   └── web/              # Interface web PWA
└── nginx/                # Reverse proxy HTTPS
```

### 🔗 API Endpoints

```http
GET  /health                    # Status de l'API
GET  /api/alerts               # Liste des alertes
POST /api/alerts               # Créer une alerte
GET  /api/vapid-key           # Clé publique pour notifications
POST /api/subscribe           # S'abonner aux notifications push
```

---

## 🛠️ Développement

### Scripts Docker utiles

```bash
# Démarrer tous les services
docker compose up --build

# Démarrer en arrière-plan
docker compose up -d --build

# Voir les logs
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f backend
docker compose logs -f discord-bot

# Redémarrer un service
docker compose restart backend

# Arrêter tout
docker compose down

# Reset complet (⚠️ efface la base de données)
docker compose down -v
docker compose up --build
```

### Vérifications

```bash
# Voir les services actifs
docker compose ps

# Vérifier les certificats
docker compose logs cert-generator
ls -la certs/

# Tester l'API
curl -k https://localhost:443/health

# Vérifier les ports
netstat -tuln | grep -E ':(80|443|8090|8443)'
```

---

## 🔧 Debugging

### Problèmes courants

**❌ "ERR_CERT_AUTHORITY_INVALID"**
- Normal avec certificats auto-signés
- Cliquer sur "Avancé" → "Continuer" dans le navigateur

**❌ "ERR_CONNECTION_REFUSED"**
- Vérifier que Docker tourne : `docker compose ps`
- Vérifier les ports : `netstat -tuln | grep 8443`
- Firewall : `sudo ufw allow 8443/tcp`

**❌ Nginx ne démarre pas**
```bash
docker compose logs nginx
ls -la certs/*.pem  # Vérifier que les certificats existent
```

**❌ Le bot Discord ne répond pas**
```bash
docker compose logs discord-bot
# Vérifier DISCORD_TOKEN dans .env
```

**❌ Base de données corrompue**
```bash
docker compose down
docker volume rm medalert_database-data
docker compose up --build
```

---

## 🛡️ Sécurité en production

### Checklist de sécurité

- ✅ Changer `JWT_SECRET` en production (générer avec `openssl rand -base64 64`)
- ✅ Utiliser Let's Encrypt pour les certificats SSL
- ✅ Configurer un firewall (UFW)
- ✅ Limiter l'accès SSH
- ✅ Installer fail2ban
- ✅ Mettre à jour régulièrement : `docker compose pull`

### Configuration UFW (pare-feu)

```bash
# Activer UFW
sudo ufw enable

# Autoriser les ports nécessaires
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 8090/tcp  # MedAlert HTTP
sudo ufw allow 8443/tcp  # MedAlert HTTPS

# Vérifier
sudo ufw status
```

---

## 📱 Accès mobile

Pour tester sur mobile (même réseau WiFi) :

```bash
# Trouver votre IP locale
ip addr  # Linux/Mac
ipconfig  # Windows

# L'IP sera du type 192.168.1.X
# Accéder depuis le mobile : https://192.168.1.X:8443
```

⚠️ Accepter le certificat auto-signé sur mobile aussi.

---

## 🔄 Mise à jour

```bash
# Sur le serveur/VPS
cd /path/to/MedAlert

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

## 📞 Support & Contribution

- 🐛 **Bugs** : Ouvrir une issue sur GitHub
- 💡 **Suggestions** : Pull requests bienvenues !
- 📧 **Contact** : Via Discord

---

<div align="center">

### ⚕️ MedAlert v1.0
**Développé par ampynjord pour la communauté Star Citizen**

![Made with Love](https://img.shields.io/badge/Made%20with-❤️-red)
![Star Citizen](https://img.shields.io/badge/Star%20Citizen-Medical%20Division-blue)

</div>
