FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN mkdir -p /app/database
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/database/medals.db
EXPOSE 3000
CMD ["node", "server.js"]
