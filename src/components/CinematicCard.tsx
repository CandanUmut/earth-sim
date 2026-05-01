import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { play as playSound } from '../sound/sound';
import { formatDate } from '../game/tick';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function ordinalDay(month: number, year: number): string {
  // We don't track day-of-month, so just give the month + year.
  return `${MONTH_NAMES[month]} ${year}`;
}

export default function CinematicCard() {
  const queue = useGameStore((s) => s.cinematicQueue);
  const dismiss = useGameStore((s) => s.dismissCinematic);
  const countries = useGameStore((s) => s.countries);
  const leaders = useGameStore((s) => s.leaders);
  const date = useGameStore((s) => s.date);
  const card = queue[0] ?? null;

  // Audio sting on each new card.
  useEffect(() => {
    if (!card) return;
    if (card.kind === 'historical' || card.kind === 'capital_fell') {
      playSound('event_warning');
    } else if (card.kind === 'war_declared') {
      playSound('cannon');
    } else if (card.kind === 'chapter') {
      playSound('alliance');
    }
  }, [card]);

  // Allow Enter / Esc / Space to dismiss.
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
  let dateLine = '';
  let body = '';
  let accent = 'var(--ink)';

  if (card.kind === 'historical') {
    title = card.event.title;
    dateLine = ordinalDay(card.event.month, card.event.year);
    body = card.event.flavor;
    accent = 'var(--accent-gold)';
  } else if (card.kind === 'war_declared') {
    const aggressor = countries[card.aggressorId];
    const aggLeader = leaders[card.aggressorId];
    title = `${aggressor?.name ?? card.aggressorId} declares war`;
    dateLine = formatDate(date);
    body = aggLeader
      ? `${aggLeader.title} ${aggLeader.name} of ${aggressor?.name ?? 'the aggressor'} has issued a declaration of war. The chancelleries are silent. Mobilisation begins.`
      : `Couriers carry the declaration to your capital at first light. Your generals await your orders.`;
    accent = 'var(--accent-blood)';
  } else if (card.kind === 'capital_fell') {
    const fallen = countries[card.fallenId];
    const conqueror = countries[card.conquerorId];
    title = `${fallen?.name ?? card.fallenId} has fallen`;
    dateLine = formatDate(date);
    body = `The capital of ${fallen?.name ?? 'the fallen state'} is in the hands of ${conqueror?.name ?? 'the conqueror'}. Bells toll across foreign cities. The map is redrawn.`;
    accent = 'var(--accent-blood)';
  } else if (card.kind === 'chapter') {
    title = card.title;
    dateLine = String(card.year);
    body = '';
    accent = 'var(--ink-faded)';
  }

  return (
    <AnimatePresence>
      {card && (
        <motion.div
          key={`${card.kind}-${card.shownAt}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(26,24,20,0.55) 30%, rgba(26,24,20,0.85) 100%)',
          }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ y: -16, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper)',
              border: `2px solid ${accent}`,
              boxShadow:
                '0 12px 40px rgba(26,24,20,0.55), inset 0 0 60px rgba(184,134,11,0.06)',
              padding: '36px 56px 32px',
              maxWidth: 680,
              width: 'min(92vw, 680px)',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            {/* Date pill at top corner */}
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
              {dateLine}
            </div>

            {/* Decorative top flourish */}
            <div
              style={{
                fontSize: 18,
                color: accent,
                lineHeight: 1,
                marginBottom: 14,
                letterSpacing: '0.4em',
              }}
            >
              ✦ · ✦
            </div>

            <div
              className="display"
              style={{
                fontSize: card.kind === 'chapter' ? 44 : 32,
                lineHeight: 1.05,
                marginBottom: body ? 18 : 8,
                color: 'var(--ink)',
              }}
            >
              {title}
            </div>

            {body && (
              <div
                style={{
                  fontSize: 16,
                  lineHeight: 1.55,
                  color: 'var(--ink)',
                  fontStyle: 'italic',
                  marginBottom: 26,
                  fontFamily: '"Crimson Pro", Georgia, serif',
                }}
              >
                {body}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: body ? 0 : 18,
              }}
            >
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
            </div>

            <div
              style={{
                marginTop: 14,
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
