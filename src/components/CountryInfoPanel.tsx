import { AnimatePresence, motion } from 'framer-motion';
import { X, Swords, Handshake, ScrollText, Coins, Send } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { Country, Terrain } from '../game/world';
import type { Nation, Stance } from '../game/economy';

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

const GIFT_AMOUNT = 10;

export default function CountryInfoPanel() {
  const selectedId = useGameStore((s) => s.selectedCountryId);
  const country = useGameStore((s) =>
    s.selectedCountryId ? s.countries[s.selectedCountryId] : null,
  );
  const ownerId = useGameStore((s) =>
    s.selectedCountryId ? s.ownership[s.selectedCountryId] : null,
  );
  const ownerCountry = useGameStore((s) =>
    s.selectedCountryId
      ? s.countries[s.ownership[s.selectedCountryId] ?? '']
      : null,
  );
  const nation = useGameStore((s) =>
    s.selectedCountryId ? s.nations[s.selectedCountryId] : null,
  );
  const ownerNation = useGameStore((s) => {
    if (!s.selectedCountryId) return null;
    const oId = s.ownership[s.selectedCountryId];
    return oId ? (s.nations[oId] ?? null) : null;
  });
  const playerId = useGameStore((s) => s.playerCountryId);
  const playerNation = useGameStore((s) =>
    s.playerCountryId ? s.nations[s.playerCountryId] : null,
  );
  const gameStarted = useGameStore((s) => s.gameStarted);
  const setSelected = useGameStore((s) => s.setSelected);
  const declareWar = useGameStore((s) => s.declareWar);
  const proposePeace = useGameStore((s) => s.proposePeace);
  const proposeAlliance = useGameStore((s) => s.proposeAlliance);
  const sendGift = useGameStore((s) => s.sendGift);
  const openDispatch = useGameStore((s) => s.openDispatch);

  const isPlayer = selectedId !== null && selectedId === playerId;

  // Stance the OWNER of selected territory has toward the PLAYER (from their POV).
  let stanceToPlayer: Stance = 'neutral';
  if (ownerNation && playerId && ownerId !== playerId) {
    stanceToPlayer = ownerNation.stance[playerId] ?? 'neutral';
  }

  const isAllied =
    playerNation && ownerId && playerNation.stance[ownerId] === 'allied';
  const showGold = isPlayer || isAllied;
  const playerOwnsThis = playerId !== null && ownerId === playerId;

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
            maxHeight: 'calc(100vh - 110px)',
            overflowY: 'auto',
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

          {playerId && !playerOwnsThis && (
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
            </div>
          )}
          {playerOwnsThis && (
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

          {gameStarted && playerId && !playerOwnsThis && ownerId && (
            <DiplomacySection
              stance={stanceToPlayer}
              targetId={selectedId}
              ownerId={ownerId}
              playerNation={playerNation}
              targetCountry={country}
              onWar={() => declareWar(ownerId)}
              onPeace={() => proposePeace(ownerId)}
              onAlliance={() => proposeAlliance(ownerId)}
              onGift={() => sendGift(ownerId, GIFT_AMOUNT)}
              onDispatch={() => openDispatch(selectedId)}
            />
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function DiplomacySection({
  stance,
  playerNation,
  onWar,
  onPeace,
  onAlliance,
  onGift,
  onDispatch,
}: {
  stance: Stance;
  targetId: string;
  ownerId: string;
  playerNation: Nation | null;
  targetCountry: Country;
  onWar: () => void;
  onPeace: () => void;
  onAlliance: () => void;
  onGift: () => void;
  onDispatch: () => void;
}) {
  const canGift = playerNation ? playerNation.gold >= GIFT_AMOUNT : false;
  return (
    <div
      style={{
        borderTop: '1px solid var(--ink-faded)',
        marginTop: 14,
        paddingTop: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ink-faded)',
          marginBottom: 8,
        }}
      >
        Statecraft
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <DiploButton
          icon={<Send size={12} />}
          label="Send Troops"
          onClick={onDispatch}
          enabled={true}
          accent="var(--accent-gold)"
        />
        <DiploButton
          icon={<Swords size={12} />}
          label={stance === 'war' ? 'At war' : 'Declare War'}
          onClick={onWar}
          enabled={stance !== 'war'}
          accent="var(--accent-blood)"
        />
        <DiploButton
          icon={<ScrollText size={12} />}
          label="Propose Peace"
          onClick={onPeace}
          enabled={stance === 'war'}
          accent="var(--ink-faded)"
        />
        <DiploButton
          icon={<Handshake size={12} />}
          label={stance === 'allied' ? 'Allied' : 'Propose Alliance'}
          onClick={onAlliance}
          enabled={stance !== 'allied' && stance !== 'war'}
          accent="var(--accent-sage)"
        />
        <DiploButton
          icon={<Coins size={12} />}
          label={`Send Gift (${GIFT_AMOUNT}g)`}
          onClick={onGift}
          enabled={canGift}
          accent="var(--ink-faded)"
        />
      </div>
    </div>
  );
}

function DiploButton({
  icon,
  label,
  onClick,
  enabled,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  enabled: boolean;
  accent: string;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      style={{
        background: 'transparent',
        color: enabled ? 'var(--ink)' : 'var(--ink-faded)',
        border: `1px solid ${enabled ? accent : 'var(--ink-faded)'}`,
        padding: '7px 8px',
        fontFamily: '"Crimson Pro", serif',
        fontSize: 12,
        cursor: enabled ? 'pointer' : 'not-allowed',
        opacity: enabled ? 1 : 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <span style={{ color: accent, flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </button>
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
