import { AnimatePresence, motion } from 'framer-motion';
import { Swords, Users, X, Send, ChevronsLeft } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { totalUnits, BALANCE_BATTLE } from '../game/activeBattle';
import { BALANCE_CONTROL } from '../game/balance';

import { fmtTroops as fmt } from '../util/format';

export default function BattleHub() {
  const focusedId = useGameStore((s) => s.focusedBattleLocationId);
  const closeBattleHub = useGameStore((s) => s.closeBattleHub);
  const battle = useGameStore((s) =>
    s.focusedBattleLocationId
      ? s.activeBattles[s.focusedBattleLocationId] ?? null
      : null,
  );
  const country = useGameStore((s) =>
    s.focusedBattleLocationId
      ? s.countries[s.focusedBattleLocationId] ?? null
      : null,
  );
  const ownership = useGameStore((s) => s.ownership);
  const nations = useGameStore((s) => s.nations);
  const countries = useGameStore((s) => s.countries);
  const control = useGameStore((s) => s.control);
  const playerId = useGameStore((s) => s.playerCountryId);
  const openDispatch = useGameStore((s) => s.openDispatch);
  const retreatFromBattle = useGameStore((s) => s.retreatFromBattle);

  if (!focusedId || !battle || !country) return <AnimatePresence />;

  const attackerCountry = countries[battle.attackerOwnerId];
  const defenderOwnerId = ownership[focusedId] ?? battle.defenderOwnerId;
  const defenderCountry = countries[defenderOwnerId];
  const defenderNation = nations[defenderOwnerId];
  const attackerName = attackerCountry?.name ?? battle.attackerOwnerId;
  const defenderName = defenderCountry?.name ?? defenderOwnerId;

  const attackerTotal = totalUnits(battle.attackerForce);
  const defenderTotal = defenderNation
    ? defenderNation.infantry + defenderNation.cavalry + defenderNation.artillery
    : 0;
  const ctrl = Math.round(control[focusedId] ?? BALANCE_CONTROL.fullControl);
  const playerIsAttacker =
    playerId !== null && battle.attackerOwnerId === playerId;
  const playerIsDefender =
    playerId !== null && defenderOwnerId === playerId;
  const roundsLeftBudget = BALANCE_BATTLE.maxRounds - battle.rounds;

  return (
    <AnimatePresence>
      <motion.div
        key="battle-hub"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute inset-0 z-40 flex items-center justify-center"
        style={{ background: 'rgba(26,24,20,0.32)' }}
        onClick={closeBattleHub}
      >
        <motion.div
          initial={{ scale: 0.96, y: 10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--ink)',
            boxShadow: '0 8px 24px rgba(26,24,20,0.22)',
            padding: '20px 26px 22px',
            width: 'min(94vw, 480px)',
            position: 'relative',
          }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={closeBattleHub}
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
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--accent-blood)',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Swords size={12} /> Battle of {country.name}
          </div>
          <div
            className="display"
            style={{ fontSize: 24, lineHeight: 1.05, marginBottom: 4 }}
          >
            {attackerName} vs {defenderName}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--ink-faded)',
              fontStyle: 'italic',
              marginBottom: 12,
            }}
          >
            Round {battle.rounds} · {roundsLeftBudget} rounds before forced resolution
          </div>

          <Side
            color="var(--accent-gold)"
            label="Attacker"
            name={attackerName}
            total={attackerTotal}
            losses={battle.totalAttackerLosses}
            comp={battle.attackerForce}
            isPlayer={playerIsAttacker}
          />
          <div style={{ height: 8 }} />
          <Side
            color="var(--accent-blood)"
            label="Defender"
            name={defenderName}
            total={defenderTotal}
            losses={battle.totalDefenderLosses}
            comp={
              defenderNation
                ? {
                    infantry: defenderNation.infantry,
                    cavalry: defenderNation.cavalry,
                    artillery: defenderNation.artillery,
                  }
                : { infantry: 0, cavalry: 0, artillery: 0 }
            }
            isPlayer={playerIsDefender}
          />

          <div style={{ marginTop: 12 }}>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--ink-faded)',
                marginBottom: 4,
              }}
            >
              Defender control · {ctrl}/100
            </div>
            <div
              style={{
                height: 6,
                background: 'var(--paper)',
                border: '1px solid var(--accent-blood)',
              }}
            >
              <div
                style={{
                  width: `${ctrl}%`,
                  height: '100%',
                  background: 'var(--accent-blood)',
                  transition: 'width 600ms ease',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            {playerIsAttacker && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => retreatFromBattle(focusedId)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  color: 'var(--accent-blood)',
                  border: '1px solid var(--accent-blood)',
                  padding: '8px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
                title="Sound the retreat — recover ~60% of your engaged force."
              >
                <ChevronsLeft size={14} /> Retreat
              </motion.button>
            )}
            {playerId && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  closeBattleHub();
                  openDispatch(focusedId);
                }}
                style={{
                  flex: 1,
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  border: '1px solid var(--ink)',
                  padding: '8px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
                title={
                  playerIsAttacker
                    ? 'Send more troops — they will reinforce this battle.'
                    : 'Counterattack via the Send Troops dialog.'
                }
              >
                <Send size={14} />{' '}
                {playerIsAttacker ? 'Reinforce' : 'Counterattack'}
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Side({
  color,
  label,
  name,
  total,
  losses,
  comp,
  isPlayer,
}: {
  color: string;
  label: string;
  name: string;
  total: number;
  losses: number;
  comp: { infantry: number; cavalry: number; artillery: number };
  isPlayer: boolean;
}) {
  const initial = total + losses;
  const remainPct = initial > 0 ? Math.round((total / initial) * 100) : 0;
  return (
    <div
      style={{
        border: `1px solid ${color}`,
        padding: '8px 10px',
        background: 'rgba(184,134,11,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color,
          }}
        >
          {label}
          {isPlayer && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 9,
                color: 'var(--accent-gold)',
                fontStyle: 'italic',
                letterSpacing: 0,
                textTransform: 'none',
              }}
            >
              (You)
            </span>
          )}
        </div>
        <span className="num" style={{ fontSize: 12, color: 'var(--ink)' }}>
          <Users size={11} style={{ display: 'inline-block' }} /> {fmt(total)} ·{' '}
          <span style={{ color: 'var(--ink-faded)' }}>−{fmt(losses)}</span>
        </span>
      </div>
      <div
        className="display"
        style={{ fontSize: 16, lineHeight: 1.1, marginBottom: 6 }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-faded)',
          fontFamily: '"JetBrains Mono", monospace',
          marginBottom: 4,
        }}
      >
        {fmt(comp.infantry)}i · {fmt(comp.cavalry)}c · {fmt(comp.artillery)}a
      </div>
      <div
        style={{
          height: 4,
          background: 'var(--paper)',
          border: `1px solid ${color}`,
        }}
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, remainPct))}%`,
            height: '100%',
            background: color,
            transition: 'width 500ms ease',
          }}
        />
      </div>
    </div>
  );
}
