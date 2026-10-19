import type {
  DifficultyId,
  MatchConfig,
  MatchLength,
  MatchMode,
  MatchState,
  StraightRule,
  TargetScore,
} from './types';

const STATS_KEY = 'big-two:stats:v1';
const MATCH_KEY = 'big-two:match:v1';

export interface Stats {
  games: number;
  wins: number;
  /** Running total of pot won minus penalties paid (per hand). */
  chips: number;
  bestPot: number;
  streak: number;
  bestStreak: number;
  /** Completed series (fixed hands or race-to-target). */
  matches: number;
  matchWins: number;
  matchStreak: number;
  bestMatchStreak: number;
  /** Best end-of-match chip total as the human. */
  bestMatchChips: number;
  lastDifficulty: DifficultyId;
  lastStraights: StraightRule;
  lastMatchMode: MatchMode;
  lastMatchHands: MatchLength;
  lastMatchTarget: TargetScore;
  lastSizeLadder: boolean;
  lastDeuceDouble: boolean;
}

export const EMPTY_STATS: Stats = {
  games: 0,
  wins: 0,
  chips: 0,
  bestPot: 0,
  streak: 0,
  bestStreak: 0,
  matches: 0,
  matchWins: 0,
  matchStreak: 0,
  bestMatchStreak: 0,
  bestMatchChips: 0,
  lastDifficulty: 'normal',
  lastStraights: 'topCard',
  lastMatchMode: 'hands',
  lastMatchHands: 4,
  lastMatchTarget: 100,
  lastSizeLadder: true,
  lastDeuceDouble: true,
};

const DIFFICULTIES = new Set<string>(['easy', 'normal', 'hard']);
const STRAIGHTS = new Set<string>(['topCard', 'sequence']);
const MODES = new Set<string>(['hands', 'target']);
const HANDS = new Set<number>([4, 8, 12]);
const TARGETS = new Set<number>([50, 100, 200]);

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Field by field rather than a blanket cast, so a save written by an older
 * build loses only the fields that actually changed shape.
 */
export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return EMPTY_STATS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof Stats, unknown>>;
    return {
      games: num(parsed.games, 0),
      wins: num(parsed.wins, 0),
      chips: num(parsed.chips, 0),
      bestPot: num(parsed.bestPot, 0),
      streak: num(parsed.streak, 0),
      bestStreak: num(parsed.bestStreak, 0),
      matches: num(parsed.matches, 0),
      matchWins: num(parsed.matchWins, 0),
      matchStreak: num(parsed.matchStreak, 0),
      bestMatchStreak: num(parsed.bestMatchStreak, 0),
      bestMatchChips: num(parsed.bestMatchChips, 0),
      lastDifficulty: DIFFICULTIES.has(parsed.lastDifficulty as string)
        ? (parsed.lastDifficulty as DifficultyId)
        : 'normal',
      lastStraights: STRAIGHTS.has(parsed.lastStraights as string)
        ? (parsed.lastStraights as StraightRule)
        : 'topCard',
      lastMatchMode: MODES.has(parsed.lastMatchMode as string)
        ? (parsed.lastMatchMode as MatchMode)
        : 'hands',
      lastMatchHands: HANDS.has(parsed.lastMatchHands as number)
        ? (parsed.lastMatchHands as MatchLength)
        : 4,
      lastMatchTarget: TARGETS.has(parsed.lastMatchTarget as number)
        ? (parsed.lastMatchTarget as TargetScore)
        : 100,
      lastSizeLadder: bool(parsed.lastSizeLadder, true),
      lastDeuceDouble: bool(parsed.lastDeuceDouble, true),
    };
  } catch {
    return EMPTY_STATS;
  }
}

export function saveStats(stats: Stats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Private browsing and full quotas both throw here; the game plays fine
    // without a record of it.
  }
}

export function recordHandResult(stats: Stats, won: boolean, delta: number): Stats {
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

/** @deprecated Use recordHandResult — kept so older check imports still resolve. */
export const recordResult = recordHandResult;

export function recordMatchResult(
  stats: Stats,
  won: boolean,
  endChips: number,
): Stats {
  const matchStreak = won ? stats.matchStreak + 1 : 0;
  return {
    ...stats,
    matches: stats.matches + 1,
    matchWins: stats.matchWins + (won ? 1 : 0),
    matchStreak,
    bestMatchStreak: Math.max(stats.bestMatchStreak, matchStreak),
    bestMatchChips: Math.max(stats.bestMatchChips, endChips),
  };
}

export function rememberSetup(stats: Stats, config: MatchConfig): Stats {
  return {
    ...stats,
    lastDifficulty: config.difficulty,
    lastStraights: config.rules.straights,
    lastMatchMode: config.mode,
    lastMatchHands: config.hands,
    lastMatchTarget: config.target,
    lastSizeLadder: config.rules.sizeLadder,
    lastDeuceDouble: config.rules.deuceDouble,
  };
}

export function saveMatch(match: MatchState): void {
  try {
    localStorage.setItem(MATCH_KEY, JSON.stringify(match));
  } catch {
    /* ignore */
  }
}

export function clearSavedMatch(): void {
  try {
    localStorage.removeItem(MATCH_KEY);
  } catch {
    /* ignore */
  }
}

export function loadMatch(): MatchState | null {
  try {
    const raw = localStorage.getItem(MATCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MatchState;
    if (!parsed || !parsed.config || !Array.isArray(parsed.balances)) return null;
    if (parsed.balances.length !== 4) return null;
    return parsed;
  } catch {
    return null;
  }
}
