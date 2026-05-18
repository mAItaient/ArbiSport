/**
 * Tests unitaires de la construction d'URLs bookmakers.
 */
import { describe, it, expect } from 'vitest';
import { getBookmakerUrl, getBookmakerHomepage, listKnownBookmakers } from '../src/integrations/bookmakerUrls.js';

describe('getBookmakerUrl', () => {
  // 1. Priorité : URL fournie par Odds-API.io dans event.urls
  it('utilise event.urls[bookmakerKey] si disponible (provider=oddsApiIo)', () => {
    const event = {
      id: 'test-event',
      urls: {
        stake: 'https://stake.com/sports/test-event-12345',
      },
    };
    const url = getBookmakerUrl('oddsApiIo', 'stake', event, 'Home');
    expect(url).toBe('https://stake.com/sports/test-event-12345');
  });

  it('n\'utilise PAS event.urls si le provider est theOddsApi', () => {
    const event = {
      id: 'test-event',
      urls: {
        pinnacle: 'https://pinnacle.com/event/12345',
      },
    };
    // TheOddsAPI ne fournit pas d'URLs, on utilise les patterns ou homepage
    const url = getBookmakerUrl('theOddsApi', 'pinnacle', event, 'Home');
    // Doit retourner la homepage pinnacle, pas l'url de event.urls
    expect(url).toBe('https://www.pinnacle.com/en/betting-odds/');
  });

  // 2. Fallback sur homepage
  it('retourne la homepage si pas d\'URL dans event.urls pour bookmaker connu', () => {
    const event = { id: 'test-event', urls: null };
    const url = getBookmakerUrl('oddsApiIo', 'betclic', event, 'Home');
    expect(url).toBe('https://www.betclic.fr/sport');
  });

  it('retourne la homepage Winamax', () => {
    const url = getBookmakerUrl('theOddsApi', 'winamax', null, 'Home');
    expect(url).toBe('https://www.winamax.fr/paris-sportifs');
  });

  it('retourne la homepage Unibet', () => {
    const url = getBookmakerUrl('theOddsApi', 'unibet', null, 'Away');
    expect(url).toBe('https://www.unibet.fr/sport');
  });

  it('retourne la homepage Pinnacle', () => {
    const url = getBookmakerUrl('theOddsApi', 'pinnacle', null, 'Home');
    expect(url).not.toBeNull();
    expect(url).toContain('pinnacle.com');
  });

  // 3. Retour null si bookmaker inconnu
  it('retourne null pour un bookmaker inconnu', () => {
    const url = getBookmakerUrl('theOddsApi', 'bookmaker_inexistant_xyz', null, 'Home');
    expect(url).toBeNull();
  });

  it('retourne null si bookmakerKey est null/undefined', () => {
    expect(getBookmakerUrl('theOddsApi', null, null, 'Home')).toBeNull();
    expect(getBookmakerUrl('theOddsApi', undefined, null, 'Home')).toBeNull();
  });

  // 4. Patterns de deep-link Stake
  it('construit un deep-link Stake avec externalId', () => {
    const event = { id: 'ev-123', externalId: 'ev-123', urls: null };
    const url = getBookmakerUrl('theOddsApi', 'stake', event, 'Home');
    expect(url).toContain('stake.com/sports/ev-123');
  });

  it('retourne la homepage Stake si pas d\'externalId', () => {
    const event = { id: 'ev-123', externalId: null, urls: null };
    const url = getBookmakerUrl('theOddsApi', 'stake', event, 'Home');
    expect(url).toBe('https://stake.com/sports');
  });

  // 5. Patterns de deep-link 1xbet
  it('construit un deep-link 1xbet avec slug', () => {
    const event = { id: 'ev-456', slug: 'soccer/epl/match-456', urls: null };
    const url = getBookmakerUrl('theOddsApi', '1xbet', event, 'Home');
    expect(url).toContain('1xbet.com');
    expect(url).toContain('soccer/epl/match-456');
  });

  it('retourne le fallback 1xbet si pas de slug', () => {
    const event = { id: 'ev-456', slug: null, sport: 'soccer', urls: null };
    const url = getBookmakerUrl('theOddsApi', '1xbet', event, 'Home');
    expect(url).toContain('1xbet.com');
  });
});

describe('getBookmakerHomepage', () => {
  it('retourne la homepage pour un bookmaker connu', () => {
    expect(getBookmakerHomepage('betclic')).toBe('https://www.betclic.fr/sport');
    expect(getBookmakerHomepage('pinnacle')).toBe('https://www.pinnacle.com/en/betting-odds/');
  });

  it('retourne null pour un bookmaker inconnu', () => {
    expect(getBookmakerHomepage('bookmaker_inconnu_xyz')).toBeNull();
    expect(getBookmakerHomepage(null)).toBeNull();
  });
});

describe('listKnownBookmakers', () => {
  it('retourne une liste non vide de bookmakers connus', () => {
    const list = listKnownBookmakers();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(5);
  });

  it('inclut les bookmakers principaux', () => {
    const list = listKnownBookmakers();
    expect(list).toContain('stake');
    expect(list).toContain('pinnacle');
    expect(list).toContain('betclic');
    expect(list).toContain('winamax');
  });
});
