
// Dépendances Node.js (toujours en tout début de fichier)
const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const webpush = require('web-push');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { passport, generateToken, verifyToken, optionalAuth, requireRole } = require('./auth');

// Utiliser les variables d'environnement pour VAPID
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@medalert.local';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('❌ VAPID keys manquantes dans .env');
  process.exit(1);
}

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Stockage simple des abonnements push dans un fichier JSON
const SUBS_FILE = path.join(__dirname, 'push-subs.json');

function sendPushToAll(title, body) {
  let subs = [];
  if (fs.existsSync(SUBS_FILE)) {
    try {
      subs = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
      if (!Array.isArray(subs)) subs = [];
    } catch (err) {
      console.error('Erreur lecture subs:', err.message);
      subs = [];
    }
  }

  if (subs.length === 0) {
    console.log('Aucun abonnement push à notifier');
    return;
  }

  subs.forEach(sub => {
    webpush.sendNotification(sub, JSON.stringify({
      title,
      body,
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='192' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' fill='%23000'/%3E%3Ctext x='96' y='120' font-size='80' text-anchor='middle' fill='%2300d4ff'%3E⚕️%3C/text%3E%3C/svg%3E",
      vibrate: [200, 100, 200],
      tag: 'medalert',
      renotify: true
    })).catch(err => {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Abonnement expiré, suppression
        const filtered = subs.filter(s => s.endpoint !== sub.endpoint);
        fs.writeFileSync(SUBS_FILE, JSON.stringify(filtered, null, 2));
      } else {
        console.error('Erreur push:', err.message);
      }
    });
  });
}

function saveSubscription(sub) {
  let subs = [];
  if (fs.existsSync(SUBS_FILE)) {
    try { subs = JSON.parse(fs.readFileSync(SUBS_FILE)); } catch {}
  }
  // Unicité par endpoint
  if (!subs.find(s => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
  }
}

// ...existing code...

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || '/app/database/medals.db';

// Middleware pour forcer HTTPS (doit être avant les routes)
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  // Headers de sécurité HTTPS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'my-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // HTTPS uniquement
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));
app.use(passport.initialize());
app.use(passport.session());

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
    motif TEXT,
    equipe TEXT,
    tier TEXT,
    assignedTo TEXT,
    assignedToUsername TEXT,
    assignedAt DATETIME,
    status TEXT DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('❌ Erreur création table alerts:', err);
      process.exit(1);
    }
    console.log('✅ Table alerts prête');
    
    // Migration : Ajouter les colonnes si elles n'existent pas
    db.run(`ALTER TABLE alerts ADD COLUMN assignedTo TEXT`, () => {});
    db.run(`ALTER TABLE alerts ADD COLUMN assignedToUsername TEXT`, () => {});
    db.run(`ALTER TABLE alerts ADD COLUMN assignedAt DATETIME`, () => {});
    db.run(`ALTER TABLE alerts ADD COLUMN status TEXT DEFAULT 'pending'`, () => {});
  });

  // Création de la table users pour l'authentification
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discordId TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    discriminator TEXT,
    avatar TEXT,
    email TEXT,
    roles TEXT DEFAULT 'medic',
    lastLogin DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('❌ Erreur création table users:', err);
      process.exit(1);
    }
    console.log('✅ Table users prête');
    
    // Ajout de la colonne roles si elle n'existe pas (migration)
    db.run(`ALTER TABLE users ADD COLUMN roles TEXT DEFAULT 'medic'`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('⚠️  Avertissement migration roles:', err.message);
      }
    });
  });

  console.log('✅ Base SQLite prête:', DB_PATH);
});

// Endpoint de santé
app.get('/health', (req, res) => {
  res.json({ status: 'ok', db: DB_PATH });
});

// Endpoint pour récupérer la configuration publique (URLs, etc.)
app.get('/api/config', (req, res) => {
  res.json({
    backendAuthUrl: process.env.BACKEND_AUTH_URL || 'https://localhost:3443',
    frontendUrl: process.env.FRONTEND_URL || 'https://localhost:8443',
    vapidPublicKey: VAPID_PUBLIC_KEY
  });
});

// ========================================
// ROUTES D'AUTHENTIFICATION
// ========================================

