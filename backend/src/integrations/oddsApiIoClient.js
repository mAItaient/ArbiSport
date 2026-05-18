/**
 * Client HTTP pour Odds-API.io v3.
 *
 * Documentation officielle : https://docs.odds-api.io/llms-full.txt
 *
 * Points critiques (vérifiés) :
 *   - Base URL : https://api.odds-api.io/v3
 *   - L'API key passe en QUERY STRING (?apiKey=XXX), pas en header
 *   - Rate limit headers : x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset
 *   - L'endpoint /odds/multi accepte jusqu'à 10 events pour 1 crédit
 *   - Les markets retournent les lignes (hdp) séparées : il faut grouper par hdp
 */
import axios from 'axios';
import { apiKeyManager } from '../core/apiKeyManager.js';
import { canonicalBookmakerId, TARGET_BOOKMAKERS } from '../core/sportRegistry.js';
import logger from '../utils/logger.js';

const BASE_URL = 'https://api.odds-api.io/v3';
const PROVIDER = 'oddsApiIo';

const ENDPOINTS_NO_AUTH = new Set(['/sports', '/bookmakers']);

/**
 * Effectue une requête GET vers Odds-API.io.
 * @param {string} endpoint
 * @param {Object} params
 * @returns {Promise<{data: any, headers: Object}>}
 */
async function request(endpoint, params = {}) {
  const requireAuth = !ENDPOINTS_NO_AUTH.has(endpoint);
  let key = null;

  if (requireAuth) {
    key = apiKeyManager.getKeyForRequest(PROVIDER);
    if (!key) {
      throw new Error('Aucune clé API Odds-API.io disponible. Ajoutez une clé dans Paramètres.');
    }
  }

  const finalParams = { ...params };
  if (requireAuth) finalParams.apiKey = key.api_key_value;

  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: finalParams,
      timeout: 15000,
    });

    if (requireAuth && key) {
      apiKeyManager.updateKeyUsage(PROVIDER, key.api_key_value, response.headers);
    }

    return { data: response.data, headers: response.headers };
  } catch (err) {
    const status = err.response?.status;
    if (status === 429 && key) {
      apiKeyManager.markLimited(PROVIDER, key.api_key_value, '429 Too Many Requests');
      throw new Error(`Clé Odds-API.io épuisée (429). Rotation automatique en cours.`);
    }
    if ((status === 401 || status === 403) && key) {
      throw new Error(`Clé Odds-API.io invalide ou non autorisée (${status}).`);
    }
    throw err;
  }
}

// ─── Endpoints publics (sans authentification) ──────────────────────────────

/**
 * Liste les sports supportés par Odds-API.io.
 * @returns {Promise<Array<Object>>}
 */
export async function getSports() {
  const { data } = await request('/sports');
  return Array.isArray(data) ? data : (data?.data || []);
}

/**
 * Liste les bookmakers supportés par Odds-API.io.
 * @returns {Promise<Array<Object>>}
 */
export async function getBookmakers() {
  const { data } = await request('/bookmakers');
  return Array.isArray(data) ? data : (data?.data || []);
}

// ─── Endpoints authentifiés ─────────────────────────────────────────────────

/**
 * Liste les ligues pour un sport donné.
 * @param {string} sport - ex: 'football', 'tennis'
 * @returns {Promise<Array<Object>>}
 */
export async function getLeagues(sport) {
  const { data } = await request('/leagues', { sport });
  return Array.isArray(data) ? data : (data?.data || data?.leagues || []);
}

/**
 * Récupère les événements selon des filtres.
 *
 * @param {Object} params
 * @param {string} params.sport       - ex: 'football'
 * @param {string} [params.leagueSlug]
 * @param {string} [params.status]    - 'upcoming' | 'live' | 'finished'
 * @param {string} [params.from]      - ISO 8601
 * @param {string} [params.to]        - ISO 8601
 * @param {string} [params.bookmaker]
 * @returns {Promise<Array<Object>>}
 */
export async function getEvents({ sport, leagueSlug, status, from, to, bookmaker } = {}) {
  const params = {};
  if (sport) params.sport = sport;
  if (leagueSlug) params.league = leagueSlug;
  if (status) params.status = status;
  if (from) params.from = from;
  if (to) params.to = to;
  if (bookmaker) params.bookmaker = bookmaker;
  const { data } = await request('/events', params);
  const list = Array.isArray(data) ? data : (data?.data || data?.events || []);
  return list.map(normalizeEvent);
}

