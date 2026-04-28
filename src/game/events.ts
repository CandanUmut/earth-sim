/**
 * World events — random shocks that fire every dozen-ish ticks. Designed to
 * keep the simulation unpredictable so the player can't snowball on autopilot.
 *
 * Events have rough categories:
 *   - bad_player: hits the leader (helps balance)
 *   - bad_random: hits a random nation (mostly the player will notice these)
 *   - good_random: gives a random nation a boost
 *   - good_player: rare lucky breaks for the player
 *
 * The mix is biased so that as the player's relative strength grows, the
 * proportion of bad_player events climbs. This is the simulation's invisible
 * coalition / pushback before the explicit coalition trigger fires.
 */

import type { Nation } from './economy';

export type GameEventKind =
  | 'plague'
  | 'peasant_revolt'
  | 'gold_rush'
  | 'tech_breakthrough'
  | 'general_defects'
  | 'storm_at_sea';

export type GameEvent = {
  id: string;
  tick: number;
  kind: GameEventKind;
  /** Country (or owner) targeted by the event. */
  targetId: string;
  /** Free-text description for the toast. */
  message: string;
};

export const BALANCE_EVENTS = {
  /** Average ticks between events. We roll once every ~14 ticks. */
  rollInterval: 14,
  /** Probability of an event per roll. */
  rollProbability: 0.65,
  /** Maximum stored in the event log shown to the player. */
  logSize: 12,
} as const;

let eventSerial = 0;
function newEventId(): string {
  eventSerial += 1;
  return `ev-${eventSerial}-${Date.now().toString(36)}`;
}

export type EventTrigger = {
  tickCount: number;
  countryOrder: string[];
  ownership: Record<string, string>;
  populations: Record<string, number>;
  nations: Record<string, Nation>;
  playerCountryId: string | null;
  rng: () => number;
};

export type EventResult = {
  event: GameEvent;
  /** Mutations expressed as patches to apply in tick.ts. */
  populationDelta: Record<string, number>;
  goldDelta: Record<string, number>;
  troopDelta: Record<string, number>; // applied uniformly across composition
  ownershipChange?: { countryId: string; newOwner: string };
};

function pickPlayerLeadShare(args: EventTrigger): number {
  if (!args.playerCountryId) return 0;
  let total = 0;
  let owned = 0;
  for (const [id, owner] of Object.entries(args.ownership)) {
    const pop = args.populations[id] ?? 0;
    total += pop;
    if (owner === args.playerCountryId) owned += pop;
  }
  return total > 0 ? owned / total : 0;
}

function pickRandomCountry(
  args: EventTrigger,
  filter?: (id: string) => boolean,
): string | null {
  const eligible = args.countryOrder.filter((id) =>
    filter ? filter(id) : true,
  );
  if (eligible.length === 0) return null;
  return eligible[Math.floor(args.rng() * eligible.length)];
}

/**
 * Roll: returns either an EventResult (event fires) or null (nothing this roll).
 * Caller is responsible for the cadence (only call every `rollInterval` ticks).
 */
