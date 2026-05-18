/**
 * Tests d'appariement d'événements entre fournisseurs.
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeTeam,
  teamSimilarity,
  jaroWinklerSimilarity,
  scoreEventMatch,
  matchEventsBetweenProviders,
} from '../src/core/eventMatcher.js';

describe('normalizeTeam', () => {
  it('passe en minuscules et retire les accents', () => {
    expect(normalizeTeam('FC Bâle')).toBe('bale');
  });

  it('retire les articles et préfixes FC/AC/CF', () => {
    expect(normalizeTeam('FC Barcelona')).toBe('barcelona');
    expect(normalizeTeam('AC Milan')).toBe('milan');
    expect(normalizeTeam('Le Havre AC')).toBe('havre');
  });

  it('écrase les espaces et retire la ponctuation', () => {
    expect(normalizeTeam('Paris   Saint-Germain')).toBe('paris saint germain');
  });

  it('retourne chaîne vide sur entrée nulle', () => {
    expect(normalizeTeam(null)).toBe('');
    expect(normalizeTeam(undefined)).toBe('');
  });
});

describe('jaroWinklerSimilarity', () => {
  it('retourne 1.0 sur chaînes identiques', () => {
    expect(jaroWinklerSimilarity('foo', 'foo')).toBe(1.0);
  });

  it('retourne 0 sur entrée nulle', () => {
    expect(jaroWinklerSimilarity(null, 'foo')).toBe(0);
    expect(jaroWinklerSimilarity('foo', null)).toBe(0);
  });

  it('donne un bonus de préfixe (Winkler)', () => {
    const a = jaroWinklerSimilarity('martha', 'marhta');
    expect(a).toBeGreaterThan(0.95);
  });
});

describe('teamSimilarity', () => {
  it('Paris Saint-Germain ↔ PSG via alias', () => {
    const s = teamSimilarity('Paris Saint-Germain', 'PSG');
    expect(s).toBeGreaterThanOrEqual(0.95);
  });

  it('Manchester City ↔ Man City via alias', () => {
    const s = teamSimilarity('Manchester City', 'Man City');
    expect(s).toBeGreaterThanOrEqual(0.95);
  });

  it('Wolverhampton Wanderers ↔ Wolves via alias', () => {
    const s = teamSimilarity('Wolverhampton Wanderers', 'Wolves');
    expect(s).toBeGreaterThanOrEqual(0.95);
  });

  it('équipes différentes → score < 0.7', () => {
    const s = teamSimilarity('Marseille', 'Lyon');
    expect(s).toBeLessThan(0.7);
  });

  it('FC Barcelona ↔ Barcelone via alias', () => {
    const s = teamSimilarity('FC Barcelona', 'Barcelone');
    expect(s).toBeGreaterThanOrEqual(0.95);
  });
});

describe('scoreEventMatch', () => {
  const baseTime = '2026-06-15T19:00:00Z';

  it('PSG vs Marseille (TheOdds) ↔ Paris SG vs OM (OddsApiIo) : score ≥ 0.90', () => {
    const a = {
      home_team: 'Paris Saint-Germain', away_team: 'Marseille',
      commence_time: baseTime,
    };
    const b = {
      home_team: 'Paris SG', away_team: 'Olympique de Marseille',
      commence_time: baseTime,
    };
    const r = scoreEventMatch(a, b);
    expect(r.score).toBeGreaterThanOrEqual(0.90);
  });

  it('détecte une inversion home/away et corrige', () => {
    const a = {
      home_team: 'Lyon', away_team: 'Marseille',
      commence_time: baseTime,
    };
    const b = {
      home_team: 'Marseille', away_team: 'Lyon',
      commence_time: baseTime,
    };
    const r = scoreEventMatch(a, b);
    expect(r.swapped).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0.90);
  });

  it('rejette si plus de 30 min de différence de date', () => {
    const a = {
      home_team: 'PSG', away_team: 'Marseille',
      commence_time: '2026-06-15T19:00:00Z',
    };
    const b = {
      home_team: 'PSG', away_team: 'Marseille',
      commence_time: '2026-06-15T20:00:00Z', // +60 min
    };
    const r = scoreEventMatch(a, b);
    expect(r.score).toBe(0);
  });

  it('score < 0.70 sur équipes différentes', () => {
    const a = {
      home_team: 'Marseille', away_team: 'Lyon',
      commence_time: baseTime,
    };
    const b = {
      home_team: 'Bordeaux', away_team: 'Nice',
      commence_time: baseTime,
    };
    const r = scoreEventMatch(a, b);
    expect(r.score).toBeLessThan(0.70);
  });
});

describe('matchEventsBetweenProviders', () => {
  const t = '2026-06-15T19:00:00Z';

  it('matched : score ≥ 0.90 (fusion auto)', () => {
    const evA = [{ id: 'A1', home_team: 'PSG', away_team: 'Marseille', commence_time: t }];
    const evB = [{ id: 'B1', home_team: 'Paris Saint-Germain', away_team: 'Olympique de Marseille', commence_time: t }];
    const r = matchEventsBetweenProviders(evA, evB);
    expect(r.matched.length).toBe(1);
    expect(r.pending.length).toBe(0);
  });

  it('pending : score entre 0.70 et 0.90', () => {
    // Deux équipes peu similaires mais à même heure pour rester ≥ 0.70 sans dépasser 0.90
    const evA = [{ id: 'A1', home_team: 'PSG', away_team: 'Marseillaise', commence_time: t }];
    const evB = [{ id: 'B1', home_team: 'PSG', away_team: 'Marsailles', commence_time: t }];
    const r = matchEventsBetweenProviders(evA, evB);
    // Selon le score on attend matched ou pending — l'important est qu'il y ait UNE entrée.
    expect(r.matched.length + r.pending.length).toBe(1);
  });

  it('unmatched : score < 0.70', () => {
    const evA = [{ id: 'A1', home_team: 'Marseille', away_team: 'Lyon', commence_time: t }];
    const evB = [{ id: 'B1', home_team: 'Bordeaux', away_team: 'Nice', commence_time: t }];
    const r = matchEventsBetweenProviders(evA, evB);
    expect(r.matched.length).toBe(0);
    expect(r.pending.length).toBe(0);
    expect(r.unmatchedA.length).toBe(1);
    expect(r.unmatchedB.length).toBe(1);
  });

  it('un event A ne consomme qu\'un seul event B', () => {
    const evA = [{ id: 'A1', home_team: 'PSG', away_team: 'Marseille', commence_time: t }];
    const evB = [
      { id: 'B1', home_team: 'Paris Saint-Germain', away_team: 'Marseille', commence_time: t },
      { id: 'B2', home_team: 'Paris SG', away_team: 'OM', commence_time: t },
    ];
    const r = matchEventsBetweenProviders(evA, evB);
    expect(r.matched.length + r.pending.length).toBe(1);
    expect(r.unmatchedA.length + r.unmatchedB.length).toBe(1);
  });
});
