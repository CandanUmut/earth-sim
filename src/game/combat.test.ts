import { describe, it, expect } from 'vitest';
import { resolveBattle, terrainBonus, type CombatSide } from './combat';
import { makeCountry, makeRng } from './testHelpers';

const oneHundred = (over: Partial<CombatSide> = {}): CombatSide => ({
  infantry: 100,
  cavalry: 0,
  artillery: 0,
  tech: 1,
  ...over,
});

describe('resolveBattle', () => {
  it('is deterministic for a given seed', () => {
    const a = resolveBattle(
      oneHundred(),
      oneHundred(),
      makeCountry({ id: 'X', terrain: 'plains' }),
      [],
      makeRng(42),
    );
    const b = resolveBattle(
      oneHundred(),
      oneHundred(),
      makeCountry({ id: 'X', terrain: 'plains' }),
      [],
      makeRng(42),
    );
    expect(a).toEqual(b);
  });

  it('a much stronger attacker usually wins', () => {
    let wins = 0;
    const rng = makeRng(1);
    for (let i = 0; i < 100; i++) {
      const r = resolveBattle(
        oneHundred({ infantry: 1000 }),
        oneHundred({ infantry: 100 }),
        makeCountry({ id: 'X', terrain: 'plains' }),
        [],
        rng,
      );
      if (r.attackerWon) wins++;
    }
    expect(wins).toBeGreaterThan(95);
  });

  it("losses never exceed a side's troop pool", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 50; i++) {
      const r = resolveBattle(
        oneHundred({ infantry: 50 }),
        oneHundred({ infantry: 30 }),
        makeCountry({ id: 'X', terrain: 'mountain' }),
        [],
        rng,
      );
      expect(r.totalAttackerLosses).toBeLessThanOrEqual(50);
      expect(r.totalDefenderLosses).toBeLessThanOrEqual(30);
      expect(r.attackerSurvivors.infantry).toBeGreaterThanOrEqual(0);
      expect(r.defenderSurvivors.infantry).toBeGreaterThanOrEqual(0);
    }
  });

  it('mountain terrain helps the defender vs plains', () => {
    let plainsAtkWins = 0;
    let mountainAtkWins = 0;
    const N = 200;
    const rngP = makeRng(11);
    const rngM = makeRng(11);
    for (let i = 0; i < N; i++) {
      const a = oneHundred({ infantry: 120 });
      const d = oneHundred({ infantry: 100 });
      if (
        resolveBattle(
          a,
          d,
          makeCountry({ id: 'P', terrain: 'plains' }),
          [],
          rngP,
        ).attackerWon
      )
        plainsAtkWins++;
      if (
        resolveBattle(
          a,
          d,
          makeCountry({ id: 'M', terrain: 'mountain' }),
          [],
          rngM,
        ).attackerWon
      )
        mountainAtkWins++;
    }
    expect(plainsAtkWins).toBeGreaterThan(mountainAtkWins);
  });

  it('cavalry beats equal-count infantry head-on (RPS)', () => {
    let cavWins = 0;
    const rng = makeRng(99);
    for (let i = 0; i < 200; i++) {
      const r = resolveBattle(
        { infantry: 0, cavalry: 100, artillery: 0, tech: 1 },
        { infantry: 100, cavalry: 0, artillery: 0, tech: 1 },
        makeCountry({ id: 'X', terrain: 'plains' }),
        [],
        rng,
      );
      if (r.attackerWon) cavWins++;
    }
    expect(cavWins).toBeGreaterThan(140);
  });

  it('fortified specialization helps the defender', () => {
    let plainAtkWins = 0;
    let fortifiedAtkWins = 0;
    const N = 200;
    const rngP = makeRng(33);
    const rngF = makeRng(33);
    for (let i = 0; i < N; i++) {
      const a = oneHundred({ infantry: 130 });
      const d = oneHundred({ infantry: 100 });
      if (
        resolveBattle(
          a,
          d,
          makeCountry({ id: 'P', terrain: 'plains' }),
          [],
          rngP,
        ).attackerWon
      )
        plainAtkWins++;
      if (
        resolveBattle(
          a,
          d,
          makeCountry({
            id: 'F',
            terrain: 'plains',
            specializations: ['fortified'],
          }),
          ['fortified'],
          rngF,
        ).attackerWon
      )
        fortifiedAtkWins++;
    }
    expect(plainAtkWins).toBeGreaterThan(fortifiedAtkWins);
  });

  it('terrainBonus matches the published table', () => {
    expect(terrainBonus(makeCountry({ id: 'a', terrain: 'mountain' }))).toBeCloseTo(0.3);
    expect(terrainBonus(makeCountry({ id: 'a', terrain: 'island' }))).toBeCloseTo(0.2);
    expect(terrainBonus(makeCountry({ id: 'a', terrain: 'forest' }))).toBeCloseTo(0.15);
    expect(terrainBonus(makeCountry({ id: 'a', terrain: 'desert' }))).toBeCloseTo(0.1);
    expect(terrainBonus(makeCountry({ id: 'a', terrain: 'plains' }))).toBe(0);
  });
});
