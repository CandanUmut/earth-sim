import type { Country, Terrain } from './world';

export type CombatSide = {
  troops: number;
  tech: number;
};

export type BattleResult = {
  attackerWon: boolean;
  attackerLosses: number;
  defenderLosses: number;
  attackerSurvivors: number;
  defenderSurvivors: number;
  attackerRoll: number;
  defenderRoll: number;
};

export type Rng = () => number;

export const TERRAIN_BONUS: Record<Terrain, number> = {
  mountain: 0.3,
  island: 0.2,
  forest: 0.15,
  desert: 0.1,
  plains: 0,
};

/** Defender bonus from being on home terrain. */
export function terrainBonus(country: Country): number {
  return TERRAIN_BONUS[country.terrain] ?? 0;
}

/** Random roll multiplier in [0.85, 1.15] using injected RNG. */
function rollVariance(rng: Rng): number {
  return 0.85 + rng() * 0.3;
}

/**
 * Pure battle resolver. Both sides roll
 *   troops * tech * (1 + bonus) * variance
 * Higher roll wins. Loser bleeds 60–90 % of force, winner 20–50 %, scaled by
 * how close the rolls were (close fights bleed both sides hard).
 */
export function resolveBattle(
  attacker: CombatSide,
  defender: CombatSide,
  defenderTerrain: Country,
  rng: Rng = Math.random,
): BattleResult {
  const atkBase = attacker.troops * attacker.tech;
  const defBase = defender.troops * defender.tech * (1 + terrainBonus(defenderTerrain));

  const attackerRoll = atkBase * rollVariance(rng);
  const defenderRoll = defBase * rollVariance(rng);

  const attackerWon = attackerRoll > defenderRoll;
  const high = Math.max(attackerRoll, defenderRoll);
  const low = Math.min(attackerRoll, defenderRoll);
  // closeness in [0, 1]: 1 = identical rolls, 0 = total blowout.
  const closeness = high === 0 ? 0 : low / high;

  // Loser losses: 60% blowout → 90% close fight
  const loserRate = 0.6 + closeness * 0.3;
  // Winner losses: 20% blowout → 50% close fight
  const winnerRate = 0.2 + closeness * 0.3;

  const attackerLossRate = attackerWon ? winnerRate : loserRate;
  const defenderLossRate = attackerWon ? loserRate : winnerRate;

  const attackerLosses = Math.min(
    attacker.troops,
    Math.round(attacker.troops * attackerLossRate),
  );
  const defenderLosses = Math.min(
    defender.troops,
    Math.round(defender.troops * defenderLossRate),
  );

  return {
    attackerWon,
    attackerLosses,
    defenderLosses,
    attackerSurvivors: Math.max(0, attacker.troops - attackerLosses),
    defenderSurvivors: Math.max(0, defender.troops - defenderLosses),
    attackerRoll,
    defenderRoll,
  };
}
