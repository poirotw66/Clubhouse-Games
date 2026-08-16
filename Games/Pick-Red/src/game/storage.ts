import type { DifficultyId } from './types';

const KEY = 'pick-red:stats:v1';

export interface Stats {
  wins: number;
  losses: number;
  draws: number;
  best: number;
  streak: number;
  bestStreak: number;
  lastDifficulty: DifficultyId;
}

export const EMPTY_STATS: Stats = {
  wins: 0,
  losses: 0,
  draws: 0,
  best: 0,
  streak: 0,
  bestStreak: 0,
  lastDifficulty: 'normal',
};

const DIFFICULTIES = new Set<string>(['easy', 'normal', 'hard']);

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Field by field rather than a blanket cast, so a save written by an older
 * build loses only the fields that actually changed shape instead of being
 * thrown away or, worse, trusted wholesale.
 */
export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof Stats, unknown>>;
    return {
      wins: num(parsed.wins, 0),
      losses: num(parsed.losses, 0),
      draws: num(parsed.draws, 0),
      best: num(parsed.best, 0),
      streak: num(parsed.streak, 0),
      bestStreak: num(parsed.bestStreak, 0),
      lastDifficulty: DIFFICULTIES.has(parsed.lastDifficulty as string)
        ? (parsed.lastDifficulty as DifficultyId)
        : 'normal',
    };
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(stats: Stats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // Private browsing and full quotas both throw here; the game plays fine
    // without a record of it.
  }
}

export function recordResult(
  stats: Stats,
  result: 'win' | 'loss' | 'draw',
  points: number,
): Stats {
  const streak = result === 'win' ? stats.streak + 1 : 0;
  return {
    ...stats,
    wins: stats.wins + (result === 'win' ? 1 : 0),
    losses: stats.losses + (result === 'loss' ? 1 : 0),
    draws: stats.draws + (result === 'draw' ? 1 : 0),
    best: Math.max(stats.best, points),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
  };
}
