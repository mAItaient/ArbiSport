-- Migration 003 : appariement d'événements entre fournisseurs.

CREATE TABLE IF NOT EXISTS pending_event_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_a_id        TEXT NOT NULL,
  event_a_provider  TEXT NOT NULL,
  event_a_home      TEXT,
  event_a_away      TEXT,
  event_a_commence  TEXT,
  event_b_id        TEXT NOT NULL,
  event_b_provider  TEXT NOT NULL,
  event_b_home      TEXT,
  event_b_away      TEXT,
  event_b_commence  TEXT,
  score             REAL NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | rejected
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at       TEXT,
  UNIQUE(event_a_id, event_a_provider, event_b_id, event_b_provider)
);

CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_event_matches(status);

CREATE TABLE IF NOT EXISTS confirmed_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_canonical   TEXT NOT NULL,
  team_alias       TEXT NOT NULL,
  source_provider  TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_canonical, team_alias)
);

CREATE INDEX IF NOT EXISTS idx_alias_canonical ON confirmed_aliases(team_canonical);
CREATE INDEX IF NOT EXISTS idx_alias_alias     ON confirmed_aliases(team_alias);
