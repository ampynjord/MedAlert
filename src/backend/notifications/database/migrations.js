// Migrations pour le nouveau système de notifications MedAlert

const fs = require('fs');
const path = require('path');

/**
 * Gestionnaire de migrations pour la base de données
 */
class NotificationMigrations {
  constructor(database, logger = console) {
    this.db = database;
    this.logger = logger;
    this.migrations = [];

    this.initializeMigrations();
  }

  /**
   * Initialise la liste des migrations
   */
  initializeMigrations() {
    this.migrations = [
      {
        version: 1,
        name: 'create_users_table',
        description: 'Créer la table des utilisateurs',
        up: this.migration001_createUsersTable.bind(this),
        down: this.migration001_dropUsersTable.bind(this)
      },
      {
        version: 2,
        name: 'create_subscriptions_table',
        description: 'Créer la table des abonnements',
        up: this.migration002_createSubscriptionsTable.bind(this),
        down: this.migration002_dropSubscriptionsTable.bind(this)
      },
      {
        version: 3,
        name: 'create_notification_history_table',
        description: 'Créer la table de l\'historique des notifications',
        up: this.migration003_createNotificationHistoryTable.bind(this),
        down: this.migration003_dropNotificationHistoryTable.bind(this)
      },
      {
        version: 4,
        name: 'create_notification_templates_table',
        description: 'Créer la table des templates',
        up: this.migration004_createNotificationTemplatesTable.bind(this),
        down: this.migration004_dropNotificationTemplatesTable.bind(this)
      },
      {
        version: 5,
        name: 'update_alerts_table',
        description: 'Mettre à jour la table des alertes',
        up: this.migration005_updateAlertsTable.bind(this),
        down: this.migration005_revertAlertsTable.bind(this)
      },
      {
        version: 6,
        name: 'create_notification_queue_table',
        description: 'Créer la table de queue des notifications',
        up: this.migration006_createNotificationQueueTable.bind(this),
        down: this.migration006_dropNotificationQueueTable.bind(this)
      },
      {
        version: 7,
        name: 'create_analytics_table',
        description: 'Créer la table des analytics',
        up: this.migration007_createAnalyticsTable.bind(this),
        down: this.migration007_dropAnalyticsTable.bind(this)
      }
    ];
  }

  /**
   * Exécute les migrations nécessaires
   */
  async migrate() {
    try {
      // Créer la table des migrations si elle n'existe pas
      await this.createMigrationsTable();

      // Récupérer la version actuelle
      const currentVersion = await this.getCurrentVersion();
      this.logger.info(`Version actuelle de la base: ${currentVersion}`);

      // Exécuter les migrations manquantes
      const pendingMigrations = this.migrations.filter(m => m.version > currentVersion);

      if (pendingMigrations.length === 0) {
        this.logger.info('Base de données à jour');
        return;
      }

      this.logger.info(`Exécution de ${pendingMigrations.length} migrations...`);

      for (const migration of pendingMigrations) {
        await this.runMigration(migration);
      }

      this.logger.info('Migrations terminées avec succès');

    } catch (error) {
      this.logger.error('Erreur lors des migrations:', error);
      throw error;
    }
  }

