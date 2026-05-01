import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Newspaper, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

const SHOW_FOR_MS = 6000;

/**
 * Single-item, top-right corner flash for the very biggest news (major
 * historical events only). Auto-dismisses. Doesn't pause the game and
 * doesn't stack — only the most recent major event is shown at any time.
 *
 * Everything else lives in the Newspaper panel.
 */
export default function BreakingNews() {
  const item = useGameStore((s) => s.breakingNews);
  const dismiss = useGameStore((s) => s.dismissBreakingNews);
  const openNewspaper = useGameStore((s) => s.openNewspaper);

  useEffect(() => {
    if (!item) return;
    const t = setTimeout(dismiss, SHOW_FOR_MS);
    return () => clearTimeout(t);
  }, [item, dismiss]);

  if (!item || item.kind !== 'historical') return null;

  const accent = item.event.effect ? 'var(--accent-blood)' : 'var(--accent-gold)';

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          key={item.id}
          initial={{ x: 32, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 32, opacity: 0 }}
          transition={{ duration: 0.32 }}
          style={{
            position: 'absolute',
            top: 64,
            right: 16,
            zIndex: 24,
            background: 'var(--paper)',
            border: `1px solid ${accent}`,
            borderLeftWidth: 3,
            boxShadow: '0 6px 18px rgba(26,24,20,0.18)',
            padding: '8px 28px 10px 12px',
            maxWidth: 300,
            cursor: 'pointer',
          }}
          onClick={() => {
            openNewspaper();
            dismiss();
          }}
        >
          <button
            type="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              dismiss();
            }}
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
            <X size={11} />
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 2,
            }}
          >
            <Newspaper size={11} style={{ color: accent }} />
            <span
              style={{
                fontSize: 9,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: accent,
              }}
            >
              Headlines · {monthName(item.event.month)} {item.event.year}
            </span>
          </div>
          <div
            style={{
              fontFamily: '"Crimson Pro", serif',
              fontSize: 13,
              lineHeight: 1.25,
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            {item.event.title}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function monthName(m: number): string {
  return [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ][m] ?? '';
}
