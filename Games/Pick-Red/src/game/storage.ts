import { formatKeyFor, isSeriesMode } from './match';
import type {
  DifficultyId,
  FormatKey,
  FormatRecord,
  MatchConfig,
  MatchLength,
  MatchMode,
  MatchState,
  PlayerCount,
  TargetScore,
} from './types';

const STATS_KEY = 'pick-red:stats:v1';
const MATCH_KEY = 'pick-red:match:v1';

export type FormatRecords = Record<FormatKey, FormatRecord>;

export interface Stats {
  wins: number;
  losses: number;
  draws: number;
  best: number;
  streak: number;
  bestStreak: number;
  /** Lifetime chip total from settled hands. */
  chips: number;
  /** Completed series (fixed hands or race-to-target). Single hands do not count. */
  matches: number;
  matchWins: number;
  matchStreak: number;
  bestMatchStreak: number;
  bestMatchChips: number;
  /** Per-format series records（賽制戰績）. */
  formats: FormatRecords;
  /** Hands where the human beat par. */
  qualified: number;
  doubleRedFives: number;
  zeroScores: number;
  lastDifficulty: DifficultyId;
  lastPlayers: PlayerCount;
  lastBlackAces: boolean;
  lastDoubleRedFive: boolean;
  lastZeroScoreBonus: boolean;
  lastRotateLeader: boolean;
  lastMatchMode: MatchMode;
  lastMatchHands: MatchLength;
  lastMatchTarget: TargetScore;
}

const EMPTY_FORMAT: FormatRecord = { played: 0, wins: 0 };

export const EMPTY_FORMATS: FormatRecords = {
  'hands-4': { ...EMPTY_FORMAT },
  'hands-8': { ...EMPTY_FORMAT },
  'hands-12': { ...EMPTY_FORMAT },
  'target-50': { ...EMPTY_FORMAT },
  'target-100': { ...EMPTY_FORMAT },
  'target-200': { ...EMPTY_FORMAT },
};

export const EMPTY_STATS: Stats = {
  wins: 0,
  losses: 0,
  draws: 0,
  best: 0,
  streak: 0,
  bestStreak: 0,
  chips: 0,
  matches: 0,
  matchWins: 0,
  matchStreak: 0,
  bestMatchStreak: 0,
  bestMatchChips: 0,
  formats: { ...EMPTY_FORMATS },
  qualified: 0,
  doubleRedFives: 0,
  zeroScores: 0,
  lastDifficulty: 'normal',
  lastPlayers: 2,
  lastBlackAces: false,
  lastDoubleRedFive: true,
  lastZeroScoreBonus: true,
  lastRotateLeader: true,
  lastMatchMode: 'hands',
  lastMatchHands: 4,
  lastMatchTarget: 100,
};

const DIFFICULTIES = new Set<string>(['easy', 'normal', 'hard']);
const MODES = new Set<string>(['single', 'hands', 'target']);
const HANDS = new Set<number>([4, 8, 12]);
const TARGETS = new Set<number>([50, 100, 200]);
const FORMAT_KEYS = Object.keys(EMPTY_FORMATS) as FormatKey[];

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function loadFormats(raw: unknown): FormatRecords {
  const out: FormatRecords = { ...EMPTY_FORMATS };
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Partial<Record<FormatKey, Partial<FormatRecord>>>;
  for (const key of FORMAT_KEYS) {
    const entry = src[key];
    out[key] = {
      played: num(entry?.played, 0),
      wins: num(entry?.wins, 0),
    };
  }
  return out;
}

/**
 * Field by field rather than a blanket cast, so a save written by an older
 * build loses only the fields that actually changed shape instead of being
 * thrown away or, worse, trusted wholesale.
 */
