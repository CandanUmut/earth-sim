import type { Composition, Nation } from '../game/economy';
import type { GameDate, BattleLogEntry } from '../game/tick';
import type { TroopMovement } from '../game/movement';
import type { AIBrain } from '../game/ai';
import type { VictoryState } from '../game/victory';
import type { ActiveBattle } from '../game/activeBattle';

const SAVE_KEY = 'terra-bellum-save-v4';
const TUTORIAL_KEY = 'terra-bellum-tutorial-seen-v2';

export type SavePayload = {
  version: 4;
  savedAt: number;
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  brains: Record<string, AIBrain>;
  control: Record<string, number>;
  contestedBy: Record<string, string>;
  lastBattleTick: Record<string, number>;
  movements: TroopMovement[];
  activeBattles: Record<string, ActiveBattle>;
  garrisons: Record<string, Composition>;
  battleLog: BattleLogEntry[];
  populations: Record<string, number>;
  date: GameDate;
  tickCount: number;
  playerCountryId: string | null;
  homeCountryId: string | null;
  speed: 1 | 2 | 3;
  victory: VictoryState;
};

export type SaveSummary = {
  exists: boolean;
  savedAt: number;
  date: GameDate;
  playerCountryId: string | null;
  conquered: number;
};

export function writeSave(payload: SavePayload): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or private mode — silently ignore.
  }
}

export function readSave(): SavePayload | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavePayload;
    if (parsed.version !== 4) return null;
    // Defensive backfill: older v4 saves predating barracks/politics fields.
    for (const id of Object.keys(parsed.nations)) {
      const n = parsed.nations[id] as Partial<Nation> & { barracksLevel?: number };
      if (typeof n.barracksLevel !== 'number') n.barracksLevel = 1;
      if (typeof n.reputation !== 'number') n.reputation = 50;
      if (!Array.isArray(n.tradePartners)) n.tradePartners = [];
      if (!n.tributePaid || typeof n.tributePaid !== 'object')
        n.tributePaid = {};
      if (!n.tributeReceived || typeof n.tributeReceived !== 'object')
        n.tributeReceived = {};
      if (n.vassalOf === undefined) n.vassalOf = null;
      if (!Array.isArray(n.vassals)) n.vassals = [];
    }
    if (!parsed.activeBattles) parsed.activeBattles = {};
    if (!parsed.garrisons) parsed.garrisons = {};
    return parsed;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem('terra-bellum-save-v1');
    localStorage.removeItem('terra-bellum-save-v2');
    localStorage.removeItem('terra-bellum-save-v3');
  } catch {
    // ignore
  }
}

export function summarizeSave(): SaveSummary | null {
  const save = readSave();
  if (!save) return null;
  let conquered = 0;
  if (save.playerCountryId) {
    for (const owner of Object.values(save.ownership)) {
      if (owner === save.playerCountryId) conquered++;
    }
    conquered = Math.max(0, conquered - 1);
  }
  return {
    exists: true,
    savedAt: save.savedAt,
    date: save.date,
    playerCountryId: save.playerCountryId,
    conquered,
  };
}

export function hasSeenTutorial(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === 'yes';
  } catch {
    return true;
  }
}

export function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, 'yes');
  } catch {
    // ignore
  }
}
