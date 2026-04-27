import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { findPath } from '../game/movement';
import { BALANCE_MOVEMENT } from '../game/balance';
import {
  totalTroops,
  TROOP_LABELS,
  type Composition,
} from '../game/economy';

function fmtNum(n: number): string {
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

export default function SendTroopsModal() {
  const targetId = useGameStore((s) => s.dispatchTargetId);
  const closeDispatch = useGameStore((s) => s.closeDispatch);
  const dispatchTroops = useGameStore((s) => s.dispatchTroops);
  const playerId = useGameStore((s) => s.playerCountryId);
  const countries = useGameStore((s) => s.countries);
  const ownership = useGameStore((s) => s.ownership);
  const nations = useGameStore((s) => s.nations);

  const target = targetId ? countries[targetId] : null;
  const player = playerId ? nations[playerId] : null;
  const targetNation = targetId ? nations[targetId] : null;

  // Per-type max we can send (each pool minus 10 % garrison).
  const availableByType = useMemo(() => {
    if (!player) return { infantry: 0, cavalry: 0, artillery: 0 };
    const g = BALANCE_MOVEMENT.homeGarrisonFraction;
    return {
      infantry: Math.max(0, player.infantry - Math.floor(player.infantry * g)),
      cavalry: Math.max(0, player.cavalry - Math.floor(player.cavalry * g)),
      artillery: Math.max(
        0,
        player.artillery - Math.floor(player.artillery * g),
      ),
    };
  }, [player]);

  const path = useMemo(() => {
    if (!playerId || !targetId) return null;
    const myIds = Object.entries(ownership)
      .filter(([, owner]) => owner === playerId)
      .map(([tid]) => tid);
    let best: string[] | null = null;
    for (const myId of myIds) {
      const p = findPath(countries, myId, targetId);
      if (p && (!best || p.length < best.length)) best = p;
    }
    return best;
  }, [countries, ownership, playerId, targetId]);

  const reachable = path !== null && path.length > 1;
  const hops = path ? path.length - 1 : 0;

  const [send, setSend] = useState<Composition>({
    infantry: 0,
    cavalry: 0,
    artillery: 0,
  });

  // Reset to half each time the target opens.
  useEffect(() => {
    if (!targetId) return;
    setSend({
      infantry: Math.floor(availableByType.infantry / 2),
      cavalry: Math.floor(availableByType.cavalry / 2),
      artillery: Math.floor(availableByType.artillery / 2),
    });
  }, [targetId, availableByType.infantry, availableByType.cavalry, availableByType.artillery]);

  if (!targetId || !target || !player) return <AnimatePresence />;

  const totalSend = send.infantry + send.cavalry + send.artillery;
  const defenderTotal = targetNation ? totalTroops(targetNation) : 0;

  return (
    <AnimatePresence>
      <motion.div
        key="dispatch"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 z-40 flex items-center justify-center"
        style={{ background: 'rgba(26,24,20,0.32)' }}
        onClick={closeDispatch}
      >
        <motion.div
          initial={{ scale: 0.96, y: 10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--ink)',
            boxShadow: '0 8px 24px rgba(26,24,20,0.22)',
            padding: '22px 28px 24px',
            width: 'min(94vw, 460px)',
          }}
        >
          <div
            className="display"
            style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 4 }}
          >
            Mobilize the Realm
          </div>
          <div
            style={{
              fontStyle: 'italic',
              color: 'var(--ink-faded)',
              fontSize: 14,
              marginBottom: 4,
            }}
          >
            Dispatch troops to <strong>{target.name}</strong>
          </div>
          <div
            className="num"
            style={{
              fontSize: 11,
              color: 'var(--ink-faded)',
              marginBottom: 14,
            }}
          >
            Defenders: {fmtNum(defenderTotal)} ·{' '}
            {target.terrain} · {fmtNum(target.population)} pop
          </div>

          {!reachable ? (
            <div
              style={{
                fontStyle: 'italic',
                color: 'var(--accent-blood)',
                marginBottom: 16,
              }}
            >
              Unreachable from any of your territories. Conquer a route first.
            </div>
          ) : (
            <>
              <div
                className="num"
                style={{
                  fontSize: 12,
                  color: 'var(--ink-faded)',
                  marginBottom: 12,
                }}
              >
                Travel: {hops} {hops === 1 ? 'month' : 'months'} · 10 % garrison reserved
              </div>

              {(['infantry', 'cavalry', 'artillery'] as const).map((type) => {
                const max = availableByType[type];
                return (
                  <div key={type} style={{ marginBottom: 10 }}>
                    <div
                      className="flex items-center justify-between"
                      style={{ marginBottom: 4 }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {TROOP_LABELS[type]}
                      </span>
                      <span className="num" style={{ fontSize: 13 }}>
                        {send[type]} / {max}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={max}
                      step={1}
                      value={send[type]}
                      onChange={(e) =>
                        setSend((prev) => ({
                          ...prev,
                          [type]: Number(e.target.value),
                        }))
                      }
                      style={{ width: '100%' }}
                      disabled={max === 0}
                    />
                  </div>
                );
              })}

              <div
                className="num"
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: 'var(--ink-faded)',
                  textAlign: 'right',
                }}
              >
                Total: {fmtNum(totalSend)}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button
              type="button"
              onClick={closeDispatch}
              style={{
                flex: 1,
                background: 'transparent',
                color: 'var(--ink)',
                border: '1px solid var(--ink)',
                padding: '8px 14px',
                fontFamily: '"Crimson Pro", serif',
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!reachable || totalSend <= 0}
              onClick={() => {
                if (totalSend > 0) dispatchTroops(targetId, send);
              }}
              style={{
                flex: 1,
                background:
                  reachable && totalSend > 0 ? 'var(--ink)' : 'transparent',
                color:
                  reachable && totalSend > 0
                    ? 'var(--paper)'
                    : 'var(--ink-faded)',
                border: '1px solid var(--ink)',
                padding: '8px 14px',
                fontFamily: '"Crimson Pro", serif',
                fontSize: 15,
                cursor: reachable && totalSend > 0 ? 'pointer' : 'not-allowed',
                opacity: reachable && totalSend > 0 ? 1 : 0.5,
              }}
            >
              Dispatch
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