export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return EMPTY_STATS;
    const parsed = JSON.parse(raw) as Partial<Record<keyof Stats, unknown>>;
    return {
      wins: num(parsed.wins, 0),
      losses: num(parsed.losses, 0),
      draws: num(parsed.draws, 0),
      best: num(parsed.best, 0),
      streak: num(parsed.streak, 0),
      bestStreak: num(parsed.bestStreak, 0),
      chips: num(parsed.chips, 0),
      matches: num(parsed.matches, 0),
      matchWins: num(parsed.matchWins, 0),
      matchStreak: num(parsed.matchStreak, 0),
      bestMatchStreak: num(parsed.bestMatchStreak, 0),
      bestMatchChips: num(parsed.bestMatchChips, 0),
      formats: loadFormats(parsed.formats),
      qualified: num(parsed.qualified, 0),
      doubleRedFives: num(parsed.doubleRedFives, 0),
      zeroScores: num(parsed.zeroScores, 0),
      lastDifficulty: DIFFICULTIES.has(parsed.lastDifficulty as string)
        ? (parsed.lastDifficulty as DifficultyId)
        : 'normal',
      lastPlayers: ([2, 3, 4] as unknown[]).includes(parsed.lastPlayers)
        ? (parsed.lastPlayers as PlayerCount)
        : 2,
      lastBlackAces: parsed.lastBlackAces === true,
      lastDoubleRedFive: bool(parsed.lastDoubleRedFive, true),
      lastZeroScoreBonus: bool(parsed.lastZeroScoreBonus, true),
      lastRotateLeader: bool(parsed.lastRotateLeader, true),
      lastMatchMode: MODES.has(parsed.lastMatchMode as string)
        ? (parsed.lastMatchMode as MatchMode)
        : 'hands',
      lastMatchHands: HANDS.has(parsed.lastMatchHands as number)
        ? (parsed.lastMatchHands as MatchLength)
        : 4,
      lastMatchTarget: TARGETS.has(parsed.lastMatchTarget as number)
        ? (parsed.lastMatchTarget as TargetScore)
        : 100,
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

export function recordHandResult(
  stats: Stats,
  result: 'win' | 'loss' | 'draw',
  points: number,
  delta: number,
  didQualify: boolean,
  gotDoubleRedFive: boolean,
  gotZeroScore: boolean,
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
    chips: stats.chips + delta,
    qualified: stats.qualified + (didQualify ? 1 : 0),
    doubleRedFives: stats.doubleRedFives + (gotDoubleRedFive ? 1 : 0),
    zeroScores: stats.zeroScores + (gotZeroScore ? 1 : 0),
  };
}

/** @deprecated Use recordHandResult — kept so older check imports still resolve. */
export function recordResult(
  stats: Stats,
  result: 'win' | 'loss' | 'draw',
  points: number,
): Stats {
  return recordHandResult(stats, result, points, 0, false, false, false);
}

export function recordMatchResult(
  stats: Stats,
  won: boolean,
  endChips: number,
  config?: MatchConfig,
): Stats {
  // Single-hand sessions keep ordinary hand W/L only — not series tallies.
  if (config && !isSeriesMode(config.mode)) return stats;

  const matchStreak = won ? stats.matchStreak + 1 : 0;
  const formats = { ...stats.formats };
  const key = config ? formatKeyFor(config) : null;
  if (key) {
    const prev = formats[key] ?? { played: 0, wins: 0 };
    formats[key] = {
      played: prev.played + 1,
      wins: prev.wins + (won ? 1 : 0),
    };
  }

  return {
    ...stats,
    matches: stats.matches + 1,
    matchWins: stats.matchWins + (won ? 1 : 0),
    matchStreak,
    bestMatchStreak: Math.max(stats.bestMatchStreak, matchStreak),
    bestMatchChips: Math.max(stats.bestMatchChips, endChips),
    formats,
  };
}

export function rememberSetup(stats: Stats, config: MatchConfig): Stats {
  return {
    ...stats,
    lastDifficulty: config.difficulty,
    lastPlayers: config.rules.players,
    lastBlackAces: config.rules.blackAces,
    lastDoubleRedFive: config.rules.doubleRedFive,
    lastZeroScoreBonus: config.rules.zeroScoreBonus,
    lastRotateLeader: config.rules.rotateLeader,
    lastMatchMode: config.mode,
    lastMatchHands: config.hands,
    lastMatchTarget: config.target,
  };
}

export function saveMatch(match: MatchState): void {
  // Single hands are short; still persist mid-hand so a refresh can resume.
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
    const players = parsed.config.rules?.players;
    if (![2, 3, 4].includes(players)) return null;
    if (parsed.balances.length !== players) return null;
    if (!MODES.has(parsed.config.mode)) return null;
    return parsed;
  } catch {
    return null;
  }
}
