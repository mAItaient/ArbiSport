/**
 * Modèle ConfirmedAlias — CRUD sur la table confirmed_aliases.
 * Stocke les alias d'équipes confirmés manuellement, utilisés pour
 * améliorer la précision de l'appariement futur.
 */
import getDb from '../db/index.js';
import { normalizeTeam } from '../core/eventMatcher.js';

export class ConfirmedAlias {
  static findAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM confirmed_aliases ORDER BY team_canonical').all();
  }

  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM confirmed_aliases WHERE id = ?').get(id);
  }

  /**
   * Charge tous les alias sous forme d'objet { normalisé → canonique normalisé }.
   * Utilisable directement par eventMatcher.
   */
  static toMap() {
    const out = {};
    for (const row of ConfirmedAlias.findAll()) {
      out[normalizeTeam(row.team_alias)] = normalizeTeam(row.team_canonical);
    }
    return out;
  }

  static create({ team_canonical, team_alias, source_provider }) {
    const db = getDb();
    try {
      const r = db.prepare(
        `INSERT INTO confirmed_aliases (team_canonical, team_alias, source_provider)
         VALUES (?, ?, ?)
         ON CONFLICT(team_canonical, team_alias) DO NOTHING`
      ).run(team_canonical, team_alias, source_provider || null);
      return r.lastInsertRowid ? ConfirmedAlias.findById(r.lastInsertRowid) : null;
    } catch {
      return null;
    }
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM confirmed_aliases WHERE id = ?').run(id).changes > 0;
  }
}

export default ConfirmedAlias;
