import { useMemo } from 'react';
import polylabel from 'polylabel';
import * as d3 from 'd3';
import type { GeoProjection } from 'd3';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { useGameStore } from '../store/gameStore';
import { BALANCE_CONTROL } from '../game/balance';
import { totalTroops } from '../game/economy';
import type { Country } from '../game/world';

type Props = {
  projection: GeoProjection;
};

import { fmtTroops } from '../util/format';

function badgeColor(args: {
  ownerId: string;
  playerId: string | null;
  playerStance: Record<string, 'war' | 'neutral' | 'allied'> | null;
}): string {
  if (args.ownerId === args.playerId) return 'var(--accent-gold)';
  const stance = args.playerStance?.[args.ownerId];
  if (stance === 'war') return 'var(--accent-blood)';
  if (stance === 'allied') return 'var(--accent-sage)';
  return 'var(--ink-faded)';
}

type PolygonInfo = {
  countryId: string;
  ring: number[][];
  area: number; // projected pixel area
  bounds: [[number, number], [number, number]];
};

type ClusterLabel = {
  clusterId: string;
  ownerId: string;
  /** Country ids in this cluster (all same owner, contiguous via land). */
  members: string[];
  /** Anchor country (largest projected area in cluster). */
  anchorCountryId: string;
  /** Label placement (pole-of-inaccessibility of anchor's largest polygon). */
  x: number;
  y: number;
  /** Total projected area of all cluster members. */
  totalArea: number;
  /** Bounding box of the anchor poly used for placement. */
  anchorBoundsW: number;
  anchorBoundsH: number;
  fontSize: number;
  troops: number; // troops at the owner's home (for badge on anchor)
  showBadge: boolean;
  contestedCountryIds: string[]; // contested members (drawn separately)
};

function projectRing(
  ring: Position[],
  projection: GeoProjection,
): number[][] {
  const projected: number[][] = [];
  for (const c of ring) {
    const p = projection(c as [number, number]);
    if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
      projected.push(p);
    }
  }
  return projected;
}

function ringArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(sum * 0.5);
}

/** Per-country: collect each polygon (Polygon = 1, MultiPolygon = N) projected
 *  with its area + bounds. Used both for cluster anchoring and for picking
 *  which polygon a per-island label sits on. */
function collectPolygons(
  features: Array<Feature<Geometry, Record<string, unknown>>>,
  projection: GeoProjection,
): Map<string, PolygonInfo[]> {
  const out = new Map<string, PolygonInfo[]>();
  const path = d3.geoPath(projection);
  for (const feature of features) {
    const id = (feature as { id?: string }).id ?? '';
    if (!id) continue;
    const geom = feature.geometry;
    const polys: PolygonInfo[] = [];
    if (geom.type === 'Polygon') {
      const ring = projectRing(geom.coordinates[0], projection);
      if (ring.length >= 3) {
        const bounds = path.bounds(feature) as [[number, number], [number, number]];
        polys.push({
          countryId: id,
          ring,
          area: ringArea(ring),
          bounds,
        });
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        const ring = projectRing(poly[0], projection);
        if (ring.length < 3) continue;
        // Per-piece bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const [x, y] of ring) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
        polys.push({
          countryId: id,
          ring,
          area: ringArea(ring),
          bounds: [[minX, minY], [maxX, maxY]],
        });
      }
    }
    out.set(id, polys);
  }
  return out;
}

/** Build connected components of countries owned by the same owner, joined
 *  by land neighbors (NOT naval — separated islands stay separate clusters). */
function buildClusters(
  countries: Record<string, Country>,
  ownership: Record<string, string>,
): Map<string, string[]> {
  // clusterId → memberIds
  const clusterOfCountry = new Map<string, string>();
  const clusters = new Map<string, string[]>();

  let nextClusterIndex = 0;

  for (const [id] of Object.entries(ownership)) {
    if (clusterOfCountry.has(id)) continue;
    const ownerId = ownership[id];
    if (!ownerId) continue;
    // BFS over land neighbors of same owner
    const queue = [id];
    const cid = `cl-${nextClusterIndex++}`;
    const members: string[] = [];
    while (queue.length) {
      const cur = queue.shift()!;
      if (clusterOfCountry.has(cur)) continue;
      if (ownership[cur] !== ownerId) continue;
      clusterOfCountry.set(cur, cid);
      members.push(cur);
      const country = countries[cur];
      if (!country) continue;
      for (const n of country.neighbors) {
        if (!clusterOfCountry.has(n) && ownership[n] === ownerId) {
          queue.push(n);
        }
      }
    }
    if (members.length > 0) clusters.set(cid, members);
  }
  return clusters;
}

