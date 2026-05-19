/**
 * Tests du client Odds-API.io — utilise le format de réponse RÉEL
 * documenté officiellement (https://docs.odds-api.io/llms-full.txt).
 *
 * Format clé :
 *   bookmakers est un OBJET { "Bet365": [ {name, updatedAt, odds:[...]}, ... ] }
 *   - chaque marché : { name: "ML"|"Asian Handicap"|"Totals"|..., odds: [ {...} ] }
 *   - ML  → odds: [{home, away}] (3-way si draw présent → ignoré)
 *   - Asian Handicap / Spread → odds: [{hdp, home, away}, ...]
 *   - Totals → odds: [{hdp, over, under}, ...]
 *   - Both Teams to Score → odds: [{yes, no}]
 *
 * On teste UNIQUEMENT les fonctions pures (pas de réseau).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  parseOddsResponse,
  mapMarketNameToInternal,
  normalizeEvent,
  getOdds,
  ODDS_API_IO_SUPPORTED_BOOKMAKERS,
  _resetSelectedCache,
} from '../src/integrations/oddsApiIoClient.js';

// Mock du gestionnaire de clés (évite la dépendance DB)
vi.mock('../src/core/apiKeyManager.js', () => ({
  apiKeyManager: {
    getKeyForRequest: () => ({ api_key_value: 'test-key' }),
    updateKeyUsage: () => {},
    markLimited: () => {},
  },
}));

vi.mock('axios');

describe('mapMarketNameToInternal', () => {
  it('reconnaît ML / Moneyline → h2h', () => {
    expect(mapMarketNameToInternal('ML')).toBe('h2h');
    expect(mapMarketNameToInternal('Moneyline')).toBe('h2h');
    expect(mapMarketNameToInternal('moneyline')).toBe('h2h');
  });

  it('reconnaît Totals → totals', () => {
    expect(mapMarketNameToInternal('Totals')).toBe('totals');
    expect(mapMarketNameToInternal('Total')).toBe('totals');
    expect(mapMarketNameToInternal('Over/Under')).toBe('totals');
  });

  it('reconnaît Spread / Asian Handicap → spreads', () => {
    expect(mapMarketNameToInternal('Spread')).toBe('spreads');
    expect(mapMarketNameToInternal('Asian Handicap')).toBe('spreads');
    expect(mapMarketNameToInternal('Handicap')).toBe('spreads');
  });

  it('reconnaît BTTS → btts', () => {
    expect(mapMarketNameToInternal('BTTS')).toBe('btts');
    expect(mapMarketNameToInternal('Both Teams to Score')).toBe('btts');
  });

  it('reconnaît Draw No Bet → draw_no_bet', () => {
    expect(mapMarketNameToInternal('Draw No Bet')).toBe('draw_no_bet');
    expect(mapMarketNameToInternal('DNB')).toBe('draw_no_bet');
  });

  it('retourne null sur marché inconnu', () => {
    expect(mapMarketNameToInternal('XYZ')).toBeNull();
    expect(mapMarketNameToInternal('')).toBeNull();
    expect(mapMarketNameToInternal(null)).toBeNull();
  });
});

describe('parseOddsResponse — Moneyline (ML) au format officiel', () => {
  it('extrait home/away depuis odds: [{home, away}]', () => {
    const raw = {
      id: 123456,
      bookmakers: {
        Pinnacle: [
          { name: 'ML', updatedAt: '2025-10-04T10:30:00Z', odds: [{ home: '1.91', away: '2.10' }] },
        ],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 123456, new Set(['h2h']), quotes);
    expect(quotes.length).toBe(2);
    const home = quotes.find((q) => q.outcome_label === 'home');
    const away = quotes.find((q) => q.outcome_label === 'away');
    expect(home.odds).toBe(1.91);
    expect(home.bookmaker).toBe('pinnacle');
    expect(away.odds).toBe(2.10);
    expect(home.market_key).toBe('h2h');
  });

  it('rejette ML 3-way (draw présent — 1X2 football)', () => {
    const raw = {
      id: 1,
      bookmakers: {
        'Betclic FR': [
          { name: 'ML', odds: [{ home: '1.80', draw: '4.00', away: '4.50' }] },
        ],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['h2h']), quotes);
    expect(quotes.length).toBe(0);
  });
});

describe('parseOddsResponse — Asian Handicap au format officiel', () => {
  it('extrait toutes les lignes hdp depuis odds: [{hdp, home, away}, ...]', () => {
    const raw = {
      id: 1,
      bookmakers: {
        Pinnacle: [
          {
            name: 'Asian Handicap',
            odds: [
              { hdp: -1.5, home: '1.91', away: '2.10' },
              { hdp: -1.0, home: '2.25', away: '1.60' },
              { hdp: 0,    home: '1.95', away: '1.95' },
            ],
          },
        ],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['spreads']), quotes);
    expect(quotes.length).toBe(6);

    const hdp15 = quotes.filter((q) => Math.abs(q.point) === 1.5);
    expect(hdp15.length).toBe(2);
    const home15 = hdp15.find((q) => q.outcome_label === 'home');
    const away15 = hdp15.find((q) => q.outcome_label === 'away');
    expect(home15.point).toBe(-1.5);
    expect(away15.point).toBe(1.5);
  });

  it('reconnaît aussi "Spread" comme marché spreads', () => {
    const raw = {
      id: 1,
      bookmakers: {
        Bet365: [
          { name: 'Spread', odds: [{ hdp: -2.5, home: '1.95', away: '1.85' }] },
        ],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['spreads']), quotes);
    expect(quotes.length).toBe(2);
  });

  it('skip les lignes sans valeur hdp', () => {
    const raw = {
      id: 1,
      bookmakers: {
        Pinnacle: [
          { name: 'Asian Handicap', odds: [{ home: '1.91', away: '2.10' }] },
        ],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['spreads']), quotes);
    expect(quotes.length).toBe(0);
  });
});

describe('parseOddsResponse — Totals au format officiel', () => {
  it('extrait Over/Under pour chaque ligne hdp', () => {
    const raw = {
      id: 1,
      bookmakers: {
        Pinnacle: [
          {
            name: 'Totals',
            odds: [
              { hdp: 2.5, over: '1.95', under: '1.87' },
              { hdp: 3.0, over: '2.20', under: '1.71' },
            ],
          },
        ],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['totals']), quotes);
    expect(quotes.length).toBe(4);
    const overs = quotes.filter((q) => q.outcome_label === 'over');
    expect(overs.length).toBe(2);
    expect(overs.find((q) => q.point === 2.5).odds).toBe(1.95);
  });
});

describe('parseOddsResponse — BTTS au format officiel', () => {
  it('extrait yes/no depuis odds: [{yes, no}]', () => {
    const raw = {
      id: 1,
      bookmakers: {
        Pinnacle: [
          { name: 'Both Teams to Score', odds: [{ yes: '1.85', no: '1.95' }] },
        ],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['btts']), quotes);
    expect(quotes.length).toBe(2);
    expect(quotes.find((q) => q.outcome_label === 'yes').odds).toBe(1.85);
  });
});

describe('parseOddsResponse — filtrage par wantedMarkets', () => {
  it('ignore les marchés non demandés', () => {
    const raw = {
      id: 1,
      bookmakers: {
        Pinnacle: [
          { name: 'ML', odds: [{ home: '1.91', away: '2.10' }] },
          { name: 'Totals', odds: [{ hdp: 2.5, over: '1.95', under: '1.87' }] },
        ],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['h2h']), quotes);
    expect(quotes.length).toBe(2);
    expect(quotes.every((q) => q.market_key === 'h2h')).toBe(true);
  });
});

describe('parseOddsResponse — canonicalisation des bookmakers', () => {
  it('mappe "Betclic FR" → "betclic"', () => {
    const raw = {
      id: 1,
      bookmakers: {
        'Betclic FR': [{ name: 'ML', odds: [{ home: '1.91', away: '2.10' }] }],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['h2h']), quotes);
    expect(quotes[0].bookmaker).toBe('betclic');
  });

  it('mappe "1xbet" → "onexbet"', () => {
    const raw = {
      id: 1,
      bookmakers: {
        '1xbet': [{ name: 'ML', odds: [{ home: '1.91', away: '2.10' }] }],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['h2h']), quotes);
    expect(quotes[0].bookmaker).toBe('onexbet');
  });

  it('plusieurs bookmakers dans le même event', () => {
    const raw = {
      id: 1,
      bookmakers: {
        Pinnacle: [{ name: 'ML', odds: [{ home: '1.91', away: '2.10' }] }],
        '1xbet':  [{ name: 'ML', odds: [{ home: '2.05', away: '1.95' }] }],
        Stake:    [{ name: 'ML', odds: [{ home: '2.00', away: '1.98' }] }],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['h2h']), quotes);
    expect(quotes.length).toBe(6);
    const bms = new Set(quotes.map((q) => q.bookmaker));
    expect(bms).toEqual(new Set(['pinnacle', 'onexbet', 'stake']));
  });
});

describe('normalizeEvent — champs date / sport / league', () => {
  it('lit raw.date (format officiel)', () => {
    const ev = normalizeEvent({
      id: 123456,
      home: 'Manchester United', away: 'Liverpool',
      date: '2025-10-15T15:00:00Z',
      status: 'pending',
      sport: { name: 'Football', slug: 'football' },
      league: { name: 'England - Premier League', slug: 'england-premier-league' },
    });
    expect(ev.id).toBe(123456);
    expect(ev.home_team).toBe('Manchester United');
    expect(ev.commence_time).toBe('2025-10-15T15:00:00Z');
    expect(ev.sport).toBe('football');
    expect(ev.league).toBe('England - Premier League');
    expect(ev.slug).toBe('england-premier-league');
    expect(ev.provider).toBe('oddsApiIo');
  });

  it('tolère sport/league sous forme de string', () => {
    const ev = normalizeEvent({
      id: 'x', home: 'A', away: 'B',
      date: '2026-01-01T00:00:00Z',
      sport: 'tennis',
      league: 'ATP French Open',
    });
    expect(ev.sport).toBe('tennis');
    expect(ev.league).toBe('ATP French Open');
  });

  it('tolère les alias commenceTime/startTime', () => {
    const ev = normalizeEvent({
      eventId: 'evt-2',
      homeTeam: 'Liverpool', awayTeam: 'Arsenal',
      startTime: '2026-01-01T00:00:00Z',
    });
    expect(ev.id).toBe('evt-2');
    expect(ev.commence_time).toBe('2026-01-01T00:00:00Z');
  });
});

describe('parseOddsResponse — robustesse', () => {
  it('ne plante pas sur entrée vide', () => {
    const quotes = [];
    parseOddsResponse(null, 'e1', new Set(), quotes);
    parseOddsResponse({}, 'e1', new Set(), quotes);
    parseOddsResponse({ bookmakers: {} }, 'e1', new Set(), quotes);
    expect(quotes.length).toBe(0);
  });

  it('ignore les cotes <= 1.0 (invalides)', () => {
    const raw = {
      id: 1,
      bookmakers: {
        Pinnacle: [{ name: 'ML', odds: [{ home: '0.5', away: '2.10' }] }],
      },
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['h2h']), quotes);
    expect(quotes.length).toBe(1);
    expect(quotes[0].outcome_label).toBe('away');
  });

  it('tolère la forme array (fallback historique)', () => {
    // Forme alternative : bookmakers est un array de {id|name, markets: [...]}
    const raw = {
      id: 1,
      bookmakers: [
        {
          name: 'Pinnacle',
          markets: [
            { name: 'ML', odds: [{ home: '1.91', away: '2.10' }] },
          ],
        },
      ],
    };
    const quotes = [];
    parseOddsResponse(raw, 1, new Set(['h2h']), quotes);
    expect(quotes.length).toBe(2);
    expect(quotes[0].bookmaker).toBe('pinnacle');
  });
});

// ─── Test E2E : getOdds avec axios mocké ────────────────────────────────────
describe('getOdds — pipeline E2E avec format API réel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSelectedCache();
  });

  // Mock du /bookmakers/selected : par défaut tous les bookmakers cibles
  // sont autorisés pour ne pas casser les tests existants.
  function mockBookmakersSelected(list = ['Stake', 'Betclic FR', '1xbet']) {
    axios.get.mockImplementationOnce(async (url) => {
      expect(url).toBe('https://api.odds-api.io/v3/bookmakers/selected');
      return { data: { bookmakers: list, count: list.length }, headers: {} };
    });
  }

  it('appelle /events avec status=pending,live puis /odds/multi avec format officiel', async () => {
    // 1er appel : /events → renvoie 2 events
    axios.get.mockImplementationOnce(async (url, opts) => {
      expect(url).toBe('https://api.odds-api.io/v3/events');
      expect(opts.params.status).toBe('pending,live');
      expect(opts.params.sport).toBe('football');
      expect(opts.params.league).toBe('england-premier-league');
      return {
        data: [
          {
            id: 100, home: 'Manchester United', away: 'Liverpool',
            date: '2025-10-15T15:00:00Z', status: 'pending',
            sport: { slug: 'football' },
            league: { slug: 'england-premier-league', name: 'EPL' },
          },
          {
            id: 101, home: 'Arsenal', away: 'Chelsea',
            date: '2025-10-16T17:00:00Z', status: 'pending',
            sport: { slug: 'football' },
            league: { slug: 'england-premier-league', name: 'EPL' },
          },
        ],
        headers: {},
      };
    });

    // 2e appel : /bookmakers/selected (autorise Stake + Betclic FR)
    mockBookmakersSelected(['Stake', 'Betclic FR']);

    // 3e appel : /odds/multi → renvoie les cotes des 2 events
    axios.get.mockImplementationOnce(async (url, opts) => {
      expect(url).toBe('https://api.odds-api.io/v3/odds/multi');
      expect(opts.params.eventIds).toBe('100,101');
      // Pinnacle est filtré (non supporté par Odds-API.io) ; Stake et Betclic FR passent.
      expect(opts.params.bookmakers).toContain('Stake');
      expect(opts.params.bookmakers).toContain('Betclic FR');
      expect(opts.params.bookmakers).not.toContain('Pinnacle');
      return {
        data: [
          {
            id: 100,
            bookmakers: {
              Stake: [
                { name: 'ML', odds: [{ home: '1.91', away: '2.10' }] },
                { name: 'Asian Handicap', odds: [{ hdp: -1.5, home: '1.91', away: '2.10' }] },
                { name: 'Totals', odds: [{ hdp: 2.5, over: '1.95', under: '1.87' }] },
              ],
              'Betclic FR': [
                { name: 'ML', odds: [{ home: '2.05', away: '1.95' }] },
              ],
            },
          },
          {
            id: 101,
            bookmakers: {
              Stake: [
                { name: 'ML', odds: [{ home: '1.80', away: '2.20' }] },
              ],
            },
          },
        ],
        headers: {},
      };
    });

    const result = await getOdds({
      sport: 'football',
      leagueSlug: 'england-premier-league',
      bookmakers: ['Pinnacle', 'Stake', 'Betclic FR'],
      markets: ['h2h', 'spreads', 'totals'],
    });

    expect(result.events.length).toBe(2);
    expect(result.events[0].home_team).toBe('Manchester United');
    expect(result.events[0].commence_time).toBe('2025-10-15T15:00:00Z');

    // Quotes attendues :
    //   event 100 : stake ML (2), stake spreads (2), stake totals (2), betclic ML (2)
    //   event 101 : stake ML (2)
    expect(result.quotes.length).toBe(10);

    const ev100h2h = result.quotes.filter((q) => q.event_id === 100 && q.market_key === 'h2h');
    expect(ev100h2h.length).toBe(4);
    const ev100spreads = result.quotes.filter((q) => q.event_id === 100 && q.market_key === 'spreads');
    expect(ev100spreads.length).toBe(2);
    expect(ev100spreads.find((q) => q.outcome_label === 'home').point).toBe(-1.5);
    expect(ev100spreads.find((q) => q.outcome_label === 'away').point).toBe(1.5);

    // Les bookmakers ont bien été canonicalisés
    const bms = new Set(result.quotes.map((q) => q.bookmaker));
    expect(bms.has('stake')).toBe(true);
    expect(bms.has('betclic')).toBe(true);
  });

  it('liste blanche : Pinnacle et Everygame ne sont PAS supportés par Odds-API.io', () => {
    // Vérifié via GET https://api.odds-api.io/v3/bookmakers le 2026-05-19.
    expect(ODDS_API_IO_SUPPORTED_BOOKMAKERS.has('Pinnacle')).toBe(false);
    expect(ODDS_API_IO_SUPPORTED_BOOKMAKERS.has('Everygame')).toBe(false);
    // Les 11 autres cibles SONT supportées
    ['Betclic FR', 'NetBet', 'Unibet FR', 'PMU', 'Winamax FR',
     'Betfair Exchange', '888Sport', '1xbet', 'BetOnline.ag', 'BC.Game', 'Stake']
      .forEach((bm) => expect(ODDS_API_IO_SUPPORTED_BOOKMAKERS.has(bm)).toBe(true));
  });

  it('retourne {events:[], quotes:[]} quand /events renvoie []', async () => {
    axios.get.mockResolvedValueOnce({ data: [], headers: {} });
    const result = await getOdds({ sport: 'football', leagueSlug: 'unknown-league' });
    expect(result.events).toEqual([]);
    expect(result.quotes).toEqual([]);
  });

  it('utilise la liste TARGET_BOOKMAKERS si bookmakers non fourni', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ id: 1, home: 'A', away: 'B', date: '2026-01-01T00:00:00Z', sport: { slug: 'football' } }],
      headers: {},
    });
    mockBookmakersSelected(['Stake', 'Betclic FR']);
    axios.get.mockImplementationOnce(async (url, opts) => {
      // Doit contenir Stake et Betclic FR (cibles supportées ET autorisées par le plan),
      // mais PAS Pinnacle/Everygame (non supportés par Odds-API.io).
      expect(opts.params.bookmakers).toContain('Stake');
      expect(opts.params.bookmakers).toContain('Betclic FR');
      expect(opts.params.bookmakers).not.toContain('Pinnacle');
      expect(opts.params.bookmakers).not.toContain('Everygame');
      return { data: [], headers: {} };
    });
    await getOdds({ sport: 'football' });
  });

  it('respecte la limite des bookmakers sélectionnés côté plan Odds-API.io', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ id: 1, home: 'A', away: 'B', date: '2026-01-01T00:00:00Z', sport: { slug: 'football' } }],
      headers: {},
    });
    // Plan limité : seuls Stake et 1xbet sont autorisés
    mockBookmakersSelected(['Stake', '1xbet']);
    axios.get.mockImplementationOnce(async (url, opts) => {
      expect(opts.params.bookmakers).toBe('Stake,1xbet');
      return { data: [], headers: {} };
    });
    await getOdds({
      sport: 'football',
      bookmakers: ['Betclic FR', 'Stake', '1xbet', 'Unibet FR'],
    });
  });

  it('skip propre quand aucun bookmaker n’est dans le plan', async () => {
    axios.get.mockResolvedValueOnce({
      data: [{ id: 1, home: 'A', away: 'B', date: '2026-01-01T00:00:00Z', sport: { slug: 'football' } }],
      headers: {},
    });
    // Plan limité à des bookmakers non demandés
    mockBookmakersSelected(['Bet365', 'Pinnacle']);
    const result = await getOdds({
      sport: 'football',
      bookmakers: ['Betclic FR', 'Stake'],
    });
    expect(result.quotes).toEqual([]);
  });
});
