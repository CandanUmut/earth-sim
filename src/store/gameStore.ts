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
  evaluateTradeProposal,
  evaluateTributeDemand,
  evaluateVassalizationOffer,
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
import type { ActiveBattle } from '../game/activeBattle';
import {
  buildPeaceOutcome,
  createWar,
  evaluatePeaceDeal,
  warKey,
  type War,
  type WarGoal,
} from '../game/wars';
import { generateLeader, type Leader } from '../game/leaders';
import type { HistoricalEvent } from '../game/historicalEvents';
import type { GameEvent } from '../game/events';
import { BALANCE_EVENTS } from '../game/events';
import { type VictoryState } from '../game/victory';
import {
  BALANCE,
  BALANCE_MOVEMENT,
  BALANCE_CONTROL,
  BALANCE_POLITICS,
} from '../game/balance';
import {
  writeSave,
  readSave,
  clearSave,
  summarizeSave,
  type SaveSummary,
} from './persistence';
import {
  play as playSound,
  setMusicMode,
  stopBattleLoop,
} from '../sound/sound';

export type Speed = 1 | 2 | 3;
export type Difficulty = 'easy' | 'normal' | 'hard';

export type CameraTarget =
  | { kind: 'country'; countryId: string; scale: number }
  | { kind: 'reset' }
  | null;

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

/** Critical event that auto-pauses the game and demands player attention. */
export type PendingDecision =
  | { kind: 'ai_declared_war'; aggressorId: string; tickCount: number };

/** A cinematic card waiting to be shown to the player.
 *  These PAUSE the game and demand acknowledgment.
 *  Reserved for events that directly affect the player. */
export type CinematicCard =
  | {
      kind: 'war_declared';
      aggressorId: string;
      defenderId: string;
      shownAt: number;
    }
  | {
      kind: 'capital_fell';
      fallenId: string;
      conquerorId: string;
      shownAt: number;
    }
  | {
      kind: 'rebellion_on_player_tile';
      tileId: string;
      shownAt: number;
    };

/** Non-blocking world news — top banner that auto-dismisses.
 *  Used for things the player should KNOW but doesn't need to STOP for. */
