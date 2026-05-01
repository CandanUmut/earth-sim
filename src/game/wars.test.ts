import { describe, expect, it } from 'vitest';
import { makeCountry } from './testHelpers';
import { makeStartingNation } from './economy';
import {
  applyTimeExhaustion,
  buildPeaceOutcome,
  bumpExhaustionFromBattle,
  createWar,
  evaluatePeaceDeal,
  goalWeight,
  maxClaimsByPower,
  peaceThreshold,
  warKey,
} from './wars';

describe('warKey', () => {
  it('is symmetric regardless of argument order', () => {
    expect(warKey('A', 'B')).toBe(warKey('B', 'A'));
  });
});

describe('peaceThreshold', () => {
  it('white peace falls back to the floor', () => {
    expect(peaceThreshold([])).toBe(15);
  });
  it('sums claim weights', () => {
    expect(
      peaceThreshold([
        { kind: 'annex_tile', targetId: 'X' },
        { kind: 'tribute', targetId: 'Y' },
      ]),
    ).toBe(goalWeight('annex_tile') + goalWeight('tribute'));
  });
});

describe('maxClaimsByPower', () => {
  it('weak attacker gets 1 claim', () => {
    const a = makeStartingNation(makeCountry({ id: 'A', baseEconomy: 4 }));
    const b = makeStartingNation(makeCountry({ id: 'B', baseEconomy: 12 }));
    expect(maxClaimsByPower(a, b)).toBe(1);
  });
  it('overwhelming attacker gets 3 claims', () => {
    const a = makeStartingNation(makeCountry({ id: 'A', baseEconomy: 20 }));
    a.infantry = 1000;
    const b = makeStartingNation(makeCountry({ id: 'B', baseEconomy: 1 }));
    b.infantry = 5;
    expect(maxClaimsByPower(a, b)).toBe(3);
  });
});

describe('exhaustion accumulation', () => {
  it('battle losses add exhaustion to the loser', () => {
    const w0 = createWar({
      attackerId: 'A',
      defenderId: 'B',
      startedAtTick: 0,
      goals: [],
    });
    const w1 = bumpExhaustionFromBattle(w0, true, false); // attacker lost
    expect(w1.attackerExhaustion).toBeGreaterThan(0);
    expect(w1.defenderExhaustion).toBe(0);
  });

  it('a tile flip adds extra exhaustion to the loser of that battle', () => {
    const w0 = createWar({
      attackerId: 'A',
      defenderId: 'B',
      startedAtTick: 0,
      goals: [],
    });
    const lostBattleOnly = bumpExhaustionFromBattle(w0, false, false);
    const lostBattleAndTile = bumpExhaustionFromBattle(w0, false, true);
    expect(lostBattleAndTile.defenderExhaustion).toBeGreaterThan(
      lostBattleOnly.defenderExhaustion,
    );
  });

  it('exhaustion is clamped at 100', () => {
    let w = createWar({
      attackerId: 'A',
      defenderId: 'B',
      startedAtTick: 0,
      goals: [],
    });
    for (let i = 0; i < 100; i++) {
      w = bumpExhaustionFromBattle(w, false, true);
    }
    expect(w.defenderExhaustion).toBe(100);
  });

  it('time-based exhaustion fires only on its interval', () => {
    const w0 = createWar({
      attackerId: 'A',
      defenderId: 'B',
      startedAtTick: 0,
      goals: [],
    });
    const w1 = applyTimeExhaustion(w0, 1);
    expect(w1).toBe(w0); // not on interval, returns same ref
    const w2 = applyTimeExhaustion(w0, 6); // matches default interval
    expect(w2.attackerExhaustion).toBeGreaterThan(0);
    expect(w2.defenderExhaustion).toBeGreaterThan(0);
  });
});

describe('evaluatePeaceDeal', () => {
  it('white peace at high enough exhaustion is accepted', () => {
    const w = {
      ...createWar({
        attackerId: 'A',
        defenderId: 'B',
        startedAtTick: 0,
        goals: [],
      }),
      defenderExhaustion: 30,
    };
    const d = evaluatePeaceDeal({
      war: w,
      evaluatorId: 'B',
      claims: [],
    });
    expect(d.accept).toBe(true);
  });

  it('defender refuses heavy claims when not exhausted', () => {
    const w = {
      ...createWar({
        attackerId: 'A',
        defenderId: 'B',
        startedAtTick: 0,
        goals: [{ kind: 'vassalize' as const, targetId: 'B' }],
      }),
      defenderExhaustion: 10,
    };
    const d = evaluatePeaceDeal({
      war: w,
      evaluatorId: 'B',
      claims: [{ kind: 'vassalize', targetId: 'B' }],
    });
    expect(d.accept).toBe(false);
  });

  it('defender accepts heavy claims when totally broken', () => {
    const w = {
      ...createWar({
        attackerId: 'A',
        defenderId: 'B',
        startedAtTick: 0,
        goals: [{ kind: 'vassalize' as const, targetId: 'B' }],
      }),
      defenderExhaustion: 80,
    };
    const d = evaluatePeaceDeal({
      war: w,
      evaluatorId: 'B',
      claims: [{ kind: 'vassalize', targetId: 'B' }],
    });
    expect(d.accept).toBe(true);
  });

  it('attacker auto-accepts a deal that meets all goals', () => {
    const w = createWar({
      attackerId: 'A',
      defenderId: 'B',
      startedAtTick: 0,
      goals: [{ kind: 'tribute', targetId: 'B' }],
    });
    const d = evaluatePeaceDeal({
      war: w,
      evaluatorId: 'A',
      claims: [{ kind: 'tribute', targetId: 'B' }],
    });
    expect(d.accept).toBe(true);
  });
});

describe('buildPeaceOutcome', () => {
  it('annexed tiles transfer to attacker', () => {
    const countries = { A: makeCountry({ id: 'A' }), B: makeCountry({ id: 'B' }) };
    const w = createWar({
      attackerId: 'A',
      defenderId: 'B',
      startedAtTick: 0,
      goals: [{ kind: 'annex_tile', targetId: 'B' }],
    });
    const out = buildPeaceOutcome(w, w.attackerGoals, countries);
    expect(out.tilesToAttacker).toEqual(['B']);
    expect(out.vassalize).toBe(false);
    expect(out.tribute).toBe(0);
  });

  it('tribute claim sets a non-zero tribute amount', () => {
    const countries = {
      A: makeCountry({ id: 'A' }),
      B: makeCountry({ id: 'B', baseEconomy: 12 }),
    };
    const w = createWar({
      attackerId: 'A',
      defenderId: 'B',
      startedAtTick: 0,
      goals: [{ kind: 'tribute', targetId: 'B' }],
    });
    const out = buildPeaceOutcome(w, w.attackerGoals, countries);
    expect(out.tribute).toBeGreaterThan(0);
  });

  it('vassalize claim flips the flag', () => {
    const countries = { A: makeCountry({ id: 'A' }), B: makeCountry({ id: 'B' }) };
    const w = createWar({
      attackerId: 'A',
      defenderId: 'B',
      startedAtTick: 0,
      goals: [{ kind: 'vassalize', targetId: 'B' }],
    });
    const out = buildPeaceOutcome(w, w.attackerGoals, countries);
    expect(out.vassalize).toBe(true);
  });
});
