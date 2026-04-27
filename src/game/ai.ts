import type { Country } from './world';
import type { Nation } from './economy';
import { findPath } from './movement';
import { BALANCE_AI, BALANCE_MOVEMENT } from './balance';

export type Personality =
  | 'aggressive'
  | 'defensive'
  | 'opportunist'
  | 'isolationist'
  | 'merchant';

export type AIBrain = {
  personality: Personality;
  thinkCadence: number;
  ticksSinceThink: number;
};

export type AIAction =
  | { kind: 'idle' }
  | { kind: 'recruit' }
  | { kind: 'invest_tech' }
  | { kind: 'dispatch'; fromId: string; toId: string; troops: number }
  | { kind: 'declare_war'; targetId: string }
  | { kind: 'propose_peace'; targetId: string }
  | { kind: 'propose_alliance'; targetId: string };

/** Sample a personality from the configured distribution using a uniform RNG. */
export function samplePersonality(rng: () => number = Math.random): Personality {
  const dist = BALANCE_AI.personalityDistribution;
  const total =
    dist.aggressive +
    dist.defensive +
    dist.opportunist +
    dist.isolationist +
    dist.merchant;
  let r = rng() * total;
  if ((r -= dist.aggressive) < 0) return 'aggressive';
  if ((r -= dist.defensive) < 0) return 'defensive';
  if ((r -= dist.opportunist) < 0) return 'opportunist';
  if ((r -= dist.isolationist) < 0) return 'isolationist';
  return 'merchant';
}

export function newBrain(rng: () => number = Math.random): AIBrain {
  const cadenceSpan =
    BALANCE_AI.thinkCadenceMax - BALANCE_AI.thinkCadenceMin + 1;
  return {
    personality: samplePersonality(rng),
    thinkCadence:
      BALANCE_AI.thinkCadenceMin + Math.floor(rng() * cadenceSpan),
    ticksSinceThink: Math.floor(rng() * cadenceSpan),
  };
}

type DecideContext = {
  selfId: string;
  countries: Record<string, Country>;
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  brain: AIBrain;
  rng: () => number;
};

/**
 * Pure decision function. Returns an action descriptor or `idle`. Does NOT
 * mutate any state — caller validates and applies.
 */
export function decideAction(ctx: DecideContext): AIAction {
  const { selfId, countries, ownership, nations, brain, rng } = ctx;
  const country = countries[selfId];
  const nation = nations[selfId];
  if (!country || !nation) return { kind: 'idle' };

  // Reachable enemy/neutral neighbors of MY OWNED territory.
  const myTerritories: string[] = [];
  for (const [tid, owner] of Object.entries(ownership)) {
    if (owner === selfId) myTerritories.push(tid);
  }

  // Identify weakest reachable foreign neighbor.
  type Target = {
    id: string;
    fromId: string;
    troops: number;
    population: number;
  };
  const candidates: Target[] = [];
  const seen = new Set<string>();
  for (const myId of myTerritories) {
    const myCountry = countries[myId];
    if (!myCountry) continue;
    for (const nbr of myCountry.neighbors) {
      if (seen.has(nbr)) continue;
      seen.add(nbr);
      const ownerOfNbr = ownership[nbr];
      if (!ownerOfNbr || ownerOfNbr === selfId) continue;
      // Skip allies.
      if (nation.stance[ownerOfNbr] === 'allied') continue;
      const nbrNation = nations[ownerOfNbr];
      const nbrCountry = countries[nbr];
      if (!nbrNation || !nbrCountry) continue;
      candidates.push({
        id: nbr,
        fromId: myId,
        troops: nbrNation.troops,
        population: nbrCountry.population,
      });
    }
  }
  candidates.sort((a, b) => a.troops - b.troops);
  const weakest = candidates[0];

  // Strongest threat at war with me, for peace overtures.
  let warringStronger: { ownerId: string; troops: number } | null = null;
  for (const [otherId, stance] of Object.entries(nation.stance)) {
    if (stance !== 'war') continue;
    const otherNation = nations[otherId];
    if (!otherNation) continue;
    if (otherNation.troops > nation.troops) {
      if (!warringStronger || otherNation.troops > warringStronger.troops) {
        warringStronger = { ownerId: otherId, troops: otherNation.troops };
      }
    }
  }

  const wantsAttack = (committedFraction: number, weakRatio: number) => {
    if (!weakest) return null;
    if (weakest.troops > nation.troops * weakRatio) return null;
    const garrison = Math.floor(
      nation.troops * BALANCE_MOVEMENT.homeGarrisonFraction,
    );
    const available = nation.troops - garrison;
    const commit = Math.floor(available * committedFraction);
    if (commit < 5) return null;
    // Path must exist.
    const path = findPath(countries, weakest.fromId, weakest.id);
    if (!path) return null;
    return {
      kind: 'dispatch' as const,
      fromId: weakest.fromId,
      toId: weakest.id,
      troops: commit,
    };
  };

  const surplus = nation.gold - 50; // keep a small reserve
  const canInvest = nation.gold >= 100;
  const canRecruit = nation.gold >= 50;

  switch (brain.personality) {
    case 'aggressive': {
      const attack = wantsAttack(
        BALANCE_AI.attackCommitFraction,
        BALANCE_AI.weakNeighborRatio,
      );
      if (attack) return attack;
      if (warringStronger && rng() < 0.15) {
        return { kind: 'propose_alliance', targetId: pickFriendlyId(nations, selfId, warringStronger.ownerId, rng) ?? warringStronger.ownerId };
      }
      if (canRecruit) return { kind: 'recruit' };
      if (canInvest) return { kind: 'invest_tech' };
      return { kind: 'idle' };
    }
    case 'defensive': {
      if (warringStronger) {
        // Try to make peace if losing.
        if (nation.troops < warringStronger.troops * 0.7 && rng() < 0.5) {
          return { kind: 'propose_peace', targetId: warringStronger.ownerId };
        }
        if (canRecruit) return { kind: 'recruit' };
      }
      // Attack only obvious pushovers.
      const attack = wantsAttack(0.4, BALANCE_AI.weakNeighborRatio * 0.5);
      if (attack) return attack;
      if (canInvest && surplus > 200) return { kind: 'invest_tech' };
      if (canRecruit) return { kind: 'recruit' };
      return { kind: 'idle' };
    }
    case 'opportunist': {
      const attack = wantsAttack(0.6, BALANCE_AI.weakNeighborRatio);
      if (attack) return attack;
      if (canInvest && rng() < 0.5) return { kind: 'invest_tech' };
      if (canRecruit) return { kind: 'recruit' };
      return { kind: 'idle' };
    }
    case 'isolationist': {
      if (warringStronger && rng() < 0.4) {
        return { kind: 'propose_peace', targetId: warringStronger.ownerId };
      }
      if (canInvest && nation.gold >= BALANCE_AI.surplusGoldForInvest) {
        return { kind: 'invest_tech' };
      }
      if (canRecruit) return { kind: 'recruit' };
      return { kind: 'idle' };
    }
    case 'merchant': {
      if (canInvest && rng() < 0.7) return { kind: 'invest_tech' };
      // Only attack a totally crushed neighbor.
      const attack = wantsAttack(0.3, 0.3);
      if (attack) return attack;
      if (canRecruit) return { kind: 'recruit' };
      return { kind: 'idle' };
    }
  }
}

