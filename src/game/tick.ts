import type { Country } from './world';
import {
  goldPerTick,
  troopUpkeepPerTick,
  recruitCost,
  techInvestmentCost,
  techIncrement,
  totalTroops,
  asComposition,
  type Nation,
  type Stance,
  type Composition,
} from './economy';
import {
  advanceMovement,
  hasArrived,
  findPath,
  newMovementId,
  type TroopMovement,
} from './movement';
import { resolveBattle, type LossesByType } from './combat';
import {
  makeActiveBattle,
  reinforceActiveBattle,
  runBattleRound,
  totalUnits,
  BALANCE_BATTLE,
  type ActiveBattle,
} from './activeBattle';
import {
  decideAction,
  evaluateAllianceProposal,
  evaluatePeaceProposal,
  DOCTRINE_MIX,
  type AIAction,
  type AIBrain,
} from './ai';
import { evaluateVictory, type VictoryState } from './victory';
import {
  BALANCE,
  BALANCE_MOVEMENT,
  BALANCE_CONTROL,
  BALANCE_POLITICS,
} from './balance';
import {
  rollWorldEvent,
  BALANCE_EVENTS,
  type GameEvent,
} from './events';
import {
  autoRecruitUnlocked,
  autoRecruitInterval,
  autoRecruitThreshold,
  autoRecruitMixVariance,
} from './techTree';

export type GameDate = { year: number; month: number };

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatDate(date: GameDate): string {
  return `${MONTH_NAMES[date.month]} ${date.year}`;
}

export function advanceDate(date: GameDate): GameDate {
  const nextMonth = date.month + 1;
  if (nextMonth > 11) return { year: date.year + 1, month: 0 };
  return { year: date.year, month: nextMonth };
}

export type BattleLogEntry = {
  id: string;
  tick: number;
  attackerOwnerId: string;
  defenderOwnerId: string;
  countryId: string;
  attackerLosses: LossesByType;
  defenderLosses: LossesByType;
  totalAttackerLosses: number;
  totalDefenderLosses: number;
  attackerTroopsBefore: number;
  defenderTroopsBefore: number;
  attackerWon: boolean;
  conquered: boolean;
  controlAfter: number;
};

export type ArrivalEvent = {
  movementId: string;
  ownerId: string;
  fromId: string;
  toId: string;
  troops: number;
  path: string[];
  arrivedAt: number;
  outcome: 'reinforce' | 'won' | 'lost' | 'partial';
};

export type TickInput = {
  date: GameDate;
  tickCount: number;
  countries: Record<string, Country>;
  populations: Record<string, number>;
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  control: Record<string, number>;
  contestedBy: Record<string, string>;
  lastBattleTick: Record<string, number>;
  brains: Record<string, AIBrain>;
  movements: TroopMovement[];
  activeBattles: Record<string, ActiveBattle>;
  garrisons: Record<string, Composition>;
  playerCountryId: string | null;
  homeCountryId: string | null;
  rng: () => number;
};

export type TickOutput = {
  date: GameDate;
  ownership: Record<string, string>;
  populations: Record<string, number>;
  nations: Record<string, Nation>;
  control: Record<string, number>;
  contestedBy: Record<string, string>;
  lastBattleTick: Record<string, number>;
  brains: Record<string, AIBrain>;
  movements: TroopMovement[];
  activeBattles: Record<string, ActiveBattle>;
  garrisons: Record<string, Composition>;
  newBattles: BattleLogEntry[];
  newArrivals: ArrivalEvent[];
  newEvents: GameEvent[];
  victory: VictoryState;
};

export type RebellionEvent = {
  countryId: string;
  formerOwner: string;
  tick: number;
};

let battleCounter = 0;
function newBattleId(): string {
  battleCounter += 1;
  return `b-${battleCounter}-${Date.now().toString(36)}`;
}

function applyEconomy(
  countries: Record<string, Country>,
  ownership: Record<string, string>,
  nations: Record<string, Nation>,
): Record<string, Nation> {
  const ownedCount: Record<string, number> = {};
  for (const ownerId of Object.values(ownership)) {
    ownedCount[ownerId] = (ownedCount[ownerId] ?? 0) + 1;
  }
  // Phase 1: compute base income for each nation (including trade bonus).
  const baseIncome: Record<string, number> = {};
  for (const [id, nation] of Object.entries(nations)) {
    const country = countries[id];
    if (!country) continue;
    const owned = ownedCount[id] ?? 0;
    let income = goldPerTick(country, nation, owned);
    const tradeCount = Math.min(
      nation.tradePartners.length,
      BALANCE_POLITICS.maxTradePartners,
    );
    if (tradeCount > 0) {
      income *= Math.pow(BALANCE_POLITICS.tradePartnerGoldMul, tradeCount);
    }
    baseIncome[id] = income;
  }
  // Phase 2: tributes — pay overlords first, then collect from tributaries.
  // Each demand pays a fixed gold/tick (tributePaid map). If the payer can't
  // cover it, they pay what they can; the agreement persists until renegotiated.
  const updated: Record<string, Nation> = {};
  for (const [id, nation] of Object.entries(nations)) {
    const country = countries[id];
    if (!country) {
      updated[id] = nation;
      continue;
    }
    const income = baseIncome[id] ?? 0;
    const upkeep = troopUpkeepPerTick(nation);
    let gold = nation.gold + income - upkeep;
    // Pay tributes (tributePaid map: overlord → gold/tick).
    let totalTributePaid = 0;
    for (const [overlordId, amount] of Object.entries(nation.tributePaid)) {
      const pay = Math.max(0, Math.min(amount, gold));
      gold -= pay;
      totalTributePaid += pay;
      void overlordId;
    }
    // Vassal kicks back fraction of base income to overlord (in addition to
    // explicit tribute, but only if treasury can sustain).
    if (nation.vassalOf && nations[nation.vassalOf]) {
      const kickback = Math.min(
        gold,
        income * BALANCE_POLITICS.vassalTributeFraction,
      );
      gold -= kickback;
      totalTributePaid += kickback;
    }
    // Receive tributes (tributeReceived map: tributary → gold/tick promised).
    let totalTributeReceived = 0;
    for (const [tributaryId, amount] of Object.entries(
      nation.tributeReceived,
    )) {
      const tributary = nations[tributaryId];
      if (!tributary) continue;
      // The actual payable from tributary's side will be capped by their
      // current gold; we just credit at face value. Their applyEconomy step
      // limits what they actually pay. Here we credit nominal so the
      // overlord doesn't starve.
      totalTributeReceived += amount;
    }
    gold += totalTributeReceived;
    // Vassal kickback in (mirrors the deduction on the vassal side).
    for (const vassalId of nation.vassals) {
      const vass = nations[vassalId];
      if (!vass) continue;
      const vassIncome = baseIncome[vassalId] ?? 0;
      gold += vassIncome * BALANCE_POLITICS.vassalTributeFraction;
    }
    let infantry = nation.infantry;
    let cavalry = nation.cavalry;
    let artillery = nation.artillery;
    if (gold < 0) {
      const desertion = Math.ceil(-gold * 8);
      const total = totalTroops(nation);
      if (total > 0) {
        const r = desertion / total;
        infantry = Math.max(0, infantry - Math.round(infantry * r));
        cavalry = Math.max(0, cavalry - Math.round(cavalry * r));
        artillery = Math.max(0, artillery - Math.round(artillery * r));
      }
      gold = 0;
    }
    updated[id] = { ...nation, gold, infantry, cavalry, artillery };
    void totalTributePaid;
  }
  return updated;
}

