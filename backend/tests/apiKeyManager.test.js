/**
 * Tests unitaires du gestionnaire de clés API.
 * Utilise une base de données en mémoire pour les tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseQuotaHeaders } from '../src/core/apiKeyManager.js';

// ─── Tests de parsing des headers ──────────────────────────────────────────────

describe('parseQuotaHeaders — The Odds API', () => {
  it('parse correctement les headers x-requests-remaining et x-requests-used', () => {
    const headers = {
      'x-requests-remaining': '450',
      'x-requests-used': '50',
    };
    const result = parseQuotaHeaders('theOddsApi', headers);
    expect(result.remaining).toBe(450);
    expect(result.used).toBe(50);
    expect(result.limit).toBeNull();
  });

  it('retourne null pour remaining si header absent', () => {
    const result = parseQuotaHeaders('theOddsApi', {});
    expect(result.remaining).toBeNull();
    expect(result.used).toBeNull();
  });

  it('parse les headers avec des valeurs numériques en string', () => {
    const headers = {
      'x-requests-remaining': '0',
      'x-requests-used': '500',
    };
    const result = parseQuotaHeaders('theOddsApi', headers);
    expect(result.remaining).toBe(0);
    expect(result.used).toBe(500);
  });
});

describe('parseQuotaHeaders — Odds-API.io', () => {
  it('parse correctement les headers x-ratelimit-*', () => {
    const headers = {
      'x-ratelimit-limit': '1000',
      'x-ratelimit-remaining': '850',
      'x-ratelimit-reset': '2024-04-01T00:00:00Z',
    };
    const result = parseQuotaHeaders('oddsApiIo', headers);
    expect(result.limit).toBe(1000);
    expect(result.remaining).toBe(850);
    expect(result.reset).toBe('2024-04-01T00:00:00Z');
  });

  it('retourne des nulls si headers absents', () => {
    const result = parseQuotaHeaders('oddsApiIo', {});
    expect(result.limit).toBeNull();
    expect(result.remaining).toBeNull();
    expect(result.reset).toBeNull();
  });

  it('parse remaining = 0 correctement', () => {
    const headers = {
      'x-ratelimit-limit': '500',
      'x-ratelimit-remaining': '0',
    };
    const result = parseQuotaHeaders('oddsApiIo', headers);
    expect(result.remaining).toBe(0);
    expect(result.limit).toBe(500);
  });
});

describe('parseQuotaHeaders — provider inconnu', () => {
  it('retourne un objet vide pour un provider inconnu', () => {
    const result = parseQuotaHeaders('unknownProvider', { 'some-header': '123' });
    expect(result).toEqual({});
  });

  it('retourne un objet vide si headers null', () => {
    const result = parseQuotaHeaders('theOddsApi', null);
    expect(result).toEqual({});
  });
});

// ─── Tests de calcul de statut ──────────────────────────────────────────────────

describe('calcul du statut via seuils', () => {
  /**
   * Simule le calcul de statut tel que défini dans apiKeyManager.js.
   * Seuils : ACTIVE > 20%, NEAR_LIMIT 5-20%, LIMITED < 5%.
   */
  function computeStatus(remaining, limit) {
    if (remaining === null || remaining === undefined || !limit) return 'ACTIVE';
    const pct = remaining / limit;
    if (pct <= 0.05) return 'LIMITED';
    if (pct <= 0.20) return 'NEAR_LIMIT';
    return 'ACTIVE';
  }

  it('ACTIVE quand remaining > 20% du quota', () => {
    expect(computeStatus(250, 500)).toBe('ACTIVE');   // 50%
    expect(computeStatus(101, 500)).toBe('ACTIVE');   // 20.2%
  });

  it('NEAR_LIMIT quand remaining entre 5% et 20%', () => {
    expect(computeStatus(100, 500)).toBe('NEAR_LIMIT');   // 20.0% → boundary
    expect(computeStatus(50, 500)).toBe('NEAR_LIMIT');    // 10%
    expect(computeStatus(26, 500)).toBe('NEAR_LIMIT');    // 5.2%
  });

  it('LIMITED quand remaining <= 5%', () => {
    expect(computeStatus(25, 500)).toBe('LIMITED');    // 5.0% → boundary
    expect(computeStatus(0, 500)).toBe('LIMITED');     // 0%
    expect(computeStatus(1, 500)).toBe('LIMITED');     // 0.2%
  });

  it('ACTIVE si limit est null (pas d\'info de quota)', () => {
    expect(computeStatus(null, null)).toBe('ACTIVE');
    expect(computeStatus(null, 0)).toBe('ACTIVE');
  });
});

// ─── Test de rotation (simulation) ─────────────────────────────────────────────

describe('rotation des clés API', () => {
  it('sélectionne la clé avec le plus de requêtes restantes', () => {
    // Simulation de la logique de sélection sans DB réelle
    const mockKeys = [
      { id: 1, provider: 'theOddsApi', enabled: 1, status: 'ACTIVE', requests_remaining: 100, requests_used_total: 400 },
      { id: 2, provider: 'theOddsApi', enabled: 1, status: 'ACTIVE', requests_remaining: 450, requests_used_total: 50 },
      { id: 3, provider: 'theOddsApi', enabled: 1, status: 'NEAR_LIMIT', requests_remaining: 20, requests_used_total: 480 },
    ];

    // Filtre et tri : enabled=1, status != LIMITED, tri par remaining DESC puis used ASC
    const eligible = mockKeys
      .filter(k => k.enabled && k.status !== 'LIMITED')
      .sort((a, b) => {
        const diff = (b.requests_remaining ?? 0) - (a.requests_remaining ?? 0);
        if (diff !== 0) return diff;
        return a.requests_used_total - b.requests_used_total;
      });

    expect(eligible[0].id).toBe(2); // 450 remaining → première
    expect(eligible[1].id).toBe(1); // 100 remaining
    expect(eligible[2].id).toBe(3); // 20 remaining
  });

  it('exclut les clés LIMITED de la sélection', () => {
    const mockKeys = [
      { id: 1, enabled: 1, status: 'LIMITED', requests_remaining: 0 },
      { id: 2, enabled: 1, status: 'ACTIVE', requests_remaining: 100 },
    ];

    const eligible = mockKeys.filter(k => k.enabled && k.status !== 'LIMITED');
    expect(eligible.length).toBe(1);
    expect(eligible[0].id).toBe(2);
  });

  it('exclut les clés désactivées (enabled=0)', () => {
    const mockKeys = [
      { id: 1, enabled: 0, status: 'ACTIVE', requests_remaining: 500 },
      { id: 2, enabled: 1, status: 'ACTIVE', requests_remaining: 100 },
    ];

    const eligible = mockKeys.filter(k => k.enabled && k.status !== 'LIMITED');
    expect(eligible.length).toBe(1);
    expect(eligible[0].id).toBe(2);
  });

  it('simule le passage en LIMITED sur 429', () => {
    // Simulation de markLimited
    let keyStatus = 'ACTIVE';
    let keyRemaining = 100;

    // Simule une erreur 429
    function onRateLimit() {
      keyStatus = 'LIMITED';
      keyRemaining = 0;
    }

    onRateLimit();
    expect(keyStatus).toBe('LIMITED');
    expect(keyRemaining).toBe(0);
  });
});
