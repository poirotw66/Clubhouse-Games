import { EMPTY_PROGRESS } from './achievements';
import type { AchievementProgress } from './achievements';
import { STORAGE_KEY } from './config';
import type { GameState } from './types';

const SAVE_KEY = `${STORAGE_KEY}:save`;
const ARCHIVE_KEY = `${STORAGE_KEY}:archive`;
const ACHIEVEMENTS_KEY = `${STORAGE_KEY}:achievements`;

export interface ArchiveEntry {
  seedCode: string;
  name: string;
  position: string;
  verdict: string;
  hofScore: number;
  traits: string[];
}

export function saveGame(state: GameState): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: the run simply is not resumable.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    // Guard against a save written by an older build. Every field added since
    // the first release is checked, because the engine reads them unguarded —
    // a stale save missing `finance` would crash on the first turn instead of
    // simply starting over.
    const intact =
      parsed &&
      typeof parsed.seedCode === 'string' &&
      !!parsed.attrs &&
      !!parsed.finance &&
      Array.isArray(parsed.handled) &&
      Array.isArray(parsed.milestones) &&
      Array.isArray(parsed.seenEvents) &&
      // Added when the pro stage became three turns a year — a save from
      // before that would misread `proTurn` as `undefined` and desync the
      // 春訓/球季/球季後 cycle, so a save missing it starts over instead.
      typeof parsed.proTurn === 'number';
    return intact ? parsed : null;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do.
  }
}

export function loadArchive(): ArchiveEntry[] {
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchiveEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function loadAchievements(): AchievementProgress {
  try {
    const raw = window.localStorage.getItem(ACHIEVEMENTS_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<AchievementProgress>;
    // Merged field by field so a save written before a new collection existed
    // still loads, rather than throwing away everything the player earned.
    return {
      unlocked: parsed.unlocked ?? {},
      traitsSeen: parsed.traitsSeen ?? [],
      pitchesMastered: parsed.pitchesMastered ?? [],
      positionsPlayed: parsed.positionsPlayed ?? [],
      leaguesPlayed: parsed.leaguesPlayed ?? [],
      careers: Number(parsed.careers) || 0,
      bestHof: Number(parsed.bestHof) || 0,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveAchievements(progress: AchievementProgress): void {
  try {
    window.localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(progress));
  } catch {
    // Best effort only.
  }
}

export function pushArchive(entry: ArchiveEntry): ArchiveEntry[] {
  const next = [entry, ...loadArchive()].slice(0, 20);
  try {
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  } catch {
    // Best effort only.
  }
  return next;
}