function regenerateControl(
  control: Record<string, number>,
  contestedBy: Record<string, string>,
  lastBattleTick: Record<string, number>,
  tickCount: number,
): {
  control: Record<string, number>;
  contestedBy: Record<string, string>;
} {
  const next: Record<string, number> = { ...control };
  const stillContested: Record<string, string> = { ...contestedBy };
  for (const id of Object.keys(control)) {
    const last = lastBattleTick[id] ?? -Infinity;
    if (tickCount - last < BALANCE_CONTROL.regenGraceTicks) continue;
    if (next[id] >= BALANCE_CONTROL.fullControl) continue;
    next[id] = Math.min(
      BALANCE_CONTROL.fullControl,
      next[id] + BALANCE_CONTROL.regenPerTick,
    );
    if (next[id] >= BALANCE_CONTROL.fullControl) {
      delete stillContested[id];
    }
  }
  return { control: next, contestedBy: stillContested };
}

function setMutualStance(
  nations: Record<string, Nation>,
  a: string,
  b: string,
  stance: Stance,
): Record<string, Nation> {
  const next = { ...nations };
  const na = next[a];
  const nb = next[b];
  if (na) next[a] = { ...na, stance: { ...na.stance, [b]: stance } };
  if (nb) next[b] = { ...nb, stance: { ...nb.stance, [a]: stance } };
  return next;
}

function addCompositionsToNation(
  nation: Nation,
  add: Composition,
): Nation {
  return {
    ...nation,
    infantry: nation.infantry + add.infantry,
    cavalry: nation.cavalry + add.cavalry,
    artillery: nation.artillery + add.artillery,
  };
}

function subtractLossesFromNation(
  nation: Nation,
  losses: LossesByType,
): Nation {
  return {
    ...nation,
    infantry: Math.max(0, nation.infantry - losses.infantry),
    cavalry: Math.max(0, nation.cavalry - losses.cavalry),
    artillery: Math.max(0, nation.artillery - losses.artillery),
  };
}

function growPopulations(
  populations: Record<string, number>,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [id, pop] of Object.entries(populations)) {
    next[id] = Math.round(pop * (1 + BALANCE.populationGrowthPerTick));
  }
  return next;
}

function computePopulationShare(
  ownerId: string,
  ownership: Record<string, string>,
  populations: Record<string, number>,
): number {
  let total = 0;
  let owned = 0;
  for (const [id, owner] of Object.entries(ownership)) {
    const pop = populations[id] ?? 0;
    total += pop;
    if (owner === ownerId) owned += pop;
  }
  if (total <= 0) return 0;
  return owned / total;
}

/** Simple deterministic hash for spreading auto-recruit cadence per nation. */
function idHash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Threshold + interval based auto-recruit. Each nation has a "fire tick"
 * derived from its id so the world isn't synchronized. When the fire tick
 * comes around AND treasury exceeds the (tech-modified) threshold, the
 * nation spends a randomized portion of its surplus on troops in a
 * randomized but doctrine-leaning mix.
 *
 * Player only participates if Conscription Office is unlocked AND the
 * `autoRecruit` flag is on.
 */
function autoRecruitCycle(
  countries: Record<string, Country>,
  populations: Record<string, number>,
  nations: Record<string, Nation>,
  brains: Record<string, AIBrain>,
  tickCount: number,
  playerCountryId: string | null,
  rng: () => number,
): Record<string, Nation> {
  let updated = nations;
  for (const [id, nation] of Object.entries(nations)) {
    const country = countries[id];
    if (!country) continue;

    const isPlayer = id === playerCountryId;
    if (isPlayer) {
      // Player must explicitly enable AND have Conscription unlocked.
      if (!nation.autoRecruit) continue;
      if (!autoRecruitUnlocked(nation.unlockedTech)) continue;
    }

    const tech = nation.unlockedTech;
    // AI uses the base interval/threshold even without tech (the player only
    // gets these via tech). This gives the world enough army growth.
    const interval = isPlayer ? autoRecruitInterval(tech) : 18;
    const threshold = isPlayer ? autoRecruitThreshold(tech) : 350;
    const variance = isPlayer ? autoRecruitMixVariance(tech) : 0.35;

    const fireTick = idHash(id) % interval;
    if (tickCount % interval !== fireTick) continue;
    if (nation.gold < threshold) continue;

    const pop = populations[id] ?? country.population;
    const martialMul = country.specializations.includes('martial') ? 1.25 : 1;
    const cap = Math.floor(pop * BALANCE.maxTroopsPerPopulation * martialMul);
    const total = nation.infantry + nation.cavalry + nation.artillery;
    if (total >= cap) continue;

    // Spend a randomized portion of the surplus (threshold acts as a
    // reserve floor — we never go below it).
    const surplus = nation.gold - threshold;
    if (surplus <= 0) continue;
    const spend = surplus * (0.45 + rng() * 0.4); // 45–85 %

    // Doctrine mix: AI by personality; player gets balanced 60/30/10 unless
    // they're more advanced (Standing Army → 50/30/20).
    const baseMix = brains[id]
      ? DOCTRINE_MIX[brains[id].personality]
      : { infantry: 0.6, cavalry: 0.3, artillery: 0.1 };
    const jitter = (k: number) =>
      Math.max(0, k + (rng() * 2 - 1) * variance);
    const j: Record<keyof typeof baseMix, number> = {
      infantry: jitter(baseMix.infantry),
      cavalry: jitter(baseMix.cavalry),
      artillery: jitter(baseMix.artillery),
    };
    const sum = j.infantry + j.cavalry + j.artillery || 1;
    const mix = {
      infantry: j.infantry / sum,
      cavalry: j.cavalry / sum,
      artillery: j.artillery / sum,
    };

    const infCost = recruitCost('infantry', country.specializations, tech);
    const cavCost = recruitCost('cavalry', country.specializations, tech);
    const artCost = recruitCost('artillery', country.specializations, tech);

    let goldLeft = spend;
    let addInf = 0;
    let addCav = 0;
    let addArt = 0;
    const tryBuy = (cost: number, portion: number, kind: 'i' | 'c' | 'a') => {
      const budget = goldLeft * portion;
      const n = Math.floor(budget / cost);
      if (n <= 0) return;
      const room = cap - (total + addInf + addCav + addArt);
      const buy = Math.min(n, Math.max(0, room));
      if (buy <= 0) return;
      if (kind === 'i') addInf += buy;
      else if (kind === 'c') addCav += buy;
      else addArt += buy;
      goldLeft -= buy * cost;
    };
    tryBuy(infCost, mix.infantry, 'i');
    tryBuy(cavCost, mix.cavalry, 'c');
    tryBuy(artCost, mix.artillery, 'a');

    if (addInf + addCav + addArt === 0) continue;
    const goldSpent = addInf * infCost + addCav * cavCost + addArt * artCost;
    updated = {
      ...updated,
      [id]: {
        ...updated[id],
        gold: updated[id].gold - goldSpent,
        infantry: updated[id].infantry + addInf,
        cavalry: updated[id].cavalry + addCav,
        artillery: updated[id].artillery + addArt,
      },
    };
  }
  return updated;
}

