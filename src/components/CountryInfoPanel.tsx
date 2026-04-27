import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { Terrain } from '../game/world';

const terrainLabels: Record<Terrain, string> = {
  plains: 'Plains',
  mountain: 'Mountain',
  island: 'Island',
  desert: 'Desert',
  forest: 'Forest',
};

function formatPop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
  return n.toLocaleString();
}

export default function CountryInfoPanel() {
  const selectedId = useGameStore((s) => s.selectedCountryId);
  const country = useGameStore((s) =>
    s.selectedCountryId ? s.countries[s.selectedCountryId] : null,
  );
  const setSelected = useGameStore((s) => s.setSelected);

  return (
    <AnimatePresence>
      {selectedId && country && (
        <motion.aside
          key={selectedId}
          initial={{ x: 360, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 360, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          className="absolute right-4 top-20 w-[320px] z-30"
          style={{
            background: 'var(--paper)',
            color: 'var(--ink)',
            border: '1px solid var(--ink)',
            boxShadow: '0 4px 14px var(--paper-shadow), 0 1px 2px var(--paper-shadow)',
            padding: '20px 22px 22px',
          }}
        >
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => setSelected(null)}
            className="absolute right-2 top-2 p-1.5 hover:opacity-60"
            style={{ color: 'var(--ink-faded)' }}
          >
            <X size={16} />
          </button>

          <div
            className="display"
            style={{
              fontSize: 28,
              lineHeight: 1.05,
              borderBottom: '1px solid var(--ink-faded)',
              paddingBottom: 8,
              marginBottom: 14,
              paddingRight: 28,
            }}
          >
            {country.name}
          </div>

          <Stat label="Population" value={formatPop(country.population)} />
          <Stat label="Terrain" value={terrainLabels[country.terrain]} italic />
          <Stat label="Borders" value={`${country.neighbors.length}`} />
          <Stat
            label="Latitude"
            value={`${country.centroid[1].toFixed(2)}°`}
            mono
          />
          <Stat
            label="Longitude"
            value={`${country.centroid[0].toFixed(2)}°`}
            mono
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Stat({
  label,
  value,
  mono,
  italic,
}: {
  label: string;
  value: string;
  mono?: boolean;
  italic?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span
        style={{
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-faded)',
        }}
      >
        {label}
      </span>
      <span
        className={mono ? 'num' : ''}
        style={{
          fontSize: mono ? 13 : 16,
          fontStyle: italic ? 'italic' : 'normal',
        }}
      >
        {value}
      </span>
    </div>
  );
}
