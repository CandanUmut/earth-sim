import { describe, it, expect } from 'vitest';
import { resolveBattle, terrainBonus } from './combat';
import { makeCountry, makeRng } from './testHelpers';

describe('resolveBattle', () => {
  it('is deterministic for a given seed', () => {
    const a = resolveBattle(
      { troops: 100, tech: 1 },
      { troops: 100, tech: 1 },
      makeCountry({ id: 'X', terrain: 'plains' }),
      makeRng(42),
    );
    const b = resolveBattle(
      { troops: 100, tech: 1 },
      { troops: 100, tech: 1 },
      makeCountry({ id: 'X', terrain: 'plains' }),
      makeRng(42),
    );
    expect(a).toEqual(b);
  });

  it('a much stronger attacker usually wins', () => {
    let wins = 0;
    const rng = makeRng(1);
    for (let i = 0; i < 100; i++) {
      const r = resolveBattle(
        { troops: 1000, tech: 1 },
        { troops: 100, tech: 1 },
        makeCountry({ id: 'X', terrain: 'plains' }),
        rng,
      );
      if (r.attackerWon) wins++;
    }
    expect(wins).toBeGreaterThan(95);
  });

  it('losses never exceed a side\'s troop pool', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 50; i++) {
      const r = resolveBattle(
        { troops: 50, tech: 1 },
        { troops: 30, tech: 1 },
        makeCountry({ id: 'X', terrain: 'mountain' }),
        rng,
      );
      expect(r.attackerLosses).toBeLessThanOrEqual(50);
      expect(r.defenderLosses).toBeLessThanOrEqual(30);
      expect(r.attackerSurvivors).toBeGreaterThanOrEqual(0);
      expect(r.defenderSurvivors).toBeGreaterThanOrEqual(0);
    }
  });

  it('mountain terrain helps the defender vs plains', () => {
    let plainsAtkWins = 0;
    let mountainAtkWins = 0;
    const N = 200;
    const rngP = makeRng(11);
    const rngM = makeRng(11);
    for (let i = 0; i < N; i++) {
      const a = { troops: 120, tech: 1 };
      const d = { troops: 100, tech: 1 };
      if (
        resolveBattle(a, d, makeCountry({ id: 'P', terrain: 'plains' }), rngP)
          .attackerWon
      )
        plainsAtkWins++;
      if (
        resolveBattle(a, d, makeCountry({ id: 'M', terrain: 'mountain' }), rngM)
          .attackerWon
      )
        mountainAtkWins++;
    }
    expect(plainsAtkWins).toBeGreaterThan(mountainAtkWins);
  });

  it('terrainBonus matches the published table', () => {
    expect(terrainBonus(makeCountry({ id: 'a', terrain: 'mountain' }))).toBeCloseTo(0.3);
    expect(terrainBonus(makeCountry({ id: 'a', terrain: 'island' }))).toBeCloseTo(0.2);
    expect(terrainBonus(makeCountry({ id: 'a', terrain: 'forest' }))).toBeCloseTo(0.15);
    expect(terrainBonus(makeCountry({ id: 'a', terrain: 'desert' }))).toBeCloseTo(0.1);
    expect(terrainBonus(makeCountry({ id: 'a', terrain: 'plains' }))).toBe(0);
  });
});