function processMovements(input: {
  countries: Record<string, Country>;
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  control: Record<string, number>;
  contestedBy: Record<string, string>;
  lastBattleTick: Record<string, number>;
  movements: TroopMovement[];
  activeBattles: Record<string, ActiveBattle>;
  tickCount: number;
  rng: () => number;
  now: number;
}): {
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  control: Record<string, number>;
  contestedBy: Record<string, string>;
  lastBattleTick: Record<string, number>;
  movements: TroopMovement[];
  activeBattles: Record<string, ActiveBattle>;
  battles: BattleLogEntry[];
  arrivals: ArrivalEvent[];
} {
  const { countries, tickCount, rng, now } = input;
  let ownership = { ...input.ownership };
  let nations = { ...input.nations };
  let control = { ...input.control };
  let contestedBy = { ...input.contestedBy };
  let lastBattleTick = { ...input.lastBattleTick };
  let activeBattles = { ...input.activeBattles };
  const battles: BattleLogEntry[] = [];
  const arrivals: ArrivalEvent[] = [];
  const stillMoving: TroopMovement[] = [];

  for (const mv of input.movements) {
    const advanced = advanceMovement(mv);
    if (advanced && !hasArrived(advanced)) {
      stillMoving.push(advanced);
      continue;
    }
    const arrival = advanced ?? mv;
    const destId = arrival.path[arrival.path.length - 1];
    const destCountry = countries[destId];
    if (!destCountry) continue;
    const ownerOfDest = ownership[destId];

    if (ownerOfDest === arrival.ownerId) {
      // Friendly arrival: reinforce home pool, top up control, optionally
      // join an in-progress defender's battle (no — only same-owner = home;
      // the battle phase reads defender from the nation pool already).
      const ownerNation = nations[arrival.ownerId];
      if (ownerNation) {
        nations = {
          ...nations,
          [arrival.ownerId]: addCompositionsToNation(
            ownerNation,
            arrival.composition,
          ),
        };
      }
      control = {
        ...control,
        [destId]: Math.min(
          BALANCE_CONTROL.fullControl,
          (control[destId] ?? BALANCE_CONTROL.fullControl) + 25,
        ),
      };
      if (control[destId] >= BALANCE_CONTROL.fullControl) {
        const next = { ...contestedBy };
        delete next[destId];
        contestedBy = next;
      }
      arrivals.push({
        movementId: arrival.id,
        ownerId: arrival.ownerId,
        fromId: arrival.fromId,
        toId: destId,
        troops: arrival.troops,
        path: arrival.path,
        arrivedAt: now,
        outcome: 'reinforce',
      });
      continue;
    }

    // Enemy arrival.
    const defenderOwnerId = ownerOfDest;
    const defenderNation = defenderOwnerId
      ? nations[defenderOwnerId]
      : undefined;
    const attackerNation = nations[arrival.ownerId];
    if (!attackerNation) continue;

    // Mark the war (both sides know).
    if (defenderOwnerId && defenderOwnerId !== arrival.ownerId) {
      nations = setMutualStance(
        nations,
        arrival.ownerId,
        defenderOwnerId,
        'war',
      );
    }

    const defenderTotal = defenderNation
      ? defenderNation.infantry +
        defenderNation.cavalry +
        defenderNation.artillery
      : 0;

    // Existing battle at this location?
    const existing = activeBattles[destId];

    if (existing && existing.attackerOwnerId === arrival.ownerId) {
      // Same attacker — reinforce.
      activeBattles = {
        ...activeBattles,
        [destId]: reinforceActiveBattle(existing, arrival.composition),
      };
      arrivals.push({
        movementId: arrival.id,
        ownerId: arrival.ownerId,
        fromId: arrival.fromId,
        toId: destId,
        troops: arrival.troops,
        path: arrival.path,
        arrivedAt: now,
        outcome: 'partial',
      });
      continue;
    }

    if (defenderTotal === 0 && (!existing || existing.attackerOwnerId === arrival.ownerId)) {
      // No defender left — this is occupation, not a battle.
      ownership = { ...ownership, [destId]: arrival.ownerId };
      control = { ...control, [destId]: BALANCE_CONTROL.fullControl };
      const cleared = { ...contestedBy };
      delete cleared[destId];
      contestedBy = cleared;
      // Reabsorb attacker survivors into home pool.
      const refreshed = nations[arrival.ownerId];
      if (refreshed) {
        nations = {
          ...nations,
          [arrival.ownerId]: addCompositionsToNation(
            refreshed,
            arrival.composition,
          ),
        };
      }
      // Wipe the defender if they have no other tile.
      if (defenderOwnerId) {
        const stillOwnsAnything = Object.values(ownership).some(
          (o) => o === defenderOwnerId,
        );
        if (!stillOwnsAnything) {
          const def = nations[defenderOwnerId];
          if (def) {
            nations = {
              ...nations,
              [defenderOwnerId]: {
                ...def,
                gold: 0,
                infantry: 0,
                cavalry: 0,
                artillery: 0,
              },
            };
          }
        }
      }
      lastBattleTick = { ...lastBattleTick, [destId]: tickCount };
      battles.push({
        id: newBattleId(),
        tick: tickCount,
        attackerOwnerId: arrival.ownerId,
        defenderOwnerId: defenderOwnerId ?? destId,
        countryId: destId,
        attackerLosses: { infantry: 0, cavalry: 0, artillery: 0 },
        defenderLosses: { infantry: 0, cavalry: 0, artillery: 0 },
        totalAttackerLosses: 0,
        totalDefenderLosses: 0,
        attackerTroopsBefore: arrival.troops,
        defenderTroopsBefore: 0,
        attackerWon: true,
        conquered: true,
        controlAfter: 0,
      });
      arrivals.push({
        movementId: arrival.id,
        ownerId: arrival.ownerId,
        fromId: arrival.fromId,
        toId: destId,
        troops: arrival.troops,
        path: arrival.path,
        arrivedAt: now,
        outcome: 'won',
      });
      continue;
    }

    if (existing && existing.attackerOwnerId !== arrival.ownerId) {
      // Third-party attacker arriving on someone else's contested tile.
      // Fall back to legacy single-shot resolution against the defender,
      // and DO NOT touch the existing battle.
      const attackerSide = {
        ...arrival.composition,
        tech: attackerNation.tech,
        unlockedTech: attackerNation.unlockedTech,
      };
      const defenderSide = defenderNation
        ? {
            ...asComposition(defenderNation),
            tech: defenderNation.tech,
            unlockedTech: defenderNation.unlockedTech,
          }
        : { infantry: 0, cavalry: 0, artillery: 0, tech: 1 };
      const r = resolveBattle(
        attackerSide,
        defenderSide,
        destCountry,
        destCountry.specializations,
        rng,
      );
      if (defenderOwnerId && defenderNation) {
        nations = {
          ...nations,
          [defenderOwnerId]: subtractLossesFromNation(
            defenderNation,
            r.defenderLosses,
          ),
        };
      }
      lastBattleTick = { ...lastBattleTick, [destId]: tickCount };
      battles.push({
        id: newBattleId(),
        tick: tickCount,
        attackerOwnerId: arrival.ownerId,
        defenderOwnerId: defenderOwnerId ?? destId,
        countryId: destId,
        attackerLosses: r.attackerLosses,
        defenderLosses: r.defenderLosses,
        totalAttackerLosses: r.totalAttackerLosses,
        totalDefenderLosses: r.totalDefenderLosses,
        attackerTroopsBefore: arrival.troops,
        defenderTroopsBefore: defenderTotal,
        attackerWon: r.attackerWon,
        conquered: false,
        controlAfter: Math.round(control[destId] ?? BALANCE_CONTROL.fullControl),
      });
      arrivals.push({
        movementId: arrival.id,
        ownerId: arrival.ownerId,
        fromId: arrival.fromId,
        toId: destId,
        troops: arrival.troops,
        path: arrival.path,
        arrivedAt: now,
        outcome: r.attackerWon ? 'partial' : 'lost',
      });
      continue;
    }

    // Otherwise: spawn a new active battle here.
    const newBattle = makeActiveBattle({
      locationCountryId: destId,
      attackerOwnerId: arrival.ownerId,
      defenderOwnerId: defenderOwnerId ?? destId,
      initialAttackerForce: arrival.composition,
      attackerTech: attackerNation.tech,
      attackerUnlockedTech: attackerNation.unlockedTech,
      tickCount,
    });
    activeBattles = { ...activeBattles, [destId]: newBattle };
    contestedBy = { ...contestedBy, [destId]: arrival.ownerId };
    arrivals.push({
      movementId: arrival.id,
      ownerId: arrival.ownerId,
      fromId: arrival.fromId,
      toId: destId,
      troops: arrival.troops,
      path: arrival.path,
      arrivedAt: now,
      outcome: 'partial',
    });
  }

  return {
    ownership,
    nations,
    control,
    contestedBy,
    lastBattleTick,
    movements: stillMoving,
    activeBattles,
    battles,
    arrivals,
  };
}

