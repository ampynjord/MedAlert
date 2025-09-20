# MedAlert# MedAlert (refonte complète)# ⚕️ MedAlert - Star Citizen Medical Alert System



Système d'alerte médicale temps réel (backend Node.js, bot Discord, web PWA, Docker Compose)



## Sommaire## Structure> Système d'alertes médicales avancé pour l'univers Star Citizen, avec interface sci-fi et déploiement Docker professionnel.

- [Fonctionnalités](#fonctionnalités)

- [Architecture](#architecture)- `src/backend` : API Express + SQLite

- [Prérequis](#prérequis)

- [Installation rapide](#installation-rapide)- `src/discord` : Bot Discord (discord.js)## 🌟 Vue d'ensemble

- [Utilisation](#utilisation)

- [Variables d'environnement](#variables-denvironnement)- `src/web` : Web minimal (PWA)

- [Maintenance & reset](#maintenance--reset)

- [Dépannage](#dépannage)- `docker-compose.yml` : Orchestration multi-serviceMedAlert est un système complet de gestion d'alertes médicales conçu pour l'univers Star Citizen. Il combine une interface web futuriste, un bot Discord intelligent et une architecture Docker moderne pour offrir une expérience utilisateur immersive et professionnelle.



---



## Fonctionnalités## Lancement rapide### 🎯 Fonctionnalités Principales

- **Backend Node.js/Express** : API REST, stockage SQLite, endpoints `/health` et `/api/alerts`.

- **Bot Discord** : Commande `!alerte` pour créer une alerte depuis Discord.```sh

- **Web PWA** : Tableau de bord des alertes récentes, installable mobile/desktop.

- **Docker Compose** : Orchestration complète, persistance des données, configuration simple.docker-compose up --build- **🖥️ Interface Médicale Sci-Fi** : Design futuriste avec thème Star Citizen



## Architecture```- **🔔 Notifications Push** : Système unifié d'alertes en temps réel

```

[Discord] <-> [Bot Discord] <-> [Backend API] <-> [SQLite DB]- **🤖 Bot Discord** : Intégration Discord avec commandes automatisées

                                 ^

                                 |## Reset complet- **🐳 Architecture Docker** : Déploiement containerisé professionnel

                           [Web PWA]

``````sh- **📊 Monitoring** : Surveillance des performances en temps réel



## Prérequisdocker-compose down- **💾 Persistance** : Base de données SQLite avec sauvegarde automatique

- Docker & Docker Compose

- Un token Discord valide (voir https://discord.com/developers/applications)# (optionnel) Supprimer le volume :



## Installation rapidedocker volume rm medalert_database-data## 🚀 Démarrage Rapide

1. **Cloner le repo**

2. **Configurer les variables d'environnement**```

   - `src/discord/.env` :

     ```### Prérequis

     DISCORD_TOKEN=VOTRE_TOKEN_DISCORD

     API_BASE_URL=http://backend:3000## Endpoints backend- Windows 10/11 avec PowerShell

     NODE_ENV=production

     ```- `GET /health` : statut API- Docker Desktop installé et configuré

3. **Lancer l'écosystème**

   ```sh- `GET /api/alerts` : liste alertes- 4GB RAM minimum

   docker compose up --build -d

   ```- `POST /api/alerts` : nouvelle alerte- Ports 3000, 8090, 80 libres

4. **Accéder aux services**

   - Backend API : http://localhost:3000/health

   - Web dashboard : http://localhost:8090

   - Bot Discord : invitez-le sur votre serveur, utilisez `!alerte ...`## Configuration### Installation



## Utilisation- Variables d'environnement dans chaque dossier (`.env.example`)```powershell

- **Créer une alerte** :

  - Sur Discord : `!alerte [message]`- Volume Docker unique pour SQLite# 1. Cloner le projet

  - Via API : `POST /api/alerts`

- **Consulter les alertes** :git clone <repository-url>

  - Web : http://localhost:8090

  - API : `GET /api/alerts`## Dépannagecd MedAlert



## Variables d'environnement- Vérifier les logs :

- `src/discord/.env` :

  - `DISCORD_TOKEN` : Token du bot Discord  - `docker-compose logs backend`# 2. Démarrage automatique

  - `API_BASE_URL` : URL du backend (par défaut `http://backend:3000`)

- `src/backend/.env` (optionnel) :  - `docker-compose logs discord-bot`.\docker-start.ps1

  - `PORT` : Port du backend (défaut 3000)

  - `DB_PATH` : Chemin SQLite (défaut `/app/database/medals.db`)  - `docker-compose logs web`



## Maintenance & reset- Si bug de droits/volume : reset complet (voir ci-dessus)# 3. Accéder à l'interface

- **Arrêter tous les services** :

  ```sh# http://localhost:8090 - Interface médicale

  docker compose down

  ```## À personnaliser# http://localhost:3000 - API Backend

- **Réinitialiser la base SQLite** :

  ```sh- Token Discord, URL API, etc. dans `.env` du bot```

  docker volume rm medalert_dbdata

  docker compose up --build -d- Frontend web selon besoins

  ```

- **Mettre à jour une dépendance** :## 🐳 Gestion Docker

  - Modifier le `package.json` concerné puis rebuild le service.

### Scripts de Gestion

## Dépannage

- **Bot Discord ne démarre pas** :#### Windows PowerShell

  - Vérifiez le token dans `.env` (pas d'espaces, pas de retour à la ligne)```powershell

  - Rebuild l'image : `docker compose build --no-cache discord-bot`# Démarrage simple

- **Backend ne répond pas** :.\docker-start.ps1

  - Vérifiez les logs : `docker compose logs backend`

  - Vérifiez le port et la variable `PORT`# Gestion avancée

- **Web inaccessible** :.\docker-manage.ps1 [action] [options]

  - Vérifiez le port 8090, les logs du service web

# Actions disponibles :

---# start, stop, restart, status, logs, build, clean, backup, restore, shell, monitor

```

© 2025 MedAlert. Développé pour une gestion d'urgence médicale moderne et collaborative.

### Services Docker

| Service | Port | Description | Status |
|---------|------|-------------|---------|
| **Backend** | 3000 | API REST Node.js | ✅ Opérationnel |
| **Interface** | 8090 | PWA Médicale Sci-Fi | ✅ Opérationnel |
| **Discord Bot** | - | Notifications Discord | ✅ Opérationnel |
| **Nginx** | 80 | Reverse Proxy | ✅ Opérationnel |
| **Database** | - | SQLite Persistant | ✅ Opérationnel |

## 📱 Interface Utilisateur

### Design Sci-Fi Medical
- **Thème** : Interface médicale futuriste Star Citizen
- **Couleurs** : Cyan, bleu foncé, accents verts
- **Typographie** : Orbitron (police futuriste)
- **Animations** : Effets lumineux et transitions fluides
- **Responsive** : Compatible mobile et desktop

### Fonctionnalités Interface
- � **Notifications Push** unifiées
- 📊 **Tableau de bord** temps réel
- 🎯 **Alertes Médicales** prioritaires
- 📈 **Statistiques** de santé
- 🌐 **PWA** installable
│   └── web/              # Interface web / PWA
├── mobile/
│   ├── android/          # Projet Android (Capacitor)
│   └── ios/              # Projet iOS (Capacitor)
├── database/             # Base de données SQLite
├── start.bat             # Script de démarrage système
└── build-mobile.bat      # Script de build mobile
```

## 🔧 Services

- **Backend API**: Port 3000 - http://localhost:3000
- **Interface Web**: Port 8090 - http://localhost:8090  
- **Bot Discord**: Connecté automatiquement

## 📱 Application Mobile

L'APK Android est généré dans :
`mobile/android/app/build/outputs/apk/debug/app-debug.apk`

## 🎯 Fonctionnalités

- ✅ Notifications push natives
- ✅ Vibrations pour alertes
- ✅ Mode offline
- ✅ Interface Star Citizen
- ✅ Intégration Discord automatique

---
*MedAlert Team - Star Citizen Medical Division*

## Exemple de commande Discord

Pour créer une alerte médicale depuis Discord, utilisez la commande suivante dans un salon où le bot est présent :

```text
!alerte [votre message d'alerte]
```

**Exemple :**
```text
!alerte Besoin d’une évacuation médicale à GrimHex, blessure grave, inconscient.
```

Le bot répondra avec un embed professionnel contenant :
- Le titre de l’alerte
- Le message envoyé
- L’auteur
- La date et l’heure
- Un code couleur médical/sci-fi
- Une icône médicale

> **Astuce :** Vous pouvez consulter toutes les alertes sur l’interface web : http://localhost:8090