import type { Country } from './world';
import type { Composition } from './economy';

export type TroopMovement = {
  id: string;
  ownerId: string;
  fromId: string;
  toId: string;
  /** Per-type composition of the marching column. */
  composition: Composition;
  /** Sum of the composition, cached for cheap rendering. */
  troops: number;
  path: string[];
  pathIndex: number;
  launchTick: number;
};

let movementCounter = 0;
export function newMovementId(): string {
  movementCounter += 1;
  return `mv-${movementCounter}-${Date.now().toString(36)}`;
}

export function findPath(
  countries: Record<string, Country>,
  fromId: string,
  toId: string,
): string[] | null {
  if (fromId === toId) return [fromId];
  const start = countries[fromId];
  const end = countries[toId];
  if (!start || !end) return null;

  const queue: string[] = [fromId];
  const cameFrom: Record<string, string | null> = { [fromId]: null };

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toId) {
      const path: string[] = [];
      let cursor: string | null = current;
      while (cursor !== null) {
        path.unshift(cursor);
        cursor = cameFrom[cursor];
      }
      return path;
    }
    const country = countries[current];
    if (!country) continue;
    for (const neighbor of country.neighbors) {
      if (neighbor in cameFrom) continue;
      cameFrom[neighbor] = current;
      queue.push(neighbor);
    }
  }
  return null;
}

export function advanceMovement(mv: TroopMovement): TroopMovement | null {
  const nextIndex = mv.pathIndex + 1;
  if (nextIndex >= mv.path.length) return null;
  return { ...mv, pathIndex: nextIndex };
}

export function hasArrived(mv: TroopMovement): boolean {
  return mv.pathIndex >= mv.path.length - 1;
}

export function currentLocation(mv: TroopMovement): string {
  return mv.path[mv.pathIndex];
}
