/**
 * Catalogue des marchés 2-way détectés automatiquement.
 *
 * Phase d'initialisation :
 *   Pour chaque combinaison provider+sport, fetch un échantillon (~20 événements).
 *   Pour chaque (provider, sport, league, bookmaker, market_key), compte les outcomes.
 *   Si TOUS les événements ont exactement 2 outcomes → is_two_way = true.
 *   Résultat persisté dans two_way_markets pour utilisation par le scanner.
 */
import TwoWayMarket from '../models/TwoWayMarket.js';
import * as theOddsApi from '../integrations/theOddsApiClient.js';
import * as oddsApiIo from '../integrations/oddsApiIoClient.js';
import logger from '../utils/logger.js';
import { sleep } from '../utils/rateLimit.js';

/**
 * Lance l'initialisation du catalogue de marchés 2-way.
 * @param {Object} params - {providers: string[], sports: string[]}
 * @returns {Promise<Object>} Résumé {processed, twoWayFound}
 */
export async function initTwoWayMarkets({ providers = [], sports = [] } = {}) {
  logger.info(`Initialisation marchés 2-way: ${providers.join(', ')} × ${sports.length} sports`);

  let processed = 0;
  let twoWayFound = 0;

  // Marchés standards à tester
  const MARKET_KEYS = ['h2h', 'totals', 'spreads', 'draw_no_bet'];

  for (const provider of providers) {
    const client = getClient(provider);
    if (!client) {
      logger.warn(`Fournisseur inconnu : ${provider}`);
      continue;
    }

    for (const sport of sports) {
      try {
        logger.info(`Scan 2-way: ${provider} / ${sport}`);

        // Récupère un échantillon d'événements avec cotes (multi-marchés)
        const { events, quotes } = await client.getOdds({
          sport,
          markets: MARKET_KEYS.join(','),
          limit: 20,
        });

        if (!events || events.length === 0) {
          logger.debug(`Pas d'événements pour ${provider}/${sport}`);
          continue;
        }

        // Collecte les stats par (provider, sport, league, bookmaker, market_key)
        const stats = new Map();

        for (const quote of quotes) {
          const event = events.find(e => e.id === quote.event_id);
          const league = event?.league || '';
          const key = `${provider}|${sport}|${league}|${quote.bookmaker}|${quote.market_key}`;

          if (!stats.has(key)) {
            stats.set(key, {
              provider, sport, league,
              bookmaker: quote.bookmaker,
              market_key: quote.market_key,
              eventOutcomes: new Map(), // eventId → Set<outcome_label>
            });
          }

          const stat = stats.get(key);
          if (!stat.eventOutcomes.has(quote.event_id)) {
            stat.eventOutcomes.set(quote.event_id, new Set());
          }
          // Pour les totals/spreads, distingue par point
          const labelWithPoint = quote.point != null
            ? `${quote.outcome_label}_${quote.point}`
            : quote.outcome_label;
          stat.eventOutcomes.get(quote.event_id).add(labelWithPoint);
        }

        // Calcule is_two_way et persiste
        for (const [, stat] of stats) {
          const eventCount = stat.eventOutcomes.size;
          if (eventCount === 0) continue;

          let twoOutcomeEvents = 0;
          let totalOutcomeCount = 0;

          for (const [, outcomesSet] of stat.eventOutcomes) {
            const count = outcomesSet.size;
            totalOutcomeCount += count;
            // Pour les totals/spreads : compter par paire (over/under sur la même ligne)
            // Simplifié : on considère qu'un marché est 2-way si le nombre d'outcomes est 2
            if (count === 2) twoOutcomeEvents++;
          }

          const twoOutcomeRate = twoOutcomeEvents / eventCount;
          const isTwoWay = twoOutcomeRate === 1.0; // Tous les événements ont exactement 2 outcomes
          const avgOutcomes = totalOutcomeCount / eventCount;

          TwoWayMarket.upsert({
            provider: stat.provider,
            sport: stat.sport,
            league: stat.league,
            bookmaker: stat.bookmaker,
            market_key: stat.market_key,
            outcome_count: Math.round(avgOutcomes),
            is_two_way: isTwoWay,
            events_tested: eventCount,
            two_outcome_rate: parseFloat(twoOutcomeRate.toFixed(3)),
          });

          processed++;
          if (isTwoWay) twoWayFound++;
        }

        // Délai entre les requêtes pour respecter les rate limits
        await sleep(300);

      } catch (err) {
        logger.error(`Erreur lors de l'init 2-way pour ${provider}/${sport}: ${err.message}`);
      }
    }
  }

  logger.info(`Init marchés 2-way terminée: ${processed} enregistrements, ${twoWayFound} marchés 2-way`);
  return { processed, twoWayFound };
}

/**
 * Retourne les marchés 2-way depuis la base de données.
 * @param {Object} filters - {provider?, sport?, twoWayOnly?}
 * @returns {Array<Object>}
 */
export function listTwoWayMarkets(filters = {}) {
  return TwoWayMarket.findAll(filters);
}

/**
 * Retourne le client API approprié selon le fournisseur.
 * @param {string} provider
 * @returns {Object|null}
 */
function getClient(provider) {
  const clients = {
    theOddsApi,
    oddsApiIo,
  };
  return clients[provider] || null;
}

export default { initTwoWayMarkets, listTwoWayMarkets };
