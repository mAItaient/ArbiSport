/**
 * Modèle ApiKey — CRUD sur la table api_keys.
 */
import getDb from '../db/index.js';

export class ApiKey {
  /**
   * Retourne toutes les clés API.
   * @returns {Array<Object>} Liste des clés API
   */
  static findAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM api_keys ORDER BY provider, created_at').all();
  }

  /**
   * Retourne les clés actives pour un fournisseur donné.
   * @param {string} provider - 'theOddsApi' ou 'oddsApiIo'
   * @returns {Array<Object>}
   */
  static findActiveByProvider(provider) {
    const db = getDb();
    return db.prepare(
      `SELECT * FROM api_keys
       WHERE provider = ? AND enabled = 1 AND status != 'LIMITED'
       ORDER BY requests_remaining DESC, requests_used_total ASC`
    ).all(provider);
  }

  /**
   * Retourne une clé par son identifiant.
   * @param {number} id
   * @returns {Object|undefined}
   */
  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
  }

  /**
   * Retourne une clé par sa valeur.
   * @param {string} keyValue
   * @returns {Object|undefined}
   */
  static findByValue(keyValue) {
    const db = getDb();
    return db.prepare('SELECT * FROM api_keys WHERE api_key_value = ?').get(keyValue);
  }

  /**
   * Crée une nouvelle clé API.
   * @param {Object} data - {provider, label, api_key_value, plan_info?}
   * @returns {Object} Clé créée
   */
  static create(data) {
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO api_keys (provider, label, api_key_value, plan_info)
       VALUES (?, ?, ?, ?)`
    ).run(data.provider, data.label, data.api_key_value, data.plan_info || null);

    return ApiKey.findById(result.lastInsertRowid);
  }

  /**
   * Met à jour les champs d'une clé API.
   * @param {number} id
   * @param {Object} fields - Champs à mettre à jour
   * @returns {Object|undefined} Clé mise à jour
   */
  static update(id, fields) {
    const db = getDb();
    const allowed = [
      'label', 'plan_info', 'status', 'requests_remaining',
      'requests_limit', 'last_reset_at', 'requests_used_total', 'enabled'
    ];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (key in fields) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (updates.length === 0) return ApiKey.findById(id);

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE api_keys SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return ApiKey.findById(id);
  }

  /**
   * Supprime une clé API.
   * @param {number} id
   * @returns {boolean}
   */
  static delete(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Active ou désactive une clé API.
   * @param {number} id
   * @returns {Object|undefined}
   */
  static toggle(id) {
    const db = getDb();
    const key = ApiKey.findById(id);
    if (!key) return undefined;
    return ApiKey.update(id, { enabled: key.enabled ? 0 : 1 });
  }
}

export default ApiKey;