/** For one cluster, pick anchor (largest contiguous polygon among members)
 *  and produce the label layout. */
function layoutCluster(args: {
  clusterId: string;
  members: string[];
  ownerName: string;
  polygonsByCountry: Map<string, PolygonInfo[]>;
}): {
  x: number;
  y: number;
  totalArea: number;
  anchorCountryId: string;
  anchorBoundsW: number;
  anchorBoundsH: number;
  fontSize: number;
} | null {
  const { members, ownerName, polygonsByCountry } = args;
  let bestPoly: PolygonInfo | null = null;
  let totalArea = 0;
  for (const memberId of members) {
    const polys = polygonsByCountry.get(memberId) ?? [];
    for (const poly of polys) {
      totalArea += poly.area;
      if (!bestPoly || poly.area > bestPoly.area) bestPoly = poly;
    }
  }
  if (!bestPoly) return null;

  let labelPoint: number[];
  try {
    labelPoint = polylabel([bestPoly.ring], 1.0);
  } catch {
    labelPoint = bestPoly.ring[0];
  }

  const w = bestPoly.bounds[1][0] - bestPoly.bounds[0][0];
  const h = bestPoly.bounds[1][1] - bestPoly.bounds[0][1];

  // Font size grows with TOTAL cluster area (so big empires get big names),
  // capped by anchor polygon dimensions so it always fits.
  const charWidthFactor = 0.55;
  const widthFit = w / Math.max(ownerName.length, 4) / charWidthFactor;
  const sizeFromTotal = Math.sqrt(totalArea) / 7; // empirically tuned
  const fontSize = Math.max(
    3.5,
    Math.min(22, sizeFromTotal, widthFit, h / 2),
  );

  return {
    x: labelPoint[0],
    y: labelPoint[1],
    totalArea,
    anchorCountryId: bestPoly.countryId,
    anchorBoundsW: w,
    anchorBoundsH: h,
    fontSize,
  };
}

