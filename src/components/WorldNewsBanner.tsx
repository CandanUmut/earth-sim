import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Newspaper, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

const DISMISS_AFTER_MS = 7500;

/**
 * Non-blocking news ticker at the top of the screen. Shows historical
 * events, chapter changes, and distant capital falls without pausing the
 * game. Each item auto-dismisses after a few seconds.
 */
export default function WorldNewsBanner() {
  const news = useGameStore((s) => s.worldNews);
  const dismiss = useGameStore((s) => s.dismissNews);

  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    const live = new Set(news.map((n) => n.id));
    for (const item of news) {
      if (timersRef.current.has(item.id)) continue;
      const id = item.id;
      const t = setTimeout(() => {
        timersRef.current.delete(id);
        dismiss(id);
      }, DISMISS_AFTER_MS);
      timersRef.current.set(id, t);
    }
    for (const [id, t] of timersRef.current.entries()) {
      if (!live.has(id)) {
        clearTimeout(t);
        timersRef.current.delete(id);
      }
    }
  }, [news, dismiss]);

  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    };
  }, []);

  if (news.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 56,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        pointerEvents: 'none',
        alignItems: 'center',
      }}
    >
      <AnimatePresence initial={false}>
        {news.map((item) => {
          let title = '';
          let body = '';
          let accent = 'var(--ink-faded)';
          let dateLine = '';
          if (item.kind === 'historical') {
            title = item.event.title;
            body = item.event.flavor;
            dateLine = `${monthName(item.event.month)} ${item.event.year}`;
            accent = 'var(--accent-gold)';
          } else if (item.kind === 'chapter') {
            title = item.title;
            dateLine = String(item.year);
            accent = 'var(--ink-faded)';
          } else if (item.kind === 'distant_capital_fell') {
            title = `${item.fallenName} has fallen`;
            body = `${item.conquerorName} has taken the capital.`;
            accent = 'var(--accent-blood)';
          }

          return (
            <motion.div
              key={item.id}
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                pointerEvents: 'auto',
                background: 'var(--paper)',
                border: `1px solid ${accent}`,
                borderLeftWidth: 3,
                boxShadow: '0 6px 18px rgba(26,24,20,0.18)',
                padding: '8px 38px 10px 14px',
                minWidth: 320,
                maxWidth: 540,
                position: 'relative',
              }}
            >
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(item.id)}
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
                  {item.kind === 'historical'
                    ? 'Headlines'
                    : item.kind === 'chapter'
                      ? 'Chapter'
                      : 'Dispatch'}
                </span>
                {dateLine && (
                  <span
                    className="num"
                    style={{
                      marginLeft: 'auto',
                      fontSize: 9,
                      color: 'var(--ink-faded)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {dateLine}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 14,
                  lineHeight: 1.25,
                  fontWeight: 600,
                  color: 'var(--ink)',
                }}
              >
                {title}
              </div>
              {body && (
                <div
                  style={{
                    fontSize: 11.5,
                    lineHeight: 1.4,
                    fontStyle: 'italic',
                    color: 'var(--ink)',
                    marginTop: 3,
                  }}
                >
                  {body}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function monthName(m: number): string {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][m] ?? '';
}