  /**
   * Crée la table des migrations
   */
  async createMigrationsTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version INTEGER UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.run(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Récupère la version actuelle de la base
   */
  async getCurrentVersion() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT MAX(version) as version FROM migrations';

      this.db.get(sql, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row?.version || 0);
        }
      });
    });
  }

  /**
   * Exécute une migration
   */
  async runMigration(migration) {
    this.logger.info(`Exécution migration ${migration.version}: ${migration.description}`);

    try {
      // Démarrer une transaction
      await this.beginTransaction();

      // Exécuter la migration
      await migration.up();

      // Enregistrer la migration
      await this.recordMigration(migration);

      // Valider la transaction
      await this.commitTransaction();

      this.logger.info(`Migration ${migration.version} terminée`);

    } catch (error) {
      // Annuler la transaction en cas d'erreur
      await this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Enregistre une migration dans l'historique
   */
  async recordMigration(migration) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO migrations (version, name, description)
        VALUES (?, ?, ?)
      `;

      this.db.run(sql, [migration.version, migration.name, migration.description], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Gestion des transactions
  async beginTransaction() {
    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async commitTransaction() {
    return new Promise((resolve, reject) => {
      this.db.run('COMMIT', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async rollbackTransaction() {
    return new Promise((resolve, reject) => {
      this.db.run('ROLLBACK', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // === MIGRATIONS ===

  /**
   * Migration 001: Créer la table des utilisateurs
   */
  async migration001_createUsersTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE,
          discord_id TEXT UNIQUE,
          notification_preferences TEXT DEFAULT '{}',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT 1,
          last_seen DATETIME
        )
      `;

      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async migration001_dropUsersTable() {
    return new Promise((resolve, reject) => {
      this.db.run('DROP TABLE IF EXISTS users', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Migration 002: Créer la table des abonnements
   */
  async migration002_createSubscriptionsTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          channel_type TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          auth_keys TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_used DATETIME,
          is_active BOOLEAN DEFAULT 1,
          metadata TEXT DEFAULT '{}',
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          UNIQUE(user_id, channel_type, endpoint)
        )
      `;

      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async migration002_dropSubscriptionsTable() {
    return new Promise((resolve, reject) => {
      this.db.run('DROP TABLE IF EXISTS subscriptions', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Migration 003: Créer la table de l'historique des notifications
   */
  async migration003_createNotificationHistoryTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS notification_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          notification_id TEXT NOT NULL,
          alert_id INTEGER NOT NULL,
          user_id INTEGER,
          channel_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          sent_at DATETIME,
          delivered_at DATETIME,
          error_message TEXT,
          retry_count INTEGER DEFAULT 0,
          metadata TEXT DEFAULT '{}',
          FOREIGN KEY (alert_id) REFERENCES alerts (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
        )
      `;

      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async migration003_dropNotificationHistoryTable() {
    return new Promise((resolve, reject) => {
      this.db.run('DROP TABLE IF EXISTS notification_history', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Migration 004: Créer la table des templates
   */
  async migration004_createNotificationTemplatesTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS notification_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          channel_type TEXT NOT NULL,
          alert_type TEXT NOT NULL,
          priority TEXT NOT NULL,
          template_data TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async migration004_dropNotificationTemplatesTable() {
    return new Promise((resolve, reject) => {
      this.db.run('DROP TABLE IF EXISTS notification_templates', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Migration 005: Mettre à jour la table des alertes
   */
  async migration005_updateAlertsTable() {
    return new Promise((resolve, reject) => {
      const alterQueries = [
        'ALTER TABLE alerts ADD COLUMN alert_type TEXT DEFAULT "medical_info"',
        'ALTER TABLE alerts ADD COLUMN priority TEXT DEFAULT "medium"',
        'ALTER TABLE alerts ADD COLUMN zone TEXT',
        'ALTER TABLE alerts ADD COLUMN metadata TEXT DEFAULT "{}"',
        'ALTER TABLE alerts ADD COLUMN resolved_at DATETIME',
        'ALTER TABLE alerts ADD COLUMN resolved_by INTEGER'
      ];

      const runQuery = (index) => {
        if (index >= alterQueries.length) {
          resolve();
          return;
        }

        this.db.run(alterQueries[index], (err) => {
          if (err && !err.message.includes('duplicate column name')) {
            reject(err);
          } else {
            runQuery(index + 1);
          }
        });
      };

      runQuery(0);
    });
  }

  async migration005_revertAlertsTable() {
    // SQLite ne supporte pas ALTER TABLE DROP COLUMN facilement
    // On pourrait recréer la table, mais pour la simplicity on garde les colonnes
    return Promise.resolve();
  }

  /**
   * Migration 006: Créer la table de queue des notifications
   */
  async migration006_createNotificationQueueTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS notification_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          notification_id TEXT NOT NULL,
          alert_id INTEGER NOT NULL,
          user_id INTEGER,
          channel_type TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'medium',
          scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          processing_at DATETIME,
          completed_at DATETIME,
          status TEXT DEFAULT 'pending',
          retry_count INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 3,
          error_message TEXT,
          payload TEXT NOT NULL,
          FOREIGN KEY (alert_id) REFERENCES alerts (id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `;

      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async migration006_dropNotificationQueueTable() {
    return new Promise((resolve, reject) => {
      this.db.run('DROP TABLE IF EXISTS notification_queue', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Migration 007: Créer la table des analytics
   */
  async migration007_createAnalyticsTable() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS notification_analytics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          channel_type TEXT NOT NULL,
          priority TEXT NOT NULL,
          alert_type TEXT NOT NULL,
          total_sent INTEGER DEFAULT 0,
          total_delivered INTEGER DEFAULT 0,
          total_failed INTEGER DEFAULT 0,
          avg_delivery_time REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, channel_type, priority, alert_type)
        )
      `;

      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async migration007_dropAnalyticsTable() {
    return new Promise((resolve, reject) => {
      this.db.run('DROP TABLE IF EXISTS notification_analytics', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Rollback vers une version spécifique
   */
  async rollbackTo(targetVersion) {
    const currentVersion = await this.getCurrentVersion();

    if (targetVersion >= currentVersion) {
      this.logger.info('Aucun rollback nécessaire');
      return;
    }

    // Récupérer les migrations à annuler
    const migrationsToRollback = this.migrations
      .filter(m => m.version > targetVersion && m.version <= currentVersion)
      .reverse(); // Annuler dans l'ordre inverse

    this.logger.info(`Rollback de ${migrationsToRollback.length} migrations...`);

    for (const migration of migrationsToRollback) {
      await this.rollbackMigration(migration);
    }

    this.logger.info(`Rollback terminé vers la version ${targetVersion}`);
  }

  /**
   * Annule une migration
   */
  async rollbackMigration(migration) {
    this.logger.info(`Rollback migration ${migration.version}: ${migration.description}`);

    try {
      await this.beginTransaction();

      // Exécuter le rollback
      await migration.down();

      // Supprimer l'enregistrement de migration
      await this.removeMigrationRecord(migration.version);

      await this.commitTransaction();

      this.logger.info(`Rollback migration ${migration.version} terminé`);

    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Supprime un enregistrement de migration
   */
  async removeMigrationRecord(version) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM migrations WHERE version = ?';

      this.db.run(sql, [version], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Retourne le statut des migrations
   */
  async getStatus() {
    const currentVersion = await this.getCurrentVersion();
    const totalMigrations = this.migrations.length;
    const pendingMigrations = this.migrations.filter(m => m.version > currentVersion);

    return {
      currentVersion,
      latestVersion: totalMigrations,
      pendingCount: pendingMigrations.length,
      isUpToDate: pendingMigrations.length === 0,
      migrations: this.migrations.map(m => ({
        version: m.version,
        name: m.name,
        description: m.description,
        executed: m.version <= currentVersion
      }))
    };
  }
}

module.exports = NotificationMigrations;