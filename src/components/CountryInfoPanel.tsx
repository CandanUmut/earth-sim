import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Swords,
  Handshake,
  ScrollText,
  Coins,
  Send,
  Briefcase,
  Coins as CoinsAlt,
  Crown,
  Unlock,
} from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import type { Country, Terrain } from '../game/world';
import { SPEC_LABELS, SPEC_DESCRIPTIONS } from '../game/world';
import { totalTroops, type Nation, type Stance } from '../game/economy';
import { BALANCE_POLITICS } from '../game/balance';
import { warKey as warKeyForPair } from '../game/wars';

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
  const control = useGameStore((s) =>
    s.selectedCountryId ? s.control[s.selectedCountryId] ?? 100 : 100,
  );
  const playerId = useGameStore((s) => s.playerCountryId);
  const playerNation = useGameStore((s) =>
    s.playerCountryId ? s.nations[s.playerCountryId] : null,
  );
  const gameStarted = useGameStore((s) => s.gameStarted);
  const setSelected = useGameStore((s) => s.setSelected);
  const openDeclareWar = useGameStore((s) => s.openDeclareWar);
  const openPeaceDialog = useGameStore((s) => s.openPeaceDialog);
  const wars = useGameStore((s) => s.wars);
  const proposeAlliance = useGameStore((s) => s.proposeAlliance);
  const sendGift = useGameStore((s) => s.sendGift);
  const openDispatch = useGameStore((s) => s.openDispatch);
  const proposeTradeAgreement = useGameStore((s) => s.proposeTradeAgreement);
  const cancelTradeAgreement = useGameStore((s) => s.cancelTradeAgreement);
  const demandTribute = useGameStore((s) => s.demandTribute);
  const cancelTribute = useGameStore((s) => s.cancelTribute);
  const vassalize = useGameStore((s) => s.vassalize);
  const releaseVassal = useGameStore((s) => s.releaseVassal);
  const garrisonAtSelected = useGameStore((s) =>
    s.selectedCountryId ? s.garrisons[s.selectedCountryId] ?? null : null,
  );
  const garrisonTile = useGameStore((s) => s.garrisonTile);
  const withdrawGarrison = useGameStore((s) => s.withdrawGarrison);
  const rallyDefenders = useGameStore((s) => s.rallyDefenders);
  const homeId = useGameStore((s) => s.homeCountryId);

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
          {control < 100 && (
            <div
              style={{
                margin: '8px 0 4px',
                padding: '6px 8px',
                border: '1px solid var(--accent-blood)',
                background: 'rgba(122, 31, 31, 0.06)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--accent-blood)',
                  marginBottom: 4,
                }}
              >
                Contested · {Math.round(control)}/100
              </div>
              <div
                style={{
                  height: 4,
                  background: 'var(--paper)',
                  border: '1px solid var(--accent-blood)',
                }}
              >
                <div
                  style={{
                    width: `${control}%`,
                    height: '100%',
                    background: 'var(--accent-blood)',
                    transition: 'width 600ms ease',
                  }}
                />
              </div>
            </div>
          )}
          {nation && (
            <>
              <Stat label="Troops" value={fmtNum(totalTroops(nation))} mono />
              <Stat
                label="↳ Composition"
                value={`${fmtNum(nation.infantry)}i · ${fmtNum(nation.cavalry)}c · ${fmtNum(nation.artillery)}a`}
                mono
              />
              {showGold ? (
                <Stat label="Gold" value={fmtNum(nation.gold)} mono />
              ) : (
                <Stat label="Gold" value="—" italic />
              )}
              <Stat label="Tech" value={nation.tech.toFixed(2)} mono />
            </>
          )}

          {country.specializations.length > 0 && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: '1px solid var(--ink-faded)',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-faded)',
                  marginBottom: 6,
                }}
              >
                Traits
              </div>
              {country.specializations.map((spec) => (
                <div
                  key={spec}
                  style={{
                    fontSize: 12,
                    marginBottom: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{SPEC_LABELS[spec]}</span>
                  <span
                    style={{
                      color: 'var(--ink-faded)',
                      fontStyle: 'italic',
                    }}
                  >
                    {SPEC_DESCRIPTIONS[spec]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {gameStarted &&
            playerId &&
            playerOwnsThis &&
            selectedId !== homeId && (
              <GarrisonSection
                tileId={selectedId}
                garrison={garrisonAtSelected}
                contested={control < 100}
                playerNation={playerNation}
                onGarrison={(c) => garrisonTile(selectedId, c)}
                onWithdraw={() => withdrawGarrison(selectedId)}
                onRally={() => rallyDefenders(selectedId)}
              />
            )}

          {gameStarted && playerId && !playerOwnsThis && ownerId && (
            <DiplomacySection
              stance={stanceToPlayer}
              targetId={selectedId}
              ownerId={ownerId}
              playerNation={playerNation}
              targetNation={ownerNation}
              targetCountry={country}
              targetControl={control}
              onWar={() => openDeclareWar(ownerId)}
              onPeace={() => {
                if (playerId && ownerId) {
                  const k = warKeyForPair(playerId, ownerId);
                  const w = wars[k];
                  if (w) openPeaceDialog(w.id);
                  else openPeaceDialog(`legacy:${ownerId}`);
                }
              }}
              onAlliance={() => proposeAlliance(ownerId)}
              onGift={() => sendGift(ownerId, GIFT_AMOUNT)}
              onDispatch={() => openDispatch(selectedId)}
              onTrade={() => proposeTradeAgreement(ownerId)}
              onCancelTrade={() => cancelTradeAgreement(ownerId)}
              onTribute={() => demandTribute(ownerId)}
              onCancelTribute={() => cancelTribute(ownerId)}
              onVassalize={() => vassalize(ownerId)}
              onReleaseVassal={() => releaseVassal(ownerId)}
            />
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function GarrisonSection({
  garrison,
  contested,
  playerNation,
  onGarrison,
  onWithdraw,
  onRally,
}: {
  tileId: string;
  garrison: { infantry: number; cavalry: number; artillery: number } | null;
  contested: boolean;
  playerNation: Nation | null;
  onGarrison: (c: { infantry: number; cavalry: number; artillery: number }) => void;
  onWithdraw: () => void;
  onRally: () => void;
}) {
  const totalGarr = garrison
    ? garrison.infantry + garrison.cavalry + garrison.artillery
    : 0;
  // Quick preset: send 25 % of player's home pool as garrison.
  const presetGarrison = () => {
    if (!playerNation) return;
    const f = (n: number) => Math.max(0, Math.floor(n * 0.25));
    onGarrison({
      infantry: f(playerNation.infantry),
      cavalry: f(playerNation.cavalry),
      artillery: f(playerNation.artillery),
    });
  };
  const canRally = (playerNation?.gold ?? 0) >= 60;

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
        Hold This Land
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-faded)',
          fontStyle: 'italic',
          marginBottom: 8,
        }}
      >
        Garrison: <span className="num">{totalGarr}</span>{' '}
        {garrison &&
          `(${garrison.infantry}i · ${garrison.cavalry}c · ${garrison.artillery}a)`}
        . A garrison defends this tile if attacked AND prevents rebellions.
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.08 }}
          onClick={presetGarrison}
          disabled={!playerNation}
          style={{
            background: 'transparent',
            color: 'var(--ink)',
            border: '1px solid var(--ink)',
            padding: '6px 10px',
            fontFamily: '"Crimson Pro", serif',
            fontSize: 12,
            cursor: 'pointer',
          }}
          title="Move 25% of your home pool here as a garrison."
        >
          Garrison +25 %
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.08 }}
          onClick={onWithdraw}
          disabled={totalGarr === 0}
          style={{
            background: 'transparent',
            color: totalGarr > 0 ? 'var(--ink)' : 'var(--ink-faded)',
            border: `1px solid ${totalGarr > 0 ? 'var(--ink)' : 'var(--ink-faded)'}`,
            padding: '6px 10px',
            fontFamily: '"Crimson Pro", serif',
            fontSize: 12,
            cursor: totalGarr > 0 ? 'pointer' : 'not-allowed',
            opacity: totalGarr > 0 ? 1 : 0.5,
          }}
          title="Pull garrison troops back to your home pool."
        >
          Withdraw
        </motion.button>
        {contested && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.08 }}
            onClick={onRally}
            disabled={!canRally}
            style={{
              background: canRally ? 'var(--accent-blood)' : 'transparent',
              color: canRally ? 'var(--paper)' : 'var(--ink-faded)',
              border: `1px solid ${canRally ? 'var(--accent-blood)' : 'var(--ink-faded)'}`,
              padding: '6px 10px',
              fontFamily: '"Crimson Pro", serif',
              fontSize: 12,
              cursor: canRally ? 'pointer' : 'not-allowed',
              opacity: canRally ? 1 : 0.5,
            }}
            title="Rally a quick militia (+12 inf garrison) for 60 g."
          >
            ⚔ Rally Defenders (60g)
          </motion.button>
        )}
      </div>
    </div>
  );
}

