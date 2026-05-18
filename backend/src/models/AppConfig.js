/**
 * Modèle AppConfig — configuration clé/valeur JSON persistée en SQLite.
 */
import getDb from '../db/index.js';

export class AppConfig {
  /**
   * Retourne la valeur d'une clé de configuration.
   * @param {string} key
   * @param {any} defaultValue - Valeur par défaut si la clé est absente
   * @returns {any} Valeur désérialisée
   */
  static get(key, defaultValue = null) {
    const db = getDb();
    const row = db.prepare('SELECT value_json FROM app_config WHERE key = ?').get(key);
    if (!row) return defaultValue;
    try {
      return JSON.parse(row.value_json);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Définit une clé de configuration (upsert).
   * @param {string} key
   * @param {any} value - Valeur à sérialiser en JSON
   */
  static set(key, value) {
    const db = getDb();
    db.prepare(
      `INSERT INTO app_config (key, value_json) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`
    ).run(key, JSON.stringify(value));
  }

  /**
   * Retourne toutes les clés de configuration.
   * @returns {Object} Objet clé/valeur désérialisé
   */
  static getAll() {
    const db = getDb();
    const rows = db.prepare('SELECT key, value_json FROM app_config').all();
    const result = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value_json);
      } catch {
        result[row.key] = null;
      }
    }
    return result;
  }

  /**
   * Met à jour plusieurs clés en une seule transaction.
   * @param {Object} data - Objet clé/valeur
   */
  static setMany(data) {
    const db = getDb();
    const upsert = db.transaction((entries) => {
      for (const [key, value] of entries) {
        db.prepare(
          `INSERT INTO app_config (key, value_json) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`
        ).run(key, JSON.stringify(value));
      }
    });
    upsert(Object.entries(data));
  }
}

export default AppConfig;
