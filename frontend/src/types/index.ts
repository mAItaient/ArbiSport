// ─── Types de l'application ArbiSport ─────────────────────────────────────────

export interface ApiKey {
  id: number
  provider: 'theOddsApi' | 'oddsApiIo'
  label: string
  api_key_value: string
  plan_info?: string
  status: 'ACTIVE' | 'NEAR_LIMIT' | 'LIMITED'
  requests_remaining?: number
  requests_limit?: number
  last_reset_at?: string
  requests_used_total: number
  quota_limit?: number
  quota_period?: 'hourly' | 'daily' | 'monthly'
  enabled: number
  created_at: string
  updated_at: string
}

export interface ArbitrageOpportunity {
  id: number
  timestamp: string
  provider?: string
  sport?: string
  league?: string
  event_id?: string
  event_label?: string
  market_key?: string
  market_label?: string
  outcome_a_label?: string
  outcome_b_label?: string
  bookmaker_a?: string
  bookmaker_b?: string
  odds_a?: number
  odds_b?: number
  stake_total?: number
  stake_a?: number
  stake_b?: number
  profit_a?: number
  profit_b?: number
  gain_min?: number
  gain_min_pct?: number
  roi?: number
  bookmaker_a_url?: string | null
  bookmaker_b_url?: string | null
  status?: string
  commence_time?: string
}

export interface TwoWayMarket {
  id: number
  provider: string
  sport: string
  league?: string
  bookmaker: string
  market_key: string
  outcome_count?: number
  is_two_way: number
  events_tested?: number
  two_outcome_rate?: number
  last_checked_at: string
}

export interface Hotspot {
  bookmaker_a?: string
  bookmaker_b?: string
  market_key?: string
  sport?: string
  occurrences: number
  avg_roi: number
  max_roi: number
  avg_gain_min: number
  first_seen: string
  last_seen: string
}

export interface ScanParams {
  mode: 'full' | 'optimized'
  providers?: string[]
  timeWindow?: {
    kind: 'live' | 'next24' | 'next48' | 'custom'
    hours?: number
  }
  sports: string[]
  leagues?: string[]
  bookmakers?: string[]
  marketKeys?: string[]
  stakeTotal?: number
  filters?: {
    minRoiPct?: number
    minGuaranteedPct?: number
    minProfitAbs?: number
    minMinutesBeforeStart?: number
  }
  topN?: number
}

export interface ScanResult {
  ok: boolean
  runId: number
  opportunitiesFound: number
  requestsEstimated: number
  opportunities: ArbitrageOpportunity[]
}

export interface PaginatedOpportunities {
  items: ArbitrageOpportunity[]
  total: number
  limit: number
  offset: number
}

export interface AppConfig {
  [key: string]: unknown
}

export interface HealthStatus {
  status: string
  version: string
  uptime: number
  dbOk: boolean
}

export interface PendingMatch {
  id: number
  event_a_id: string
  event_a_provider: string
  event_a_home?: string
  event_a_away?: string
  event_a_commence?: string
  event_b_id: string
  event_b_provider: string
  event_b_home?: string
  event_b_away?: string
  event_b_commence?: string
  score: number
  status: 'pending' | 'confirmed' | 'rejected'
  created_at: string
  resolved_at?: string
}

export interface ConfirmedAlias {
  id: number
  team_canonical: string
  team_alias: string
  source_provider?: string
  created_at: string
}

export interface StakeCalculation {
  stakeA: number
  stakeB: number
  profitA: number
  profitB: number
  gainMin: number
  gainMinPct: number
  roi: number
}
