import { useMemo } from 'react';
import type { GeoProjection } from 'd3';
import { useGameStore } from '../store/gameStore';
import { BALANCE_CONTROL } from '../game/balance';

type Props = {
  projection: GeoProjection;
};

function fmtTroops(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

/**
 * Label font sizing. Geo area is in steradians; sqrt to get a linear scale,
 * then bucket into 3 sizes. Label still scales with map zoom (it lives
 * inside the transformed group), but the base size matters at default zoom.
 */
function labelFontSize(geoArea: number): number {
  const r = Math.sqrt(Math.max(0.0001, geoArea));
  if (r > 0.25) return 14; // continent-scale: Russia, China, USA, Brazil, Canada
  if (r > 0.10) return 10;
  if (r > 0.04) return 7;
  if (r > 0.01) return 5;
  return 4; // micro — only really legible when zoomed in
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

export default function CountryAnnotations({ projection }: Props) {
  const countries = useGameStore((s) => s.countries);
  const countryOrder = useGameStore((s) => s.countryOrder);
  const ownership = useGameStore((s) => s.ownership);
  const nations = useGameStore((s) => s.nations);
  const control = useGameStore((s) => s.control);
  const playerId = useGameStore((s) => s.playerCountryId);
  const playerStance = useGameStore((s) =>
    s.playerCountryId ? (s.nations[s.playerCountryId]?.stance ?? null) : null,
  );

  // Project all centroids once per render.
  const projected = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const id of countryOrder) {
      const c = countries[id];
      if (!c) continue;
      const p = projection(c.centroid);
      if (p) out[id] = p;
    }
    return out;
  }, [countries, countryOrder, projection]);

  return (
    <g pointerEvents="none">
      {countryOrder.map((id) => {
        const country = countries[id];
        const p = projected[id];
        if (!country || !p) return null;
        const owner = ownership[id] ?? id;
        const ownerNation = nations[owner];
        const troops = ownerNation?.troops ?? 0;
        const ctrl = control[id] ?? BALANCE_CONTROL.fullControl;
        const contested = ctrl < BALANCE_CONTROL.fullControl - 1;
        const fontSize = labelFontSize(country.geoArea);
        const color = badgeColor({
          ownerId: owner,
          playerId,
          playerStance,
        });

        return (
          <g key={id} transform={`translate(${p[0]} ${p[1]})`}>
            {/* Country label — paper outline ensures legibility across fills. */}
            <text
              x={0}
              y={-fontSize - 1}
              textAnchor="middle"
              fontFamily='"Crimson Pro", serif'
              fontStyle="italic"
              fontWeight={600}
              fontSize={fontSize}
              stroke="var(--paper)"
              strokeWidth={Math.max(1.6, fontSize / 4)}
              strokeLinejoin="round"
              fill="none"
              paintOrder="stroke"
              style={{ pointerEvents: 'none' }}
              vectorEffect="non-scaling-stroke"
            >
              {country.name}
            </text>
            <text
              x={0}
              y={-fontSize - 1}
              textAnchor="middle"
              fontFamily='"Crimson Pro", serif'
              fontStyle="italic"
              fontWeight={600}
              fontSize={fontSize}
              fill="var(--ink)"
              style={{ pointerEvents: 'none' }}
            >
              {country.name}
            </text>

            {/* Troop count */}
            {troops > 0 && (
              <g>
                <rect
                  x={-Math.max(10, fmtTroops(troops).length * 2.2)}
                  y={2}
                  width={Math.max(20, fmtTroops(troops).length * 4.4)}
                  height={7}
                  rx={1.5}
                  fill="var(--paper)"
                  stroke={color}
                  strokeWidth={0.5}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={0}
                  y={7.4}
                  textAnchor="middle"
                  fontFamily='"JetBrains Mono", monospace'
                  fontWeight={600}
                  fontSize={5}
                  fill={color}
                >
                  {fmtTroops(troops)}
                </text>
              </g>
            )}

            {/* Control bar — only when contested */}
            {contested && (
              <g>
                <rect
                  x={-12}
                  y={11}
                  width={24}
                  height={2}
                  fill="var(--paper)"
                  stroke="var(--accent-blood)"
                  strokeWidth={0.4}
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={-12}
                  y={11}
                  width={(24 * ctrl) / BALANCE_CONTROL.fullControl}
                  height={2}
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
