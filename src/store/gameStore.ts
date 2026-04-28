import { create } from 'zustand';
import type { FeatureCollection } from 'geojson';
import { loadWorld, type Country } from '../game/world';
import {
  makeStartingNation,
  recruitCost,
  techInvestmentCost,
  techIncrement,
  maxTroops,
  totalTroops,
  barracksUpgradeCost,
  barracksBulkCap,
  type Nation,
  type Stance,
  type TroopType,
  type Composition,
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
  TECH_NODES,
  isUnlockable,
  navalCostUnit,
  statecraftMultiplier,
  type TechNodeId,
} from '../game/techTree';
import {
  findPath,
  newMovementId,
  type TroopMovement,
} from '../game/movement';
import { type VictoryState } from '../game/victory';
import { BALANCE, BALANCE_MOVEMENT, BALANCE_CONTROL } from '../game/balance';
import {
  writeSave,
  readSave,
  clearSave,
  summarizeSave,
  type SaveSummary,
} from './persistence';
import { play as playSound } from '../sound/sound';

export type Speed = 1 | 2 | 3;

export type BattleAnimation = {
  id: string;
  attackerOwnerId: string;
  defenderOwnerId: string;
  countryId: string;
  attackerTroopsBefore: number;
  defenderTroopsBefore: number;
  totalAttackerLosses: number;
  totalDefenderLosses: number;
  attackerWon: boolean;
  conquered: boolean;
  startedAt: number;
};

export const BATTLE_ANIM_MS = 2500;

