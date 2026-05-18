/**
 * Modèle ApiKey — CRUD sur la table api_keys.
 */
import getDb from '../db/index.js';

export class ApiKey {
  static findAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM api_keys ORDER BY provider, created_at').all();
  }

  static findActiveByProvider(provider) {
    const db = getDb();
    return db.prepare(
      `SELECT * FROM api_keys
       WHERE provider = ? AND enabled = 1 AND status != 'LIMITED'
       ORDER BY requests_remaining DESC, requests_used_total ASC`
    ).all(provider);
  }

  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
  }

  static findByValue(keyValue) {
    const db = getDb();
    return db.prepare('SELECT * FROM api_keys WHERE api_key_value = ?').get(keyValue);
  }

  /**
   * Crée une nouvelle clé API.
   * @param {Object} data - {provider, api_key_value, quota_limit?, quota_period?}
   */
  static create(data) {
    const db = getDb();
    // label auto-généré si absent
    const label = data.label || `${data.provider} key`;
    const result = db.prepare(
      `INSERT INTO api_keys (provider, label, api_key_value, plan_info, quota_limit, quota_period)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      data.provider,
      label,
      data.api_key_value,
      data.plan_info || null,
      data.quota_limit || null,
      data.quota_period || 'monthly'
    );
    return ApiKey.findById(result.lastInsertRowid);
  }

  static update(id, fields) {
    const db = getDb();
    const allowed = [
      'label', 'plan_info', 'status', 'requests_remaining',
      'requests_limit', 'last_reset_at', 'requests_used_total', 'enabled',
      'quota_limit', 'quota_period'
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

  static delete(id) {
    const db = getDb();
    const result = db.prepare('DELETE FROM api_keys WHERE id = ?').run(id);
    return result.changes > 0;
  }

  static toggle(id) {
    const key = ApiKey.findById(id);
    if (!key) return undefined;
    return ApiKey.update(id, { enabled: key.enabled ? 0 : 1 });
  }
}

export default ApiKey;
