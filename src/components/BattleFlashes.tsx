import { useEffect } from 'react';
import type { GeoProjection } from 'd3';
import { useGameStore } from '../store/gameStore';

type Props = { projection: GeoProjection };

export default function BattleFlashes({ projection }: Props) {
  const flashes = useGameStore((s) => s.flashes);
  const countries = useGameStore((s) => s.countries);
  const pruneFlashes = useGameStore((s) => s.pruneFlashes);

  // Periodically prune stale flashes so they leave the array.
  useEffect(() => {
    const id = setInterval(pruneFlashes, 400);
    return () => clearInterval(id);
  }, [pruneFlashes]);

  return (
    <g pointerEvents="none">
      {flashes.map((f) => {
        const country = countries[f.countryId];
        if (!country) return null;
        const p = projection(country.centroid);
        if (!p) return null;
        return (
          <circle
            key={`${f.countryId}-${f.startedAt}`}
            cx={p[0]}
            cy={p[1]}
            r={4}
            fill="none"
            stroke="var(--accent-blood)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            style={{ animation: 'flash 1.4s ease-out forwards' }}
          />
        );
      })}
      <style>{`
        @keyframes flash {
          0% { r: 4; opacity: 0.95; }
          100% { r: 28; opacity: 0; }
        }
      `}</style>
    </g>
  );
}
