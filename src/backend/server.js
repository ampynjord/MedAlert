const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/app/database/medals.db';

app.use(cors());
app.use(express.json());

// Initialisation de la base SQLite
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Erreur base de données:', err);
    process.exit(1);
  }
  db.run(`CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    originalMessage TEXT NOT NULL,
    userId TEXT NOT NULL,
    username TEXT NOT NULL,
    location TEXT,
    injuryType TEXT,
    priority TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('❌ Erreur création table alerts:', err);
      process.exit(1);
    }
    console.log('✅ Table alerts prête');
  });
  console.log('✅ Base SQLite prête:', DB_PATH);
});

// Endpoint de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: DB_PATH });
});

// Récupérer les alertes
app.get('/api/alerts', (req, res) => {
  db.all('SELECT * FROM alerts ORDER BY createdAt DESC LIMIT 50', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur base de données' });
    res.json(rows);
  });
});

// Créer une alerte
app.post('/api/alerts', (req, res) => {
  const { originalMessage, userId, username, location, injuryType, priority } = req.body;
  if (!originalMessage || !userId || !username) return res.status(400).json({ error: 'Champs requis manquants' });
  db.run(
    'INSERT INTO alerts (originalMessage, userId, username, location, injuryType, priority) VALUES (?, ?, ?, ?, ?, ?)',
    [originalMessage, userId, username, location, injuryType, priority],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erreur base de données' });
      db.get('SELECT * FROM alerts WHERE id = ?', [this.lastID], (err, alert) => {
        if (err) return res.status(500).json({ error: 'Erreur base de données' });
        res.status(201).json(alert);
      });
    }
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend MedAlert lancé sur le port ${PORT} (HTTP)`);
});

// Serveur HTTPS local (si les certificats existent)
const keyPath = path.join(__dirname, 'localhost-key.pem');
const certPath = path.join(__dirname, 'localhost-cert.pem');
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
  https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Backend MedAlert sécurisé sur https://0.0.0.0:${PORT}`);
  });
} else {
  console.log('⚠️  Certificats HTTPS non trouvés pour le backend. Génère-les dans src/backend pour activer https://localhost:3000');
}