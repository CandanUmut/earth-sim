import type { Country } from './world';
import { BALANCE_VICTORY } from './balance';

export type VictoryState =
  | { kind: 'ongoing' }
  | { kind: 'win'; year: number; month: number; populationShare: number }
  | { kind: 'loss'; year: number; month: number };

export function totalWorldPopulation(countries: Record<string, Country>): number {
  let sum = 0;
  for (const c of Object.values(countries)) sum += c.population;
  return sum;
}

export function ownerPopulation(
  ownerId: string,
  ownership: Record<string, string>,
  countries: Record<string, Country>,
): number {
  let sum = 0;
  for (const [territoryId, owner] of Object.entries(ownership)) {
    if (owner !== ownerId) continue;
    const c = countries[territoryId];
    if (c) sum += c.population;
  }
  return sum;
}

export function evaluateVictory(args: {
  playerId: string;
  homeId: string;
  ownership: Record<string, string>;
  countries: Record<string, Country>;
  date: { year: number; month: number };
}): VictoryState {
  const { playerId, homeId, ownership, countries, date } = args;

  // Loss: home country fell to someone else.
  if (ownership[homeId] && ownership[homeId] !== playerId) {
    return { kind: 'loss', year: date.year, month: date.month };
  }

  // Win: ≥ threshold share of world population.
  const total = totalWorldPopulation(countries);
  if (total === 0) return { kind: 'ongoing' };
  const owned = ownerPopulation(playerId, ownership, countries);
  const share = owned / total;
  if (share >= BALANCE_VICTORY.populationShareToWin) {
    return {
      kind: 'win',
      year: date.year,
      month: date.month,
      populationShare: share,
    };
  }
  return { kind: 'ongoing' };
}
