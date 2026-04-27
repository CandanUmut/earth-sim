import type { Country } from './world';
import { BALANCE } from './balance';

export type Stance = 'war' | 'neutral' | 'allied';

export type Nation = {
  gold: number;
  troops: number;
  tech: number;
  stance: Record<string, Stance>;
};

export function makeStartingNation(country: Country): Nation {
  return {
    gold: country.baseEconomy * BALANCE.startingGoldPerEconomy,
    troops: Math.round(country.baseEconomy * BALANCE.startingTroopsPerEconomy),
    tech: BALANCE.startingTech,
    stance: {},
  };
}

/** Gold income per tick for a nation given how many countries they own. */
export function goldPerTick(
  country: Country,
  nation: Nation,
  ownedTerritories: number,
): number {
  const territoryFactor = 1 + ownedTerritories * BALANCE.territoryEconomyBonus;
  return country.baseEconomy * nation.tech * territoryFactor;
}

/** Gold drained by upkeep each tick. */
export function troopUpkeepPerTick(nation: Nation): number {
  return nation.troops * BALANCE.troopUpkeepRate;
}

/** Hard cap on how many troops a country can field. */
export function maxTroops(country: Country): number {
  return Math.floor(country.population * BALANCE.maxTroopsPerPopulation);
}

/**
 * Cost of buying a single troop. Flat for Phase 2; Phase 4 may bend it
 * with a marginal-cost curve.
 */
export function recruitCost(): number {
  return BALANCE.goldPerTroopRecruited;
}

/** Cost of one tech investment step. */
export function techInvestmentCost(): number {
  return BALANCE.techInvestmentCost;
}

/**
 * Tech increment with diminishing returns: each successive level grants a
 * smaller absolute bump. Keeps tech from exploding without artificial caps.
 */
export function techIncrement(currentTech: number): number {
  const dampening = Math.pow(currentTech, BALANCE.techDiminishingExponent);
  return BALANCE.techIncrement / Math.max(1, dampening);
}