export type WorldNewsItem =
  | {
      id: string;
      kind: 'historical';
      event: HistoricalEvent;
      addedAt: number;
    }
  | {
      id: string;
      kind: 'chapter';
      year: number;
      title: string;
      addedAt: number;
    }
  | {
      id: string;
      kind: 'distant_capital_fell';
      fallenName: string;
      conquerorName: string;
      addedAt: number;
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
  activeBattles: Record<string, ActiveBattle>;
  /** Garrison troops stationed at conquered tiles. Map: tileId → composition. */
  garrisons: Record<string, Composition>;
  /** Active wars keyed by `warKey(a,b)`. */
  wars: Record<string, War>;
  /** Leaders keyed by country id. Stable for the campaign. */
  leaders: Record<string, Leader>;
  /** Historical events that have already fired this campaign. */
  historicalFired: Record<string, true>;
  /** Queue of cinematic cards (PAUSES the game). Player-affecting only. */
  cinematicQueue: CinematicCard[];
  /** Newspaper archive — every dispatch ever, capped at 50. Read at leisure. */
  newsArchive: WorldNewsItem[];
  /** Single most-recent BIG dispatch shown briefly on-screen. Auto-dismisses. */
  breakingNews: WorldNewsItem | null;
  /** Number of unread items in newsArchive (since the player last opened it). */
  newsUnreadCount: number;
  /** Whether the newspaper panel is open. */
  newspaperOpen: boolean;
  /** Last in-game year a chapter title was shown. */
  lastChapterYear: number | null;
  /** Critical decision waiting for the player; while non-null, game is paused. */
  pendingDecision: PendingDecision | null;
  /** War id currently displayed in the peace negotiation modal. */
  peaceDialogWarId: string | null;
  /** Country id currently being declared on (modal state). */
  declareWarTargetId: string | null;
  eventLog: GameEvent[];
  /** Newest events queued for toast UI, then drained. */
  unreadEvents: GameEvent[];
  difficulty: Difficulty;
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
  cameraTarget: CameraTarget;
  /** Bumped each time setCameraTarget runs so WorldMap re-applies even on
   *  identical target value (e.g. re-snapping back to same country). */
  cameraVersion: number;
  /** Country id for the Battle Hub modal, or null when closed. */
  focusedBattleLocationId: string | null;

  loadInitialWorld: () => Promise<void>;
  setSelected: (id: string | null) => void;
  setHovered: (id: string | null) => void;
  startCampaign: (playerId: string) => void;
  setDifficulty: (d: Difficulty) => void;
  acknowledgeEvent: (id: string) => void;
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
  declareWar: (targetId: string, goals?: WarGoal[]) => void;
  proposePeace: (targetId: string, claims?: WarGoal[]) => { accepted: boolean; reason: string };
  openDeclareWar: (targetId: string) => void;
  closeDeclareWar: () => void;
  openPeaceDialog: (warId: string) => void;
  closePeaceDialog: () => void;
  acknowledgePending: () => void;
  dismissCinematic: () => void;
  dismissBreakingNews: () => void;
  openNewspaper: () => void;
  closeNewspaper: () => void;
  proposeAlliance: (targetId: string) => void;
  sendGift: (targetId: string, gold: number) => void;
  proposeTradeAgreement: (targetId: string) => void;
  cancelTradeAgreement: (targetId: string) => void;
  demandTribute: (targetId: string) => void;
  cancelTribute: (targetId: string) => void;
  vassalize: (targetId: string) => void;
  releaseVassal: (vassalId: string) => void;
  toggleBattleLog: () => void;
  dismissEndScreen: () => void;
  newCampaign: () => void;
  researchTech: (id: TechNodeId) => void;
  toggleAutoRecruit: () => void;
  setTechPanelOpen: (open: boolean) => void;
  pruneTrails: () => void;
  resumeCampaign: () => void;
  saveNow: () => void;
  setCameraTarget: (target: CameraTarget) => void;
  openBattleHub: (locationId: string) => void;
  closeBattleHub: () => void;
  retreatFromBattle: (locationId: string) => void;
  /** Auto-dispatch a balanced force from the closest owned territory (50% of
   *  available, minus garrison). Used by shift-click and War Room. */
  quickDispatch: (toId: string) => void;
  /** Move troops from the player's home pool into a tile's garrison. */
  garrisonTile: (tileId: string, composition: Composition) => void;
  /** Pull all garrison troops at a tile back into the home pool. */
  withdrawGarrison: (tileId: string) => void;
  /** Spend gold to give the defenders at a tile a temporary morale boost
   *  (rally). Currently it adds a small amount of garrison troops. */
  rallyDefenders: (tileId: string) => void;
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
  const { paused, gameStarted, victory, tick, pendingDecision, cinematicQueue } = get();
  if (paused || !gameStarted || victory.kind !== 'ongoing') return;
  if (pendingDecision) return; // hold the world until the player acks
  if (cinematicQueue.length > 0) return; // hold while a card is showing
  const ms = BALANCE.msPerTickAt1x / get().speed;
  tickIntervalId = setInterval(tick, ms);
}

