import { AnimatePresence, motion } from 'framer-motion';
import { Swords } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { countryFill } from '../game/world';

export default function PendingDecisionToast() {
  const pending = useGameStore((s) => s.pendingDecision);
  const ack = useGameStore((s) => s.acknowledgePending);
  const aggressorCountry = useGameStore((s) =>
    s.pendingDecision?.kind === 'ai_declared_war'
      ? s.countries[s.pendingDecision.aggressorId] ?? null
      : null,
  );
  const setSelected = useGameStore((s) => s.setSelected);

  if (!pending || pending.kind !== 'ai_declared_war' || !aggressorCountry) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        key={pending.aggressorId + pending.tickCount}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.25 }}
        className="absolute z-40"
        style={{
          left: '50%',
          top: 88,
          transform: 'translateX(-50%)',
          background: 'var(--paper)',
          border: '2px solid var(--accent-blood)',
          boxShadow: '0 8px 24px rgba(122,31,31,0.25)',
          padding: '14px 20px',
          minWidth: 340,
          maxWidth: 460,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 8,
            color: 'var(--accent-blood)',
          }}
        >
          <Swords size={18} />
          <span
            className="display"
            style={{ fontSize: 18, lineHeight: 1.1 }}
          >
            {aggressorCountry.name} has declared war.
          </span>
          <span
            style={{
              marginLeft: 'auto',
              width: 14,
              height: 14,
              background: countryFill(aggressorCountry.id),
              border: '1px solid var(--ink)',
              flexShrink: 0,
            }}
          />
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-faded)',
            fontStyle: 'italic',
            marginBottom: 12,
          }}
        >
          The game is paused. Inspect their lands or rally your defense, then
          press Resume.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              setSelected(aggressorCountry.id);
              ack();
            }}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--ink-faded)',
              color: 'var(--ink)',
              padding: '6px 12px',
              fontFamily: '"Crimson Pro", serif',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Inspect
          </button>
          <button
            type="button"
            onClick={ack}
            style={{
              background: 'var(--accent-blood)',
              border: '1px solid var(--ink)',
              color: 'var(--paper)',
              padding: '6px 14px',
              fontFamily: '"Crimson Pro", serif',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Resume
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
