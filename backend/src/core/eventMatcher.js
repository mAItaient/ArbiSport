/**
 * Appariement d'événements entre fournisseurs (The Odds API ↔ Odds-API.io).
 *
 * Stratégie :
 *  - Date proche : ≤ 30 min de différence ; pondération linéaire.
 *  - Noms d'équipes : tokenisation + normalisation accents/articles + alias.
 *  - Similarité par Jaro-Winkler (pas de dépendance externe).
 *  - Test crois (home/away inversé) en cas d'incohérence d'ordre.
 *
 * Bandes de confiance :
 *  - score ≥ 0.90 → fusion automatique
 *  - 0.70 ≤ score < 0.90 → table pending_event_matches (validation manuelle)
 *  - score < 0.70 → rejet silencieux
 */

const MAX_MINUTES_DIFF = 30;

/**
 * Alias d'équipes connus (à enrichir au fil du temps).
 * Clé : forme normalisée d'une équipe. Valeur : forme canonique.
 */
// Les clés et valeurs sont déjà sous leur forme normalisée (cf normalizeTeam).
// Cela évite l'écart entre la saisie "Olympique de Marseille" et la normalisation
// "olympique marseille" (le "de" disparaît avec les articles).
const STATIC_ALIASES = {
  'paris saint germain': 'psg',
  'paris sg': 'psg',
  'manchester united': 'man utd',
  'manchester city': 'man city',
  'real madrid': 'real madrid',
  'barcelona': 'barcelona',
  'barcelone': 'barcelona',
  'atletico madrid': 'atletico',
  'bayern munich': 'bayern munchen',
  'bayern munchen': 'bayern munchen',
  'tottenham hotspur': 'tottenham',
  'wolverhampton wanderers': 'wolves',
  'wolves': 'wolves',
  'marseille': 'marseille',
  'olympique marseille': 'marseille',
  'om': 'marseille',
  'olympique lyonnais': 'lyon',
  'olympique lyon': 'lyon',
  'lyon': 'lyon',
  'inter milan': 'internazionale',
  'inter': 'internazionale',
  'roma': 'roma',
  'napoli': 'napoli',
};

/**
 * Normalise un nom d'équipe :
 *  - minuscules
 *  - retire les accents
 *  - retire articles et préfixes "FC", "AC", "CF", "SC", "Club"
 *  - retire les ponctuations
 *  - écrase les espaces multiples
 *
 * @param {string} s
 * @returns {string}
 */
export function normalizeTeam(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(fc|ac|cf|sc|sk|sv|club|de|the|le|la|les|el|al|los|las)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Similarité Jaro entre deux chaînes.
 * @param {string} s1
 * @param {string} s2
 * @returns {number} 0..1
 */
function jaroSimilarity(s1, s2) {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDistance = Math.max(len1, len2) / 2 - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0.0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) t++;
    k++;
  }
  t /= 2;
  return (matches / len1 + matches / len2 + (matches - t) / matches) / 3;
}

/**
 * Similarité Jaro-Winkler (bonus pour préfixe commun).
 * @param {string} a
 * @param {string} b
 * @returns {number} 0..1
 */
export function jaroWinklerSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1.0;
  const jaro = jaroSimilarity(a, b);
  // Bonus pour préfixe commun (jusqu'à 4 chars)
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Calcule la similarité entre deux noms d'équipes.
 * @param {string} a
 * @param {string} b
 * @param {Object<string, string>} [aliases]
 * @returns {number} 0..1
 */
export function teamSimilarity(a, b, aliases = STATIC_ALIASES) {
  const na = normalizeTeam(a);
  const nb = normalizeTeam(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  const aliasA = aliases[na] || na;
  const aliasB = aliases[nb] || nb;
  if (aliasA === aliasB) return 0.98;
  return jaroWinklerSimilarity(na, nb);
}

/**
 * Score d'appariement entre deux événements (provider A / provider B).
 *
 * @param {Object} eventA
 * @param {Object} eventB
 * @param {Object<string, string>} [aliases] - alias dynamiques (table confirmed_aliases)
 * @returns {{score: number, swapped: boolean, timeScore: number, nameScore: number}}
 */
export function scoreEventMatch(eventA, eventB, aliases = STATIC_ALIASES) {
  // 1. Date proche
  let timeScore = 0;
  if (eventA.commence_time && eventB.commence_time) {
    const dtA = new Date(eventA.commence_time).getTime();
    const dtB = new Date(eventB.commence_time).getTime();
    if (!isFinite(dtA) || !isFinite(dtB)) {
      timeScore = 0;
    } else {
      const minutesDiff = Math.abs(dtA - dtB) / 60000;
      if (minutesDiff > MAX_MINUTES_DIFF) {
        return { score: 0, swapped: false, timeScore: 0, nameScore: 0 };
      }
      timeScore = Math.max(0, 1 - minutesDiff / MAX_MINUTES_DIFF);
    }
  }

  // 2. Noms — test direct ET inversé
  const homeScore = teamSimilarity(eventA.home_team, eventB.home_team, aliases);
  const awayScore = teamSimilarity(eventA.away_team, eventB.away_team, aliases);
  const swappedHome = teamSimilarity(eventA.home_team, eventB.away_team, aliases);
  const swappedAway = teamSimilarity(eventA.away_team, eventB.home_team, aliases);

  const directAvg = (homeScore + awayScore) / 2;
  const swappedAvg = (swappedHome + swappedAway) / 2;
  const swapped = swappedAvg > directAvg;
  const nameScore = Math.max(directAvg, swappedAvg);

  // 3. Score final pondéré
  const score = 0.7 * nameScore + 0.3 * timeScore;
  return { score, swapped, timeScore, nameScore };
}

/**
 * Apparie deux listes d'événements en trois bandes de confiance.
 *
 * @param {Array<Object>} eventsA - événements provider A
 * @param {Array<Object>} eventsB - événements provider B
 * @param {Object<string, string>} [aliases]
 * @returns {{matched: Array<{a, b, score}>, pending: Array<{a, b, score}>, unmatchedA: Array, unmatchedB: Array}}
 */
export function matchEventsBetweenProviders(eventsA, eventsB, aliases = STATIC_ALIASES) {
  const matched = [];
  const pending = [];
  const usedB = new Set();
  const unmatchedA = [];

  for (const a of eventsA) {
    let best = null;
    for (let bi = 0; bi < eventsB.length; bi++) {
      if (usedB.has(bi)) continue;
      const b = eventsB[bi];
      const r = scoreEventMatch(a, b, aliases);
      if (!best || r.score > best.score) best = { ...r, bi, b };
    }
    if (!best || best.score < 0.70) {
      unmatchedA.push(a);
      continue;
    }
    if (best.score >= 0.90) {
      matched.push({ a, b: best.b, score: best.score, swapped: best.swapped });
      usedB.add(best.bi);
    } else {
      pending.push({ a, b: best.b, score: best.score, swapped: best.swapped });
      usedB.add(best.bi);
    }
  }

  const unmatchedB = eventsB.filter((_, i) => !usedB.has(i));
  return { matched, pending, unmatchedA, unmatchedB };
}

export default {
  normalizeTeam,
  teamSimilarity,
  jaroWinklerSimilarity,
  scoreEventMatch,
  matchEventsBetweenProviders,
  STATIC_ALIASES,
};
