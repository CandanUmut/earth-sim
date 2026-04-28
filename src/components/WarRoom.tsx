import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, ChevronUp, ChevronDown, Send, ChevronsLeft, MapPin } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { totalUnits } from '../game/activeBattle';
import { BALANCE_CONTROL } from '../game/balance';

function fmt(n: number): string {
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

export default function WarRoom() {
  const playerId = useGameStore((s) => s.playerCountryId);
  const activeBattles = useGameStore((s) => s.activeBattles);
  const movements = useGameStore((s) => s.movements);
  const countries = useGameStore((s) => s.countries);
  const ownership = useGameStore((s) => s.ownership);
  const nations = useGameStore((s) => s.nations);
  const control = useGameStore((s) => s.control);
  const openDispatch = useGameStore((s) => s.openDispatch);
  const retreatFromBattle = useGameStore((s) => s.retreatFromBattle);
  const setSelected = useGameStore((s) => s.setSelected);
  const setCameraTarget = useGameStore((s) => s.setCameraTarget);
  const openBattleHub = useGameStore((s) => s.openBattleHub);
  const gameStarted = useGameStore((s) => s.gameStarted);
  const [open, setOpen] = useState(false);

  if (!gameStarted || !playerId) return null;

  const myBattlesAttacking = Object.values(activeBattles).filter(
    (b) => b.attackerOwnerId === playerId,
  );
  const myBattlesDefending = Object.values(activeBattles).filter(
    (b) => (ownership[b.locationCountryId] ?? b.defenderOwnerId) === playerId,
  );
  const myMovements = movements.filter((m) => m.ownerId === playerId);

  const totalFronts =
    myBattlesAttacking.length + myBattlesDefending.length + myMovements.length;

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 70,
        zIndex: 28,
        width: open ? 360 : 'auto',
      }}
    >
      <motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((o) => !o)}
        title="War Room — overview of all active fronts"
        style={{
          background: totalFronts > 0 ? 'var(--accent-blood)' : 'var(--paper)',
          color: totalFronts > 0 ? 'var(--paper)' : 'var(--ink)',
          border: '1px solid var(--ink)',
          padding: '6px 12px',
          fontFamily: '"Crimson Pro", serif',
          fontSize: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: open ? '100%' : 'auto',
          justifyContent: open ? 'space-between' : 'flex-start',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Swords size={13} /> War Room
          {totalFronts > 0 && (
            <span
              className="num"
              style={{
                fontSize: 11,
                background: 'var(--paper)',
                color: 'var(--accent-blood)',
                padding: '0 6px',
                marginLeft: 4,
                fontWeight: 700,
                border: '1px solid var(--paper)',
              }}
            >
              {totalFronts}
            </span>
          )}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="warroom-body"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            style={{
              marginTop: 6,
              background: 'var(--paper)',
              border: '1px solid var(--ink)',
              boxShadow: '0 4px 14px var(--paper-shadow)',
              padding: '10px 12px 12px',
              maxHeight: '50vh',
              overflowY: 'auto',
            }}
          >
            <Section title="Your offensives" count={myBattlesAttacking.length}>
              {myBattlesAttacking.length === 0 && (
                <Empty text="No assaults underway." />
              )}
              {myBattlesAttacking.map((b) => {
                const c = countries[b.locationCountryId];
                if (!c) return null;
                const ctl = Math.round(
                  control[b.locationCountryId] ?? BALANCE_CONTROL.fullControl,
                );
                const myTotal = totalUnits(b.attackerForce);
                return (
                  <Row
                    key={b.id}
                    title={c.name}
                    subtitle={`Round ${b.rounds} · control ${ctl} · your force ${fmt(myTotal)}`}
                    color="var(--accent-gold)"
                    onTitle={() => {
                      setSelected(b.locationCountryId);
                      setCameraTarget({
                        kind: 'country',
                        countryId: b.locationCountryId,
                        scale: 4,
                      });
                    }}
                    actions={[
                      {
                        icon: <Send size={11} />,
                        label: 'Reinforce',
                        onClick: () => openDispatch(b.locationCountryId),
                      },
                      {
                        icon: <ChevronsLeft size={11} />,
                        label: 'Retreat',
                        onClick: () => retreatFromBattle(b.locationCountryId),
                        danger: true,
                      },
                      {
                        icon: <Swords size={11} />,
                        label: 'Hub',
                        onClick: () => openBattleHub(b.locationCountryId),
                      },
                    ]}
                  />
                );
              })}
            </Section>

            <Section
              title="Defending your soil"
              count={myBattlesDefending.length}
            >
              {myBattlesDefending.length === 0 && (
                <Empty text="No invaders on your land." />
              )}
              {myBattlesDefending.map((b) => {
                const c = countries[b.locationCountryId];
                if (!c) return null;
                const ctl = Math.round(
                  control[b.locationCountryId] ?? BALANCE_CONTROL.fullControl,
                );
                const player = nations[playerId];
                const myTotal = player
                  ? player.infantry + player.cavalry + player.artillery
                  : 0;
                return (
                  <Row
                    key={b.id}
                    title={c.name}
                    subtitle={`Round ${b.rounds} · control ${ctl} · garrison ${fmt(myTotal)}`}
                    color="var(--accent-blood)"
                    onTitle={() => {
                      setSelected(b.locationCountryId);
                      setCameraTarget({
                        kind: 'country',
                        countryId: b.locationCountryId,
                        scale: 4,
                      });
                    }}
                    actions={[
                      {
                        icon: <Swords size={11} />,
                        label: 'Hub',
                        onClick: () => openBattleHub(b.locationCountryId),
                      },
                    ]}
                  />
                );
              })}
            </Section>

            <Section title="Marching columns" count={myMovements.length}>
              {myMovements.length === 0 && (
                <Empty text="No troops on the move." />
              )}
              {myMovements.map((m) => {
                const dest = countries[m.toId];
                if (!dest) return null;
                const remaining = m.path.length - 1 - m.pathIndex;
                return (
                  <Row
                    key={m.id}
                    title={dest.name}
                    subtitle={`${fmt(m.troops)} troops · ${remaining} ${remaining === 1 ? 'month' : 'months'} away`}
                    color="var(--accent-gold)"
                    onTitle={() => {
                      setSelected(m.toId);
                      setCameraTarget({
                        kind: 'country',
                        countryId: m.toId,
                        scale: 3.5,
                      });
                    }}
                    actions={[
                      {
                        icon: <MapPin size={11} />,
                        label: 'Track',
                        onClick: () => {
                          setCameraTarget({
                            kind: 'country',
                            countryId: m.toId,
                            scale: 4.5,
                          });
                        },
                      },
                    ]}
                  />
                );
              })}
            </Section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-faded)',
          marginBottom: 4,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{title}</span>
        <span className="num">{count}</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontStyle: 'italic',
        color: 'var(--ink-faded)',
        padding: '4px 0 8px',
      }}
    >
      {text}
    </div>
  );
}

function Row({
  title,
  subtitle,
  color,
  onTitle,
  actions,
}: {
  title: string;
  subtitle: string;
  color: string;
  onTitle: () => void;
  actions: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }[];
}) {
  return (
    <div
      style={{
        borderLeft: `3px solid ${color}`,
        padding: '6px 8px',
        marginBottom: 6,
        background: 'rgba(184,134,11,0.04)',
      }}
    >
      <button
        type="button"
        onClick={onTitle}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--ink)',
          fontFamily: '"Crimson Pro", serif',
          fontSize: 14,
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        {title}
      </button>
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-faded)',
          fontFamily: '"JetBrains Mono", monospace',
          marginTop: 2,
        }}
      >
        {subtitle}
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {actions.map((a) => (
          <motion.button
            key={a.label}
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={a.onClick}
            style={{
              background: 'transparent',
              color: a.danger ? 'var(--accent-blood)' : 'var(--ink)',
              border: `1px solid ${a.danger ? 'var(--accent-blood)' : 'var(--ink-faded)'}`,
              padding: '2px 8px',
              fontFamily: '"Crimson Pro", serif',
              fontSize: 11,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {a.icon} {a.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
