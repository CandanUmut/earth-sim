import { geoCentroid, geoArea } from 'd3';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

export type Terrain = 'plains' | 'mountain' | 'island' | 'desert' | 'forest';

export type Country = {
  id: string;
  name: string;
  centroid: [number, number];
  neighbors: string[];
  population: number;
  baseEconomy: number;
  terrain: Terrain;
  /** Surface area in steradians (Mercator-independent). Used to size labels. */
  geoArea: number;
};

export type CountryFeature = Feature<Geometry, Record<string, unknown>>;

export type WorldData = {
  countries: Country[];
  geo: FeatureCollection;
};

const NE_COUNTRIES_URL = `${import.meta.env.BASE_URL}data/countries.geojson`;

/**
 * Stable id derived from Natural Earth properties. Falls back through ISO_A3
 * → ADM0_A3 → ADMIN/NAME because some sovereign-claim entries (Kosovo, France,
 * Norway) have ISO_A3 == '-99'.
 */
function featureId(feature: CountryFeature): string {
  const p = feature.properties ?? {};
  const iso = (p.ISO_A3 as string) || '';
  if (iso && iso !== '-99') return iso;
  const adm = (p.ADM0_A3 as string) || '';
  if (adm && adm !== '-99') return adm;
  return ((p.ADMIN as string) || (p.NAME as string) || 'UNKNOWN').toUpperCase();
}

function featureName(feature: CountryFeature): string {
  const p = feature.properties ?? {};
  return (p.ADMIN as string) || (p.NAME as string) || (p.NAME_LONG as string) || 'Unknown';
}

function featurePopulation(feature: CountryFeature): number {
  const p = feature.properties ?? {};
  const pop = Number(p.POP_EST ?? 0);
  return Number.isFinite(pop) && pop > 0 ? pop : 100_000;
}

function featureBaseEconomy(feature: CountryFeature): number {
  const p = feature.properties ?? {};
  const gdp = Number(p.GDP_MD ?? p.GDP_MD_EST ?? 0);
  if (Number.isFinite(gdp) && gdp > 0) {
    // Compress GDP into a 1–20 range for tick economy.
    return Math.max(1, Math.min(20, Math.log10(gdp) * 2));
  }
  // Fallback: derive from population.
  return Math.max(1, Math.min(20, Math.log10(featurePopulation(feature)) * 1.2));
}

/**
 * Latitude/longitude heuristic for placeholder terrain. Will be replaced with
 * real biome data later if needed; for now this just gives the map some
 * texture and combat flavor.
 */
function inferTerrain(
  feature: CountryFeature,
  centroid: [number, number],
): Terrain {
  const [lon, lat] = centroid;
  const geomType = feature.geometry.type;

  // Small island nations
  if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
    const coords = (feature.geometry as { coordinates: unknown }).coordinates as Position[][][] | Position[][];
    const polyCount = Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray((coords[0] as unknown[])[0])
      ? (coords as Position[][][]).length
      : 1;
    if (polyCount >= 3 && Math.abs(lat) < 60) return 'island';
  }

  if (lat >= 60 || lat <= -55) return 'mountain';

  // Major mountain belts (rough)
  const inHimalaya = lon >= 70 && lon <= 100 && lat >= 25 && lat <= 40;
  const inAndes = lon >= -80 && lon <= -65 && lat >= -55 && lat <= 10;
  const inRockies = lon >= -125 && lon <= -100 && lat >= 35 && lat <= 60;
  if (inHimalaya || inAndes || inRockies) return 'mountain';

  // Tropical band
  if (lat >= -23.5 && lat <= 23.5) {
    // Sahara/Arabian/Australian deserts split by longitude
    const inSahara = lon >= -15 && lon <= 35 && lat >= 12 && lat <= 30;
    const inArabia = lon >= 35 && lon <= 60 && lat >= 12 && lat <= 30;
    const inOzDesert = lon >= 115 && lon <= 145 && lat >= -30 && lat <= -18;
    if (inSahara || inArabia || inOzDesert) return 'desert';
    return 'forest';
  }

  // Mid-latitude deserts
  if ((lat >= 20 && lat <= 40) && (lon >= -120 && lon <= -100)) return 'desert';
  if ((lat >= 35 && lat <= 50) && (lon >= 60 && lon <= 100)) return 'desert';

  return 'plains';
}

/**
 * Build neighbor adjacency by indexing rounded boundary coordinates. Two
 * countries are neighbors iff they share at least one rounded coordinate.
 * Resolution of the rounding grid trades false-positive risk against false-
 * negative risk; 0.01° ≈ 1 km is fine for 110m geometry.
 */
function computeNeighbors(features: CountryFeature[]): Map<string, Set<string>> {
  const idAt: Map<string, Set<string>> = new Map();
  const ids = features.map((f) => featureId(f));

  const collectCoords = (geom: Geometry, out: Position[]): void => {
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) for (const c of ring) out.push(c);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates)
        for (const ring of poly) for (const c of ring) out.push(c);
    }
  };

  features.forEach((feature, i) => {
    const id = ids[i];
    const coords: Position[] = [];
    collectCoords(feature.geometry, coords);
    for (const [lon, lat] of coords) {
      const key = `${Math.round(lon * 100)}:${Math.round(lat * 100)}`;
      let bucket = idAt.get(key);
      if (!bucket) {
        bucket = new Set();
        idAt.set(key, bucket);
      }
      bucket.add(id);
    }
  });

  const adj: Map<string, Set<string>> = new Map();
  features.forEach((_, i) => adj.set(ids[i], new Set()));
  for (const bucket of idAt.values()) {
    if (bucket.size < 2) continue;
    const arr = Array.from(bucket);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        adj.get(arr[i])!.add(arr[j]);
        adj.get(arr[j])!.add(arr[i]);
      }
    }
  }
  return adj;
}

let cachedWorld: WorldData | null = null;

export async function loadWorld(): Promise<WorldData> {
  if (cachedWorld) return cachedWorld;

  const res = await fetch(NE_COUNTRIES_URL);
  if (!res.ok) throw new Error(`Failed to load countries.geojson: ${res.status}`);
  const geo = (await res.json()) as FeatureCollection;

  const features = geo.features as CountryFeature[];
  const adj = computeNeighbors(features);

  const countries: Country[] = features.map((feature) => {
    const id = featureId(feature);
    const centroid = geoCentroid(feature) as [number, number];
    return {
      id,
      name: featureName(feature),
      centroid,
      neighbors: Array.from(adj.get(id) ?? []),
      population: Math.round(featurePopulation(feature)),
      baseEconomy: featureBaseEconomy(feature),
      terrain: inferTerrain(feature, centroid),
      geoArea: geoArea(feature),
    };
  });

  // Stash id back onto each feature for fast path lookup at render time.
  features.forEach((f) => {
    (f as { id?: string }).id = featureId(f);
  });

  cachedWorld = { countries, geo };
  return cachedWorld;
}

/** Deterministic muted paper-palette color hashed from a country id. */
export function countryFill(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Hue spans warm earthy range only (20–55°), low saturation, high lightness.
  const hue = 20 + (Math.abs(h) % 36);
  const sat = 18 + (Math.abs(h >>> 8) % 14);
  const light = 72 + (Math.abs(h >>> 16) % 10);
  return `hsl(${hue} ${sat}% ${light}%)`;
}
