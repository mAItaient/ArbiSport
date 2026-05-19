/**
 * Moteur de détection et de calcul d'arbitrage 2-way.
 *
 * Principe mathématique :
 *   Il y a arbitrage si la somme des inverses des meilleures cotes est < 1 :
 *     S = 1/oA + 1/oB < 1
 *
 *   Mise optimale sur chaque issue (stake) :
 *     stakeA = T * (1/oA) / S
 *     stakeB = T * (1/oB) / S
 *
 *   Gains garantis :
 *     profitA = stakeA * oA - T  (gain net si A gagne)
 *     profitB = stakeB * oB - T  (gain net si B gagne)
 *     gainMin = min(profitA, profitB)
 *     roi     = gainMin / T * 100
 */

import { decimalFromAmerican } from '../utils/oddsConversion.js';
import { getBookmakerUrl } from '../integrations/bookmakerUrls.js';
import logger from '../utils/logger.js';

// Au-delà de ce ROI, on suspecte un appariement défectueux (handicap non
// symétrique, point totals divergent, marché 3-way passé en force) plutôt
// qu'une vraie opportunité. En arbitrage 2-way réel, le ROI est typiquement
// dans [0 ; 8 %], rarement >15 %, et un ROI > 30 % est presque toujours un
// bug en amont.
const ROI_ANORMAL_THRESHOLD_PCT = 30;

/**
 * Détermine s'il existe un arbitrage 2-way entre deux cotes décimales.
 * @param {number} oA - Cote décimale pour l'issue A (ex: 2.10)
 * @param {number} oB - Cote décimale pour l'issue B (ex: 2.10)
 * @returns {boolean} true si 1/oA + 1/oB < 1
 */
export function isArb(oA, oB) {
  if (!oA || !oB || oA <= 1.0 || oB <= 1.0) return false;
  return (1 / oA + 1 / oB) < 1;
}

/**
 * Calcule les mises et profits d'un arbitrage 2-way.
 * @param {number} oA - Cote décimale issue A
 * @param {number} oB - Cote décimale issue B
 * @param {number} T  - Mise totale à répartir (ex: 100)
 * @returns {Object} {stakeA, stakeB, profitA, profitB, gainMin, gainMinPct, roi}
 */
export function computeStakes(oA, oB, T) {
  if (!isArb(oA, oB)) {
    return null;
  }

  // Somme des inverses (doit être < 1 pour qu'il y ait arbitrage)
  const S = 1 / oA + 1 / oB;

  // Répartition optimale des mises
  const stakeA = T * (1 / oA) / S;
  const stakeB = T * (1 / oB) / S;

  // Gains nets sur chaque issue
  const profitA = stakeA * oA - T;
  const profitB = stakeB * oB - T;

  // Gain minimum garanti (le plus petit des deux profits)
  const gainMin = Math.min(profitA, profitB);
  const gainMinPct = (gainMin / T) * 100;

  // ROI = rendement sur la mise totale
  const roi = gainMinPct;

  return {
    stakeA: parseFloat(stakeA.toFixed(4)),
    stakeB: parseFloat(stakeB.toFixed(4)),
    profitA: parseFloat(profitA.toFixed(4)),
    profitB: parseFloat(profitB.toFixed(4)),
    gainMin: parseFloat(gainMin.toFixed(4)),
    gainMinPct: parseFloat(gainMinPct.toFixed(4)),
    roi: parseFloat(roi.toFixed(4)),
  };
}

/**
 * Normalise une cote vers le format décimal.
 * Accepte les formats : décimal (number) ou américain (via conversion).
 * @param {number} odds - Cote en format décimal ou américain
 * @param {string} format - 'decimal' | 'american'
 * @returns {number|null} Cote décimale ou null si invalide
 */
function normalizeToDecimal(odds, format = 'decimal') {
  if (odds === null || odds === undefined || isNaN(odds)) return null;
  if (format === 'american') {
    try {
      return decimalFromAmerican(odds);
    } catch {
      return null;
    }
  }
  return odds > 1.0 ? odds : null;
}

/**
 * Regroupe les quotes par (event_id, market_key, ligne) pour les marchés 2-way.
 *
 * Règles strictes selon le marché (tolérance ZÉRO sur la ligne) :
 *
 *   - h2h / draw_no_bet / btts : pas de notion de point → groupKey = (event, market).
 *
 *   - totals (Over/Under)      : over et under SUR LE MÊME point sont opposés.
 *     groupKey = (event, market, exactPoint). Cela garantit que Over 2.5 chez A
 *     ne peut être combiné qu'avec Under 2.5 chez B (jamais Under 3.0).
 *
 *   - spreads (Handicap)       : home -1.5 et away +1.5 sont opposés. Le point
 *     côté away est l'opposé du point home. On regroupe donc par |point| (valeur
 *     absolue) et on note la direction signée dans le label outcome pour ne pas
 *     comparer home -1.5 et home -1.0.
 *
 * @param {Array<Object>} quotes
 * @returns {Map}
 */
