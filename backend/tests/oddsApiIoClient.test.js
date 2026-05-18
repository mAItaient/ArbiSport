/**
 * Tests du client Odds-API.io (parsing + mapping de marchés).
 * Pas de réseau : on teste les fonctions pures de transformation.
 */
import { describe, it, expect } from 'vitest';
import {
  parseOddsResponse,
  mapMarketNameToInternal,
  normalizeEvent,
} from '../src/integrations/oddsApiIoClient.js';

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

describe('parseOddsResponse — Moneyline (h2h)', () => {
  it('extrait home/away pour ML 2-way', () => {
    const raw = {
      id: 'e1',
      bookmakers: [
        { id: 'Pinnacle', markets: { 'ML': { home: '1.91', away: '2.10' } } },
      ],
    };
    const quotes = [];
    parseOddsResponse(raw, 'e1', new Set(['h2h']), quotes);
    expect(quotes.length).toBe(2);
    const home = quotes.find((q) => q.outcome_label === 'home');
    const away = quotes.find((q) => q.outcome_label === 'away');
    expect(home.odds).toBe(1.91);
    expect(home.bookmaker).toBe('pinnacle');
    expect(away.odds).toBe(2.10);
    expect(home.market_key).toBe('h2h');
  });

  it('rejette ML à 3 issues (draw présent — 1X2 football)', () => {
    const raw = {
      id: 'e1',
      bookmakers: [
        { id: 'Betclic FR', markets: { 'ML': { home: '1.80', draw: '4.00', away: '4.50' } } },
      ],
    };
    const quotes = [];
    parseOddsResponse(raw, 'e1', new Set(['h2h']), quotes);
    // 3-way → on ignore complètement
    expect(quotes.length).toBe(0);
  });
});

describe('parseOddsResponse — Asian Handicap', () => {
  it('extrait toutes les lignes hdp séparément', () => {
    const raw = {
      id: 'e1',
      bookmakers: [
        {
          id: 'Pinnacle',
          markets: {
            'Asian Handicap': [
              { hdp: -1.5, home: '1.91', away: '2.10' },
              { hdp: -1.0, home: '2.25', away: '1.60' },
              { hdp: 0,    home: '1.95', away: '1.95' },
            ],
          },
        },
      ],
    };
    const quotes = [];
    parseOddsResponse(raw, 'e1', new Set(['spreads']), quotes);
    expect(quotes.length).toBe(6);

    const hdp15 = quotes.filter((q) => Math.abs(q.point) === 1.5);
    expect(hdp15.length).toBe(2);
    const home15 = hdp15.find((q) => q.outcome_label === 'home');
    const away15 = hdp15.find((q) => q.outcome_label === 'away');
    expect(home15.point).toBe(-1.5);
    expect(away15.point).toBe(1.5);
  });

  it('skip les lignes sans valeur hdp', () => {
    const raw = {
      id: 'e1',
      bookmakers: [
        {
          id: 'Pinnacle',
          markets: { 'Asian Handicap': [{ home: '1.91', away: '2.10' }] },
        },
      ],
    };
    const quotes = [];
    parseOddsResponse(raw, 'e1', new Set(['spreads']), quotes);
    expect(quotes.length).toBe(0);
  });
});

describe('parseOddsResponse — Totals', () => {
  it('extrait Over/Under pour chaque ligne de point', () => {
    const raw = {
      id: 'e1',
      bookmakers: [
        {
          id: 'Pinnacle',
          markets: {
            'Totals': [
              { point: 2.5, over: '1.95', under: '1.87' },
              { point: 3.0, over: '2.20', under: '1.71' },
            ],
          },
        },
      ],
    };
    const quotes = [];
    parseOddsResponse(raw, 'e1', new Set(['totals']), quotes);
    expect(quotes.length).toBe(4);
    const overs = quotes.filter((q) => q.outcome_label === 'over');
    expect(overs.length).toBe(2);
    expect(overs.find((q) => q.point === 2.5).odds).toBe(1.95);
  });
});

