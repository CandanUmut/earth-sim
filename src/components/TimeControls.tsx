import { useEffect, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useGameStore, type Speed } from '../store/gameStore';
import { formatDate } from '../game/tick';
import { isMuted, setMuted } from '../sound/sound';

export default function TimeControls() {
  const paused = useGameStore((s) => s.paused);
  const speed = useGameStore((s) => s.speed);
  const date = useGameStore((s) => s.date);
  const gameStarted = useGameStore((s) => s.gameStarted);
  const togglePaused = useGameStore((s) => s.togglePaused);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const [muted, setMutedLocal] = useState(() => isMuted());

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

      <button
        type="button"
        onClick={() => {
          const next = !muted;
          setMuted(next);
          setMutedLocal(next);
        }}
        aria-label={muted ? 'Unmute' : 'Mute'}
        title={muted ? 'Unmute' : 'Mute'}
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
  );
}
