# ⚕️ MedAlert - Star Citizen Medical Alert System

> Système d'alertes médicales avancé pour l'univers Star Citizen, avec interface holographique sci-fi et déploiement Docker professionnel.

![MedAlert Interface](https://img.shields.io/badge/Interface-Holographic%20Sci--Fi-00ffff?style=for-the-badge&logo=discord)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)
![Node.js](https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js)
![Discord.js](https://img.shields.io/badge/Discord.js-v14%20Slash%20Commands-5865F2?style=for-the-badge&logo=discord)

## 🌟 Vue d'ensemble

MedAlert est un système complet de gestion d'alertes médicales conçu pour l'univers Star Citizen. Il combine une interface web holographique futuriste, un bot Discord intelligent avec slash commands et une architecture Docker moderne pour offrir une expérience utilisateur immersive et professionnelle.

### ✨ Caractéristiques principales

- 🎮 **Système de tiers Star Citizen** (T1-T3) avec codes couleur
- 🌌 **Interface holographique** avec effets sci-fi immersifs
- ⚡ **Slash commands Discord** automatiques et structurées
- 🔔 **Notifications push** temps réel multi-plateformes
- 🐳 **Architecture Docker** complète et scalable
- 🔒 **HTTPS natif** avec certificats centralisés

## 🏗️ Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Discord   │◄──►│ Discord Bot │◄──►│ Backend API │◄──►│ SQLite DB   │
│   Server    │    │ (Slash Cmd) │    │ (Express)   │    │ (Persistent)│
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                           │                   ▲
                           ▼                   │
                   ┌─────────────┐    ┌─────────────┐
                   │ Web Interface│    │   Nginx     │
                   │ (Holographic)│    │   Proxy     │
                   └─────────────┘    └─────────────┘
```

### 📁 Structure du projet

```
MedAlert/
├── src/
│   ├── backend/          # API Express + SQLite + Notifications
│   ├── discord/          # Bot Discord avec slash commands
│   └── web/              # Interface holographique PWA
├── nginx/                # Reverse proxy + SSL
├── certs/                # Certificats SSL centralisés
└── docker-compose.yml    # Orchestration multi-services
```

## 🎯 Fonctionnalités

### 🤖 Bot Discord

**Nouvelle commande slash `/alert`** avec paramètres structurés :

```
/alert tier:T3 motif:"Blessure par arme" localisation:"GrimHex" equipe:"RSI Medical"
```

**Paramètres :**
- **`tier`** (obligatoire) : Niveau de blessure T1-T3
- **`motif`** (optionnel) : Description de l'incident
- **`localisation`** (optionnel) : Lieu de l'incident
- **`equipe`** (optionnel) : Organisation ou équipe

### 🩹 Système de tiers Star Citizen

| Tier | Nom | Couleur | Priorité | Description |
|------|-----|---------|----------|-------------|
| **T1** | Blessure légère | 🟡 Jaune | Faible | Blessures superficielles, soins basiques |
| **T2** | Blessure modérée | 🟠 Orange | Modérée | Blessures nécessitant attention médicale |
| **T3** | Blessure grave | 🔴 Rouge | Élevée | Blessures graves, intervention urgente |

### 🖥️ Interface Holographique

- **Design Command & Control** inspiré Star Citizen
- **Grille holographique** animée avec scanlines
- **Cartes d'alertes** avec matérialisation et glow effects
- **Navigation modulaire** (Alerts, Medical, Analytics, Systems, Comms)
- **Monitoring temps réel** des systèmes
- **Responsive design** mobile/desktop

### 🔔 Notifications

- **Push notifications** natives web
- **Discord embeds** avec couleurs de tier
- **Vibrations** pour alertes critiques
- **Son d'alerte** configurable
- **Mode offline** avec service worker

## 🚀 Installation

### Prérequis

- **Docker Desktop** installé et configuré
- **4GB RAM** minimum
- **Ports libres** : 80, 443, 3000, 8090, 3443, 8443
- **Token Discord Bot** (voir [Discord Developer Portal](https://discord.com/developers/applications))

### Démarrage rapide

1. **Cloner le projet**
   ```bash
   git clone <repository-url>
   cd MedAlert
   ```

2. **Configurer le bot Discord**
   ```bash
   # Éditer src/discord/.env
   DISCORD_TOKEN=VOTRE_TOKEN_DISCORD
   CLIENT_ID=VOTRE_CLIENT_ID
   API_BASE_URL=http://backend:3000
   NODE_ENV=development
   ```

3. **Lancer l'écosystème**
   ```bash
   docker-compose up --build
   ```

4. **Accéder aux services**
   - **Interface holographique** : http://localhost:8090
   - **API Backend** : http://localhost:3000/health
   - **Discord Bot** : Utiliser `/alert` sur votre serveur

## 🌐 Services Docker

| Service | Port HTTP | Port HTTPS | Description | Status |
|---------|-----------|------------|-------------|--------|
| **Backend** | 3000 | 3443 | API REST + SQLite | ✅ Opérationnel |
| **Interface** | 8090 | 8443 | PWA Holographique | ✅ Opérationnel |
| **Discord Bot** | - | - | Slash Commands | ✅ Opérationnel |
| **Nginx** | 80 | 443 | Reverse Proxy | ✅ Opérationnel |

## 📱 Utilisation

### Discord

1. **Inviter le bot** sur votre serveur Discord
2. **Utiliser la commande** `/alert` avec autocomplétion
3. **Voir l'embed** structuré avec couleurs de tier

**Exemple d'usage :**
```
/alert tier:T3 motif:"Inconscient après combat" localisation:"Port Olisar" equipe:"Medical Corp"
```

### Interface Web

1. **Ouvrir** http://localhost:8090
2. **Naviguer** entre les modules (Alerts, Medical, etc.)
3. **Voir les alertes** en temps réel avec cartes organisées
4. **Activer** les notifications push pour recevoir les alertes

### API REST

**Endpoints disponibles :**

```http
GET  /health                    # Status de l'API
GET  /api/alerts               # Liste des alertes
POST /api/alerts               # Créer une alerte
GET  /api/vapid-key           # Clé publique pour push notifications
POST /api/subscribe           # S'abonner aux notifications
POST /api/test-push           # Tester les notifications
```

## 🔧 Configuration

### Variables d'environnement

**Discord Bot** (`src/discord/.env`) :
```bash
DISCORD_TOKEN=        # Token du bot Discord
CLIENT_ID=           # ID de l'application Discord
API_BASE_URL=        # URL du backend (http://backend:3000)
NODE_ENV=            # Environment (development/production)
```

**Backend** (variables Docker) :
```yaml
NODE_ENV=production
PORT=3000
HTTPS_PORT=3443
DB_PATH=/app/database/medals.db
SSL_CERT_PATH=/app/certs/localhost-cert.pem
SSL_KEY_PATH=/app/certs/localhost-key.pem
```

### Certificats SSL

Les certificats sont centralisés dans `./certs/` :
- `localhost-cert.pem` : Certificat public
- `localhost-key.pem` : Clé privée

## 🛠️ Développement

### Structure des données

**Alerte complète :**
```json
{
  "id": 123,
  "originalMessage": "[T3] Blessure grave | Motif: Combat PvP | Localisation: Hurston",
  "userId": "discord_user_id",
  "username": "Pilote123",
  "location": "Hurston",
  "injuryType": "T2",
  "priority": "medium",
  "motif": "Combat PvP",
  "equipe": "UEE Navy",
  "tier": "T2",
  "createdAt": "2025-01-01T12:00:00.000Z"
}
```

### Scripts de gestion

```bash
# Démarrer les services
docker-compose up --build

# Redémarrer un service
docker-compose restart discord-bot

# Voir les logs
docker-compose logs -f backend

# Arrêter tout
docker-compose down

# Reset complet de la base
docker-compose down
docker volume rm medalert_database-data
docker-compose up --build
```

## 📊 Monitoring

### Métriques disponibles

- **Total des alertes** créées
- **Alertes actives** (dernières 24h)
- **Alertes haute priorité** (T3)
- **Status réseau** (Backend, Discord, Database)
- **Notifications push** (statut, abonnements)

### Surveillance

- **Health check** : `GET /health`
- **Status API** en temps réel sur l'interface
- **Logs Docker** : `docker-compose logs -f`

## 🔒 Sécurité

- **HTTPS obligatoire** pour la production
- **Headers de sécurité** (HSTS, XSS Protection, etc.)
- **CORS configuré** pour les domaines autorisés
- **Certificats SSL** auto-signés pour le développement
- **Validation des données** côté serveur et client

## 🐛 Dépannage

### Problèmes courants

**Bot Discord ne répond pas :**
```bash
# Vérifier les logs
docker-compose logs discord-bot

# Vérifier la configuration
cat src/discord/.env

# Redémarrer le bot
docker-compose restart discord-bot
```

**Interface web inaccessible :**
```bash
# Vérifier le statut des services
docker-compose ps

# Vérifier les logs web
docker-compose logs web

# Vérifier le proxy Nginx
docker-compose logs nginx
```

**Base de données corrompue :**
```bash
# Reset complet
docker-compose down
docker volume rm medalert_database-data
docker-compose up --build
```

### Logs utiles

```bash
# Tous les services
docker-compose logs -f

# Service spécifique
docker-compose logs -f backend
docker-compose logs -f discord-bot
docker-compose logs -f web
docker-compose logs -f nginx
```

## 🤝 Contribution

1. **Fork** le projet
2. **Créer** une branche feature (`git checkout -b feature/nouvelle-fonction`)
3. **Commit** les changements (`git commit -am 'Ajouter nouvelle fonction'`)
4. **Push** la branche (`git push origin feature/nouvelle-fonction`)
5. **Créer** une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

## 🎮 Star Citizen Medical Division

*Développé pour la communauté Star Citizen par des joueurs passionnés*

**⚕️ Sauver des vies dans les étoiles, une alerte à la fois**

---

### 📞 Support

- **Issues GitHub** : Signaler des bugs ou demander des fonctionnalités
- **Discord** : Rejoindre le serveur de support MedAlert
- **Documentation** : Wiki complet disponible

### 🔮 Feuille de route

- [ ] **Mobile App** native avec Capacitor
- [ ] **Analytics avancées** avec graphiques temps réel
- [ ] **Géolocalisation** Star Citizen (systèmes/planètes)
- [ ] **Intégration** avec d'autres outils communautaires
- [ ] **Multi-langue** (EN, FR, DE, ES)
- [ ] **API publique** pour développeurs tiers

**Version actuelle :** 2.0.0 - Interface Holographique
**Dernière mise à jour :** Septembre 2025