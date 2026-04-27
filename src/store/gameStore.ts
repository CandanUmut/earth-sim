import { create } from 'zustand';
import type { FeatureCollection } from 'geojson';
import { loadWorld, type Country } from '../game/world';

export type GameState = {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  countries: Record<string, Country>;
  countryOrder: string[];
  geo: FeatureCollection | null;
  ownership: Record<string, string>; // countryId -> owner countryId
  selectedCountryId: string | null;
  hoveredCountryId: string | null;

  loadInitialWorld: () => Promise<void>;
  setSelected: (id: string | null) => void;
  setHovered: (id: string | null) => void;
};

export const useGameStore = create<GameState>((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  countries: {},
  countryOrder: [],
  geo: null,
  ownership: {},
  selectedCountryId: null,
  hoveredCountryId: null,

  loadInitialWorld: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const { countries, geo } = await loadWorld();
      const byId: Record<string, Country> = {};
      const ownership: Record<string, string> = {};
      const order: string[] = [];
      for (const c of countries) {
        byId[c.id] = c;
        ownership[c.id] = c.id;
        order.push(c.id);
      }
      set({
        countries: byId,
        countryOrder: order,
        ownership,
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
}));
