// Serveur Express minimal pour servir le frontend MedAlert
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const app = express();

const PORT = process.env.PUBLIC_WEB_HTTP_PORT || process.env.PORT || 8090;
const HTTPS_PORT = process.env.PUBLIC_WEB_HTTPS_PORT || process.env.WEB_INTERNAL_PORT || 8443;
const PUBLIC_DIR = path.join(__dirname);
const API_URL = process.env.API_URL || 'https://backend:3443';

// Middleware pour forcer HTTPS
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  // Headers de sécurité HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // PWA a besoin de SAMEORIGIN
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Proxy HTTPS pour les requêtes API vers le backend
app.use('/api', (req, res) => {
  const targetUrl = `${API_URL}${req.originalUrl}`;
  console.log(`Proxy HTTPS: ${req.method} ${req.originalUrl} -> ${targetUrl}`);

  // Copier les headers appropriés
  const headers = {};
  for (const key in req.headers) {
    if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'connection') {
      headers[key] = req.headers[key];
    }
  }

  const options = {
    method: req.method,
    headers: headers,
    // Options HTTPS pour auto-signé
    rejectUnauthorized: false // Accepter les certificats auto-signés en développement
  };

  const proxyReq = https.request(targetUrl, options, (proxyRes) => {
    res.status(proxyRes.statusCode);

    // Copier les headers de réponse
    Object.keys(proxyRes.headers).forEach(key => {
      res.setHeader(key, proxyRes.headers[key]);
    });

    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy HTTPS error:', err.message);
    res.status(500).json({ error: 'Erreur de connexion sécurisée au backend' });
  });

  // Stream the request body to the proxy
  req.pipe(proxyReq);
});

app.use(express.static(PUBLIC_DIR));

// Redirige toute route non-API inconnue vers index.html (pour SPA/PWA)
// IMPORTANT: Exclure /api pour ne pas interférer avec le proxy
app.get('*', (req, res, next) => {
  // Ne pas capturer les routes API
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Configuration HTTPS uniquement
const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs/localhost-key.pem');
const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs/localhost-cert.pem');

// Configuration serveur avec support HTTPS optionnel
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };

  // Serveur HTTPS principal
  https.createServer(options, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`🔒 Frontend MedAlert sécurisé sur https://0.0.0.0:${HTTPS_PORT}`);
  });

  // Serveur HTTP de redirection
  const httpApp = express();
  httpApp.use((req, res) => {
    res.redirect(301, `https://${req.headers.host.replace(`:${PORT}`, `:${HTTPS_PORT}`)}${req.url}`);
  });
  httpApp.listen(PORT, '0.0.0.0', () => {
    console.log(`🔄 Redirection HTTP vers HTTPS sur le port ${PORT}`);
  });

} else {
  console.warn('⚠️  Certificats HTTPS non trouvés, mode HTTP uniquement:', { keyPath, certPath });
  console.warn('🔧 Configuration via Nginx proxy - Backend utilisera HTTPS');

  // Serveur HTTP fallback pour développement derrière proxy
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Frontend MedAlert sur http://0.0.0.0:${PORT} (via proxy Nginx)`);
  });
}
