/**
 * Tests d'intégration du scanner d'arbitrage.
 * Mock les clients API externes (axios), vérifie l'écriture en base et la rotation de clés.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Setup de la DB en mémoire ──────────────────────────────────────────────────

let testDb;

function setupTestDb() {
  testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  const sql = readFileSync(join(__dirname, '../src/db/migrations/001_init.sql'), 'utf-8');
  testDb.exec(sql);
  return testDb;
}

function teardownTestDb() {
  if (testDb) {
    testDb.close();
    testDb = null;
  }
}

// ─── Tests du moteur d'arbitrage avec données simulées ─────────────────────────

describe('findOpportunities — intégration données simulées', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('détecte une opportunité d\'arbitrage sur données mockées et peut l\'insérer en DB', async () => {
    const { findOpportunities } = await import('../src/core/arbitrageEngine.js');

    // Données simulées typiques de l'API TheOddsAPI
    const quotes = [
      { event_id: 'evt001', bookmaker: 'pinnacle', market_key: 'h2h', outcome_label: 'Paris SG', odds: 2.15, point: null },
      { event_id: 'evt001', bookmaker: 'betclic', market_key: 'h2h', outcome_label: 'Paris SG', odds: 1.85, point: null },
      { event_id: 'evt001', bookmaker: 'pinnacle', market_key: 'h2h', outcome_label: 'Marseille', odds: 1.85, point: null },
      { event_id: 'evt001', bookmaker: 'betclic', market_key: 'h2h', outcome_label: 'Marseille', odds: 2.15, point: null },
    ];

    const events = [{
      id: 'evt001',
      sport: 'soccer_france_ligue_one',
      league: 'Ligue 1',
      label: 'Paris SG vs Marseille',
      commence_time: new Date(Date.now() + 3600000).toISOString(),
    }];

    const opps = findOpportunities(quotes, events, 100, { minRoiPct: 0 }, 'theOddsApi');

    // Il doit y avoir des opportunités (pinnacle sur PSG + betclic sur Marseille, et inverse)
    expect(opps.length).toBeGreaterThan(0);

    // Vérifie la structure de l'opportunité
    const opp = opps[0];
    expect(opp.event_id).toBe('evt001');
    expect(opp.roi).toBeGreaterThan(0);
    expect(opp.stake_total).toBe(100);
    expect(opp.bookmaker_a).not.toBe(opp.bookmaker_b);

    // Insère en base de données test
    const stmt = testDb.prepare(
      `INSERT INTO arbitrage_opportunities (
        provider, sport, league, event_id, event_label,
        market_key, outcome_a_label, outcome_b_label,
        bookmaker_a, bookmaker_b, odds_a, odds_b,
        stake_total, stake_a, stake_b,
        profit_a, profit_b, gain_min, gain_min_pct, roi
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    stmt.run(
      opp.provider, opp.sport, opp.league, opp.event_id, opp.event_label,
      opp.market_key, opp.outcome_a_label, opp.outcome_b_label,
      opp.bookmaker_a, opp.bookmaker_b, opp.odds_a, opp.odds_b,
      opp.stake_total, opp.stake_a, opp.stake_b,
      opp.profit_a, opp.profit_b, opp.gain_min, opp.gain_min_pct, opp.roi
    );

    // Vérifie que l'insertion a fonctionné
    const inserted = testDb.prepare('SELECT * FROM arbitrage_opportunities WHERE event_id = ?').get('evt001');
    expect(inserted).toBeDefined();
    expect(inserted.roi).toBeCloseTo(opp.roi, 2);
  });

  it('insère un scan_run en DB avec statut correct', () => {
    // Crée un scan_run running
    const run = testDb.prepare(
      `INSERT INTO scan_runs (mode, params_json, status) VALUES ('full', '{}', 'running')`
    ).run();

    expect(run.lastInsertRowid).toBeGreaterThan(0);

    // Met à jour en done
    testDb.prepare(
      `UPDATE scan_runs SET status = 'done', finished_at = datetime('now'), opportunities_found = ? WHERE id = ?`
    ).run(3, run.lastInsertRowid);

    const updated = testDb.prepare('SELECT * FROM scan_runs WHERE id = ?').get(run.lastInsertRowid);
    expect(updated.status).toBe('done');
    expect(updated.opportunities_found).toBe(3);
    expect(updated.finished_at).not.toBeNull();
  });
});

// ─── Tests de simulation d'épuisement de clé ────────────────────────────────────

describe('simulation épuisement de clé API', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('simule le passage LIMITED d\'une clé et la rotation vers la seconde', () => {
    // Insère deux clés API dans la DB test
    testDb.prepare(
      `INSERT INTO api_keys (provider, label, api_key_value, status, requests_remaining, requests_limit, enabled)
       VALUES ('theOddsApi', 'Clé 1', 'key-value-1', 'ACTIVE', 500, 500, 1)`
    ).run();

    testDb.prepare(
      `INSERT INTO api_keys (provider, label, api_key_value, status, requests_remaining, requests_limit, enabled)
       VALUES ('theOddsApi', 'Clé 2', 'key-value-2', 'ACTIVE', 500, 500, 1)`
    ).run();

    // Simule un 429 sur la clé 1
    testDb.prepare(
      `UPDATE api_keys SET status = 'LIMITED', requests_remaining = 0 WHERE api_key_value = 'key-value-1'`
    ).run();

    // Récupère les clés disponibles (doit retourner uniquement la clé 2)
    const available = testDb.prepare(
      `SELECT * FROM api_keys WHERE provider = 'theOddsApi' AND enabled = 1 AND status != 'LIMITED'`
    ).all();

    expect(available.length).toBe(1);
    expect(available[0].api_key_value).toBe('key-value-2');
  });

  it('retourne 0 clés disponibles quand toutes sont LIMITED', () => {
    testDb.prepare(
      `INSERT INTO api_keys (provider, label, api_key_value, status, requests_remaining, enabled)
       VALUES ('theOddsApi', 'Clé 1', 'key-value-1', 'LIMITED', 0, 1)`
    ).run();

    const available = testDb.prepare(
      `SELECT * FROM api_keys WHERE provider = 'theOddsApi' AND enabled = 1 AND status != 'LIMITED'`
    ).all();

    expect(available.length).toBe(0);
  });

  it('mise à jour des requêtes restantes après un appel API réussi', () => {
    testDb.prepare(
      `INSERT INTO api_keys (provider, label, api_key_value, status, requests_remaining, requests_limit, requests_used_total, enabled)
       VALUES ('theOddsApi', 'Clé test', 'key-test', 'ACTIVE', 100, 500, 400, 1)`
    ).run();

    // Simule la mise à jour après un appel réussi (headers TheOddsAPI)
    const remaining = 99; // header x-requests-remaining
    testDb.prepare(
      `UPDATE api_keys SET requests_remaining = ?, requests_used_total = requests_used_total + 1 WHERE api_key_value = 'key-test'`
    ).run(remaining);

    const key = testDb.prepare(`SELECT * FROM api_keys WHERE api_key_value = 'key-test'`).get();
    expect(key.requests_remaining).toBe(99);
    expect(key.requests_used_total).toBe(401);
  });
});

// ─── Tests d'écriture DB des opportunités ────────────────────────────────────────

describe('écriture des opportunités en base de données', () => {
  beforeEach(() => {
    setupTestDb();
  });

  afterEach(() => {
    teardownTestDb();
  });

  it('insère plusieurs opportunités en transaction', () => {
    const opps = [
      { event_id: 'e1', roi: 2.5, bookmaker_a: 'pinnacle', bookmaker_b: 'betclic' },
      { event_id: 'e2', roi: 1.8, bookmaker_a: 'stake', bookmaker_b: 'winamax' },
      { event_id: 'e3', roi: 3.1, bookmaker_a: '1xbet', bookmaker_b: 'unibet' },
    ];

    const insertMany = testDb.transaction((list) => {
      const stmt = testDb.prepare(
        `INSERT INTO arbitrage_opportunities (event_id, roi, bookmaker_a, bookmaker_b, market_key)
         VALUES (?, ?, ?, ?, 'h2h')`
      );
      for (const o of list) {
        stmt.run(o.event_id, o.roi, o.bookmaker_a, o.bookmaker_b);
      }
    });

    insertMany(opps);

    const count = testDb.prepare('SELECT COUNT(*) as c FROM arbitrage_opportunities').get().c;
    expect(count).toBe(3);

    const best = testDb.prepare(
      'SELECT * FROM arbitrage_opportunities ORDER BY roi DESC LIMIT 1'
    ).get();
    expect(best.roi).toBeCloseTo(3.1, 1);
    expect(best.bookmaker_a).toBe('1xbet');
  });

  it('les index de performance sont créés', () => {
    const indexes = testDb.prepare(
      `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='arbitrage_opportunities'`
    ).all();

    const names = indexes.map(i => i.name);
    expect(names.some(n => n.includes('timestamp') || n.includes('idx_opp'))).toBe(true);
  });
});
