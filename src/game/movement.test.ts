import { describe, it, expect } from 'vitest';
import {
  findPath,
  advanceMovement,
  hasArrived,
  type TroopMovement,
} from './movement';
import { makeCountry } from './testHelpers';

describe('findPath', () => {
  it('returns a single-element path when src === dst', () => {
    const c = { A: makeCountry({ id: 'A' }) };
    expect(findPath(c, 'A', 'A')).toEqual(['A']);
  });

  it('returns null for unreachable destinations', () => {
    const c = {
      A: makeCountry({ id: 'A', neighbors: [] }),
      B: makeCountry({ id: 'B', neighbors: [] }),
    };
    expect(findPath(c, 'A', 'B')).toBeNull();
  });

  it('finds the shortest path through neighbor adjacency', () => {
    // A — B — C — D — E
    //          \
    //           F
    const c = {
      A: makeCountry({ id: 'A', neighbors: ['B'] }),
      B: makeCountry({ id: 'B', neighbors: ['A', 'C'] }),
      C: makeCountry({ id: 'C', neighbors: ['B', 'D', 'F'] }),
      D: makeCountry({ id: 'D', neighbors: ['C', 'E'] }),
      E: makeCountry({ id: 'E', neighbors: ['D'] }),
      F: makeCountry({ id: 'F', neighbors: ['C'] }),
    };
    expect(findPath(c, 'A', 'F')).toEqual(['A', 'B', 'C', 'F']);
    expect(findPath(c, 'A', 'E')).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('returns null when one of the endpoints is missing', () => {
    const c = { A: makeCountry({ id: 'A' }) };
    expect(findPath(c, 'A', 'Z')).toBeNull();
    expect(findPath(c, 'Z', 'A')).toBeNull();
  });
});

describe('advanceMovement / hasArrived', () => {
  const mkMv = (): TroopMovement => ({
    id: 'm',
    ownerId: 'A',
    fromId: 'A',
    toId: 'C',
    composition: { infantry: 40, cavalry: 8, artillery: 2 },
    troops: 50,
    path: ['A', 'B', 'C'],
    pathIndex: 0,
    launchTick: 0,
  });

  it('advances one step at a time', () => {
    let mv = mkMv();
    expect(hasArrived(mv)).toBe(false);
    mv = advanceMovement(mv)!;
    expect(mv.pathIndex).toBe(1);
    expect(hasArrived(mv)).toBe(false);
    mv = advanceMovement(mv)!;
    expect(mv.pathIndex).toBe(2);
    expect(hasArrived(mv)).toBe(true);
  });

  it('returns null once past the final step', () => {
    const mv = { ...mkMv(), pathIndex: 2 };
    expect(advanceMovement(mv)).toBeNull();
  });
});
