import type { Country, Specialization, Terrain } from './world';
import { TROOP_TYPES, type Composition, type TroopType } from './economy';
import { BALANCE_TROOPS, BALANCE_SPECS } from './balance';

export type CombatSide = Composition & { tech: number };

export type LossesByType = Record<TroopType, number>;

export type BattleResult = {
  attackerWon: boolean;
  attackerLosses: LossesByType;
  defenderLosses: LossesByType;
  attackerSurvivors: Composition;
  defenderSurvivors: Composition;
  attackerRoll: number;
  defenderRoll: number;
  totalAttackerLosses: number;
  totalDefenderLosses: number;
};

export type Rng = () => number;

export const TERRAIN_BONUS: Record<Terrain, number> = {
  mountain: 0.3,
  island: 0.2,
  forest: 0.15,
  desert: 0.1,
  plains: 0,
};

export function terrainBonus(country: Country): number {
  return TERRAIN_BONUS[country.terrain] ?? 0;
}

function totalUnits(c: Composition): number {
  return c.infantry + c.cavalry + c.artillery;
}

/**
 * Composition-aware combat strength. Each unit type's contribution is
 * multiplied by an RPS factor against the opposing side's mix:
 *   strength = sum_type ( count_t * baseDamage_t * sum_d ( rps[t][d] * opp_d / oppTotal ) )
 * If the opponent has no troops the factor is 1 (pure base damage).
 */
function combatStrength(self: Composition, opposing: Composition): number {
  const oppTotal = totalUnits(opposing);
  let str = 0;
  for (const t of TROOP_TYPES) {
    const myCount = self[t];
    if (myCount === 0) continue;
    let typeMul: number;
    if (oppTotal === 0) {
      typeMul = 1;
    } else {
      typeMul = 0;
      for (const d of TROOP_TYPES) {
        typeMul += BALANCE_TROOPS.rps[t][d] * (opposing[d] / oppTotal);
      }
    }
    str += myCount * BALANCE_TROOPS.baseDamage[t] * typeMul;
  }
  return str;
}

function rollVariance(rng: Rng): number {
  return 0.85 + rng() * 0.3;
}

/** Distribute a total loss rate over the three troop types proportionally. */
function distributeLosses(side: Composition, lossRate: number): LossesByType {
  return {
    infantry: Math.min(side.infantry, Math.round(side.infantry * lossRate)),
    cavalry: Math.min(side.cavalry, Math.round(side.cavalry * lossRate)),
    artillery: Math.min(side.artillery, Math.round(side.artillery * lossRate)),
  };
}

function applyLosses(side: Composition, losses: LossesByType): Composition {
  return {
    infantry: Math.max(0, side.infantry - losses.infantry),
    cavalry: Math.max(0, side.cavalry - losses.cavalry),
    artillery: Math.max(0, side.artillery - losses.artillery),
  };
}

export function resolveBattle(
  attacker: CombatSide,
  defender: CombatSide,
  defenderTerrain: Country,
  defenderSpecs: Specialization[] = defenderTerrain.specializations,
  rng: Rng = Math.random,
): BattleResult {
  const atkBase = combatStrength(attacker, defender) * attacker.tech;
  let defenseMul = 1 + terrainBonus(defenderTerrain);
  if (defenderSpecs.includes('fortified')) {
    defenseMul += BALANCE_SPECS.fortified.extraDefenseBonus;
  }
  const defBase = combatStrength(defender, attacker) * defender.tech * defenseMul;

  const attackerRoll = atkBase * rollVariance(rng);
  const defenderRoll = defBase * rollVariance(rng);

  const attackerWon = attackerRoll > defenderRoll;
  const high = Math.max(attackerRoll, defenderRoll);
  const low = Math.min(attackerRoll, defenderRoll);
  const closeness = high === 0 ? 0 : low / high;

  const loserRate = 0.6 + closeness * 0.3;
  const winnerRate = 0.2 + closeness * 0.3;

  const attackerLossRate = attackerWon ? winnerRate : loserRate;
  const defenderLossRate = attackerWon ? loserRate : winnerRate;

  const attackerLosses = distributeLosses(attacker, attackerLossRate);
  const defenderLosses = distributeLosses(defender, defenderLossRate);

  return {
    attackerWon,
    attackerLosses,
    defenderLosses,
    attackerSurvivors: applyLosses(attacker, attackerLosses),
    defenderSurvivors: applyLosses(defender, defenderLosses),
    attackerRoll,
    defenderRoll,
    totalAttackerLosses:
      attackerLosses.infantry +
      attackerLosses.cavalry +
      attackerLosses.artillery,
    totalDefenderLosses:
      defenderLosses.infantry +
      defenderLosses.cavalry +
      defenderLosses.artillery,
  };
}