/**
 * Récupère les cotes pour un événement.
 * @param {string} eventId
 * @param {string[]} [bookmakers]
 * @returns {Promise<Object>} brut, à transformer par parseOddsResponse
 */
export async function getOddsForEvent(eventId, bookmakers) {
  const params = { eventId };
  if (bookmakers && bookmakers.length > 0) {
    params.bookmakers = Array.isArray(bookmakers) ? bookmakers.join(',') : bookmakers;
  }
  const { data } = await request('/odds', params);
  return data;
}

/**
 * Récupère les cotes pour plusieurs événements en un seul appel (max 10).
 * Économise des crédits : 1 crédit par appel quelque soit le nombre d'events.
 *
 * @param {string[]} eventIds (jusqu'à 10)
 * @param {string[]} [bookmakers]
 * @returns {Promise<Array<Object>>}
 */
export async function getOddsMulti(eventIds, bookmakers) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) return [];
  if (eventIds.length > 10) {
    throw new Error(`getOddsMulti accepte au maximum 10 événements (${eventIds.length} fournis).`);
  }
  const params = { eventIds: eventIds.join(',') };
  if (bookmakers && bookmakers.length > 0) {
    params.bookmakers = Array.isArray(bookmakers) ? bookmakers.join(',') : bookmakers;
  }
  const { data } = await request('/odds/multi', params);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.events)) return data.events;
  return [];
}

/**
 * Récupère les paris d'arbitrage natifs détectés par Odds-API.io.
 *
 * @param {Object} params
 * @param {string[]} [params.bookmakers]
 * @param {number}   [params.limit]
 * @param {boolean}  [params.includeEventDetails]
 * @returns {Promise<Array<Object>>}
 */
export async function getArbitrageBets({ bookmakers, limit = 50, includeEventDetails = true } = {}) {
  const params = { limit, includeEventDetails: includeEventDetails ? 'true' : 'false' };
  if (bookmakers && bookmakers.length > 0) {
    params.bookmakers = Array.isArray(bookmakers) ? bookmakers.join(',') : bookmakers;
  }
  try {
    const { data } = await request('/arbitrage-bets', params);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.bets)) return data.bets;
    return [];
  } catch (err) {
    // Plan gratuit : endpoint inaccessible (403). On dégrade sans crash.
    if (err.response?.status === 403) {
      logger.info('Odds-API.io /arbitrage-bets indisponible (plan gratuit ou non autorisé).');
      return [];
    }
    throw err;
  }
}

// ─── Couche d'agrégation type "getOdds" (compatible scanner) ─────────────────

/**
 * Récupère événements + cotes pour un sport (mapping Odds-API.io).
 *
 * Le scanner appelle ce point d'entrée comme pour The Odds API. On charge
 * d'abord les events puis on demande les cotes par batches de 10 via
 * /odds/multi pour économiser les crédits.
 *
 * @param {Object} opts
 * @param {string} opts.sport         - sport mappé Odds-API.io
 * @param {string} [opts.leagueSlug]
 * @param {string[]|string} [opts.bookmakers]
 * @param {string[]|string} [opts.markets]
 * @param {string} [opts.commenceTimeFrom]
 * @param {string} [opts.commenceTimeTo]
 * @param {number} [opts.limit]
 * @returns {Promise<{events: Array<Object>, quotes: Array<Object>}>}
 */