function pickChapterTitle(
  year: number,
  wars: Record<string, War>,
): string | null {
  const warCount = Object.keys(wars).length;
  // First chapter every campaign so it always announces itself.
  if (year === 1900) return '1900 — The Old Order';
  // World-state-conditioned titles.
  if (warCount >= 8) return `${year} — The World Aflame`;
  if (warCount >= 5) return `${year} — A General War`;
  if (warCount >= 3) return `${year} — The Powder Keg`;
  if (warCount === 0) {
    const calmTitles = ['A Long Calm', 'A Quiet Spring', 'An Anxious Peace'];
    return `${year} — ${calmTitles[year % calmTitles.length]}`;
  }
  // Decade markers.
  if (year === 1910) return '1910 — Tensions Rise';
  if (year === 1914) return '1914 — The Lamps Go Out';
  if (year === 1918) return '1918 — Armistice';
  if (year === 1920) return '1920 — A New Order';
  if (year === 1929) return '1929 — The Reckoning';
  if (year === 1933) return '1933 — Shadows Lengthen';
  if (year === 1939) return '1939 — Steel and Smoke';
  if (year === 1945) return '1945 — Year Zero';
  if (year % 10 === 0) return `${year} — A New Decade`;
  if (year % 5 === 0) return `${year} — Five Years On`;
  return `${year}`;
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
  activeBattles: {} as Record<string, ActiveBattle>,
  garrisons: {} as Record<string, Composition>,
  wars: {} as Record<string, War>,
  leaders: {} as Record<string, Leader>,
  historicalFired: {} as Record<string, true>,
  cinematicQueue: [] as CinematicCard[],
  newsArchive: [] as WorldNewsItem[],
  breakingNews: null as WorldNewsItem | null,
  newsUnreadCount: 0,
  newspaperOpen: false,
  lastChapterYear: null as number | null,
  pendingDecision: null as PendingDecision | null,
  peaceDialogWarId: null as string | null,
  declareWarTargetId: null as string | null,
  eventLog: [] as GameEvent[],
  unreadEvents: [] as GameEvent[],
  difficulty: 'normal' as Difficulty,
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
  cameraTarget: null as CameraTarget,
  cameraVersion: 0,
  focusedBattleLocationId: null as string | null,
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
      const leaders: Record<string, Leader> = {};
      const order: string[] = [];
      for (const c of countries) {
        byId[c.id] = c;
        ownership[c.id] = c.id;
        nations[c.id] = makeStartingNation(c);
        brains[c.id] = newBrain();
        control[c.id] = BALANCE_CONTROL.fullControl;
        populations[c.id] = c.population;
        leaders[c.id] = generateLeader(c);
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
        leaders,
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
    const { nations, countries, difficulty } = get();
    const baseline = nations[playerId];
    const country = countries[playerId];
    if (!baseline || !country) return;
    const cap = maxTroops(country);
    const totalNow = totalTroops(baseline);
    // Difficulty modifies the player's starting buff.
    const goldMul =
      difficulty === 'easy'
        ? BALANCE.playerGoldMultiplier * 1.5
        : difficulty === 'hard'
          ? BALANCE.playerGoldMultiplier * 0.7
          : BALANCE.playerGoldMultiplier;
    const troopMul =
      difficulty === 'easy'
        ? BALANCE.playerTroopMultiplier * 1.4
        : difficulty === 'hard'
          ? BALANCE.playerTroopMultiplier * 0.8
          : BALANCE.playerTroopMultiplier;
    const buffedTotal = Math.min(cap, Math.round(totalNow * troopMul));
    const factor = totalNow > 0 ? buffedTotal / totalNow : 1;
    const buffed: Nation = {
      ...baseline,
      gold: baseline.gold * goldMul,
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
    playSound('coin');
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
      activeBattles: s.activeBattles,
      garrisons: s.garrisons,
      wars: s.wars,
      historicalFired: s.historicalFired,
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

    const eventLog = [...result.newEvents, ...s.eventLog].slice(
      0,
      BALANCE_EVENTS.logSize,
    );
    const unreadEvents = [...s.unreadEvents, ...result.newEvents].slice(-5);

    // If the AI declared war on the player this tick, queue a pending decision
    // and force-pause so the player notices.
    let pendingDecision: PendingDecision | null = s.pendingDecision;
    let paused = s.paused;
    if (
      !pendingDecision &&
      result.aiDeclaredWarOnPlayer.length > 0 &&
      s.playerCountryId
    ) {
      pendingDecision = {
        kind: 'ai_declared_war',
        aggressorId: result.aiDeclaredWarOnPlayer[0],
        tickCount: s.tickCount + 1,
      };
      paused = true;
    }

    // Two streams: cinematic (pauses, only for things that affect the player)
    // and world news (top-banner ticker, auto-dismisses, doesn't pause).
    const newCinematics: CinematicCard[] = [];
    const newWorldNews: WorldNewsItem[] = [];

    // Historical events → news (NEVER pauses).
    if (result.historicalEvent) {
      newWorldNews.push({
        id: `news-h-${result.historicalEvent.id}`,
        kind: 'historical',
        event: result.historicalEvent,
        addedAt: now,
      });
    }

    // Chapter cards → news on first tick of a new year.
    let lastChapterYear = s.lastChapterYear;
    if (
      result.date.year !== s.date.year &&
      result.date.year !== lastChapterYear
    ) {
      const chapterTitle = pickChapterTitle(result.date.year, result.wars);
      if (chapterTitle) {
        newWorldNews.push({
          id: `news-c-${result.date.year}`,
          kind: 'chapter',
          year: result.date.year,
          title: chapterTitle,
          addedAt: now,
        });
        lastChapterYear = result.date.year;
      }
    }

    // War declared on player → CINEMATIC (pauses).
    if (result.aiDeclaredWarOnPlayer.length > 0 && s.playerCountryId) {
      newCinematics.push({
        kind: 'war_declared',
        aggressorId: result.aiDeclaredWarOnPlayer[0],
        defenderId: s.playerCountryId,
        shownAt: now,
      });
    }

    // Capital fell — only the player's home is cinematic. Others are news.
    for (const homeId of Object.keys(result.ownership)) {
      const beforeOwner = s.ownership[homeId];
      const afterOwner = result.ownership[homeId];
      if (
        beforeOwner !== afterOwner &&
        beforeOwner === homeId &&
        afterOwner !== homeId
      ) {
        if (homeId === s.homeCountryId) {
          newCinematics.push({
            kind: 'capital_fell',
            fallenId: homeId,
            conquerorId: afterOwner,
            shownAt: now,
          });
        } else {
          const fallen = s.countries[homeId];
          const conqueror = s.countries[afterOwner];
          if (fallen && conqueror) {
            newWorldNews.push({
              id: `news-cap-${homeId}-${s.tickCount}`,
              kind: 'distant_capital_fell',
              fallenName: fallen.name,
              conquerorName: conqueror.name,
              addedAt: now,
            });
          }
        }
      }
    }

    // Rebellion on a player-owned tile → cinematic (pauses).
    for (const ev of result.newEvents) {
      if (ev.kind === 'peasant_revolt' && s.playerCountryId) {
        const targetOwner = result.ownership[ev.targetId];
        if (targetOwner === s.playerCountryId) {
          newCinematics.push({
            kind: 'rebellion_on_player_tile',
            tileId: ev.targetId,
            shownAt: now,
          });
        }
      }
    }

    const cinematicQueue = [...s.cinematicQueue, ...newCinematics];

    // Archive grows with EVERY news item, capped at 50. The newspaper button
    // shows an unread badge until the player opens the panel.
    let newsArchive = s.newsArchive;
    let breakingNews = s.breakingNews;
    let newsUnreadCount = s.newsUnreadCount;
    if (newWorldNews.length > 0) {
      newsArchive = [...s.newsArchive, ...newWorldNews].slice(-50);
      newsUnreadCount += newWorldNews.length;
      // Pick at most ONE item to flash on-screen — only major historical
      // events. Distant capitals & chapter changes go straight to archive.
      const flashCandidate = newWorldNews.find(
        (n) => n.kind === 'historical' && (n.event.major || !!n.event.effect),
      );
      if (flashCandidate) breakingNews = flashCandidate;
    }
    if (newCinematics.length > 0) paused = true;

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
      activeBattles: result.activeBattles,
      garrisons: result.garrisons,
      wars: result.wars,
      historicalFired: result.historicalFired,
      cinematicQueue,
      newsArchive,
      breakingNews,
      newsUnreadCount,
      lastChapterYear,
      pendingDecision,
      paused,
      eventLog,
      unreadEvents,
      battleLog,
      battleAnimations,
      arrivalTrails: trails,
      victory: result.victory,
    });
    if (paused !== s.paused) ensureTickInterval(get);

    // Sound cues for the new battles + outcome.
    // We deliberately reserve 'conquest' for the moment a NATION actually
    // falls (loses its last tile). Individual tile flips during a long war
    // would otherwise fire it constantly. Other resolved battles fall back
    // to the quieter 'cannon' cue.
    if (result.newBattles.length > 0) {
      const tilesByOwnerBefore: Record<string, number> = {};
      for (const owner of Object.values(s.ownership)) {
        tilesByOwnerBefore[owner] = (tilesByOwnerBefore[owner] ?? 0) + 1;
      }
      const tilesByOwnerAfter: Record<string, number> = {};
      for (const owner of Object.values(result.ownership)) {
        tilesByOwnerAfter[owner] = (tilesByOwnerAfter[owner] ?? 0) + 1;
      }
      const nationFell = Object.keys(tilesByOwnerBefore).some(
        (id) =>
          (tilesByOwnerBefore[id] ?? 0) > 0 &&
          (tilesByOwnerAfter[id] ?? 0) === 0,
      );
      if (nationFell) playSound('conquest');
      else playSound('cannon');
    }

    if (result.victory.kind !== 'ongoing') {
      clearTickInterval();
      clearSave();
      set({ savedSummary: null });
      if (result.victory.kind === 'win') playSound('victory');
      else playSound('defeat');
      void setMusicMode(null);
      stopBattleLoop();
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
        activeBattles: now2.activeBattles,
        garrisons: now2.garrisons,
        wars: now2.wars,
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

  declareWar: (targetId, goals = []) => {
    const { playerCountryId, nations, wars, tickCount } = get();
    if (!playerCountryId || playerCountryId === targetId) return;
    const k = warKey(playerCountryId, targetId);
    const nextNations = setMutualStance(nations, playerCountryId, targetId, 'war');
    const nextWars = wars[k]
      ? wars
      : {
          ...wars,
          [k]: createWar({
            attackerId: playerCountryId,
            defenderId: targetId,
            startedAtTick: tickCount,
            goals,
          }),
        };
    set({ nations: nextNations, wars: nextWars, declareWarTargetId: null });
    playSound('cannon');
  },

  proposePeace: (targetId, claims) => {
    const { playerCountryId, nations, wars, countries, control } = get();
    if (!playerCountryId || playerCountryId === targetId) {
      return { accepted: false, reason: 'Invalid target.' };
    }
    const k = warKey(playerCountryId, targetId);
    const war = wars[k];
    if (!war) {
      // No war record: fall back to plain stance reset (legacy/no-data path).
      if (nations[playerCountryId]?.stance[targetId] !== 'war') {
        return { accepted: false, reason: 'Not at war.' };
      }
      set({
        nations: setMutualStance(nations, playerCountryId, targetId, 'neutral'),
      });
      return { accepted: true, reason: 'White peace.' };
    }
    const offered = claims ?? war.attackerGoals;
    const decision = evaluatePeaceDeal({
      war,
      evaluatorId: targetId,
      claims: offered,
    });
    if (!decision.accept) return { accepted: false, reason: decision.reason };

    // Apply the deal: transfer claimed tiles to attacker, set tribute/vassal.
    const outcome = buildPeaceOutcome(war, offered, countries);
    let nextNations = setMutualStance(
      nations,
      playerCountryId,
      targetId,
      'neutral',
    );
    let nextOwnership = { ...get().ownership };
    let nextControl = { ...control };
    for (const tileId of outcome.tilesToAttacker) {
      nextOwnership[tileId] = playerCountryId;
      nextControl[tileId] = 60;
    }
    if (outcome.tribute > 0) {
      const player = nextNations[playerCountryId];
      const target = nextNations[targetId];
      if (player && target) {
        nextNations = {
          ...nextNations,
          [playerCountryId]: {
            ...player,
            tributeReceived: {
              ...player.tributeReceived,
              [targetId]: outcome.tribute,
            },
          },
          [targetId]: {
            ...target,
            tributePaid: {
              ...target.tributePaid,
              [playerCountryId]: outcome.tribute,
            },
          },
        };
      }
    }
    if (outcome.vassalize) {
      const player = nextNations[playerCountryId];
      const target = nextNations[targetId];
      if (player && target && !target.vassalOf) {
        nextNations = {
          ...nextNations,
          [playerCountryId]: {
            ...player,
            vassals: [...player.vassals, targetId],
          },
          [targetId]: { ...target, vassalOf: playerCountryId },
        };
        // Vassal stance becomes allied to overlord.
        nextNations = setMutualStance(nextNations, playerCountryId, targetId, 'allied');
      }
    }
    const nextWars = { ...wars };
    delete nextWars[outcome.warIdToRemove === war.id ? k : k];
    delete nextWars[k];
    set({
      nations: nextNations,
      wars: nextWars,
      ownership: nextOwnership,
      control: nextControl,
      peaceDialogWarId: null,
    });
    playSound('alliance');
    return { accepted: true, reason: decision.reason };
  },

  openDeclareWar: (targetId) => set({ declareWarTargetId: targetId }),
  closeDeclareWar: () => set({ declareWarTargetId: null }),
  openPeaceDialog: (warId) => set({ peaceDialogWarId: warId }),
  closePeaceDialog: () => set({ peaceDialogWarId: null }),
  acknowledgePending: () => {
    set({ pendingDecision: null });
    ensureTickInterval(get);
  },

  dismissCinematic: () => {
    const queue = get().cinematicQueue;
    if (queue.length === 0) return;
    const next = queue.slice(1);
    set({ cinematicQueue: next });
    if (next.length === 0) ensureTickInterval(get);
  },

  dismissBreakingNews: () => {
    set({ breakingNews: null });
  },
  openNewspaper: () => {
    set({ newspaperOpen: true, newsUnreadCount: 0 });
  },
  closeNewspaper: () => {
    set({ newspaperOpen: false });
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
    // Gifts boost both reputations slightly.
    const repGain = Math.min(2, gold / 20);
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...player,
          gold: player.gold - gold,
          reputation: Math.min(100, player.reputation + repGain),
        },
        [targetId]: { ...target, gold: target.gold + gold },
      },
    });
  },

  proposeTradeAgreement: (targetId) => {
    const { playerCountryId, nations, brains } = get();
    if (!playerCountryId || playerCountryId === targetId) return;
    const player = nations[playerCountryId];
    const target = nations[targetId];
    if (!player || !target) return;
    if (player.tradePartners.includes(targetId)) return;
    // Trade requires non-war stance.
    if ((player.stance[targetId] ?? 'neutral') === 'war') return;
    const targetBrain = brains[targetId];
    if (!targetBrain) return;
    const accepted = evaluateTradeProposal({
      proposerId: playerCountryId,
      targetId,
      nations,
      brain: targetBrain,
    });
    if (!accepted) return;
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...player,
          tradePartners: [...player.tradePartners, targetId],
        },
        [targetId]: {
          ...target,
          tradePartners: [...target.tradePartners, playerCountryId],
        },
      },
    });
    playSound('alliance');
  },

  cancelTradeAgreement: (targetId) => {
    const { playerCountryId, nations } = get();
    if (!playerCountryId) return;
    const player = nations[playerCountryId];
    const target = nations[targetId];
    if (!player || !target) return;
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...player,
          tradePartners: player.tradePartners.filter((id) => id !== targetId),
          reputation: Math.max(
            0,
            player.reputation - BALANCE_POLITICS.reputationTradeBreakCost,
          ),
        },
        [targetId]: {
          ...target,
          tradePartners: target.tradePartners.filter(
            (id) => id !== playerCountryId,
          ),
        },
      },
    });
  },

  demandTribute: (targetId) => {
    const { playerCountryId, nations, brains, countries } = get();
    if (!playerCountryId || playerCountryId === targetId) return;
    const player = nations[playerCountryId];
    const target = nations[targetId];
    const targetCountry = countries[targetId];
    if (!player || !target || !targetCountry) return;
    if (target.tributePaid[playerCountryId]) return; // already tributing us
    const targetBrain = brains[targetId];
    if (!targetBrain) return;
    const decision = evaluateTributeDemand({
      proposerId: playerCountryId,
      targetId,
      nations,
      brain: targetBrain,
      targetCountry,
    });
    if (decision.outcome === 'refuse') {
      // Refusal = casus belli; auto-declare war.
      set({
        nations: setMutualStance(nations, playerCountryId, targetId, 'war'),
      });
      return;
    }
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...player,
          tributeReceived: {
            ...player.tributeReceived,
            [targetId]: decision.amount,
          },
        },
        [targetId]: {
          ...target,
          tributePaid: {
            ...target.tributePaid,
            [playerCountryId]: decision.amount,
          },
        },
      },
    });
    playSound('alliance');
  },

  cancelTribute: (targetId) => {
    // Player releases tributary (good for reputation, bad for income).
    const { playerCountryId, nations } = get();
    if (!playerCountryId) return;
    const player = nations[playerCountryId];
    const target = nations[targetId];
    if (!player || !target) return;
    const newReceived = { ...player.tributeReceived };
    delete newReceived[targetId];
    const newPaid = { ...target.tributePaid };
    delete newPaid[playerCountryId];
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...player,
          tributeReceived: newReceived,
          reputation: Math.min(100, player.reputation + 5),
        },
        [targetId]: {
          ...target,
          tributePaid: newPaid,
        },
      },
    });
  },

  vassalize: (targetId) => {
    const { playerCountryId, nations, brains, control } = get();
    if (!playerCountryId || playerCountryId === targetId) return;
    const player = nations[playerCountryId];
    const target = nations[targetId];
    if (!player || !target) return;
    if (target.vassalOf) return; // already vassal of someone
    const targetBrain = brains[targetId];
    if (!targetBrain) return;
    const targetControl = control[targetId] ?? 100;
    const accepted = evaluateVassalizationOffer({
      proposerId: playerCountryId,
      targetId,
      nations,
      brain: targetBrain,
      currentControl: targetControl,
    });
    if (!accepted) return;
    set({
      nations: setMutualStance(
        {
          ...nations,
          [playerCountryId]: {
            ...player,
            vassals: [...player.vassals, targetId],
          },
          [targetId]: {
            ...target,
            vassalOf: playerCountryId,
            // Drop existing alliances; vassal can't ally elsewhere.
          },
        },
        playerCountryId,
        targetId,
        'allied',
      ),
    });
    playSound('alliance');
  },

  releaseVassal: (vassalId) => {
    const { playerCountryId, nations } = get();
    if (!playerCountryId) return;
    const player = nations[playerCountryId];
    const vassal = nations[vassalId];
    if (!player || !vassal) return;
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...player,
          vassals: player.vassals.filter((id) => id !== vassalId),
          reputation: Math.min(100, player.reputation + 8),
        },
        [vassalId]: {
          ...vassal,
          vassalOf: null,
        },
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
    const leaders: Record<string, Leader> = {};
    for (const id of countryOrder) {
      const c = countries[id];
      if (!c) continue;
      ownership[id] = id;
      nations[id] = makeStartingNation(c);
      brains[id] = newBrain();
      control[id] = BALANCE_CONTROL.fullControl;
      populations[id] = c.population;
      leaders[id] = generateLeader(c);
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
      leaders,
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
    playSound('tech_unlock');
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
      activeBattles: save.activeBattles ?? {},
      garrisons: save.garrisons ?? {},
      wars: save.wars ?? {},
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

  setCameraTarget: (target) => {
    set({ cameraTarget: target, cameraVersion: get().cameraVersion + 1 });
  },

  setDifficulty: (d) => {
    set({ difficulty: d });
  },

  acknowledgeEvent: (id) => {
    set({
      unreadEvents: get().unreadEvents.filter((e) => e.id !== id),
    });
  },

  openBattleHub: (locationId) => {
    set({ focusedBattleLocationId: locationId });
  },
  closeBattleHub: () => {
    set({ focusedBattleLocationId: null });
  },

  quickDispatch: (toId) => {
    const { playerCountryId, nations, dispatchTroops } = get();
    if (!playerCountryId) return;
    const player = nations[playerCountryId];
    if (!player) return;
    // Send 50 % of each pool (the modal logic still respects garrison).
    const half = (n: number) => Math.floor(n * 0.5);
    const composition = {
      infantry: half(player.infantry),
      cavalry: half(player.cavalry),
      artillery: half(player.artillery),
    };
    if (
      composition.infantry + composition.cavalry + composition.artillery <=
      0
    ) {
      return;
    }
    dispatchTroops(toId, composition);
  },

  retreatFromBattle: (locationId) => {
    const { activeBattles, nations, playerCountryId, contestedBy, control } = get();
    const battle = activeBattles[locationId];
    if (!battle) return;
    if (!playerCountryId || battle.attackerOwnerId !== playerCountryId) return;
    // 60 % of survivors return to the player's home pool. 40 % lost in retreat.
    const survivors = battle.attackerForce;
    const r = 0.6;
    const returned = {
      infantry: Math.floor(survivors.infantry * r),
      cavalry: Math.floor(survivors.cavalry * r),
      artillery: Math.floor(survivors.artillery * r),
    };
    const player = nations[playerCountryId];
    if (!player) return;
    const ab = { ...activeBattles };
    delete ab[locationId];
    const cb = { ...contestedBy };
    if (cb[locationId] === playerCountryId) delete cb[locationId];
    // Bump control regen check by clamping a small recovery so retreat
    // visibly relieves pressure.
    const ctl = {
      ...control,
      [locationId]: Math.min(
        100,
        (control[locationId] ?? 100) + 8,
      ),
    };
    set({
      activeBattles: ab,
      contestedBy: cb,
      control: ctl,
      focusedBattleLocationId: null,
      nations: {
        ...nations,
        [playerCountryId]: {
          ...player,
          infantry: player.infantry + returned.infantry,
          cavalry: player.cavalry + returned.cavalry,
          artillery: player.artillery + returned.artillery,
        },
      },
    });
    playSound('march');
  },

  garrisonTile: (tileId, composition) => {
    const { playerCountryId, nations, ownership, garrisons } = get();
    if (!playerCountryId) return;
    if (ownership[tileId] !== playerCountryId) return;
    if (tileId === playerCountryId) return; // home country uses nation pool
    const player = nations[playerCountryId];
    if (!player) return;
    const sendInf = Math.max(0, Math.min(composition.infantry, player.infantry));
    const sendCav = Math.max(0, Math.min(composition.cavalry, player.cavalry));
    const sendArt = Math.max(0, Math.min(composition.artillery, player.artillery));
    const total = sendInf + sendCav + sendArt;
    if (total <= 0) return;
    const existing = garrisons[tileId] ?? {
      infantry: 0,
      cavalry: 0,
      artillery: 0,
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
      garrisons: {
        ...garrisons,
        [tileId]: {
          infantry: existing.infantry + sendInf,
          cavalry: existing.cavalry + sendCav,
          artillery: existing.artillery + sendArt,
        },
      },
    });
    playSound('march');
  },

  withdrawGarrison: (tileId) => {
    const { playerCountryId, nations, ownership, garrisons } = get();
    if (!playerCountryId) return;
    if (ownership[tileId] !== playerCountryId) return;
    const player = nations[playerCountryId];
    const garr = garrisons[tileId];
    if (!player || !garr) return;
    const next = { ...garrisons };
    delete next[tileId];
    set({
      nations: {
        ...nations,
        [playerCountryId]: {
          ...player,
          infantry: player.infantry + garr.infantry,
          cavalry: player.cavalry + garr.cavalry,
          artillery: player.artillery + garr.artillery,
        },
      },
      garrisons: next,
    });
    playSound('march');
  },

  rallyDefenders: (tileId) => {
    // Spend gold to summon a small militia: +12 infantry to the tile's
    // garrison. Quick defensive intervention for an active battle on your
    // soil. Costs scale with how many times you've already rallied here
    // this campaign — but for v1 a flat 60g.
    const RALLY_COST = 60;
    const RALLY_TROOPS = 12;
    const { playerCountryId, nations, ownership, garrisons } = get();
    if (!playerCountryId) return;
    if (ownership[tileId] !== playerCountryId) return;
    const player = nations[playerCountryId];
    if (!player || player.gold < RALLY_COST) return;
    const existing = garrisons[tileId] ?? {
      infantry: 0,
      cavalry: 0,
      artillery: 0,
    };
    set({
      nations: {
        ...nations,
        [playerCountryId]: { ...player, gold: player.gold - RALLY_COST },
      },
      garrisons: {
        ...garrisons,
        [tileId]: {
          ...existing,
          infantry: existing.infantry + RALLY_TROOPS,
        },
      },
    });
    playSound('march');
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
      activeBattles: s.activeBattles,
      garrisons: s.garrisons,
      wars: s.wars,
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