/** Run one round of every active battle. End battles that resolve. */
function processActiveBattlesRound(input: {
  countries: Record<string, Country>;
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  control: Record<string, number>;
  contestedBy: Record<string, string>;
  lastBattleTick: Record<string, number>;
  activeBattles: Record<string, ActiveBattle>;
  garrisons: Record<string, Composition>;
  tickCount: number;
  rng: () => number;
}): {
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  control: Record<string, number>;
  contestedBy: Record<string, string>;
  lastBattleTick: Record<string, number>;
  activeBattles: Record<string, ActiveBattle>;
  garrisons: Record<string, Composition>;
  battles: BattleLogEntry[];
} {
  let ownership = { ...input.ownership };
  let nations = { ...input.nations };
  let control = { ...input.control };
  let contestedBy = { ...input.contestedBy };
  let lastBattleTick = { ...input.lastBattleTick };
  let activeBattles = { ...input.activeBattles };
  let garrisons = { ...input.garrisons };
  const { countries, tickCount, rng } = input;
  const battles: BattleLogEntry[] = [];

  for (const locId of Object.keys(activeBattles)) {
    const battle = activeBattles[locId];
    if (!battle) continue;
    const country = countries[locId];
    if (!country) continue;
    const defenderOwnerId = ownership[locId] ?? battle.defenderOwnerId;
    const defenderNation = nations[defenderOwnerId];
    const garrisonAtTile = garrisons[locId] ?? {
      infantry: 0,
      cavalry: 0,
      artillery: 0,
    };
    // Defender = nation pool (only if this is their home, otherwise just
    // the garrison stationed here). For the home country, garrison adds.
    const isHome = defenderOwnerId === locId;
    const baseDefender = defenderNation && isHome
      ? asComposition(defenderNation)
      : { infantry: 0, cavalry: 0, artillery: 0 };
    const defenderForce: Composition = {
      infantry: baseDefender.infantry + garrisonAtTile.infantry,
      cavalry: baseDefender.cavalry + garrisonAtTile.cavalry,
      artillery: baseDefender.artillery + garrisonAtTile.artillery,
    };
    const defenderTech = defenderNation?.tech ?? 1;
    const defenderUnlockedTech = defenderNation?.unlockedTech ?? [];

    // If either side has 0 troops the battle short-circuits.
    const attackerTotalNow = totalUnits(battle.attackerForce);
    const defenderTotalNow = totalUnits(defenderForce);

    if (attackerTotalNow === 0) {
      // Attacker wiped — defender holds. Battle ends.
      const ab = { ...activeBattles };
      delete ab[locId];
      activeBattles = ab;
      battles.push({
        id: newBattleId(),
        tick: tickCount,
        attackerOwnerId: battle.attackerOwnerId,
        defenderOwnerId,
        countryId: locId,
        attackerLosses: { infantry: 0, cavalry: 0, artillery: 0 },
        defenderLosses: { infantry: 0, cavalry: 0, artillery: 0 },
        totalAttackerLosses: battle.totalAttackerLosses,
        totalDefenderLosses: battle.totalDefenderLosses,
        attackerTroopsBefore: 0,
        defenderTroopsBefore: defenderTotalNow,
        attackerWon: false,
        conquered: false,
        controlAfter: Math.round(control[locId] ?? BALANCE_CONTROL.fullControl),
      });
      lastBattleTick = { ...lastBattleTick, [locId]: tickCount };
      continue;
    }
    if (defenderTotalNow === 0) {
      // Defender wiped at this tile — attacker grinds control without resistance.
      const damage =
        BALANCE_BATTLE.controlDamagePerWonRound.min +
        rng() *
          (BALANCE_BATTLE.controlDamagePerWonRound.max -
            BALANCE_BATTLE.controlDamagePerWonRound.min);
      const before = control[locId] ?? BALANCE_CONTROL.fullControl;
      const after = Math.max(0, before - damage * 1.4);
      control = { ...control, [locId]: after };
      contestedBy = { ...contestedBy, [locId]: battle.attackerOwnerId };
      if (after <= 0) {
        // Conquest.
        ownership = { ...ownership, [locId]: battle.attackerOwnerId };
        control = { ...control, [locId]: BALANCE_CONTROL.fullControl };
        const cleared = { ...contestedBy };
        delete cleared[locId];
        contestedBy = cleared;
        const refreshed = nations[battle.attackerOwnerId];
        if (refreshed) {
          nations = {
            ...nations,
            [battle.attackerOwnerId]: addCompositionsToNation(
              refreshed,
              battle.attackerForce,
            ),
          };
        }
        // Wipe defender nation if they have no tiles.
        if (defenderOwnerId) {
          const stillOwnsAnything = Object.values(ownership).some(
            (o) => o === defenderOwnerId,
          );
          if (!stillOwnsAnything) {
            const def = nations[defenderOwnerId];
            if (def) {
              nations = {
                ...nations,
                [defenderOwnerId]: {
                  ...def,
                  gold: 0,
                  infantry: 0,
                  cavalry: 0,
                  artillery: 0,
                },
              };
            }
          }
        }
        const ab = { ...activeBattles };
        delete ab[locId];
        activeBattles = ab;
        battles.push({
          id: newBattleId(),
          tick: tickCount,
          attackerOwnerId: battle.attackerOwnerId,
          defenderOwnerId,
          countryId: locId,
          attackerLosses: { infantry: 0, cavalry: 0, artillery: 0 },
          defenderLosses: { infantry: 0, cavalry: 0, artillery: 0 },
          totalAttackerLosses: battle.totalAttackerLosses,
          totalDefenderLosses: battle.totalDefenderLosses,
          attackerTroopsBefore: totalUnits(battle.attackerForce),
          defenderTroopsBefore: 0,
          attackerWon: true,
          conquered: true,
          controlAfter: 0,
        });
      } else {
        activeBattles = {
          ...activeBattles,
          [locId]: { ...battle, rounds: battle.rounds + 1 },
        };
      }
      lastBattleTick = { ...lastBattleTick, [locId]: tickCount };
      continue;
    }

    // Run one round.
    const initialSnapshot = totalUnits(battle.attackerForce);
    const round = runBattleRound({
      battle,
      defenderForce,
      defenderTech,
      defenderUnlockedTech,
      defenderCountry: country,
      defenderSpecs: country.specializations,
      initialAttackerStrengthSnapshot: initialSnapshot,
      rng,
    });

    // Apply attacker losses to battle force.
    const newAttackerForce = {
      infantry: Math.max(
        0,
        battle.attackerForce.infantry - round.attackerLosses.infantry,
      ),
      cavalry: Math.max(
        0,
        battle.attackerForce.cavalry - round.attackerLosses.cavalry,
      ),
      artillery: Math.max(
        0,
        battle.attackerForce.artillery - round.attackerLosses.artillery,
      ),
    };
    // Distribute defender losses: garrison eats losses first (it's the front
    // line at this tile), then any remaining hits the nation pool. For non-
    // home tiles only the garrison can take losses.
    {
      const lossInf = round.defenderLosses.infantry;
      const lossCav = round.defenderLosses.cavalry;
      const lossArt = round.defenderLosses.artillery;
      const fromGarrInf = Math.min(lossInf, garrisonAtTile.infantry);
      const fromGarrCav = Math.min(lossCav, garrisonAtTile.cavalry);
      const fromGarrArt = Math.min(lossArt, garrisonAtTile.artillery);
      const newGarr: Composition = {
        infantry: garrisonAtTile.infantry - fromGarrInf,
        cavalry: garrisonAtTile.cavalry - fromGarrCav,
        artillery: garrisonAtTile.artillery - fromGarrArt,
      };
      const garrEmpty =
        newGarr.infantry === 0 &&
        newGarr.cavalry === 0 &&
        newGarr.artillery === 0;
      if (garrEmpty) {
        const next = { ...garrisons };
        delete next[locId];
        garrisons = next;
      } else if (
        newGarr.infantry !== garrisonAtTile.infantry ||
        newGarr.cavalry !== garrisonAtTile.cavalry ||
        newGarr.artillery !== garrisonAtTile.artillery
      ) {
        garrisons = { ...garrisons, [locId]: newGarr };
      }
      const remainingInf = lossInf - fromGarrInf;
      const remainingCav = lossCav - fromGarrCav;
      const remainingArt = lossArt - fromGarrArt;
      if (
        defenderNation &&
        isHome &&
        (remainingInf > 0 || remainingCav > 0 || remainingArt > 0)
      ) {
        nations = {
          ...nations,
          [defenderOwnerId]: subtractLossesFromNation(defenderNation, {
            infantry: remainingInf,
            cavalry: remainingCav,
            artillery: remainingArt,
          }),
        };
      }
    }
    const totalAttackerLossesThisRound =
      round.attackerLosses.infantry +
      round.attackerLosses.cavalry +
      round.attackerLosses.artillery;
    const totalDefenderLossesThisRound =
      round.defenderLosses.infantry +
      round.defenderLosses.cavalry +
      round.defenderLosses.artillery;

    let updated: ActiveBattle = {
      ...battle,
      attackerForce: newAttackerForce,
      rounds: battle.rounds + 1,
      totalAttackerLosses:
        battle.totalAttackerLosses + totalAttackerLossesThisRound,
      totalDefenderLosses:
        battle.totalDefenderLosses + totalDefenderLossesThisRound,
    };

    // Update control when attacker wins the round.
    let controlAfter = control[locId] ?? BALANCE_CONTROL.fullControl;
    if (round.attackerWonRound && round.controlDamage > 0) {
      controlAfter = Math.max(0, controlAfter - round.controlDamage);
      control = { ...control, [locId]: controlAfter };
      contestedBy = { ...contestedBy, [locId]: battle.attackerOwnerId };
    }
    lastBattleTick = { ...lastBattleTick, [locId]: tickCount };

    const battleIsConquest = controlAfter <= 0;
    const battleIsRout =
      round.attackerRouted || totalUnits(newAttackerForce) === 0;
    const stalled = updated.rounds >= BALANCE_BATTLE.maxRounds;

    const shouldEnd = battleIsConquest || battleIsRout || stalled;

    if (battleIsConquest) {
      ownership = { ...ownership, [locId]: battle.attackerOwnerId };
      control = { ...control, [locId]: BALANCE_CONTROL.fullControl };
      const cleared = { ...contestedBy };
      delete cleared[locId];
      contestedBy = cleared;
      // Old garrison goes with the old owner (already drained in losses).
      const ng = { ...garrisons };
      delete ng[locId];
      garrisons = ng;
      // Reabsorb survivors + 30 % of defender stragglers into attacker home pool.
      const refreshed = nations[battle.attackerOwnerId];
      let absorbed: Composition = { ...newAttackerForce };
      const defNow = nations[defenderOwnerId];
      if (defNow) {
        absorbed = {
          infantry: absorbed.infantry + Math.floor(defNow.infantry * 0.3),
          cavalry: absorbed.cavalry + Math.floor(defNow.cavalry * 0.3),
          artillery: absorbed.artillery + Math.floor(defNow.artillery * 0.3),
        };
      }
      if (refreshed) {
        nations = {
          ...nations,
          [battle.attackerOwnerId]: addCompositionsToNation(refreshed, absorbed),
        };
      }
      if (defenderOwnerId) {
        const stillOwnsAnything = Object.values(ownership).some(
          (o) => o === defenderOwnerId,
        );
        if (!stillOwnsAnything) {
          const def = nations[defenderOwnerId];
          if (def) {
            nations = {
              ...nations,
              [defenderOwnerId]: {
                ...def,
                gold: 0,
                infantry: 0,
                cavalry: 0,
                artillery: 0,
              },
            };
          }
        }
      }
      const ab = { ...activeBattles };
      delete ab[locId];
      activeBattles = ab;
    } else if (battleIsRout) {
      // Routed survivors are simply lost (they would have been wiped retreating).
      const ab = { ...activeBattles };
      delete ab[locId];
      activeBattles = ab;
    } else if (stalled) {
      // Force a fallback resolution: heavier final round.
      const final = resolveBattle(
        {
          ...newAttackerForce,
          tech: battle.attackerTech,
          unlockedTech: battle.attackerUnlockedTech,
        },
        {
          ...defenderForce,
          tech: defenderTech,
          unlockedTech: defenderUnlockedTech,
        },
        country,
        country.specializations,
        rng,
      );
      if (defenderNation) {
        nations = {
          ...nations,
          [defenderOwnerId]: subtractLossesFromNation(
            nations[defenderOwnerId] ?? defenderNation,
            final.defenderLosses,
          ),
        };
      }
      if (final.attackerWon) {
        ownership = { ...ownership, [locId]: battle.attackerOwnerId };
        control = { ...control, [locId]: BALANCE_CONTROL.fullControl };
        const cleared = { ...contestedBy };
        delete cleared[locId];
        contestedBy = cleared;
        const refreshed = nations[battle.attackerOwnerId];
        if (refreshed) {
          nations = {
            ...nations,
            [battle.attackerOwnerId]: addCompositionsToNation(
              refreshed,
              final.attackerSurvivors,
            ),
          };
        }
        if (defenderOwnerId) {
          const stillOwnsAnything = Object.values(ownership).some(
            (o) => o === defenderOwnerId,
          );
          if (!stillOwnsAnything) {
            const def = nations[defenderOwnerId];
            if (def) {
              nations = {
                ...nations,
                [defenderOwnerId]: {
                  ...def,
                  gold: 0,
                  infantry: 0,
                  cavalry: 0,
                  artillery: 0,
                },
              };
            }
          }
        }
      }
      const ab = { ...activeBattles };
      delete ab[locId];
      activeBattles = ab;
    } else {
      activeBattles = { ...activeBattles, [locId]: updated };
    }

    if (shouldEnd) {
      const totalA = totalUnits(battle.attackerForce);
      const totalD =
        defenderForce.infantry + defenderForce.cavalry + defenderForce.artillery;
      battles.push({
        id: newBattleId(),
        tick: tickCount,
        attackerOwnerId: battle.attackerOwnerId,
        defenderOwnerId,
        countryId: locId,
        attackerLosses: round.attackerLosses,
        defenderLosses: round.defenderLosses,
        totalAttackerLosses:
          updated.totalAttackerLosses,
        totalDefenderLosses:
          updated.totalDefenderLosses,
        attackerTroopsBefore: totalA,
        defenderTroopsBefore: totalD,
        attackerWon: battleIsConquest || (stalled && !battleIsRout),
        conquered: battleIsConquest,
        controlAfter: Math.round(control[locId] ?? BALANCE_CONTROL.fullControl),
      });
    }
  }

  return {
    ownership,
    nations,
    control,
    contestedBy,
    lastBattleTick,
    activeBattles,
    garrisons,
    battles,
  };
}

