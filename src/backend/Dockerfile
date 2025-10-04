FROM node:18-alpine

# Installer les dépendances nécessaires pour compiler sqlite3
RUN apk add --no-cache python3 py3-pip make g++ &&     pip3 install --break-system-packages setuptools

WORKDIR /app

# Copier package.json et installer les dépendances dans le conteneur
COPY package*.json ./
RUN npm install --only=production

# Copier le reste du code
COPY . .

# Créer le dossier database
RUN mkdir -p /app/database

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/database/medals.db

EXPOSE 3000
CMD ["node", "server.js"]
