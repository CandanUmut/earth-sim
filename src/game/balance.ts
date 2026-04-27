/**
 * Single source of truth for tunable game constants. Phase 4 will lean on
 * this for balance passes — keeping it as a flat object so it's trivial to
 * load/dump for tuning experiments.
 */
export const BALANCE = {
  // Time
  ticksPerYear: 12,
  msPerTickAt1x: 1000,

  // Starting state
  startingGoldPerEconomy: 30,
  startingTroopsPerEconomy: 5,
  startingTech: 1.0,

  // Player bonus on game start
  playerGoldMultiplier: 2.0,
  playerTroopMultiplier: 1.5,

  // Economy
  goldPerTickFormula: 'baseEconomy * tech * (1 + ownedTerritories * 0.1)',
  territoryEconomyBonus: 0.1,
  troopUpkeepRate: 0.05, // gold per troop per tick
  maxTroopsPerPopulation: 0.02,

  // Recruitment
  goldPerTroopRecruited: 10,

  // Tech investment
  techInvestmentCost: 100,
  techIncrement: 0.05,
  techDiminishingExponent: 0.7, // returns scale by tech^-exp so growth slows
} as const;
