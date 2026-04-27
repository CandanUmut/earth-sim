import { describe, it, expect } from 'vitest';
import {
  goldPerTick,
  troopUpkeepPerTick,
  maxTroops,
  makeStartingNation,
  techIncrement,
  recruitCost,
  totalTroops,
} from './economy';
import { makeCountry } from './testHelpers';

describe('economy', () => {
  it('gold income scales with tech and territory', () => {
    const c = makeCountry({ id: 'A', baseEconomy: 10 });
    const n = makeStartingNation(c);
    const oneTerr = goldPerTick(c, n, 1);
    const tenTerr = goldPerTick(c, n, 10);
    expect(tenTerr).toBeGreaterThan(oneTerr);
    expect(oneTerr).toBeCloseTo(11);
    expect(tenTerr).toBeCloseTo(20);
  });

  it('mercantile specialization boosts gold income', () => {
    const plain = makeCountry({ id: 'A', baseEconomy: 10 });
    const merc = makeCountry({
      id: 'B',
      baseEconomy: 10,
      specializations: ['mercantile'],
    });
    const n = makeStartingNation(plain);
    expect(goldPerTick(merc, n, 1)).toBeGreaterThan(goldPerTick(plain, n, 1));
  });

  it('upkeep is positive and proportional to total troops', () => {
    const c = makeCountry({ id: 'A', baseEconomy: 5 });
    const n = makeStartingNation(c);
    const u100Inf = troopUpkeepPerTick({
      ...n,
      infantry: 100,
      cavalry: 0,
      artillery: 0,
    });
    const u100Cav = troopUpkeepPerTick({
      ...n,
      infantry: 0,
      cavalry: 100,
      artillery: 0,
    });
    expect(u100Cav).toBeGreaterThan(u100Inf); // cavalry costs more
    expect(u100Inf).toBeGreaterThan(0);
  });

  it('maxTroops is 2% of population (more if martial)', () => {
    const c = makeCountry({ id: 'A', population: 1_000_000 });
    expect(maxTroops(c)).toBe(20_000);
    const martial = makeCountry({
      id: 'B',
      population: 1_000_000,
      specializations: ['martial'],
    });
    expect(maxTroops(martial)).toBeGreaterThan(maxTroops(c));
  });

  it('starting nation has positive gold and a mixed composition', () => {
    const c = makeCountry({ id: 'A', baseEconomy: 8 });
    const n = makeStartingNation(c);
    expect(n.gold).toBeGreaterThan(0);
    expect(totalTroops(n)).toBeGreaterThan(0);
    expect(n.infantry).toBeGreaterThan(n.cavalry);
    expect(n.tech).toBe(1);
  });

  it('tech increments shrink as tech grows; scholarly boosts ROI', () => {
    const at1 = techIncrement(1, []);
    const at10 = techIncrement(10, []);
    expect(at1).toBeGreaterThan(at10);
    expect(techIncrement(5, ['scholarly'])).toBeGreaterThan(techIncrement(5, []));
  });

  it('horseBreeders cuts cavalry recruit cost', () => {
    expect(recruitCost('cavalry', ['horseBreeders'])).toBeLessThan(
      recruitCost('cavalry', []),
    );
    // Other types unaffected.
    expect(recruitCost('infantry', ['horseBreeders'])).toBe(
      recruitCost('infantry', []),
    );
  });
});
