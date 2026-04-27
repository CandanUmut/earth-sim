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
  type Stance,
} from '../game/economy';
import {
  runTick,
  type GameDate,
  type BattleLogEntry,
  type ArrivalEvent,
} from '../game/tick';
import {
  newBrain,
  evaluateAllianceProposal,
  evaluatePeaceProposal,
  type AIBrain,
} from '../game/ai';
import {
  findPath,
  newMovementId,
  type TroopMovement,
} from '../game/movement';
import { type VictoryState } from '../game/victory';
import { BALANCE, BALANCE_MOVEMENT, BALANCE_CONTROL } from '../game/balance';

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
  brains: Record<string, AIBrain>;
  control: Record<string, number>;
  lastBattleTick: Record<string, number>;
  movements: TroopMovement[];
  battleLog: BattleLogEntry[];
  arrivalTrails: ArrivalEvent[];
  date: GameDate;
  tickCount: number;

  // Player & controls
  playerCountryId: string | null;
  homeCountryId: string | null;
  paused: boolean;
  speed: Speed;
  gameStarted: boolean;
  victory: VictoryState;

  // UI state
  selectedCountryId: string | null;
  hoveredCountryId: string | null;
  battleLogOpen: boolean;
  dispatchTargetId: string | null;

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
  openDispatch: (toId: string) => void;
  closeDispatch: () => void;
  dispatchTroops: (toId: string, troops: number) => void;
  declareWar: (targetId: string) => void;
  proposePeace: (targetId: string) => void;
  proposeAlliance: (targetId: string) => void;
  sendGift: (targetId: string, gold: number) => void;
  toggleBattleLog: () => void;
  dismissEndScreen: () => void;
  newCampaign: () => void;
  pruneTrails: () => void;
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
  const { paused, gameStarted, victory, tick } = get();
  if (paused || !gameStarted || victory.kind !== 'ongoing') return;
  const ms = BALANCE.msPerTickAt1x / get().speed;
  tickIntervalId = setInterval(tick, ms);
}

function setMutualStance(
  nations: Record<string, Nation>,
  a: string,
  b: string,
  stance: Stance,
): Record<string, Nation> {
  const next = { ...nations };
  const na = next[a];
  const nb = next[b];
  if (na) next[a] = { ...na, stance: { ...na.stance, [b]: stance } };
  if (nb) next[b] = { ...nb, stance: { ...nb.stance, [a]: stance } };
  return next;
}

const initialState = {
  loaded: false,
  loading: false,
  error: null as string | null,
  countries: {} as Record<string, Country>,
  countryOrder: [] as string[],
  geo: null as FeatureCollection | null,
  ownership: {} as Record<string, string>,
  nations: {} as Record<string, Nation>,
  brains: {} as Record<string, AIBrain>,
  control: {} as Record<string, number>,
  lastBattleTick: {} as Record<string, number>,
  movements: [] as TroopMovement[],
  battleLog: [] as BattleLogEntry[],
  arrivalTrails: [] as ArrivalEvent[],
  date: { year: 1900, month: 0 } as GameDate,
  tickCount: 0,
  playerCountryId: null as string | null,
  homeCountryId: null as string | null,
  paused: true,
  speed: 1 as Speed,
  gameStarted: false,
  victory: { kind: 'ongoing' as const } as VictoryState,
  selectedCountryId: null as string | null,
  hoveredCountryId: null as string | null,
  battleLogOpen: false,
  dispatchTargetId: null as string | null,
};

