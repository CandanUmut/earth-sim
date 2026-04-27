import { AnimatePresence, motion } from 'framer-motion';
import { X, BookOpen, Lock, Check } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import {
  TECH_NODES,
  isUnlockable,
  type TechBranch,
  type TechNode,
} from '../game/techTree';

const BRANCH_LABELS: Record<TechBranch, string> = {
  military: 'Military',
  economy: 'Economy',
  logistics: 'Logistics',
  diplomacy: 'Diplomacy',
};

const BRANCH_COLOR: Record<TechBranch, string> = {
  military: 'var(--accent-blood)',
  economy: 'var(--accent-gold)',
  logistics: 'var(--ink-faded)',
  diplomacy: 'var(--accent-sage)',
};

export default function TechTreePanel() {
  const open = useGameStore((s) => s.techPanelOpen);
  const setOpen = useGameStore((s) => s.setTechPanelOpen);
  const playerId = useGameStore((s) => s.playerCountryId);
  const nation = useGameStore((s) =>
    s.playerCountryId ? s.nations[s.playerCountryId] : null,
  );
  const research = useGameStore((s) => s.researchTech);
  const toggleAuto = useGameStore((s) => s.toggleAutoRecruit);

  if (!playerId || !nation) return <AnimatePresence />;

  const unlocked = nation.unlockedTech;
  const gold = nation.gold;
  const autoRecruitAvailable = unlocked.includes('log_conscription');

  const groupedByBranch: Record<TechBranch, TechNode[]> = {
    military: [],
    economy: [],
    logistics: [],
    diplomacy: [],
  };
  for (const node of TECH_NODES) groupedByBranch[node.branch].push(node);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="techpanel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-40 flex items-center justify-center"
          style={{ background: 'rgba(26,24,20,0.32)' }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--ink)',
              boxShadow: '0 8px 24px rgba(26,24,20,0.22)',
              padding: '22px 24px',
              width: 'min(96vw, 720px)',
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-faded)',
                padding: 6,
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>

            <div
              className="display"
              style={{ fontSize: 26, marginBottom: 4, paddingRight: 26 }}
            >
              Tech Tree
            </div>
            <div
              className="num"
              style={{ fontSize: 12, color: 'var(--ink-faded)', marginBottom: 14 }}
            >
              Treasury: {Math.round(gold)} g · Unlocked {unlocked.length} of{' '}
              {TECH_NODES.length}
            </div>

            {autoRecruitAvailable && (
              <div
                style={{
                  marginBottom: 18,
                  padding: '10px 12px',
                  border: '1px solid var(--accent-gold)',
                  background: 'rgba(184,134,11,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>Auto-Recruit</div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-faded)',
                      fontStyle: 'italic',
                    }}
                  >
                    Surplus gold each tick is spent on troops in your doctrine
                    mix.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleAuto}
                  style={{
                    padding: '6px 16px',
                    background: nation.autoRecruit
                      ? 'var(--accent-gold)'
                      : 'transparent',
                    color: nation.autoRecruit ? 'var(--paper)' : 'var(--ink)',
                    border: '1px solid var(--accent-gold)',
                    fontFamily: '"Crimson Pro", serif',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  {nation.autoRecruit ? 'On' : 'Off'}
                </button>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 14,
              }}
            >
              {(Object.keys(groupedByBranch) as TechBranch[]).map((branch) => (
                <div key={branch}>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: BRANCH_COLOR[branch],
                      marginBottom: 6,
                      fontWeight: 600,
                    }}
                  >
                    {BRANCH_LABELS[branch]}
                  </div>
                  {groupedByBranch[branch].map((node) => {
                    const have = unlocked.includes(node.id);
                    const can = isUnlockable(node.id, unlocked, gold);
                    const prereq = node.prereq && !unlocked.includes(node.prereq);
                    return (
                      <div
                        key={node.id}
                        style={{
                          padding: '8px 10px',
                          border: `1px solid ${
                            have
                              ? BRANCH_COLOR[branch]
                              : 'var(--ink-faded)'
                          }`,
                          marginBottom: 6,
                          background: have
                            ? 'rgba(184,134,11,0.06)'
                            : 'transparent',
                          opacity: prereq ? 0.5 : 1,
                        }}
                      >
                        <div
                          className="flex items-center justify-between"
                          style={{ marginBottom: 2 }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              display: 'flex',
                              gap: 6,
                              alignItems: 'center',
                            }}
                          >
                            {have ? (
                              <Check size={12} color={BRANCH_COLOR[branch]} />
                            ) : prereq ? (
                              <Lock size={12} color="var(--ink-faded)" />
                            ) : (
                              <BookOpen size={12} color={BRANCH_COLOR[branch]} />
                            )}
                            {node.name}
                          </span>
                          <span
                            className="num"
                            style={{ color: 'var(--ink-faded)', fontSize: 12 }}
                          >
                            {have ? '—' : `${node.cost} g`}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--ink-faded)',
                            marginBottom: have ? 0 : 6,
                          }}
                        >
                          {node.description}
                          {prereq && (
                            <span
                              style={{ color: 'var(--accent-blood)' }}
                            >
                              {' '}
                              · requires {
                                TECH_NODES.find((n) => n.id === node.prereq)?.name
                              }
                            </span>
                          )}
                        </div>
                        {!have && (
                          <button
                            type="button"
                            disabled={!can}
                            onClick={() => research(node.id)}
                            style={{
                              padding: '4px 10px',
                              background: can ? BRANCH_COLOR[branch] : 'transparent',
                              color: can ? 'var(--paper)' : 'var(--ink-faded)',
                              border: `1px solid ${
                                can ? BRANCH_COLOR[branch] : 'var(--ink-faded)'
                              }`,
                              fontFamily: '"Crimson Pro", serif',
                              fontSize: 12,
                              cursor: can ? 'pointer' : 'not-allowed',
                              opacity: can ? 1 : 0.5,
                            }}
                          >
                            Research
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
