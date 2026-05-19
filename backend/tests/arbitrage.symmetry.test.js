/**
 * Tests de symétrie stricte des marchés 2-way (spec section 3).
 *
 * Couvre les huit cas explicitement demandés dans
 * spec_fix_matcher_symmetry.md pour empêcher que de fausses opportunités
 * Spreads/Totals/H2H réapparaissent en production.
 */
import { describe, it, expect } from 'vitest';
import { findOpportunities } from '../src/core/arbitrageEngine.js';

const eventBaseball = [
  { id: 'evt-symmetry', sport: 'baseball_mlb', league: 'MLB', label: 'Test', commence_time: null },
];
const eventFoot = [
  { id: 'evt-symmetry', sport: 'soccer_epl', league: 'Premier', label: 'Test', commence_time: null },
];

const baseSpread = {
  event_id: 'evt-symmetry',
  market_key: 'spreads',
};
const baseTotal = {
  event_id: 'evt-symmetry',
  market_key: 'totals',
};
const baseH2h = {
  event_id: 'evt-symmetry',
  market_key: 'h2h',
};

describe('arbitrageEngine — règles de symétrie 2-way (spec)', () => {
  // ─────── Spreads / Handicap ───────
  it('Spread home@+1 vs away@−1 → MATCH (signes opposés, |H| identique)', () => {
    const quotes = [
      { ...baseSpread, bookmaker: 'onexbet', outcome_label: 'home', odds: 2.20, point: +1 },
      { ...baseSpread, bookmaker: 'stake',   outcome_label: 'away', odds: 2.10, point: -1 },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBeGreaterThan(0);
  });

  it('Spread home@+1 vs away@+1 → REJET (même point, non couvrant)', () => {
    const quotes = [
      { ...baseSpread, bookmaker: 'onexbet', outcome_label: 'home', odds: 3.28, point: +1 },
      { ...baseSpread, bookmaker: 'stake',   outcome_label: 'away', odds: 1.47, point: +1 },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  it('Spread home@+2 vs home@+2 (même côté) → REJET', () => {
    const quotes = [
      { ...baseSpread, bookmaker: 'onexbet', outcome_label: 'home', odds: 5.70,  point: +2 },
      { ...baseSpread, bookmaker: 'stake',   outcome_label: 'home', odds: 25.00, point: +2 },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  it('Spread home@+1.5 vs away@−1.5 (quart de point Asian) → MATCH valide', () => {
    const quotes = [
      { ...baseSpread, bookmaker: 'pinnacle', outcome_label: 'home', odds: 2.05, point: +1.5 },
      { ...baseSpread, bookmaker: 'sport888', outcome_label: 'away', odds: 2.15, point: -1.5 },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0].line).toBeCloseTo(1.5, 5);
  });

  it('Spread home@+0.25 vs away@−0.25 (Asian quart) → MATCH', () => {
    const quotes = [
      { ...baseSpread, bookmaker: 'pinnacle', outcome_label: 'home', odds: 2.05, point: +0.25 },
      { ...baseSpread, bookmaker: 'sport888', outcome_label: 'away', odds: 2.15, point: -0.25 },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBeGreaterThan(0);
  });

  it('Spread away@−1 vs away@+1 (même label, signes opposés) → REJET', () => {
    // Deux quotes "away" : la garde-fou label A === label B doit rejeter.
    const quotes = [
      { ...baseSpread, bookmaker: 'onexbet', outcome_label: 'away', odds: 2.10, point: -1 },
      { ...baseSpread, bookmaker: 'stake',   outcome_label: 'away', odds: 2.10, point: +1 },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  // ─────── Totals ───────
  it('Totals Over@2.5 vs Under@2.5 → MATCH valide', () => {
    const quotes = [
      { ...baseTotal, bookmaker: 'pinnacle', outcome_label: 'over',  odds: 2.10, point: 2.5 },
      { ...baseTotal, bookmaker: 'sport888', outcome_label: 'under', odds: 2.10, point: 2.5 },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBeGreaterThan(0);
  });

  it('Totals Over@2.5 vs Under@3.0 → REJET (points différents)', () => {
    const quotes = [
      { ...baseTotal, bookmaker: 'pinnacle', outcome_label: 'over',  odds: 2.10, point: 2.5 },
      { ...baseTotal, bookmaker: 'sport888', outcome_label: 'under', odds: 2.10, point: 3.0 },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  // ─────── Moneyline (H2H) ───────
  it('ML home vs away sans nul (tennis/basket) → MATCH', () => {
    const quotes = [
      { ...baseH2h, bookmaker: 'pinnacle', outcome_label: 'home', odds: 2.10, point: null },
      { ...baseH2h, bookmaker: 'sport888', outcome_label: 'away', odds: 2.10, point: null },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBeGreaterThan(0);
  });

  it('ML avec draw renseigné (football 1X2) → REJET intégral', () => {
    // 3 issues mutuellement exclusives → on rejette tout le marché.
    const quotes = [
      { ...baseH2h, bookmaker: 'pinnacle', outcome_label: 'home', odds: 2.50, point: null },
      { ...baseH2h, bookmaker: 'pinnacle', outcome_label: 'draw', odds: 3.20, point: null },
      { ...baseH2h, bookmaker: 'pinnacle', outcome_label: 'away', odds: 3.00, point: null },
      { ...baseH2h, bookmaker: 'sport888', outcome_label: 'home', odds: 2.55, point: null },
      { ...baseH2h, bookmaker: 'sport888', outcome_label: 'draw', odds: 3.30, point: null },
      { ...baseH2h, bookmaker: 'sport888', outcome_label: 'away', odds: 3.10, point: null },
    ];
    const opps = findOpportunities(quotes, eventFoot, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  // ─────── Anti-faux positif issu du screenshot utilisateur ───────
  it('reproduit le bug Chelsea +2 home(5.70) vs home(25.00) → 0 opportunités', () => {
    // Le screenshot d'origine montrait deux fois "home@+2" appariés. Doit échouer.
    const quotes = [
      { ...baseSpread, bookmaker: 'onexbet', outcome_label: 'home', odds: 5.70,  point: +2 },
      { ...baseSpread, bookmaker: 'stake',   outcome_label: 'home', odds: 25.00, point: +2 },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });

  it('reproduit le bug Chelsea +1 home(3.28) vs away(1.47) au même point → 0 opportunités', () => {
    const quotes = [
      { ...baseSpread, bookmaker: 'onexbet', outcome_label: 'home', odds: 3.28, point: +1 },
      { ...baseSpread, bookmaker: 'stake',   outcome_label: 'away', odds: 1.47, point: +1 },
    ];
    const opps = findOpportunities(quotes, eventBaseball, 100, {}, 'multi');
    expect(opps.length).toBe(0);
  });
});
