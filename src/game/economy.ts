import type { Country, Specialization } from './world';
import { BALANCE, BALANCE_TROOPS, BALANCE_SPECS, BALANCE_BARRACKS } from './balance';
import {
  goldIncomeMultiplier,
  recruitCostMultiplier,
  type TechNodeId,
} from './techTree';

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
  /** Tech-tree nodes this nation has unlocked. */
  unlockedTech: TechNodeId[];
  /** Auto-recruit toggle (only honored if log_conscription unlocked). */
  autoRecruit: boolean;
  /** Barracks level 1–5; raises bulk-recruit cap and shaves recruit cost. */
  barracksLevel: number;
  /** Reputation 0–100. High = trustworthy; AI accepts more deals. Low =
   *  suspicious; AI refuses, joins coalitions, breaks alliances. */
  reputation: number;
  /** Other nation ids this one currently trades with. Mutually maintained. */
  tradePartners: string[];
  /** Gold/tick this nation pays as tribute, keyed by the overlord they pay. */
  tributePaid: Record<string, number>;
  /** Gold/tick this nation receives in tribute, keyed by the tributary. */
  tributeReceived: Record<string, number>;
  /** If non-null, this nation is a vassal of `vassalOf`. */
  vassalOf: string | null;
  /** Nations who are vassals of this one. Mirror of vassalOf. */
  vassals: string[];
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
    unlockedTech: [],
    autoRecruit: false,
    barracksLevel: 1,
    reputation: 50,
    tradePartners: [],
    tributePaid: {},
    tributeReceived: {},
    vassalOf: null,
    vassals: [],
  };
}

/** Specialization + tech-aware gold income. */
export function goldPerTick(
  country: Country,
  nation: Nation,
  ownedTerritories: number,
): number {
  const territoryFactor = 1 + ownedTerritories * BALANCE.territoryEconomyBonus;
  const specMul = country.specializations.includes('mercantile')
    ? BALANCE_SPECS.mercantile.goldMul
    : 1;
  const techMul = goldIncomeMultiplier(nation.unlockedTech);
  return country.baseEconomy * nation.tech * territoryFactor * specMul * techMul;
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

/** Cost of recruiting one unit, after specializations, tech and barracks discounts. */
export function recruitCost(
  type: TroopType,
  specs: Specialization[],
  unlockedTech: TechNodeId[] = [],
  barracksLevel: number = 1,
): number {
  let cost: number = BALANCE_TROOPS.cost[type];
  if (type === 'cavalry' && specs.includes('horseBreeders')) {
    cost = Math.max(1, cost - BALANCE_SPECS.horseBreeders.cavalryDiscount);
  } else if (type === 'artillery' && specs.includes('industrial')) {
    cost = Math.max(1, cost - BALANCE_SPECS.industrial.artilleryDiscount);
  }
  const bIdx = clampBarracksLevel(barracksLevel);
  const barracksMul = BALANCE_BARRACKS.costMultiplier[bIdx];
  return Math.max(
    1,
    Math.round(cost * recruitCostMultiplier(unlockedTech) * barracksMul),
  );
}

function clampBarracksLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(BALANCE_BARRACKS.maxLevel, Math.floor(level)));
}

/** Gold cost to upgrade barracks from `currentLevel` → `currentLevel + 1`.
 *  Returns null if already at max. */
export function barracksUpgradeCost(currentLevel: number): number | null {
  const next = clampBarracksLevel(currentLevel) + 1;
  if (next > BALANCE_BARRACKS.maxLevel) return null;
  return BALANCE_BARRACKS.upgradeCosts[next];
}

export function barracksBulkCap(level: number): number {
  return BALANCE_BARRACKS.bulkCap[clampBarracksLevel(level)];
}

export function barracksQuickButtons(level: number): readonly number[] {
  return BALANCE_BARRACKS.quickButtons[clampBarracksLevel(level)];
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
