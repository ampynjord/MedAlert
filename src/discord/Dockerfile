# Dockerfile pour le bot Discord MedAlert
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production || yarn install --production
COPY . .
CMD ["node", "/app/bot.js"]
