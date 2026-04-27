import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { findPath } from '../game/movement';
import { BALANCE_MOVEMENT } from '../game/balance';

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

  const garrison = player
    ? Math.floor(player.troops * BALANCE_MOVEMENT.homeGarrisonFraction)
    : 0;
  const available = player ? Math.max(0, player.troops - garrison) : 0;

  const path = useMemo(() => {
    if (!playerId || !targetId) return null;
    // shortest path from any owned territory to target
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

  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(Math.min(available, Math.max(10, Math.floor(available / 2))));
  }, [targetId, available]);

  if (!targetId || !target || !player) {
    return <AnimatePresence />;
  }

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
            width: 'min(92vw, 420px)',
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
              marginBottom: 16,
            }}
          >
            Dispatch troops to <strong>{target.name}</strong>
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
                  marginBottom: 10,
                }}
              >
                Travel: {hops} {hops === 1 ? 'month' : 'months'} ·
                Garrison reserved: {garrison}
              </div>
              <input
                type="range"
                min={0}
                max={available}
                step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                style={{ width: '100%' }}
              />
              <div
                className="flex items-center justify-between num"
                style={{ marginTop: 6, fontSize: 14 }}
              >
                <span style={{ color: 'var(--ink-faded)' }}>0</span>
                <span style={{ fontSize: 22 }}>{count}</span>
                <span style={{ color: 'var(--ink-faded)' }}>{available}</span>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
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
              disabled={!reachable || count <= 0}
              onClick={() => {
                if (count > 0) dispatchTroops(targetId, count);
              }}
              style={{
                flex: 1,
                background:
                  reachable && count > 0 ? 'var(--ink)' : 'transparent',
                color: reachable && count > 0 ? 'var(--paper)' : 'var(--ink-faded)',
                border: '1px solid var(--ink)',
                padding: '8px 14px',
                fontFamily: '"Crimson Pro", serif',
                fontSize: 15,
                cursor: reachable && count > 0 ? 'pointer' : 'not-allowed',
                opacity: reachable && count > 0 ? 1 : 0.5,
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
