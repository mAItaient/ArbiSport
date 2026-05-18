/**
 * Initialisation SQLite avec better-sqlite3.
 * Exécute toutes les migrations au démarrage.
 */
import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

export function getDb() {
  if (!db) {
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

function runMigrations(database) {
  // Crée la table de suivi des migrations si absente
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const already = database.prepare('SELECT 1 FROM migrations WHERE filename = ?').get(file);
    if (already) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    try {
      // Exécute chaque statement séparément pour éviter les erreurs sur ALTER TABLE
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        try {
          database.exec(stmt + ';');
        } catch (err) {
          // ALTER TABLE échoue si la colonne existe déjà — on ignore silencieusement
          if (err.message.includes('duplicate column name')) {
            logger.debug(`Migration ${file}: colonne déjà existante, ignorée.`);
          } else {
            throw err;
          }
        }
      }
      database.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file);
      logger.info(`Migration appliquée : ${file}`);
    } catch (err) {
      logger.error(`Erreur migration ${file}: ${err.message}`);
      throw err;
    }
  }
}

export default getDb;