function pickFriendlyId(
  nations: Record<string, Nation>,
  selfId: string,
  excludeId: string,
  rng: () => number,
): string | null {
  const candidates: string[] = [];
  for (const [id, n] of Object.entries(nations)) {
    if (id === selfId || id === excludeId) continue;
    const s = n.stance[selfId];
    if (s !== 'war') candidates.push(id);
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

/** Should the target accept an alliance proposal from the proposer? */
export function evaluateAllianceProposal(args: {
  proposerId: string;
  targetId: string;
  nations: Record<string, Nation>;
  brain: AIBrain;
}): boolean {
  const { proposerId, targetId, nations, brain } = args;
  const target = nations[targetId];
  const proposer = nations[proposerId];
  if (!target || !proposer) return false;
  if (target.stance[proposerId] === 'war') return false;

  const strengthRatio =
    proposer.troops / Math.max(1, target.troops);

  switch (brain.personality) {
    case 'aggressive':
      return strengthRatio > 0.8 && Math.random() < 0.3;
    case 'defensive':
      return strengthRatio > BALANCE_AI.allianceAcceptStrengthRatio;
    case 'opportunist':
      return strengthRatio > 0.5 && Math.random() < 0.5;
    case 'isolationist':
      return strengthRatio > 1.2 && Math.random() < 0.2;
    case 'merchant':
      return strengthRatio > 0.4 && Math.random() < 0.7;
  }
}

/** Should the target accept a peace overture from the proposer? */
export function evaluatePeaceProposal(args: {
  proposerId: string;
  targetId: string;
  nations: Record<string, Nation>;
  brain: AIBrain;
}): boolean {
  const { proposerId, targetId, nations, brain } = args;
  const target = nations[targetId];
  const proposer = nations[proposerId];
  if (!target || !proposer) return false;
  if (target.stance[proposerId] !== 'war') return true;

  const strengthRatio = proposer.troops / Math.max(1, target.troops);
  switch (brain.personality) {
    case 'aggressive':
      return strengthRatio > 1.2; // peace only if losing
    case 'defensive':
      return strengthRatio > 0.5;
    case 'opportunist':
      return strengthRatio > 0.8;
    case 'isolationist':
      return true;
    case 'merchant':
      return true;
  }
}

export const __test = { samplePersonality };
