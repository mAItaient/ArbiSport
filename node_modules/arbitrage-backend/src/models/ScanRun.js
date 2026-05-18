/**
 * Modèle ScanRun — CRUD sur la table scan_runs.
 */
import getDb from '../db/index.js';

export class ScanRun {
  /**
   * Crée un nouveau run de scan.
   * @param {Object} data - {mode, params_json}
   * @returns {Object} Run créé
   */
  static create(data) {
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO scan_runs (mode, params_json, status)
       VALUES (?, ?, 'running')`
    ).run(data.mode, JSON.stringify(data.params || {}));

    return db.prepare('SELECT * FROM scan_runs WHERE id = ?')
      .get(result.lastInsertRowid);
  }

  /**
   * Met à jour un run de scan.
   * @param {number} id
   * @param {Object} fields - {finished_at, opportunities_found, requests_estimated, status, error}
   * @returns {Object|undefined}
   */
  static update(id, fields) {
    const db = getDb();
    const allowed = ['finished_at', 'opportunities_found', 'requests_estimated', 'status', 'error'];
    const updates = [];
    const values = [];

    for (const key of allowed) {
      if (key in fields) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }

    if (updates.length === 0) return ScanRun.findById(id);

    values.push(id);
    db.prepare(`UPDATE scan_runs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return ScanRun.findById(id);
  }

  /**
   * Retourne un run par son identifiant.
   * @param {number} id
   * @returns {Object|undefined}
   */
  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM scan_runs WHERE id = ?').get(id);
  }

  /**
   * Retourne les derniers runs.
   * @param {number} limit
   * @returns {Array<Object>}
   */
  static findRecent(limit = 10) {
    const db = getDb();
    return db.prepare(
      'SELECT * FROM scan_runs ORDER BY started_at DESC LIMIT ?'
    ).all(limit);
  }
}

export default ScanRun;
