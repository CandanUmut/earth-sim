/**
 * Active (persistent) battle model. Replaces the old "battle resolves on
 * arrival" flow with a multi-tick fight that the player can watch unfold and
 * intervene in (reinforce or retreat).
 *
 * Each ActiveBattle is anchored to a country (the contested territory). It
 * snapshots the attacker's marching column at arrival; the defender side is
 * read live from the defender nation, so ongoing recruitment / other losses
 * affect this battle naturally.
 */

import type { Country, Specialization } from './world';
import { TROOP_TYPES, type Composition, type TroopType } from './economy';
import { BALANCE_TROOPS, BALANCE_SPECS } from './balance';
import {
  combatTechMultiplier,
  type TechNodeId,
} from './techTree';
import { terrainBonus } from './combat';

export type Rng = () => number;

export type ActiveBattle = {
  id: string;
  locationCountryId: string;
  attackerOwnerId: string;
  defenderOwnerId: string;
  /** Attacker troops engaged in this battle (separate from attacker's home pool). */
  attackerForce: Composition;
  /** Tech snapshot for stable round strength calc. */
  attackerTech: number;
  attackerUnlockedTech: TechNodeId[];
  startedTick: number;
  rounds: number;
  totalAttackerLosses: number;
  totalDefenderLosses: number;
};

export const BALANCE_BATTLE = {
  /** A round per tick (the simulation already runs at 1 tick = 1 month). */
  roundsPerTick: 1,
  /** Per-round loss rate at parity. */
  baseLossRate: 0.14,
  /** Multiplier for the side that loses the round. */
  loserLossMul: 1.7,
  /** Extra control damage per round the attacker wins. */
  controlDamagePerWonRound: { min: 8, max: 18 },
  /** After this many rounds, the battle force-resolves to avoid stall. */
  maxRounds: 12,
  /** If attacker survivors fall below this fraction of starting strength, attacker routs. */
  routThresholdFrac: 0.18,
} as const;

export function totalUnits(c: Composition): number {
  return c.infantry + c.cavalry + c.artillery;
}

let nextBattleSerial = 0;
export function newBattleId(): string {
  nextBattleSerial += 1;
  return `ab-${nextBattleSerial}-${Date.now().toString(36)}`;
}

export function makeActiveBattle(args: {
  locationCountryId: string;
  attackerOwnerId: string;
  defenderOwnerId: string;
  initialAttackerForce: Composition;
  attackerTech: number;
  attackerUnlockedTech: TechNodeId[];
  tickCount: number;
}): ActiveBattle {
  return {
    id: newBattleId(),
    locationCountryId: args.locationCountryId,
    attackerOwnerId: args.attackerOwnerId,
    defenderOwnerId: args.defenderOwnerId,
    attackerForce: { ...args.initialAttackerForce },
    attackerTech: args.attackerTech,
    attackerUnlockedTech: args.attackerUnlockedTech,
    startedTick: args.tickCount,
    rounds: 0,
    totalAttackerLosses: 0,
    totalDefenderLosses: 0,
  };
}

/** Add a marching column's worth of troops to an existing battle. */
export function reinforceActiveBattle(
  battle: ActiveBattle,
  add: Composition,
): ActiveBattle {
  return {
    ...battle,
    attackerForce: {
      infantry: battle.attackerForce.infantry + add.infantry,
      cavalry: battle.attackerForce.cavalry + add.cavalry,
      artillery: battle.attackerForce.artillery + add.artillery,
    },
  };
}

/** Composition-aware strength calc (same shape as combat.ts but exported here
 *  to avoid a cycle). */
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

function distributeLossRate(side: Composition, rate: number): {
  losses: Record<TroopType, number>;
  total: number;
} {
  const losses = {
    infantry: Math.min(side.infantry, Math.round(side.infantry * rate)),
    cavalry: Math.min(side.cavalry, Math.round(side.cavalry * rate)),
    artillery: Math.min(side.artillery, Math.round(side.artillery * rate)),
  };
  return {
    losses,
    total: losses.infantry + losses.cavalry + losses.artillery,
  };
}

