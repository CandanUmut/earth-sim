import { create } from 'zustand';
import type { FeatureCollection } from 'geojson';
import { loadWorld, type Country } from '../game/world';
import {
  makeStartingNation,
  recruitCost,
  techInvestmentCost,
  techIncrement,
  maxTroops,
  type Nation,
} from '../game/economy';
import { runTick, type GameDate } from '../game/tick';
import { BALANCE } from '../game/balance';

export type Speed = 1 | 2 | 3;

export type GameState = {
  // World data
  loaded: boolean;
  loading: boolean;
  error: string | null;
  countries: Record<string, Country>;
  countryOrder: string[];
  geo: FeatureCollection | null;

  // Live state
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  date: GameDate;

  // Player & controls
  playerCountryId: string | null;
  paused: boolean;
  speed: Speed;
  gameStarted: boolean;

  // UI
  selectedCountryId: string | null;
  hoveredCountryId: string | null;

  // Actions
  loadInitialWorld: () => Promise<void>;
  setSelected: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  startCampaign: (playerId: string) => void;
  setPaused: (paused: boolean) => void;
  togglePaused: () => void;
  setSpeed: (speed: Speed) => void;
  recruitTroops: (amount: number) => void;
  investInTech: () => void;
  tick: () => void;
};

let tickIntervalId: ReturnType<typeof setInterval> | null = null;

function clearTickInterval() {
  if (tickIntervalId !== null) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
}

function ensureTickInterval(get: () => GameState) {
  clearTickInterval();
  const { paused, speed, gameStarted, tick } = get();
  if (paused || !gameStarted) return;
  const ms = BALANCE.msPerTickAt1x / speed;
  tickIntervalId = setInterval(tick, ms);
}

export const useGameStore = create<GameState>((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  countries: {},
  countryOrder: [],
  geo: null,
  ownership: {},
  nations: {},
  date: { year: 1900, month: 0 },
  playerCountryId: null,
  paused: true,
  speed: 1,
  gameStarted: false,
  selectedCountryId: null,
  hoveredCountryId: null,

  loadInitialWorld: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const { countries, geo } = await loadWorld();
      const byId: Record<string, Country> = {};
      const ownership: Record<string, string> = {};
      const nations: Record<string, Nation> = {};
      const order: string[] = [];
      for (const c of countries) {
        byId[c.id] = c;
        ownership[c.id] = c.id;
        nations[c.id] = makeStartingNation(c);
        order.push(c.id);
      }
      set({
        countries: byId,
        countryOrder: order,
        ownership,
        nations,
        geo,
        loaded: true,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load world',
        loading: false,
      });
    }
  },

  setSelected: (id) => set({ selectedCountryId: id }),
  setHovered: (id) => set({ hoveredCountryId: id }),

  startCampaign: (playerId) => {
    const { nations, countries } = get();
    const baseline = nations[playerId];
    const country = countries[playerId];
    if (!baseline || !country) return;
    const buffed: Nation = {
      ...baseline,
      gold: baseline.gold * BALANCE.playerGoldMultiplier,
      troops: Math.min(
        maxTroops(country),
        Math.round(baseline.troops * BALANCE.playerTroopMultiplier),
      ),
    };
    set({
      playerCountryId: playerId,
      nations: { ...nations, [playerId]: buffed },
      gameStarted: true,
      paused: false,
      selectedCountryId: null,
    });
    ensureTickInterval(get);
  },

  setPaused: (paused) => {
    set({ paused });
    ensureTickInterval(get);
  },

  togglePaused: () => {
    set({ paused: !get().paused });
    ensureTickInterval(get);
  },

  setSpeed: (speed) => {
    set({ speed });
    ensureTickInterval(get);
  },

  recruitTroops: (amount) => {
    const { playerCountryId, nations, countries } = get();
    if (!playerCountryId) return;
    const nation = nations[playerCountryId];
    const country = countries[playerCountryId];
    if (!nation || !country) return;

    const cost = amount * recruitCost();
    if (nation.gold < cost) return;
    const cap = maxTroops(country);
    const allowed = Math.min(amount, cap - nation.troops);
    if (allowed <= 0) return;
    const realCost = allowed * recruitCost();
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...nation,
          gold: nation.gold - realCost,
          troops: nation.troops + allowed,
        },
      },
    });
  },

  investInTech: () => {
    const { playerCountryId, nations } = get();
    if (!playerCountryId) return;
    const nation = nations[playerCountryId];
    if (!nation) return;
    const cost = techInvestmentCost();
    if (nation.gold < cost) return;
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...nation,
          gold: nation.gold - cost,
          tech: nation.tech + techIncrement(nation.tech),
        },
      },
    });
  },

  tick: () => {
    const { date, countries, ownership, nations } = get();
    const result = runTick({ date, countries, ownership, nations });
    set({ date: result.date, nations: result.nations });
  },
}));

// Stop the tick on hot-reload to avoid duplicates.
if (import.meta.hot) {
  import.meta.hot.dispose(() => clearTickInterval());
}