function groupQuotesByEventMarket(quotes) {
  const groups = new Map();

  for (const q of quotes) {
    const isSpread = q.market_key === 'spreads';
    const isTotal  = q.market_key === 'totals';

    let lineKey;
    let label = q.outcome_label;

    if (isSpread) {
      // On groupe par valeur absolue : home -1.5 ↔ away +1.5 partagent |1.5|.
      // Si le point manque on saute (un spread sans ligne est invalide).
      if (q.point == null) continue;
      lineKey = `abs:${Math.abs(Number(q.point)).toFixed(2)}`;
    } else if (isTotal) {
      // Over et Under partagent EXACTEMENT le même point.
      if (q.point == null) continue;
      lineKey = `pt:${Number(q.point).toFixed(2)}`;
    } else {
      lineKey = 'nopoint';
    }

    const groupKey = `${q.event_id}|${q.market_key}|${lineKey}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        event_id: q.event_id,
        market_key: q.market_key,
        // Pour affichage utilisateur : on garde une valeur représentative du point
        // (signed pour spreads = abs ; pour totals = la ligne)
        point: isSpread ? Math.abs(Number(q.point)) : (isTotal ? Number(q.point) : null),
        outcomes: {},
        bookmaker_quotes: [],
      });
    }

    const group = groups.get(groupKey);
    group.bookmaker_quotes.push(q);

    if (!group.outcomes[label]) {
      group.outcomes[label] = [];
    }
    group.outcomes[label].push({ bookmaker: q.bookmaker, odds: q.odds, point: q.point });
  }

  return groups;
}

/**
 * Identifie les deux issues opposées dans un marché STRICTEMENT 2-way.
 *
 * Règle critique : on n'autorise QUE les marchés qui ont nativement 2 issues.
 *
 *   - h2h : 2 issues UNIQUEMENT si le sport n'a pas de nul (tennis, basket NBA,
 *     MMA, NFL, baseball, hockey à cause des prolongations…). Pour le football,
 *     h2h = 1X2 à 3 issues → REJETÉ (on ne peut pas l'ignorer, sinon le nul fait
 *     perdre toute la mise).
 *   - draw_no_bet : 2 issues, le nul rembourse → OK.
 *   - totals / spreads : 2 issues (over/under, home/away à handicap) → OK.
 *   - btts : 2 issues (oui/non) → OK.
 *
 * Si le marché a strictement plus de 2 issues, on le REJETTE intégralement.
 *
 * @param {Object} group - Groupe de quotes d'un marché
 * @returns {Array<string>|null} [labelA, labelB] ou null si non 2-way
 */
function getTwoWayOutcomes(group) {
  // Clé d'unicité : on regarde les labels distincts vus, tous bookmakers confondus.
  // Si AU MOINS UN bookmaker propose 3 issues (ex: home/draw/away), on considère
  // le marché comme 3-way et on le rejette entièrement — sinon le nul casse
  // l'arbitrage et le calcul donne un faux gain garanti.
  const outcomeLabels = Object.keys(group.outcomes);

  if (outcomeLabels.length !== 2) {
    // 1 issue : marché incomplet. 3+ issues : marché à plus de 2 issues (1X2,
    // double chance, etc.) — incompatible avec l'arbitrage 2-way.
    return null;
  }

  // Vérification supplémentaire : aucun des deux labels ne doit être un "nul".
  // (cas pathologique où un bookmaker n'aurait que home+draw par exemple)
  const drawLabels = new Set(['draw', 'tie', 'nul', 'match nul', 'x']);
  if (outcomeLabels.some((l) => drawLabels.has(String(l).toLowerCase()))) {
    return null;
  }

  return outcomeLabels;
}

/**
 * Filtre de base pour les opportunités selon les critères utilisateur.
 * @param {Object} result - Résultat computeStakes + métadonnées
 * @param {Object} filters - {minRoiPct, minGuaranteedPct, minProfitAbs, minMinutesBeforeStart}
 * @param {string} commenceTime - ISO string heure de début de l'événement
 * @returns {boolean}
 */
function passesFilters(result, filters, commenceTime) {
  if (!filters) return true;

  const { minRoiPct = 0, minGuaranteedPct = 0, minProfitAbs = 0, minMinutesBeforeStart = 0 } = filters;

  if (result.roi < minRoiPct) return false;
  if (result.gainMinPct < minGuaranteedPct) return false;
  if (result.gainMin < minProfitAbs) return false;

  if (minMinutesBeforeStart > 0 && commenceTime) {
    const minutesLeft = (new Date(commenceTime) - Date.now()) / 60000;
    if (minutesLeft < minMinutesBeforeStart) return false;
  }

  return true;
}

/**
 * Détecte toutes les opportunités d'arbitrage 2-way dans un ensemble de quotes.
 * @param {Array<Object>} quotes - Liste de BookmakerQuote normalisées
 * @param {Array<Object>} events - Liste d'Event normalisées (pour métadonnées + URLs)
 * @param {number} stakeTotal - Mise totale pour le calcul (ex: 100)
 * @param {Object} [filters] - Filtres optionnels
 * @param {string} [provider] - Nom du fournisseur de données
 * @returns {Array<Object>} Liste d'opportunités d'arbitrage
 */
export function findOpportunities(quotes, events, stakeTotal, filters, provider) {
  const opportunities = [];

  // Index des events par id pour accès rapide
  const eventIndex = {};
  if (events) {
    for (const ev of events) {
      eventIndex[ev.id] = ev;
    }
  }

  // Compteurs de rejets pour traçabilité (loggés en fin de fonction)
  let rejectedSpreadAsym = 0;       // Spreads : home@+H non apparié à away@−H
  let rejectedTotalsPoint = 0;      // Totals : Over@P apparié à Under@P′ avec P ≠ P′
  let rejectedSameSide = 0;         // home vs home ou away vs away (sécurité)
  let rejectedThreeWay = 0;         // marché à 3+ issues détecté
  let warnHighRoi = 0;

  // Regroupe par (event, market, point)
  const groups = groupQuotesByEventMarket(quotes);

  for (const [, group] of groups) {
    const twoWayOutcomes = getTwoWayOutcomes(group);
    if (!twoWayOutcomes) {
      // Marché écarté : on incrémente le compteur 3-way si applicable.
      // (Object.keys(...) >= 3 ⇒ marché à plusieurs issues mutuellement exclusives.)
      if (Object.keys(group.outcomes).length >= 3) rejectedThreeWay++;
      continue;
    }

    const [labelA, labelB] = twoWayOutcomes;
    const quotesA = group.outcomes[labelA] || [];
    const quotesB = group.outcomes[labelB] || [];

    const event = eventIndex[group.event_id];
    const commenceTime = event?.commence_time;

    // Garde-fou : les deux labels doivent être STRICTEMENT distincts. Sinon
    // un même label pourrait se retrouver "apparié à lui-même" (home vs home).
    if (labelA === labelB) {
      rejectedSameSide += quotesA.length * quotesB.length;
      continue;
    }

    // Teste toutes les paires (bookmakerI sur A, bookmakerJ sur B), i ≠ j.
    // Pour les spreads, on impose qA.point === -qB.point (signes opposés et même magnitude).
    const isSpread = group.market_key === 'spreads';
    const isTotal  = group.market_key === 'totals';
    for (const qA of quotesA) {
      for (const qB of quotesB) {
        if (qA.bookmaker === qB.bookmaker) continue;

        if (isSpread) {
          // Les deux quotes doivent être sur des côtés opposés ET même |point|.
          //   home@+H vs away@−H  →  pA + pB === 0  ET  |pA| === |pB|
          // Tout autre cas (home@+1 vs away@+1, home@+1 vs home@−1, etc.) est
          // rejeté et compté pour traçabilité.
          const pA = Number(qA.point);
          const pB = Number(qB.point);
          if (!isFinite(pA) || !isFinite(pB)) { rejectedSpreadAsym++; continue; }
          if (Math.abs(pA + pB) > 1e-9) { rejectedSpreadAsym++; continue; }
          if (Math.abs(Math.abs(pA) - Math.abs(pB)) > 1e-9) { rejectedSpreadAsym++; continue; }
          // Signes opposés (sauf pA = pB = 0, cas Pick'em parfaitement valide).
          if (pA !== 0 && Math.sign(pA) === Math.sign(pB)) { rejectedSpreadAsym++; continue; }
        } else if (isTotal) {
          // Over@P et Under@P : P EXACTEMENT identique des deux côtés.
          const pA = Number(qA.point);
          const pB = Number(qB.point);
          if (!isFinite(pA) || !isFinite(pB)) { rejectedTotalsPoint++; continue; }
          if (Math.abs(pA - pB) > 1e-9) { rejectedTotalsPoint++; continue; }
        }

        const oA = normalizeToDecimal(qA.odds);
        const oB = normalizeToDecimal(qB.odds);

        if (!oA || !oB) continue;

        const result = computeStakes(oA, oB, stakeTotal);
        if (!result) continue;

        if (!passesFilters(result, filters, commenceTime)) continue;

        // Garde-fou : un ROI anormalement élevé (>30 %) trahit presque toujours
        // un appariement incorrect en amont (Spread non symétrique, Totals à
        // points divergents, marché 3-way passé en force). On laisse passer
        // l'opportunité mais on la signale pour audit.
        if (result.roi > ROI_ANORMAL_THRESHOLD_PCT) {
          warnHighRoi++;
          logger.warn(
            `ROI anormal détecté (${result.roi.toFixed(2)} %) — vérifier matcher : ` +
            `${group.market_key} ${qA.bookmaker} ${labelA}@${qA.point ?? '-'} (${oA}) ` +
            `vs ${qB.bookmaker} ${labelB}@${qB.point ?? '-'} (${oB}) event=${group.event_id}`
          );
        }

        // Récupère les URLs deep-link pour les bookmakers
        const urlA = getBookmakerUrl(provider, qA.bookmaker, event, labelA);
        const urlB = getBookmakerUrl(provider, qB.bookmaker, event, labelB);

        // Affichage de la ligne signée pour transparence utilisateur
        const lineDisplay = isSpread
          ? signedLine(qA.point, qB.point)
          : (isTotal ? Number(qA.point) : group.point);
        const marketLabel = getMarketLabel(group.market_key, lineDisplay);

        opportunities.push({
          provider: provider || '',
          sport: event?.sport || '',
          league: event?.league || '',
          event_id: group.event_id,
          event_label: event?.label || group.event_id,
          market_key: group.market_key,
          market_label: marketLabel,
          line: lineDisplay,
          outcome_a_label: labelA,
          outcome_b_label: labelB,
          bookmaker_a: qA.bookmaker,
          bookmaker_b: qB.bookmaker,
          odds_a: oA,
          odds_b: oB,
          stake_total: stakeTotal,
          stake_a: result.stakeA,
          stake_b: result.stakeB,
          profit_a: result.profitA,
          profit_b: result.profitB,
          gain_min: result.gainMin,
          gain_min_pct: result.gainMinPct,
          roi: result.roi,
          bookmaker_a_url: urlA,
          bookmaker_b_url: urlB,
          commence_time: commenceTime || null,
        });
      }
    }
  }

  // Bilan des rejets — utile pour diagnostiquer un scan suspect.
  if (rejectedSpreadAsym > 0) {
    logger.info(`Matcher: ${rejectedSpreadAsym} paires Spread rejetées (handicaps non symétriques)`);
  }
  if (rejectedTotalsPoint > 0) {
    logger.info(`Matcher: ${rejectedTotalsPoint} paires Totals rejetées (points différents)`);
  }
  if (rejectedSameSide > 0) {
    logger.info(`Matcher: ${rejectedSameSide} paires rejetées (même côté du marché)`);
  }
  if (rejectedThreeWay > 0) {
    logger.info(`Matcher: ${rejectedThreeWay} marchés rejetés (3+ issues, incompatible 2-way)`);
  }
  if (warnHighRoi > 0) {
    logger.warn(`Matcher: ${warnHighRoi} opportunités à ROI > ${ROI_ANORMAL_THRESHOLD_PCT} % à vérifier`);
  }

  return opportunities;
}

/**
 * Retourne un libellé lisible pour un marché.
 * @param {string} marketKey
 * @param {number|null} point
 * @returns {string}
 */
function getMarketLabel(marketKey, point) {
  const labels = {
    h2h: 'Victoire/Défaite',
    totals: point != null ? `Total ${point}` : 'Total',
    spreads: point != null ? `Handicap ${formatSigned(point)}` : 'Handicap',
    draw_no_bet: 'Victoire sans nul',
    btts: 'Les deux équipes marquent',
  };
  return labels[marketKey] || marketKey;
}

/**
 * Choisit l'écriture signée la plus pertinente pour la ligne (côté A vs B).
 * On affiche la valeur côté home si déductible, sinon |point|.
 */
function signedLine(pA, pB) {
  const a = Number(pA);
  const b = Number(pB);
  if (isFinite(a) && a !== 0) return Math.abs(a);
  if (isFinite(b) && b !== 0) return Math.abs(b);
  return null;
}

function formatSigned(n) {
  if (n == null) return '';
  return n > 0 ? `+${n}` : `${n}`;
}

export default { isArb, computeStakes, findOpportunities };
