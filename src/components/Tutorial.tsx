import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { hasSeenTutorial, markTutorialSeen } from '../store/persistence';

const STEPS = [
  {
    title: 'Pause and pace',
    body:
      'Press Space to pause. Use the 1× / 2× / 3× buttons at the bottom to set the simulation speed. The world keeps turning whether or not you act.',
    anchor: { bottom: 70, left: '50%', translateX: '-50%' as const },
  },
  {
    title: 'Inspect any nation',
    body:
      'Click a country on the map to see its troops, terrain, and stance toward you. Country labels and troop counts are visible at all times.',
    anchor: { top: 90, right: 350 },
  },
  {
    title: 'Mobilize and negotiate',
    body:
      'In a country\'s panel, Send Troops launches an attack along the shortest land route. Or Declare War, Propose Alliance, or Send a Gift to shift the diplomatic field.',
    anchor: { top: 90, right: 16 },
  },
  {
    title: 'Wear them down',
    body:
      'Conquering a country takes more than one battle: each won fight chips away its control bar. When control hits zero, the territory flips to your color.',
    anchor: { bottom: 70, left: 16 },
  },
];

export default function Tutorial() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (gameStarted && !hasSeenTutorial()) {
      setOpen(true);
    }
  }, [gameStarted]);

  const dismiss = () => {
    setOpen(false);
    markTutorialSeen();
  };

  if (!gameStarted) return null;

  const cur = STEPS[step];
  const total = STEPS.length;

  const placement = cur?.anchor ?? {};
  const style: React.CSSProperties = {
    position: 'absolute',
    background: 'var(--paper)',
    border: '1px solid var(--ink)',
    boxShadow: '0 8px 24px rgba(26,24,20,0.18)',
    padding: '14px 18px 16px',
    width: 320,
    zIndex: 45,
    transform:
      'translateX' in placement
        ? `translateX(${(placement as { translateX?: string }).translateX ?? '0'})`
        : undefined,
  };

  if ('top' in placement) style.top = (placement as { top?: number | string }).top;
  if ('bottom' in placement) style.bottom = (placement as { bottom?: number | string }).bottom;
  if ('left' in placement) style.left = (placement as { left?: number | string }).left;
  if ('right' in placement) style.right = (placement as { right?: number | string }).right;

  return (
    <AnimatePresence>
      {open && cur && (
        <motion.div
          key={`tut-${step}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.22 }}
          style={style}
        >
          <button
            type="button"
            aria-label="Dismiss tutorial"
            onClick={dismiss}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-faded)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={14} />
          </button>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--ink-faded)',
              marginBottom: 6,
            }}
          >
            {step + 1} / {total} · {cur.title}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.45, marginBottom: 14 }}>
            {cur.body}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--ink-faded)',
                  color: 'var(--ink)',
                  padding: '6px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            )}
            {step < total - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
                style={{
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  border: '1px solid var(--ink)',
                  padding: '6px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 13,
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={dismiss}
                style={{
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  border: '1px solid var(--ink)',
                  padding: '6px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 13,
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                Begin
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