export async function getOdds({
  sport,
  leagueSlug,
  bookmakers,
  markets,
  commenceTimeFrom,
  commenceTimeTo,
  limit = 50,
} = {}) {
  if (!sport) {
    throw new Error('Paramètre sport requis pour Odds-API.io getOdds');
  }

  // Étape 1 : liste les événements à venir
  const events = await getEvents({
    sport,
    leagueSlug,
    status: 'upcoming',
    from: commenceTimeFrom,
    to: commenceTimeTo,
  });

  if (events.length === 0) return { events: [], quotes: [] };

  // Étape 2 : récupère les cotes par batches de 10 (économise crédits)
  const limited = events.slice(0, Math.max(1, limit));
  const eventIds = limited.map((e) => e.id);
  const bmList = normalizeBookmakerList(bookmakers);

  const allRawEvents = [];
  for (let i = 0; i < eventIds.length; i += 10) {
    const batch = eventIds.slice(i, i + 10);
    try {
      const batchData = await getOddsMulti(batch, bmList);
      allRawEvents.push(...batchData);
    } catch (err) {
      logger.warn(`Odds-API.io getOddsMulti batch ${i / 10 + 1} échec : ${err.message}`);
    }
  }

  const wantedMarkets = normalizeMarketsList(markets);
  const quotes = [];

  for (const raw of allRawEvents) {
    const evId = raw.id || raw.eventId || raw.event_id;
    parseOddsResponse(raw, evId, wantedMarkets, quotes);
  }

  // Enrichit les events normalisés avec slug/urls éventuels venus des odds
  return { events: limited, quotes };
}

/**
 * Parse la réponse Odds-API.io pour un événement et alimente le tableau quotes.
 *
 * Format attendu (vérifié sur la doc) :
 *   {
 *     id, sport, league, home, away, commenceTime, ...,
 *     bookmakers: [
 *       { id: 'Pinnacle', markets: {
 *           'ML':            { home: '1.91', away: '2.10' },
 *           'Totals':        [{ point: 2.5, over: '1.95', under: '1.87' }, ...],
 *           'Asian Handicap':[{ hdp: -1.5, home: '1.91', away: '2.10' }, ...],
 *           'Spread':        [{ point: -1.5, home: '1.91', away: '2.10' }, ...]
 *         }
 *       }
 *     ]
 *   }
 *
 * @param {Object} raw
 * @param {string} eventId
 * @param {Set<string>} wantedMarkets - marchés internes voulus (h2h, totals, spreads, btts, draw_no_bet)
 * @param {Array<Object>} quotes - alimenté en sortie
 */
export function parseOddsResponse(raw, eventId, wantedMarkets, quotes) {
  if (!raw || !raw.bookmakers) return;

  for (const bm of raw.bookmakers) {
    const bmKey = bm.id || bm.name || bm.key;
    const canonical = canonicalBookmakerId(bmKey) || bmKey;

    const markets = bm.markets || {};
    // Cas Array (rarement renvoyé par cet endpoint mais on tolère)
    if (Array.isArray(markets)) {
      for (const m of markets) parseMarketObject(canonical, m.key || m.name, m, eventId, wantedMarkets, quotes);
      continue;
    }

    for (const [marketName, marketData] of Object.entries(markets)) {
      parseMarketObject(canonical, marketName, marketData, eventId, wantedMarkets, quotes);
    }
  }
}

/**
 * Parse un marché Odds-API.io individuel.
 * marketName ∈ {'ML', 'Totals', 'Asian Handicap', 'Spread', 'Both Teams to Score', ...}
 */
