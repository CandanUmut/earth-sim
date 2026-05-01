import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Swords, X, Crown, Coins, MapPin } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import {
  goalWeight,
  maxClaimsByPower,
  peaceThreshold,
  type WarGoal,
  type WarGoalKind,
} from '../game/wars';
import { totalTroops } from '../game/economy';

const goalIcons: Record<WarGoalKind, JSX.Element> = {
  annex_tile: <MapPin size={12} />,
  vassalize: <Crown size={12} />,
  tribute: <Coins size={12} />,
};

export default function DeclareWarModal() {
  const targetId = useGameStore((s) => s.declareWarTargetId);
  const close = useGameStore((s) => s.closeDeclareWar);
  const declareWar = useGameStore((s) => s.declareWar);
  const playerId = useGameStore((s) => s.playerCountryId);
  const playerNation = useGameStore((s) =>
    s.playerCountryId ? s.nations[s.playerCountryId] : null,
  );
  const targetNation = useGameStore((s) =>
    s.declareWarTargetId ? s.nations[s.declareWarTargetId] : null,
  );
  const targetCountry = useGameStore((s) =>
    s.declareWarTargetId ? s.countries[s.declareWarTargetId] : null,
  );
  const ownership = useGameStore((s) => s.ownership);
  const countries = useGameStore((s) => s.countries);

  const [picked, setPicked] = useState<WarGoal[]>([]);

  const open = !!(
    targetId &&
    playerId &&
    targetId !== playerId &&
    targetNation &&
    targetCountry
  );

  // Reset picks when target changes.
  useMemo(() => setPicked([]), [targetId]);

  const maxClaims =
    playerNation && targetNation ? maxClaimsByPower(playerNation, targetNation) : 0;

  // Tiles owned by target nation (their home + any conquests).
  const targetTiles = useMemo(() => {
    if (!targetId) return [] as string[];
    const ids: string[] = [];
    for (const [tid, owner] of Object.entries(ownership)) {
      if (owner === targetId) ids.push(tid);
    }
    return ids.slice(0, 6); // cap UI to 6 to keep modal small
  }, [ownership, targetId]);

  if (!open || !targetCountry || !targetNation || !playerNation) return null;

  const power =
    (totalTroops(playerNation) * Math.max(0.1, playerNation.tech)) /
    Math.max(1, totalTroops(targetNation) * Math.max(0.1, targetNation.tech));
  const threshold = peaceThreshold(picked);
  const totalWeight = picked.reduce((s, g) => s + goalWeight(g.kind), 0);

  const togglePick = (goal: WarGoal) => {
    setPicked((prev) => {
      const exists = prev.find(
        (g) => g.kind === goal.kind && g.targetId === goal.targetId,
      );
      if (exists) {
        return prev.filter(
          (g) => !(g.kind === goal.kind && g.targetId === goal.targetId),
        );
      }
      // Each goal kind allowed once except annex_tile.
      if (goal.kind !== 'annex_tile' && prev.some((g) => g.kind === goal.kind)) {
        return prev.filter((g) => g.kind !== goal.kind).concat(goal);
      }
      if (prev.length >= maxClaims) return prev; // capped
      return [...prev, goal];
    });
  };

  const isPicked = (goal: WarGoal) =>
    picked.some((g) => g.kind === goal.kind && g.targetId === goal.targetId);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(26,24,20,0.45)' }}
          onClick={close}
        >
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--ink)',
              boxShadow: '0 8px 24px rgba(26,24,20,0.25)',
              padding: '22px 26px',
              maxWidth: 460,
              width: 'min(92vw, 460px)',
            }}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 p-1.5 hover:opacity-60"
              style={{ color: 'var(--ink-faded)' }}
            >
              <X size={16} />
            </button>

            <div
              className="display"
              style={{
                fontSize: 24,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--accent-blood)',
              }}
            >
              <Swords size={20} /> Declare War on {targetCountry.name}
            </div>
            <div
              style={{
                fontStyle: 'italic',
                color: 'var(--ink-faded)',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              Choose your war goals. The defender will sue for peace once their
              exhaustion reaches the demand's weight.
            </div>

            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--ink-faded)',
                marginBottom: 6,
              }}
            >
              Strength × {power.toFixed(2)} · max {maxClaims} claim
              {maxClaims === 1 ? '' : 's'}
            </div>

            <div style={{ marginBottom: 14 }}>
              {targetTiles.map((tid) => {
                const c = countries[tid];
                if (!c) return null;
                const goal: WarGoal = { kind: 'annex_tile', targetId: tid };
                return (
                  <ClaimRow
                    key={tid}
                    icon={goalIcons.annex_tile}
                    label={`Annex ${c.name}`}
                    weight={goalWeight('annex_tile')}
                    picked={isPicked(goal)}
                    disabled={!isPicked(goal) && picked.length >= maxClaims}
                    onClick={() => togglePick(goal)}
                  />
                );
              })}
              <ClaimRow
                icon={goalIcons.tribute}
                label={`Demand tribute from ${targetCountry.name}`}
                weight={goalWeight('tribute')}
                picked={isPicked({ kind: 'tribute', targetId: targetId! })}
                disabled={
                  !isPicked({ kind: 'tribute', targetId: targetId! }) &&
                  picked.length >= maxClaims
                }
                onClick={() =>
                  togglePick({ kind: 'tribute', targetId: targetId! })
                }
              />
              <ClaimRow
                icon={goalIcons.vassalize}
                label={`Vassalize ${targetCountry.name}`}
                weight={goalWeight('vassalize')}
                picked={isPicked({ kind: 'vassalize', targetId: targetId! })}
                disabled={
                  !isPicked({ kind: 'vassalize', targetId: targetId! }) &&
                  picked.length >= maxClaims
                }
                onClick={() =>
                  togglePick({ kind: 'vassalize', targetId: targetId! })
                }
              />
            </div>

            <div
              style={{
                borderTop: '1px solid var(--ink-faded)',
                paddingTop: 10,
                marginBottom: 12,
                fontSize: 12,
                color: 'var(--ink-faded)',
              }}
            >
              {picked.length === 0
                ? 'No goals — this will be a war for nothing. White peace allowed any time.'
                : `Defender must reach ${threshold} exhaustion (sum of ${totalWeight}) to accept these terms.`}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={close}
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--ink-faded)',
                  color: 'var(--ink-faded)',
                  padding: '8px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!targetId) return;
                  declareWar(targetId, picked);
                }}
                style={{
                  background: 'var(--accent-blood)',
                  border: '1px solid var(--ink)',
                  color: 'var(--paper)',
                  padding: '8px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Declare War
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ClaimRow({
  icon,
  label,
  weight,
  picked,
  disabled,
  onClick,
}: {
  icon: JSX.Element;
  label: string;
  weight: number;
  picked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 10px',
        marginBottom: 6,
        background: picked ? 'var(--accent-gold)' : 'var(--paper)',
        border: `1px solid ${picked ? 'var(--ink)' : 'var(--ink-faded)'}`,
        color: picked ? 'var(--paper)' : 'var(--ink)',
        fontFamily: '"Crimson Pro", serif',
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        {label}
      </span>
      <span
        className="num"
        style={{
          fontSize: 11,
          color: picked ? 'var(--paper)' : 'var(--ink-faded)',
        }}
      >
        +{weight}
      </span>
    </button>
  );
}
