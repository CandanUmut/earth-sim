/**
 * War goals and structured peace deals. A `War` exists for the duration of a
 * stance === 'war' relationship between two nations, tracking claims and
 * exhaustion so that wars have a satisfying ending shape (you signed peace
 * because you got what you came for, not because the timer ran out).
 *
 * Wars are ID-keyed so we can hold one record per pair even when stance is
 * mutated mid-tick. The id is `warKey(a, b)` — order-independent.
 *
 * Backwards compat: AI-declared wars still create a War record but with empty
 * goals, which means white peace is always achievable.
 */

import type { Country } from './world';
import { BALANCE_WARS } from './balance';
import type { Nation } from './economy';
import { totalTroops } from './economy';

export type WarGoalKind = 'annex_tile' | 'vassalize' | 'tribute';

export type WarGoal = {
  kind: WarGoalKind;
  /** annex_tile → tile id; vassalize/tribute → defender's nation id. */
  targetId: string;
};

export type War = {
  id: string;
  attackerId: string;
  defenderId: string;
  startedAtTick: number;
  attackerGoals: WarGoal[];
  /** 0–100. Rises with battles lost, tiles lost, time. At 100, peace is forced. */
  attackerExhaustion: number;
  defenderExhaustion: number;
};

/** Order-independent key so lookups don't depend on who declared. */
export function warKey(a: string, b: string): string {
  return a < b ? `war:${a}|${b}` : `war:${b}|${a}`;
}

export function findWar(
  wars: Record<string, War>,
  a: string,
  b: string,
): War | null {
  return wars[warKey(a, b)] ?? null;
}

export function goalWeight(kind: WarGoalKind): number {
  return BALANCE_WARS.goalWeights[kind];
}

/**
 * Exhaustion the loser must reach before they will sign peace giving up these
 * claims. White peace (no claims) requires only the floor.
 */
export function peaceThreshold(goals: WarGoal[]): number {
  if (goals.length === 0) return BALANCE_WARS.whitePeaceMinExhaustion;
  return goals.reduce((sum, g) => sum + goalWeight(g.kind), 0);
}

/**
 * Maximum claims a player can attach to a declaration based on relative
 * strength vs. the defender. Weaker attackers must commit smaller wars.
 */
export function maxClaimsForRatio(ratio: number): number {
  let max = 0;
  for (const tier of BALANCE_WARS.maxClaimsByStrengthRatio) {
    if (ratio >= tier.ratio) max = tier.max;
  }
  return max;
}

export function maxClaimsByPower(
  attacker: Nation,
  defender: Nation,
): number {
  const a = totalTroops(attacker) * Math.max(0.1, attacker.tech);
  const d = totalTroops(defender) * Math.max(0.1, defender.tech);
  const ratio = a / Math.max(1, d);
  return maxClaimsForRatio(ratio);
}

let warSerial = 0;
function newWarId(): string {
  warSerial += 1;
  return `${warSerial}-${Date.now().toString(36)}`;
}

export function createWar(args: {
  attackerId: string;
  defenderId: string;
  startedAtTick: number;
  goals: WarGoal[];
}): War {
  return {
    id: newWarId(),
    attackerId: args.attackerId,
    defenderId: args.defenderId,
    startedAtTick: args.startedAtTick,
    attackerGoals: args.goals.slice(),
    attackerExhaustion: 0,
    defenderExhaustion: 0,
  };
}

export function bumpExhaustionFromBattle(
  war: War,
  attackerLost: boolean,
  tileFlipped: boolean,
): War {
  let attackerExhaustion = war.attackerExhaustion;
  let defenderExhaustion = war.defenderExhaustion;
  if (attackerLost) {
    attackerExhaustion += BALANCE_WARS.exhaustionPerBattleLost;
  } else {
    defenderExhaustion += BALANCE_WARS.exhaustionPerBattleLost;
  }
  if (tileFlipped) {
    // Whoever ended up on the losing side of a tile flip eats more exhaustion.
    if (attackerLost) attackerExhaustion += BALANCE_WARS.exhaustionPerTileLost;
    else defenderExhaustion += BALANCE_WARS.exhaustionPerTileLost;
  }
  return {
    ...war,
    attackerExhaustion: Math.min(100, attackerExhaustion),
    defenderExhaustion: Math.min(100, defenderExhaustion),
  };
}

