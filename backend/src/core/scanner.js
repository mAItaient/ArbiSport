/**
 * Orchestrateur de scan d'arbitrage.
 *
 * Pour chaque sport interne sélectionné :
 *  - Pour chaque provider configuré, vérifie le mapping (sportRegistry).
 *    Si le sport n'a pas de mapping pour ce provider, on saute SILENCIEUSEMENT
 *    (plus de warning bruyant comme avant).
 *  - Vérifie la disponibilité d'une clé API ; sinon on émet UN seul warn par
 *    provider et on passe au suivant.
 *  - Récupère events + quotes côté provider.
 *
 * Quand deux providers retournent des events distincts pour le même sport :
 *  - eventMatcher fusionne ceux dont score ≥ 0.90 (on agrège les quotes).
 *  - 0.70 ≤ score < 0.90 → stocké dans pending_event_matches (UI Doutes).
 *  - score < 0.70 → traités séparément.
 *
 * Mode 'optimized' : sélectionne les top N combinaisons rentables.
 */
import * as theOddsApi from '../integrations/theOddsApiClient.js';
import * as oddsApiIo from '../integrations/oddsApiIoClient.js';
import { findOpportunities } from './arbitrageEngine.js';
import { hotspots } from './analytics.js';
import { apiKeyManager } from './apiKeyManager.js';
import {
  getSportMapping,
  filterBookmakersForProvider,
  getTwoWayMarkets,
} from './sportRegistry.js';
import { matchEventsBetweenProviders } from './eventMatcher.js';
import ArbitrageOpportunity from '../models/ArbitrageOpportunity.js';
import ScanRun from '../models/ScanRun.js';
import PendingEventMatch from '../models/PendingEventMatch.js';
import ConfirmedAlias from '../models/ConfirmedAlias.js';
import logger from '../utils/logger.js';
import { sleep } from '../utils/rateLimit.js';

/**
 * Exécute un scan complet d'arbitrage.
 */
export async function runFullScan(params) {
  const {
    sports = [],
    bookmakers,           // ids internes UI (betclic, netbet, ...)
    marketKeys = ['h2h', 'totals', 'spreads', 'draw_no_bet', 'btts'],
    stakeTotal = 100,
    filters = {},
    timeWindow = { kind: 'next24' },
    providers = ['theOddsApi', 'oddsApiIo'],
  } = params;

  const runRecord = ScanRun.create({ mode: 'full', params });
  const allOpportunities = [];
  let requestsEstimated = 0;
  const pendingMatchesCreated = [];

  logger.info(
    `Démarrage scan complet : ${sports.length} sports, providers=[${providers.join(', ')}]`
  );

  try {
    const { from: commenceTimeFrom, to: commenceTimeTo } = buildTimeWindow(timeWindow);
    const aliases = loadAliases();

    // Filtrage des providers disponibles (clé présente)
    const activeProviders = providers.filter((p) => {
      try {
        if (!apiKeyManager.getKeyForRequest(p)) {
          logger.warn(`Provider ${p} : aucune clé API configurée, sauté.`);
          return false;
        }
        return true;
      } catch {
        return false;
      }
    });

    for (const sport of sports) {
      // Marchés permis pour ce sport (intersection avec demande utilisateur)
      const allowedMarkets = getTwoWayMarkets(sport);
      const sportMarkets = allowedMarkets.length > 0
        ? marketKeys.filter((m) => allowedMarkets.includes(m))
        : marketKeys;

      if (sportMarkets.length === 0) continue;

      // Récupère events+quotes pour CHAQUE provider qui couvre ce sport
      /** @type {Record<string, {events: Array, quotes: Array}>} */
      const dataByProvider = {};

      for (const provider of activeProviders) {
        const mapping = getSportMapping(sport, provider);
        if (!mapping) {
          // Mapping absent → ce provider ne couvre pas ce sport. SILENCIEUX.
          continue;
        }

        try {
          const bmList = filterBookmakersForProvider(bookmakers, provider);
          const client = getClient(provider);
          if (!client) continue;

          let payload;
          if (provider === 'theOddsApi') {
            payload = await client.getOdds({
              sport: mapping.sportKey,
              markets: sportMarkets.join(','),
              bookmakers: bmList.length > 0 ? bmList : undefined,
              commenceTimeFrom,
              commenceTimeTo,
            });
          } else if (provider === 'oddsApiIo') {
            payload = await client.getOdds({
              sport: mapping.sport,
              leagueSlug: mapping.leagueSlug,
              markets: sportMarkets,
              bookmakers: bmList.length > 0 ? bmList : undefined,
              commenceTimeFrom,
              commenceTimeTo,
            });
          }

          requestsEstimated++;
          if (payload) dataByProvider[provider] = payload;

          await sleep(200);
        } catch (err) {
          if (err.response?.status === 404 || /status code 404/.test(err.message)) {
            logger.debug(`Sport ${sport} indisponible chez ${provider}, ignoré.`);
            continue;
          }
          logger.error(`Erreur scan ${provider}/${sport} : ${err.message}`);
        }
      }

      // Fusion d'événements multi-providers (s'il y a deux providers)
      const providerKeys = Object.keys(dataByProvider);
      if (providerKeys.length === 2) {
        const [pA, pB] = providerKeys;
        const evA = dataByProvider[pA].events;
        const evB = dataByProvider[pB].events;
        const { matched, pending } = matchEventsBetweenProviders(evA, evB, aliases);

        // Pour les matches confirmés : on alias l'event_id de B → event_id de A
        // dans les quotes de B, pour fusionner les cotes sur un même event.
        if (matched.length > 0) {
          const idMap = new Map(matched.map(({ a, b }) => [b.id, a.id]));
          for (const q of dataByProvider[pB].quotes) {
            if (idMap.has(q.event_id)) {
              q.event_id = idMap.get(q.event_id);
            }
          }
        }

        // Pour les pending (0.70–0.90) : on les enregistre pour validation manuelle.
        for (const p of pending) {
          const row = PendingEventMatch.create({
            event_a_id: p.a.id,
            event_a_provider: pA,
            event_a_home: p.a.home_team,
            event_a_away: p.a.away_team,
            event_a_commence: p.a.commence_time,
            event_b_id: p.b.id,
            event_b_provider: pB,
            event_b_home: p.b.home_team,
            event_b_away: p.b.away_team,
            event_b_commence: p.b.commence_time,
            score: p.score,
          });
          if (row) pendingMatchesCreated.push(row);
        }
      }

      // Détection d'arbitrage sur l'agrégation des deux providers
      const allEvents = [];
      const allQuotes = [];
      for (const p of providerKeys) {
        allEvents.push(...dataByProvider[p].events);
        allQuotes.push(...dataByProvider[p].quotes);
      }

      // Note : on passe 'multi' comme provider si plusieurs sources, sinon le nom du provider
      const tag = providerKeys.length > 1 ? 'multi' : (providerKeys[0] || '');
      const opps = findOpportunities(allQuotes, allEvents, stakeTotal, filters, tag);
      allOpportunities.push(...opps);
    }

    if (allOpportunities.length > 0) {
      ArbitrageOpportunity.bulkCreate(allOpportunities);
      logger.info(`${allOpportunities.length} opportunités enregistrées en base.`);
    }

    ScanRun.update(runRecord.id, {
      finished_at: new Date().toISOString(),
      opportunities_found: allOpportunities.length,
      requests_estimated: requestsEstimated,
      status: 'done',
    });

    return {
      runId: runRecord.id,
      opportunitiesFound: allOpportunities.length,
      requestsEstimated,
      opportunities: allOpportunities,
      pendingMatches: pendingMatchesCreated.length,
    };
  } catch (err) {
    ScanRun.update(runRecord.id, {
      finished_at: new Date().toISOString(),
      status: 'error',
      error: err.message,
    });
    throw err;
  }
}

