import { useMemo } from 'react';
import polylabel from 'polylabel';
import * as d3 from 'd3';
import type { GeoProjection } from 'd3';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { useGameStore } from '../store/gameStore';
import { BALANCE_CONTROL } from '../game/balance';
import { totalTroops } from '../game/economy';

type Props = {
  projection: GeoProjection;
};

function fmtTroops(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

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

type LabelLayout = {
  x: number;
  y: number;
  /** Width of polygon's bounding box in pixels. */
  pxWidth: number;
  pxHeight: number;
  fontSize: number;
};

/**
 * Compute the pole-of-inaccessibility (deepest point inside the polygon) for
 * each country. For MultiPolygons, use the largest polygon by projected
 * area. Label font is scaled to fit the polygon width.
 */
function computeLabelLayouts(
  features: Array<Feature<Geometry, Record<string, unknown>>>,
  projection: GeoProjection,
): Map<string, LabelLayout> {
  const path = d3.geoPath(projection);
  const out = new Map<string, LabelLayout>();

  const projectRing = (ring: Position[]): number[][] => {
    const projected: number[][] = [];
    for (const c of ring) {
      const p = projection(c as [number, number]);
      if (p && Number.isFinite(p[0]) && Number.isFinite(p[1])) {
        projected.push(p);
      }
    }
    return projected;
  };

  const ringArea = (ring: number[][]): number => {
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      sum += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    }
    return Math.abs(sum * 0.5);
  };

  for (const feature of features) {
    const id = (feature as { id?: string }).id ?? '';
    if (!id) continue;
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const name = (props.ADMIN as string) || (props.NAME as string) || id;
    const geom = feature.geometry;

    let bestRing: number[][] | null = null;
    let bestArea = 0;

    if (geom.type === 'Polygon') {
      const ring = projectRing(geom.coordinates[0]);
      if (ring.length >= 3) {
        bestRing = ring;
        bestArea = ringArea(ring);
      }
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        const ring = projectRing(poly[0]);
        if (ring.length < 3) continue;
        const a = ringArea(ring);
        if (a > bestArea) {
          bestArea = a;
          bestRing = ring;
        }
      }
    }

    if (!bestRing) continue;

    let labelPoint: number[];
    try {
      labelPoint = polylabel([bestRing], 1.0);
    } catch {
      labelPoint = bestRing[0];
    }

    const bounds = path.bounds(feature);
    const pxWidth = bounds[1][0] - bounds[0][0];
    const pxHeight = bounds[1][1] - bounds[0][1];
    // Font size that fits horizontally; clamp so very large countries don't
    // get gigantic labels.
    const charWidthFactor = 0.55;
    const targetByWidth = pxWidth / Math.max(name.length, 4) / charWidthFactor;
    const fontSize = Math.max(2.2, Math.min(12, targetByWidth, pxHeight / 3));

    out.set(id, {
      x: labelPoint[0],
      y: labelPoint[1],
      pxWidth,
      pxHeight,
      fontSize,
    });
  }
  return out;
}

export default function CountryAnnotations({ projection }: Props) {
  const countries = useGameStore((s) => s.countries);
  const countryOrder = useGameStore((s) => s.countryOrder);
  const ownership = useGameStore((s) => s.ownership);
  const nations = useGameStore((s) => s.nations);
  const control = useGameStore((s) => s.control);
  const geo = useGameStore((s) => s.geo);
  const playerId = useGameStore((s) => s.playerCountryId);
  const playerStance = useGameStore((s) =>
    s.playerCountryId ? (s.nations[s.playerCountryId]?.stance ?? null) : null,
  );

  const layouts = useMemo(() => {
    if (!geo) return new Map<string, LabelLayout>();
    const features = (geo as FeatureCollection).features as Array<
      Feature<Geometry, Record<string, unknown>>
    >;
    return computeLabelLayouts(features, projection);
  }, [geo, projection]);

  return (
    <g pointerEvents="none">
      {countryOrder.map((id) => {
        const country = countries[id];
        const layout = layouts.get(id);
        if (!country || !layout) return null;
        const owner = ownership[id] ?? id;
        const ownerCountry = countries[owner] ?? country;
        const isCapital = owner === id;
        const ownerNation = nations[owner];
        const totalAtCapital = ownerNation ? totalTroops(ownerNation) : 0;
        const ctrl = control[id] ?? BALANCE_CONTROL.fullControl;
        const contested = ctrl < BALANCE_CONTROL.fullControl - 1;
        const fontSize = layout.fontSize;
        const color = badgeColor({
          ownerId: owner,
          playerId,
          playerStance,
        });
        // Only show troop badge on capitals with troops, AND only if there's
        // visual room (avoids splatting numbers across micro-states).
        const showBadge =
          isCapital && totalAtCapital > 0 && layout.pxWidth >= 22;
        // Display owner's name on conquered territories so the empire reads
        // as one. Smaller / lighter for non-capital territories.
        const displayName = ownerCountry.name;
        const labelOpacity = isCapital ? 1 : 0.65;

        return (
          <g key={id} transform={`translate(${layout.x} ${layout.y})`}>
            {/* Country / empire label (paint-order stroke for legibility) */}
            <text
              x={0}
              y={0}
              textAnchor="middle"
              fontFamily='"Crimson Pro", serif'
              fontStyle="italic"
              fontWeight={isCapital ? 700 : 500}
              fontSize={fontSize}
              stroke="var(--paper)"
              strokeWidth={Math.max(1.4, fontSize / 4)}
              strokeLinejoin="round"
              fill="var(--ink)"
              paintOrder="stroke"
              opacity={labelOpacity}
              style={{ pointerEvents: 'none' }}
            >
              {displayName}
            </text>

            {showBadge && (
              <g transform={`translate(0 ${fontSize + 1})`}>
                <rect
                  x={-Math.max(8, fmtTroops(totalAtCapital).length * 1.6)}
                  y={0}
                  width={Math.max(16, fmtTroops(totalAtCapital).length * 3.2)}
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
                  {fmtTroops(totalAtCapital)}
                </text>
              </g>
            )}

            {contested && layout.pxWidth >= 18 && (
              <g transform={`translate(0 ${fontSize + (showBadge ? 8 : 2)})`}>
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
            )}
          </g>
        );
      })}
    </g>
  );
}
