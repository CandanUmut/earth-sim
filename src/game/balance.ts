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

export const BALANCE_WARS = {
  /** How much exhaustion each goal type "costs" the loser to accept. */
  goalWeights: {
    annex_tile: 25,
    vassalize: 60,
    tribute: 15,
  },
  /** Tribute per tick is `defender.baseEconomy * tributeFromWarFraction`. */
  tributeFromWarFraction: 0.22,
  /** Each lost battle bumps the loser's exhaustion by this much. */
  exhaustionPerBattleLost: 4,
  /** Additional exhaustion if the battle flipped a tile. */
  exhaustionPerTileLost: 10,
  /** Both sides accumulate this much exhaustion per `exhaustionTickInterval`. */
  exhaustionPerTimeTick: 1,
  exhaustionTickInterval: 6,
  /** White peace threshold — any peace requires at least this. */
  whitePeaceMinExhaustion: 15,
  /** Tiers: max claims allowed at this strength ratio attacker:defender. */
  maxClaimsByStrengthRatio: [
    { ratio: 0, max: 1 },
    { ratio: 1.5, max: 2 },
    { ratio: 2.5, max: 3 },
  ],
} as const;

export const BALANCE_POLITICS = {
  /** Gold income bonus per active trade partner, as a multiplier. */
  tradePartnerGoldMul: 1.06,
  /** Maximum number of trade partners that count for the bonus. */
  maxTradePartners: 4,
  /** Default tribute as a fraction of demanded nation's gold income. */
  tributeFraction: 0.18,
  /** Reputation cost for backstabbing an alliance. */
  reputationBackstabCost: 30,
  /** Reputation cost for breaking a trade agreement. */
  reputationTradeBreakCost: 8,
  /** Reputation gain per year of honored alliance/trade. */
  reputationHonorGain: 4,
  /** World population share above which a coalition forms against the player. */
  coalitionThreshold: 0.27,
  /** Vassal kicks back this fraction of their gold/tick to overlord. */
  vassalTributeFraction: 0.25,
  /** Max control level at which vassalization can be offered (target must be reduced). */
  vassalizeMaxControl: 35,
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

/**
 * Barracks: an upgradeable building. Level 1 is starting tier (no upgrade).
 * Higher levels enlarge the bulk-recruit batch cap and shave a small
 * percentage off per-unit recruitment cost.
 */
export const BALANCE_BARRACKS = {
  maxLevel: 5,
  /** Index by next-level (level 2 → upgradeCosts[2]). Level 1 is free start. */
  upgradeCosts: [0, 0, 250, 600, 1400, 3000] as const,
  /** Multiplier applied to per-unit recruit cost. Level 1 = 1.0. */
  costMultiplier: [1.0, 1.0, 0.95, 0.9, 0.85, 0.8] as const,
  /** Largest bulk batch the player can buy at once. Level 1 = 25. */
  bulkCap: [0, 25, 75, 200, 500, 1500] as const,
  /** Quick-buy buttons at this level. */
  quickButtons: [
    [],
    [5, 25],
    [25, 75],
    [50, 200],
    [100, 500],
    [250, 1500],
  ] as const,
} as const;
