import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  GraduationCap,
  Sliders,
} from 'lucide-react';
import { useGameStore, type Speed } from '../store/gameStore';
import { formatDate } from '../game/tick';
import {
  isMuted,
  setMuted,
  getMasterVolume,
  getSfxVolume,
  getMusicVolume,
  setMasterVolume,
  setSfxVolume,
  setMusicVolume,
} from '../sound/sound';

const TUTORIAL_KEY = 'terra-bellum-tutorial-seen-v2';

export default function TimeControls() {
  const paused = useGameStore((s) => s.paused);
  const speed = useGameStore((s) => s.speed);
  const date = useGameStore((s) => s.date);
  const gameStarted = useGameStore((s) => s.gameStarted);
  const togglePaused = useGameStore((s) => s.togglePaused);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const [muted, setMutedLocal] = useState(() => isMuted());
  const [showVol, setShowVol] = useState(false);
  const [vols, setVols] = useState(() => ({
    master: getMasterVolume(),
    sfx: getSfxVolume(),
    music: getMusicVolume(),
  }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        if (useGameStore.getState().gameStarted) {
          useGameStore.getState().togglePaused();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!gameStarted) return null;

  return (
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30"
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--ink)',
        boxShadow: '0 2px 10px var(--paper-shadow)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 14px',
      }}
    >
      <button
        type="button"
        onClick={togglePaused}
        aria-label={paused ? 'Play' : 'Pause'}
        title={paused ? 'Play (Space)' : 'Pause (Space)'}
        style={{
          width: 32,
          height: 32,
          display: 'grid',
          placeItems: 'center',
          background: paused ? 'var(--ink)' : 'transparent',
          color: paused ? 'var(--paper)' : 'var(--ink)',
          border: '1px solid var(--ink)',
          cursor: 'pointer',
        }}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>

      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s as Speed)}
            className="num"
            style={{
              width: 30,
              height: 28,
              fontSize: 12,
              background: speed === s ? 'var(--ink)' : 'transparent',
              color: speed === s ? 'var(--paper)' : 'var(--ink)',
              border: '1px solid var(--ink)',
              cursor: 'pointer',
            }}
          >
            {s}×
          </button>
        ))}
      </div>

      <div
        style={{
          width: 1,
          height: 22,
          background: 'var(--ink-faded)',
          opacity: 0.5,
        }}
      />

      <div
        className="display"
        style={{
          fontSize: 18,
          fontStyle: 'italic',
          minWidth: 130,
          textAlign: 'center',
        }}
      >
        {formatDate(date)}
      </div>

      <div
        style={{
          width: 1,
          height: 22,
          background: 'var(--ink-faded)',
          opacity: 0.5,
        }}
      />

      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            setMutedLocal(next);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowVol((v) => !v);
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={muted ? 'Unmute (right-click for volume)' : 'Mute (right-click for volume)'}
          style={{
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            background: 'transparent',
            color: 'var(--ink)',
            border: '1px solid var(--ink)',
            cursor: 'pointer',
          }}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setShowVol((v) => !v)}
        aria-label="Sound mixer"
        title="Sound mixer"
        style={{
          width: 32,
          height: 32,
          display: 'grid',
          placeItems: 'center',
          background: showVol ? 'var(--ink)' : 'transparent',
          color: showVol ? 'var(--paper)' : 'var(--ink)',
          border: '1px solid var(--ink)',
          cursor: 'pointer',
        }}
      >
        <Sliders size={14} />
      </button>
      <AnimatePresence>
        {showVol && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute',
              bottom: 56,
              right: 4,
              background: 'var(--paper)',
              border: '1px solid var(--ink)',
              boxShadow: '0 6px 18px rgba(26,24,20,0.18)',
              padding: '12px 14px',
              minWidth: 220,
              zIndex: 35,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--ink-faded)',
                marginBottom: 8,
              }}
            >
              Mixer
            </div>
            {(
              [
                { key: 'master', label: 'Master' },
                { key: 'sfx', label: 'SFX' },
                { key: 'music', label: 'Music' },
              ] as const
            ).map((row) => (
              <div key={row.key} style={{ marginBottom: 6 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--ink)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{row.label}</span>
                  <span className="num" style={{ color: 'var(--ink-faded)' }}>
                    {Math.round(vols[row.key] * 100)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={vols[row.key]}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setVols((p) => ({ ...p, [row.key]: v }));
                    if (row.key === 'master') setMasterVolume(v);
                    else if (row.key === 'sfx') setSfxVolume(v);
                    else setMusicVolume(v);
                  }}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
            <div
              style={{
                fontSize: 10,
                color: 'var(--ink-faded)',
                fontStyle: 'italic',
                marginTop: 4,
              }}
            >
              Drop music files in <span className="num">public/sounds/</span> —
              see the README there for filenames.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => {
          try {
            localStorage.removeItem(TUTORIAL_KEY);
          } catch {
            // ignore
          }
          // Force a re-render; Tutorial reads its open state from gameStarted
          // and the localStorage flag, so we toggle pause to refresh.
          window.location.reload();
        }}
        aria-label="Replay tutorial"
        title="Replay tutorial"
        style={{
          width: 32,
          height: 32,
          display: 'grid',
          placeItems: 'center',
          background: 'transparent',
          color: 'var(--ink)',
          border: '1px solid var(--ink)',
          cursor: 'pointer',
        }}
      >
        <GraduationCap size={14} />
      </button>
    </div>
  );
}