function parseMarketObject(bookmaker, marketName, marketData, eventId, wantedMarkets, quotes) {
  if (!marketName || marketData == null) return;
  const internalKey = mapMarketNameToInternal(marketName);
  if (!internalKey) return;
  if (wantedMarkets && wantedMarkets.size > 0 && !wantedMarkets.has(internalKey)) return;

  const push = (label, odds, point) => {
    const n = parseFloat(odds);
    if (!isFinite(n) || n <= 1.0) return;
    quotes.push({
      event_id: eventId,
      bookmaker,
      market_key: internalKey,
      outcome_label: label,
      odds: n,
      point: point ?? null,
    });
  };

  // ML (Moneyline) → 2 issues home/away (ou draw pour foot, on l'écarte)
  if (internalKey === 'h2h') {
    if (Array.isArray(marketData)) {
      // forme rare : [{home, away}]
      for (const m of marketData) {
        push('home', m.home);
        push('away', m.away);
      }
    } else if (typeof marketData === 'object') {
      if (marketData.draw != null) {
        // Marché 3-way (1X2 football) — on l'ignore intégralement pour h2h
        return;
      }
      push('home', marketData.home);
      push('away', marketData.away);
    }
    return;
  }

  // BTTS → yes/no
  if (internalKey === 'btts') {
    if (Array.isArray(marketData)) {
      for (const m of marketData) {
        push('yes', m.yes);
        push('no', m.no);
      }
    } else if (typeof marketData === 'object') {
      push('yes', marketData.yes);
      push('no', marketData.no);
    }
    return;
  }

  // Draw No Bet → home/away (nul remboursé)
  if (internalKey === 'draw_no_bet') {
    if (Array.isArray(marketData)) {
      for (const m of marketData) {
        push('home', m.home);
        push('away', m.away);
      }
    } else if (typeof marketData === 'object') {
      push('home', marketData.home);
      push('away', marketData.away);
    }
    return;
  }

  // Totals → liste de {point, over, under}
  if (internalKey === 'totals') {
    const items = Array.isArray(marketData) ? marketData : [marketData];
    for (const m of items) {
      const point = m.point ?? m.line ?? m.total;
      if (point == null) continue;
      push('over',  m.over,  point);
      push('under', m.under, point);
    }
    return;
  }

  // Spreads / Asian Handicap → liste de {hdp|point, home, away}
  if (internalKey === 'spreads') {
    const items = Array.isArray(marketData) ? marketData : [marketData];
    for (const m of items) {
      // home côté hdp (-1.5 par ex), away côté +1.5
      const hdpHome = m.hdp ?? m.point ?? m.handicap;
      if (hdpHome == null) continue;
      const hdpAway = -Number(hdpHome);
      push('home', m.home, Number(hdpHome));
      push('away', m.away, hdpAway);
    }
    return;
  }
}

/**
 * Mapping interne ↔ Odds-API.io.
 *  - 'ML'                   → h2h
 *  - 'Moneyline'            → h2h
 *  - 'Totals' / 'Total'     → totals
 *  - 'Spread' / 'Asian Handicap' / 'Handicap' → spreads
 *  - 'Both Teams to Score'  → btts
 *  - 'Draw No Bet'          → draw_no_bet
 */
export function mapMarketNameToInternal(name) {
  if (!name) return null;
  const lc = String(name).toLowerCase().trim();
  if (lc === 'ml' || lc === 'moneyline' || lc === 'money line' || lc === 'h2h') return 'h2h';
  if (lc === 'totals' || lc === 'total' || lc === 'over/under') return 'totals';
  if (lc === 'spread' || lc === 'spreads' || lc.includes('handicap')) return 'spreads';
  if (lc === 'btts' || lc === 'both teams to score' || lc === 'both teams') return 'btts';
  if (lc === 'draw no bet' || lc === 'dnb') return 'draw_no_bet';
  return null;
}

function normalizeBookmakerList(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  return String(input).split(',').map((s) => s.trim()).filter(Boolean);
}

function normalizeMarketsList(input) {
  if (!input) return new Set();
  const list = Array.isArray(input) ? input : String(input).split(',');
  return new Set(list.map((s) => String(s).trim()).filter(Boolean));
}

/**
 * Normalise un événement brut Odds-API.io vers le format interne.
 */
export function normalizeEvent(raw) {
  if (!raw) return null;
  return {
    id: raw.id || raw.eventId || raw.event_id,
    sport: raw.sport || null,
    league: raw.league || raw.leagueName || null,
    label: `${raw.home || raw.homeTeam || ''} vs ${raw.away || raw.awayTeam || ''}`.trim(),
    home_team: raw.home || raw.homeTeam || null,
    away_team: raw.away || raw.awayTeam || null,
    commence_time: raw.commenceTime || raw.startTime || raw.start || null,
    provider: PROVIDER,
    externalId: raw.externalId || raw.id || null,
    slug: raw.slug || null,
    urls: raw.urls || null,
  };
}

/**
 * Alias historique pour compatibilité scanner.
 */
export const listSports = getSports;
export const listEvents = async ({ sport, leagueSlug } = {}) =>
  getEvents({ sport, leagueSlug, status: 'upcoming' });

export default {
  getSports,
  getBookmakers,
  getLeagues,
  getEvents,
  getOddsForEvent,
  getOddsMulti,
  getArbitrageBets,
  getOdds,
  parseOddsResponse,
  mapMarketNameToInternal,
  normalizeEvent,
  listSports,
  listEvents,
  TARGET_BOOKMAKERS,
};
