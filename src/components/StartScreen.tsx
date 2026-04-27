import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../store/gameStore';
import { countryFill } from '../game/world';

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

  const show = loaded && !gameStarted;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="start"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 z-40 flex items-center justify-center"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(244,236,216,0.0) 30%, rgba(26,24,20,0.35) 100%)',
            pointerEvents: 'none',
          }}
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--ink)',
              boxShadow: '0 8px 24px rgba(26,24,20,0.18)',
              padding: '28px 36px',
              maxWidth: 520,
              width: 'min(92vw, 520px)',
              pointerEvents: 'auto',
              textAlign: 'center',
            }}
          >
            <div
              className="display"
              style={{ fontSize: 32, lineHeight: 1.1, marginBottom: 6 }}
            >
              Choose Your Nation
            </div>
            <div
              style={{
                fontStyle: 'italic',
                color: 'var(--ink-faded)',
                marginBottom: 22,
                fontSize: 15,
              }}
            >
              Click any country on the map. The campaign begins in January 1900.
            </div>

            <div
              style={{
                minHeight: 116,
                borderTop: '1px solid var(--ink-faded)',
                borderBottom: '1px solid var(--ink-faded)',
                padding: '14px 0',
                marginBottom: 20,
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
                      {nation.troops} (with player bonus)
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

            <button
              type="button"
              disabled={!selectedId}
              onClick={() => selectedId && startCampaign(selectedId)}
              style={{
                background: selectedId ? 'var(--ink)' : 'transparent',
                color: selectedId ? 'var(--paper)' : 'var(--ink-faded)',
                border: '1px solid var(--ink)',
                padding: '10px 28px',
                fontFamily: '"Crimson Pro", serif',
                fontSize: 18,
                letterSpacing: '0.04em',
                cursor: selectedId ? 'pointer' : 'not-allowed',
                opacity: selectedId ? 1 : 0.5,
                transition: 'all 200ms ease',
              }}
            >
              Begin Campaign
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
