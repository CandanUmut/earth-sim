import { useEffect } from 'react';
import type { GeoProjection } from 'd3';
import { useGameStore } from '../store/gameStore';

type Props = { projection: GeoProjection };

const TRAIL_DURATION = 3000; // ms

const outcomeColor = {
  won: 'var(--accent-blood)',
  lost: 'var(--ink-faded)',
  partial: '#c97a1f', // ember
  reinforce: 'var(--accent-gold)',
} as const;

export default function BattleFlashes({ projection }: Props) {
  const trails = useGameStore((s) => s.arrivalTrails);
  const countries = useGameStore((s) => s.countries);
  const pruneTrails = useGameStore((s) => s.pruneTrails);

  useEffect(() => {
    const id = setInterval(pruneTrails, 300);
    return () => clearInterval(id);
  }, [pruneTrails]);

  return (
    <g pointerEvents="none">
      {trails.map((t) => {
        const dest = countries[t.toId];
        if (!dest) return null;
        const p = projection(dest.centroid);
        if (!p) return null;
        const color = outcomeColor[t.outcome];
        const age = performance.now() - t.arrivedAt;
        const opacity = Math.max(0, 1 - age / TRAIL_DURATION);
        return (
          <g key={`${t.movementId}-${t.arrivedAt}`}>
            <circle
              cx={p[0]}
              cy={p[1]}
              r={3}
              fill="none"
              stroke={color}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              style={{
                animation: 'flash 1.6s ease-out forwards',
                pointerEvents: 'none',
              }}
            />
            {/* Inner pulse for conquests */}
            {t.outcome === 'won' && (
              <circle
                cx={p[0]}
                cy={p[1]}
                r={2}
                fill={color}
                opacity={0.5}
                vectorEffect="non-scaling-stroke"
                style={{ animation: 'flashCore 1.6s ease-out forwards' }}
              />
            )}
            {/* Floating troop count */}
            <text
              x={p[0]}
              y={p[1] - 10}
              textAnchor="middle"
              fontFamily='"JetBrains Mono", monospace'
              fontWeight={600}
              fontSize={5}
              fill={color}
              opacity={opacity}
              style={{
                animation: 'floatUp 2s ease-out forwards',
              }}
            >
              {t.outcome === 'reinforce' ? '+' : ''}
              {Math.round(t.troops)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
