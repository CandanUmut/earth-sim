import { useEffect, useState } from 'react';
import type { GeoProjection } from 'd3';
import { useGameStore, BATTLE_ANIM_MS } from '../store/gameStore';
import { countryFill } from '../game/world';
import { totalUnits } from '../game/activeBattle';

type Props = { projection: GeoProjection };

const ATTACKER_DOTS_MAX = 14;
const DEFENDER_DOTS_MAX = 14;

/** Deterministic 0–1 from string + nonce. */
function rand(seed: string, n: number): number {
  let h = 2166136261 ^ n;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Combined renderer for:
 *  - Persistent vignettes for in-progress ActiveBattle entries
 *  - Short conquest/defeat flashes from the legacy battleAnimations queue
 *
 * Both share a soldier/cannon/smoke aesthetic, but the persistent ones
 * keep ticking forever while the battle is alive.
 */
export default function BattleAnimations({ projection }: Props) {
  const animations = useGameStore((s) => s.battleAnimations);
  const activeBattles = useGameStore((s) => s.activeBattles);
  const countries = useGameStore((s) => s.countries);
  const nations = useGameStore((s) => s.nations);
  const ownership = useGameStore((s) => s.ownership);
  const openBattleHub = useGameStore((s) => s.openBattleHub);
  const playerId = useGameStore((s) => s.playerCountryId);
  const [now, setNow] = useState(() => performance.now());

  const hasActive = Object.keys(activeBattles).length > 0;
  const hasFlashes = animations.length > 0;

  // Drive a re-render at ~30fps for the duration of any active animation.
  useEffect(() => {
    if (!hasActive && !hasFlashes) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasActive, hasFlashes]);

  return (
    <g>
      {/* Persistent active battles */}
      <g>
        {Object.values(activeBattles).map((battle) => {
          const country = countries[battle.locationCountryId];
          if (!country) return null;
          const p = projection(country.centroid);
          if (!p) return null;
          const attackerColor = countryFill(battle.attackerOwnerId);
          const defenderOwnerId =
            ownership[battle.locationCountryId] ?? battle.defenderOwnerId;
          const defenderColor = countryFill(defenderOwnerId);
          const defenderNation = nations[defenderOwnerId];
          const defenderTotal = defenderNation
            ? defenderNation.infantry + defenderNation.cavalry + defenderNation.artillery
            : 0;
          const attackerTotal = totalUnits(battle.attackerForce);
          const initialAttackerEst = Math.max(
            attackerTotal,
            attackerTotal + battle.totalAttackerLosses,
          );
          const initialDefenderEst = Math.max(
            defenderTotal + battle.totalDefenderLosses,
            1,
          );
          const atkLossFrac =
            battle.totalAttackerLosses /
            Math.max(1, initialAttackerEst + battle.totalAttackerLosses);
          const defLossFrac =
            battle.totalDefenderLosses /
            Math.max(1, initialDefenderEst);

          const atkDots = Math.max(
            attackerTotal > 0 ? 1 : 0,
            Math.round(ATTACKER_DOTS_MAX * Math.max(0, 1 - atkLossFrac)),
          );
          const defDots = Math.max(
            defenderTotal > 0 ? 1 : 0,
            Math.round(DEFENDER_DOTS_MAX * Math.max(0, 1 - defLossFrac)),
          );

          // Phase oscillates with time so muzzle flashes / cannon puffs
          // animate continuously while the battle persists.
          const t = (now / 900) % 1;
          const ATK_CX = p[0] - 7;
          const DEF_CX = p[0] + 7;
          const CY = p[1];

          const elements: JSX.Element[] = [];
          // Smoke cloud (low-opacity ellipse pulsing).
          const smokeR = 11 + Math.sin(now / 600) * 1.6;
          elements.push(
            <ellipse
              key="smoke"
              cx={p[0]}
              cy={p[1]}
              rx={smokeR}
              ry={smokeR * 0.55}
              fill="rgba(80,72,62,0.24)"
              vectorEffect="non-scaling-stroke"
            />,
            // Inner darker smoke
            <ellipse
              key="smoke2"
              cx={p[0]}
              cy={p[1] - 1}
              rx={smokeR * 0.65}
              ry={smokeR * 0.32}
              fill="rgba(40,34,26,0.28)"
              vectorEffect="non-scaling-stroke"
            />,
            // Two faction flags so you can read the front lines at a glance.
            <g key="flag-atk" transform={`translate(${p[0] - 11} ${p[1] - 2})`}>
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke="var(--ink)"
                strokeWidth={0.3}
                vectorEffect="non-scaling-stroke"
              />
              <rect x={0} y={0} width={3.2} height={2} fill={attackerColor} stroke="var(--ink)" strokeWidth={0.18} vectorEffect="non-scaling-stroke" />
            </g>,
            <g key="flag-def" transform={`translate(${p[0] + 11} ${p[1] - 2})`}>
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke="var(--ink)"
                strokeWidth={0.3}
                vectorEffect="non-scaling-stroke"
              />
              <rect x={-3.2} y={0} width={3.2} height={2} fill={defenderColor} stroke="var(--ink)" strokeWidth={0.18} vectorEffect="non-scaling-stroke" />
            </g>,
          );
          // Central spark / muzzle flash flicker.
          {
            const flickerPhase = (now / 130) % 1;
            if (flickerPhase < 0.18) {
              elements.push(
                <circle
                  key="spark"
                  cx={p[0]}
                  cy={p[1]}
                  r={1.6 + Math.random() * 0.6}
                  fill="#ffd55a"
                  opacity={0.85}
                />,
              );
            }
          }

          for (let i = 0; i < ATTACKER_DOTS_MAX; i++) {
            const live = i < atkDots;
            const cx = ATK_CX + (rand(battle.id, i) - 0.5) * 8;
            const cy = CY + (rand(battle.id, i + 99) - 0.5) * 6;
            elements.push(
              <circle
                key={`a-${i}`}
                cx={cx}
                cy={cy}
                r={live ? 1.1 : 0.6}
                fill={attackerColor}
                stroke={live ? 'var(--ink)' : 'none'}
                strokeWidth={0.15}
                opacity={live ? 1 : 0.18}
                vectorEffect="non-scaling-stroke"
              />,
            );
          }
          for (let i = 0; i < DEFENDER_DOTS_MAX; i++) {
            const live = i < defDots;
            const cx = DEF_CX + (rand(battle.id, i + 200) - 0.5) * 8;
            const cy = CY + (rand(battle.id, i + 300) - 0.5) * 6;
            elements.push(
              <circle
                key={`d-${i}`}
                cx={cx}
                cy={cy}
                r={live ? 1.1 : 0.6}
                fill={defenderColor}
                stroke={live ? 'var(--ink)' : 'none'}
                strokeWidth={0.15}
                opacity={live ? 1 : 0.18}
                vectorEffect="non-scaling-stroke"
              />,
            );
          }
          // Two pairs of bullet streaks always animating (one each way).
          for (let i = 0; i < 4; i++) {
            const phase = (t * 2 + i / 4) % 1;
            if (phase < 0.04 || phase > 0.86) continue;
            const fromAtk = i % 2 === 0;
            const fromX = fromAtk
              ? ATK_CX + (rand(battle.id, i + 400) - 0.5) * 8
              : DEF_CX + (rand(battle.id, i + 600) - 0.5) * 8;
            const fromY = CY + (rand(battle.id, i + 500) - 0.5) * 6;
            const toX = fromAtk
              ? DEF_CX + (rand(battle.id, i + 700) - 0.5) * 8
              : ATK_CX + (rand(battle.id, i + 800) - 0.5) * 8;
            const toY = CY + (rand(battle.id, i + 900) - 0.5) * 6;
            const localT = (phase - 0.04) / 0.82;
            const bx = fromX + (toX - fromX) * localT;
            const by = fromY + (toY - fromY) * localT;
            elements.push(
              <line
                key={`b-${i}`}
                x1={bx - (toX - fromX) * 0.08}
                y1={by - (toY - fromY) * 0.08}
                x2={bx + (toX - fromX) * 0.04}
                y2={by + (toY - fromY) * 0.04}
                stroke={fromAtk ? attackerColor : defenderColor}
                strokeWidth={0.7}
                opacity={0.95}
                vectorEffect="non-scaling-stroke"
              />,
            );
          }
          // Crossed-swords icon above for clarity (small).
          elements.push(
            <g key="icon" transform={`translate(${p[0]} ${p[1] - 12})`}>
              <text
                textAnchor="middle"
                fontFamily='"Crimson Pro", serif'
                fontSize={4.5}
                fontStyle="italic"
                fontWeight={700}
                fill={
                  battle.attackerOwnerId === playerId
                    ? 'var(--accent-gold)'
                    : 'var(--accent-blood)'
                }
                stroke="var(--paper)"
                strokeWidth={0.8}
                paintOrder="stroke"
              >
                ⚔ Battle · R{battle.rounds}
              </text>
            </g>,
          );

          // Click target so the player can open the Battle Hub.
          elements.push(
            <circle
              key="hit"
              cx={p[0]}
              cy={p[1]}
              r={11}
              fill="rgba(0,0,0,0)"
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                openBattleHub(battle.locationCountryId);
              }}
            />,
          );

          return (
            <g key={battle.id} pointerEvents="auto">
              {elements}
            </g>
          );
        })}
      </g>

      {/* Short-lived flashes (conquest pulse / quick-resolve battles) */}
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
          // Conquest flourish at the very end.
          const conquestPulse =
            a.conquered && t > 0.4 ? (
              <circle
                cx={p[0]}
                cy={p[1]}
                r={4 + (t - 0.4) * 90}
                fill="none"
                stroke={attackerColor}
                strokeWidth={1.4}
                opacity={Math.max(0, 1 - (t - 0.4) / 0.6)}
                vectorEffect="non-scaling-stroke"
              />
            ) : null;
          return <g key={a.id}>{conquestPulse}</g>;
        })}
      </g>
    </g>
  );
}
