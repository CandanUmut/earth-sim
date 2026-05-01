import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { play as playSound } from '../sound/sound';
import { formatDate } from '../game/tick';

/**
 * Player-affecting events only. Pauses the game until acknowledged.
 *  • War declared on you
 *  • Your capital fell
 *  • Rebellion on your land
 *
 * Anything else (historical news, chapter changes, distant capitals)
 * lives in WorldNewsBanner — non-blocking, auto-dismissing.
 */
export default function CinematicCard() {
  const queue = useGameStore((s) => s.cinematicQueue);
  const dismiss = useGameStore((s) => s.dismissCinematic);
  const countries = useGameStore((s) => s.countries);
  const leaders = useGameStore((s) => s.leaders);
  const date = useGameStore((s) => s.date);
  const card = queue[0] ?? null;

  useEffect(() => {
    if (!card) return;
    if (card.kind === 'war_declared') playSound('cannon');
    else if (card.kind === 'capital_fell') playSound('defeat');
    else if (card.kind === 'rebellion_on_player_tile') playSound('event_warning');
  }, [card]);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, dismiss]);

  if (!card) return null;

  let title = '';
  let body = '';
  let accent = 'var(--accent-blood)';

  if (card.kind === 'war_declared') {
    const aggressor = countries[card.aggressorId];
    const aggLeader = leaders[card.aggressorId];
    title = `${aggressor?.name ?? card.aggressorId} declares war`;
    body = aggLeader
      ? `${aggLeader.title} ${aggLeader.name} has issued a declaration of war upon you. The chancelleries are silent. Mobilisation begins.`
      : `Couriers carry the declaration to your capital at first light. Your generals await your orders.`;
  } else if (card.kind === 'capital_fell') {
    const fallen = countries[card.fallenId];
    const conqueror = countries[card.conquerorId];
    title = `${fallen?.name ?? card.fallenId} has fallen`;
    body = `Your capital is in the hands of ${conqueror?.name ?? 'the conqueror'}. The campaign is lost.`;
  } else if (card.kind === 'rebellion_on_player_tile') {
    const tile = countries[card.tileId];
    title = `Rebellion at ${tile?.name ?? 'home'}`;
    body = `Peasants take the streets. The provincial garrison is overwhelmed. March troops or the tile will slip from your hands.`;
    accent = 'var(--accent-gold)';
  }

  return (
    <AnimatePresence>
      {card && (
        <motion.div
          key={`${card.kind}-${card.shownAt}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(26,24,20,0.55) 30%, rgba(26,24,20,0.85) 100%)',
          }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ y: -12, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper)',
              border: `2px solid ${accent}`,
              boxShadow:
                '0 12px 40px rgba(26,24,20,0.55), inset 0 0 60px rgba(184,134,11,0.06)',
              padding: '32px 50px 28px',
              maxWidth: 620,
              width: 'min(92vw, 620px)',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            <div
              className="num"
              style={{
                position: 'absolute',
                top: 14,
                left: 22,
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--ink-faded)',
              }}
            >
              {formatDate(date)}
            </div>

            <div
              style={{
                fontSize: 16,
                color: accent,
                lineHeight: 1,
                marginBottom: 12,
                letterSpacing: '0.4em',
              }}
            >
              ✦ · ✦
            </div>

            <div
              className="display"
              style={{
                fontSize: 28,
                lineHeight: 1.05,
                marginBottom: 14,
                color: 'var(--ink)',
              }}
            >
              {title}
            </div>

            <div
              style={{
                fontSize: 15,
                lineHeight: 1.55,
                color: 'var(--ink)',
                fontStyle: 'italic',
                marginBottom: 22,
              }}
            >
              {body}
            </div>

            <button
              type="button"
              onClick={dismiss}
              style={{
                background: 'transparent',
                color: 'var(--ink)',
                border: '1px solid var(--ink)',
                padding: '8px 28px',
                fontFamily: '"Crimson Pro", serif',
                fontSize: 14,
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              Continue
            </button>

            <div
              style={{
                marginTop: 12,
                fontSize: 10,
                letterSpacing: '0.12em',
                color: 'var(--ink-faded)',
                textTransform: 'uppercase',
              }}
            >
              Press Enter to continue
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
