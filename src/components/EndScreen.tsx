import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { MONTH_NAMES } from '../game/tick';

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

export default function EndScreen() {
  const victory = useGameStore((s) => s.victory);
  const ownership = useGameStore((s) => s.ownership);
  const playerId = useGameStore((s) => s.playerCountryId);
  const battles = useGameStore((s) => s.battleLog);
  const newCampaign = useGameStore((s) => s.newCampaign);

  const show = victory.kind !== 'ongoing';
  const isWin = victory.kind === 'win';
  const yearsPlayed =
    victory.kind === 'ongoing' ? 0 : victory.year - 1900;
  const month =
    victory.kind === 'ongoing' ? 0 : MONTH_NAMES[victory.month];

  let conquered = 0;
  if (playerId) {
    for (const owner of Object.values(ownership)) {
      if (owner === playerId) conquered++;
    }
    conquered = Math.max(0, conquered - 1); // exclude home
  }

  const biggestBattle = battles.reduce(
    (max, b) => Math.max(max, b.attackerLosses + b.defenderLosses),
    0,
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(26,24,20,0.55)' }}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--ink)',
              boxShadow: '0 16px 48px rgba(26,24,20,0.4)',
              padding: '40px 56px 36px',
              width: 'min(94vw, 560px)',
              textAlign: 'center',
            }}
          >
            <div
              className="display"
              style={{
                fontSize: 14,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--ink-faded)',
                marginBottom: 8,
              }}
            >
              {isWin ? 'A Cartographer’s Triumph' : 'A Crown Forfeit'}
            </div>
            <div
              className="display"
              style={{
                fontSize: 80,
                lineHeight: 1,
                color: isWin ? 'var(--accent-gold)' : 'var(--accent-blood)',
                marginBottom: 16,
                letterSpacing: '0.04em',
              }}
            >
              {isWin ? 'Victory' : 'Defeat'}
            </div>

            <div
              style={{
                fontStyle: 'italic',
                color: 'var(--ink-faded)',
                marginBottom: 26,
              }}
            >
              {month} {victory.year}
              {' '}· after {yearsPlayed} {yearsPlayed === 1 ? 'year' : 'years'} of campaigning
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                borderTop: '1px solid var(--ink-faded)',
                borderBottom: '1px solid var(--ink-faded)',
                padding: '14px 0',
                marginBottom: 28,
              }}
            >
              <Stat
                label="Conquered"
                value={fmtNum(conquered)}
              />
              <Stat
                label="Battles"
                value={fmtNum(battles.length)}
              />
              <Stat
                label="Largest engagement"
                value={fmtNum(biggestBattle)}
              />
            </div>

            <button
              type="button"
              onClick={newCampaign}
              style={{
                background: 'var(--ink)',
                color: 'var(--paper)',
                border: '1px solid var(--ink)',
                padding: '12px 36px',
                fontFamily: '"Crimson Pro", serif',
                fontSize: 18,
                letterSpacing: '0.04em',
                cursor: 'pointer',
              }}
            >
              New Campaign
            </button>
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
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-faded)',
        }}
      >
        {label}
      </div>
      <div className="num" style={{ fontSize: 22, marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}