export type GameState = {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  countries: Record<string, Country>;
  countryOrder: string[];
  geo: FeatureCollection | null;

  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  brains: Record<string, AIBrain>;
  control: Record<string, number>;
  contestedBy: Record<string, string>;
  lastBattleTick: Record<string, number>;
  movements: TroopMovement[];
  battleLog: BattleLogEntry[];
  battleAnimations: BattleAnimation[];
  arrivalTrails: ArrivalEvent[];
  populations: Record<string, number>;
  date: GameDate;
  tickCount: number;

  playerCountryId: string | null;
  homeCountryId: string | null;
  paused: boolean;
  speed: Speed;
  gameStarted: boolean;
  victory: VictoryState;

  selectedCountryId: string | null;
  hoveredCountryId: string | null;
  battleLogOpen: boolean;
  dispatchTargetId: string | null;
  savedSummary: SaveSummary | null;
  techPanelOpen: boolean;

  loadInitialWorld: () => Promise<void>;
  setSelected: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  startCampaign: (playerId: string) => void;
  setPaused: (paused: boolean) => void;
  togglePaused: () => void;
  setSpeed: (speed: Speed) => void;
  recruit: (type: TroopType, amount: number) => void;
  upgradeBarracks: () => void;
  investInTech: () => void;
  tick: () => void;
  openDispatch: (toId: string) => void;
  closeDispatch: () => void;
  dispatchTroops: (toId: string, composition: Composition) => void;
  declareWar: (targetId: string) => void;
  proposePeace: (targetId: string) => void;
  proposeAlliance: (targetId: string) => void;
  sendGift: (targetId: string, gold: number) => void;
  toggleBattleLog: () => void;
  dismissEndScreen: () => void;
  newCampaign: () => void;
  researchTech: (id: TechNodeId) => void;
  toggleAutoRecruit: () => void;
  setTechPanelOpen: (open: boolean) => void;
  pruneTrails: () => void;
  resumeCampaign: () => void;
  saveNow: () => void;
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
  contestedBy: {} as Record<string, string>,
  lastBattleTick: {} as Record<string, number>,
  movements: [] as TroopMovement[],
  battleLog: [] as BattleLogEntry[],
  battleAnimations: [] as BattleAnimation[],
  arrivalTrails: [] as ArrivalEvent[],
  populations: {} as Record<string, number>,
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
  savedSummary: null as SaveSummary | null,
  techPanelOpen: false,
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
      const populations: Record<string, number> = {};
      const order: string[] = [];
      for (const c of countries) {
        byId[c.id] = c;
        ownership[c.id] = c.id;
        nations[c.id] = makeStartingNation(c);
        brains[c.id] = newBrain();
        control[c.id] = BALANCE_CONTROL.fullControl;
        populations[c.id] = c.population;
        order.push(c.id);
      }
      set({
        countries: byId,
        countryOrder: order,
        ownership,
        nations,
        brains,
        control,
        populations,
        geo,
        loaded: true,
        loading: false,
        savedSummary: summarizeSave(),
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load world',
        loading: false,
      });
    }
  },

  setSelected: (id) => {
    if (id !== null && id !== get().selectedCountryId) playSound('click');
    set({ selectedCountryId: id });
  },
  setHovered: (id) => set({ hoveredCountryId: id }),

  startCampaign: (playerId) => {
    const { nations, countries } = get();
    const baseline = nations[playerId];
    const country = countries[playerId];
    if (!baseline || !country) return;
    const cap = maxTroops(country);
    const totalNow = totalTroops(baseline);
    const buffMul = BALANCE.playerTroopMultiplier;
    const buffedTotal = Math.min(cap, Math.round(totalNow * buffMul));
    const factor = totalNow > 0 ? buffedTotal / totalNow : 1;
    const buffed: Nation = {
      ...baseline,
      gold: baseline.gold * BALANCE.playerGoldMultiplier,
      infantry: Math.round(baseline.infantry * factor),
      cavalry: Math.round(baseline.cavalry * factor),
      artillery: Math.round(baseline.artillery * factor),
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

  recruit: (type, amount) => {
    const { playerCountryId, nations, countries } = get();
    if (!playerCountryId) return;
    const nation = nations[playerCountryId];
    const country = countries[playerCountryId];
    if (!nation || !country) return;
    const cap = maxTroops(country);
    const current = totalTroops(nation);
    const room = cap - current;
    if (room <= 0) return;
    const cost = recruitCost(
      type,
      country.specializations,
      nation.unlockedTech,
      nation.barracksLevel,
    );
    const affordable = Math.floor(nation.gold / cost);
    const bulkCap = barracksBulkCap(nation.barracksLevel);
    const allowed = Math.min(amount, room, affordable, bulkCap);
    if (allowed <= 0) return;
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...nation,
          gold: nation.gold - allowed * cost,
          [type]: nation[type] + allowed,
        },
      },
    });
    playSound('click');
  },

  upgradeBarracks: () => {
    const { playerCountryId, nations } = get();
    if (!playerCountryId) return;
    const nation = nations[playerCountryId];
    if (!nation) return;
    const cost = barracksUpgradeCost(nation.barracksLevel);
    if (cost === null) return;
    if (nation.gold < cost) return;
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...nation,
          gold: nation.gold - cost,
          barracksLevel: nation.barracksLevel + 1,
        },
      },
    });
    playSound('alliance');
  },

  investInTech: () => {
    const { playerCountryId, nations, countries } = get();
    if (!playerCountryId) return;
    const nation = nations[playerCountryId];
    const country = countries[playerCountryId];
    if (!nation || !country) return;
    const cost = techInvestmentCost();
    if (nation.gold < cost) return;
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...nation,
          gold: nation.gold - cost,
          tech: nation.tech + techIncrement(nation.tech, country.specializations),
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
      populations: s.populations,
      ownership: s.ownership,
      nations: s.nations,
      brains: s.brains,
      control: s.control,
      contestedBy: s.contestedBy,
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

    const newAnimations: BattleAnimation[] = result.newBattles.map((b) => ({
      id: b.id,
      attackerOwnerId: b.attackerOwnerId,
      defenderOwnerId: b.defenderOwnerId,
      countryId: b.countryId,
      attackerTroopsBefore: b.attackerTroopsBefore,
      defenderTroopsBefore: b.defenderTroopsBefore,
      totalAttackerLosses: b.totalAttackerLosses,
      totalDefenderLosses: b.totalDefenderLosses,
      attackerWon: b.attackerWon,
      conquered: b.conquered,
      startedAt: now,
    }));
    const battleAnimations = [...s.battleAnimations, ...newAnimations].filter(
      (a) => now - a.startedAt < BATTLE_ANIM_MS,
    );

    const battleLog = [...result.newBattles, ...s.battleLog].slice(0, 30);

    set({
      date: result.date,
      tickCount: s.tickCount + 1,
      ownership: result.ownership,
      populations: result.populations,
      nations: result.nations,
      brains: result.brains,
      control: result.control,
      contestedBy: result.contestedBy,
      lastBattleTick: result.lastBattleTick,
      movements: result.movements,
      battleLog,
      battleAnimations,
      arrivalTrails: trails,
      victory: result.victory,
    });

    // Sound cues for the new battles + outcome.
    if (result.newBattles.length > 0) {
      const conquest = result.newBattles.some((b) => b.conquered);
      if (conquest) playSound('conquest');
      else playSound('cannon');
    }

    if (result.victory.kind !== 'ongoing') {
      clearTickInterval();
      clearSave();
      set({ savedSummary: null });
      if (result.victory.kind === 'win') playSound('conquest');
      else playSound('defeat');
    } else if ((s.tickCount + 1) % 10 === 0) {
      const now2 = get();
      writeSave({
        version: 4,
        savedAt: Date.now(),
        ownership: now2.ownership,
        nations: now2.nations,
        brains: now2.brains,
        control: now2.control,
        contestedBy: now2.contestedBy,
        lastBattleTick: now2.lastBattleTick,
        movements: now2.movements,
        battleLog: now2.battleLog,
        populations: now2.populations,
        date: now2.date,
        tickCount: now2.tickCount,
        playerCountryId: now2.playerCountryId,
        homeCountryId: now2.homeCountryId,
        speed: now2.speed,
        victory: now2.victory,
      });
      set({ savedSummary: summarizeSave() });
    }
  },

  openDispatch: (toId) => set({ dispatchTargetId: toId }),
  closeDispatch: () => set({ dispatchTargetId: null }),

  dispatchTroops: (toId, composition) => {
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
    // Re-run path with the player's tech (Naval Engineers cuts cost).
    {
      const navalCost = navalCostUnit(player.unlockedTech);
      let bp: string[] | null = null;
      let bfId: string | null = null;
      for (const myId of myIds) {
        const p2 = findPath(countries, myId, toId, navalCost);
        if (p2 && (!bp || p2.length < bp.length)) {
          bp = p2;
          bfId = myId;
        }
      }
      if (bp && bfId) {
        bestPath = bp;
        bestFromId = bfId;
      }
    }
    if (!bestPath || !bestFromId) return;
    const garrisonInf = Math.floor(
      player.infantry * BALANCE_MOVEMENT.homeGarrisonFraction,
    );
    const garrisonCav = Math.floor(
      player.cavalry * BALANCE_MOVEMENT.homeGarrisonFraction,
    );
    const garrisonArt = Math.floor(
      player.artillery * BALANCE_MOVEMENT.homeGarrisonFraction,
    );
    const sendInf = Math.max(
      0,
      Math.min(composition.infantry, player.infantry - garrisonInf),
    );
    const sendCav = Math.max(
      0,
      Math.min(composition.cavalry, player.cavalry - garrisonCav),
    );
    const sendArt = Math.max(
      0,
      Math.min(composition.artillery, player.artillery - garrisonArt),
    );
    const total = sendInf + sendCav + sendArt;
    if (total <= 0) return;
    const newMv: TroopMovement = {
      id: newMovementId(),
      ownerId: playerCountryId,
      fromId: bestFromId,
      toId,
      composition: {
        infantry: sendInf,
        cavalry: sendCav,
        artillery: sendArt,
      },
      troops: total,
      path: bestPath,
      pathIndex: 0,
      launchTick: tickCount,
    };
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...player,
          infantry: player.infantry - sendInf,
          cavalry: player.cavalry - sendCav,
          artillery: player.artillery - sendArt,
        },
      },
      movements: [...movements, newMv],
      dispatchTargetId: null,
    });
    playSound('march');
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
    const player = nations[playerCountryId];
    const accepted = evaluateAllianceProposal({
      proposerId: playerCountryId,
      targetId,
      nations,
      brain: targetBrain,
      acceptMultiplier: player ? statecraftMultiplier(player.unlockedTech) : 1,
    });
    if (accepted) {
      set({
        nations: setMutualStance(nations, playerCountryId, targetId, 'allied'),
      });
      playSound('alliance');
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
    clearSave();
    const { countries, countryOrder, geo } = get();
    const ownership: Record<string, string> = {};
    const nations: Record<string, Nation> = {};
    const brains: Record<string, AIBrain> = {};
    const control: Record<string, number> = {};
    const populations: Record<string, number> = {};
    for (const id of countryOrder) {
      const c = countries[id];
      if (!c) continue;
      ownership[id] = id;
      nations[id] = makeStartingNation(c);
      brains[id] = newBrain();
      control[id] = BALANCE_CONTROL.fullControl;
      populations[id] = c.population;
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
      populations,
      loaded: true,
      savedSummary: null,
    });
  },

  researchTech: (id) => {
    const { playerCountryId, nations } = get();
    if (!playerCountryId) return;
    const nation = nations[playerCountryId];
    if (!nation) return;
    if (!isUnlockable(id, nation.unlockedTech, nation.gold)) return;
    const node = TECH_NODES.find((n) => n.id === id);
    if (!node) return;
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...nation,
          gold: nation.gold - node.cost,
          unlockedTech: [...nation.unlockedTech, id],
        },
      },
    });
    playSound('alliance');
  },

  toggleAutoRecruit: () => {
    const { playerCountryId, nations } = get();
    if (!playerCountryId) return;
    const nation = nations[playerCountryId];
    if (!nation) return;
    if (!nation.unlockedTech.includes('log_conscription')) return;
    set({
      nations: {
        ...nations,
        [playerCountryId]: { ...nation, autoRecruit: !nation.autoRecruit },
      },
    });
  },

  setTechPanelOpen: (open) => set({ techPanelOpen: open }),

  pruneTrails: () => {
    const now = performance.now();
    set({
      arrivalTrails: get().arrivalTrails.filter(
        (t) => now - t.arrivedAt < BALANCE_MOVEMENT.arrivalTrailMs,
      ),
      battleAnimations: get().battleAnimations.filter(
        (a) => now - a.startedAt < BATTLE_ANIM_MS,
      ),
    });
  },

  resumeCampaign: () => {
    const save = readSave();
    if (!save || !save.playerCountryId) return;
    set({
      ownership: save.ownership,
      nations: save.nations,
      brains: save.brains,
      control: save.control,
      contestedBy: save.contestedBy ?? {},
      lastBattleTick: save.lastBattleTick,
      movements: save.movements,
      battleLog: save.battleLog,
      populations: save.populations ?? get().populations,
      arrivalTrails: [],
      date: save.date,
      tickCount: save.tickCount,
      playerCountryId: save.playerCountryId,
      homeCountryId: save.homeCountryId,
      speed: save.speed,
      victory: save.victory,
      gameStarted: true,
      paused: false,
      selectedCountryId: null,
    });
    ensureTickInterval(get);
  },

  saveNow: () => {
    const s = get();
    if (!s.gameStarted || !s.playerCountryId) return;
    writeSave({
      version: 4,
      savedAt: Date.now(),
      ownership: s.ownership,
      nations: s.nations,
      brains: s.brains,
      control: s.control,
      contestedBy: s.contestedBy,
      lastBattleTick: s.lastBattleTick,
      movements: s.movements,
      battleLog: s.battleLog,
      populations: s.populations,
      date: s.date,
      tickCount: s.tickCount,
      playerCountryId: s.playerCountryId,
      homeCountryId: s.homeCountryId,
      speed: s.speed,
      victory: s.victory,
    });
    set({ savedSummary: summarizeSave() });
  },
}));

if (import.meta.hot) {
  import.meta.hot.dispose(() => clearTickInterval());
}
