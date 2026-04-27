import { Coins, Users, Sparkles } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { countryFill } from '../game/world';
import {
  maxTroops,
  recruitCost,
  techInvestmentCost,
} from '../game/economy';

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

export default function PlayerHUD() {
  const playerId = useGameStore((s) => s.playerCountryId);
  const country = useGameStore((s) =>
    s.playerCountryId ? s.countries[s.playerCountryId] : null,
  );
  const nation = useGameStore((s) =>
    s.playerCountryId ? s.nations[s.playerCountryId] : null,
  );
  const recruit = useGameStore((s) => s.recruitTroops);
  const invest = useGameStore((s) => s.investInTech);

  if (!playerId || !country || !nation) return null;

  const cap = maxTroops(country);
  const recruitCount = 10;
  const canRecruit =
    nation.gold >= recruitCount * recruitCost() && nation.troops < cap;
  const canInvest = nation.gold >= techInvestmentCost();

  return (
    <aside
      className="absolute z-30"
      style={{
        top: 64,
        left: 16,
        width: 280,
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

      <Stat
        icon={<Coins size={14} />}
        label="Gold"
        value={fmtNum(nation.gold)}
      />
      <Stat
        icon={<Users size={14} />}
        label="Troops"
        value={`${fmtNum(nation.troops)} / ${fmtNum(cap)}`}
      />
      <Stat
        icon={<Sparkles size={14} />}
        label="Tech"
        value={nation.tech.toFixed(2)}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <ActionButton
          label={`+${recruitCount} Troops`}
          sub={`${recruitCount * recruitCost()}g`}
          enabled={canRecruit}
          onClick={() => recruit(recruitCount)}
        />
        <ActionButton
          label="Invest Tech"
          sub={`${techInvestmentCost()}g`}
          enabled={canInvest}
          onClick={invest}
        />
      </div>
    </aside>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: '4px 0' }}
    >
      <div
        className="flex items-center gap-2"
        style={{ color: 'var(--ink-faded)' }}
      >
        {icon}
        <span
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>
      <span className="num" style={{ fontSize: 14 }}>
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  label,
  sub,
  enabled,
  onClick,
}: {
  label: string;
  sub: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      style={{
        flex: 1,
        background: enabled ? 'var(--paper)' : 'transparent',
        color: enabled ? 'var(--ink)' : 'var(--ink-faded)',
        border: '1px solid var(--ink)',
        padding: '8px 4px',
        fontFamily: '"Crimson Pro", serif',
        fontSize: 13,
        cursor: enabled ? 'pointer' : 'not-allowed',
        opacity: enabled ? 1 : 0.5,
        transition: 'background 150ms ease',
        lineHeight: 1.1,
      }}
    >
      <div>{label}</div>
      <div
        className="num"
        style={{ fontSize: 10, marginTop: 2, color: 'var(--ink-faded)' }}
      >
        {sub}
      </div>
    </button>
  );
}
