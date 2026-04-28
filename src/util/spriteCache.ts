/**
 * Sprite cache: lazy-checks if a PNG/JPG exists in /assets, caches the
 * answer, and lets components render <image> when present and fall back
 * to vector graphics otherwise.
 *
 * Used by WarMarkers, BattleAnimations, etc. Keeps everything optional.
 */
import { useEffect, useState } from 'react';

const known: Map<string, string | null> = new Map();
const inflight: Map<string, Promise<string | null>> = new Map();

function url(name: string): string {
  return `${import.meta.env.BASE_URL}assets/${name}`;
}

async function probe(name: string): Promise<string | null> {
  if (known.has(name)) return known.get(name)!;
  if (inflight.has(name)) return inflight.get(name)!;
  const u = url(name);
  const p = fetch(u, { method: 'GET' })
    .then((r) => {
      if (!r.ok) {
        known.set(name, null);
        return null;
      }
      known.set(name, u);
      return u;
    })
    .catch(() => {
      known.set(name, null);
      return null;
    })
    .finally(() => {
      inflight.delete(name);
    });
  inflight.set(name, p);
  return p;
}

/** Synchronously returns the cached URL (null = file missing or not yet
 *  probed). Pair with `useSprite` to trigger the probe + re-render. */
export function getSprite(name: string): string | null {
  const cached = known.get(name);
  return cached ?? null;
}

/** React hook: ensures the named asset is probed once, returns the URL or
 *  null if the file is absent. */
export function useSprite(name: string): string | null {
  const [, setNonce] = useState(0);
  useEffect(() => {
    if (known.has(name)) return;
    let cancelled = false;
    void probe(name).then(() => {
      if (!cancelled) setNonce((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);
  return known.get(name) ?? null;
}
