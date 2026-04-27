import { Coins, Sparkles, Shield, Wind, Crosshair } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { countryFill, SPEC_LABELS } from '../game/world';
import {
  maxTroops,
  recruitCost,
  techInvestmentCost,
  totalTroops,
  TROOP_LABELS,
  type TroopType,
} from '../game/economy';

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

  if (!playerId || !country || !nation) return null;

  const cap = maxTroops(country);
  const total = totalTroops(nation);

  return (
    <aside
      className="absolute z-30"
      style={{
        top: 64,
        left: 16,
        width: 290,
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
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--ink-faded)',
          marginTop: 6,
          marginBottom: 4,
        }}
      >
        Army · {fmtNum(total)} / {fmtNum(cap)}
      </div>

      {(['infantry', 'cavalry', 'artillery'] as const).map((type) => {
        const cost = recruitCost(type, country.specializations);
        const canRecruit = nation.gold >= cost && total < cap;
        return (
          <div
            key={type}
            className="flex items-center gap-2"
            style={{ padding: '3px 0' }}
          >
            <div
              style={{
                color: canRecruit ? 'var(--ink)' : 'var(--ink-faded)',
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
            <button
              type="button"
              disabled={!canRecruit}
              onClick={() => recruit(type, 5)}
              title={`+5 ${TROOP_LABELS[type]} for ${5 * cost}g`}
              style={{
                background: canRecruit ? 'var(--paper)' : 'transparent',
                color: canRecruit ? 'var(--ink)' : 'var(--ink-faded)',
                border: `1px solid ${canRecruit ? 'var(--ink)' : 'var(--ink-faded)'}`,
                padding: '3px 8px',
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                fontWeight: 600,
                cursor: canRecruit ? 'pointer' : 'not-allowed',
                opacity: canRecruit ? 1 : 0.5,
              }}
            >
              +5 ({cost * 5}g)
            </button>
          </div>
        );
      })}

      <button
        type="button"
        disabled={nation.gold < techInvestmentCost()}
        onClick={invest}
        style={{
          width: '100%',
          marginTop: 10,
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
        Invest in Tech ({techInvestmentCost()}g)
      </button>

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