function applyAIAction(args: {
  selfId: string;
  action: AIAction;
  countries: Record<string, Country>;
  nations: Record<string, Nation>;
  brains: Record<string, AIBrain>;
  movements: TroopMovement[];
  tickCount: number;
}): {
  nations: Record<string, Nation>;
  movements: TroopMovement[];
} {
  const { selfId, action, countries, brains, tickCount } = args;
  let nations = args.nations;
  let movements = args.movements;
  const self = nations[selfId];
  const country = countries[selfId];
  if (!self || !country) return { nations, movements };

  switch (action.kind) {
    case 'idle':
      return { nations, movements };
    case 'recruit': {
      // Auto-recruit cycle handles bulk growth; AI think-time recruitment
      // is now redundant. Keep idle.
      return { nations, movements };
    }
    case 'invest_tech': {
      const cost = techInvestmentCost();
      if (self.gold < cost) return { nations, movements };
      nations = {
        ...nations,
        [selfId]: {
          ...self,
          gold: self.gold - cost,
          tech: self.tech + techIncrement(self.tech, country.specializations),
        },
      };
      return { nations, movements };
    }
    case 'dispatch': {
      const path = findPath(countries, action.fromId, action.toId);
      if (!path) return { nations, movements };
      const tot = totalTroops(self);
      const garrison = Math.floor(tot * BALANCE_MOVEMENT.homeGarrisonFraction);
      const available = tot - garrison;
      const send = Math.min(action.troops, available);
      if (send <= 0) return { nations, movements };
      const prop = available > 0 ? send / available : 0;
      const sendInf = Math.floor(
        (self.infantry -
          Math.floor(self.infantry * (garrison / Math.max(1, tot)))) *
          prop,
      );
      const sendCav = Math.floor(
        (self.cavalry -
          Math.floor(self.cavalry * (garrison / Math.max(1, tot)))) *
          prop,
      );
      const sendArt = Math.floor(
        (self.artillery -
          Math.floor(self.artillery * (garrison / Math.max(1, tot)))) *
          prop,
      );
      const composition: Composition = {
        infantry: Math.max(0, sendInf),
        cavalry: Math.max(0, sendCav),
        artillery: Math.max(0, sendArt),
      };
      const total =
        composition.infantry + composition.cavalry + composition.artillery;
      if (total <= 0) return { nations, movements };
      nations = {
        ...nations,
        [selfId]: {
          ...self,
          infantry: self.infantry - composition.infantry,
          cavalry: self.cavalry - composition.cavalry,
          artillery: self.artillery - composition.artillery,
        },
      };
      movements = [
        ...movements,
        {
          id: newMovementId(),
          ownerId: selfId,
          fromId: action.fromId,
          toId: action.toId,
          composition,
          troops: total,
          path,
          pathIndex: 0,
          launchTick: tickCount,
        },
      ];
      return { nations, movements };
    }
    case 'declare_war': {
      nations = setMutualStance(nations, selfId, action.targetId, 'war');
      return { nations, movements };
    }
    case 'propose_peace': {
      const targetBrain = brains[action.targetId];
      const accepted = targetBrain
        ? evaluatePeaceProposal({
            proposerId: selfId,
            targetId: action.targetId,
            nations,
            brain: targetBrain,
          })
        : true;
      if (accepted) {
        nations = setMutualStance(nations, selfId, action.targetId, 'neutral');
      }
      return { nations, movements };
    }
    case 'propose_alliance': {
      const targetBrain = brains[action.targetId];
      const accepted = targetBrain
        ? evaluateAllianceProposal({
            proposerId: selfId,
            targetId: action.targetId,
            nations,
            brain: targetBrain,
          })
        : false;
      if (accepted) {
        nations = setMutualStance(nations, selfId, action.targetId, 'allied');
      }
      return { nations, movements };
    }
  }
}

