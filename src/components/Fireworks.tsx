import { useEffect, useState } from 'react';

type Burst = {
  id: number;
  x: number;
  y: number;
  color: string;
  rays: number;
  startedAt: number;
};

const COLORS = [
  'var(--accent-gold)',
  'var(--accent-blood)',
  'var(--accent-sage)',
  '#c97a1f',
  '#9a7bb0',
];

const BURST_DURATION = 1200; // ms

export default function Fireworks() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    let id = 0;
    const spawn = () => {
      const b: Burst = {
        id: id++,
        x: 8 + Math.random() * 84, // 8–92 % of viewport width
        y: 10 + Math.random() * 50,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rays: 8 + Math.floor(Math.random() * 6),
        startedAt: performance.now(),
      };
      setBursts((prev) => [...prev, b].slice(-12));
    };
    const intervalId = setInterval(spawn, 380);
    spawn();
    const pruneId = setInterval(() => {
      const now = performance.now();
      setBursts((prev) =>
        prev.filter((b) => now - b.startedAt < BURST_DURATION),
      );
    }, 150);
    return () => {
      clearInterval(intervalId);
      clearInterval(pruneId);
    };
  }, []);

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 51,
      }}
    >
      {bursts.map((b) => {
        const cx = `${b.x}%`;
        const cy = `${b.y}%`;
        const rays: React.ReactNode[] = [];
        for (let i = 0; i < b.rays; i++) {
          const angle = (i / b.rays) * Math.PI * 2;
          const dx = Math.cos(angle);
          const dy = Math.sin(angle);
          rays.push(
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={`calc(${b.x}% + ${dx * 28}px)`}
              y2={`calc(${b.y}% + ${dy * 28}px)`}
              stroke={b.color}
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.9}
              style={{
                animation: `fireworkRay 1.2s ease-out forwards`,
              }}
            />,
          );
        }
        return (
          <g key={b.id}>
            <circle
              cx={cx}
              cy={cy}
              r={2}
              fill={b.color}
              style={{
                animation: 'fireworkBurst 1.2s ease-out forwards',
              }}
            />
            {rays}
          </g>
        );
      })}
      <style>{`
        @keyframes fireworkRay {
          0% { transform: scale(0.2); opacity: 1; }
          70% { opacity: 0.9; }
          100% { transform: scale(1.2); opacity: 0; }
        }
      `}</style>
    </svg>
  );
}
