import { AnimatePresence, motion } from 'framer-motion';
import { Newspaper as NewspaperIcon, X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * The newspaper. A small button that lives in the bottom-left corner of
 * the screen with an unread badge; clicking opens a scrollable panel of
 * every dispatch this campaign has produced — historical events, chapter
 * markers, distant capitals falling. Read at your leisure, ignore as
 * you like.
 */
export default function Newspaper() {
  const open = useGameStore((s) => s.newspaperOpen);
  const archive = useGameStore((s) => s.newsArchive);
  const unread = useGameStore((s) => s.newsUnreadCount);
  const openNewspaper = useGameStore((s) => s.openNewspaper);
  const closeNewspaper = useGameStore((s) => s.closeNewspaper);
  const gameStarted = useGameStore((s) => s.gameStarted);

  if (!gameStarted) return null;

  // Newest first.
  const items = [...archive].reverse();

  return (
    <>
      {/* Fixed button — bottom-left. */}
      <button
        type="button"
        onClick={openNewspaper}
        title="Open newspaper"
        style={{
          position: 'absolute',
          left: 16,
          bottom: 70,
          zIndex: 27,
          background: 'var(--paper)',
          border: '1px solid var(--ink)',
          padding: '6px 12px',
          fontFamily: '"Crimson Pro", serif',
          fontSize: 13,
          color: 'var(--ink)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <NewspaperIcon size={13} /> Newspaper
        {unread > 0 && (
          <span
            className="num"
            style={{
              fontSize: 10,
              background: 'var(--accent-blood)',
              color: 'var(--paper)',
              padding: '1px 6px',
              borderRadius: 8,
              marginLeft: 2,
              fontWeight: 600,
            }}
          >
            {unread}
          </span>
        )}
      </button>

      {/* Panel. */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 45,
              background: 'rgba(26,24,20,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={closeNewspaper}
          >
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--ink)',
                boxShadow: '0 12px 40px rgba(26,24,20,0.45)',
                width: 'min(96vw, 640px)',
                maxHeight: '82vh',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              <div
                style={{
                  padding: '20px 26px 14px',
                  borderBottom: '1px solid var(--ink-faded)',
                }}
              >
                <button
                  type="button"
                  aria-label="Close"
                  onClick={closeNewspaper}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--ink-faded)',
                    cursor: 'pointer',
                    padding: 6,
                  }}
                >
                  <X size={16} />
                </button>
                <div
                  className="display"
                  style={{
                    fontSize: 30,
                    lineHeight: 1.05,
                    letterSpacing: '0.02em',
                  }}
                >
                  The Daily Chronicle
                </div>
                <div
                  style={{
                    fontStyle: 'italic',
                    color: 'var(--ink-faded)',
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  Dispatches from across the world — at your leisure
                </div>
              </div>

              <div
                style={{
                  overflowY: 'auto',
                  padding: '14px 26px 18px',
                }}
              >
                {items.length === 0 && (
                  <div
                    style={{
                      fontStyle: 'italic',
                      color: 'var(--ink-faded)',
                      textAlign: 'center',
                      padding: '40px 0',
                    }}
                  >
                    No dispatches yet. The world is quiet.
                  </div>
                )}
                {items.map((item) => {
                  let title = '';
                  let body = '';
                  let dateLine = '';
                  let label = 'DISPATCH';
                  let accent = 'var(--ink-faded)';
                  if (item.kind === 'historical') {
                    title = item.event.title;
                    body = item.event.flavor;
                    dateLine = `${MONTH_NAMES[item.event.month]} ${item.event.year}`;
                    label = item.event.major ? 'HEADLINE' : 'NOTE';
                    accent = item.event.effect
                      ? 'var(--accent-blood)'
                      : 'var(--accent-gold)';
                  } else if (item.kind === 'chapter') {
                    title = item.title;
                    dateLine = String(item.year);
                    label = 'CHAPTER';
                    accent = 'var(--ink-faded)';
                  } else if (item.kind === 'distant_capital_fell') {
                    title = `${item.fallenName} has fallen`;
                    body = `${item.conquerorName} has taken the capital.`;
                    label = 'WAR';
                    accent = 'var(--accent-blood)';
                  }
                  return (
                    <article
                      key={item.id}
                      style={{
                        borderLeft: `2px solid ${accent}`,
                        padding: '8px 12px',
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'baseline',
                          marginBottom: 2,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 9,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            color: accent,
                            fontWeight: 600,
                          }}
                        >
                          {label}
                        </span>
                        <span
                          className="num"
                          style={{
                            fontSize: 10,
                            color: 'var(--ink-faded)',
                            letterSpacing: '0.06em',
                          }}
                        >
                          {dateLine}
                        </span>
                      </div>
                      <div
                        className="display"
                        style={{
                          fontSize: 16,
                          lineHeight: 1.2,
                          marginBottom: body ? 4 : 0,
                          color: 'var(--ink)',
                        }}
                      >
                        {title}
                      </div>
                      {body && (
                        <div
                          style={{
                            fontSize: 13,
                            lineHeight: 1.45,
                            fontStyle: 'italic',
                            color: 'var(--ink)',
                          }}
                        >
                          {body}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
