/** Personal bests for Toy Baseball (localStorage replay hook). */

export const STORAGE_KEY = 'clubhouse-toy-baseball-best';

export interface BaseballBests {
  /** Career wins vs CPU in match mode. */
  matchWins: number;
  /** Current win streak vs CPU (resets on loss or tie). */
  matchWinStreak: number;
  /** Most runs scored in a single won match. */
  matchBestRuns: number;
  /** Best home-run count in one derby session. */
  derbyBestHrs: number;
  /** Best single-hit distance in derby (screen units). */
  derbyBestDist: number;
}

export const EMPTY_BESTS: BaseballBests = {
  matchWins: 0,
  matchWinStreak: 0,
  matchBestRuns: 0,
  derbyBestHrs: 0,
  derbyBestDist: 0,
};

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
  return {
    matchWins: Math.max(0, Math.floor(Number(raw.matchWins) || 0)),
    matchWinStreak: Math.max(0, Math.floor(Number(raw.matchWinStreak) || 0)),
    matchBestRuns: Math.max(0, Math.floor(Number(raw.matchBestRuns) || 0)),
    derbyBestHrs: Math.max(0, Math.floor(Number(raw.derbyBestHrs) || 0)),
    derbyBestDist: Math.max(0, Number(raw.derbyBestDist) || 0),
  };
}

export function loadBests(storage: StorageLike | null = readStorage()): BaseballBests {
  if (!storage) return { ...EMPTY_BESTS };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_BESTS };
    return normalize(JSON.parse(raw) as Partial<BaseballBests>);
  } catch {
    return { ...EMPTY_BESTS };
  }
}

export function saveBests(
  bests: BaseballBests,
  storage: StorageLike | null = readStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalize(bests)));
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
