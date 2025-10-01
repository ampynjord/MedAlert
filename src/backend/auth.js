// auth.js - Gestion de l'authentification OAuth2 Discord + JWT
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

// Callback URL dynamique selon l'environnement
const getCallbackURL = () => {
    const domain = process.env.DOMAIN || 'localhost';
    const port = process.env.HTTPS_PORT || 3443;

    if (domain === 'localhost') {
        return `https://localhost:${port}/auth/discord/callback`;
    } else {
        return `https://${domain}/auth/discord/callback`;
    }
};

console.log('🔐 Discord OAuth2 Callback URL:', getCallbackURL());
console.log('🔑 Discord Client ID:', DISCORD_CLIENT_ID);
console.log('🔒 Discord Client Secret:', DISCORD_CLIENT_SECRET ? `✓ défini (${DISCORD_CLIENT_SECRET.substring(0, 10)}...)` : '✗ manquant');

// Configuration de la stratégie Discord OAuth2 avec gestion d'erreur détaillée
const discordStrategy = new DiscordStrategy({
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: getCallbackURL(),
    scope: ['identify', 'email', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    // Le profil Discord contient toutes les infos utilisateur
    console.log('✅ Authentification Discord réussie pour:', profile.username);
    
    // Vérifier que l'utilisateur fait partie du serveur requis
    const REQUIRED_GUILD_ID = process.env.DISCORD_GUILD_ID;
    const userGuilds = profile.guilds || [];
    const isInRequiredGuild = userGuilds.some(guild => guild.id === REQUIRED_GUILD_ID);
    
    if (REQUIRED_GUILD_ID && !isInRequiredGuild) {
        console.warn(`⚠️  Utilisateur ${profile.username} n'est pas membre du serveur requis (${REQUIRED_GUILD_ID})`);
        return done(null, false, { message: 'not_in_guild' });
    }
    
    const user = {
        discordId: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        avatar: profile.avatar,
        email: profile.email,
        guilds: profile.guilds || []
    };
    return done(null, user);
});

// Override de la méthode d'erreur pour logger les détails
const originalAuthorizationError = discordStrategy.error;
discordStrategy.error = function(err) {
    console.error('❌ Erreur Discord OAuth2 détaillée:');
    console.error('   Message:', err.message);
    console.error('   Status:', err.status || err.statusCode);
    console.error('   Body:', err.data || err.body);
    console.error('   Stack:', err.stack);
    return originalAuthorizationError.call(this, err);
};

passport.use(discordStrategy);

// Sérialisation de l'utilisateur (pour la session)
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Génération d'un JWT
function generateToken(user) {
    const payload = {
        discordId: user.discordId,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
        email: user.email,
        roles: user.roles || ['medic'] // Rôles par défaut
    };

    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// Middleware de vérification JWT
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant ou invalide' });
    }

    const token = authHeader.substring(7); // Enlever "Bearer "

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

// Middleware optionnel - ne bloque pas si pas de token, mais décode si présent
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        } catch (error) {
            // Token invalide, on continue sans user
            req.user = null;
        }
    }
    next();
}

// Middleware pour vérifier si l'utilisateur est dans un guild spécifique
function requireGuild(guildId) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Non authentifié' });
        }

        // En production, on devrait vérifier les guilds de l'utilisateur
        // Pour le moment, on accepte tous les utilisateurs authentifiés
        next();
    };
}

// Middleware pour vérifier les rôles
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Non authentifié' });
        }

        const userRoles = req.user.roles || [];
        const hasRole = allowedRoles.some(role => userRoles.includes(role));

        if (!hasRole) {
            return res.status(403).json({ 
                error: 'Accès refusé',
                message: `Rôle requis: ${allowedRoles.join(' ou ')}`,
                userRoles: userRoles
            });
        }

        next();
    };
}

module.exports = {
    passport,
    generateToken,
    verifyToken,
    optionalAuth,
    requireGuild,
    requireRole
};
