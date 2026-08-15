/** Personal bests for Toy Baseball (localStorage replay hook), keyed by difficulty. */

import type { Difficulty } from './difficulty.ts';

export const STORAGE_KEY = 'clubhouse-toy-baseball-best';
export const STORAGE_KEY_V2 = 'clubhouse-toy-baseball-bests-v2';

export type DifficultyId = Difficulty;

export interface BaseballBests {
  /** Career wins vs CPU in match mode. */
  matchWins: number;
  /** Current win streak vs CPU (resets on loss or tie). */
  matchWinStreak: number;
  /** Best win streak vs CPU. */
  matchBestWinStreak: number;
  /** Most runs scored in a single won match. */
  matchBestRuns: number;
  /** Best home-run count in one derby session. */
  derbyBestHrs: number;
  /** Best single-hit distance in derby (screen units). */
  derbyBestDist: number;
}

export type BestsMap = Record<Difficulty, BaseballBests>;

export const EMPTY_BESTS: BaseballBests = {
  matchWins: 0,
  matchWinStreak: 0,
  matchBestWinStreak: 0,
  matchBestRuns: 0,
  derbyBestHrs: 0,
  derbyBestDist: 0,
};

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function readStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function normalize(raw: Partial<BaseballBests> | null | undefined): BaseballBests {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_BESTS };
  const streak = Math.max(0, Math.floor(Number(raw.matchWinStreak) || 0));
  return {
    matchWins: Math.max(0, Math.floor(Number(raw.matchWins) || 0)),
    matchWinStreak: streak,
    matchBestWinStreak: Math.max(
      Math.max(0, Math.floor(Number(raw.matchBestWinStreak) || 0)),
      streak,
    ),
    matchBestRuns: Math.max(0, Math.floor(Number(raw.matchBestRuns) || 0)),
    derbyBestHrs: Math.max(0, Math.floor(Number(raw.derbyBestHrs) || 0)),
    derbyBestDist: Math.max(0, Number(raw.derbyBestDist) || 0),
  };
}

function emptyMap(): BestsMap {
  return {
    easy: { ...EMPTY_BESTS },
    normal: { ...EMPTY_BESTS },
    hard: { ...EMPTY_BESTS },
  };
}

export function loadBestsMap(storage: StorageLike | null = readStorage()): BestsMap {
  const map = emptyMap();
  if (!storage) return map;
  try {
    const rawV2 = storage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<Record<Difficulty, Partial<BaseballBests>>>;
      for (const d of DIFFICULTIES) {
        map[d] = normalize(parsed[d]);
      }
      return map;
    }
    // Migrate legacy flat bests into normal.
    const legacy = storage.getItem(STORAGE_KEY);
    if (legacy) {
      map.normal = normalize(JSON.parse(legacy) as Partial<BaseballBests>);
      try {
        storage.setItem(STORAGE_KEY_V2, JSON.stringify(map));
      } catch {
        /* private mode */
      }
    }
  } catch {
    /* ignore */
  }
  return map;
}

export function loadBests(
  difficulty: Difficulty = 'normal',
  storage: StorageLike | null = readStorage(),
): BaseballBests {
  return loadBestsMap(storage)[difficulty] ?? { ...EMPTY_BESTS };
}

export function saveBests(
  difficulty: Difficulty,
  bests: BaseballBests,
  storage: StorageLike | null = readStorage(),
): void {
  if (!storage) return;
  try {
    const map = loadBestsMap(storage);
    map[difficulty] = normalize(bests);
    storage.setItem(STORAGE_KEY_V2, JSON.stringify(map));
  } catch {
    /* private mode / quota — bests are nice-to-have */
  }
}

/** Apply a finished match (player = away, CPU = home). */
export function updateMatchBests(
  prev: BaseballBests,
  playerRuns: number,
  cpuRuns: number,
): BaseballBests {
  const next = { ...normalize(prev) };
  if (playerRuns > cpuRuns) {
    next.matchWins += 1;
    next.matchWinStreak += 1;
    next.matchBestWinStreak = Math.max(next.matchBestWinStreak, next.matchWinStreak);
    next.matchBestRuns = Math.max(next.matchBestRuns, Math.floor(playerRuns));
  } else {
    next.matchWinStreak = 0;
  }
  return next;
}

/** Apply a finished derby session totals. */
export function updateDerbyBests(
  prev: BaseballBests,
  hrs: number,
  bestDist: number,
): BaseballBests {
  const next = { ...normalize(prev) };
  next.derbyBestHrs = Math.max(next.derbyBestHrs, Math.floor(hrs));
  next.derbyBestDist = Math.max(next.derbyBestDist, bestDist);
  return next;
}
