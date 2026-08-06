// Career stats for vs-CPU Toy Boxing (localStorage replay hook).

import type { Difficulty } from './cpuAi.ts';

export const STATS_KEY = 'clubhouse-toy-boxing-stats';

export type FightOutcome = 'win' | 'loss' | 'draw';

export interface CareerStats {
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  lastDifficulty: Difficulty;
}

export const DEFAULT_STATS: CareerStats = {
  wins: 0,
  losses: 0,
  draws: 0,
  winStreak: 0,
  lastDifficulty: 'normal',
};

const DIFFICULTIES: ReadonlySet<string> = new Set(['easy', 'normal', 'hard']);

function asNonNegInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Merge partial / corrupt storage into a valid CareerStats. */
export function mergeStats(raw: unknown): CareerStats {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATS };
  const o = raw as Partial<CareerStats>;
  const lastDifficulty =
    typeof o.lastDifficulty === 'string' && DIFFICULTIES.has(o.lastDifficulty)
      ? (o.lastDifficulty as Difficulty)
      : DEFAULT_STATS.lastDifficulty;
  return {
    wins: asNonNegInt(o.wins),
    losses: asNonNegInt(o.losses),
    draws: asNonNegInt(o.draws),
    winStreak: asNonNegInt(o.winStreak),
    lastDifficulty,
  };
}

export function recordResult(stats: CareerStats, outcome: FightOutcome): CareerStats {
  if (outcome === 'win') {
    return {
      ...stats,
      wins: stats.wins + 1,
      winStreak: stats.winStreak + 1,
    };
  }
  if (outcome === 'loss') {
    return {
      ...stats,
      losses: stats.losses + 1,
      winStreak: 0,
    };
  }
  return {
    ...stats,
    draws: stats.draws + 1,
    winStreak: 0,
  };
}

export function withDifficulty(stats: CareerStats, difficulty: Difficulty): CareerStats {
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

export function loadStats(storage: StorageLike | null = defaultStorage()): CareerStats {
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
  stats: CareerStats,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STATS_KEY, JSON.stringify(mergeStats(stats)));
  } catch {
    // ponytail: quota / private mode — skip persist
  }
}