function DiplomacySection({
  stance,
  ownerId,
  playerNation,
  targetNation,
  targetControl,
  onWar,
  onPeace,
  onAlliance,
  onGift,
  onDispatch,
  onTrade,
  onCancelTrade,
  onTribute,
  onCancelTribute,
  onVassalize,
  onReleaseVassal,
}: {
  stance: Stance;
  targetId: string;
  ownerId: string;
  playerNation: Nation | null;
  targetNation: Nation | null;
  targetCountry: Country;
  targetControl: number;
  onWar: () => void;
  onPeace: () => void;
  onAlliance: () => void;
  onGift: () => void;
  onDispatch: () => void;
  onTrade: () => void;
  onCancelTrade: () => void;
  onTribute: () => void;
  onCancelTribute: () => void;
  onVassalize: () => void;
  onReleaseVassal: () => void;
}) {
  const canGift = playerNation ? playerNation.gold >= GIFT_AMOUNT : false;
  const isTrading = playerNation
    ? playerNation.tradePartners.includes(ownerId)
    : false;
  const isPaying = !!playerNation?.tributePaid?.[ownerId];
  const isReceiving = !!playerNation?.tributeReceived?.[ownerId];
  const isVassal = targetNation?.vassalOf === playerNation
    ? false
    : !!playerNation?.vassals?.includes(ownerId);
  const targetIsVassal = !!targetNation?.vassalOf;
  const eligibleForVassalize =
    targetControl <= BALANCE_POLITICS.vassalizeMaxControl && !targetIsVassal;
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
      {targetNation && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--ink-faded)',
            marginBottom: 8,
            fontStyle: 'italic',
          }}
        >
          Reputation {Math.round(targetNation.reputation)}/100
          {isTrading && ' · trading'}
          {isPaying && ' · you tribute them'}
          {isReceiving && ' · they tribute you'}
          {isVassal && ' · your vassal'}
          {targetIsVassal && targetNation.vassalOf && ' · is a vassal'}
        </div>
      )}
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
        <DiploButton
          icon={<Briefcase size={12} />}
          label={isTrading ? 'Cancel Trade' : 'Propose Trade'}
          onClick={isTrading ? onCancelTrade : onTrade}
          enabled={stance !== 'war'}
          accent="var(--accent-sage)"
        />
        <DiploButton
          icon={<CoinsAlt size={12} />}
          label={isReceiving ? 'Release Tribute' : 'Demand Tribute'}
          onClick={isReceiving ? onCancelTribute : onTribute}
          enabled={!isPaying}
          accent="var(--accent-gold)"
        />
        <DiploButton
          icon={isVassal ? <Unlock size={12} /> : <Crown size={12} />}
          label={isVassal ? 'Release Vassal' : 'Vassalize'}
          onClick={isVassal ? onReleaseVassal : onVassalize}
          enabled={isVassal || eligibleForVassalize}
          accent="var(--accent-gold)"
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
    <motion.button
      type="button"
      whileTap={enabled ? { scale: 0.94 } : undefined}
      whileHover={enabled ? { backgroundColor: 'rgba(26,24,20,0.04)' } : undefined}
      transition={{ duration: 0.08 }}
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
    </motion.button>
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
