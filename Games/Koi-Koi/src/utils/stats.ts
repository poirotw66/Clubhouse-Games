import type { Difficulty } from './botAi';

export const STATS_KEY = 'clubhouse-koi-koi-stats';

export type MatchOutcome = 'win' | 'loss';

export interface MatchStats {
  wins: number;
  losses: number;
  winStreak: number;
  lastDifficulty: Difficulty;
}

export const DEFAULT_STATS: MatchStats = {
  wins: 0,
  losses: 0,
  winStreak: 0,
  lastDifficulty: 'normal',
};

const DIFFICULTIES: ReadonlySet<string> = new Set(['easy', 'normal', 'hard']);

function asNonNegInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Merge partial / corrupt storage into a valid MatchStats. */
export function mergeStats(raw: unknown): MatchStats {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATS };
  const o = raw as Partial<MatchStats>;
  const lastDifficulty =
    typeof o.lastDifficulty === 'string' && DIFFICULTIES.has(o.lastDifficulty)
      ? (o.lastDifficulty as Difficulty)
      : DEFAULT_STATS.lastDifficulty;
  return {
    wins: asNonNegInt(o.wins),
    losses: asNonNegInt(o.losses),
    winStreak: asNonNegInt(o.winStreak),
    lastDifficulty,
  };
}

export function recordResult(stats: MatchStats, outcome: MatchOutcome): MatchStats {
  if (outcome === 'win') {
    return {
      ...stats,
      wins: stats.wins + 1,
      winStreak: stats.winStreak + 1,
    };
  }
  return {
    ...stats,
    losses: stats.losses + 1,
    winStreak: 0,
  };
}

export function withDifficulty(stats: MatchStats, difficulty: Difficulty): MatchStats {
  return { ...stats, lastDifficulty: difficulty };
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadStats(storage: StorageLike | null = defaultStorage()): MatchStats {
  if (!storage) return { ...DEFAULT_STATS };
  try {
    const raw = storage.getItem(STATS_KEY);
    if (!raw) return { ...DEFAULT_STATS };
    return mergeStats(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_STATS };
  }
}

export function saveStats(
  stats: MatchStats,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STATS_KEY, JSON.stringify(mergeStats(stats)));
  } catch {
    // ponytail: quota / private mode — skip persist
  }
}
