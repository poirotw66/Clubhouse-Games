import type { DifficultyId, StraightRule } from './types';

const KEY = 'big-two:stats:v1';

export interface Stats {
  games: number;
  wins: number;
  /** Running total of pot won minus penalties paid. */
  chips: number;
  bestPot: number;
  streak: number;
  bestStreak: number;
  lastDifficulty: DifficultyId;
  lastStraights: StraightRule;
}

export const EMPTY_STATS: Stats = {
  games: 0,
  wins: 0,
  chips: 0,
  bestPot: 0,
  streak: 0,
  bestStreak: 0,
  lastDifficulty: 'normal',
  lastStraights: 'topCard',
};

const DIFFICULTIES = new Set<string>(['easy', 'normal', 'hard']);
const STRAIGHTS = new Set<string>(['topCard', 'sequence']);

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Field by field rather than a blanket cast, so a save written by an older
 * build loses only the fields that actually changed shape.
 */
export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof Stats, unknown>>;
    return {
      games: num(parsed.games, 0),
      wins: num(parsed.wins, 0),
      chips: num(parsed.chips, 0),
      bestPot: num(parsed.bestPot, 0),
      streak: num(parsed.streak, 0),
      bestStreak: num(parsed.bestStreak, 0),
      lastDifficulty: DIFFICULTIES.has(parsed.lastDifficulty as string)
        ? (parsed.lastDifficulty as DifficultyId)
        : 'normal',
      lastStraights: STRAIGHTS.has(parsed.lastStraights as string)
        ? (parsed.lastStraights as StraightRule)
        : 'topCard',
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

export function recordResult(stats: Stats, won: boolean, delta: number): Stats {
  const streak = won ? stats.streak + 1 : 0;
  return {
    ...stats,
    games: stats.games + 1,
    wins: stats.wins + (won ? 1 : 0),
    chips: stats.chips + delta,
    bestPot: Math.max(stats.bestPot, won ? delta : 0),
    streak,
    bestStreak: Math.max(stats.bestStreak, streak),
  };
}
