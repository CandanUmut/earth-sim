import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { GameEventKind } from '../game/events';

const KIND_COLORS: Record<GameEventKind, string> = {
  plague: 'var(--accent-blood)',
  peasant_revolt: 'var(--accent-blood)',
  general_defects: 'var(--accent-blood)',
  storm_at_sea: 'var(--ink-faded)',
  gold_rush: 'var(--accent-gold)',
  tech_breakthrough: 'var(--accent-sage)',
};

const KIND_LABELS: Record<GameEventKind, string> = {
  plague: 'Plague',
  peasant_revolt: 'Revolt',
  general_defects: 'Defection',
  storm_at_sea: 'Storm',
  gold_rush: 'Gold Rush',
  tech_breakthrough: 'Breakthrough',
};

const DISMISS_AFTER_MS = 6000;

export default function EventToast() {
  const unread = useGameStore((s) => s.unreadEvents);
  const acknowledge = useGameStore((s) => s.acknowledgeEvent);
  const countries = useGameStore((s) => s.countries);
  const setSelected = useGameStore((s) => s.setSelected);
  const setCameraTarget = useGameStore((s) => s.setCameraTarget);

  // Auto-dismiss the oldest after a few seconds.
  useEffect(() => {
    if (unread.length === 0) return;
    const t = setTimeout(() => {
      acknowledge(unread[0].id);
    }, DISMISS_AFTER_MS);
    return () => clearTimeout(t);
  }, [unread, acknowledge]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence initial={false}>
        {unread.map((e) => {
          const country = countries[e.targetId];
          const color = KIND_COLORS[e.kind];
          return (
            <motion.div
              key={e.id}
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                pointerEvents: 'auto',
                background: 'var(--paper)',
                border: `1px solid ${color}`,
                boxShadow: '0 6px 18px rgba(26,24,20,0.18)',
                padding: '10px 14px',
                minWidth: 320,
                maxWidth: 420,
                position: 'relative',
              }}
            >
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => acknowledge(e.id)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--ink-faded)',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={12} />
              </button>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <AlertTriangle size={13} style={{ color }} />
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color,
                  }}
                >
                  {KIND_LABELS[e.kind]}
                </span>
                {country && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(e.targetId);
                      setCameraTarget({
                        kind: 'country',
                        countryId: e.targetId,
                        scale: 4,
                      });
                      acknowledge(e.id);
                    }}
                    style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--ink-faded)',
                      cursor: 'pointer',
                      fontStyle: 'italic',
                      padding: 0,
                    }}
                  >
                    {country.name} →
                  </button>
                )}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                {e.message}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
