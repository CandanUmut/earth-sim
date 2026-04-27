import type { Country } from './world';
import {
  goldPerTick,
  troopUpkeepPerTick,
  type Nation,
} from './economy';

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

export type TickInput = {
  date: GameDate;
  countries: Record<string, Country>;
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
};

export type TickOutput = {
  date: GameDate;
  nations: Record<string, Nation>;
};

/**
 * Pure tick step. Advances the calendar by one month, applies gold income
 * and troop upkeep to every nation. Combat / movement / AI are layered in
 * later phases on top of this.
 *
 * Defensive: nations with insufficient gold to pay upkeep lose the
 * difference in troops at a 10x multiplier (desertion). Prevents permanent
 * negative gold but punishes overextension.
 */
export function runTick(input: TickInput): TickOutput {
  const { date, countries, ownership, nations } = input;
  const next = advanceDate(date);

  // Count owned territories per owner once.
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
      // Desertion: starved troops walk off. 10 troops lost per gold of debt.
      const desertion = Math.ceil(-gold * 10);
      troops = Math.max(0, troops - desertion);
      gold = 0;
    }

    updated[id] = {
      ...nation,
      gold,
      troops,
    };
  }

  return { date: next, nations: updated };
}
