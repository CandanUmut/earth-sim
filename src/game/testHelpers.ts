import type { Country, Terrain } from './world';

/**
 * Tiny LCG seeded RNG so tests can pin combat/AI outcomes. Returns numbers
 * in [0, 1). Not cryptographically anything, just stable-across-runs.
 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  if (s === 0) s = 1;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 0x100000000;
  };
}

export function makeCountry(over: Partial<Country> & { id: string }): Country {
  return {
    id: over.id,
    name: over.name ?? over.id,
    centroid: over.centroid ?? [0, 0],
    neighbors: over.neighbors ?? [],
    population: over.population ?? 1_000_000,
    baseEconomy: over.baseEconomy ?? 5,
    terrain: over.terrain ?? ('plains' as Terrain),
    geoArea: over.geoArea ?? 0.01,
  };
}
