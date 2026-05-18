/**
 * Module d'accès à la base de données SQLite.
 * Ouvre la connexion better-sqlite3 et exécute les migrations au démarrage.
 */
import Database from 'better-sqlite3';
import { readFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db;

/**
 * Initialise et retourne la connexion SQLite (singleton).
 * Crée le répertoire data/ si absent, puis exécute les migrations.
 * @returns {Database} instance better-sqlite3
 */
export function getDb() {
  if (db) return db;

  // Crée le dossier de données si nécessaire
  const dir = dirname(config.dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info(`Répertoire de données créé : ${dir}`);
  }

  db = new Database(config.dbPath);

  // Active le mode WAL pour de meilleures performances concurrentes
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);

  logger.info(`Base de données SQLite ouverte : ${config.dbPath}`);
  return db;
}

/**
 * Exécute les fichiers de migration SQL par ordre alphabétique.
 * @param {Database} database - Instance SQLite
 */
function runMigrations(database) {
  const migrationsDir = join(__dirname, 'migrations');

  try {
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      database.exec(sql);
      logger.info(`Migration exécutée : ${file}`);
    }
  } catch (err) {
    logger.error(`Erreur lors des migrations : ${err.message}`);
    throw err;
  }
}

/**
 * Ferme la connexion à la base de données (utilisé dans les tests).
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDb;