export const useGameStore = create<GameState>((set, get) => ({
  ...initialState,

  loadInitialWorld: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true, error: null });
    try {
      const { countries, geo } = await loadWorld();
      const byId: Record<string, Country> = {};
      const ownership: Record<string, string> = {};
      const nations: Record<string, Nation> = {};
      const brains: Record<string, AIBrain> = {};
      const control: Record<string, number> = {};
      const order: string[] = [];
      for (const c of countries) {
        byId[c.id] = c;
        ownership[c.id] = c.id;
        nations[c.id] = makeStartingNation(c);
        brains[c.id] = newBrain();
        control[c.id] = BALANCE_CONTROL.fullControl;
        order.push(c.id);
      }
      set({
        countries: byId,
        countryOrder: order,
        ownership,
        nations,
        brains,
        control,
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
      homeCountryId: playerId,
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
    const cap = maxTroops(country);
    const allowed = Math.min(amount, cap - nation.troops);
    if (allowed <= 0) return;
    const realCost = allowed * recruitCost();
    if (nation.gold < realCost) return;
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
    const s = get();
    const result = runTick({
      date: s.date,
      tickCount: s.tickCount + 1,
      countries: s.countries,
      ownership: s.ownership,
      nations: s.nations,
      brains: s.brains,
      control: s.control,
      lastBattleTick: s.lastBattleTick,
      movements: s.movements,
      playerCountryId: s.playerCountryId,
      homeCountryId: s.homeCountryId,
      rng: Math.random,
    });

    const now = performance.now();
    const trails = [
      ...s.arrivalTrails,
      ...result.newArrivals,
    ].filter((t) => now - t.arrivedAt < BALANCE_MOVEMENT.arrivalTrailMs);

    const battleLog = [...result.newBattles, ...s.battleLog].slice(0, 20);

    set({
      date: result.date,
      tickCount: s.tickCount + 1,
      ownership: result.ownership,
      nations: result.nations,
      brains: result.brains,
      control: result.control,
      lastBattleTick: result.lastBattleTick,
      movements: result.movements,
      battleLog,
      arrivalTrails: trails,
      victory: result.victory,
    });

    if (result.victory.kind !== 'ongoing') {
      clearTickInterval();
    }
  },

  openDispatch: (toId) => set({ dispatchTargetId: toId }),
  closeDispatch: () => set({ dispatchTargetId: null }),

  dispatchTroops: (toId, troops) => {
    const {
      playerCountryId,
      countries,
      nations,
      ownership,
      movements,
      tickCount,
    } = get();
    if (!playerCountryId) return;
    const player = nations[playerCountryId];
    if (!player) return;
    const myIds = Object.entries(ownership)
      .filter(([, owner]) => owner === playerCountryId)
      .map(([tid]) => tid);
    let bestPath: string[] | null = null;
    let bestFromId: string | null = null;
    for (const myId of myIds) {
      const p = findPath(countries, myId, toId);
      if (p && (!bestPath || p.length < bestPath.length)) {
        bestPath = p;
        bestFromId = myId;
      }
    }
    if (!bestPath || !bestFromId) return;
    const garrison = Math.floor(
      player.troops * BALANCE_MOVEMENT.homeGarrisonFraction,
    );
    const available = player.troops - garrison;
    const send = Math.min(troops, Math.max(0, available));
    if (send <= 0) return;
    const newMv: TroopMovement = {
      id: newMovementId(),
      ownerId: playerCountryId,
      fromId: bestFromId,
      toId,
      troops: send,
      path: bestPath,
      pathIndex: 0,
      launchTick: tickCount,
    };
    set({
      nations: {
        ...nations,
        [playerCountryId]: { ...player, troops: player.troops - send },
      },
      movements: [...movements, newMv],
      dispatchTargetId: null,
    });
  },

  declareWar: (targetId) => {
    const { playerCountryId, nations } = get();
    if (!playerCountryId || playerCountryId === targetId) return;
    set({ nations: setMutualStance(nations, playerCountryId, targetId, 'war') });
  },

  proposePeace: (targetId) => {
    const { playerCountryId, nations, brains } = get();
    if (!playerCountryId || playerCountryId === targetId) return;
    const targetBrain = brains[targetId];
    if (!targetBrain) return;
    const accepted = evaluatePeaceProposal({
      proposerId: playerCountryId,
      targetId,
      nations,
      brain: targetBrain,
    });
    if (accepted) {
      set({
        nations: setMutualStance(nations, playerCountryId, targetId, 'neutral'),
      });
    }
  },

  proposeAlliance: (targetId) => {
    const { playerCountryId, nations, brains } = get();
    if (!playerCountryId || playerCountryId === targetId) return;
    const targetBrain = brains[targetId];
    if (!targetBrain) return;
    const accepted = evaluateAllianceProposal({
      proposerId: playerCountryId,
      targetId,
      nations,
      brain: targetBrain,
    });
    if (accepted) {
      set({
        nations: setMutualStance(nations, playerCountryId, targetId, 'allied'),
      });
    }
  },

  sendGift: (targetId, gold) => {
    const { playerCountryId, nations } = get();
    if (!playerCountryId) return;
    const player = nations[playerCountryId];
    const target = nations[targetId];
    if (!player || !target) return;
    if (player.gold < gold) return;
    set({
      nations: {
        ...nations,
        [playerCountryId]: { ...player, gold: player.gold - gold },
        [targetId]: { ...target, gold: target.gold + gold },
      },
    });
  },

  toggleBattleLog: () => set({ battleLogOpen: !get().battleLogOpen }),

  dismissEndScreen: () => {
    set({ victory: { kind: 'ongoing' } });
  },

  newCampaign: () => {
    clearTickInterval();
    const { countries, countryOrder, geo } = get();
    const ownership: Record<string, string> = {};
    const nations: Record<string, Nation> = {};
    const brains: Record<string, AIBrain> = {};
    const control: Record<string, number> = {};
    for (const id of countryOrder) {
      const c = countries[id];
      if (!c) continue;
      ownership[id] = id;
      nations[id] = makeStartingNation(c);
      brains[id] = newBrain();
      control[id] = BALANCE_CONTROL.fullControl;
    }
    set({
      ...initialState,
      countries,
      countryOrder,
      geo,
      ownership,
      nations,
      brains,
      control,
      loaded: true,
    });
  },

  pruneTrails: () => {
    const now = performance.now();
    set({
      arrivalTrails: get().arrivalTrails.filter(
        (t) => now - t.arrivedAt < BALANCE_MOVEMENT.arrivalTrailMs,
      ),
    });
  },
}));

if (import.meta.hot) {
  import.meta.hot.dispose(() => clearTickInterval());
}
