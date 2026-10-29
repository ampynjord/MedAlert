# 🚨 MedAlert

Medical alert system with a Discord bot

## 📋 Information

- **Services**:
  - Backend API (Node.js)
  - Web frontend (PWA)
  - Discord bot
- **Reverse proxy**: Traefik
- **Database**: SQLite

## 🚀 Management

### With the central manager
```bash
cd /home/debian/apps
./manage.sh medalert start      # Start
./manage.sh medalert stop       # Stop
./manage.sh medalert restart    # Restart
./manage.sh medalert logs       # View logs
./manage.sh medalert status     # Status
```

### Direct Docker commands
```bash
cd /home/debian/apps/medalert
docker compose up -d            # Start
docker compose down             # Stop
docker compose restart          # Restart
docker compose logs -f          # Live logs
docker compose ps               # Status
```

## 📁 Structure

```
/home/debian/apps/medalert/
├── docker-compose.yml          # Docker configuration
└── src/
    ├── backend/                # Node.js API
    │   ├── Dockerfile
    │   ├── server.js
    │   ├── auth.js
    │   └── package.json
    ├── web/                    # PWA web application
    │   ├── Dockerfile
    │   ├── index.html
    │   ├── login.html
    │   ├── server.js
    │   ├── manifest.json
    │   └── service-worker.js
    └── discord/                # Discord bot
        ├── Dockerfile
        ├── bot.js
        └── package.json
```

## 🔧 Configuration

### Services
- **medalert-backend**: API on port 3000 (internal)
- **medalert-web**: Frontend on port 8090/8443 (internal)
- **medalert-discord**: Discord bot

### Traefik
- Routes configured for the API and the web app

## 💾 Backup

⚠️ **Backup system still to be implemented**

For now, back up the SQLite database manually:
```bash
# Manual backup
docker exec medalert-backend cp /app/database/medals.db /app/database/medals_backup_$(date +%Y%m%d).db

# Copy locally
docker cp medalert-backend:/app/database/medals_backup_YYYYMMDD.db ./
```

## 📝 Maintenance

### View logs per service
```bash
# Backend
docker compose logs -f medalert-backend

# Web
docker compose logs -f medalert-web

# Discord bot
docker compose logs -f medalert-discord
```

### Update
```bash
cd /home/debian/apps/medalert
docker compose pull
docker compose up -d
```

### Rebuild after changes
```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 🆘 Troubleshooting

### A service does not start
```bash
# Check the status
docker compose ps

# Specific logs
docker compose logs medalert-backend
docker compose logs medalert-web
docker compose logs medalert-discord

# Restart a service
docker compose restart medalert-backend
```

### Discord bot disconnected
```bash
# Check the logs
docker compose logs medalert-discord

# Restart
docker compose restart medalert-discord
```

## 🔗 Links

- Documentation: to be completed
- Discord: bot configured