export function runTick(input: TickInput): TickOutput {
  const date = advanceDate(input.date);
  const now = performance.now();

  let populations = growPopulations(input.populations);

  let nations = applyEconomy(input.countries, input.ownership, input.nations);

  // Auto-recruit cycle (interval + threshold + randomized mix).
  nations = autoRecruitCycle(
    input.countries,
    populations,
    nations,
    input.brains,
    input.tickCount,
    input.playerCountryId,
    input.rng,
  );

  const moveStep = processMovements({
    countries: input.countries,
    ownership: input.ownership,
    nations,
    control: input.control,
    contestedBy: input.contestedBy,
    lastBattleTick: input.lastBattleTick,
    movements: input.movements,
    activeBattles: input.activeBattles,
    tickCount: input.tickCount,
    rng: input.rng,
    now,
  });
  nations = moveStep.nations;
  let ownership = moveStep.ownership;
  let movements = moveStep.movements;
  let control = moveStep.control;
  let contestedBy = moveStep.contestedBy;
  let lastBattleTick = moveStep.lastBattleTick;
  let activeBattles = moveStep.activeBattles;
  const allBattleEntries: BattleLogEntry[] = [...moveStep.battles];

  // Active-battle rounds (one round per tick).
  const battleStep = processActiveBattlesRound({
    countries: input.countries,
    ownership,
    nations,
    control,
    contestedBy,
    lastBattleTick,
    activeBattles,
    garrisons: input.garrisons,
    tickCount: input.tickCount,
    rng: input.rng,
  });
  ownership = battleStep.ownership;
  nations = battleStep.nations;
  control = battleStep.control;
  contestedBy = battleStep.contestedBy;
  lastBattleTick = battleStep.lastBattleTick;
  let garrisons = battleStep.garrisons;
  activeBattles = battleStep.activeBattles;
  allBattleEntries.push(...battleStep.battles);

  const regen = regenerateControl(
    control,
    contestedBy,
    lastBattleTick,
    input.tickCount,
  );
  control = regen.control;
  contestedBy = regen.contestedBy;

  let brains = { ...input.brains };
  for (const [id, brain] of Object.entries(input.brains)) {
    if (input.playerCountryId && id === input.playerCountryId) continue;
    const advancedBrain: AIBrain = {
      ...brain,
      ticksSinceThink: brain.ticksSinceThink + 1,
    };
    if (advancedBrain.ticksSinceThink < advancedBrain.thinkCadence) {
      brains[id] = advancedBrain;
      continue;
    }
    const action = decideAction({
      selfId: id,
      countries: input.countries,
      ownership,
      nations,
      brain: advancedBrain,
      rng: input.rng,
    });
    const applied = applyAIAction({
      selfId: id,
      action,
      countries: input.countries,
      nations,
      brains,
      movements,
      tickCount: input.tickCount,
    });
    nations = applied.nations;
    movements = applied.movements;
    brains[id] = { ...advancedBrain, ticksSinceThink: 0 };
  }

  // Coalition trigger: once the player crosses the population-share threshold,
  // every neutral, non-vassal AI nation flips to war with them and allied with
  // each other. Fires once per game (we just declare war on contact, not a
  // sticky flag — but stance becomes 'war', which is sticky already).
  if (input.playerCountryId && input.homeCountryId) {
    const playerShare = computePopulationShare(
      input.playerCountryId,
      ownership,
      populations,
    );
    if (playerShare >= BALANCE_POLITICS.coalitionThreshold) {
      const playerId = input.playerCountryId;
      for (const id of Object.keys(nations)) {
        if (id === playerId) continue;
        const n = nations[id];
        if (!n) continue;
        if (n.vassalOf === playerId) continue;
        const stanceToPlayer = n.stance[playerId] ?? 'neutral';
        if (stanceToPlayer === 'allied' || stanceToPlayer === 'war') continue;
        nations = setMutualStance(nations, id, playerId, 'war');
        // Reduce reputation of player slightly each new declaration as the
        // coalition spreads its propaganda.
        const player = nations[playerId];
        if (player) {
          nations = {
            ...nations,
            [playerId]: {
              ...player,
              reputation: Math.max(0, player.reputation - 1),
            },
          };
        }
      }
    }
  }

  // Rebellion check: very small chance per conquered tile per tick of an
  // uprising. Tiles with garrisons are heavily protected; recently-conquered
  // tiles (within 2 in-game years) are off-limits — the player just won them.
  // When a rebellion fires, we don't pop the tile — we contest it (control
  // drops, attacker is set to the original owner). Player still has to fight
  // it back if they want to keep it; if they let it slide, control eventually
  // hits 0 and they lose the tile, but the player has time to react.
  {
    const ownedCounts: Record<string, number> = {};
    for (const owner of Object.values(ownership)) {
      ownedCounts[owner] = (ownedCounts[owner] ?? 0) + 1;
    }
    for (const id of Object.keys(ownership)) {
      const owner = ownership[id];
      if (!owner || owner === id) continue;
      // Skip if recently conquered or already contested.
      const lastBattle = lastBattleTick[id] ?? -Infinity;
      if (input.tickCount - lastBattle < 24) continue;
      if (contestedBy[id]) continue;

      const empireSize = ownedCounts[owner] ?? 1;
      // Garrison strength reduction: each garrison troop lowers prob by
      // a fraction. A 50-strong garrison cuts chance to near zero.
      const garrison = input.garrisons[id];
      const garrisonStr = garrison
        ? garrison.infantry + garrison.cavalry + garrison.artillery
        : 0;
      const garrisonReduction = Math.min(0.95, garrisonStr / 60);

      // Base chance only kicks in for empires of 6+ tiles, and is small.
      const baseSize = Math.max(0, empireSize - 5) * 0.0006;
      const prob = baseSize * (1 - garrisonReduction);
      if (input.rng() < prob) {
        // Contest the tile rather than insta-flip. Original owner is the
        // "attacker" reclaiming. Drop control significantly.
        const before = control[id] ?? BALANCE_CONTROL.fullControl;
        control = {
          ...control,
          [id]: Math.max(15, before - 40),
        };
        contestedBy = { ...contestedBy, [id]: id };
        lastBattleTick = { ...lastBattleTick, [id]: input.tickCount };
      }
    }
  }

  // World event roll, every BALANCE_EVENTS.rollInterval ticks.
  const newEvents: GameEvent[] = [];
  if (input.tickCount > 0 && input.tickCount % BALANCE_EVENTS.rollInterval === 0) {
    const result = rollWorldEvent({
      tickCount: input.tickCount,
      countryOrder: Object.keys(input.countries),
      ownership,
      populations,
      nations,
      playerCountryId: input.playerCountryId,
      rng: input.rng,
    });
    if (result) {
      newEvents.push(result.event);
      // Apply population delta.
      for (const [id, delta] of Object.entries(result.populationDelta)) {
        const cur = populations[id] ?? 0;
        populations = { ...populations, [id]: Math.max(0, cur + delta) };
      }
      // Apply gold delta.
      for (const [id, delta] of Object.entries(result.goldDelta)) {
        const n = nations[id];
        if (!n) continue;
        nations = {
          ...nations,
          [id]: { ...n, gold: Math.max(0, n.gold + delta) },
        };
      }
      // Apply troop delta uniformly across composition.
      for (const [id, delta] of Object.entries(result.troopDelta)) {
        const n = nations[id];
        if (!n) continue;
        const tot = n.infantry + n.cavalry + n.artillery;
        if (tot <= 0) continue;
        const r = -delta / tot; // delta is negative for losses
        const lossInf = Math.round(n.infantry * r);
        const lossCav = Math.round(n.cavalry * r);
        const lossArt = Math.round(n.artillery * r);
        nations = {
          ...nations,
          [id]: {
            ...n,
            infantry: Math.max(0, n.infantry - lossInf),
            cavalry: Math.max(0, n.cavalry - lossCav),
            artillery: Math.max(0, n.artillery - lossArt),
          },
        };
      }
      // Tech breakthrough — bump tech.
      if (result.event.kind === 'tech_breakthrough') {
        const owner = ownership[result.event.targetId];
        const n = nations[owner];
        if (n) {
          nations = {
            ...nations,
            [owner]: { ...n, tech: n.tech + 0.15 },
          };
        }
      }
      // Peasant revolt — contest the tile (don't insta-flip).
      if (result.event.kind === 'peasant_revolt') {
        const tileId = result.event.targetId;
        const before = control[tileId] ?? BALANCE_CONTROL.fullControl;
        control = { ...control, [tileId]: Math.max(20, before - 50) };
        contestedBy = { ...contestedBy, [tileId]: tileId };
        lastBattleTick = { ...lastBattleTick, [tileId]: input.tickCount };
      }
      // Legacy ownership-change path (none of our events use it now).
      if (result.ownershipChange) {
        const { countryId, newOwner } = result.ownershipChange;
        ownership = { ...ownership, [countryId]: newOwner };
        control = {
          ...control,
          [countryId]: BALANCE_CONTROL.fullControl,
        };
        const cleared = { ...contestedBy };
        delete cleared[countryId];
        contestedBy = cleared;
      }
    }
  }

  let victory: VictoryState = { kind: 'ongoing' };
  if (input.playerCountryId && input.homeCountryId) {
    victory = evaluateVictory({
      playerId: input.playerCountryId,
      homeId: input.homeCountryId,
      ownership,
      countries: input.countries,
      date,
    });
  }

  return {
    date,
    ownership,
    populations,
    nations,
    control,
    contestedBy,
    lastBattleTick,
    brains,
    movements,
    activeBattles,
    garrisons,
    newBattles: allBattleEntries,
    newArrivals: moveStep.arrivals,
    newEvents,
    victory,
  };
}
