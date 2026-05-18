/**
 * Orchestrateur de scan d'arbitrage.
 *
 * Deux modes :
 *   - 'full'      : Scan complet de tous les sports/marchés/bookmakers demandés
 *   - 'optimized' : Utilise les hotspots des 7 derniers jours pour cibler
 *                   les top N combinaisons les plus rentables
 */
import * as theOddsApi from '../integrations/theOddsApiClient.js';
import * as oddsApiIo from '../integrations/oddsApiIoClient.js';
import { findOpportunities } from './arbitrageEngine.js';
import { hotspots } from './analytics.js';
import { apiKeyManager } from './apiKeyManager.js';
import ArbitrageOpportunity from '../models/ArbitrageOpportunity.js';
import ScanRun from '../models/ScanRun.js';
import logger from '../utils/logger.js';
import { sleep } from '../utils/rateLimit.js';

/**
 * Exécute un scan complet d'arbitrage.
 * @param {Object} params - Paramètres du scan
 * @returns {Promise<Object>} Résumé du scan
 */
export async function runFullScan(params) {
  const {
    sports = [],
    leagues,
    bookmakers,
    marketKeys = ['h2h', 'totals', 'spreads'],
    stakeTotal = 100,
    filters = {},
    timeWindow = { kind: 'next24' },
    providers = ['theOddsApi'],
  } = params;

  const runRecord = ScanRun.create({ mode: 'full', params });
  const allOpportunities = [];
  let requestsEstimated = 0;

  logger.info(`Démarrage scan complet: ${sports.length} sports, providers=[${providers.join(', ')}]`);

  try {
    // Calcule les fenêtres temporelles
    const { from: commenceTimeFrom, to: commenceTimeTo } = buildTimeWindow(timeWindow);

    for (const provider of providers) {
      const client = getClient(provider);
      if (!client) {
        logger.warn(`Provider ${provider} inconnu, ignoré`);
        continue;
      }

      // Vérification préalable de clé dispo : évite d'appeler getOdds N fois
      // (une par sport) et de générer N warnings identiques quand l'utilisateur
      // n'a pas configuré ce provider. On vérifie en demandant une clé sans la consommer.
      try {
        const probeKey = apiKeyManager.getKeyForRequest(provider);
        if (!probeKey) {
          logger.warn(`Provider ${provider} : aucune clé API configurée, provider sauté (les autres providers continuent)`);
          continue;
        }
      } catch (err) {
        logger.warn(`Provider ${provider} indisponible : ${err.message}`);
        continue;
      }

      for (const sport of sports) {
        try {
          logger.debug(`Scan ${provider}/${sport}...`);

          const { events, quotes } = await client.getOdds({
            sport,
            markets: marketKeys.join(','),
            bookmakers,
            commenceTimeFrom,
            commenceTimeTo,
          });

          requestsEstimated++;

          const opportunities = findOpportunities(
            quotes, events, stakeTotal, filters, provider
          );

          allOpportunities.push(...opportunities);
          logger.debug(`${provider}/${sport}: ${opportunities.length} opportunités trouvées`);

          // Délai entre requêtes
          await sleep(200);

        } catch (err) {
          if (err.message.includes('Aucune clé API')) {
            // Toutes les clés du provider ont été épuisées en cours de scan.
            logger.warn(`Clés ${provider} épuisées en cours de scan, passage au provider suivant`);
            break;
          }
          // 404 = sport inactif ou inconnu chez ce provider → warn discret
          if (err.response?.status === 404 || /status code 404/.test(err.message)) {
            logger.warn(`Sport ${sport} inactif ou inconnu chez ${provider}, ignoré`);
            continue;
          }
          logger.error(`Erreur scan ${provider}/${sport}: ${err.message}`);
        }
      }
    }

    // Persiste les opportunités en base de données
    if (allOpportunities.length > 0) {
      ArbitrageOpportunity.bulkCreate(allOpportunities);
      logger.info(`${allOpportunities.length} opportunités enregistrées en base`);
    }

    // Met à jour le run
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
 * Exécute un scan optimisé basé sur les hotspots historiques.
 * @param {Object} params - Paramètres avec topN pour le nombre de hotspots à cibler
 * @returns {Promise<Object>} Résumé du scan
 */
export async function runOptimizedScan(params) {
  const {
    topN = 5,
    stakeTotal = 100,
    filters = {},
    timeWindow = { kind: 'next24' },
    providers = ['theOddsApi'],
  } = params;

  const runRecord = ScanRun.create({ mode: 'optimized', params });
  const allOpportunities = [];
  let requestsEstimated = 0;

  logger.info(`Démarrage scan optimisé: topN=${topN}`);

  try {
    // Récupère les hotspots des 7 derniers jours (paires bookmaker)
    const pairHotspots = hotspots({ days: 7, groupBy: 'pair', minOccurrences: 1 });
    const marketHotspots = hotspots({ days: 7, groupBy: 'market', minOccurrences: 1 });

    // Si pas d'historique, fallback sur scan complet basique
    if (pairHotspots.length === 0 && marketHotspots.length === 0) {
      logger.info('Pas d\'historique pour le scan optimisé, utilisation du scan complet basique');
      return runFullScan({ ...params, mode: 'full' });
    }

    const { from: commenceTimeFrom, to: commenceTimeTo } = buildTimeWindow(timeWindow);

    // Sélectionne les top N paires de bookmakers
    const topPairs = pairHotspots.slice(0, topN);
    // Sélectionne les top N marchés/sports
    const topMarkets = marketHotspots.slice(0, topN);

    // Construit des requêtes ciblées par combinaison
    const targetRequests = buildTargetRequests(topPairs, topMarkets, providers);

    for (const req of targetRequests) {
      const client = getClient(req.provider);
      if (!client) continue;

      try {
        const { events, quotes } = await client.getOdds({
          sport: req.sport,
          markets: req.markets,
          bookmakers: req.bookmakers,
          commenceTimeFrom,
          commenceTimeTo,
        });

        requestsEstimated++;

        const opportunities = findOpportunities(
          quotes, events, stakeTotal, filters, req.provider
        );

        allOpportunities.push(...opportunities);
        await sleep(200);

      } catch (err) {
        logger.error(`Erreur scan optimisé ${req.provider}/${req.sport}: ${err.message}`);
      }
    }

    if (allOpportunities.length > 0) {
      ArbitrageOpportunity.bulkCreate(allOpportunities);
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
 * Point d'entrée principal du scanner.
 * @param {Object} params - {mode: 'full'|'optimized', ...autres}
 * @returns {Promise<Object>}
 */
export async function runScan(params) {
  if (params.mode === 'optimized') {
    return runOptimizedScan(params);
  }
  return runFullScan(params);
}

/**
 * Calcule les bornes temporelles selon le type de fenêtre.
 * @param {Object} timeWindow - {kind, hours?}
 * @returns {{from: string|null, to: string|null}}
 */
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
        to: toOddsApiIso(new Date(now.getTime() + (hours || 24) * 3600000))
      };
    default:
      return { from: null, to: null };
  }
}

/**
 * Formate une Date au format ISO 8601 exigé par The Odds API :
 * `YYYY-MM-DDTHH:MM:SSZ` (sans millisecondes).
 * `Date#toISOString()` produit `...sss.SSSZ`, ce qui déclenche une erreur 422.
 * @param {Date} date
 * @returns {string}
 */
function toOddsApiIso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Construit les requêtes ciblées pour le scan optimisé.
 * @param {Array} pairHotspots - Hotspots par paire de bookmakers
 * @param {Array} marketHotspots - Hotspots par marché/sport
 * @param {string[]} providers
 * @returns {Array<Object>} Liste de requêtes ciblées
 */
function buildTargetRequests(pairHotspots, marketHotspots, providers) {
  const requests = [];

  // Pour chaque marché/sport chaud × chaque paire de bookmakers chaude
  for (const mh of marketHotspots) {
    for (const ph of pairHotspots) {
      for (const provider of providers) {
        requests.push({
          provider,
          sport: mh.sport,
          markets: mh.market_key,
          bookmakers: [ph.bookmaker_a, ph.bookmaker_b].filter(Boolean),
        });
      }
    }
  }

  // Supprime les doublons
  return requests.filter((r, i, arr) =>
    arr.findIndex(x =>
      x.provider === r.provider &&
      x.sport === r.sport &&
      x.markets === r.markets &&
      JSON.stringify(x.bookmakers?.sort()) === JSON.stringify(r.bookmakers?.sort())
    ) === i
  );
}

/**
 * Retourne le client API approprié selon le fournisseur.
 * @param {string} provider
 * @returns {Object|null}
 */
function getClient(provider) {
  const clients = { theOddsApi, oddsApiIo };
  return clients[provider] || null;
}

export default { runScan, runFullScan, runOptimizedScan };
