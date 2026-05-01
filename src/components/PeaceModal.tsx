import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ScrollText, X, Crown, Coins, MapPin } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import {
  evaluatePeaceDeal,
  goalWeight,
  peaceThreshold,
  type War,
  type WarGoal,
  type WarGoalKind,
} from '../game/wars';

const goalIcons: Record<WarGoalKind, JSX.Element> = {
  annex_tile: <MapPin size={12} />,
  vassalize: <Crown size={12} />,
  tribute: <Coins size={12} />,
};

export default function PeaceModal() {
  const dialogId = useGameStore((s) => s.peaceDialogWarId);
  const close = useGameStore((s) => s.closePeaceDialog);
  const proposePeace = useGameStore((s) => s.proposePeace);
  const wars = useGameStore((s) => s.wars);
  const playerId = useGameStore((s) => s.playerCountryId);
  const countries = useGameStore((s) => s.countries);

  // dialogId can be a war id or a 'legacy:<countryId>' fallback. We resolve
  // to the matching War record.
  const war = useMemo<War | null>(() => {
    if (!dialogId) return null;
    if (dialogId.startsWith('legacy:')) {
      const otherId = dialogId.slice('legacy:'.length);
      if (!playerId) return null;
      for (const w of Object.values(wars)) {
        if (
          (w.attackerId === playerId && w.defenderId === otherId) ||
          (w.defenderId === playerId && w.attackerId === otherId)
        ) {
          return w;
        }
      }
      return null;
    }
    for (const w of Object.values(wars)) {
      if (w.id === dialogId) return w;
    }
    return null;
  }, [dialogId, wars, playerId]);

  // Local state: which claims will the proposal include? Default = full goals.
  const [selected, setSelected] = useState<WarGoal[] | null>(null);

  if (!dialogId || !playerId) return null;
  if (!war) {
    // Stale id (war already ended). Auto-close and bail.
    return null;
  }

  const playerIsAttacker = war.attackerId === playerId;
  const opponentId = playerIsAttacker ? war.defenderId : war.attackerId;
  const opponentCountry = countries[opponentId];
  if (!opponentCountry) return null;

  const claims =
    selected !== null ? selected : war.attackerGoals.slice();

  // For the player-as-attacker, claims are demands from defender.
  // For the player-as-defender, claims represent which of attacker's demands
  // the player accepts (defender can only "give in" to fewer claims).
  const decision = evaluatePeaceDeal({
    war,
    evaluatorId: opponentId,
    claims,
  });

  const myExhaustion = playerIsAttacker
    ? war.attackerExhaustion
    : war.defenderExhaustion;
  const theirExhaustion = playerIsAttacker
    ? war.defenderExhaustion
    : war.attackerExhaustion;
  const threshold = peaceThreshold(claims);

  const toggleClaim = (goal: WarGoal) => {
    setSelected((prev) => {
      const base = prev ?? war.attackerGoals.slice();
      const exists = base.find(
        (g) => g.kind === goal.kind && g.targetId === goal.targetId,
      );
      if (exists) {
        return base.filter(
          (g) => !(g.kind === goal.kind && g.targetId === goal.targetId),
        );
      }
      return [...base, goal];
    });
  };

  const isIncluded = (goal: WarGoal) =>
    claims.some(
      (g) => g.kind === goal.kind && g.targetId === goal.targetId,
    );

  return (
    <AnimatePresence>
      {dialogId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(26,24,20,0.45)' }}
          onClick={close}
        >
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--ink)',
              boxShadow: '0 8px 24px rgba(26,24,20,0.25)',
              padding: '22px 26px',
              maxWidth: 460,
              width: 'min(92vw, 460px)',
            }}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 p-1.5 hover:opacity-60"
              style={{ color: 'var(--ink-faded)' }}
            >
              <X size={16} />
            </button>

            <div
              className="display"
              style={{
                fontSize: 24,
                marginBottom: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <ScrollText size={20} /> Negotiate Peace · {opponentCountry.name}
            </div>
            <div
              style={{
                fontStyle: 'italic',
                color: 'var(--ink-faded)',
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {playerIsAttacker
                ? 'Your demands. Drop claims to make peace easier to accept.'
                : 'Their demands. Accept to settle, or refuse and fight on.'}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <Stat label="Your exhaustion" value={`${Math.round(myExhaustion)}/100`} />
              <Stat
                label={`${opponentCountry.name} exhaustion`}
                value={`${Math.round(theirExhaustion)}/100`}
              />
            </div>

            {war.attackerGoals.length === 0 && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ink-faded)',
                  fontStyle: 'italic',
                  marginBottom: 12,
                }}
              >
                No formal war goals — this is white peace.
              </div>
            )}

            {war.attackerGoals.map((g, i) => {
              const tile = countries[g.targetId];
              const label =
                g.kind === 'annex_tile'
                  ? `Annex ${tile?.name ?? g.targetId}`
                  : g.kind === 'vassalize'
                    ? `Vassalize ${opponentCountry.name}`
                    : `Tribute from ${opponentCountry.name}`;
              const included = isIncluded(g);
              return (
                <button
                  key={`${g.kind}-${g.targetId}-${i}`}
                  type="button"
                  onClick={() => toggleClaim(g)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '8px 10px',
                    marginBottom: 6,
                    background: included
                      ? 'var(--accent-gold)'
                      : 'var(--paper)',
                    border: `1px solid ${included ? 'var(--ink)' : 'var(--ink-faded)'}`,
                    color: included ? 'var(--paper)' : 'var(--ink)',
                    fontFamily: '"Crimson Pro", serif',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {goalIcons[g.kind]} {label}
                  </span>
                  <span
                    className="num"
                    style={{
                      fontSize: 11,
                      color: included ? 'var(--paper)' : 'var(--ink-faded)',
                    }}
                  >
                    +{goalWeight(g.kind)}
                  </span>
                </button>
              );
            })}

            <div
              style={{
                borderTop: '1px solid var(--ink-faded)',
                paddingTop: 10,
                marginBottom: 12,
                fontSize: 12,
                color: decision.accept
                  ? 'var(--accent-sage)'
                  : 'var(--accent-blood)',
                fontStyle: 'italic',
              }}
            >
              {decision.accept
                ? `${opponentCountry.name} will accept. ${decision.reason}`
                : `${opponentCountry.name} will refuse. ${decision.reason} (need ${threshold} exhaustion)`}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={close}
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--ink-faded)',
                  color: 'var(--ink-faded)',
                  padding: '8px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Fight on
              </button>
              <button
                type="button"
                disabled={!decision.accept}
                onClick={() => {
                  proposePeace(opponentId, claims);
                }}
                style={{
                  background: decision.accept
                    ? 'var(--accent-sage)'
                    : 'var(--ink-faded)',
                  border: '1px solid var(--ink)',
                  color: 'var(--paper)',
                  padding: '8px 14px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 14,
                  cursor: decision.accept ? 'pointer' : 'not-allowed',
                  opacity: decision.accept ? 1 : 0.5,
                }}
              >
                Sign Peace
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ink-faded)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div className="num" style={{ fontSize: 16 }}>
        {value}
      </div>
    </div>
  );
}
