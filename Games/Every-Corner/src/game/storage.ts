import type { DailyRecord, DifficultyId, Progress } from './types';

const KEY = 'clubhouse:every-corner';
const SAVE_KEY = `${KEY}:save`;
const DAILY_KEY = `${KEY}:daily`;

export interface SavedGame {
  seedCode: string;
  difficulty: DifficultyId;
  isDaily: boolean;
  progress: Progress;
}

export function saveGame(save: SavedGame): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private mode or a full quota: the puzzle simply is not resumable.
  }
}

export function loadGame(): SavedGame | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGame;
    const intact =
      parsed &&
      typeof parsed.seedCode === 'string' &&
      typeof parsed.difficulty === 'string' &&
      !!parsed.progress &&
      Array.isArray(parsed.progress.path);
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

export function loadDaily(): DailyRecord[] {
  try {
    const raw = window.localStorage.getItem(DAILY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyRecord[];
    return Array.isArray(parsed) ? parsed.filter((r) => typeof r?.date === 'string') : [];
  } catch {
    return [];
  }
}

/** One record per day; a repeat solve keeps the better time. */
export function recordDaily(record: DailyRecord): DailyRecord[] {
  const existing = loadDaily();
  const previous = existing.find((r) => r.date === record.date);
  const merged = previous
    ? existing.map((r) =>
        r.date === record.date
          ? { ...r, elapsedMs: Math.min(r.elapsedMs, record.elapsedMs), hintsUsed: Math.min(r.hintsUsed, record.hintsUsed) }
          : r,
      )
    : [...existing, record];

  const trimmed = merged.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 400);
  try {
    window.localStorage.setItem(DAILY_KEY, JSON.stringify(trimmed));
  } catch {
    // Best effort only.
  }
  return trimmed;
}
