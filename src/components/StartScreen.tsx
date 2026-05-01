import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { countryFill } from '../game/world';
import { formatDate } from '../game/tick';

function formatPop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
  return n.toLocaleString();
}

export default function StartScreen() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  const loaded = useGameStore((s) => s.loaded);
  const selectedId = useGameStore((s) => s.selectedCountryId);
  const country = useGameStore((s) =>
    s.selectedCountryId ? s.countries[s.selectedCountryId] : null,
  );
  const nation = useGameStore((s) =>
    s.selectedCountryId ? s.nations[s.selectedCountryId] : null,
  );
  const startCampaign = useGameStore((s) => s.startCampaign);
  const savedSummary = useGameStore((s) => s.savedSummary);
  const resumeCampaign = useGameStore((s) => s.resumeCampaign);
  const countries = useGameStore((s) => s.countries);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);

  const show = loaded && !gameStarted;
  const savedCountry = savedSummary?.playerCountryId
    ? countries[savedSummary.playerCountryId]
    : null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="start"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-x-0 bottom-0 z-40 flex items-end justify-center"
          style={{
            paddingBottom: 18,
            // Soft shade only at the bottom edge so the entire map stays
            // legible while the player picks a country.
            background:
              'linear-gradient(to top, rgba(26,24,20,0.18) 0%, rgba(26,24,20,0) 35%)',
            pointerEvents: 'none',
            // Don't span the whole viewport — only the bottom strip — so
            // wheel events above the gradient pass cleanly to the map even
            // before our window-level handler runs.
            top: 'auto',
            height: 'auto',
          }}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--ink)',
              boxShadow: '0 8px 24px rgba(26,24,20,0.18)',
              padding: '16px 24px 18px',
              maxWidth: 560,
              width: 'min(94vw, 560px)',
              pointerEvents: 'auto',
              textAlign: 'center',
            }}
          >
            <div
              className="display"
              style={{ fontSize: 24, lineHeight: 1.1, marginBottom: 2 }}
            >
              Choose Your Nation
            </div>
            <div
              style={{
                fontStyle: 'italic',
                color: 'var(--ink-faded)',
                marginBottom: 12,
                fontSize: 13,
              }}
            >
              Click any country on the map. The campaign begins in January 1900.
            </div>

            <div
              style={{
                minHeight: 64,
                borderTop: '1px solid var(--ink-faded)',
                borderBottom: '1px solid var(--ink-faded)',
                padding: '10px 0',
                marginBottom: 12,
              }}
            >
              {country && nation ? (
                <div className="flex items-center justify-center gap-4">
                  <div
                    style={{
                      width: 14,
                      height: 36,
                      background: countryFill(country.id),
                      border: '1px solid var(--ink)',
                    }}
                  />
                  <div className="text-left">
                    <div
                      className="display"
                      style={{ fontSize: 22, lineHeight: 1.1 }}
                    >
                      {country.name}
                    </div>
                    <div
                      className="num"
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-faded)',
                        marginTop: 4,
                      }}
                    >
                      Pop {formatPop(country.population)} · Econ{' '}
                      {country.baseEconomy.toFixed(1)} ·{' '}
                      <span style={{ fontStyle: 'italic' }}>
                        {country.terrain}
                      </span>
                    </div>
                    <div
                      className="num"
                      style={{
                        fontSize: 12,
                        color: 'var(--ink-faded)',
                        marginTop: 2,
                      }}
                    >
                      Start gold {Math.round(nation.gold)} · troops{' '}
                      {nation.infantry + nation.cavalry + nation.artillery} (with player bonus)
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    color: 'var(--ink-faded)',
                    fontStyle: 'italic',
                    paddingTop: 28,
                  }}
                >
                  Select a country to inspect it.
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 6,
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              {(['easy', 'normal', 'hard'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  style={{
                    background:
                      difficulty === d ? 'var(--ink)' : 'transparent',
                    color: difficulty === d ? 'var(--paper)' : 'var(--ink)',
                    border: '1px solid var(--ink)',
                    padding: '4px 14px',
                    fontFamily: '"Crimson Pro", serif',
                    fontSize: 12,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                  title={
                    d === 'easy'
                      ? '1.5× starting bonus, gentler events'
                      : d === 'hard'
                        ? '0.7× gold / 0.8× troops, hostile world'
                        : 'Standard balance'
                  }
                >
                  {d === 'easy'
                    ? 'Cartographer'
                    : d === 'hard'
                      ? 'Conqueror'
                      : 'Strategist'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                type="button"
                disabled={!selectedId}
                onClick={() => selectedId && startCampaign(selectedId)}
                style={{
                  background: selectedId ? 'var(--ink)' : 'transparent',
                  color: selectedId ? 'var(--paper)' : 'var(--ink-faded)',
                  border: '1px solid var(--ink)',
                  padding: '8px 24px',
                  fontFamily: '"Crimson Pro", serif',
                  fontSize: 16,
                  letterSpacing: '0.04em',
                  cursor: selectedId ? 'pointer' : 'not-allowed',
                  opacity: selectedId ? 1 : 0.5,
                  transition: 'all 200ms ease',
                }}
              >
                Begin Campaign
              </button>
            </div>

            {savedSummary && savedCountry && (
              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: '1px dashed var(--ink-faded)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-faded)',
                    marginBottom: 6,
                  }}
                >
                  Resume Saved Campaign
                </div>
                <div style={{ fontSize: 13, fontStyle: 'italic', marginBottom: 10 }}>
                  {savedCountry.name} ·{' '}
                  <span className="num">{formatDate(savedSummary.date)}</span>
                  {savedSummary.conquered > 0 && (
                    <> · {savedSummary.conquered} conquered</>
                  )}
                </div>
                <button
                  type="button"
                  onClick={resumeCampaign}
                  style={{
                    background: 'transparent',
                    color: 'var(--ink)',
                    border: '1px solid var(--ink)',
                    padding: '8px 22px',
                    fontFamily: '"Crimson Pro", serif',
                    fontSize: 14,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                  }}
                >
                  Continue
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