export function rollWorldEvent(args: EventTrigger): EventResult | null {
  if (args.rng() > BALANCE_EVENTS.rollProbability) return null;

  const playerLead = pickPlayerLeadShare(args);
  const playerWeight = Math.min(0.6, 0.15 + playerLead * 1.4);
  const targetsPlayer = args.rng() < playerWeight;
  const playerOwned = args.playerCountryId
    ? Object.entries(args.ownership)
        .filter(([, owner]) => owner === args.playerCountryId)
        .map(([id]) => id)
    : [];

  // Weighted kind selection.
  const kinds: { kind: GameEventKind; weight: number }[] = [
    { kind: 'plague', weight: 1 },
    { kind: 'peasant_revolt', weight: 1.2 },
    { kind: 'gold_rush', weight: 0.7 },
    { kind: 'tech_breakthrough', weight: 0.5 },
    { kind: 'general_defects', weight: 1 },
    { kind: 'storm_at_sea', weight: 0.4 },
  ];
  const totalWeight = kinds.reduce((s, k) => s + k.weight, 0);
  let r = args.rng() * totalWeight;
  let kind: GameEventKind = 'plague';
  for (const { kind: k, weight } of kinds) {
    if ((r -= weight) <= 0) {
      kind = k;
      break;
    }
  }

  switch (kind) {
    case 'plague': {
      const targetId = targetsPlayer && playerOwned.length > 0
        ? playerOwned[Math.floor(args.rng() * playerOwned.length)]
        : pickRandomCountry(args);
      if (!targetId) return null;
      const pop = args.populations[targetId] ?? 0;
      const lost = Math.round(pop * 0.15);
      return {
        event: {
          id: newEventId(),
          tick: args.tickCount,
          kind,
          targetId,
          message: `Plague sweeps through. -15 % population.`,
        },
        populationDelta: { [targetId]: -lost },
        goldDelta: {},
        troopDelta: {},
      };
    }
    case 'peasant_revolt': {
      // A revolt fires on a tile owned by someone other than its home country.
      const conqueredTiles = args.countryOrder.filter(
        (id) => args.ownership[id] !== id,
      );
      if (conqueredTiles.length === 0) return null;
      // Bias toward player's recently conquered ones if they're leading.
      const playerConq = conqueredTiles.filter(
        (id) => args.ownership[id] === args.playerCountryId,
      );
      const pool =
        targetsPlayer && playerConq.length > 0 ? playerConq : conqueredTiles;
      const targetId = pool[Math.floor(args.rng() * pool.length)];
      return {
        event: {
          id: newEventId(),
          tick: args.tickCount,
          kind,
          targetId,
          message: `Peasants revolt. Territory breaks free.`,
        },
        populationDelta: {},
        goldDelta: {},
        troopDelta: {},
        ownershipChange: { countryId: targetId, newOwner: targetId },
      };
    }
    case 'gold_rush': {
      const targetId = !targetsPlayer
        ? pickRandomCountry(args, (id) => id !== args.playerCountryId)
        : pickRandomCountry(args);
      if (!targetId) return null;
      const owner = args.ownership[targetId];
      return {
        event: {
          id: newEventId(),
          tick: args.tickCount,
          kind,
          targetId,
          message: `A gold rush. +400 gold for ${owner}.`,
        },
        populationDelta: {},
        goldDelta: { [owner]: 400 },
        troopDelta: {},
      };
    }
    case 'tech_breakthrough': {
      const targetId = !targetsPlayer
        ? pickRandomCountry(args, (id) => id !== args.playerCountryId)
        : pickRandomCountry(args);
      if (!targetId) return null;
      const owner = args.ownership[targetId];
      return {
        event: {
          id: newEventId(),
          tick: args.tickCount,
          kind,
          targetId,
          message: `Scientific breakthrough. Tech spike for ${owner}.`,
        },
        populationDelta: {},
        goldDelta: {},
        troopDelta: {},
      };
    }
    case 'general_defects': {
      const targetId = targetsPlayer && playerOwned.length > 0
        ? args.playerCountryId
        : pickRandomCountry(args);
      if (!targetId) return null;
      const owner = args.ownership[targetId] ?? targetId;
      const n = args.nations[owner];
      const total = n ? n.infantry + n.cavalry + n.artillery : 0;
      const lost = Math.round(total * 0.18);
      return {
        event: {
          id: newEventId(),
          tick: args.tickCount,
          kind,
          targetId,
          message: `A general defects. -18 % troops for ${owner}.`,
        },
        populationDelta: {},
        goldDelta: {},
        troopDelta: { [owner]: -lost },
      };
    }
    case 'storm_at_sea': {
      // Cosmetic event for now; concrete losses come if you have naval movements.
      const targetId = pickRandomCountry(args);
      if (!targetId) return null;
      return {
        event: {
          id: newEventId(),
          tick: args.tickCount,
          kind,
          targetId,
          message: `Storms wreck shipping. Naval columns suffer.`,
        },
        populationDelta: {},
        goldDelta: {},
        troopDelta: {},
      };
    }
  }
}
