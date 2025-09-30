FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY . .
RUN mkdir -p /app/database
RUN mkdir -p /app/certs

ENV NODE_ENV=production
ENV PORT=3000
ENV HTTPS_PORT=3443
ENV DB_PATH=/app/database/medals.db
ENV SSL_CERT_PATH=/app/certs/localhost-cert.pem
ENV SSL_KEY_PATH=/app/certs/localhost-key.pem

EXPOSE 3000 3443
CMD ["node", "server.js"]
