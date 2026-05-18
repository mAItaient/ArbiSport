/**
 * Client HTTP pour The Odds API v4.
 * Documentation : https://the-odds-api.com/liveapi/guides/v4/
 *
 * Normalise les réponses en objets Event et BookmakerQuote standard.
 */
import axios from 'axios';
import { apiKeyManager } from '../core/apiKeyManager.js';
import logger from '../utils/logger.js';

const BASE_URL = 'https://api.the-odds-api.com/v4';
const PROVIDER = 'theOddsApi';

/**
 * Effectue une requête GET vers The Odds API avec gestion automatique des clés.
 * @param {string} endpoint - Chemin de l'endpoint (ex: '/sports')
 * @param {Object} params   - Paramètres de query string
 * @returns {Promise<{data: any, headers: Object}>}
 */
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

    // Met à jour les quotas depuis les headers
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
    throw err;
  }
}

/**
 * Liste les sports disponibles.
 * @returns {Promise<Array<Object>>} Liste des sports
 */
export async function listSports() {
  const { data } = await request('/sports');
  return data;
}

/**
 * Liste les événements pour un sport.
 * @param {string} sport - Clé du sport (ex: 'soccer_epl')
 * @returns {Promise<Array<Object>>} Liste des événements normalisés
 */
export async function listEvents(sport) {
  const { data } = await request(`/sports/${sport}/events`);
  return data.map(normalizeEvent);
}

/**
 * Récupère les cotes pour un sport avec filtres.
 * @param {Object} params - Paramètres de requête
 * @returns {Promise<{events: Array<Object>, quotes: Array<Object>}>}
 */
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
  const params = {
    regions,
    markets,
    oddsFormat,
  };

  if (bookmakers) params.bookmakers = Array.isArray(bookmakers) ? bookmakers.join(',') : bookmakers;
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

/**
 * Normalise un événement brut de l'API vers le format interne.
 * @param {Object} raw - Données brutes de l'API
 * @returns {Object} Événement normalisé
 */
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
    urls: null, // TheOddsAPI ne fournit pas d'URLs deep-link
  };
}

export default { listSports, listEvents, getOdds };
