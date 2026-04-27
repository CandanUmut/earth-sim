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

/**
 * Dijkstra over land + naval edges. Land hops cost 1, naval hops cost
 * `navalCost` (default 2; 1 once Naval Engineers tech is unlocked).
 */
export function findPath(
  countries: Record<string, Country>,
  fromId: string,
  toId: string,
  navalCost = 2,
): string[] | null {
  if (fromId === toId) return [fromId];
  const start = countries[fromId];
  const end = countries[toId];
  if (!start || !end) return null;

  const dist: Record<string, number> = { [fromId]: 0 };
  const cameFrom: Record<string, string | null> = { [fromId]: null };
  // Tiny priority queue using simple array sort; 180 nodes — fine.
  const queue: Array<{ id: string; d: number }> = [{ id: fromId, d: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.d - b.d);
    const { id: current, d } = queue.shift()!;
    if (current === toId) {
      const path: string[] = [];
      let cursor: string | null = current;
      while (cursor !== null) {
        path.unshift(cursor);
        cursor = cameFrom[cursor];
      }
      return path;
    }
    if (d > (dist[current] ?? Infinity)) continue;
    const country = countries[current];
    if (!country) continue;
    const expand = (next: string, cost: number) => {
      const newDist = d + cost;
      if (newDist < (dist[next] ?? Infinity)) {
        dist[next] = newDist;
        cameFrom[next] = current;
        queue.push({ id: next, d: newDist });
      }
    };
    for (const n of country.neighbors) expand(n, 1);
    for (const n of country.navalNeighbors) expand(n, navalCost);
  }
  return null;
}

/** True iff the hop from `from` → `to` is a sea crossing (not a land border). */
export function isNavalLeg(
  countries: Record<string, Country>,
  from: string,
  to: string,
): boolean {
  const a = countries[from];
  if (!a) return false;
  if (a.neighbors.includes(to)) return false;
  return a.navalNeighbors.includes(to);
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
