-- Migration 001: initialisation du schéma SQLite

-- Clés API pour les fournisseurs de cotes
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,              -- 'theOddsApi' | 'oddsApiIo'
  label TEXT NOT NULL,                 -- Nom convivial
  api_key_value TEXT NOT NULL UNIQUE,  -- Valeur de la clé
  plan_info TEXT,                      -- Infos sur le plan (free, paid...)
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'NEAR_LIMIT' | 'LIMITED'
  requests_remaining INTEGER,
  requests_limit INTEGER,
  last_reset_at TEXT,                  -- ISO 8601
  requests_used_total INTEGER DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,  -- 0 | 1 (booléen SQLite)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catalogue des marchés 2-way détectés par provider/sport
CREATE TABLE IF NOT EXISTS two_way_markets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT,
  bookmaker TEXT NOT NULL,
  market_key TEXT NOT NULL,
  outcome_count INTEGER,
  is_two_way INTEGER NOT NULL DEFAULT 0,  -- 0 | 1
  events_tested INTEGER DEFAULT 0,
  two_outcome_rate REAL DEFAULT 0.0,
  last_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, sport, league, bookmaker, market_key)
);

-- Opportunités d'arbitrage détectées
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  provider TEXT,
  sport TEXT,
  league TEXT,
  event_id TEXT,
  event_label TEXT,
  market_key TEXT,
  market_label TEXT,
  outcome_a_label TEXT,
  outcome_b_label TEXT,
  bookmaker_a TEXT,
  bookmaker_b TEXT,
  odds_a REAL,
  odds_b REAL,
  stake_total REAL,
  stake_a REAL,
  stake_b REAL,
  profit_a REAL,
  profit_b REAL,
  gain_min REAL,
  gain_min_pct REAL,
  roi REAL,
  bookmaker_a_url TEXT,
  bookmaker_b_url TEXT,
  status TEXT DEFAULT 'active',
  commence_time TEXT
);

-- Historique des scans
CREATE TABLE IF NOT EXISTS scan_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  mode TEXT NOT NULL,                 -- 'full' | 'optimized'
  params_json TEXT,
  opportunities_found INTEGER DEFAULT 0,
  requests_estimated INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running',      -- 'running' | 'done' | 'error'
  error TEXT
);

-- Configuration applicative clé/valeur JSON
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

-- Index de performance sur les opportunités
CREATE INDEX IF NOT EXISTS idx_opp_timestamp ON arbitrage_opportunities(timestamp);
CREATE INDEX IF NOT EXISTS idx_opp_sport_market ON arbitrage_opportunities(sport, market_key);
CREATE INDEX IF NOT EXISTS idx_opp_bookmakers ON arbitrage_opportunities(bookmaker_a, bookmaker_b);
