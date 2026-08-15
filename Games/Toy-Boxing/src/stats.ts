// Career stats for vs-CPU Toy Boxing (localStorage replay hook).

import type { Difficulty } from './cpuAi.ts';

export const STATS_KEY = 'clubhouse-toy-boxing-stats';

export type FightOutcome = 'win' | 'loss' | 'draw';

export interface ModeStats {
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
  bestWinStreak: number;
}

export interface CareerStats {
  lastDifficulty: Difficulty;
  byDifficulty: Record<Difficulty, ModeStats>;
}

export const EMPTY_MODE: ModeStats = {
  wins: 0,
  losses: 0,
  draws: 0,
  winStreak: 0,
  bestWinStreak: 0,
};

const DIFFICULTY_LIST: Difficulty[] = ['easy', 'normal', 'hard'];
const DIFFICULTIES: ReadonlySet<string> = new Set(DIFFICULTY_LIST);

function asNonNegInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function emptyByDifficulty(): Record<Difficulty, ModeStats> {
  return {
    easy: { ...EMPTY_MODE },
    normal: { ...EMPTY_MODE },
    hard: { ...EMPTY_MODE },
  };
}

function normalizeMode(raw: unknown): ModeStats {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_MODE };
  const o = raw as Partial<ModeStats>;
  const winStreak = asNonNegInt(o.winStreak);
  return {
    wins: asNonNegInt(o.wins),
    losses: asNonNegInt(o.losses),
    draws: asNonNegInt(o.draws),
    winStreak,
    bestWinStreak: Math.max(asNonNegInt(o.bestWinStreak), winStreak),
  };
}

/** Merge partial / corrupt storage into a valid CareerStats. */
export function mergeStats(raw: unknown): CareerStats {
  const byDifficulty = emptyByDifficulty();
  if (!raw || typeof raw !== 'object') {
    return { lastDifficulty: 'normal', byDifficulty };
  }
  const o = raw as Record<string, unknown>;
  const lastDifficulty =
    typeof o.lastDifficulty === 'string' && DIFFICULTIES.has(o.lastDifficulty)
      ? (o.lastDifficulty as Difficulty)
      : 'normal';

  if (o.byDifficulty && typeof o.byDifficulty === 'object') {
    const map = o.byDifficulty as Partial<Record<Difficulty, unknown>>;
    for (const d of DIFFICULTY_LIST) {
      byDifficulty[d] = normalizeMode(map[d]);
    }
    return { lastDifficulty, byDifficulty };
  }

  // Legacy flat career → migrate into normal.
  byDifficulty.normal = normalizeMode({
    wins: o.wins,
    losses: o.losses,
    draws: o.draws,
    winStreak: o.winStreak,
    bestWinStreak: o.winStreak,
  });
  return { lastDifficulty, byDifficulty };
}

export function modeStats(stats: CareerStats, difficulty: Difficulty): ModeStats {
  return stats.byDifficulty[difficulty] ?? { ...EMPTY_MODE };
}

export function recordResult(
  stats: CareerStats,
  outcome: FightOutcome,
  difficulty: Difficulty = stats.lastDifficulty,
): CareerStats {
  const merged = mergeStats(stats);
  const d = DIFFICULTIES.has(difficulty) ? difficulty : merged.lastDifficulty;
  const mode = { ...merged.byDifficulty[d] };
  if (outcome === 'win') {
    mode.wins += 1;
    mode.winStreak += 1;
    mode.bestWinStreak = Math.max(mode.bestWinStreak, mode.winStreak);
  } else if (outcome === 'loss') {
    mode.losses += 1;
    mode.winStreak = 0;
  } else {
    mode.draws += 1;
    mode.winStreak = 0;
  }
  return {
    lastDifficulty: d,
    byDifficulty: { ...merged.byDifficulty, [d]: mode },
  };
}

export function withDifficulty(stats: CareerStats, difficulty: Difficulty): CareerStats {
  const merged = mergeStats(stats);
  const d = DIFFICULTIES.has(difficulty) ? difficulty : merged.lastDifficulty;
  return { ...merged, lastDifficulty: d };
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
  if (!storage) return mergeStats(null);
  try {
    const raw = storage.getItem(STATS_KEY);
    if (!raw) return mergeStats(null);
    return mergeStats(JSON.parse(raw));
  } catch {
    return mergeStats(null);
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

/** @deprecated use mergeStats(null); kept for check imports */
export const DEFAULT_STATS: CareerStats = mergeStats(null);
