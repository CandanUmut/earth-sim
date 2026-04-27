import type { GeoProjection } from 'd3';
import type { Country } from '../game/world';
import type { TroopMovement } from '../game/movement';

type Props = {
  projection: GeoProjection;
  movements: TroopMovement[];
  countries: Record<string, Country>;
  playerId: string | null;
  playerStance: Record<string, 'war' | 'neutral' | 'allied'> | null;
};

/** Deterministic 0-1 jitter from a movement id; keeps arrows from re-wobbling on re-render. */
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

/** Arrows are rendered inside the transformed map group, so projection
 *  outputs land in the right pixel coordinates. */
export default function MovementArrows({
  projection,
  movements,
  countries,
  playerId,
  playerStance,
}: Props) {
  return (
    <g pointerEvents="none">
      <defs>
        <marker
          id="arrowhead-gold"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-gold)" />
        </marker>
        <marker
          id="arrowhead-blood"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-blood)" />
        </marker>
        <marker
          id="arrowhead-sage"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent-sage)" />
        </marker>
        <marker
          id="arrowhead-faded"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-faded)" />
        </marker>
      </defs>

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
          (playerStance?.[mv.ownerId] === 'war' ||
            playerStance?.[mv.ownerId] === 'allied');
        if (!visible) return null;

        // Wobbly bezier control points for hand-drawn feel.
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        // Perpendicular offset
        const len = Math.hypot(dx, dy) || 1;
        const px = -dy / len;
        const py = dx / len;
        const wobble1 = (hashUnit(mv.id, 1) - 0.5) * len * 0.25;
        const wobble2 = (hashUnit(mv.id, 2) - 0.5) * len * 0.18;
        const c1: [number, number] = [
          a[0] + dx * 0.33 + px * wobble1,
          a[1] + dy * 0.33 + py * wobble1,
        ];
        const c2: [number, number] = [
          a[0] + dx * 0.66 + px * wobble2,
          a[1] + dy * 0.66 + py * wobble2,
        ];

        const d = `M ${a[0]} ${a[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${b[0]} ${b[1]}`;

        const markerId =
          color === 'var(--accent-gold)'
            ? 'arrowhead-gold'
            : color === 'var(--accent-blood)'
              ? 'arrowhead-blood'
              : color === 'var(--accent-sage)'
                ? 'arrowhead-sage'
                : 'arrowhead-faded';

        // Show progress along the arrow as a solid stub, faded ahead-of-position dashes.
        const progress = mv.path.length > 1 ? mv.pathIndex / (mv.path.length - 1) : 1;
        return (
          <g key={mv.id}>
            <path
              d={d}
              stroke={color}
              strokeWidth={1.4}
              fill="none"
              strokeOpacity={0.85}
              strokeDasharray="6 4"
              vectorEffect="non-scaling-stroke"
              markerEnd={`url(#${markerId})`}
              style={{
                animation: 'march 1.2s linear infinite',
              }}
            />
            <circle
              cx={mid[0] + (a[0] - mid[0]) * (1 - progress * 2)}
              cy={mid[1] + (a[1] - mid[1]) * (1 - progress * 2)}
              r={2.5}
              fill={color}
              opacity={0.6}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
      <style>{`
        @keyframes march {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -20; }
        }
      `}</style>
    </g>
  );
}
