/**
 * Modèle ArbitrageOpportunity — CRUD sur la table arbitrage_opportunities.
 */
import getDb from '../db/index.js';

export class ArbitrageOpportunity {
  /**
   * Insère une nouvelle opportunité d'arbitrage en base.
   * @param {Object} data - Données de l'opportunité
   * @returns {Object} Opportunité créée
   */
  static create(data) {
    const db = getDb();
    const result = db.prepare(
      `INSERT INTO arbitrage_opportunities (
        provider, sport, league, event_id, event_label,
        market_key, market_label,
        outcome_a_label, outcome_b_label,
        bookmaker_a, bookmaker_b,
        odds_a, odds_b,
        stake_total, stake_a, stake_b,
        profit_a, profit_b, gain_min, gain_min_pct, roi,
        bookmaker_a_url, bookmaker_b_url,
        status, commence_time
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?
      )`
    ).run(
      data.provider, data.sport, data.league, data.event_id, data.event_label,
      data.market_key, data.market_label,
      data.outcome_a_label, data.outcome_b_label,
      data.bookmaker_a, data.bookmaker_b,
      data.odds_a, data.odds_b,
      data.stake_total, data.stake_a, data.stake_b,
      data.profit_a, data.profit_b, data.gain_min, data.gain_min_pct, data.roi,
      data.bookmaker_a_url || null, data.bookmaker_b_url || null,
      data.status || 'active', data.commence_time || null
    );

    return db.prepare('SELECT * FROM arbitrage_opportunities WHERE id = ?')
      .get(result.lastInsertRowid);
  }

  /**
   * Retourne une liste paginée d'opportunités.
   * @param {Object} params - {limit, offset, since, minRoiPct}
   * @returns {Object} {items, total}
   */
  static findAll({ limit = 50, offset = 0, since, minRoiPct } = {}) {
    const db = getDb();
    const conditions = [];
    const values = [];

    if (since) {
      conditions.push('timestamp >= ?');
      values.push(since);
    }
    if (minRoiPct !== undefined) {
      conditions.push('roi >= ?');
      values.push(minRoiPct);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db.prepare(
      `SELECT COUNT(*) as count FROM arbitrage_opportunities ${where}`
    ).get(...values).count;

    const items = db.prepare(
      `SELECT * FROM arbitrage_opportunities ${where}
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`
    ).all(...values, limit, offset);

    return { items, total };
  }

  /**
   * Retourne les données agrégées pour les hotspots analytics.
   * @param {Object} params - {days, groupBy, minOccurrences}
   * @returns {Array<Object>}
   */
  static getHotspots({ days = 7, groupBy = 'market', minOccurrences = 1 } = {}) {
    const db = getDb();
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    let groupByClause, selectClause;

    if (groupBy === 'pair') {
      groupByClause = 'bookmaker_a, bookmaker_b';
      selectClause = 'bookmaker_a, bookmaker_b, NULL as market_key, NULL as sport';
    } else {
      groupByClause = 'sport, market_key';
      selectClause = 'NULL as bookmaker_a, NULL as bookmaker_b, market_key, sport';
    }

    return db.prepare(
      `SELECT
        ${selectClause},
        COUNT(*) as occurrences,
        AVG(roi) as avg_roi,
        MAX(roi) as max_roi,
        AVG(gain_min) as avg_gain_min,
        MIN(timestamp) as first_seen,
        MAX(timestamp) as last_seen
       FROM arbitrage_opportunities
       WHERE timestamp >= ?
       GROUP BY ${groupByClause}
       HAVING occurrences >= ?
       ORDER BY occurrences DESC, avg_roi DESC
       LIMIT 50`
    ).all(since, minOccurrences);
  }

  /**
   * Insère plusieurs opportunités en une seule transaction.
   * @param {Array<Object>} opportunities - Liste d'opportunités à insérer
   * @returns {number} Nombre d'opportunités insérées
   */
  static bulkCreate(opportunities) {
    const db = getDb();
    const insertMany = db.transaction((opps) => {
      let count = 0;
      for (const opp of opps) {
        ArbitrageOpportunity.create(opp);
        count++;
      }
      return count;
    });
    return insertMany(opportunities);
  }
}

export default ArbitrageOpportunity;
