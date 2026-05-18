/**
 * Tests de filtrage strict des totaux (over/under).
 */
import { describe, it, expect } from 'vitest';
import { findOpportunities } from '../src/core/arbitrageEngine.js';

const event = [{ id: 'e1', sport: 'soccer_epl', league: 'EPL', label: 'Test', commence_time: null }];

describe('arbitrageEngine — totals strict line matching', () => {
  it('REJETTE Over 2.5 vs Under 3.0 (lignes différentes)', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'totals', outcome_label: 'over',  odds: 2.10, point: 2.5 },
      { event_id: 'e1', bookmaker: 'onexbet',  market_key: 'totals', outcome_label: 'under', odds: 1.90, point: 3.0 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  it('ACCEPTE Over 2.5 vs Under 2.5 (même ligne)', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'totals', outcome_label: 'over',  odds: 2.10, point: 2.5 },
      { event_id: 'e1', bookmaker: 'sport888', market_key: 'totals', outcome_label: 'under', odds: 2.10, point: 2.5 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0].line).toBe(2.5);
  });

  it('Accepte plusieurs lignes parallèles (2.5 ET 3.0)', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'totals', outcome_label: 'over',  odds: 2.20, point: 2.5 },
      { event_id: 'e1', bookmaker: 'sport888', market_key: 'totals', outcome_label: 'under', odds: 2.10, point: 2.5 },
      { event_id: 'e1', bookmaker: 'betclic',  market_key: 'totals', outcome_label: 'over',  odds: 2.15, point: 3.0 },
      { event_id: 'e1', bookmaker: 'onexbet',  market_key: 'totals', outcome_label: 'under', odds: 2.15, point: 3.0 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBe(2);
    const lines = opps.map((o) => o.line).sort();
    expect(lines).toEqual([2.5, 3.0]);
  });

  it('REJETTE Under 2.5 chez bookA et Over 3.0 chez bookB', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'totals', outcome_label: 'under', odds: 2.10, point: 2.5 },
      { event_id: 'e1', bookmaker: 'onexbet',  market_key: 'totals', outcome_label: 'over',  odds: 2.10, point: 3.0 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  it('rejette une quote totals avec point null', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'totals', outcome_label: 'over',  odds: 2.10, point: null },
      { event_id: 'e1', bookmaker: 'sport888', market_key: 'totals', outcome_label: 'under', odds: 2.10, point: 2.5 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  it('libellé de marché contient la valeur de la ligne', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'pinnacle', market_key: 'totals', outcome_label: 'over',  odds: 2.10, point: 2.5 },
      { event_id: 'e1', bookmaker: 'sport888', market_key: 'totals', outcome_label: 'under', odds: 2.10, point: 2.5 },
    ];
    const opps = findOpportunities(quotes, event, 100, {}, 'multi');
    expect(opps[0].market_label).toMatch(/Total/);
    expect(opps[0].market_label).toMatch(/2\.5/);
  });
});
