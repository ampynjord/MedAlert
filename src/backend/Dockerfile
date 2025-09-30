FROM node:18-alpine

# Installer les dépendances nécessaires pour compiler sqlite3
RUN apk add --no-cache python3 py3-pip make g++ && \
    pip3 install --break-system-packages setuptools

WORKDIR /app

# Copier package.json et installer les dépendances dans le conteneur
COPY package*.json ./
RUN npm install --only=production

# Copier le reste du code
COPY . .

# Créer les dossiers nécessaires
RUN mkdir -p /app/database /app/certs

ENV NODE_ENV=production
ENV PORT=3000
ENV HTTPS_PORT=3443
ENV DB_PATH=/app/database/medals.db
ENV SSL_CERT_PATH=/app/certs/localhost-cert.pem
ENV SSL_KEY_PATH=/app/certs/localhost-key.pem

EXPOSE 3000 3443
CMD ["node", "server.js"]
