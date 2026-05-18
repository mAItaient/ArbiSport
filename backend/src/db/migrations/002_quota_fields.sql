-- Migration 002: champs quota structurés sur api_keys
ALTER TABLE api_keys ADD COLUMN quota_limit INTEGER;
ALTER TABLE api_keys ADD COLUMN quota_period TEXT DEFAULT 'monthly'; -- 'hourly' | 'daily' | 'monthly'
