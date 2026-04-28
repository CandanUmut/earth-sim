import { useEffect, useState } from 'react';
import type { GeoProjection } from 'd3';
import { useGameStore } from '../store/gameStore';
import { useSprite } from '../util/spriteCache';

type Props = { projection: GeoProjection };

/**
 * Soft, persistent war markers on the map:
 *  - Fire flicker on every contested tile (control < 100) without an active
 *    battle — these are smoldering insurgencies / lulls between rounds.
 *  - Garrison flag on tiles where the player has stationed troops, so you
 *    can see at a glance which tiles are held with a real garrison vs which
 *    are only nominally yours.
 */
export default function WarMarkers({ projection }: Props) {
  const countries = useGameStore((s) => s.countries);
  const ownership = useGameStore((s) => s.ownership);
  const control = useGameStore((s) => s.control);
  const contestedBy = useGameStore((s) => s.contestedBy);
  const activeBattles = useGameStore((s) => s.activeBattles);
  const garrisons = useGameStore((s) => s.garrisons);
  const playerId = useGameStore((s) => s.playerCountryId);
  const [now, setNow] = useState(() => performance.now());
  const fireSprite = useSprite('marker_fire.png');
  const garrisonSprite = useSprite('marker_garrison.png');

  const contestedIds = Object.keys(contestedBy).filter(
    (id) => !activeBattles[id],
  );
  const garrisonIds = playerId
    ? Object.keys(garrisons).filter(
        (id) =>
          ownership[id] === playerId &&
          (garrisons[id].infantry +
            garrisons[id].cavalry +
            garrisons[id].artillery) >
            0,
      )
    : [];

  useEffect(() => {
    if (contestedIds.length === 0 && garrisonIds.length === 0) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      // ~6 fps for these ambient effects (no need for 60).
      if (t - last > 160) {
        setNow(t);
        last = t;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [contestedIds.length, garrisonIds.length]);

  return (
    <g pointerEvents="none">
      {contestedIds.map((id) => {
        const country = countries[id];
        if (!country) return null;
        const p = projection(country.centroid);
        if (!p) return null;
        const ctl = control[id] ?? 100;
        const intensity = 1 - ctl / 100; // 0–1
        const phase = (now / 800 + id.charCodeAt(0) * 0.13) % 1;
        const flameH = 3 + Math.sin(phase * Math.PI * 2) * 0.8 + intensity * 2;
        if (fireSprite) {
          const size = 8 + intensity * 4;
          return (
            <image
              key={`fire-${id}`}
              href={fireSprite}
              x={p[0] - size / 2}
              y={p[1] - size}
              width={size}
              height={size}
              opacity={0.7 + intensity * 0.3}
              preserveAspectRatio="xMidYMid meet"
            />
          );
        }
        return (
          <g key={`fire-${id}`} transform={`translate(${p[0]} ${p[1]})`}>
            {/* Flame */}
            <ellipse
              cx={0}
              cy={-flameH * 0.3}
              rx={1.4 + intensity}
              ry={flameH}
              fill="#d44a1f"
              opacity={0.55 + intensity * 0.3}
            />
            <ellipse
              cx={0}
              cy={-flameH * 0.5}
              rx={0.8 + intensity * 0.6}
              ry={flameH * 0.6}
              fill="#f0c46f"
              opacity={0.7}
            />
            {/* Smoke wisp */}
            <circle
              cx={0.6 * Math.sin(phase * Math.PI * 2)}
              cy={-flameH - 1.5 - intensity}
              r={1.2 + intensity * 0.6}
              fill="rgba(80,70,60,0.32)"
            />
          </g>
        );
      })}
      {garrisonIds.map((id) => {
        const country = countries[id];
        if (!country) return null;
        const p = projection(country.centroid);
        if (!p) return null;
        const garr = garrisons[id];
        const tot = garr.infantry + garr.cavalry + garr.artillery;
        const text = tot >= 1000 ? `${Math.round(tot / 100) / 10}K` : `${tot}`;
        if (garrisonSprite) {
          const size = 8;
          return (
            <g key={`garr-${id}`} transform={`translate(${p[0] + 5} ${p[1] - 6})`}>
              <image
                href={garrisonSprite}
                x={-size / 2}
                y={-size / 2}
                width={size}
                height={size}
                preserveAspectRatio="xMidYMid meet"
              />
              <text
                x={size / 2 + 2}
                y={2}
                textAnchor="start"
                fontFamily='"JetBrains Mono", monospace'
                fontSize={2.6}
                fontWeight={700}
                fill="var(--ink)"
                stroke="var(--paper)"
                strokeWidth={0.6}
                paintOrder="stroke"
              >
                {text}
              </text>
            </g>
          );
        }
        return (
          <g key={`garr-${id}`} transform={`translate(${p[0] + 6} ${p[1] - 4})`}>
            <rect
              x={-1}
              y={-3}
              width={6}
              height={4.5}
              fill="var(--accent-gold)"
              stroke="var(--ink)"
              strokeWidth={0.18}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={-1}
              y1={-3}
              x2={-1}
              y2={3.5}
              stroke="var(--ink)"
              strokeWidth={0.3}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={2}
              y={0.8}
              textAnchor="middle"
              fontFamily='"JetBrains Mono", monospace'
              fontSize={2.4}
              fontWeight={700}
              fill="var(--ink)"
            >
              {text}
            </text>
          </g>
        );
      })}
    </g>
  );
}
