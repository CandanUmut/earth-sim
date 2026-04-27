import type { Country } from './world';
import {
  goldPerTick,
  troopUpkeepPerTick,
  maxTroops,
  recruitCost,
  techInvestmentCost,
  techIncrement,
  type Nation,
  type Stance,
} from './economy';
import {
  advanceMovement,
  hasArrived,
  findPath,
  newMovementId,
  type TroopMovement,
} from './movement';
import { resolveBattle } from './combat';
import {
  decideAction,
  evaluateAllianceProposal,
  evaluatePeaceProposal,
  type AIAction,
  type AIBrain,
} from './ai';
import { evaluateVictory, type VictoryState } from './victory';
import { BALANCE_MOVEMENT, BALANCE_CONTROL } from './balance';

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
  attackerLosses: number;
  defenderLosses: number;
  attackerWon: boolean;
  /** Whether THIS battle flipped ownership (control hit 0). */
  conquered: boolean;
  /** Control remaining after this battle (0 = flipped). */
  controlAfter: number;
};

export type ArrivalEvent = {
  movementId: string;
  ownerId: string;
  fromId: string;
  toId: string;
  troops: number;
  /** Path from origin to destination, used to draw the trail. */
  path: string[];
  arrivedAt: number; // performance.now() timestamp
  outcome: 'reinforce' | 'won' | 'lost' | 'partial';
};

export type TickInput = {
  date: GameDate;
  tickCount: number;
  countries: Record<string, Country>;
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  control: Record<string, number>;
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
    let troops = nation.troops;
    if (gold < 0) {
      const desertion = Math.ceil(-gold * 10);
      troops = Math.max(0, troops - desertion);
      gold = 0;
    }
    updated[id] = { ...nation, gold, troops };
  }
  return updated;
}

function regenerateControl(
  control: Record<string, number>,
  lastBattleTick: Record<string, number>,
  tickCount: number,
): Record<string, number> {
  const next: Record<string, number> = { ...control };
  for (const id of Object.keys(control)) {
    const last = lastBattleTick[id] ?? -Infinity;
    if (tickCount - last < BALANCE_CONTROL.regenGraceTicks) continue;
    if (next[id] >= BALANCE_CONTROL.fullControl) continue;
    next[id] = Math.min(
      BALANCE_CONTROL.fullControl,
      next[id] + BALANCE_CONTROL.regenPerTick,
    );
  }
  return next;
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

function processMovements(input: {
  countries: Record<string, Country>;
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  control: Record<string, number>;
  lastBattleTick: Record<string, number>;
  movements: TroopMovement[];
  tickCount: number;
  rng: () => number;
  now: number;
}): {
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  control: Record<string, number>;
  lastBattleTick: Record<string, number>;
  movements: TroopMovement[];
  battles: BattleLogEntry[];
  arrivals: ArrivalEvent[];
} {
  const { countries, tickCount, rng, now } = input;
  let ownership = { ...input.ownership };
  let nations = { ...input.nations };
  let control = { ...input.control };
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
          [arrival.ownerId]: {
            ...ownerNation,
            troops: ownerNation.troops + arrival.troops,
          },
        };
      }
      // Reinforcing also restores control on the destination.
      control = {
        ...control,
        [destId]: Math.min(
          BALANCE_CONTROL.fullControl,
          (control[destId] ?? BALANCE_CONTROL.fullControl) + 25,
        ),
      };
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

    const result = resolveBattle(
      { troops: arrival.troops, tech: attackerNation.tech },
      {
        troops: defenderNation?.troops ?? 0,
        tech: defenderNation?.tech ?? 1,
      },
      destCountry,
      rng,
    );

    if (defenderOwnerId && defenderNation) {
      nations = {
        ...nations,
        [defenderOwnerId]: {
          ...defenderNation,
          troops: Math.max(0, defenderNation.troops - result.defenderLosses),
        },
      };
    }

    let conquered = false;
    let controlAfter = control[destId] ?? BALANCE_CONTROL.fullControl;
    let outcome: 'won' | 'lost' | 'partial' = 'lost';

    if (result.attackerWon) {
      // Damage control instead of immediate flip.
      const damage =
        BALANCE_CONTROL.damagePerVictoryMin +
        rng() *
          (BALANCE_CONTROL.damagePerVictoryMax -
            BALANCE_CONTROL.damagePerVictoryMin);
      const before = controlAfter;
      controlAfter = Math.max(0, before - damage);
      control = { ...control, [destId]: controlAfter };

      // Surviving attackers garrison the contested ground.
      const survivors = result.attackerSurvivors;
      const refreshedAttacker = nations[arrival.ownerId];
      if (controlAfter <= 0) {
        // Flip ownership and reset control.
        ownership = { ...ownership, [destId]: arrival.ownerId };
        control = { ...control, [destId]: BALANCE_CONTROL.fullControl };
        conquered = true;
        if (refreshedAttacker) {
          nations = {
            ...nations,
            [arrival.ownerId]: {
              ...refreshedAttacker,
              troops: refreshedAttacker.troops + survivors,
            },
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
        // Partial victory — survivors return home (abstractly).
        if (refreshedAttacker) {
          nations = {
            ...nations,
            [arrival.ownerId]: {
              ...refreshedAttacker,
              troops:
                refreshedAttacker.troops + Math.floor(survivors * 0.6),
            },
          };
        }
        // Skirmish always declares war if not already.
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
      // Routed — losing attackers vanish.
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
  if (!self) return { nations, movements };

  switch (action.kind) {
    case 'idle':
      return { nations, movements };
    case 'recruit': {
      const country = countries[selfId];
      if (!country) return { nations, movements };
      const cap = maxTroops(country);
      const wantBatch = 10;
      const cost = wantBatch * recruitCost();
      if (self.gold < cost) return { nations, movements };
      const allowed = Math.min(wantBatch, cap - self.troops);
      if (allowed <= 0) return { nations, movements };
      nations = {
        ...nations,
        [selfId]: {
          ...self,
          gold: self.gold - allowed * recruitCost(),
          troops: self.troops + allowed,
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
          tech: self.tech + techIncrement(self.tech),
        },
      };
      return { nations, movements };
    }
    case 'dispatch': {
      const path = findPath(countries, action.fromId, action.toId);
      if (!path) return { nations, movements };
      const garrison = Math.floor(
        self.troops * BALANCE_MOVEMENT.homeGarrisonFraction,
      );
      const available = self.troops - garrison;
      const send = Math.min(action.troops, available);
      if (send <= 0) return { nations, movements };
      nations = {
        ...nations,
        [selfId]: { ...self, troops: self.troops - send },
      };
      movements = [
        ...movements,
        {
          id: newMovementId(),
          ownerId: selfId,
          fromId: action.fromId,
          toId: action.toId,
          troops: send,
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

  // 1) Economy & upkeep
  let nations = applyEconomy(input.countries, input.ownership, input.nations);

  // 2) Movement & combat
  const moveStep = processMovements({
    countries: input.countries,
    ownership: input.ownership,
    nations,
    control: input.control,
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
  let lastBattleTick = moveStep.lastBattleTick;

  // 2b) Control regeneration on quiet ground
  control = regenerateControl(control, lastBattleTick, input.tickCount);

  // 3) AI thinking
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

  // 4) Victory check
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
    lastBattleTick,
    brains,
    movements,
    newBattles: moveStep.battles,
    newArrivals: moveStep.arrivals,
    victory,
  };
}
