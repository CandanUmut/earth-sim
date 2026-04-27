/**
 * Single source of truth for tunable game constants.
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
  territoryEconomyBonus: 0.1,
  troopUpkeepRate: 0.012, // gold per troop per tick (small armies sustainable)
  maxTroopsPerPopulation: 0.02,
  /** Compound population growth per tick (≈ 0.36 % per year at 12 ticks/year). */
  populationGrowthPerTick: 0.0003,
  /** Gold reserve every nation tries to keep before discretionary spending. */
  maintenanceBufferTicks: 12,
  /** Fraction of surplus gold every nation auto-spends on troops each tick. */
  passiveRecruitFraction: 0.25,

  // Tech investment
  techInvestmentCost: 100,
  techIncrement: 0.05,
  techDiminishingExponent: 0.7,
} as const;

export const BALANCE_TROOPS = {
  /** Recruit cost in gold per unit. */
  cost: {
    infantry: 8,
    cavalry: 18,
    artillery: 32,
  },
  /** How much each unit type contributes per its base efficacy. */
  baseDamage: {
    infantry: 1.0,
    cavalry: 1.25,
    artillery: 1.5,
  },
  /** Rock-paper-scissors modifier — attacker[type] vs defender[type]. */
  rps: {
    infantry: { infantry: 1.0, cavalry: 0.8, artillery: 1.25 },
    cavalry: { infantry: 1.25, cavalry: 1.0, artillery: 0.8 },
    artillery: { infantry: 0.8, cavalry: 1.25, artillery: 1.0 },
  },
  /** Starting composition fractions for AI/auto-build nations. */
  startingMix: {
    infantry: 0.7,
    cavalry: 0.25,
    artillery: 0.05,
  },
} as const;

export const BALANCE_MOVEMENT = {
  homeGarrisonFraction: 0.1,
  arrivalTrailMs: 3000,
} as const;

export const BALANCE_AI = {
  personalityDistribution: {
    aggressive: 25,
    defensive: 25,
    opportunist: 25,
    isolationist: 15,
    merchant: 10,
  },
  thinkCadenceMin: 3,
  thinkCadenceMax: 8,
  weakNeighborRatio: 0.6,
  attackCommitFraction: 0.7,
  surplusGoldForInvest: 200,
  allianceAcceptStrengthRatio: 0.6,
} as const;

export const BALANCE_VICTORY = {
  populationShareToWin: 0.6,
} as const;

export const BALANCE_CONTROL = {
  fullControl: 100,
  damagePerVictoryMin: 35,
  damagePerVictoryMax: 70,
  regenPerTick: 2,
  regenGraceTicks: 6,
} as const;

/** Specialization-driven multipliers and discounts. */
export const BALANCE_SPECS = {
  mercantile: { goldMul: 1.25 },
  martial: { troopCapMul: 1.25 },
  fortified: { extraDefenseBonus: 0.2 },
  horseBreeders: { cavalryDiscount: 5 },
  industrial: { artilleryDiscount: 10 },
  scholarly: { techRoiMul: 1.5 },
} as const;
