/**
 * Tests unitaires du moteur d'arbitrage 2-way.
 */
import { describe, it, expect } from 'vitest';
import { isArb, computeStakes, findOpportunities } from '../src/core/arbitrageEngine.js';

describe('isArb', () => {
  it('détecte un arbitrage valide (oA=2.10, oB=2.10)', () => {
    // S = 1/2.10 + 1/2.10 = 0.476 + 0.476 = 0.952 < 1 → arbitrage
    expect(isArb(2.10, 2.10)).toBe(true);
  });

  it('détecte un arbitrage avec cotes asymétriques (oA=2.05, oB=2.20)', () => {
    // S = 1/2.05 + 1/2.20 = 0.4878 + 0.4545 = 0.9423 < 1 → arbitrage
    expect(isArb(2.05, 2.20)).toBe(true);
  });

  it('rejette quand S = 1 exactement (oA=2.0, oB=2.0)', () => {
    // S = 1/2.0 + 1/2.0 = 0.5 + 0.5 = 1.0 → pas d'arbitrage
    expect(isArb(2.0, 2.0)).toBe(false);
  });

  it('rejette quand S > 1 (marché avec marge bookmaker)', () => {
    // S = 1/1.9 + 1/1.9 = 0.526 + 0.526 = 1.052 > 1 → pas d'arbitrage
    expect(isArb(1.9, 1.9)).toBe(false);
  });

  it('rejette les cotes <= 1.0', () => {
    expect(isArb(1.0, 2.5)).toBe(false);
    expect(isArb(0.5, 2.5)).toBe(false);
    expect(isArb(2.5, 0.9)).toBe(false);
  });

  it('rejette les cotes nulles ou undefined', () => {
    expect(isArb(null, 2.5)).toBe(false);
    expect(isArb(undefined, 2.5)).toBe(false);
    expect(isArb(2.5, null)).toBe(false);
    expect(isArb(0, 2.5)).toBe(false);
  });

  it('détecte un arbitrage clair avec cotes élevées', () => {
    // S = 1/3.0 + 1/3.0 = 0.333 + 0.333 = 0.666 < 1 → arbitrage évident
    expect(isArb(3.0, 3.0)).toBe(true);
  });
});

describe('computeStakes', () => {
  it('calcule les mises correctes pour oA=oB=2.10, T=100', () => {
    const result = computeStakes(2.10, 2.10, 100);
    expect(result).not.toBeNull();

    // Vérif que la somme des mises ≈ T (avec tolérance floating point)
    expect(result.stakeA + result.stakeB).toBeCloseTo(100, 1);

    // Profits > 0
    expect(result.profitA).toBeGreaterThan(0);
    expect(result.profitB).toBeGreaterThan(0);

    // ROI > 0
    expect(result.roi).toBeGreaterThan(0);

    // Profits approximativement égaux (cotes symétriques)
    expect(Math.abs(result.profitA - result.profitB)).toBeLessThan(0.01);

    // ROI attendu : environ 4.76% pour 2.10/2.10
    // gainMin = 100 * (1 - 1/(1/2.10+1/2.10)) ≈ 4.76
    // En fait : ROI = (1/S - 1) * 100 = (1/0.9524 - 1) * 100 ≈ 5%
    expect(result.roi).toBeGreaterThan(4);
    expect(result.roi).toBeLessThan(6);
  });

  it('retourne null pour une situation sans arbitrage (oA=oB=2.0)', () => {
    // S = 1.0 exactement → pas d'arbitrage
    const result = computeStakes(2.0, 2.0, 100);
    expect(result).toBeNull();
  });

  it('retourne null pour S > 1 (oA=oB=1.9)', () => {
    const result = computeStakes(1.9, 1.9, 100);
    expect(result).toBeNull();
  });

  it('garantit profitA > 0 et profitB > 0 quand arb', () => {
    const result = computeStakes(2.10, 2.10, 100);
    expect(result.profitA).toBeGreaterThan(0);
    expect(result.profitB).toBeGreaterThan(0);
  });

  it('la somme stakeA + stakeB est environ égale à T', () => {
    for (const [oA, oB, T] of [[2.5, 2.0, 200], [3.0, 4.0, 500], [2.1, 2.3, 1000]]) {
      const r = computeStakes(oA, oB, T);
      if (r) {
        expect(r.stakeA + r.stakeB).toBeCloseTo(T, 0);
      }
    }
  });

  it('calcule un ROI positif pour une vraie opportunité', () => {
    // Exemple classique : oA=2.10, oB=2.10 → ROI ~5%
    const r = computeStakes(2.10, 2.10, 100);
    expect(r).not.toBeNull();
    expect(r.roi).toBeGreaterThan(0);
    expect(r.gainMin).toBeGreaterThan(0);
    expect(r.gainMinPct).toBeGreaterThan(0);
  });

  it('fonctionne avec une mise asymétrique (oA=1.50, oB=5.00)', () => {
    // S = 1/1.5 + 1/5.0 = 0.667 + 0.2 = 0.867 < 1 → arbitrage
    const result = computeStakes(1.50, 5.00, 100);
    expect(result).not.toBeNull();
    expect(result.stakeA + result.stakeB).toBeCloseTo(100, 0);
    expect(result.profitA).toBeGreaterThan(0);
    expect(result.profitB).toBeGreaterThan(0);
  });
});

