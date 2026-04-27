import type { Country, Specialization } from './world';
import { BALANCE, BALANCE_TROOPS, BALANCE_SPECS } from './balance';

export type Stance = 'war' | 'neutral' | 'allied';

export const TROOP_TYPES = ['infantry', 'cavalry', 'artillery'] as const;
export type TroopType = (typeof TROOP_TYPES)[number];

export type Composition = Record<TroopType, number>;

export type Nation = {
  gold: number;
  infantry: number;
  cavalry: number;
  artillery: number;
  tech: number;
  stance: Record<string, Stance>;
};

export const TROOP_LABELS: Record<TroopType, string> = {
  infantry: 'Infantry',
  cavalry: 'Cavalry',
  artillery: 'Artillery',
};

export const TROOP_SHORT: Record<TroopType, string> = {
  infantry: 'Inf',
  cavalry: 'Cav',
  artillery: 'Art',
};

export function totalTroops(n: {
  infantry: number;
  cavalry: number;
  artillery: number;
}): number {
  return n.infantry + n.cavalry + n.artillery;
}

export function asComposition(n: Nation): Composition {
  return {
    infantry: n.infantry,
    cavalry: n.cavalry,
    artillery: n.artillery,
  };
}

export function makeStartingNation(country: Country): Nation {
  const total = country.baseEconomy * BALANCE.startingTroopsPerEconomy;
  const mix = BALANCE_TROOPS.startingMix;
  return {
    gold: country.baseEconomy * BALANCE.startingGoldPerEconomy,
    infantry: Math.round(total * mix.infantry),
    cavalry: Math.round(total * mix.cavalry),
    artillery: Math.round(total * mix.artillery),
    tech: BALANCE.startingTech,
    stance: {},
  };
}

/** Specialization-aware gold income. */
export function goldPerTick(
  country: Country,
  nation: Nation,
  ownedTerritories: number,
): number {
  const territoryFactor = 1 + ownedTerritories * BALANCE.territoryEconomyBonus;
  const specMul = country.specializations.includes('mercantile')
    ? BALANCE_SPECS.mercantile.goldMul
    : 1;
  return country.baseEconomy * nation.tech * territoryFactor * specMul;
}

/** Total upkeep across all troop types. Cavalry / artillery cost more. */
export function troopUpkeepPerTick(nation: Nation): number {
  const inf = nation.infantry * BALANCE.troopUpkeepRate;
  const cav = nation.cavalry * BALANCE.troopUpkeepRate * 1.4;
  const art = nation.artillery * BALANCE.troopUpkeepRate * 1.7;
  return inf + cav + art;
}

export function maxTroops(country: Country): number {
  const baseCap = Math.floor(
    country.population * BALANCE.maxTroopsPerPopulation,
  );
  if (country.specializations.includes('martial')) {
    return Math.floor(baseCap * BALANCE_SPECS.martial.troopCapMul);
  }
  return baseCap;
}

/** Cost of recruiting one unit of the given type, after specializations. */
export function recruitCost(
  type: TroopType,
  specs: Specialization[],
): number {
  let cost: number = BALANCE_TROOPS.cost[type];
  if (type === 'cavalry' && specs.includes('horseBreeders')) {
    cost = Math.max(1, cost - BALANCE_SPECS.horseBreeders.cavalryDiscount);
  } else if (type === 'artillery' && specs.includes('industrial')) {
    cost = Math.max(1, cost - BALANCE_SPECS.industrial.artilleryDiscount);
  }
  return cost;
}

export function techInvestmentCost(): number {
  return BALANCE.techInvestmentCost;
}

export function techIncrement(
  currentTech: number,
  specs: Specialization[] = [],
): number {
  const dampening = Math.pow(currentTech, BALANCE.techDiminishingExponent);
  let inc = BALANCE.techIncrement / Math.max(1, dampening);
  if (specs.includes('scholarly')) {
    inc *= BALANCE_SPECS.scholarly.techRoiMul;
  }
  return inc;
}
