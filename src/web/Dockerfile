# Dockerfile pour le frontend Express
FROM node:18-alpine
WORKDIR /app
COPY . .
# Copie les certificats HTTPS auto-signés si présents
COPY localhost-key.pem localhost-cert.pem ./
RUN npm install --omit=dev
EXPOSE 8090 8443
CMD ["node", "server.js"]
