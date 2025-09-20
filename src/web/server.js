// Serveur Express minimal pour servir le frontend MedAlert
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const app = express();

const PORT = process.env.PORT || 8090;
const HTTPS_PORT = 8443;
const PUBLIC_DIR = path.join(__dirname);

app.use(express.static(PUBLIC_DIR));

// Redirige toute route inconnue vers index.html (pour SPA/PWA)
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Serveur HTTP classique
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend MedAlert en ligne sur http://0.0.0.0:${PORT}`);
});

// Serveur HTTPS local (si les certificats existent)
const keyPath = path.join(__dirname, 'localhost-key.pem');
const certPath = path.join(__dirname, 'localhost-cert.pem');
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  https.createServer(options, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`Frontend MedAlert sécurisé sur https://0.0.0.0:${HTTPS_PORT}`);
  });
} else {
  console.log('⚠️  Certificats HTTPS non trouvés. Génère-les avec openssl pour activer https://localhost:8443');
}
