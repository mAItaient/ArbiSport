/**
 * Registre interne des sports supportés par ArbiSport.
 *
 * Chaque sport interne est mappé vers :
 *   - The Odds API (sportKey)
 *   - Odds-API.io (sport + leagueSlug optionnel)
 *
 * Cela évite d'envoyer "soccer_epl" à Odds-API.io qui ne reconnaît que
 * "football" + slug de ligue. Un mapping absent signifie que le provider
 * ne couvre pas ce sport — on saute silencieusement.
 *
 * Liste de bookmakers cibles (13 demandés par l'utilisateur) :
 *   Betclic, NetBet, Unibet, PMU, Winamax, Pinnacle, Betfair, 888sport,
 *   1xBet, Betonline, Everygame, BC.Game, Stake.
 */

export const SPORT_CATALOG = [
  // ─── FOOTBALL — marchés strictement 2-way ──────────────────────────────────
  {
    internalKey: 'soccer_epl',
    label: 'Football – Premier League',
    group: 'soccer',
    theOddsApi: { sportKey: 'soccer_epl' },
    oddsApiIo:  { sport: 'football', leagueSlug: 'england-premier-league' },
    twoWayMarkets: ['draw_no_bet', 'totals', 'spreads', 'btts'],
  },
  {
    internalKey: 'soccer_france_ligue_one',
    label: 'Football – Ligue 1',
    group: 'soccer',
    theOddsApi: { sportKey: 'soccer_france_ligue_one' },
    oddsApiIo:  { sport: 'football', leagueSlug: 'france-ligue-1' },
    twoWayMarkets: ['draw_no_bet', 'totals', 'spreads', 'btts'],
  },
  {
    internalKey: 'soccer_spain_la_liga',
    label: 'Football – La Liga',
    group: 'soccer',
    theOddsApi: { sportKey: 'soccer_spain_la_liga' },
    oddsApiIo:  { sport: 'football', leagueSlug: 'spain-la-liga' },
    twoWayMarkets: ['draw_no_bet', 'totals', 'spreads', 'btts'],
  },
  {
    internalKey: 'soccer_germany_bundesliga',
    label: 'Football – Bundesliga',
    group: 'soccer',
    theOddsApi: { sportKey: 'soccer_germany_bundesliga' },
    oddsApiIo:  { sport: 'football', leagueSlug: 'germany-bundesliga' },
    twoWayMarkets: ['draw_no_bet', 'totals', 'spreads', 'btts'],
  },
  {
    internalKey: 'soccer_italy_serie_a',
    label: 'Football – Serie A',
    group: 'soccer',
    theOddsApi: { sportKey: 'soccer_italy_serie_a' },
    oddsApiIo:  { sport: 'football', leagueSlug: 'italy-serie-a' },
    twoWayMarkets: ['draw_no_bet', 'totals', 'spreads', 'btts'],
  },
  {
    internalKey: 'soccer_uefa_champs_league',
    label: 'Football – Champions League',
    group: 'soccer',
    theOddsApi: { sportKey: 'soccer_uefa_champs_league' },
    oddsApiIo:  { sport: 'football', leagueSlug: 'europe-uefa-champions-league' },
    twoWayMarkets: ['draw_no_bet', 'totals', 'spreads', 'btts'],
  },
  {
    internalKey: 'soccer_uefa_europa_league',
    label: 'Football – Europa League',
    group: 'soccer',
    theOddsApi: { sportKey: 'soccer_uefa_europa_league' },
    oddsApiIo:  { sport: 'football', leagueSlug: 'europe-uefa-europa-league' },
    twoWayMarkets: ['draw_no_bet', 'totals', 'spreads', 'btts'],
  },

  // ─── TENNIS — h2h naturellement 2-way (pas de nul) ─────────────────────────
  {
    internalKey: 'tennis_atp_french_open',
    label: 'Tennis – ATP Roland-Garros',
    group: 'tennis',
    theOddsApi: { sportKey: 'tennis_atp_french_open' },
    oddsApiIo:  { sport: 'tennis', leagueSlug: 'atp-french-open' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },
  {
    internalKey: 'tennis_wta_french_open',
    label: 'Tennis – WTA Roland-Garros',
    group: 'tennis',
    theOddsApi: { sportKey: 'tennis_wta_french_open' },
    oddsApiIo:  { sport: 'tennis', leagueSlug: 'wta-french-open' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },
  {
    internalKey: 'tennis_atp_wimbledon',
    label: 'Tennis – ATP Wimbledon',
    group: 'tennis',
    theOddsApi: { sportKey: 'tennis_atp_wimbledon' },
    oddsApiIo:  { sport: 'tennis', leagueSlug: 'atp-wimbledon' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },
  {
    internalKey: 'tennis_atp_us_open',
    label: 'Tennis – ATP US Open',
    group: 'tennis',
    theOddsApi: { sportKey: 'tennis_atp_us_open' },
    oddsApiIo:  { sport: 'tennis', leagueSlug: 'atp-us-open' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },
  {
    internalKey: 'tennis_atp_aus_open',
    label: 'Tennis – ATP Australian Open',
    group: 'tennis',
    theOddsApi: { sportKey: 'tennis_atp_aus_open' },
    oddsApiIo:  { sport: 'tennis', leagueSlug: 'atp-australian-open' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },

  // ─── BASKETBALL — pas de nul ───────────────────────────────────────────────
  {
    internalKey: 'basketball_nba',
    label: 'Basketball – NBA',
    group: 'basketball',
    theOddsApi: { sportKey: 'basketball_nba' },
    oddsApiIo:  { sport: 'basketball', leagueSlug: 'usa-nba' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },
  {
    internalKey: 'basketball_euroleague',
    label: 'Basketball – EuroLeague',
    group: 'basketball',
    theOddsApi: { sportKey: 'basketball_euroleague' },
    oddsApiIo:  { sport: 'basketball', leagueSlug: 'europe-euroleague' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },

  // ─── MMA / BOXE — h2h uniquement (pas de nul) ──────────────────────────────
  {
    internalKey: 'mma_mixed_martial_arts',
    label: 'MMA – UFC / Bellator',
    group: 'mma',
    theOddsApi: { sportKey: 'mma_mixed_martial_arts' },
    oddsApiIo:  { sport: 'mixed-martial-arts' },
    twoWayMarkets: ['h2h'],
  },
  {
    internalKey: 'boxing_boxing',
    label: 'Boxe',
    group: 'boxing',
    theOddsApi: { sportKey: 'boxing_boxing' },
    oddsApiIo:  { sport: 'boxing' },
    twoWayMarkets: ['h2h'],
  },

  // ─── BASEBALL ──────────────────────────────────────────────────────────────
  {
    internalKey: 'baseball_mlb',
    label: 'Baseball – MLB',
    group: 'baseball',
    theOddsApi: { sportKey: 'baseball_mlb' },
    oddsApiIo:  { sport: 'baseball', leagueSlug: 'usa-mlb' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },

  // ─── HOCKEY — h2h 2-way (incl. prolongations) ──────────────────────────────
  {
    internalKey: 'icehockey_nhl',
    label: 'Hockey – NHL',
    group: 'icehockey',
    theOddsApi: { sportKey: 'icehockey_nhl' },
    oddsApiIo:  { sport: 'ice-hockey', leagueSlug: 'usa-nhl' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },

  // ─── FOOTBALL AMÉRICAIN — pas de nul ───────────────────────────────────────
  {
    internalKey: 'americanfootball_nfl',
    label: 'Football américain – NFL',
    group: 'americanfootball',
    theOddsApi: { sportKey: 'americanfootball_nfl' },
    oddsApiIo:  { sport: 'american-football', leagueSlug: 'usa-nfl' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },
  {
    internalKey: 'americanfootball_ncaaf',
    label: 'Football américain – NCAAF',
    group: 'americanfootball',
    theOddsApi: { sportKey: 'americanfootball_ncaaf' },
    oddsApiIo:  { sport: 'american-football', leagueSlug: 'usa-ncaaf' },
    twoWayMarkets: ['h2h', 'totals', 'spreads'],
  },
];

/**
 * Liste des 13 bookmakers cibles avec leur identifiant officiel par provider.
 *
 * IMPORTANT : ces clés doivent correspondre exactement à celles renvoyées par
 * les APIs respectives. Tout autre bookmaker rencontré est ignoré.
 */
export const TARGET_BOOKMAKERS = [
  // id interne (affichage UI)  | The Odds API key | Odds-API.io name | regions
  { id: 'betclic',   label: 'Betclic',    theOddsApi: 'betclic_fr',      oddsApiIo: 'Betclic FR' },
  { id: 'netbet',    label: 'NetBet',     theOddsApi: null,              oddsApiIo: 'NetBet' },
  { id: 'unibet',    label: 'Unibet',     theOddsApi: 'unibet_fr',       oddsApiIo: 'Unibet FR' },
  { id: 'pmu',       label: 'PMU',        theOddsApi: 'pmu_fr',          oddsApiIo: 'PMU' },
  { id: 'winamax',   label: 'Winamax',    theOddsApi: 'winamax_fr',      oddsApiIo: 'Winamax FR' },
  { id: 'pinnacle',  label: 'Pinnacle',   theOddsApi: 'pinnacle',        oddsApiIo: 'Pinnacle' },
  { id: 'betfair',   label: 'Betfair',    theOddsApi: 'betfair_ex_eu',   oddsApiIo: 'Betfair Exchange' },
  { id: '888sport',  label: '888sport',   theOddsApi: 'sport888',        oddsApiIo: '888Sport' },
  { id: 'onexbet',   label: '1xBet',      theOddsApi: 'onexbet',         oddsApiIo: '1xbet' },
  { id: 'betonline', label: 'Betonline',  theOddsApi: 'betonlineag',     oddsApiIo: 'BetOnline.ag' },
  { id: 'everygame', label: 'Everygame',  theOddsApi: 'everygame',       oddsApiIo: 'Everygame' },
  { id: 'bcgame',    label: 'BC.Game',    theOddsApi: null,              oddsApiIo: 'BC.Game' },
  { id: 'stake',     label: 'Stake',      theOddsApi: null,              oddsApiIo: 'Stake' },
];

/**
 * Récupère un sport par son internalKey.
 * @param {string} internalKey
 * @returns {Object|null}
 */
export function getSport(internalKey) {
  return SPORT_CATALOG.find((s) => s.internalKey === internalKey) || null;
}

/**
 * Retourne le mapping sport pour un provider donné.
 * @param {string} internalKey
 * @param {string} provider - 'theOddsApi' | 'oddsApiIo'
 * @returns {Object|null} mapping spécifique ou null si non couvert
 */
export function getSportMapping(internalKey, provider) {
  const s = getSport(internalKey);
  if (!s) return null;
  if (provider === 'theOddsApi') return s.theOddsApi?.sportKey ? s.theOddsApi : null;
  if (provider === 'oddsApiIo')  return s.oddsApiIo?.sport ? s.oddsApiIo : null;
  return null;
}

/**
 * Liste les sports couverts par un provider donné.
 * @param {string} provider
 * @returns {Array<Object>}
 */
export function listSportsForProvider(provider) {
  return SPORT_CATALOG.filter((s) => getSportMapping(s.internalKey, provider));
}

/**
 * Retourne les marchés 2-way valides pour un sport.
 * @param {string} internalKey
 * @returns {string[]}
 */
export function getTwoWayMarkets(internalKey) {
  return getSport(internalKey)?.twoWayMarkets || [];
}

/**
 * Filtre une liste de bookmakers utilisateur pour ne garder que les clés cibles
 * acceptées par le provider donné.
 *
 * @param {string[]} userBookmakers - identifiants UI (betclic, netbet, ...)
 * @param {string}   provider       - 'theOddsApi' | 'oddsApiIo'
 * @returns {string[]} clés API spécifiques du provider
 */
export function filterBookmakersForProvider(userBookmakers, provider) {
  if (!Array.isArray(userBookmakers) || userBookmakers.length === 0) return [];
  const out = [];
  for (const bm of TARGET_BOOKMAKERS) {
    if (!userBookmakers.includes(bm.id)) continue;
    const key = provider === 'theOddsApi' ? bm.theOddsApi
              : provider === 'oddsApiIo'  ? bm.oddsApiIo
              : null;
    if (key) out.push(key);
  }
  return out;
}

/**
 * Mapping inverse : clé bookmaker API → id interne canonique.
 * Utile pour normaliser les bookmakers retournés par les deux APIs.
 *
 * @param {string} key - clé brute API (ex: 'betclic_fr', '1xbet', 'Pinnacle')
 * @returns {string|null} id interne (ex: 'betclic') ou null si inconnu
 */
export function canonicalBookmakerId(key) {
  if (!key) return null;
  const k = String(key).trim();
  for (const bm of TARGET_BOOKMAKERS) {
    if (bm.theOddsApi && bm.theOddsApi.toLowerCase() === k.toLowerCase()) return bm.id;
    if (bm.oddsApiIo && bm.oddsApiIo.toLowerCase() === k.toLowerCase())   return bm.id;
    if (bm.id.toLowerCase() === k.toLowerCase()) return bm.id;
  }
  // Heuristique tolérante : Betfair Exchange peut apparaître comme "betfair" tout court
  const lc = k.toLowerCase();
  if (lc.startsWith('betfair'))   return 'betfair';
  if (lc.startsWith('pinnacle'))  return 'pinnacle';
  if (lc.startsWith('unibet'))    return 'unibet';
  if (lc.startsWith('betclic'))   return 'betclic';
  if (lc.startsWith('winamax'))   return 'winamax';
  if (lc.startsWith('888'))       return '888sport';
  if (lc.includes('1xbet') || lc.includes('onexbet')) return 'onexbet';
  if (lc.startsWith('betonline')) return 'betonline';
  if (lc.startsWith('everygame')) return 'everygame';
  if (lc.startsWith('netbet'))    return 'netbet';
  if (lc.startsWith('pmu'))       return 'pmu';
  if (lc.startsWith('stake'))     return 'stake';
  if (lc.includes('bc.game') || lc === 'bcgame') return 'bcgame';
  return null;
}

export default {
  SPORT_CATALOG,
  TARGET_BOOKMAKERS,
  getSport,
  getSportMapping,
  listSportsForProvider,
  getTwoWayMarkets,
  filterBookmakersForProvider,
  canonicalBookmakerId,
};
