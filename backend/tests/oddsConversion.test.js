/**
 * Tests unitaires de la conversion de cotes américaines → décimales.
 */
import { describe, it, expect } from 'vitest';
import { decimalFromAmerican, americanFromDecimal } from '../src/utils/oddsConversion.js';

describe('decimalFromAmerican', () => {
  it('convertit -110 → ~1.909', () => {
    // 100/110 + 1 = 0.9090... + 1 = 1.9090...
    expect(decimalFromAmerican(-110)).toBeCloseTo(1.9091, 3);
  });

  it('convertit +150 → 2.5', () => {
    // 150/100 + 1 = 1.5 + 1 = 2.5
    expect(decimalFromAmerican(150)).toBe(2.5);
  });

  it('convertit +100 → 2.0', () => {
    // 100/100 + 1 = 1 + 1 = 2.0
    expect(decimalFromAmerican(100)).toBe(2.0);
  });

  it('convertit -200 → 1.5', () => {
    // 100/200 + 1 = 0.5 + 1 = 1.5
    expect(decimalFromAmerican(-200)).toBe(1.5);
  });

  it('convertit +200 → 3.0', () => {
    // 200/100 + 1 = 2 + 1 = 3.0
    expect(decimalFromAmerican(200)).toBe(3.0);
  });

  it('convertit -110 avec précision décimale', () => {
    const result = decimalFromAmerican(-110);
    // 100/110 + 1 = 1.90909...
    expect(result).toBeGreaterThan(1.909);
    expect(result).toBeLessThan(1.91);
  });

  it('lève une erreur pour une cote invalide (entre -100 et +100)', () => {
    expect(() => decimalFromAmerican(50)).toThrow();
    expect(() => decimalFromAmerican(-50)).toThrow();
    expect(() => decimalFromAmerican(0)).toThrow();
  });

  it('lève une erreur pour NaN', () => {
    expect(() => decimalFromAmerican(NaN)).toThrow();
  });

  it('lève une erreur pour undefined', () => {
    expect(() => decimalFromAmerican(undefined)).toThrow();
  });

  it('convertit +300 → 4.0', () => {
    expect(decimalFromAmerican(300)).toBe(4.0);
  });

  it('convertit -300 → ~1.333', () => {
    expect(decimalFromAmerican(-300)).toBeCloseTo(1.3333, 3);
  });
});

describe('americanFromDecimal', () => {
  it('convertit 2.5 → +150', () => {
    expect(americanFromDecimal(2.5)).toBe(150);
  });

  it('convertit 2.0 → +100', () => {
    expect(americanFromDecimal(2.0)).toBe(100);
  });

  it('convertit 1.5 → -200', () => {
    expect(americanFromDecimal(1.5)).toBe(-200);
  });

  it('lève une erreur pour une cote décimale <= 1', () => {
    expect(() => americanFromDecimal(1.0)).toThrow();
    expect(() => americanFromDecimal(0.5)).toThrow();
    expect(() => americanFromDecimal(1)).toThrow();
  });
});
