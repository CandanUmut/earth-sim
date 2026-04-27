import { describe, it, expect } from 'vitest';
import { decideAction, samplePersonality, type AIBrain } from './ai';
import { makeStartingNation, type Nation } from './economy';
import { makeCountry, makeRng } from './testHelpers';

function makeBrain(over: Partial<AIBrain> = {}): AIBrain {
  return {
    personality: 'aggressive',
    thinkCadence: 5,
    ticksSinceThink: 0,
    ...over,
  };
}

describe('samplePersonality', () => {
  it('produces personalities from the configured distribution', () => {
    const counts: Record<string, number> = {};
    const rng = makeRng(123);
    for (let i = 0; i < 1000; i++) {
      const p = samplePersonality(rng);
      counts[p] = (counts[p] ?? 0) + 1;
    }
    // Distribution is 25/25/25/15/10 — all five classes should appear.
    expect(Object.keys(counts).length).toBe(5);
    expect(counts['aggressive'] ?? 0).toBeGreaterThan(150);
    expect(counts['merchant'] ?? 0).toBeGreaterThan(50);
  });
});

describe('decideAction', () => {
  it('aggressive AI dispatches against a weak neighbor', () => {
    const me = makeCountry({
      id: 'ME',
      population: 1_000_000,
      baseEconomy: 8,
      neighbors: ['ENEMY'],
    });
    const enemy = makeCountry({
      id: 'ENEMY',
      population: 500_000,
      baseEconomy: 4,
      neighbors: ['ME'],
    });
    const myNation: Nation = {
      ...makeStartingNation(me),
      troops: 500,
      gold: 200,
    };
    const enemyNation: Nation = {
      ...makeStartingNation(enemy),
      troops: 50, // < 60% of mine
    };
    const action = decideAction({
      selfId: 'ME',
      countries: { ME: me, ENEMY: enemy },
      ownership: { ME: 'ME', ENEMY: 'ENEMY' },
      nations: { ME: myNation, ENEMY: enemyNation },
      brain: makeBrain({ personality: 'aggressive' }),
      rng: makeRng(1),
    });
    expect(action.kind).toBe('dispatch');
    if (action.kind === 'dispatch') {
      expect(action.toId).toBe('ENEMY');
    }
  });

  it("defensive AI doesn't suicide-attack a stronger foe", () => {
    const me = makeCountry({ id: 'ME', neighbors: ['ENEMY'] });
    const enemy = makeCountry({ id: 'ENEMY', neighbors: ['ME'] });
    const myNation: Nation = {
      ...makeStartingNation(me),
      troops: 100,
      gold: 1000,
    };
    const enemyNation: Nation = {
      ...makeStartingNation(enemy),
      troops: 800,
    };
    const action = decideAction({
      selfId: 'ME',
      countries: { ME: me, ENEMY: enemy },
      ownership: { ME: 'ME', ENEMY: 'ENEMY' },
      nations: { ME: myNation, ENEMY: enemyNation },
      brain: makeBrain({ personality: 'defensive' }),
      rng: makeRng(1),
    });
    expect(action.kind).not.toBe('dispatch');
  });

  it('merchant AI prefers tech investment with surplus gold', () => {
    const me = makeCountry({ id: 'ME', neighbors: [] });
    const myNation: Nation = {
      ...makeStartingNation(me),
      troops: 100,
      gold: 500,
    };
    let invested = 0;
    for (let i = 0; i < 50; i++) {
      const a = decideAction({
        selfId: 'ME',
        countries: { ME: me },
        ownership: { ME: 'ME' },
        nations: { ME: myNation },
        brain: makeBrain({ personality: 'merchant' }),
        rng: makeRng(i + 1),
      });
      if (a.kind === 'invest_tech') invested++;
    }
    // 70% of the time merchants invest when gold permits.
    expect(invested).toBeGreaterThan(25);
  });

  it('returns idle when no targets and no gold', () => {
    const me = makeCountry({ id: 'ME', neighbors: [] });
    const broke: Nation = {
      ...makeStartingNation(me),
      gold: 0,
      troops: 5,
    };
    const a = decideAction({
      selfId: 'ME',
      countries: { ME: me },
      ownership: { ME: 'ME' },
      nations: { ME: broke },
      brain: makeBrain({ personality: 'isolationist' }),
      rng: makeRng(99),
    });
    expect(a.kind).toBe('idle');
  });
});
