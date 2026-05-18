/**
 * Modèle TwoWayMarket — CRUD sur la table two_way_markets.
 */
import getDb from '../db/index.js';

export class TwoWayMarket {
  /**
   * Upsert un marché 2-way dans la table.
   * @param {Object} data - Données du marché
   */
  static upsert(data) {
    const db = getDb();
    db.prepare(
      `INSERT INTO two_way_markets
       (provider, sport, league, bookmaker, market_key, outcome_count, is_two_way, events_tested, two_outcome_rate, last_checked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(provider, sport, league, bookmaker, market_key)
       DO UPDATE SET
         outcome_count = excluded.outcome_count,
         is_two_way = excluded.is_two_way,
         events_tested = excluded.events_tested,
         two_outcome_rate = excluded.two_outcome_rate,
         last_checked_at = excluded.last_checked_at`
    ).run(
      data.provider, data.sport, data.league || '',
      data.bookmaker, data.market_key,
      data.outcome_count || 0,
      data.is_two_way ? 1 : 0,
      data.events_tested || 0,
      data.two_outcome_rate || 0.0
    );
  }

  /**
   * Retourne les marchés 2-way selon des filtres optionnels.
   * @param {Object} filters - {provider?, sport?, twoWayOnly?}
   * @returns {Array<Object>}
   */
  static findAll({ provider, sport, twoWayOnly = false } = {}) {
    const db = getDb();
    const conditions = [];
    const values = [];

    if (provider) {
      conditions.push('provider = ?');
      values.push(provider);
    }
    if (sport) {
      conditions.push('sport = ?');
      values.push(sport);
    }
    if (twoWayOnly) {
      conditions.push('is_two_way = 1');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return db.prepare(
      `SELECT * FROM two_way_markets ${where}
       ORDER BY sport, market_key, bookmaker`
    ).all(...values);
  }

  /**
   * Retourne les clés de marchés 2-way uniques pour un provider et sport.
   * @param {string} provider
   * @param {string} sport
   * @returns {Array<string>}
   */
  static getTwoWayMarketKeys(provider, sport) {
    const db = getDb();
    return db.prepare(
      `SELECT DISTINCT market_key FROM two_way_markets
       WHERE provider = ? AND sport = ? AND is_two_way = 1`
    ).all(provider, sport).map(r => r.market_key);
  }
}

export default TwoWayMarket;
