# MedAlert - Star Citizen Medical Alert System

Système d'alertes médicales pour Star Citizen avec interface web holographique et bot Discord.

## Installation

### Prérequis
- Docker Desktop
- Token Discord Bot ([Discord Developer Portal](https://discord.com/developers/applications))

### Configuration
1. Cloner le projet
2. Configurer le bot Discord dans `src/discord/.env`:
   ```
   DISCORD_TOKEN=VOTRE_TOKEN_DISCORD
   CLIENT_ID=VOTRE_CLIENT_ID
   API_BASE_URL=http://backend:3000
   ```
3. Lancer l'écosystème:
   ```bash
   docker-compose up --build
   ```

### Accès
- Interface web : http://localhost:8090
- API : http://localhost:3000/health

## Utilisation

### Discord
Commande `/alert` avec paramètres :
```
/alert tier:T1 motif:"Description" localisation:"Lieu" equipe:"Organisation"
```

### Système de tiers
| Tier | Priorité | Couleur | Description |
|------|----------|---------|-------------|
| T1 | Haute | Rouge | Blessure grave, intervention urgente |
| T2 | Moyenne | Orange | Blessure modérée |
| T3 | Basse | Jaune | Blessure légère |

### Interface Web
- Navigation entre modules (Alerts, Medical, Analytics, Systems, Comms)
- Alertes en temps réel avec cartes colorées selon le tier
- Notifications push natives

## Architecture

```
Discord ◄─► Bot ◄─► Backend API ◄─► SQLite DB
              │           ▲
              ▼           │
        Web Interface ◄─► Nginx Proxy
```

### Structure
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

## API

```http
GET  /health                    # Status
GET  /api/alerts               # Liste des alertes
POST /api/alerts               # Créer une alerte
GET  /api/vapid-key           # Clé publique notifications
POST /api/subscribe           # S'abonner aux notifications
```

## Développement

### Scripts Docker
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

**Version :** 1.0
**Développeur :** ampynjord