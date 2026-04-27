import { useEffect, useState } from 'react';
import type { GeoProjection } from 'd3';
import { useGameStore, BATTLE_ANIM_MS } from '../store/gameStore';
import { countryFill } from '../game/world';

type Props = { projection: GeoProjection };

const ATTACKER_DOTS_MAX = 10;
const DEFENDER_DOTS_MAX = 10;

/** Deterministic 0–1 from string + nonce. */
function rand(seed: string, n: number): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export default function BattleAnimations({ projection }: Props) {
  const animations = useGameStore((s) => s.battleAnimations);
  const countries = useGameStore((s) => s.countries);
  const [now, setNow] = useState(() => performance.now());

  // Drive a re-render at ~30fps for the duration of any active animation.
  useEffect(() => {
    if (animations.length === 0) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animations.length]);

  return (
    <g pointerEvents="none">
      {animations.map((a) => {
        const country = countries[a.countryId];
        if (!country) return null;
        const p = projection(country.centroid);
        if (!p) return null;
        const elapsed = now - a.startedAt;
        const t = Math.min(1, Math.max(0, elapsed / BATTLE_ANIM_MS));
        if (t >= 1) return null;

        const attackerColor = countryFill(a.attackerOwnerId);
        const defenderColor = countryFill(a.defenderOwnerId);

        const totalAtkBefore = Math.max(1, a.attackerTroopsBefore);
        const totalDefBefore = Math.max(1, a.defenderTroopsBefore);
        // Dots remaining after losses-so-far at time t.
        const atkLossFrac = Math.min(1, (a.totalAttackerLosses / totalAtkBefore) * t);
        const defLossFrac = Math.min(1, (a.totalDefenderLosses / totalDefBefore) * t);
        const atkDots = Math.max(
          1,
          Math.round(ATTACKER_DOTS_MAX * (1 - atkLossFrac)),
        );
        const defDots = Math.max(
          a.defenderTroopsBefore > 0 ? 1 : 0,
          Math.round(DEFENDER_DOTS_MAX * (1 - defLossFrac)),
        );

        // Cluster anchors: attackers on the left, defenders on the right.
        const ATK_CX = p[0] - 7;
        const DEF_CX = p[0] + 7;
        const CY = p[1];

        const dotEls: JSX.Element[] = [];
        for (let i = 0; i < ATTACKER_DOTS_MAX; i++) {
          if (i >= atkDots) {
            // fading-out casualty
            dotEls.push(
              <circle
                key={`a-out-${i}`}
                cx={ATK_CX + (rand(a.id, i) - 0.5) * 8}
                cy={CY + (rand(a.id, i + 99) - 0.5) * 6}
                r={0.9}
                fill={attackerColor}
                opacity={Math.max(0, 1 - (t - i / ATTACKER_DOTS_MAX) * 4)}
                vectorEffect="non-scaling-stroke"
              />,
            );
          } else {
            dotEls.push(
              <circle
                key={`a-${i}`}
                cx={ATK_CX + (rand(a.id, i) - 0.5) * 8}
                cy={CY + (rand(a.id, i + 99) - 0.5) * 6}
                r={1.1}
                fill={attackerColor}
                stroke="var(--ink)"
                strokeWidth={0.15}
                vectorEffect="non-scaling-stroke"
              />,
            );
          }
        }
        for (let i = 0; i < DEFENDER_DOTS_MAX; i++) {
          if (i >= defDots) {
            dotEls.push(
              <circle
                key={`d-out-${i}`}
                cx={DEF_CX + (rand(a.id, i + 200) - 0.5) * 8}
                cy={CY + (rand(a.id, i + 300) - 0.5) * 6}
                r={0.9}
                fill={defenderColor}
                opacity={Math.max(0, 1 - (t - i / DEFENDER_DOTS_MAX) * 4)}
                vectorEffect="non-scaling-stroke"
              />,
            );
          } else {
            dotEls.push(
              <circle
                key={`d-${i}`}
                cx={DEF_CX + (rand(a.id, i + 200) - 0.5) * 8}
                cy={CY + (rand(a.id, i + 300) - 0.5) * 6}
                r={1.1}
                fill={defenderColor}
                stroke="var(--ink)"
                strokeWidth={0.15}
                vectorEffect="non-scaling-stroke"
              />,
            );
          }
        }

        // Bullets: 3 streaks per side, animated fly-time scaled by t.
        const bullets: JSX.Element[] = [];
        for (let i = 0; i < 3; i++) {
          const phase = ((t * 3) + i / 3) % 1;
          if (phase < 0.05 || phase > 0.85) continue;
          const fromAtk = i % 2 === 0;
          const fromX = fromAtk
            ? ATK_CX + (rand(a.id, i + 400) - 0.5) * 8
            : DEF_CX + (rand(a.id, i + 600) - 0.5) * 8;
          const fromY = CY + (rand(a.id, i + 500) - 0.5) * 6;
          const toX = fromAtk
            ? DEF_CX + (rand(a.id, i + 700) - 0.5) * 8
            : ATK_CX + (rand(a.id, i + 800) - 0.5) * 8;
          const toY = CY + (rand(a.id, i + 900) - 0.5) * 6;
          // Lerp along the bullet's flight.
          const localT = (phase - 0.05) / 0.8;
          const bx = fromX + (toX - fromX) * localT;
          const by = fromY + (toY - fromY) * localT;
          bullets.push(
            <line
              key={`b-${i}`}
              x1={bx - (toX - fromX) * 0.08}
              y1={by - (toY - fromY) * 0.08}
              x2={bx + (toX - fromX) * 0.04}
              y2={by + (toY - fromY) * 0.04}
              stroke={fromAtk ? attackerColor : defenderColor}
              strokeWidth={0.6}
              opacity={0.9}
              vectorEffect="non-scaling-stroke"
            />,
          );
        }

        // Conquest flourish at the very end.
        const conquestPulse =
          a.conquered && t > 0.7 ? (
            <circle
              cx={p[0]}
              cy={p[1]}
              r={4 + (t - 0.7) * 60}
              fill="none"
              stroke={attackerColor}
              strokeWidth={1.4}
              opacity={Math.max(0, 1 - (t - 0.7) / 0.3)}
              vectorEffect="non-scaling-stroke"
            />
          ) : null;

        return (
          <g key={a.id} opacity={Math.max(0, 1 - (t - 0.85) / 0.15)}>
            {dotEls}
            {bullets}
            {conquestPulse}
          </g>
        );
      })}
    </g>
  );
}
