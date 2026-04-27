import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { Terrain } from '../game/world';
import type { Stance } from '../game/economy';

const terrainLabels: Record<Terrain, string> = {
  plains: 'Plains',
  mountain: 'Mountain',
  island: 'Island',
  desert: 'Desert',
  forest: 'Forest',
};

const stanceLabels: Record<Stance, string> = {
  war: 'At war',
  neutral: 'Neutral',
  allied: 'Allied',
};

const stanceColor: Record<Stance, string> = {
  war: 'var(--accent-blood)',
  neutral: 'var(--ink-faded)',
  allied: 'var(--accent-sage)',
};

function formatPop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
  return n.toLocaleString();
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

export default function CountryInfoPanel() {
  const selectedId = useGameStore((s) => s.selectedCountryId);
  const country = useGameStore((s) =>
    s.selectedCountryId ? s.countries[s.selectedCountryId] : null,
  );
  const ownerId = useGameStore((s) =>
    s.selectedCountryId ? s.ownership[s.selectedCountryId] : null,
  );
  const ownerCountry = useGameStore((s) =>
    ownerIdSelector(s, s.selectedCountryId),
  );
  const nation = useGameStore((s) =>
    s.selectedCountryId ? s.nations[s.selectedCountryId] : null,
  );
  const playerId = useGameStore((s) => s.playerCountryId);
  const playerNation = useGameStore((s) =>
    s.playerCountryId ? s.nations[s.playerCountryId] : null,
  );
  const setSelected = useGameStore((s) => s.setSelected);

  const isPlayer = selectedId !== null && selectedId === playerId;

  // Stance the SELECTED country has toward the PLAYER (from their POV).
  let stanceToPlayer: Stance = 'neutral';
  if (nation && playerId && selectedId !== playerId) {
    stanceToPlayer = nation.stance[playerId] ?? 'neutral';
  }

  // Reveal sensitive info if player owns the selected country, or is allied
  // with its owner, or is at war (limited intel — for Phase 2 just always
  // show troops; gold gated by alliance/ownership).
  const isAllied =
    playerNation && ownerId && playerNation.stance[ownerId] === 'allied';
  const showGold = isPlayer || isAllied;

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

          {playerId && !isPlayer && (
            <div
              style={{
                marginBottom: 12,
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: stanceColor[stanceToPlayer],
                fontStyle: 'italic',
              }}
            >
              {stanceLabels[stanceToPlayer]}
              {isPlayer ? ' (You)' : ''}
            </div>
          )}

          {isPlayer && (
            <div
              style={{
                marginBottom: 12,
                fontSize: 12,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--accent-gold)',
                fontStyle: 'italic',
              }}
            >
              Your Realm
            </div>
          )}

          <Stat
            label="Owner"
            value={
              ownerCountry && ownerCountry.id !== country.id
                ? ownerCountry.name
                : 'Self-governed'
            }
          />
          <Stat label="Population" value={formatPop(country.population)} />
          <Stat label="Terrain" value={terrainLabels[country.terrain]} italic />
          <Stat label="Borders" value={`${country.neighbors.length}`} />
          {nation && (
            <>
              <Stat label="Troops" value={fmtNum(nation.troops)} mono />
              {showGold ? (
                <Stat label="Gold" value={fmtNum(nation.gold)} mono />
              ) : (
                <Stat label="Gold" value="—" italic />
              )}
              <Stat label="Tech" value={nation.tech.toFixed(2)} mono />
            </>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function ownerIdSelector(
  state: ReturnType<typeof useGameStore.getState>,
  selectedId: string | null,
) {
  if (!selectedId) return null;
  const ownerId = state.ownership[selectedId];
  if (!ownerId) return null;
  return state.countries[ownerId] ?? null;
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
