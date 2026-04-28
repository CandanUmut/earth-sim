import { motion } from 'framer-motion';
import {
  Coins,
  Sparkles,
  Shield,
  Wind,
  Crosshair,
  BookOpen,
  Hammer,
} from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { countryFill, SPEC_LABELS } from '../game/world';
import {
  maxTroops,
  recruitCost,
  techInvestmentCost,
  totalTroops,
  TROOP_LABELS,
  barracksUpgradeCost,
  barracksBulkCap,
  barracksQuickButtons,
  type TroopType,
} from '../game/economy';
import { BALANCE_BARRACKS } from '../game/balance';

const BARRACKS_COST_MUL = BALANCE_BARRACKS.costMultiplier;

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

const TROOP_ICONS: Record<TroopType, React.ReactNode> = {
  infantry: <Shield size={12} />,
  cavalry: <Wind size={12} />,
  artillery: <Crosshair size={12} />,
};

const tapMotion = { whileTap: { scale: 0.93 }, transition: { duration: 0.08 } };

export default function PlayerHUD() {
  const playerId = useGameStore((s) => s.playerCountryId);
  const country = useGameStore((s) =>
    s.playerCountryId ? s.countries[s.playerCountryId] : null,
  );
  const nation = useGameStore((s) =>
    s.playerCountryId ? s.nations[s.playerCountryId] : null,
  );
  const recruit = useGameStore((s) => s.recruit);
  const invest = useGameStore((s) => s.investInTech);
  const upgradeBarracks = useGameStore((s) => s.upgradeBarracks);
  const setTechPanelOpen = useGameStore((s) => s.setTechPanelOpen);

  if (!playerId || !country || !nation) return null;

  const cap = maxTroops(country);
  const total = totalTroops(nation);
  const room = Math.max(0, cap - total);
  const bulkCap = barracksBulkCap(nation.barracksLevel);
  const upgradeCost = barracksUpgradeCost(nation.barracksLevel);
  const quick = barracksQuickButtons(nation.barracksLevel);

  return (
    <aside
      className="absolute z-30"
      style={{
        top: 64,
        left: 16,
        width: 320,
        background: 'var(--paper)',
        border: '1px solid var(--ink)',
        boxShadow: '0 4px 14px var(--paper-shadow), 0 1px 2px var(--paper-shadow)',
        padding: '14px 16px 16px',
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{
          borderBottom: '1px solid var(--ink-faded)',
          paddingBottom: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 12,
            height: 32,
            background: countryFill(country.id),
            border: '1px solid var(--ink)',
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            className="display"
            style={{
              fontSize: 18,
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={country.name}
          >
            {country.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-faded)',
              fontStyle: 'italic',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Player Realm
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between" style={{ padding: '4px 0' }}>
        <div className="flex items-center gap-2" style={{ color: 'var(--ink-faded)' }}>
          <Coins size={14} />
          <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Gold
          </span>
        </div>
        <span className="num" style={{ fontSize: 14 }}>
          {fmtNum(nation.gold)}
        </span>
      </div>

      <div className="flex items-center justify-between" style={{ padding: '4px 0 8px' }}>
        <div className="flex items-center gap-2" style={{ color: 'var(--ink-faded)' }}>
          <Sparkles size={14} />
          <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Tech
          </span>
        </div>
        <span className="num" style={{ fontSize: 14 }}>
          {nation.tech.toFixed(2)}
        </span>
      </div>

      <div
        className="flex items-center justify-between"
        style={{ padding: '4px 0 4px' }}
        title={`Barracks Level ${nation.barracksLevel}\n• Bulk-buy cap: ${barracksBulkCap(nation.barracksLevel)} troops at once\n• Per-unit recruit cost: ×${(BARRACKS_COST_MUL[nation.barracksLevel] ?? 1).toFixed(2)}\nUpgrade to recruit larger armies in fewer clicks at a discount.`}
      >
        <div className="flex items-center gap-2" style={{ color: 'var(--ink-faded)' }}>
          <Hammer size={14} />
          <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Barracks · L{nation.barracksLevel}
          </span>
        </div>
        {upgradeCost !== null ? (
          <motion.button
            type="button"
            {...tapMotion}
            disabled={nation.gold < upgradeCost}
            onClick={upgradeBarracks}
            title={`Upgrade barracks to L${nation.barracksLevel + 1}: bulk-cap +, costs less per unit.`}
            style={{
              background:
                nation.gold >= upgradeCost ? 'var(--ink)' : 'transparent',
              color:
                nation.gold >= upgradeCost ? 'var(--paper)' : 'var(--ink-faded)',
              border: '1px solid var(--ink)',
              padding: '2px 8px',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              fontWeight: 600,
              cursor: nation.gold >= upgradeCost ? 'pointer' : 'not-allowed',
              opacity: nation.gold >= upgradeCost ? 1 : 0.5,
            }}
          >
            Upgrade ({upgradeCost}g)
          </motion.button>
        ) : (
          <span style={{ fontSize: 10, color: 'var(--ink-faded)', fontStyle: 'italic' }}>
            max level
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-faded)',
          marginTop: 6,
          marginBottom: 4,
        }}
      >
        Army · {fmtNum(total)} / {fmtNum(cap)} · batch ≤ {fmtNum(bulkCap)}
      </div>

      {(['infantry', 'cavalry', 'artillery'] as const).map((type) => {
        const cost = recruitCost(
          type,
          country.specializations,
          nation.unlockedTech,
          nation.barracksLevel,
        );
        const baseDisabled = total >= cap;
        const maxAffordable = Math.floor(nation.gold / cost);
        const maxBuy = Math.min(room, maxAffordable, bulkCap);

        return (
          <div
            key={type}
            style={{ padding: '4px 0', borderTop: '1px dashed transparent' }}
          >
            <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
              <div
                style={{
                  color: !baseDisabled ? 'var(--ink)' : 'var(--ink-faded)',
                  width: 16,
                }}
              >
                {TROOP_ICONS[type]}
              </div>
              <div style={{ flex: 1, fontSize: 12 }}>
                <span style={{ fontWeight: 500 }}>{TROOP_LABELS[type]}</span>
                <span className="num" style={{ marginLeft: 6, color: 'var(--ink-faded)' }}>
                  {fmtNum(nation[type])}
                </span>
              </div>
              <span
                className="num"
                style={{ fontSize: 10, color: 'var(--ink-faded)' }}
              >
                {cost}g/ea
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {quick.map((amount) => {
                const allowed = Math.min(amount, maxBuy);
                const can = allowed > 0 && !baseDisabled;
                return (
                  <motion.button
                    key={amount}
                    type="button"
                    {...tapMotion}
                    disabled={!can}
                    onClick={() => recruit(type, amount)}
                    title={`+${amount} for ${amount * cost}g`}
                    style={{
                      flex: 1,
                      background: can ? 'var(--paper)' : 'transparent',
                      color: can ? 'var(--ink)' : 'var(--ink-faded)',
                      border: `1px solid ${can ? 'var(--ink)' : 'var(--ink-faded)'}`,
                      padding: '3px 0',
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: can ? 'pointer' : 'not-allowed',
                      opacity: can ? 1 : 0.45,
                    }}
                  >
                    +{amount}
                  </motion.button>
                );
              })}
              <motion.button
                type="button"
                {...tapMotion}
                disabled={maxBuy <= 0}
                onClick={() => recruit(type, maxBuy)}
                title={`+${maxBuy} for ${maxBuy * cost}g (cap by gold/room/barracks)`}
                style={{
                  flex: 1.2,
                  background:
                    maxBuy > 0 ? 'var(--accent-gold)' : 'transparent',
                  color:
                    maxBuy > 0 ? 'var(--paper)' : 'var(--ink-faded)',
                  border: `1px solid ${maxBuy > 0 ? 'var(--accent-gold)' : 'var(--ink-faded)'}`,
                  padding: '3px 0',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: maxBuy > 0 ? 'pointer' : 'not-allowed',
                  opacity: maxBuy > 0 ? 1 : 0.45,
                  letterSpacing: '0.04em',
                }}
              >
                MAX {maxBuy > 0 ? `(${maxBuy})` : ''}
              </motion.button>
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        <motion.button
          type="button"
          {...tapMotion}
          disabled={nation.gold < techInvestmentCost()}
          onClick={invest}
          title="Invest gold for a slow, generic combat-strength bump."
          style={{
            flex: 1,
            background:
              nation.gold >= techInvestmentCost() ? 'var(--paper)' : 'transparent',
            color: nation.gold >= techInvestmentCost() ? 'var(--ink)' : 'var(--ink-faded)',
            border: '1px solid var(--ink)',
            padding: '6px',
            fontFamily: '"Crimson Pro", serif',
            fontSize: 12,
            cursor: nation.gold >= techInvestmentCost() ? 'pointer' : 'not-allowed',
            opacity: nation.gold >= techInvestmentCost() ? 1 : 0.5,
          }}
        >
          Invest +Tech ({techInvestmentCost()}g)
        </motion.button>
        <motion.button
          type="button"
          {...tapMotion}
          onClick={() => setTechPanelOpen(true)}
          title="Tech Tree — discrete unlocks across military / economy / logistics / diplomacy."
          style={{
            background: 'var(--accent-gold)',
            color: 'var(--paper)',
            border: '1px solid var(--accent-gold)',
            padding: '6px 10px',
            fontFamily: '"Crimson Pro", serif',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <BookOpen size={12} /> Tech
        </motion.button>
      </div>
      {nation.unlockedTech.length > 0 && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--ink-faded)',
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          {nation.unlockedTech.length} tech unlocked
          {nation.autoRecruit && ' · auto-recruit on'}
        </div>
      )}

      {country.specializations.length > 0 && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px dashed var(--ink-faded)',
            fontSize: 11,
            color: 'var(--ink-faded)',
            fontStyle: 'italic',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          {country.specializations.map((s) => (
            <span
              key={s}
              style={{
                color: 'var(--ink)',
                fontStyle: 'normal',
                padding: '1px 6px',
                border: '1px solid var(--ink-faded)',
                fontSize: 10,
                letterSpacing: '0.04em',
              }}
            >
              {SPEC_LABELS[s]}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}
