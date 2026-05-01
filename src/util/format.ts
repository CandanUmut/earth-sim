/**
 * Display formatters. Internal numbers stay raw; these only change how
 * things READ to the player. The K-suffix on troop counts is intentional
 * narrative scaling — "240 troops" reads like a village levy, "240K"
 * reads like an army.
 */

/** Troop count → "240K" / "1.5M". Always K-or-bigger. */
export function fmtTroops(n: number): string {
  const r = Math.max(0, Math.round(n));
  if (r >= 1000) {
    const m = r / 1000;
    return m >= 100 ? `${Math.round(m)}M` : `${m.toFixed(1)}M`;
  }
  return `${r}K`;
}

/** Troop count short — used in tight HUD spots. Same shape, no decimal trick. */
export function fmtTroopsTight(n: number): string {
  const r = Math.max(0, Math.round(n));
  if (r >= 1000) return `${(r / 1000).toFixed(0)}M`;
  return `${r}K`;
}

/** Gold display — same scaling for visual consistency. */
export function fmtGold(n: number): string {
  const r = Math.max(0, Math.round(n));
  if (r >= 1_000_000) return `${(r / 1_000_000).toFixed(1)}M`;
  if (r >= 10_000) return `${(r / 1_000).toFixed(1)}K`;
  return r.toLocaleString();
}

/** Population display — humanized. */
export function fmtPop(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}
