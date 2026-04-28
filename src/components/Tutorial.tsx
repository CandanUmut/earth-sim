import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronRight, Check } from 'lucide-react';
import { useGameStore, type GameState } from '../store/gameStore';
import { hasSeenTutorial, markTutorialSeen } from '../store/persistence';

/**
 * Each step describes:
 *  - what to say
 *  - where the panel anchors on screen
 *  - whether to zoom the map to a particular country
 *  - a `gate` function: returns true once the player has done the action
 *    (or `null` if the step is informational and advances on click).
 */
type StepAnchor =
  | { type: 'center' }
  | { type: 'left'; top?: number }
  | { type: 'right'; top?: number }
  | { type: 'bottom-center' }
  | { type: 'top-center' };

type Step = {
  title: string;
  body: string;
  anchor: StepAnchor;
  cameraScale?: number;
  /** If null, advance is manual. Else, advance when this returns true. */
  gate: ((s: GameState, snap: GateSnapshot) => boolean) | null;
  hint?: string;
};

type GateSnapshot = {
  startInfantry: number;
  startCavalry: number;
  startArtillery: number;
  startGold: number;
  startSelectedNonPlayer: string | null;
};

const STEPS: Step[] = [
  {
    title: 'Welcome, Cartographer',
    body:
      'Your campaign begins. The world keeps turning whether you act or not. Take a moment — let me show you the controls before the simulation continues.',
    anchor: { type: 'center' },
    gate: null,
  },
  {
    title: 'This is your nation',
    body:
      'I have zoomed the map to your home country. Click it on the map to inspect your own realm.',
    anchor: { type: 'left', top: 360 },
    cameraScale: 4.5,
    gate: (s) => s.selectedCountryId === s.playerCountryId,
    hint: 'Click your golden territory.',
  },
  {
    title: 'Build your army',
    body:
      'Recruit at least 25 infantry from the HUD on the left. Use the +25 button. Each barracks upgrade unlocks larger batches and reduces the per-unit cost.',
    anchor: { type: 'left', top: 360 },
    gate: (s, snap) => {
      const id = s.playerCountryId;
      if (!id) return false;
      const n = s.nations[id];
      if (!n) return false;
      return (
        n.infantry + n.cavalry + n.artillery >=
        snap.startInfantry + snap.startCavalry + snap.startArtillery + 25
      );
    },
    hint: 'Press the +25 button under Infantry on the HUD.',
  },
  {
    title: 'Pick a target',
    body:
      'Click any country other than your own to inspect it. Look for a weaker neighbor to start with.',
    anchor: { type: 'right', top: 90 },
    gate: (s) =>
      s.selectedCountryId !== null &&
      s.selectedCountryId !== s.playerCountryId,
    hint: 'Click any non-golden country on the map.',
  },
  {
    title: 'Mobilize the realm',
    body:
      'Open the Send Troops dialog from the country panel on the right. You will see travel time, terrain bonuses, and a battle preview before committing.',
    anchor: { type: 'right', top: 240 },
    gate: (s) => s.dispatchTargetId !== null,
    hint: 'Press "Send Troops" in the country panel.',
  },
  {
    title: 'Conquering takes time',
    body:
      'Conquering a tile takes more than one battle — each victory chips away its control bar. When control hits zero, the territory flips to your color. Empires now display ONE label per contiguous region.',
    anchor: { type: 'center' },
    gate: null,
  },
  {
    title: 'Statecraft & Tech',
    body:
      'Diplomacy and the Tech Tree are how clever players win. Try the Tech button on the HUD and read a few unlocks. Win = control 60% of world population.',
    anchor: { type: 'left', top: 460 },
    gate: (s) => s.techPanelOpen,
    hint: 'Click the gold "Tech" button on the HUD.',
  },
  {
    title: 'You are ready',
    body:
      'I will resume the simulation. Spacebar pauses any time. Good luck — the world will not wait.',
    anchor: { type: 'center' },
    gate: null,
  },
];

function anchorStyle(a: StepAnchor): React.CSSProperties {
  switch (a.type) {
    case 'center':
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    case 'left':
      return {
        top: a.top ?? 360,
        left: 350,
      };
    case 'right':
      return {
        top: a.top ?? 90,
        right: 350,
      };
    case 'bottom-center':
      return {
        bottom: 70,
        left: '50%',
        transform: 'translateX(-50%)',
      };
    case 'top-center':
      return {
        top: 90,
        left: '50%',
        transform: 'translateX(-50%)',
      };
  }
}

