import type { Country } from './world';
import { totalTroops, type Nation, type TroopType } from './economy';
import { findPath } from './movement';
import { BALANCE_AI, BALANCE_MOVEMENT, BALANCE_POLITICS } from './balance';

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

/** Preferred recruit composition per personality (sums to 1). */
export const DOCTRINE_MIX: Record<Personality, Record<TroopType, number>> = {
  aggressive: { infantry: 0.45, cavalry: 0.45, artillery: 0.1 },
  defensive: { infantry: 0.7, cavalry: 0.1, artillery: 0.2 },
  opportunist: { infantry: 0.5, cavalry: 0.35, artillery: 0.15 },
  isolationist: { infantry: 0.6, cavalry: 0.1, artillery: 0.3 },
  merchant: { infantry: 0.65, cavalry: 0.15, artillery: 0.2 },
};

export type AIAction =
  | { kind: 'idle' }
  | { kind: 'recruit'; mix?: Record<TroopType, number> }
  | { kind: 'invest_tech' }
  | { kind: 'dispatch'; fromId: string; toId: string; troops: number }
  | { kind: 'declare_war'; targetId: string }
  | { kind: 'propose_peace'; targetId: string }
  | { kind: 'propose_alliance'; targetId: string };

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

export function decideAction(ctx: DecideContext): AIAction {
  const { selfId, countries, ownership, nations, brain, rng } = ctx;
  const country = countries[selfId];
  const nation = nations[selfId];
  if (!country || !nation) return { kind: 'idle' };

  const myTotal = totalTroops(nation);

  const myTerritories: string[] = [];
  for (const [tid, owner] of Object.entries(ownership)) {
    if (owner === selfId) myTerritories.push(tid);
  }

  type Target = {
    id: string;
    fromId: string;
    troops: number;
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
      if (nation.stance[ownerOfNbr] === 'allied') continue;
      const nbrNation = nations[ownerOfNbr];
      if (!nbrNation) continue;
      candidates.push({
        id: nbr,
        fromId: myId,
        troops: totalTroops(nbrNation),
      });
    }
  }
  candidates.sort((a, b) => a.troops - b.troops);
  const weakest = candidates[0];

  let warringStronger: { ownerId: string; troops: number } | null = null;
  for (const [otherId, stance] of Object.entries(nation.stance)) {
    if (stance !== 'war') continue;
    const otherNation = nations[otherId];
    if (!otherNation) continue;
    const ot = totalTroops(otherNation);
    if (ot > myTotal) {
      if (!warringStronger || ot > warringStronger.troops) {
        warringStronger = { ownerId: otherId, troops: ot };
      }
    }
  }

  const wantsAttack = (committedFraction: number, weakRatio: number) => {
    if (!weakest) return null;
    if (weakest.troops > myTotal * weakRatio) return null;
    const garrison = Math.floor(myTotal * BALANCE_MOVEMENT.homeGarrisonFraction);
    const available = myTotal - garrison;
    const commit = Math.floor(available * committedFraction);
    if (commit < 5) return null;
    const path = findPath(countries, weakest.fromId, weakest.id);
    if (!path) return null;
    return {
      kind: 'dispatch' as const,
      fromId: weakest.fromId,
      toId: weakest.id,
      troops: commit,
    };
  };

  const surplus = nation.gold - 50;
  const canInvest = nation.gold >= 100;
  const canRecruit = nation.gold >= 50;
  const mix = DOCTRINE_MIX[brain.personality];

  switch (brain.personality) {
    case 'aggressive': {
      const attack = wantsAttack(
        BALANCE_AI.attackCommitFraction,
        BALANCE_AI.weakNeighborRatio,
      );
      if (attack) return attack;
      if (warringStronger && rng() < 0.15) {
        return {
          kind: 'propose_alliance',
          targetId:
            pickFriendlyId(nations, selfId, warringStronger.ownerId, rng) ??
            warringStronger.ownerId,
        };
      }
      if (canRecruit) return { kind: 'recruit', mix };
      if (canInvest) return { kind: 'invest_tech' };
      return { kind: 'idle' };
    }
    case 'defensive': {
      if (warringStronger) {
        if (myTotal < warringStronger.troops * 0.7 && rng() < 0.5) {
          return { kind: 'propose_peace', targetId: warringStronger.ownerId };
        }
        if (canRecruit) return { kind: 'recruit', mix };
      }
      const attack = wantsAttack(0.4, BALANCE_AI.weakNeighborRatio * 0.5);
      if (attack) return attack;
      if (canInvest && surplus > 200) return { kind: 'invest_tech' };
      if (canRecruit) return { kind: 'recruit', mix };
      return { kind: 'idle' };
    }
    case 'opportunist': {
      const attack = wantsAttack(0.6, BALANCE_AI.weakNeighborRatio);
      if (attack) return attack;
      if (canInvest && rng() < 0.5) return { kind: 'invest_tech' };
      if (canRecruit) return { kind: 'recruit', mix };
      return { kind: 'idle' };
    }
    case 'isolationist': {
      if (warringStronger && rng() < 0.4) {
        return { kind: 'propose_peace', targetId: warringStronger.ownerId };
      }
      if (canInvest && nation.gold >= BALANCE_AI.surplusGoldForInvest) {
        return { kind: 'invest_tech' };
      }
      if (canRecruit) return { kind: 'recruit', mix };
      return { kind: 'idle' };
    }
    case 'merchant': {
      if (canInvest && rng() < 0.7) return { kind: 'invest_tech' };
      const attack = wantsAttack(0.3, 0.3);
      if (attack) return attack;
      if (canRecruit) return { kind: 'recruit', mix };
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

export function evaluateAllianceProposal(args: {
  proposerId: string;
  targetId: string;
  nations: Record<string, Nation>;
  brain: AIBrain;
  /** Bonus to acceptance probability (e.g. Statecraft tech = 2). */
  acceptMultiplier?: number;
}): boolean {
  const { proposerId, targetId, nations, brain } = args;
  const m = args.acceptMultiplier ?? 1;
  const target = nations[targetId];
  const proposer = nations[proposerId];
  if (!target || !proposer) return false;
  if (target.stance[proposerId] === 'war') return false;

  const strengthRatio = totalTroops(proposer) / Math.max(1, totalTroops(target));

  switch (brain.personality) {
    case 'aggressive':
      return strengthRatio > 0.8 && Math.random() < 0.3 * m;
    case 'defensive':
      return strengthRatio > BALANCE_AI.allianceAcceptStrengthRatio;
    case 'opportunist':
      return strengthRatio > 0.5 && Math.random() < 0.5 * m;
    case 'isolationist':
      return strengthRatio > 1.2 && Math.random() < 0.2 * m;
    case 'merchant':
      return strengthRatio > 0.4 && Math.random() < 0.7 * m;
  }
}

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

  const strengthRatio = totalTroops(proposer) / Math.max(1, totalTroops(target));
  switch (brain.personality) {
    case 'aggressive':
      return strengthRatio > 1.2;
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

/** Trade is widely accepted unless reputation is very low or already at war. */
export function evaluateTradeProposal(args: {
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
  if (target.tradePartners.includes(proposerId)) return false;
  // Cap on partners.
  if (
    target.tradePartners.length >= BALANCE_POLITICS.maxTradePartners &&
    brain.personality !== 'merchant'
  ) {
    return false;
  }
  // Reputation check: very low reputation = refusal.
  if (proposer.reputation < 25 && brain.personality !== 'opportunist') {
    return false;
  }
  switch (brain.personality) {
    case 'aggressive':
      return Math.random() < 0.35;
    case 'defensive':
      return Math.random() < 0.55;
    case 'opportunist':
      return Math.random() < 0.7;
    case 'isolationist':
      return Math.random() < 0.25;
    case 'merchant':
      return Math.random() < 0.92;
  }
}

/** Tribute demand: target accepts if much weaker than demander; refuses otherwise. */
export function evaluateTributeDemand(args: {
  proposerId: string;
  targetId: string;
  nations: Record<string, Nation>;
  brain: AIBrain;
  targetCountry: Country;
}): { outcome: 'accept' | 'refuse'; amount: number } {
  const { proposerId, targetId, nations, brain, targetCountry } = args;
  const target = nations[targetId];
  const proposer = nations[proposerId];
  if (!target || !proposer) return { outcome: 'refuse', amount: 0 };
  // Already paying us — treat as no-op refuse.
  if (target.tributePaid[proposerId]) {
    return { outcome: 'refuse', amount: 0 };
  }
  const proposerStr = totalTroops(proposer) * proposer.tech;
  const targetStr = totalTroops(target) * target.tech;
  const ratio = proposerStr / Math.max(1, targetStr);
  // Tribute amount scales with target's gold income (we use baseEconomy as a proxy).
  const amount = Math.max(
    1,
    Math.round(targetCountry.baseEconomy * BALANCE_POLITICS.tributeFraction),
  );
  // Acceptance threshold by personality.
  let threshold: number;
  switch (brain.personality) {
    case 'aggressive':
      threshold = 3.5;
      break;
    case 'defensive':
      threshold = 1.7;
      break;
    case 'opportunist':
      threshold = 2.2;
      break;
    case 'isolationist':
      threshold = 2.0;
      break;
    case 'merchant':
      threshold = 1.5;
      break;
  }
  return ratio >= threshold
    ? { outcome: 'accept', amount }
    : { outcome: 'refuse', amount };
}

/** Vassalization: target accepts if heavily defeated (low control) and proposer
 *  is much stronger. Otherwise the offer falls flat. */
export function evaluateVassalizationOffer(args: {
  proposerId: string;
  targetId: string;
  nations: Record<string, Nation>;
  brain: AIBrain;
  currentControl: number;
}): boolean {
  const { proposerId, targetId, nations, brain, currentControl } = args;
  const target = nations[targetId];
  const proposer = nations[proposerId];
  if (!target || !proposer) return false;
  if (target.vassalOf) return false;
  if (currentControl > BALANCE_POLITICS.vassalizeMaxControl) return false;
  const proposerStr = totalTroops(proposer) * proposer.tech;
  const targetStr = totalTroops(target) * target.tech;
  const ratio = proposerStr / Math.max(1, targetStr);
  switch (brain.personality) {
    case 'aggressive':
      return ratio >= 4 && Math.random() < 0.5;
    case 'defensive':
      return ratio >= 2 && Math.random() < 0.85;
    case 'opportunist':
      return ratio >= 2.5 && Math.random() < 0.7;
    case 'isolationist':
      return ratio >= 3 && Math.random() < 0.6;
    case 'merchant':
      return ratio >= 1.8 && Math.random() < 0.9;
  }
}
