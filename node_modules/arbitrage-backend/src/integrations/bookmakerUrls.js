/**
 * Construction des URLs deep-link vers les bookmakers.
 *
 * Priorité :
 *   1. URL fournie par Odds-API.io dans event.urls[bookmakerKey]
 *   2. URL construite à partir de patterns connus
 *   3. Homepage du bookmaker
 *   4. null si le bookmaker est inconnu
 */

/**
 * Homepages et patterns de deep-link par bookmaker.
 * Clé = identifiant bookmaker tel que retourné par les APIs.
 */
const BOOKMAKER_CONFIG = {
  // Bookmakers avec patterns de deep-link
  stake: {
    homepage: 'https://stake.com/sports',
    deeplink: (event) => event?.externalId
      ? `https://stake.com/sports/${event.externalId}`
      : 'https://stake.com/sports',
  },
  '1xbet': {
    homepage: 'https://1xbet.com/en/line',
    deeplink: (event) => {
      if (event?.slug) return `https://1xbet.com/en/line/${event.slug}`;
      if (event?.sport) return `https://1xbet.com/en/line/${event.sport}`;
      return 'https://1xbet.com/en/line';
    },
  },

  // Bookmakers avec homepage uniquement (fallback)
  pinnacle: { homepage: 'https://www.pinnacle.com/en/betting-odds/', deeplink: null },
  unibet: { homepage: 'https://www.unibet.fr/sport', deeplink: null },
  betclic: { homepage: 'https://www.betclic.fr/sport', deeplink: null },
  winamax: { homepage: 'https://www.winamax.fr/paris-sportifs', deeplink: null },
  netbet: { homepage: 'https://www.netbet.fr/sport', deeplink: null },
  pmu: { homepage: 'https://paris.pmu.fr/', deeplink: null },
  parionssport: { homepage: 'https://www.enligne.parionssport.fdj.fr/', deeplink: null },
  '888sport': { homepage: 'https://www.888sport.fr/', deeplink: null },
  betfair: { homepage: 'https://www.betfair.fr/sport/', deeplink: null },
  betonline: { homepage: 'https://www.betonline.ag/sportsbook/', deeplink: null },
  betvictor: { homepage: 'https://www.betvictor.com/en-gb/sports/', deeplink: null },
  everygame: { homepage: 'https://www.everygame.eu/sports/', deeplink: null },
  'bc.game': { homepage: 'https://bc.game/sports/', deeplink: null },
  borgata: { homepage: 'https://sports.borgataonline.com/', deeplink: null },
  bovada: { homepage: 'https://www.bovada.lv/sports', deeplink: null },
  draftkings: { homepage: 'https://sportsbook.draftkings.com/', deeplink: null },
  fanduel: { homepage: 'https://sportsbook.fanduel.com/', deeplink: null },
  betmgm: { homepage: 'https://sports.betmgm.com/', deeplink: null },
  caesars: { homepage: 'https://sportsbook.caesars.com/', deeplink: null },
  pointsbet: { homepage: 'https://pointsbet.com/', deeplink: null },
  mybookie: { homepage: 'https://mybookie.ag/', deeplink: null },
  lowvig: { homepage: 'https://lowvig.ag/', deeplink: null },
  sportsbetting: { homepage: 'https://www.sportsbetting.ag/', deeplink: null },
  barstool: { homepage: 'https://www.barstoolsportsbook.com/', deeplink: null },
  williamhill: { homepage: 'https://www.williamhill.com/sports', deeplink: null },
  betway: { homepage: 'https://betway.com/sports', deeplink: null },
  bet365: { homepage: 'https://www.bet365.com/#/HO/', deeplink: null },
};

/**
 * Retourne l'URL deep-link ou la homepage d'un bookmaker pour un événement.
 *
 * @param {string} provider      - Fournisseur de données ('theOddsApi' | 'oddsApiIo')
 * @param {string} bookmakerKey  - Identifiant bookmaker (ex: 'stake', 'pinnacle')
 * @param {Object} [event]       - Objet Event normalisé (peut contenir urls, externalId, slug)
 * @param {string} [outcomeLabel]- Label de l'outcome (non utilisé actuellement mais extensible)
 * @returns {string|null} URL ou null
 */
export function getBookmakerUrl(provider, bookmakerKey, event, outcomeLabel) {
  if (!bookmakerKey) return null;

  const key = bookmakerKey.toLowerCase().replace(/\s+/g, '');

  // 1. Priorité : URL fournie par Odds-API.io dans event.urls
  if (provider === 'oddsApiIo' && event?.urls && event.urls[bookmakerKey]) {
    return event.urls[bookmakerKey];
  }

  const bConfig = BOOKMAKER_CONFIG[key] || BOOKMAKER_CONFIG[bookmakerKey];
  if (!bConfig) return null;

  // 2. Construit un deep-link si un pattern est disponible
  if (bConfig.deeplink) {
    try {
      const url = bConfig.deeplink(event);
      if (url) return url;
    } catch {
      // Fallback sur homepage
    }
  }

  // 3. Retourne la homepage
  return bConfig.homepage || null;
}

/**
 * Retourne la homepage d'un bookmaker (sans contexte d'événement).
 * @param {string} bookmakerKey
 * @returns {string|null}
 */
export function getBookmakerHomepage(bookmakerKey) {
  if (!bookmakerKey) return null;
  const key = bookmakerKey.toLowerCase().replace(/\s+/g, '');
  const bConfig = BOOKMAKER_CONFIG[key] || BOOKMAKER_CONFIG[bookmakerKey];
  return bConfig?.homepage || null;
}

/**
 * Retourne la liste de tous les bookmakers configurés.
 * @returns {Array<string>}
 */
export function listKnownBookmakers() {
  return Object.keys(BOOKMAKER_CONFIG);
}

export default { getBookmakerUrl, getBookmakerHomepage, listKnownBookmakers };