// Fonction pour déterminer les rôles d'un utilisateur
function getUserRoles(username) {
  const username_lower = username.toLowerCase();
  
  // Admin principal avec tous les droits
  if (username_lower === 'ampynjord') {
    return 'admin,medic'; // Admin + Medic
  }
  
  // Par défaut, tout le monde est Medic
  return 'medic';
}

// Redirection vers Discord OAuth2
app.get('/auth/discord', passport.authenticate('discord'));

// Callback après authentification Discord
app.get('/auth/discord/callback',
  (req, res, next) => {
    passport.authenticate('discord', (err, user, info) => {
      if (err) {
        return next(err);
      }
      
      // Si l'utilisateur n'est pas dans le serveur Discord requis
      if (!user && info && info.message === 'not_in_guild') {
        return res.redirect(`${process.env.FRONTEND_URL}/login.html?error=not_in_guild`);
      }
      
      if (!user) {
        return res.redirect('/auth/error');
      }
      
      req.logIn(user, (err) => {
        if (err) {
          return next(err);
        }
        next();
      });
    })(req, res, next);
  },
  (req, res) => {
    // Sauvegarder ou mettre à jour l'utilisateur dans la DB
    const user = req.user;
    const roles = getUserRoles(user.username);

    db.run(`INSERT INTO users (discordId, username, discriminator, avatar, email, roles, lastLogin)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(discordId) DO UPDATE SET
              username = excluded.username,
              discriminator = excluded.discriminator,
              avatar = excluded.avatar,
              email = excluded.email,
              roles = excluded.roles,
              lastLogin = datetime('now')`,
      [user.discordId, user.username, user.discriminator, user.avatar, user.email, roles],
      (err) => {
        if (err) {
          console.error('❌ Erreur sauvegarde utilisateur:', err);
        } else {
          console.log(`✅ Utilisateur ${user.username} connecté avec rôles: ${roles}`);
        }
      }
    );

    // Ajouter les rôles à l'objet user pour le JWT
    user.roles = roles.split(',');

    // Générer un JWT
    const token = generateToken(user);

    // Rediriger vers le frontend avec le token (depuis .env)
    const frontendUrl = `${process.env.FRONTEND_URL}/?token=${token}`;
    console.log(`🔄 Redirection vers: ${frontendUrl}`);

    res.redirect(frontendUrl);
  }
);

// Route d'erreur d'authentification avec plus de détails
app.get('/auth/error', (req, res) => {
  console.error('❌ Erreur OAuth2 Discord:', req.session?.passport?.error || 'Erreur inconnue');
  res.status(401).json({ 
    error: 'Échec de l\'authentification Discord',
    details: 'Vérifiez que l\'URL de callback est bien configurée dans Discord Developer Portal',
    callbackUrl: `${process.env.BACKEND_AUTH_URL}/auth/discord/callback`
  });
});

// Route pour vérifier si l'utilisateur est authentifié
app.get('/auth/me', verifyToken, (req, res) => {
  res.json({ 
    user: req.user,
    roles: req.user.roles || ['medic']
  });
});

// Route de déconnexion
app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la déconnexion' });
    }
    res.json({ message: 'Déconnexion réussie' });
  });
});

// ========================================
// ROUTES GESTION UTILISATEURS (Admin uniquement)
// ========================================

