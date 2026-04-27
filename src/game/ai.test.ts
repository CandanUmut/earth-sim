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
      infantry: 350,
      cavalry: 120,
      artillery: 30,
      gold: 200,
    };
    const enemyNation: Nation = {
      ...makeStartingNation(enemy),
      infantry: 30,
      cavalry: 10,
      artillery: 5, // total 45 < 60 % of mine
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
      infantry: 60,
      cavalry: 30,
      artillery: 10,
      gold: 1000,
    };
    const enemyNation: Nation = {
      ...makeStartingNation(enemy),
      infantry: 600,
      cavalry: 150,
      artillery: 50,
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
      infantry: 60,
      cavalry: 20,
      artillery: 20,
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
    expect(invested).toBeGreaterThan(25);
  });

  it('returns idle when no targets and no gold', () => {
    const me = makeCountry({ id: 'ME', neighbors: [] });
    const broke: Nation = {
      ...makeStartingNation(me),
      gold: 0,
      infantry: 5,
      cavalry: 0,
      artillery: 0,
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
