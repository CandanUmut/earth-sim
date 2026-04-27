import { ScrollText, ChevronDown, ChevronUp } from 'lucide-react';
import { useGameStore } from '../store/gameStore';

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

export default function BattleLog() {
  const battles = useGameStore((s) => s.battleLog);
  const open = useGameStore((s) => s.battleLogOpen);
  const toggle = useGameStore((s) => s.toggleBattleLog);
  const countries = useGameStore((s) => s.countries);
  const playerId = useGameStore((s) => s.playerCountryId);
  const gameStarted = useGameStore((s) => s.gameStarted);

  if (!gameStarted) return null;

  return (
    <aside
      className="absolute z-30"
      style={{
        right: 16,
        bottom: 16,
        width: open ? 340 : 'auto',
        background: 'var(--paper)',
        border: '1px solid var(--ink)',
        boxShadow: '0 4px 14px var(--paper-shadow), 0 1px 2px var(--paper-shadow)',
      }}
    >
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-2 w-full"
        style={{
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          borderBottom: open ? '1px solid var(--ink-faded)' : 'none',
          cursor: 'pointer',
          fontFamily: '"Crimson Pro", serif',
          fontSize: 14,
          fontStyle: 'italic',
          color: 'var(--ink)',
          textAlign: 'left',
        }}
      >
        <ScrollText size={14} style={{ color: 'var(--ink-faded)' }} />
        <span style={{ flex: 1 }}>
          Chronicle of Wars
          {battles.length > 0 && (
            <span
              className="num"
              style={{ color: 'var(--ink-faded)', marginLeft: 6, fontSize: 12 }}
            >
              ({battles.length})
            </span>
          )}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {open && (
        <div
          style={{
            maxHeight: 360,
            overflowY: 'auto',
            padding: '6px 4px',
          }}
        >
          {battles.length === 0 ? (
            <div
              style={{
                padding: 16,
                fontStyle: 'italic',
                color: 'var(--ink-faded)',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              No engagements yet.
            </div>
          ) : (
            battles.map((b) => {
              const place = countries[b.countryId]?.name ?? b.countryId;
              const attacker =
                countries[b.attackerOwnerId]?.name ?? b.attackerOwnerId;
              const defender =
                countries[b.defenderOwnerId]?.name ?? b.defenderOwnerId;
              const playerInvolved =
                playerId &&
                (b.attackerOwnerId === playerId ||
                  b.defenderOwnerId === playerId);
              const accent = b.conquered
                ? 'var(--accent-blood)'
                : b.attackerWon
                  ? '#c97a1f'
                  : 'var(--accent-sage)';
              const verdict = b.conquered
                ? '— CAPTURED'
                : b.attackerWon
                  ? `— pushed in (control ${b.controlAfter})`
                  : '— repelled by';
              return (
                <div
                  key={b.id}
                  style={{
                    padding: '8px 10px',
                    borderLeft: `2px solid ${accent}`,
                    margin: '4px 6px',
                    background: playerInvolved
                      ? 'rgba(184, 134, 11, 0.06)'
                      : 'transparent',
                  }}
                >
                  <div style={{ fontSize: 13, lineHeight: 1.3 }}>
                    <strong>{attacker}</strong> →{' '}
                    <span style={{ fontStyle: 'italic' }}>{place}</span>{' '}
                    <span
                      style={{
                        color: accent,
                        fontWeight: b.conquered ? 600 : 400,
                      }}
                    >
                      {verdict}
                    </span>{' '}
                    {!b.attackerWon && <strong>{defender}</strong>}
                  </div>
                  <div
                    className="num"
                    style={{
                      fontSize: 11,
                      color: 'var(--ink-faded)',
                      marginTop: 2,
                    }}
                  >
                    Atk losses {fmtNum(b.attackerLosses)} · Def losses{' '}
                    {fmtNum(b.defenderLosses)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
}
