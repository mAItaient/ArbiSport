/**
 * Client HTTP pour The Odds API v4.
 * Documentation : https://the-odds-api.com/liveapi/guides/v4/
 */
import axios from 'axios';
import { apiKeyManager } from '../core/apiKeyManager.js';
import { TARGET_BOOKMAKERS } from '../core/sportRegistry.js';
import logger from '../utils/logger.js';

const BASE_URL = 'https://api.the-odds-api.com/v4';
const PROVIDER = 'theOddsApi';

// Bookmakers cibles couverts par The Odds API (10/13 — voir sportRegistry).
// Limite stricte : on n'interroge JAMAIS d'autres bookmakers que ceux validés.
const DEFAULT_BOOKMAKERS = TARGET_BOOKMAKERS
  .map((b) => b.theOddsApi)
  .filter(Boolean);

// Marchés supportés par l'endpoint principal /v4/sports/{sport}/odds.
// Les autres marchés (draw_no_bet, btts, team_totals, alternate_*…) ne sont
// disponibles que via l'endpoint per-event /v4/sports/{sport}/events/{id}/odds.
const CORE_MARKETS = new Set(['h2h', 'spreads', 'totals', 'outrights', 'h2h_lay', 'outrights_lay']);

/**
 * Sépare les marchés en deux catégories selon l'endpoint cible.
 * @param {string|string[]} markets
 * @returns {{core: string[], perEvent: string[]}}
 */
function splitMarkets(markets) {
  const list = Array.isArray(markets)
    ? markets
    : String(markets || '').split(',').map((m) => m.trim()).filter(Boolean);
  const core = [];
  const perEvent = [];
  for (const m of list) {
    if (CORE_MARKETS.has(m)) core.push(m);
    else perEvent.push(m);
  }
  return { core, perEvent };
}

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
  // The Odds API v4 — limitations à gérer :
  //  - on ne peut pas mixer regions ET bookmakers ;
  //  - l'endpoint /sports/{sport}/odds n'accepte que les marchés "core"
  //    (h2h, spreads, totals, outrights). Les autres (draw_no_bet, btts,
  //    team_totals, alternate_*) doivent passer par /events/{id}/odds.
  const { core, perEvent } = splitMarkets(markets);

  // Si aucun marché "core" demandé, on passe directement aux marchés per-event.
  // Sinon, on fait d'abord le scan groupé pour récupérer events + cotes core.
  let events = [];
  const quotes = [];
  const eventIdsCollected = new Set();

  if (core.length > 0) {
    const params = {
      markets: core.join(','),
      oddsFormat,
    };

    if (bookmakers && bookmakers.length > 0) {
      params.bookmakers = Array.isArray(bookmakers) ? bookmakers.join(',') : bookmakers;
    } else {
      // Par défaut on cible nos 10 bookmakers cibles plutôt qu'une région entière.
      params.bookmakers = DEFAULT_BOOKMAKERS.join(',');
    }

    if (commenceTimeFrom) params.commenceTimeFrom = commenceTimeFrom;
    if (commenceTimeTo) params.commenceTimeTo = commenceTimeTo;
    if (eventIds) params.eventIds = Array.isArray(eventIds) ? eventIds.join(',') : eventIds;

    const { data } = await request(`/sports/${sport}/odds`, params);

    for (const item of data) {
      const event = normalizeEvent(item);
      events.push(event);
      eventIdsCollected.add(item.id);
      pushQuotes(item, quotes);
    }
  } else if (eventIds) {
    // Pas de marché core : on doit récupérer la liste d'events séparément.
    const idList = Array.isArray(eventIds) ? eventIds : String(eventIds).split(',');
    for (const id of idList) eventIdsCollected.add(id);
  } else {
    // Aucun event id fourni : on liste les events du sport pour boucler.
    try {
      const list = await listEvents(sport);
      events = list;
      for (const e of list) eventIdsCollected.add(e.id);
    } catch (err) {
      logger.warn(`Impossible de lister les events ${sport} pour marchés per-event : ${err.message}`);
    }
  }

  // Marchés non supportés par l'endpoint principal : on les récupère event par event.
  if (perEvent.length > 0 && eventIdsCollected.size > 0) {
    logger.debug(`Récupération marchés per-event ${perEvent.join(',')} pour ${eventIdsCollected.size} events ${sport}`);
    for (const eventId of eventIdsCollected) {
      try {
        const data = await getEventOdds({
          sport,
          eventId,
          markets: perEvent,
          bookmakers,
          regions,
          oddsFormat,
        });
        pushQuotes(data, quotes);
      } catch (err) {
        // Un event peut ne pas avoir certains marchés : on ignore silencieusement.
        logger.debug(`Marchés per-event ${eventId} indisponibles : ${err.message}`);
      }
    }
  }

  return { events, quotes };
}

/**
 * Endpoint per-event pour les marchés alternatifs (draw_no_bet, btts, etc.).
 */
export async function getEventOdds({
  sport,
  eventId,
  markets,
  bookmakers,
  regions = 'eu',
  oddsFormat = 'decimal',
}) {
  const params = {
    markets: Array.isArray(markets) ? markets.join(',') : markets,
    oddsFormat,
  };
  if (bookmakers && bookmakers.length > 0) {
    params.bookmakers = Array.isArray(bookmakers) ? bookmakers.join(',') : bookmakers;
  } else {
    params.bookmakers = DEFAULT_BOOKMAKERS.join(',');
  }
  const { data } = await request(`/sports/${sport}/events/${eventId}/odds`, params);
  return data;
}

/**
 * Aplatit les cotes d'un objet event renvoyé par The Odds API dans le tableau quotes.
 */
function pushQuotes(item, quotes) {
  if (!item || !item.bookmakers) return;
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

export default { listSports, listEvents, getOdds, getEventOdds, DEFAULT_BOOKMAKERS };
export { DEFAULT_BOOKMAKERS };
