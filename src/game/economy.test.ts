import { describe, it, expect } from 'vitest';
import {
  goldPerTick,
  troopUpkeepPerTick,
  maxTroops,
  makeStartingNation,
  techIncrement,
} from './economy';
import { makeCountry } from './testHelpers';

describe('economy', () => {
  it('gold income scales with tech and territory', () => {
    const c = makeCountry({ id: 'A', baseEconomy: 10 });
    const n = makeStartingNation(c);
    const oneTerr = goldPerTick(c, n, 1);
    const tenTerr = goldPerTick(c, n, 10);
    expect(tenTerr).toBeGreaterThan(oneTerr);
    // factor: tech=1, baseEcon=10, territory=1 → 10 * 1 * 1.1
    expect(oneTerr).toBeCloseTo(11);
    expect(tenTerr).toBeCloseTo(20);
  });

  it('upkeep is positive and proportional to troops', () => {
    const c = makeCountry({ id: 'A', baseEconomy: 5 });
    const n = makeStartingNation(c);
    const u100 = troopUpkeepPerTick({ ...n, troops: 100 });
    const u200 = troopUpkeepPerTick({ ...n, troops: 200 });
    expect(u200).toBeCloseTo(u100 * 2);
    expect(u100).toBeGreaterThan(0);
  });

  it('maxTroops is 2% of population', () => {
    const c = makeCountry({ id: 'A', population: 1_000_000 });
    expect(maxTroops(c)).toBe(20_000);
  });

  it('starting nation has positive gold and troops', () => {
    const c = makeCountry({ id: 'A', baseEconomy: 8 });
    const n = makeStartingNation(c);
    expect(n.gold).toBeGreaterThan(0);
    expect(n.troops).toBeGreaterThan(0);
    expect(n.tech).toBe(1);
  });

  it('tech increments shrink as tech grows (diminishing returns)', () => {
    const at1 = techIncrement(1);
    const at10 = techIncrement(10);
    expect(at1).toBeGreaterThan(at10);
    expect(at10).toBeGreaterThan(0);
  });
});
