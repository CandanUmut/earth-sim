import type { Country } from './world';

export type TroopMovement = {
  id: string;
  ownerId: string;
  fromId: string;
  toId: string;
  troops: number;
  /** Full path of country ids from origin to destination, inclusive. */
  path: string[];
  /** Index of the country the column is currently *in*. Starts at 0. */
  pathIndex: number;
  /** Tick the movement was launched on (for arrival animations). */
  launchTick: number;
};

let movementCounter = 0;
export function newMovementId(): string {
  movementCounter += 1;
  return `mv-${movementCounter}-${Date.now().toString(36)}`;
}

/**
 * Breadth-first search over the country adjacency graph. Returns the shortest
 * path (inclusive of both endpoints) or null if unreachable.
 */
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

/**
 * One-tick step through a movement. Returns the next state of the column,
 * or null if it has arrived at its destination this tick.
 */
export function advanceMovement(mv: TroopMovement): TroopMovement | null {
  const nextIndex = mv.pathIndex + 1;
  if (nextIndex >= mv.path.length) return null;
  return { ...mv, pathIndex: nextIndex };
}

/** Has the movement reached its final destination? */
export function hasArrived(mv: TroopMovement): boolean {
  return mv.pathIndex >= mv.path.length - 1;
}

/** Country id where the column currently sits. */
export function currentLocation(mv: TroopMovement): string {
  return mv.path[mv.pathIndex];
}
