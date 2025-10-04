// Serveur Express minimal pour servir le frontend MedAlert
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const app = express();

const PORT = process.env.WEB_PORT || 8090;
const PUBLIC_DIR = path.join(__dirname);
const API_URL = process.env.API_URL || 'http://backend:3000';

// Proxy HTTP pour les requêtes API vers le backend
app.use('/api', (req, res) => {
  const targetUrl = `${API_URL}${req.originalUrl}`;
  console.log(`Proxy HTTP: ${req.method} ${req.originalUrl} -> ${targetUrl}`);

  // Copier les headers appropriés
  const headers = {};
  for (const key in req.headers) {
    if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'connection') {
      headers[key] = req.headers[key];
    }
  }

  const options = {
    method: req.method,
    headers: headers
  };

  const proxyReq = http.request(targetUrl, options, (proxyRes) => {
    res.status(proxyRes.statusCode);

    // Copier les headers de réponse
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });

    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy HTTP error:', err.message);
    res.status(500).json({ error: 'Erreur de connexion au backend' });
  });

  req.pipe(proxyReq);
});

app.use(express.static(PUBLIC_DIR));

// Serveur HTTP - Traefik gere le HTTPS
app.listen(PORT, "0.0.0.0", () => {
  console.log("Frontend MedAlert on http://0.0.0.0:" + PORT + " - SSL via Traefik");
});