/**
 * Scan optimisé basé sur les hotspots.
 */
export async function runOptimizedScan(params) {
  const {
    topN = 5,
    providers = ['theOddsApi', 'oddsApiIo'],
  } = params;

  const pairHotspots = hotspots({ days: 7, groupBy: 'pair', minOccurrences: 1 });
  const marketHotspots = hotspots({ days: 7, groupBy: 'market', minOccurrences: 1 });

  if (pairHotspots.length === 0 && marketHotspots.length === 0) {
    logger.info('Pas d\'historique pour le scan optimisé, fallback scan complet.');
    return runFullScan({ ...params, mode: 'full' });
  }

  const topPairs = pairHotspots.slice(0, topN);
  const topMarkets = marketHotspots.slice(0, topN);

  // On reformule en appel à runFullScan en restreignant sports/marchés
  const sports = Array.from(new Set(topMarkets.map((m) => m.sport).filter(Boolean)));
  const marketKeys = Array.from(new Set(topMarkets.map((m) => m.market_key).filter(Boolean)));
  const bookmakers = Array.from(new Set(
    topPairs.flatMap((p) => [p.bookmaker_a, p.bookmaker_b]).filter(Boolean)
  ));

  return runFullScan({
    ...params,
    sports,
    marketKeys,
    bookmakers,
    providers,
  });
}

export async function runScan(params) {
  if (params.mode === 'optimized') return runOptimizedScan(params);
  return runFullScan(params);
}

function loadAliases() {
  try {
    const dynamic = ConfirmedAlias.toMap();
    return { ...dynamic };
  } catch {
    return {};
  }
}

function buildTimeWindow(timeWindow) {
  const now = new Date();
  const { kind, hours } = timeWindow;
  switch (kind) {
    case 'live':
      return { from: null, to: toOddsApiIso(new Date(now.getTime() + 2 * 3600000)) };
    case 'next24':
      return { from: toOddsApiIso(now), to: toOddsApiIso(new Date(now.getTime() + 24 * 3600000)) };
    case 'next48':
      return { from: toOddsApiIso(now), to: toOddsApiIso(new Date(now.getTime() + 48 * 3600000)) };
    case 'custom':
      return {
        from: toOddsApiIso(now),
        to: toOddsApiIso(new Date(now.getTime() + (hours || 24) * 3600000)),
      };
    default:
      return { from: null, to: null };
  }
}

function toOddsApiIso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function getClient(provider) {
  const clients = { theOddsApi, oddsApiIo };
  return clients[provider] || null;
}

export default { runScan, runFullScan, runOptimizedScan };
