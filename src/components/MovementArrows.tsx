import type { GeoProjection } from 'd3';
import type { Country } from '../game/world';
import type { TroopMovement } from '../game/movement';
import { isNavalLeg } from '../game/movement';
import type { ArrivalEvent } from '../game/tick';
import { useGameStore } from '../store/gameStore';
import { useSprite } from '../util/spriteCache';

type Props = {
  projection: GeoProjection;
  movements: TroopMovement[];
  trails: ArrivalEvent[];
  countries: Record<string, Country>;
  playerId: string | null;
  playerStance: Record<string, 'war' | 'neutral' | 'allied'> | null;
};

const TRAIL_DURATION = 3000;

function hashUnit(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function arrowColor(args: {
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

import { fmtTroops } from '../util/format';

function buildArrowPath(
  a: [number, number],
  b: [number, number],
  id: string,
): { path: string; mid: [number, number] } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const w1 = (hashUnit(id, 1) - 0.5) * len * 0.25;
  const w2 = (hashUnit(id, 2) - 0.5) * len * 0.18;
  const c1: [number, number] = [
    a[0] + dx * 0.33 + px * w1,
    a[1] + dy * 0.33 + py * w1,
  ];
  const c2: [number, number] = [
    a[0] + dx * 0.66 + px * w2,
    a[1] + dy * 0.66 + py * w2,
  ];
  return {
    path: `M ${a[0]} ${a[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${b[0]} ${b[1]}`,
    mid: [a[0] + dx * 0.5 + px * (w1 + w2) * 0.25, a[1] + dy * 0.5 + py * (w1 + w2) * 0.25],
  };
}

function markerIdFor(color: string): string {
  if (color === 'var(--accent-gold)') return 'arrowhead-gold';
  if (color === 'var(--accent-blood)') return 'arrowhead-blood';
  if (color === 'var(--accent-sage)') return 'arrowhead-sage';
  return 'arrowhead-faded';
}

export default function MovementArrows({
  projection,
  movements,
  trails,
  countries,
  playerId,
  playerStance,
}: Props) {
  const nations = useGameStore((s) => s.nations);
  const shipSprite = useSprite('marker_ship.png');
  const tankSprite = useSprite('marker_tank.png');
  return (
    <g pointerEvents="none">
      <defs>
        {(['gold', 'blood', 'sage', 'faded'] as const).map((variant) => (
          <marker
            key={variant}
            id={`arrowhead-${variant}`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill={
                variant === 'gold'
                  ? 'var(--accent-gold)'
                  : variant === 'blood'
                    ? 'var(--accent-blood)'
                    : variant === 'sage'
                      ? 'var(--accent-sage)'
                      : 'var(--ink-faded)'
              }
            />
          </marker>
        ))}
      </defs>

      {/* Persistent ghost trails for arrived movements */}
      {trails.map((t) => {
        const fromCountry = countries[t.fromId];
        const toCountry = countries[t.toId];
        if (!fromCountry || !toCountry) return null;
        const a = projection(fromCountry.centroid);
        const b = projection(toCountry.centroid);
        if (!a || !b) return null;
        const visible =
          t.ownerId === playerId ||
          playerId === null ||
          playerStance?.[t.ownerId] === 'war' ||
          playerStance?.[t.ownerId] === 'allied';
        if (!visible) return null;

        const color = arrowColor({ ownerId: t.ownerId, playerId, playerStance });
        const { path } = buildArrowPath(a, b, t.movementId);
        const age = performance.now() - t.arrivedAt;
        const opacity = Math.max(0, 0.5 * (1 - age / TRAIL_DURATION));
        return (
          <path
            key={`trail-${t.movementId}`}
            d={path}
            stroke={color}
            strokeWidth={1}
            fill="none"
            opacity={opacity}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
            markerEnd={`url(#${markerIdFor(color)})`}
          />
        );
      })}

      {/* Active movement arrows */}
      {movements.map((mv) => {
        const fromCountry = countries[mv.path[mv.pathIndex] ?? mv.fromId];
        const toCountry = countries[mv.toId];
        if (!fromCountry || !toCountry) return null;
        const a = projection(fromCountry.centroid);
        const b = projection(toCountry.centroid);
        if (!a || !b) return null;

        const color = arrowColor({ ownerId: mv.ownerId, playerId, playerStance });
        const visible =
          mv.ownerId === playerId ||
          playerId === null ||
          playerStance?.[mv.ownerId] === 'war' ||
          playerStance?.[mv.ownerId] === 'allied';
        if (!visible) return null;

        const { path, mid } = buildArrowPath(a, b, mv.id);
        const markerId = markerIdFor(color);

        // Naval if any remaining hop crosses water.
        let goesByWater = false;
        for (let i = mv.pathIndex; i < mv.path.length - 1; i++) {
          if (isNavalLeg(countries, mv.path[i], mv.path[i + 1])) {
            goesByWater = true;
            break;
          }
        }
        const dashArray = goesByWater ? '2 3' : '6 4';
        const ownerNation = nations[mv.ownerId];
        const isModern =
          !!ownerNation && ownerNation.unlockedTech.includes('mil_combined_arms');

        return (
          <g key={mv.id}>
            <path
              d={path}
              stroke={color}
              strokeWidth={1.6}
              fill="none"
              strokeOpacity={0.92}
              strokeDasharray={dashArray}
              vectorEffect="non-scaling-stroke"
              markerEnd={`url(#${markerId})`}
              style={{ animation: 'march 1.2s linear infinite' }}
            />
            {/* Naval column: ship sprite at the midpoint */}
            {goesByWater && shipSprite && (
              <image
                href={shipSprite}
                x={mid[0] - 5}
                y={mid[1] - 8}
                width={10}
                height={10}
                preserveAspectRatio="xMidYMid meet"
                opacity={0.95}
              />
            )}
            {/* Modern-tech column: tank sprite at the source end */}
            {!goesByWater && isModern && tankSprite && (
              <image
                href={tankSprite}
                x={a[0] - 4}
                y={a[1] - 8}
                width={8}
                height={8}
                preserveAspectRatio="xMidYMid meet"
                opacity={0.95}
              />
            )}
            {/* Troop count label following the column */}
            <g transform={`translate(${mid[0]} ${mid[1]})`}>
              <rect
                x={-9}
                y={-3.5}
                width={18}
                height={6}
                rx={1}
                fill="var(--paper)"
                stroke={color}
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={0}
                y={1}
                textAnchor="middle"
                fontFamily='"JetBrains Mono", monospace'
                fontWeight={600}
                fontSize={4}
                fill={color}
              >
                {fmtTroops(mv.troops)}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