/** Time pressure: every BALANCE_WARS.exhaustionTickInterval ticks, both sides
 *  gain a small amount of exhaustion. Long wars become harder to sustain. */
export function applyTimeExhaustion(war: War, tickCount: number): War {
  const elapsed = tickCount - war.startedAtTick;
  if (elapsed <= 0) return war;
  if (elapsed % BALANCE_WARS.exhaustionTickInterval !== 0) return war;
  return {
    ...war,
    attackerExhaustion: Math.min(
      100,
      war.attackerExhaustion + BALANCE_WARS.exhaustionPerTimeTick,
    ),
    defenderExhaustion: Math.min(
      100,
      war.defenderExhaustion + BALANCE_WARS.exhaustionPerTimeTick,
    ),
  };
}

/**
 * Decision: will `evaluatorId` accept a peace deal where attacker keeps
 * `claims`? Pure function so tests and UI previews share logic.
 */
export function evaluatePeaceDeal(args: {
  war: War;
  /** Who is being asked to accept. The other side proposed. */
  evaluatorId: string;
  claims: WarGoal[];
  /** Forced peace ignores threshold (used at exhaustion 100). */
  forced?: boolean;
}): { accept: boolean; reason: string } {
  const { war, evaluatorId, claims, forced } = args;
  if (forced) return { accept: true, reason: 'War exhaustion forces peace.' };

  const evaluatorIsAttacker = evaluatorId === war.attackerId;
  const evalExhaustion = evaluatorIsAttacker
    ? war.attackerExhaustion
    : war.defenderExhaustion;

  // Claims always express attacker demands. If evaluator IS the attacker and
  // the proposal asks them to drop some demands, they're more amenable when
  // tired and less so when winning.
  if (evaluatorIsAttacker) {
    const demanded = war.attackerGoals.length;
    const offered = claims.length;
    const givingUp = demanded - offered;
    if (givingUp <= 0) {
      // Defender offered to satisfy every demand → attacker always accepts.
      return { accept: true, reason: 'All war goals met.' };
    }
    // Attacker willingness to drop claims rises with their own exhaustion.
    const droppingPenalty = givingUp * 25;
    const accept = evalExhaustion >= droppingPenalty;
    return {
      accept,
      reason: accept
        ? 'War weariness — willing to settle for less.'
        : 'Not yet exhausted enough to drop demands.',
    };
  }

  // Defender side. They evaluate "how much does this hurt me?"
  const threshold = peaceThreshold(claims);
  const accept = evalExhaustion >= threshold;
  return {
    accept,
    reason: accept
      ? 'Defender is too exhausted to keep fighting.'
      : `Defender would only accept once exhaustion ≥ ${threshold}.`,
  };
}

/**
 * Apply an accepted peace deal: returns mutations to ownership, nations, and
 * the war record removal. Caller (store/tick) merges these into state.
 */
export type PeaceOutcome = {
  /** Tile ids to transfer to attacker. */
  tilesToAttacker: string[];
  /** Set defender as vassal of attacker. */
  vassalize: boolean;
  /** Tribute amount per tick from defender → attacker. */
  tribute: number;
  /** War id to remove. */
  warIdToRemove: string;
};

export function buildPeaceOutcome(
  war: War,
  acceptedClaims: WarGoal[],
  countries: Record<string, Country>,
): PeaceOutcome {
  const out: PeaceOutcome = {
    tilesToAttacker: [],
    vassalize: false,
    tribute: 0,
    warIdToRemove: war.id,
  };
  for (const g of acceptedClaims) {
    if (g.kind === 'annex_tile') out.tilesToAttacker.push(g.targetId);
    if (g.kind === 'vassalize') out.vassalize = true;
    if (g.kind === 'tribute') {
      const country = countries[war.defenderId];
      if (country) {
        out.tribute += Math.max(
          1,
          Math.round(country.baseEconomy * BALANCE_WARS.tributeFromWarFraction),
        );
      }
    }
  }
  return out;
}
