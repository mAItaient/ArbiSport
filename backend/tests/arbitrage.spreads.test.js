/**
 * Tests de filtrage strict des lignes de handicap (spreads).
 *
 * Cas critique constaté en prod : 1xBet handicap baseball
 *   1 (-1.5) 2.66 / 2 (+1.5) 1.43
 *   1 (-1.0) 2.25 / 2 (+1.0) 1.60
 *
 * Le système ne doit JAMAIS combiner pinnacle home(-1.5) avec onexbet home(-1.0).
 */
import { describe, it, expect } from 'vitest';
import { findOpportunities } from '../src/core/arbitrageEngine.js';

const event = [{ id: 'e1', sport: 'baseball_mlb', league: 'MLB', label: 'Test', commence_time: null }];

describe('arbitrageEngine — spreads strict line matching', () => {
  it('REJETTE pinnacle(-1.5) vs onexbet(-1.0) (lignes différentes même côté)', () => {
    const quotes = [
      // Pinnacle propose home -1.5 et away +1.5 (mais on simule une absence)
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'spreads', outcome_label: 'home', odds: 1.91, point: -1.5 },
      { event_id: 'e1', bookmaker: 'onexbet',  market_key: 'spreads', outcome_label: 'home', odds: 2.25, point: -1.0 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  it('ACCEPTE pinnacle home(-1.5) vs sport888 away(+1.5) (ligne opposée même magnitude)', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'spreads', outcome_label: 'home', odds: 2.20, point: -1.5 },
      { event_id: 'e1', bookmaker: 'sport888', market_key: 'spreads', outcome_label: 'away', odds: 2.10, point: +1.5 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0].line).toBeCloseTo(1.5, 5);
  });

  it('rejette pinnacle home(-1.5) vs sport888 away(+1.0) (magnitudes différentes)', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'spreads', outcome_label: 'home', odds: 1.91, point: -1.5 },
      { event_id: 'e1', bookmaker: 'sport888', market_key: 'spreads', outcome_label: 'away', odds: 2.10, point: +1.0 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  it('accepte 2 lignes parallèles indépendantes (-1.5/+1.5 ET -1.0/+1.0)', () => {
    const quotes = [
      // ligne 1.5 — arb possible
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'spreads', outcome_label: 'home', odds: 2.20, point: -1.5 },
      { event_id: 'e1', bookmaker: 'sport888', market_key: 'spreads', outcome_label: 'away', odds: 2.10, point: +1.5 },
      // ligne 1.0 — arb possible
      { event_id: 'e1', bookmaker: 'betclic_fr', market_key: 'spreads', outcome_label: 'home', odds: 2.15, point: -1.0 },
      { event_id: 'e1', bookmaker: 'onexbet',    market_key: 'spreads', outcome_label: 'away', odds: 2.15, point: +1.0 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBe(2);
    const lines = opps.map((o) => o.line).sort();
    expect(lines).toEqual([1.0, 1.5]);
  });

  it('rejette les opportunités croisées entre deux lignes différentes', () => {
    // Cas représentatif du bug visible chez l'utilisateur :
    //   pinnacle home -1.5 + onexbet away +1.0 ne doit JAMAIS se combiner.
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'spreads', outcome_label: 'home', odds: 1.91, point: -1.5 },
      { event_id: 'e1', bookmaker: 'onexbet',  market_key: 'spreads', outcome_label: 'away', odds: 2.10, point: +1.0 },
      { event_id: 'e1', bookmaker: 'betclic',  market_key: 'spreads', outcome_label: 'away', odds: 1.60, point: +1.0 },
      { event_id: 'e1', bookmaker: 'sport888', market_key: 'spreads', outcome_label: 'home', odds: 2.25, point: -1.0 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    // Seules combinaisons valides : sport888(-1.0) + onexbet(+1.0), sport888(-1.0) + betclic(+1.0).
    for (const o of opps) {
      expect(o.line).toBe(1.0);
    }
  });

  it('rejette une quote avec point manquant', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'spreads', outcome_label: 'home', odds: 1.91, point: null },
      { event_id: 'e1', bookmaker: 'sport888', market_key: 'spreads', outcome_label: 'away', odds: 2.10, point: +1.5 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  it('le label d\'affichage de la ligne est explicite (Handicap)', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'spreads', outcome_label: 'home', odds: 2.20, point: -1.5 },
      { event_id: 'e1', bookmaker: 'sport888', market_key: 'spreads', outcome_label: 'away', odds: 2.10, point: +1.5 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps[0].market_label).toMatch(/Handicap/);
  });

  it('rejette home(-1.5) + home(+1.5) (même côté, même bookmaker interdit)', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'spreads', outcome_label: 'home', odds: 1.91, point: -1.5 },
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'spreads', outcome_label: 'home', odds: 2.10, point: +1.5 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });
});
