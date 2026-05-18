/**
 * Script de seed — Insère des données de test dans la base de données.
 * Optionnel : utile pour tester l'interface sans clé API réelle.
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = join(__dirname, '..');
const DB_PATH = join(ROOT_DIR, 'data/arbitrage.db');
const MIGRATIONS_DIR = join(ROOT_DIR, 'backend/src/db/migrations');

// Crée le répertoire data/ si nécessaire
if (!existsSync(join(ROOT_DIR, 'data'))) {
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Exécute les migrations
const { readdirSync } = await import('fs');
const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
for (const file of files) {
  db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf-8'));
}

console.log('Seed de données de démonstration...');

// ── Opportunités de démonstration ─────────────────────────────────────────────
const demoOpps = [
  {
    provider: 'theOddsApi',
    sport: 'soccer_epl',
    league: 'Premier League',
    event_id: 'demo_001',
    event_label: 'Arsenal vs Chelsea',
    market_key: 'h2h',
    market_label: 'Victoire/Défaite',
    outcome_a_label: 'Arsenal',
    outcome_b_label: 'Chelsea',
    bookmaker_a: 'pinnacle',
    bookmaker_b: 'betclic',
    odds_a: 2.15,
    odds_b: 2.10,
    stake_total: 100,
    stake_a: 49.40,
    stake_b: 50.60,
    profit_a: 6.21,
    profit_b: 6.26,
    gain_min: 6.21,
    gain_min_pct: 6.21,
    roi: 6.21,
    commence_time: new Date(Date.now() + 7200000).toISOString(),
  },
  {
    provider: 'oddsApiIo',
    sport: 'basketball_nba',
    league: 'NBA',
    event_id: 'demo_002',
    event_label: 'Lakers vs Celtics',
    market_key: 'h2h',
    market_label: 'Victoire/Défaite',
    outcome_a_label: 'Lakers',
    outcome_b_label: 'Celtics',
    bookmaker_a: 'stake',
    bookmaker_b: 'winamax',
    odds_a: 2.20,
    odds_b: 2.05,
    stake_total: 100,
    stake_a: 48.25,
    stake_b: 51.75,
    profit_a: 6.15,
    profit_b: 6.09,
    gain_min: 6.09,
    gain_min_pct: 6.09,
    roi: 6.09,
    commence_time: new Date(Date.now() + 10800000).toISOString(),
  },
];

const insertOpp = db.prepare(
  `INSERT OR IGNORE INTO arbitrage_opportunities (
    provider, sport, league, event_id, event_label,
    market_key, market_label, outcome_a_label, outcome_b_label,
    bookmaker_a, bookmaker_b, odds_a, odds_b,
    stake_total, stake_a, stake_b,
    profit_a, profit_b, gain_min, gain_min_pct, roi,
    commence_time
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const insertMany = db.transaction((opps) => {
  for (const o of opps) {
    insertOpp.run(
      o.provider, o.sport, o.league, o.event_id, o.event_label,
      o.market_key, o.market_label, o.outcome_a_label, o.outcome_b_label,
      o.bookmaker_a, o.bookmaker_b, o.odds_a, o.odds_b,
      o.stake_total, o.stake_a, o.stake_b,
      o.profit_a, o.profit_b, o.gain_min, o.gain_min_pct, o.roi,
      o.commence_time
    );
  }
});

insertMany(demoOpps);

console.log(`✓ ${demoOpps.length} opportunités de démonstration insérées`);
db.close();