export default function CountryAnnotations({ projection }: Props) {
  const countries = useGameStore((s) => s.countries);
  const ownership = useGameStore((s) => s.ownership);
  const nations = useGameStore((s) => s.nations);
  const control = useGameStore((s) => s.control);
  const geo = useGameStore((s) => s.geo);
  const playerId = useGameStore((s) => s.playerCountryId);
  const playerStance = useGameStore((s) =>
    s.playerCountryId ? (s.nations[s.playerCountryId]?.stance ?? null) : null,
  );

  // Project polygons (cached on geo + projection identity).
  const polygonsByCountry = useMemo(() => {
    if (!geo) return new Map<string, PolygonInfo[]>();
    const features = (geo as FeatureCollection).features as Array<
      Feature<Geometry, Record<string, unknown>>
    >;
    return collectPolygons(features, projection);
  }, [geo, projection]);

  // Cluster + layout. Recomputes when ownership changes (cheap; ~180 nodes).
  const labels = useMemo<ClusterLabel[]>(() => {
    if (!geo) return [];
    const clusters = buildClusters(countries, ownership);
    const out: ClusterLabel[] = [];
    for (const [cid, members] of clusters.entries()) {
      const ownerId = ownership[members[0]];
      const ownerCountry = countries[ownerId];
      if (!ownerCountry) continue;
      const layout = layoutCluster({
        clusterId: cid,
        members,
        ownerName: ownerCountry.name,
        polygonsByCountry,
      });
      if (!layout) continue;

      // Show troop badge only if anchor is the actual home country (not a
      // conquered piece) AND the anchor polygon has visual room.
      const anchorIsHome = layout.anchorCountryId === ownerId;
      const ownerNation = nations[ownerId];
      const totalAtHome = ownerNation ? totalTroops(ownerNation) : 0;
      const showBadge =
        anchorIsHome && totalAtHome > 0 && layout.anchorBoundsW >= 22;

      const contestedCountryIds = members.filter(
        (mid) =>
          (control[mid] ?? BALANCE_CONTROL.fullControl) <
          BALANCE_CONTROL.fullControl - 1,
      );

      out.push({
        clusterId: cid,
        ownerId,
        members,
        anchorCountryId: layout.anchorCountryId,
        x: layout.x,
        y: layout.y,
        totalArea: layout.totalArea,
        anchorBoundsW: layout.anchorBoundsW,
        anchorBoundsH: layout.anchorBoundsH,
        fontSize: layout.fontSize,
        troops: totalAtHome,
        showBadge,
        contestedCountryIds,
      });
    }
    return out;
  }, [countries, ownership, nations, control, polygonsByCountry, geo]);

  // For drawing the contested control bar on every contested member, regardless
  // of cluster anchoring, we need each member's individual polygon center.
  const memberCenters = useMemo(() => {
    const out = new Map<string, { x: number; y: number; w: number }>();
    for (const [id, polys] of polygonsByCountry.entries()) {
      let best: PolygonInfo | null = null;
      for (const p of polys) if (!best || p.area > best.area) best = p;
      if (!best) continue;
      let lp: number[];
      try {
        lp = polylabel([best.ring], 1.0);
      } catch {
        lp = best.ring[0];
      }
      out.set(id, {
        x: lp[0],
        y: lp[1],
        w: best.bounds[1][0] - best.bounds[0][0],
      });
    }
    return out;
  }, [polygonsByCountry]);

  return (
    <g pointerEvents="none">
      {labels.map((lbl) => {
        const ownerCountry = countries[lbl.ownerId];
        if (!ownerCountry) return null;
        const fontSize = lbl.fontSize;
        const color = badgeColor({
          ownerId: lbl.ownerId,
          playerId,
          playerStance,
        });
        const isPlayer = lbl.ownerId === playerId;

        return (
          <g key={lbl.clusterId}>
            {/* Empire label */}
            <g transform={`translate(${lbl.x} ${lbl.y})`}>
              <text
                x={0}
                y={0}
                textAnchor="middle"
                fontFamily='"Crimson Pro", serif'
                fontStyle="italic"
                fontWeight={700}
                fontSize={fontSize}
                stroke="var(--paper)"
                strokeWidth={Math.max(1.6, fontSize / 4)}
                strokeLinejoin="round"
                fill={isPlayer ? 'var(--accent-gold)' : 'var(--ink)'}
                paintOrder="stroke"
                style={{ pointerEvents: 'none', letterSpacing: '0.02em' }}
              >
                {ownerCountry.name}
              </text>

              {lbl.showBadge && (
                <g transform={`translate(0 ${fontSize + 1})`}>
                  <rect
                    x={-Math.max(8, fmtTroops(lbl.troops).length * 1.6)}
                    y={0}
                    width={Math.max(16, fmtTroops(lbl.troops).length * 3.2)}
                    height={5}
                    rx={1}
                    fill="var(--paper)"
                    stroke={color}
                    strokeWidth={0.4}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={0}
                    y={4}
                    textAnchor="middle"
                    fontFamily='"JetBrains Mono", monospace'
                    fontWeight={600}
                    fontSize={3.6}
                    fill={color}
                  >
                    {fmtTroops(lbl.troops)}
                  </text>
                </g>
              )}
            </g>

            {/* Per-member contested bars (one per contested tile in cluster) */}
            {lbl.contestedCountryIds.map((mid) => {
              const c = memberCenters.get(mid);
              if (!c) return null;
              if (c.w < 18) return null;
              const ctrl = control[mid] ?? BALANCE_CONTROL.fullControl;
              return (
                <g
                  key={`${lbl.clusterId}-${mid}-ctrl`}
                  transform={`translate(${c.x} ${c.y + fontSize + 5})`}
                >
                  <rect
                    x={-8}
                    y={0}
                    width={16}
                    height={1.2}
                    fill="var(--paper)"
                    stroke="var(--accent-blood)"
                    strokeWidth={0.3}
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={-8}
                    y={0}
                    width={(16 * ctrl) / BALANCE_CONTROL.fullControl}
                    height={1.2}
                    fill="var(--accent-blood)"
                  />
                </g>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}
