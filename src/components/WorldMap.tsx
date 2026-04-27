import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { useGameStore } from '../store/gameStore';
import { countryFill } from '../game/world';
import MovementArrows from './MovementArrows';
import BattleFlashes from './BattleFlashes';
import CountryAnnotations from './CountryAnnotations';

type Size = { w: number; h: number };

function useWindowSize(): Size {
  const [size, setSize] = useState<Size>(() => ({
    w: typeof window === 'undefined' ? 1280 : window.innerWidth,
    h: typeof window === 'undefined' ? 800 : window.innerHeight,
  }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

type StanceClass = 'war' | 'neutral' | 'allied' | 'self' | null;

function blendStance(base: string, stance: StanceClass): string {
  if (!stance || stance === 'neutral') return base;
  const target =
    stance === 'self'
      ? '#d4a936'
      : stance === 'war'
        ? '#a13838'
        : '#7d8e5f';
  return `color-mix(in srgb, ${base} 70%, ${target} 30%)`;
}

export default function WorldMap() {
  const geo = useGameStore((s) => s.geo);
  const ownership = useGameStore((s) => s.ownership);
  const nations = useGameStore((s) => s.nations);
  const playerId = useGameStore((s) => s.playerCountryId);
  const movements = useGameStore((s) => s.movements);
  const arrivalTrails = useGameStore((s) => s.arrivalTrails);
  const countries = useGameStore((s) => s.countries);
  const control = useGameStore((s) => s.control);
  const contestedBy = useGameStore((s) => s.contestedBy);
  const setSelected = useGameStore((s) => s.setSelected);
  const setHovered = useGameStore((s) => s.setHovered);
  const selectedId = useGameStore((s) => s.selectedCountryId);
  const hoveredId = useGameStore((s) => s.hoveredCountryId);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const { w, h } = useWindowSize();

  const pathD = useMemo(() => {
    if (!geo) return null;
    const projection = d3.geoMercator().fitSize([w, h], geo as FeatureCollection);
    const path = d3.geoPath(projection);
    return { projection, path };
  }, [geo, w, h]);

  // Pan/zoom binding. Re-bind when viewport size changes so extents stay
  // sane. Wheel events on Windows trackpads emit huge deltaY values; we
  // explicitly normalize to keep zoom step predictable.
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svgEl = svgRef.current;
    const sel = d3.select(svgEl);
    const gSel = d3.select(gRef.current);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 12])
      .extent([
        [0, 0],
        [w, h],
      ])
      .filter((event) => {
        // Allow wheel always (no ctrl required); allow primary mouse drag.
        if (event.type === 'wheel') return true;
        if (event.type === 'mousedown' || event.type === 'pointerdown')
          return event.button === 0;
        return !event.ctrlKey && !event.button;
      })
      .wheelDelta((event: WheelEvent) => {
        // d3's default normalizes by deltaMode; this is the recommended pattern.
        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
      })
      .on('zoom', (event) => {
        gSel.attr('transform', event.transform.toString());
      });
    sel.call(zoom);
    // Cursor feedback so users know it's grabbable.
    svgEl.style.cursor = 'grab';
    sel.on('mousedown.cursor', () => {
      svgEl.style.cursor = 'grabbing';
    });
    sel.on('mouseup.cursor', () => {
      svgEl.style.cursor = 'grab';
    });
    return () => {
      sel.on('.zoom', null);
      sel.on('mousedown.cursor', null);
      sel.on('mouseup.cursor', null);
    };
  }, [w, h]);

  // Per-country fill + stripe overlay updates on ownership / stance / player change.
  useEffect(() => {
    if (!gRef.current) return;
    const playerStance = playerId ? nations[playerId]?.stance ?? {} : {};
    const paths = gRef.current.querySelectorAll<SVGPathElement>('path.country');
    paths.forEach((el) => {
      const id = el.dataset.id ?? '';
      const owner = ownership[id] ?? id;
      const base = countryFill(owner);
      let stance: StanceClass = null;
      if (playerId && owner === playerId) stance = 'self';
      else if (playerId && playerStance[owner]) stance = playerStance[owner];
      const stanceTinted = blendStance(base, stance);

      // If contested, blend toward the attacker's color proportional to loss.
      const attackerId = contestedBy[id];
      const ctrl = control[id] ?? 100;
      if (attackerId && ctrl < 100) {
        const attackerBase = countryFill(attackerId);
        const lostFrac = Math.max(0, Math.min(1, (100 - ctrl) / 100));
        // Use color-mix for the gradient blend toward attacker's color.
        const pct = Math.round(lostFrac * 60); // up to 60 % toward attacker before fall
        el.setAttribute(
          'fill',
          `color-mix(in srgb, ${stanceTinted} ${100 - pct}%, ${attackerBase} ${pct}%)`,
        );
      } else {
        el.setAttribute('fill', stanceTinted);
      }
    });
    // Stripe overlays
    const stripes = gRef.current.querySelectorAll<SVGPathElement>(
      'path.country-stripe',
    );
    stripes.forEach((el) => {
      const id = el.dataset.id ?? '';
      const owner = ownership[id] ?? id;
      let pattern: string | null = null;
      if (playerId && owner !== playerId && playerStance[owner] === 'war') {
        pattern = 'url(#stripe-war)';
      } else if (
        playerId &&
        owner !== playerId &&
        playerStance[owner] === 'allied'
      ) {
        pattern = 'url(#stripe-allied)';
      }
      if (pattern) {
        el.setAttribute('fill', pattern);
        el.setAttribute('opacity', '0.5');
      } else {
        el.setAttribute('fill', 'transparent');
        el.setAttribute('opacity', '0');
      }
    });
  }, [ownership, nations, playerId, control, contestedBy]);

  useEffect(() => {
    if (!gRef.current) return;
    const paths = gRef.current.querySelectorAll<SVGPathElement>('path.country');
    paths.forEach((el) => {
      const id = el.dataset.id ?? '';
      const isSelected = id === selectedId;
      const isHovered = id === hoveredId;
      el.setAttribute(
        'stroke',
        isSelected ? 'var(--accent-gold)' : 'var(--ink)',
      );
      el.setAttribute(
        'stroke-width',
        String(isSelected ? 1.6 : isHovered ? 1.2 : 0.5),
      );
      el.setAttribute(
        'stroke-opacity',
        String(isSelected || isHovered ? 0.95 : 0.55),
      );
    });
  }, [selectedId, hoveredId]);

  if (!geo || !pathD) {
    return (
      <div className="absolute inset-0 grid place-items-center text-ink-faded italic">
        Drawing the world…
      </div>
    );
  }

  const features = (geo as FeatureCollection).features as Array<
    Feature<Geometry, { id?: string }>
  >;
  const playerStance = playerId ? nations[playerId]?.stance ?? null : null;

  return (
    <>
      <svg
        ref={svgRef}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0 select-none"
        style={{ background: 'var(--paper)' }}
      >
        <defs>
          <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
            <stop offset="60%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(26,24,20,0.18)" />
          </radialGradient>
          <pattern
            id="stripe-war"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent-blood)" strokeWidth="1.3" />
          </pattern>
          <pattern
            id="stripe-allied"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent-sage)" strokeWidth="1.3" />
          </pattern>
        </defs>
        <g ref={gRef}>
          {/* Base country fills */}
          {features.map((f) => {
            const id = (f as { id?: string }).id ?? '';
            const d = pathD.path(f) ?? '';
            return (
              <path
                key={id}
                className="country"
                d={d}
                data-id={id}
                fill={countryFill(id)}
                stroke="var(--ink)"
                strokeWidth={0.5}
                strokeOpacity={0.55}
                vectorEffect="non-scaling-stroke"
                style={{
                  cursor: 'pointer',
                  transition: 'fill 800ms ease, stroke-width 200ms ease',
                }}
                onMouseEnter={(e) => {
                  setHovered(id);
                  const props = (f.properties ?? {}) as Record<string, unknown>;
                  const name = (props.ADMIN as string) || (props.NAME as string) || id;
                  if (tooltipRef.current) {
                    tooltipRef.current.style.opacity = '1';
                    tooltipRef.current.textContent = name;
                    tooltipRef.current.style.left = `${e.clientX + 14}px`;
                    tooltipRef.current.style.top = `${e.clientY + 14}px`;
                  }
                }}
                onMouseMove={(e) => {
                  if (tooltipRef.current) {
                    tooltipRef.current.style.left = `${e.clientX + 14}px`;
                    tooltipRef.current.style.top = `${e.clientY + 14}px`;
                  }
                }}
                onMouseLeave={() => {
                  setHovered(null);
                  if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(id);
                }}
              />
            );
          })}
          {/* Stance stripe overlays — same path, no events */}
          {features.map((f) => {
            const id = (f as { id?: string }).id ?? '';
            const d = pathD.path(f) ?? '';
            return (
              <path
                key={`stripe-${id}`}
                className="country-stripe"
                d={d}
                data-id={id}
                fill="transparent"
                opacity={0}
                pointerEvents="none"
                vectorEffect="non-scaling-stroke"
                style={{ transition: 'opacity 600ms ease' }}
              />
            );
          })}
          <MovementArrows
            projection={pathD.projection}
            movements={movements}
            trails={arrivalTrails}
            countries={countries}
            playerId={playerId}
            playerStance={playerStance}
          />
          <BattleFlashes projection={pathD.projection} />
          <CountryAnnotations projection={pathD.projection} />
        </g>
        <rect
          width={w}
          height={h}
          fill="url(#vignette)"
          pointerEvents="none"
        />
      </svg>
      <div
        ref={tooltipRef}
        className="display"
        style={{
          position: 'fixed',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 120ms ease',
          background: 'var(--paper)',
          color: 'var(--ink)',
          border: '1px solid var(--ink)',
          padding: '4px 10px',
          fontSize: 14,
          fontStyle: 'italic',
          boxShadow: '0 1px 4px var(--paper-shadow)',
          zIndex: 50,
          whiteSpace: 'nowrap',
        }}
      />
    </>
  );
}