export default function Tutorial() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  const playerId = useGameStore((s) => s.playerCountryId);
  const setPaused = useGameStore((s) => s.setPaused);
  const setCameraTarget = useGameStore((s) => s.setCameraTarget);

  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const snapRef = useRef<GateSnapshot | null>(null);
  const wasPausedRef = useRef<boolean>(false);

  // Open on game start if not seen, snapshot starting numbers.
  useEffect(() => {
    if (!gameStarted) return;
    if (hasSeenTutorial()) return;
    setOpen(true);
    setStep(0);
    const s = useGameStore.getState();
    wasPausedRef.current = s.paused;
    setPaused(true);
    if (playerId) {
      const n = s.nations[playerId];
      snapRef.current = {
        startInfantry: n?.infantry ?? 0,
        startCavalry: n?.cavalry ?? 0,
        startArtillery: n?.artillery ?? 0,
        startGold: n?.gold ?? 0,
        startSelectedNonPlayer: null,
      };
    }
  }, [gameStarted, playerId, setPaused]);

  // Camera + snapshot refresh on step change. Re-snapshot for "build army"
  // and "click neighbor" so the gate measures from THIS step's start.
  useEffect(() => {
    if (!open) return;
    const s = useGameStore.getState();
    if (playerId) {
      const n = s.nations[playerId];
      snapRef.current = {
        startInfantry: n?.infantry ?? 0,
        startCavalry: n?.cavalry ?? 0,
        startArtillery: n?.artillery ?? 0,
        startGold: n?.gold ?? 0,
        startSelectedNonPlayer: null,
      };
    }
    const cur = STEPS[step];
    if (!cur) return;
    if (cur.cameraScale && playerId) {
      setCameraTarget({
        kind: 'country',
        countryId: playerId,
        scale: cur.cameraScale,
      });
    } else if (step === 0) {
      setCameraTarget({ kind: 'reset' });
    }
  }, [step, open, playerId, setCameraTarget]);

  // Watch the store and auto-advance once the gate succeeds.
  useEffect(() => {
    if (!open) return;
    const cur = STEPS[step];
    if (!cur || !cur.gate) return;
    let advanced = false;
    const tryAdvance = (state: GameState) => {
      if (advanced) return;
      const snap = snapRef.current;
      if (!snap) return;
      if (cur.gate && cur.gate(state, snap)) {
        advanced = true;
        setStep((s) => Math.min(STEPS.length - 1, s + 1));
      }
    };
    // Immediate check (handles the case where the action already happened).
    tryAdvance(useGameStore.getState());
    const unsub = useGameStore.subscribe(tryAdvance);
    return () => {
      unsub();
    };
  }, [step, open]);

  const dismiss = () => {
    setOpen(false);
    markTutorialSeen();
    setCameraTarget({ kind: 'reset' });
    setPaused(wasPausedRef.current);
  };

  if (!gameStarted || !open) return null;
  const cur = STEPS[step];
  if (!cur) return null;

  const isLast = step === STEPS.length - 1;
  const canManuallyAdvance = cur.gate === null;

  return (
    <>
      {/* Soft dim overlay (does not block clicks — tutorial expects map use). */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(26,24,20,0.18)',
          pointerEvents: 'none',
          zIndex: 44,
        }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={`tut-${step}`}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          style={{
            position: 'absolute',
            background: 'var(--paper)',
            border: '1px solid var(--ink)',
            boxShadow: '0 12px 30px rgba(26,24,20,0.32)',
            padding: '16px 20px 18px',
            width: 360,
            zIndex: 46,
            ...anchorStyle(cur.anchor),
          }}
        >
          <button
            type="button"
            aria-label="Dismiss tutorial"
            onClick={dismiss}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
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
              marginBottom: 4,
            }}
          >
            {step + 1} / {STEPS.length} · Campaign Briefing
          </div>
          <div
            className="display"
            style={{
              fontSize: 22,
              lineHeight: 1.1,
              marginBottom: 8,
              paddingRight: 18,
            }}
          >
            {cur.title}
          </div>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.45,
              marginBottom: 14,
              color: 'var(--ink)',
            }}
          >
            {cur.body}
          </div>
          {!canManuallyAdvance && cur.hint && (
            <div
              style={{
                fontSize: 12,
                fontStyle: 'italic',
                color: 'var(--accent-gold)',
                marginBottom: 12,
                paddingLeft: 8,
                borderLeft: '2px solid var(--accent-gold)',
              }}
            >
              {cur.hint}
            </div>
          )}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <button
              type="button"
              onClick={dismiss}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-faded)',
                fontSize: 11,
                cursor: 'pointer',
                fontStyle: 'italic',
              }}
            >
              Skip tutorial
            </button>
            <div style={{ flex: 1 }} />
            {!canManuallyAdvance ? (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--ink-faded)',
                  fontStyle: 'italic',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Check size={12} /> Waiting for action…
              </span>
            ) : isLast ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={dismiss}
                style={{
                  background: 'var(--accent-gold)',
                  color: 'var(--paper)',
                  border: '1px solid var(--accent-gold)',
                  padding: '6px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Begin Campaign
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                style={{
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  border: '1px solid var(--ink)',
                  padding: '6px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Next <ChevronRight size={14} />
              </motion.button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
