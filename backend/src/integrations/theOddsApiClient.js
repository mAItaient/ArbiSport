/**
 * Client HTTP pour The Odds API v4.
 * Documentation : https://the-odds-api.com/liveapi/guides/v4/
 */
import axios from 'axios';
import { apiKeyManager } from '../core/apiKeyManager.js';
import logger from '../utils/logger.js';

const BASE_URL = 'https://api.the-odds-api.com/v4';
const PROVIDER = 'theOddsApi';

// Bookmakers européens/français disponibles sur The Odds API
const DEFAULT_BOOKMAKERS = [
  'betclic', 'unibet_fr', 'pmu', 'winamax', 'pinnacle',
  'betfair', 'betfair_ex_eu', 'sport888', 'onexbet',
  'betsson', 'nordicbet', 'marathonbet', 'coolbet',
];

async function request(endpoint, params = {}) {
  const key = apiKeyManager.getKeyForRequest(PROVIDER);
  if (!key) {
    throw new Error('Aucune clé API TheOddsAPI disponible. Ajoutez une clé dans Paramètres.');
  }

  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params: { ...params, apiKey: key.api_key_value },
      timeout: 15000,
    });

    apiKeyManager.updateKeyUsage(PROVIDER, key.api_key_value, response.headers);
    return { data: response.data, headers: response.headers };
  } catch (err) {
    if (err.response?.status === 429) {
      apiKeyManager.markLimited(PROVIDER, key.api_key_value, '429 Too Many Requests');
      throw new Error(`Clé TheOddsAPI épuisée (429). Rotation automatique en cours.`);
    }
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error(`Clé TheOddsAPI invalide ou non autorisée.`);
    }
    if (err.response?.status === 422) {
      const detail = err.response?.data?.message || JSON.stringify(err.response?.data) || '';
      throw new Error(`Paramètres invalides pour The Odds API (422): ${detail}`);
    }
    throw err;
  }
}

export async function listSports() {
  const { data } = await request('/sports');
  return data;
}

export async function listEvents(sport) {
  const { data } = await request(`/sports/${sport}/events`);
  return data.map(normalizeEvent);
}

export async function getOdds({
  sport,
  regions = 'eu',
  markets = 'h2h',
  bookmakers,
  commenceTimeFrom,
  commenceTimeTo,
  oddsFormat = 'decimal',
  eventIds,
} = {}) {
  // The Odds API v4: on ne peut pas mixer regions ET bookmakers
  // Si bookmakers est spécifié, on utilise le param bookmakers (sans regions)
  // Sinon on passe regions=eu
  const params = {
    markets,
    oddsFormat,
  };

  if (bookmakers && bookmakers.length > 0) {
    // Mode bookmakers explicites: pas de param regions
    params.bookmakers = Array.isArray(bookmakers) ? bookmakers.join(',') : bookmakers;
  } else {
    // Mode regions: liste les bookmakers européens disponibles
    params.regions = regions;
  }

  if (commenceTimeFrom) params.commenceTimeFrom = commenceTimeFrom;
  if (commenceTimeTo) params.commenceTimeTo = commenceTimeTo;
  if (eventIds) params.eventIds = Array.isArray(eventIds) ? eventIds.join(',') : eventIds;

  const { data } = await request(`/sports/${sport}/odds`, params);

  const events = [];
  const quotes = [];

  for (const item of data) {
    const event = normalizeEvent(item);
    events.push(event);

    if (item.bookmakers) {
      for (const bm of item.bookmakers) {
        for (const market of (bm.markets || [])) {
          for (const outcome of (market.outcomes || [])) {
            quotes.push({
              event_id: item.id,
              bookmaker: bm.key,
              market_key: market.key,
              outcome_label: outcome.name,
              odds: outcome.price,
              point: outcome.point ?? null,
            });
          }
        }
      }
    }
  }

  return { events, quotes };
}

function normalizeEvent(raw) {
  return {
    id: raw.id,
    sport: raw.sport_key,
    league: raw.sport_title,
    label: `${raw.home_team} vs ${raw.away_team}`,
    home_team: raw.home_team,
    away_team: raw.away_team,
    commence_time: raw.commence_time,
    provider: PROVIDER,
    urls: null,
  };
}

export default { listSports, listEvents, getOdds };