describe('findOpportunities', () => {
  it('trouve des opportunités dans un jeu de données valide', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'bookA', market_key: 'h2h', outcome_label: 'TeamX', odds: 2.10, point: null },
      { event_id: 'e1', bookmaker: 'bookB', market_key: 'h2h', outcome_label: 'TeamX', odds: 1.90, point: null },
      { event_id: 'e1', bookmaker: 'bookA', market_key: 'h2h', outcome_label: 'TeamY', odds: 1.90, point: null },
      { event_id: 'e1', bookmaker: 'bookB', market_key: 'h2h', outcome_label: 'TeamY', odds: 2.10, point: null },
    ];

    const events = [{
      id: 'e1', sport: 'soccer', league: 'EPL',
      label: 'TeamX vs TeamY', commence_time: null,
    }];

    // oA=2.10 (bookA sur TeamX) + oB=2.10 (bookB sur TeamY) → arb
    const opps = findOpportunities(quotes, events, 100, {}, 'theOddsApi');
    expect(opps.length).toBeGreaterThan(0);
    const arb = opps.find(o => o.bookmaker_a === 'bookA' && o.bookmaker_b === 'bookB');
    expect(arb).toBeDefined();
    expect(arb.roi).toBeGreaterThan(0);
  });

  it('ignore les opportunités avec deux bookmakers identiques', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'bookA', market_key: 'h2h', outcome_label: 'TeamX', odds: 2.10, point: null },
      { event_id: 'e1', bookmaker: 'bookA', market_key: 'h2h', outcome_label: 'TeamY', odds: 2.10, point: null },
    ];
    const events = [{ id: 'e1', sport: 'soccer', league: 'EPL', label: 'Test' }];
    const opps = findOpportunities(quotes, events, 100, {});
    expect(opps.length).toBe(0);
  });

  it('respecte le filtre minRoiPct', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'bookA', market_key: 'h2h', outcome_label: 'Home', odds: 2.10, point: null },
      { event_id: 'e1', bookmaker: 'bookB', market_key: 'h2h', outcome_label: 'Away', odds: 2.10, point: null },
    ];
    const events = [{ id: 'e1', sport: 'soccer', league: 'EPL', label: 'Test' }];

    // ROI ~5%, donc un filtre de 10% doit tout rejeter
    const opps = findOpportunities(quotes, events, 100, { minRoiPct: 10 });
    expect(opps.length).toBe(0);

    // ROI ~5%, filtre de 1% doit accepter
    const opps2 = findOpportunities(quotes, events, 100, { minRoiPct: 1 });
    expect(opps2.length).toBeGreaterThan(0);
  });

  it('ignore les cotes invalides (<=1.0)', () => {
    const quotes = [
      { event_id: 'e1', bookmaker: 'bookA', market_key: 'h2h', outcome_label: 'Home', odds: 0.5, point: null },
      { event_id: 'e1', bookmaker: 'bookB', market_key: 'h2h', outcome_label: 'Away', odds: 2.10, point: null },
    ];
    const events = [{ id: 'e1', sport: 'soccer', label: 'Test' }];
    const opps = findOpportunities(quotes, events, 100, {});
    expect(opps.length).toBe(0);
  });
});
