import type { Country } from './world';
import {
  goldPerTick,
  troopUpkeepPerTick,
  maxTroops,
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
  type AIAction,
  type AIBrain,
} from './ai';
import { evaluateVictory, type VictoryState } from './victory';
import { BALANCE_MOVEMENT, BALANCE_CONTROL, BALANCE_TROOPS } from './balance';

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
      // Desertion proportional across composition.
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

    // Reinforcement: arriving in own territory.
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
    };
    const defenderSide = defenderNation
      ? { ...asComposition(defenderNation), tech: defenderNation.tech }
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
        if (refreshedAttacker) {
          nations = {
            ...nations,
            [arrival.ownerId]: addCompositionsToNation(
              refreshedAttacker,
              survivors,
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
        outcome = 'won';
      } else {
        if (refreshedAttacker) {
          // 60 % of the survivors stagger home.
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
      const cap = maxTroops(country);
      const tot = totalTroops(self);
      if (tot >= cap) return { nations, movements };
      // AI buys a small batch in the personality's preferred mix.
      const mix = action.mix ?? BALANCE_TROOPS.startingMix;
      const want: Composition = {
        infantry: 8 * mix.infantry,
        cavalry: 8 * mix.cavalry,
        artillery: 8 * mix.artillery,
      };
      let goldLeft = self.gold;
      const additions: Composition = { infantry: 0, cavalry: 0, artillery: 0 };
      for (const t of ['infantry', 'cavalry', 'artillery'] as const) {
        const cost = recruitCost(t, country.specializations);
        const wantN = Math.max(0, Math.round(want[t]));
        for (let i = 0; i < wantN; i++) {
          if (totalTroops(self) + additions.infantry + additions.cavalry + additions.artillery >= cap) break;
          if (goldLeft < cost) break;
          additions[t] += 1;
          goldLeft -= cost;
        }
      }
      if (
        additions.infantry +
          additions.cavalry +
          additions.artillery ===
        0
      ) {
        return { nations, movements };
      }
      nations = {
        ...nations,
        [selfId]: {
          ...self,
          gold: goldLeft,
          infantry: self.infantry + additions.infantry,
          cavalry: self.cavalry + additions.cavalry,
          artillery: self.artillery + additions.artillery,
        },
      };
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
      // Send proportional to current composition.
      const prop = available > 0 ? send / available : 0;
      const sendInf = Math.floor((self.infantry - Math.floor(self.infantry * (garrison / Math.max(1, tot)))) * prop);
      const sendCav = Math.floor((self.cavalry - Math.floor(self.cavalry * (garrison / Math.max(1, tot)))) * prop);
      const sendArt = Math.floor((self.artillery - Math.floor(self.artillery * (garrison / Math.max(1, tot)))) * prop);
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

  let nations = applyEconomy(input.countries, input.ownership, input.nations);

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
