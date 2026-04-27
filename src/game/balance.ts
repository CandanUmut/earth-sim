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
  techDiminishingExponent: 0.7,
} as const;

export const BALANCE_MOVEMENT = {
  /** Fraction of troops that must remain at home as garrison. */
  homeGarrisonFraction: 0.1,
} as const;

export const BALANCE_AI = {
  // Distribution must sum to 100.
  personalityDistribution: {
    aggressive: 25,
    defensive: 25,
    opportunist: 25,
    isolationist: 15,
    merchant: 10,
  },
  /** Min/max ticks between AI thoughts (chosen per nation). */
  thinkCadenceMin: 3,
  thinkCadenceMax: 8,
  /** Attack threshold: target troops < this fraction of mine to be tempting. */
  weakNeighborRatio: 0.6,
  /** Fraction of own troops committed to an AI attack. */
  attackCommitFraction: 0.7,
  /** Defensive AI requires this much surplus gold to invest. */
  surplusGoldForInvest: 200,
  /** Aggressive AI alliance interest threshold. */
  allianceAcceptStrengthRatio: 0.6,
} as const;

export const BALANCE_VICTORY = {
  populationShareToWin: 0.6,
} as const;
