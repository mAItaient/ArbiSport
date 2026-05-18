/**
 * Tests du registre de sports et de la table des bookmakers cibles.
 */
import { describe, it, expect } from 'vitest';
import {
  SPORT_CATALOG,
  TARGET_BOOKMAKERS,
  getSport,
  getSportMapping,
  listSportsForProvider,
  getTwoWayMarkets,
  filterBookmakersForProvider,
  canonicalBookmakerId,
} from '../src/core/sportRegistry.js';

describe('SPORT_CATALOG', () => {
  it('contient au moins 18 sports', () => {
    expect(SPORT_CATALOG.length).toBeGreaterThanOrEqual(18);
  });

  it('chaque sport a un internalKey, label et twoWayMarkets', () => {
    for (const s of SPORT_CATALOG) {
      expect(s.internalKey).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(Array.isArray(s.twoWayMarkets)).toBe(true);
      expect(s.twoWayMarkets.length).toBeGreaterThan(0);
    }
  });

  it('aucun sport football n\'inclut h2h (1X2 à 3 issues)', () => {
    const soccers = SPORT_CATALOG.filter((s) => s.group === 'soccer');
    expect(soccers.length).toBeGreaterThan(0);
    for (const s of soccers) {
      expect(s.twoWayMarkets).not.toContain('h2h');
    }
  });

  it('tennis/MMA/boxe ont h2h dans leurs marchés', () => {
    expect(getSport('tennis_atp_french_open').twoWayMarkets).toContain('h2h');
    expect(getSport('mma_mixed_martial_arts').twoWayMarkets).toContain('h2h');
    expect(getSport('boxing_boxing').twoWayMarkets).toContain('h2h');
  });
});

describe('TARGET_BOOKMAKERS', () => {
  it('contient exactement 13 bookmakers', () => {
    expect(TARGET_BOOKMAKERS.length).toBe(13);
  });

  it('inclut tous les bookmakers demandés par l\'utilisateur', () => {
    const ids = TARGET_BOOKMAKERS.map((b) => b.id);
    for (const must of [
      'betclic', 'netbet', 'unibet', 'pmu', 'winamax', 'pinnacle',
      'betfair', '888sport', 'onexbet', 'betonline', 'everygame',
      'bcgame', 'stake',
    ]) {
      expect(ids).toContain(must);
    }
  });

  it('netbet, bcgame, stake sont couverts uniquement par Odds-API.io', () => {
    for (const id of ['netbet', 'bcgame', 'stake']) {
      const bm = TARGET_BOOKMAKERS.find((b) => b.id === id);
      expect(bm.theOddsApi).toBeNull();
      expect(bm.oddsApiIo).toBeTruthy();
    }
  });
});

describe('getSportMapping', () => {
  it('retourne le mapping The Odds API pour soccer_epl', () => {
    const m = getSportMapping('soccer_epl', 'theOddsApi');
    expect(m.sportKey).toBe('soccer_epl');
  });

  it('retourne le mapping Odds-API.io pour soccer_epl', () => {
    const m = getSportMapping('soccer_epl', 'oddsApiIo');
    expect(m.sport).toBe('football');
    expect(m.leagueSlug).toBe('england-premier-league');
  });

  it('retourne null pour sport inconnu', () => {
    expect(getSportMapping('zzz_unknown', 'theOddsApi')).toBeNull();
    expect(getSportMapping('zzz_unknown', 'oddsApiIo')).toBeNull();
  });
});

describe('listSportsForProvider', () => {
  it('liste les sports couverts par chaque provider', () => {
    const t = listSportsForProvider('theOddsApi');
    const o = listSportsForProvider('oddsApiIo');
    expect(t.length).toBe(SPORT_CATALOG.length);
    expect(o.length).toBe(SPORT_CATALOG.length);
  });
});

describe('getTwoWayMarkets', () => {
  it('retourne les marchés 2-way du sport', () => {
    const m = getTwoWayMarkets('soccer_epl');
    expect(m).toContain('totals');
    expect(m).toContain('spreads');
    expect(m).not.toContain('h2h');
  });

  it('retourne tableau vide pour sport inconnu', () => {
    expect(getTwoWayMarkets('zzz')).toEqual([]);
  });
});

describe('filterBookmakersForProvider', () => {
  it('mappe les ids internes vers les clés The Odds API', () => {
    const out = filterBookmakersForProvider(
      ['betclic', 'pinnacle', 'stake'],
      'theOddsApi'
    );
    expect(out).toContain('betclic_fr');
    expect(out).toContain('pinnacle');
    // stake n'est pas couvert par The Odds API → exclu
    expect(out).not.toContain('Stake');
  });

  it('mappe vers Odds-API.io et inclut Stake/BC.Game/NetBet', () => {
    const out = filterBookmakersForProvider(
      ['stake', 'bcgame', 'netbet', 'betclic'],
      'oddsApiIo'
    );
    expect(out).toContain('Stake');
    expect(out).toContain('BC.Game');
    expect(out).toContain('NetBet');
    expect(out).toContain('Betclic FR');
  });

  it('retourne [] sur liste vide ou non-array', () => {
    expect(filterBookmakersForProvider([], 'theOddsApi')).toEqual([]);
    expect(filterBookmakersForProvider(null, 'theOddsApi')).toEqual([]);
  });
});

describe('canonicalBookmakerId', () => {
  it('mappe les clés API vers les ids internes', () => {
    expect(canonicalBookmakerId('betclic_fr')).toBe('betclic');
    expect(canonicalBookmakerId('Pinnacle')).toBe('pinnacle');
    expect(canonicalBookmakerId('1xbet')).toBe('onexbet');
    expect(canonicalBookmakerId('Stake')).toBe('stake');
    expect(canonicalBookmakerId('BC.Game')).toBe('bcgame');
    expect(canonicalBookmakerId('NetBet')).toBe('netbet');
    expect(canonicalBookmakerId('sport888')).toBe('888sport');
  });

  it('renvoie null sur clé inconnue', () => {
    expect(canonicalBookmakerId('totally_unknown_xyz')).toBeNull();
  });

  it('renvoie null sur valeur vide', () => {
    expect(canonicalBookmakerId(null)).toBeNull();
    expect(canonicalBookmakerId('')).toBeNull();
  });
});
