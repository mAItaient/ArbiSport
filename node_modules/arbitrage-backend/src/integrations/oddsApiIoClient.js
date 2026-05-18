/**
 * Client HTTP pour Odds-API.io v3.
 * Documentation : https://odds-api.io/docs
 *
 * Normalise les réponses en objets Event et BookmakerQuote standard.
 * Capture les URLs deep-link fournis par l'API.
 */
import axios from 'axios';
import { apiKeyManager } from '../core/apiKeyManager.js';
import logger from '../utils/logger.js';

const BASE_URL = 'https://api2.odds-api.io/v3';
const PROVIDER = 'oddsApiIo';

/**
 * Effectue une requête GET vers Odds-API.io avec gestion automatique des clés.
 * @param {string} endpoint - Chemin de l'endpoint
 * @param {Object} params   - Paramètres de query string
 * @returns {Promise<{data: any, headers: Object}>}
 */
async function request(endpoint, params = {}) {
  const key = apiKeyManager.getKeyForRequest(PROVIDER);
  if (!key) {
    throw new Error('Aucune clé API Odds-API.io disponible. Ajoutez une clé dans Paramètres.');
  }

  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      params,
      headers: { 'x-api-key': key.api_key_value },
      timeout: 15000,
    });

    // Met à jour les quotas depuis les headers
    apiKeyManager.updateKeyUsage(PROVIDER, key.api_key_value, response.headers);

    return { data: response.data, headers: response.headers };
  } catch (err) {
    if (err.response?.status === 429) {
      apiKeyManager.markLimited(PROVIDER, key.api_key_value, '429 Too Many Requests');
      throw new Error(`Clé Odds-API.io épuisée (429). Rotation automatique en cours.`);
    }
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error(`Clé Odds-API.io invalide ou non autorisée.`);
    }
    throw err;
  }
}

/**
 * Liste les sports disponibles.
 * @returns {Promise<Array<Object>>}
 */
export async function listSports() {
  const { data } = await request('/sports');
  return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
}

/**
 * Liste les événements pour un sport avec limite optionnelle.
 * @param {Object} params - {sport, limit?}
 * @returns {Promise<Array<Object>>} Événements normalisés
 */
export async function listEvents({ sport, limit = 50 } = {}) {
  const { data } = await request(`/sports/${sport}/events`, { limit });
  const raw = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  return raw.map(normalizeEvent);
}

/**
 * Récupère les cotes pour un événement spécifique.
 * @param {Object} params - {eventId, bookmakers?}
 * @returns {Promise<{events: Array<Object>, quotes: Array<Object>}>}
 */
export async function getOddsForEvent({ eventId, bookmakers } = {}) {
  const params = {};
  if (bookmakers) {
    params.bookmakers = Array.isArray(bookmakers) ? bookmakers.join(',') : bookmakers;
  }

  const { data } = await request(`/events/${eventId}/odds`, params);
  const raw = data?.data || data;

  const events = [];
  const quotes = [];

  if (raw && raw.id) {
    const event = normalizeEvent(raw);
    events.push(event);

    for (const bm of (raw.bookmakers || [])) {
      for (const market of (bm.markets || [])) {
        for (const outcome of (market.outcomes || [])) {
          quotes.push({
            event_id: raw.id,
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

  return { events, quotes };
}

/**
 * Récupère les cotes pour un sport avec filtres (équivalent TheOddsAPI).
 * Appelle les cotes de chaque événement séparément si nécessaire.
 * @param {Object} params - {sport, bookmakers?, markets?, commenceTimeFrom?, commenceTimeTo?}
 * @returns {Promise<{events: Array<Object>, quotes: Array<Object>}>}
 */
export async function getOdds({
  sport,
  bookmakers,
  markets,
  commenceTimeFrom,
  commenceTimeTo,
  limit = 20,
} = {}) {
  const params = { limit };
  if (bookmakers) params.bookmakers = Array.isArray(bookmakers) ? bookmakers.join(',') : bookmakers;
  if (markets) params.markets = Array.isArray(markets) ? markets.join(',') : markets;
  if (commenceTimeFrom) params.commence_time_from = commenceTimeFrom;
  if (commenceTimeTo) params.commence_time_to = commenceTimeTo;

  const { data } = await request(`/sports/${sport}/odds`, params);
  const rawList = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);

  const events = [];
  const quotes = [];

  for (const raw of rawList) {
    const event = normalizeEvent(raw);
    events.push(event);

    for (const bm of (raw.bookmakers || [])) {
      for (const market of (bm.markets || [])) {
        for (const outcome of (market.outcomes || [])) {
          quotes.push({
            event_id: raw.id,
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

  return { events, quotes };
}

/**
 * Normalise un événement brut de Odds-API.io vers le format interne.
 * @param {Object} raw - Données brutes de l'API
 * @returns {Object} Événement normalisé
 */
function normalizeEvent(raw) {
  return {
    id: raw.id,
    sport: raw.sport_key || raw.sport,
    league: raw.sport_title || raw.league,
    label: raw.name || `${raw.home_team || ''} vs ${raw.away_team || ''}`,
    home_team: raw.home_team,
    away_team: raw.away_team,
    commence_time: raw.commence_time,
    provider: PROVIDER,
    externalId: raw.external_id || raw.id,  // Pour deep-links Stake
    slug: raw.slug || null,
    urls: raw.urls || null,  // URLs deep-link fournis par Odds-API.io
  };
}

export default { listSports, listEvents, getOdds, getOddsForEvent };
