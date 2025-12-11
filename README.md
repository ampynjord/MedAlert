# 🚨 MedAlert

Système d'alertes médicales avec Discord bot

## 📋 Informations

- **Services**:
  - Backend API (Node.js)
  - Frontend Web (PWA)
  - Discord Bot
- **Reverse Proxy**: Traefik
- **Base de données**: SQLite

## 🚀 Gestion

### Avec le gestionnaire centralisé
```bash
cd /home/debian/apps
./manage.sh medalert start      # Démarrer
./manage.sh medalert stop       # Arrêter
./manage.sh medalert restart    # Redémarrer
./manage.sh medalert logs       # Voir les logs
./manage.sh medalert status     # Statut
```

### Commandes Docker directes
```bash
cd /home/debian/apps/medalert
docker compose up -d            # Démarrer
docker compose down             # Arrêter
docker compose restart          # Redémarrer
docker compose logs -f          # Logs temps réel
docker compose ps               # Statut
```

## 📁 Structure

```
/home/debian/apps/medalert/
├── docker-compose.yml          # Configuration Docker
└── src/
    ├── backend/                # API Node.js
    │   ├── Dockerfile
    │   ├── server.js
    │   ├── auth.js
    │   └── package.json
    ├── web/                    # Application web PWA
    │   ├── Dockerfile
    │   ├── index.html
    │   ├── login.html
    │   ├── server.js
    │   ├── manifest.json
    │   └── service-worker.js
    └── discord/                # Bot Discord
        ├── Dockerfile
        ├── bot.js
        └── package.json
```

## 🔧 Configuration

### Services
- **medalert-backend**: API sur port 3000 (interne)
- **medalert-web**: Frontend sur port 8090/8443 (interne)
- **medalert-discord**: Bot Discord

### Traefik
- Routes configurées pour API et Web

## 💾 Backup

⚠️ **Système de backup à implémenter**

Pour l'instant, backup manuel de la base SQLite:
```bash
# Backup manuel
docker exec medalert-backend cp /app/database/medals.db /app/database/medals_backup_$(date +%Y%m%d).db

# Copier en local
docker cp medalert-backend:/app/database/medals_backup_YYYYMMDD.db ./
```

## 📝 Maintenance

### Voir les logs par service
```bash
# Backend
docker compose logs -f medalert-backend

# Web
docker compose logs -f medalert-web

# Discord bot
docker compose logs -f medalert-discord
```

### Mettre à jour
```bash
cd /home/debian/apps/medalert
docker compose pull
docker compose up -d
```

### Rebuild après modifications
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 🆘 Dépannage

### Un service ne démarre pas
```bash
# Vérifier le statut
docker compose ps

# Logs spécifiques
docker compose logs medalert-backend
docker compose logs medalert-web
docker compose logs medalert-discord

# Redémarrer un service
docker compose restart medalert-backend
```

### Bot Discord déconnecté
```bash
# Vérifier les logs
docker compose logs medalert-discord

# Redémarrer
docker compose restart medalert-discord
```

## 🔗 Liens

- Documentation: À compléter
- Discord: Bot configuré
