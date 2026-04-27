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
} from './balance';
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
  newBattles: BattleLogEntry[];
  newArrivals: ArrivalEvent[];
  victory: VictoryState;
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
  const updated: Record<string, Nation> = {};
  for (const [id, nation] of Object.entries(nations)) {
    const country = countries[id];
    if (!country) {
      updated[id] = nation;
      continue;
    }
    const owned = ownedCount[id] ?? 0;
    const income = goldPerTick(country, nation, owned);
    const upkeep = troopUpkeepPerTick(nation);
    let gold = nation.gold + income - upkeep;
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
  battles: BattleLogEntry[];
  arrivals: ArrivalEvent[];
} {
  const { countries, tickCount, rng, now } = input;
  let ownership = { ...input.ownership };
  let nations = { ...input.nations };
  let control = { ...input.control };
  let contestedBy = { ...input.contestedBy };
  let lastBattleTick = { ...input.lastBattleTick };
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

    const defenderOwnerId = ownerOfDest;
    const defenderNation = defenderOwnerId
      ? nations[defenderOwnerId]
      : undefined;
    const attackerNation = nations[arrival.ownerId];
    if (!attackerNation) continue;

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

    const result = resolveBattle(
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
          result.defenderLosses,
        ),
      };
    }

    let conquered = false;
    let controlAfter = control[destId] ?? BALANCE_CONTROL.fullControl;
    let outcome: 'won' | 'lost' | 'partial' = 'lost';

    if (result.attackerWon) {
      const damage =
        BALANCE_CONTROL.damagePerVictoryMin +
        rng() *
          (BALANCE_CONTROL.damagePerVictoryMax -
            BALANCE_CONTROL.damagePerVictoryMin);
      const before = controlAfter;
      controlAfter = Math.max(0, before - damage);
      control = { ...control, [destId]: controlAfter };
      contestedBy = { ...contestedBy, [destId]: arrival.ownerId };

      const survivors = result.attackerSurvivors;
      const refreshedAttacker = nations[arrival.ownerId];

      if (controlAfter <= 0) {
        ownership = { ...ownership, [destId]: arrival.ownerId };
        control = { ...control, [destId]: BALANCE_CONTROL.fullControl };
        const cleared = { ...contestedBy };
        delete cleared[destId];
        contestedBy = cleared;
        conquered = true;
        let absorbed: Composition = { ...survivors };
        if (defenderOwnerId) {
          const defNow = nations[defenderOwnerId];
          if (defNow) {
            absorbed = {
              infantry: absorbed.infantry + Math.floor(defNow.infantry * 0.3),
              cavalry: absorbed.cavalry + Math.floor(defNow.cavalry * 0.3),
              artillery: absorbed.artillery + Math.floor(defNow.artillery * 0.3),
            };
          }
        }
        if (refreshedAttacker) {
          nations = {
            ...nations,
            [arrival.ownerId]: addCompositionsToNation(
              refreshedAttacker,
              absorbed,
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
        if (defenderOwnerId && defenderOwnerId !== arrival.ownerId) {
          nations = setMutualStance(
            nations,
            arrival.ownerId,
            defenderOwnerId,
            'war',
          );
        }
        outcome = 'won';
      } else {
        if (refreshedAttacker) {
          const r = 0.6;
          const fallback: Composition = {
            infantry: Math.floor(survivors.infantry * r),
            cavalry: Math.floor(survivors.cavalry * r),
            artillery: Math.floor(survivors.artillery * r),
          };
          nations = {
            ...nations,
            [arrival.ownerId]: addCompositionsToNation(
              refreshedAttacker,
              fallback,
            ),
          };
        }
        if (defenderOwnerId && defenderOwnerId !== arrival.ownerId) {
          nations = setMutualStance(
            nations,
            arrival.ownerId,
            defenderOwnerId,
            'war',
          );
        }
        outcome = 'partial';
      }
    } else {
      if (defenderOwnerId && defenderOwnerId !== arrival.ownerId) {
        nations = setMutualStance(
          nations,
          arrival.ownerId,
          defenderOwnerId,
          'war',
        );
      }
      outcome = 'lost';
    }

    lastBattleTick = { ...lastBattleTick, [destId]: tickCount };
    const attackerTroopsBefore =
      arrival.composition.infantry +
      arrival.composition.cavalry +
      arrival.composition.artillery;
    const defenderTroopsBefore =
      (defenderSide.infantry + defenderSide.cavalry + defenderSide.artillery) ||
      0;
    battles.push({
      id: newBattleId(),
      tick: tickCount,
      attackerOwnerId: arrival.ownerId,
      defenderOwnerId: defenderOwnerId ?? destId,
      countryId: destId,
      attackerLosses: result.attackerLosses,
      defenderLosses: result.defenderLosses,
      totalAttackerLosses: result.totalAttackerLosses,
      totalDefenderLosses: result.totalDefenderLosses,
      attackerTroopsBefore,
      defenderTroopsBefore,
      attackerWon: result.attackerWon,
      conquered,
      controlAfter: Math.round(controlAfter),
    });
    arrivals.push({
      movementId: arrival.id,
      ownerId: arrival.ownerId,
      fromId: arrival.fromId,
      toId: destId,
      troops: arrival.troops,
      path: arrival.path,
      arrivedAt: now,
      outcome,
    });
  }

  return {
    ownership,
    nations,
    control,
    contestedBy,
    lastBattleTick,
    movements: stillMoving,
    battles,
    arrivals,
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

  const populations = growPopulations(input.populations);

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
    newBattles: moveStep.battles,
    newArrivals: moveStep.arrivals,
    victory,
  };
}