// Liste de tous les utilisateurs (Admin uniquement)
app.get('/api/users', verifyToken, requireRole('admin'), (req, res) => {
  db.all('SELECT id, discordId, username, discriminator, avatar, email, roles, lastLogin, createdAt FROM users ORDER BY lastLogin DESC', (err, rows) => {
    if (err) {
      console.error('❌ Erreur récupération utilisateurs:', err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    res.json(rows);
  });
});

// Mettre à jour les rôles d'un utilisateur (Admin uniquement)
app.put('/api/users/:discordId/roles', verifyToken, requireRole('admin'), (req, res) => {
  const { discordId } = req.params;
  const { roles } = req.body;

  if (!roles || !Array.isArray(roles)) {
    return res.status(400).json({ error: 'Rôles invalides' });
  }

  const rolesString = roles.join(',');

  db.run('UPDATE users SET roles = ? WHERE discordId = ?', [rolesString, discordId], function(err) {
    if (err) {
      console.error('❌ Erreur mise à jour rôles:', err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    console.log(`✅ Rôles mis à jour pour ${discordId}: ${rolesString}`);
    res.json({ message: 'Rôles mis à jour avec succès', roles: roles });
  });
});

// ========================================
// ROUTES ALERTES (protégées)
// ========================================

// Récupérer les alertes (accessible sans auth, mais on peut ajouter verifyToken si besoin)
app.get('/api/alerts', (req, res) => {
  db.all('SELECT * FROM alerts ORDER BY createdAt DESC LIMIT 50', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur base de données' });
    res.json(rows);
  });
});

// Supprimer une alerte
app.delete('/api/alerts/:id', (req, res) => {
  const alertId = req.params.id;
  console.log(`🗑️  DELETE /api/alerts/${alertId} - Request received`);

  if (!alertId) {
    console.log('❌ DELETE failed: ID manquant');
    return res.status(400).json({ error: 'ID manquant' });
  }

  db.run('DELETE FROM alerts WHERE id = ?', [alertId], function(err) {
    if (err) {
      console.error('❌ Erreur suppression alerte:', err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }

    if (this.changes === 0) {
      console.log(`❌ Alerte ${alertId} non trouvée (changes: ${this.changes})`);
      return res.status(404).json({ error: 'Alerte non trouvée' });
    }

    console.log(`✅ Alerte ${alertId} supprimée (changes: ${this.changes})`);
    res.json({ message: 'Alerte supprimée avec succès', id: alertId });
  });
});

// Prendre en charge une alerte
app.post('/api/alerts/:id/assign', verifyToken, (req, res) => {
  const alertId = req.params.id;
  const user = req.user;

  console.log(`👤 Prise en charge alerte ${alertId} par ${user.username}`);

  db.run(
    'UPDATE alerts SET assignedTo = ?, assignedToUsername = ?, assignedAt = datetime("now"), status = ? WHERE id = ?',
    [user.discordId, user.username, 'assigned', alertId],
    function(err) {
      if (err) {
        console.error('❌ Erreur prise en charge alerte:', err);
        return res.status(500).json({ error: 'Erreur base de données' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Alerte non trouvée' });
      }

      console.log(`✅ Alerte ${alertId} assignée à ${user.username}`);
      
      // Récupérer l'alerte mise à jour
      db.get('SELECT * FROM alerts WHERE id = ?', [alertId], (err, alert) => {
        if (err) return res.status(500).json({ error: 'Erreur base de données' });
        res.json(alert);
      });
    }
  );
});

// Libérer une alerte
app.post('/api/alerts/:id/unassign', verifyToken, (req, res) => {
  const alertId = req.params.id;
  const user = req.user;

  console.log(`🔓 Libération alerte ${alertId} par ${user.username}`);

  // Vérifier que c'est bien l'utilisateur assigné ou un admin
  db.get('SELECT * FROM alerts WHERE id = ?', [alertId], (err, alert) => {
    if (err || !alert) {
      return res.status(404).json({ error: 'Alerte non trouvée' });
    }

    const isAdmin = (user.roles || []).includes('admin');
    const isAssignedToUser = alert.assignedTo === user.discordId;

    if (!isAdmin && !isAssignedToUser) {
      return res.status(403).json({ error: 'Vous ne pouvez libérer que vos propres alertes' });
    }

    db.run(
      'UPDATE alerts SET assignedTo = NULL, assignedToUsername = NULL, assignedAt = NULL, status = ? WHERE id = ?',
      ['pending', alertId],
      function(err) {
        if (err) {
          console.error('❌ Erreur libération alerte:', err);
          return res.status(500).json({ error: 'Erreur base de données' });
        }

        console.log(`✅ Alerte ${alertId} libérée`);
        
        db.get('SELECT * FROM alerts WHERE id = ?', [alertId], (err, alert) => {
          if (err) return res.status(500).json({ error: 'Erreur base de données' });
          res.json(alert);
        });
      }
    );
  });
});

// Récupérer les alertes assignées à l'utilisateur connecté
app.get('/api/alerts/my-assignments', verifyToken, (req, res) => {
  const user = req.user;
  
  db.all('SELECT * FROM alerts WHERE assignedTo = ? ORDER BY assignedAt DESC', [user.discordId], (err, rows) => {
    if (err) {
      console.error('❌ Erreur récupération alertes assignées:', err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    res.json(rows);
  });
});

// Récupérer toutes les assignations (Admin uniquement)
app.get('/api/alerts/all-assignments', verifyToken, requireRole('admin'), (req, res) => {
  db.all('SELECT * FROM alerts WHERE assignedTo IS NOT NULL ORDER BY assignedAt DESC', (err, rows) => {
    if (err) {
      console.error('❌ Erreur récupération toutes les assignations:', err);
      return res.status(500).json({ error: 'Erreur base de données' });
    }
    res.json(rows);
  });
});

// Créer une alerte
app.post('/api/alerts', (req, res) => {
  const { originalMessage, userId, username, location, injuryType, priority, motif, equipe, tier } = req.body;
  if (!originalMessage || !userId || !username) return res.status(400).json({ error: 'Champs requis manquants' });

  db.run(
    'INSERT INTO alerts (originalMessage, userId, username, location, injuryType, priority, motif, equipe, tier) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [originalMessage, userId, username, location, injuryType, priority, motif, equipe, tier],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erreur base de données' });
      db.get('SELECT * FROM alerts WHERE id = ?', [this.lastID], (err, alert) => {
        if (err) return res.status(500).json({ error: 'Erreur base de données' });
        res.status(201).json(alert);

        // Envoi notification push à tous les abonnés avec tier
        const tierIcon = tier ? getTierIcon(tier) : '🚨';
        const tierName = tier ? getTierName(tier) : 'Alerte';
        sendPushToAll(`${tierIcon} ${tierName} - MedAlert`, `${username} : ${originalMessage}`);
      });
    }
  );
});

// Fonction helper pour les icônes de tier (T1-T3)
function getTierIcon(tier) {
  const icons = {
    'T1': '🔴', // Rouge pour T1 (priorité haute)
    'T2': '🔶', // Orange pour T2 (priorité moyenne)
    'T3': '⚠️'  // Jaune pour T3 (priorité basse)
  };
  return icons[tier] || '🚨';
}

// Fonction helper pour les noms de tier (T1-T3)
function getTierName(tier) {
  const names = {
    'T1': 'Blessure grave',     // T1 = Priorité haute
    'T2': 'Blessure modérée',   // T2 = Priorité moyenne
    'T3': 'Blessure légère'     // T3 = Priorité basse
  };
  return names[tier] || 'Alerte médicale';
}

// Endpoint pour récupérer la clé publique VAPID
app.get('/api/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Endpoint pour s'abonner aux notifications push
app.post('/api/subscribe', (req, res) => {
  try {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Abonnement invalide' });
    }

    saveSubscription(subscription);
    console.log('✅ Nouvel abonnement push enregistré:', subscription.endpoint.substring(0, 50) + '...');
    res.status(201).json({ message: 'Abonnement enregistré avec succès' });
  } catch (error) {
    console.error('❌ Erreur enregistrement abonnement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Endpoint pour tester les notifications push
app.post('/api/test-push', (req, res) => {
  try {
    const { title, body } = req.body;
    const testTitle = title || '🧪 Test de notification MedAlert';
    const testBody = body || 'Ceci est un test de notification push depuis le backend.';

    sendPushToAll(testTitle, testBody);
    console.log('✅ Notification de test envoyée');
    res.json({ message: 'Notification de test envoyée à tous les abonnés' });
  } catch (error) {
    console.error('❌ Erreur envoi notification test:', error);
    res.status(500).json({ error: 'Erreur envoi notification' });
  }
});

// Configuration HTTPS uniquement
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const keyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'certs/localhost-key.pem');
const certPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'certs/localhost-cert.pem');

// Serveur HTTPS uniquement
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };

  // Serveur HTTPS principal
  https.createServer(options, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`🔒 Backend MedAlert sécurisé sur https://0.0.0.0:${HTTPS_PORT}`);
  });

  // Serveur HTTP de redirection (optionnel pour dev)
  if (process.env.NODE_ENV !== 'production') {
    const httpApp = express();
    httpApp.use((req, res) => {
      res.redirect(301, `https://${req.headers.host.replace(':3000', ':3443')}${req.url}`);
    });
    httpApp.listen(PORT, '0.0.0.0', () => {
      console.log(`🔄 Redirection HTTP vers HTTPS sur le port ${PORT}`);
    });
  }
} else {
  console.error('❌ Certificats HTTPS requis non trouvés:', { keyPath, certPath });
  console.error('🔧 Générez les certificats SSL ou vérifiez les variables d\'environnement');
  process.exit(1);
}