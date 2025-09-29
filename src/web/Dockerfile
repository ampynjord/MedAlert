# Dockerfile pour le frontend Express
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p /app/certs

# Copier les certificats SSL
COPY localhost-cert.pem /app/certs/
COPY localhost-key.pem /app/certs/

ENV SSL_CERT_PATH=/app/certs/localhost-cert.pem
ENV SSL_KEY_PATH=/app/certs/localhost-key.pem

EXPOSE 8090 8443
CMD ["node", "server.js"]