describe('parseOddsResponse — BTTS', () => {
  it('extrait yes/no', () => {
    const raw = {
      id: 'e1',
      bookmakers: [
        { id: 'Pinnacle', markets: { 'Both Teams to Score': { yes: '1.85', no: '1.95' } } },
      ],
    };
    const quotes = [];
    parseOddsResponse(raw, 'e1', new Set(['btts']), quotes);
    expect(quotes.length).toBe(2);
    expect(quotes.find((q) => q.outcome_label === 'yes').odds).toBe(1.85);
  });
});

describe('parseOddsResponse — filtrage par wantedMarkets', () => {
  it('ignore les marchés non demandés', () => {
    const raw = {
      id: 'e1',
      bookmakers: [
        {
          id: 'Pinnacle',
          markets: {
            'ML': { home: '1.91', away: '2.10' },
            'Totals': [{ point: 2.5, over: '1.95', under: '1.87' }],
          },
        },
      ],
    };
    const quotes = [];
    parseOddsResponse(raw, 'e1', new Set(['h2h']), quotes);
    // On ne veut que h2h, donc seulement 2 quotes (pas les totals)
    expect(quotes.length).toBe(2);
    expect(quotes.every((q) => q.market_key === 'h2h')).toBe(true);
  });
});

describe('parseOddsResponse — bookmaker canonicalisation', () => {
  it('mappe "Betclic FR" → "betclic"', () => {
    const raw = {
      id: 'e1',
      bookmakers: [{ id: 'Betclic FR', markets: { 'ML': { home: '1.91', away: '2.10' } } }],
    };
    const quotes = [];
    parseOddsResponse(raw, 'e1', new Set(['h2h']), quotes);
    expect(quotes[0].bookmaker).toBe('betclic');
  });

  it('mappe "1xbet" → "onexbet"', () => {
    const raw = {
      id: 'e1',
      bookmakers: [{ id: '1xbet', markets: { 'ML': { home: '1.91', away: '2.10' } } }],
    };
    const quotes = [];
    parseOddsResponse(raw, 'e1', new Set(['h2h']), quotes);
    expect(quotes[0].bookmaker).toBe('onexbet');
  });
});

describe('normalizeEvent', () => {
  it('normalise un event Odds-API.io', () => {
    const ev = normalizeEvent({
      id: 'evt-1',
      sport: 'football',
      league: 'Premier League',
      home: 'PSG',
      away: 'Marseille',
      commenceTime: '2026-06-15T19:00:00Z',
      slug: 'psg-vs-marseille',
    });
    expect(ev.id).toBe('evt-1');
    expect(ev.home_team).toBe('PSG');
    expect(ev.label).toBe('PSG vs Marseille');
    expect(ev.provider).toBe('oddsApiIo');
  });

  it('tolère champs alternatifs (homeTeam au lieu de home)', () => {
    const ev = normalizeEvent({
      eventId: 'evt-2',
      homeTeam: 'Liverpool', awayTeam: 'Arsenal',
      startTime: '2026-01-01T00:00:00Z',
    });
    expect(ev.id).toBe('evt-2');
    expect(ev.home_team).toBe('Liverpool');
    expect(ev.commence_time).toBe('2026-01-01T00:00:00Z');
  });
});

describe('parseOddsResponse — robustesse', () => {
  it('ne plante pas sur entrée vide', () => {
    const quotes = [];
    parseOddsResponse(null, 'e1', new Set(), quotes);
    parseOddsResponse({}, 'e1', new Set(), quotes);
    parseOddsResponse({ bookmakers: [] }, 'e1', new Set(), quotes);
    expect(quotes.length).toBe(0);
  });

  it('ignore les cotes <= 1.0 (invalides)', () => {
    const raw = {
      id: 'e1',
      bookmakers: [{ id: 'Pinnacle', markets: { 'ML': { home: '0.5', away: '2.10' } } }],
    };
    const quotes = [];
    parseOddsResponse(raw, 'e1', new Set(['h2h']), quotes);
    // Seule la cote valide passe
    expect(quotes.length).toBe(1);
    expect(quotes[0].outcome_label).toBe('away');
  });
});