export type RoundResult = {
  attackerLosses: Record<TroopType, number>;
  defenderLosses: Record<TroopType, number>;
  attackerWonRound: boolean;
  controlDamage: number;
  /** If true, attacker force is below rout threshold — battle should end. */
  attackerRouted: boolean;
};

/**
 * Run a single round of combat between the active battle's attacker and
 * the live defender pool. This is much smaller than the all-or-nothing
 * `resolveBattle` — about 8–20 % casualties per round, with control
 * dropping if attacker wins.
 */
export function runBattleRound(args: {
  battle: ActiveBattle;
  defenderForce: Composition;
  defenderTech: number;
  defenderUnlockedTech: TechNodeId[];
  defenderCountry: Country;
  defenderSpecs: Specialization[];
  initialAttackerStrengthSnapshot: number;
  rng: Rng;
}): RoundResult {
  const {
    battle,
    defenderForce,
    defenderTech,
    defenderUnlockedTech,
    defenderCountry,
    defenderSpecs,
    initialAttackerStrengthSnapshot,
    rng,
  } = args;

  const atkBase =
    combatStrength(battle.attackerForce, defenderForce) *
    battle.attackerTech *
    combatTechMultiplier(battle.attackerUnlockedTech);
  let defenseMul = 1 + terrainBonus(defenderCountry);
  if (defenderSpecs.includes('fortified')) {
    defenseMul += BALANCE_SPECS.fortified.extraDefenseBonus;
  }
  const defBase =
    combatStrength(defenderForce, battle.attackerForce) *
    defenderTech *
    combatTechMultiplier(defenderUnlockedTech) *
    defenseMul;

  const atkRoll = atkBase * (0.92 + rng() * 0.16);
  const defRoll = defBase * (0.92 + rng() * 0.16);
  const attackerWon = atkRoll > defRoll;

  // Per-round casualty rates: each side around base, loser scaled up.
  const atkRate = attackerWon
    ? BALANCE_BATTLE.baseLossRate * 0.7
    : BALANCE_BATTLE.baseLossRate * BALANCE_BATTLE.loserLossMul;
  const defRate = attackerWon
    ? BALANCE_BATTLE.baseLossRate * BALANCE_BATTLE.loserLossMul
    : BALANCE_BATTLE.baseLossRate * 0.7;

  const atk = distributeLossRate(battle.attackerForce, atkRate);
  const def = distributeLossRate(defenderForce, defRate);

  let controlDamage = 0;
  if (attackerWon) {
    const span =
      BALANCE_BATTLE.controlDamagePerWonRound.max -
      BALANCE_BATTLE.controlDamagePerWonRound.min;
    controlDamage =
      BALANCE_BATTLE.controlDamagePerWonRound.min + rng() * span;
  }

  // Rout: if attacker survivors are too weak compared to the snapshot, retreat.
  const survivorsAfter: Composition = {
    infantry: Math.max(0, battle.attackerForce.infantry - atk.losses.infantry),
    cavalry: Math.max(0, battle.attackerForce.cavalry - atk.losses.cavalry),
    artillery: Math.max(
      0,
      battle.attackerForce.artillery - atk.losses.artillery,
    ),
  };
  const survivorsTotal = totalUnits(survivorsAfter);
  const initialTotal = Math.max(1, initialAttackerStrengthSnapshot);
  const attackerRouted =
    survivorsTotal === 0 ||
    survivorsTotal / initialTotal < BALANCE_BATTLE.routThresholdFrac;

  return {
    attackerLosses: atk.losses,
    defenderLosses: def.losses,
    attackerWonRound: attackerWon,
    controlDamage,
    attackerRouted,
  };
}
