/**
 * Modèle PendingEventMatch — CRUD sur la table pending_event_matches.
 * Stocke les appariements d'événements dont la confiance est entre 0.70 et 0.90,
 * pour validation manuelle par l'utilisateur.
 */
import getDb from '../db/index.js';

export class PendingEventMatch {
  static findAll(status = 'pending') {
    const db = getDb();
    return db.prepare(
      `SELECT * FROM pending_event_matches WHERE status = ? ORDER BY score DESC, created_at DESC`
    ).all(status);
  }

  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM pending_event_matches WHERE id = ?').get(id);
  }

  static countPending() {
    const db = getDb();
    return db.prepare(`SELECT COUNT(*) AS n FROM pending_event_matches WHERE status = 'pending'`).get().n;
  }

  /**
   * Crée (ou ignore si doublon) une entrée d'appariement.
   * @param {Object} m
   * @returns {Object|null}
   */
  static create(m) {
    const db = getDb();
    try {
      const result = db.prepare(
        `INSERT INTO pending_event_matches
          (event_a_id, event_a_provider, event_a_home, event_a_away, event_a_commence,
           event_b_id, event_b_provider, event_b_home, event_b_away, event_b_commence, score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(event_a_id, event_a_provider, event_b_id, event_b_provider) DO NOTHING`
      ).run(
        m.event_a_id, m.event_a_provider, m.event_a_home, m.event_a_away, m.event_a_commence,
        m.event_b_id, m.event_b_provider, m.event_b_home, m.event_b_away, m.event_b_commence,
        m.score
      );
      if (result.lastInsertRowid) return PendingEventMatch.findById(result.lastInsertRowid);
      return null;
    } catch {
      return null;
    }
  }

  static updateStatus(id, status) {
    const db = getDb();
    db.prepare(
      `UPDATE pending_event_matches SET status = ?, resolved_at = datetime('now') WHERE id = ?`
    ).run(status, id);
    return PendingEventMatch.findById(id);
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM pending_event_matches WHERE id = ?').run(id).changes > 0;
  }
}

export default PendingEventMatch;
