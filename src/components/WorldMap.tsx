import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { useGameStore } from '../store/gameStore';
import { countryFill } from '../game/world';
import MovementArrows from './MovementArrows';
import BattleFlashes from './BattleFlashes';

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

/** Blend a fill color with a stance tint. Returns the final color string. */
function blendStance(
  base: string,
  stance: 'war' | 'neutral' | 'allied' | 'self' | null,
): string {
  if (!stance || stance === 'neutral') return base;
  // base is hsl(h s% l%) — tweak via interpolation toward an accent.
  const target =
    stance === 'self'
      ? '#d4a936' // gold-ish
      : stance === 'war'
        ? '#a13838'
        : '#7d8e5f'; // sage-ish
  // Use CSS color-mix where supported; modern Chromium does. Fallback = base.
  return `color-mix(in srgb, ${base} 70%, ${target} 30%)`;
}

export default function WorldMap() {
  const geo = useGameStore((s) => s.geo);
  const ownership = useGameStore((s) => s.ownership);
  const nations = useGameStore((s) => s.nations);
  const playerId = useGameStore((s) => s.playerCountryId);
  const movements = useGameStore((s) => s.movements);
  const countries = useGameStore((s) => s.countries);
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

  // Pan/zoom once.
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });
    svg.call(zoom);
    return () => {
      svg.on('.zoom', null);
    };
  }, []);

  // Update fills when ownership or player stance changes.
  useEffect(() => {
    if (!gRef.current) return;
    const playerStance = playerId ? nations[playerId]?.stance ?? {} : {};
    const paths = gRef.current.querySelectorAll<SVGPathElement>('path.country');
    paths.forEach((el) => {
      const id = el.dataset.id ?? '';
      const owner = ownership[id] ?? id;
      const base = countryFill(owner);
      let stance: 'war' | 'neutral' | 'allied' | 'self' | null = null;
      if (playerId && owner === playerId) stance = 'self';
      else if (playerId && playerStance[owner]) stance = playerStance[owner];
      el.setAttribute('fill', blendStance(base, stance));
    });
  }, [ownership, nations, playerId]);

  // Update strokes when selection / hover changes.
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
        </defs>
        <g ref={gRef}>
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
          <MovementArrows
            projection={pathD.projection}
            movements={movements}
            countries={countries}
            playerId={playerId}
            playerStance={playerStance}
          />
          <BattleFlashes projection={pathD.projection} />
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
