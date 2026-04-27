import type { Nation } from '../game/economy';
import type { GameDate, BattleLogEntry } from '../game/tick';
import type { TroopMovement } from '../game/movement';
import type { AIBrain } from '../game/ai';
import type { VictoryState } from '../game/victory';

const SAVE_KEY = 'terra-bellum-save-v3';
const TUTORIAL_KEY = 'terra-bellum-tutorial-seen-v1';

export type SavePayload = {
  version: 3;
  savedAt: number;
  ownership: Record<string, string>;
  nations: Record<string, Nation>;
  brains: Record<string, AIBrain>;
  control: Record<string, number>;
  contestedBy: Record<string, string>;
  lastBattleTick: Record<string, number>;
  movements: TroopMovement[];
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
    if (parsed.version !== 3) return null;
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
