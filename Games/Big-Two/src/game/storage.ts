import { formatKeyFor, isSeriesMode } from './match';
import { opponentCount } from './opponents';
import type {
  DailyRecord,
  DifficultyId,
  FormatKey,
  FormatRecord,
  MatchConfig,
  MatchLength,
  MatchMode,
  MatchState,
  NamedOpponentId,
  StraightRule,
  TargetScore,
} from './types';

const STATS_KEY = 'big-two:stats:v1';
const MATCH_KEY = 'big-two:match:v1';
const DAILY_KEY = 'big-two:daily:v1';
const LADDER_KEY = 'big-two:ladder:v1';

export type FormatRecords = Record<FormatKey, FormatRecord>;

export interface Stats {
  games: number;
  wins: number;
  /** Running total of pot won minus penalties paid (per hand). */
  chips: number;
  bestPot: number;
  streak: number;
  bestStreak: number;
  /** Completed series (fixed hands, race-to-target, or daily). Single hands use formats.single. */
  matches: number;
  matchWins: number;
  matchStreak: number;
  bestMatchStreak: number;
  /** Best end-of-match chip total as the human. */
  bestMatchChips: number;
  /** Per-format records（賽制戰績）. */
  formats: FormatRecords;
  lastDifficulty: DifficultyId;
  lastStraights: StraightRule;
  lastMatchMode: MatchMode;
  lastMatchHands: MatchLength;
  lastMatchTarget: TargetScore;
  lastSizeLadder: boolean;
  lastDeuceDouble: boolean;
}

export interface LadderProgress {
  /** Opponents with index < clearedCount are cleared; index === clearedCount is unlocked. */
  clearedCount: number;
  cleared: Partial<Record<NamedOpponentId, boolean>>;
  lastIndex: number;
}

export interface DailyProgress {
  records: DailyRecord[];
}

const EMPTY_FORMAT: FormatRecord = { played: 0, wins: 0 };

export const EMPTY_FORMATS: FormatRecords = {
  single: { ...EMPTY_FORMAT },
  'hands-4': { ...EMPTY_FORMAT },
  'hands-8': { ...EMPTY_FORMAT },
  'hands-12': { ...EMPTY_FORMAT },
  'target-50': { ...EMPTY_FORMAT },
  'target-100': { ...EMPTY_FORMAT },
  'target-200': { ...EMPTY_FORMAT },
  daily: { ...EMPTY_FORMAT },
};

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
  formats: { ...EMPTY_FORMATS },
  lastDifficulty: 'normal',
  lastStraights: 'topCard',
  lastMatchMode: 'hands',
  lastMatchHands: 4,
  lastMatchTarget: 100,
  lastSizeLadder: true,
  lastDeuceDouble: true,
};

export const EMPTY_LADDER: LadderProgress = {
  clearedCount: 0,
  cleared: {},
  lastIndex: 0,
};

export const EMPTY_DAILY: DailyProgress = { records: [] };

const DIFFICULTIES = new Set<string>(['easy', 'normal', 'hard']);
const STRAIGHTS = new Set<string>(['topCard', 'sequence']);
const MODES = new Set<string>(['single', 'hands', 'target', 'daily']);
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
      formats: loadFormats(parsed.formats),
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
  config?: MatchConfig,
): Stats {
  const formats = { ...stats.formats };
  const key = config ? formatKeyFor(config) : null;
  if (key) {
    const prev = formats[key] ?? { played: 0, wins: 0 };
    formats[key] = {
      played: prev.played + 1,
      wins: prev.wins + (won ? 1 : 0),
    };
  }

  // Single-hand sessions tally format.single only — not series match streaks.
  if (config && !isSeriesMode(config.mode)) {
    return { ...stats, formats };
  }

  const matchStreak = won ? stats.matchStreak + 1 : 0;
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
    lastStraights: config.rules.straights,
    lastMatchMode: config.mode === 'daily' ? stats.lastMatchMode : config.mode,
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

export function loadDailyProgress(): DailyProgress {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return EMPTY_DAILY;
    const parsed = JSON.parse(raw) as { records?: unknown };
    if (!Array.isArray(parsed.records)) return EMPTY_DAILY;
    const records: DailyRecord[] = [];
    for (const item of parsed.records) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Partial<DailyRecord>;
      if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
      records.push({
        date: r.date,
        bestChips: num(r.bestChips, 0),
        completed: Boolean(r.completed),
        attempts: num(r.attempts, 0),
      });
    }
    records.sort((a, b) => a.date.localeCompare(b.date));
    return { records: records.slice(-60) };
  } catch {
    return EMPTY_DAILY;
  }
}

export function saveDailyProgress(progress: DailyProgress): void {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function recordDailyResult(
  progress: DailyProgress,
  date: string,
  endChips: number,
  completed: boolean,
): DailyProgress {
  const existing = progress.records.find((r) => r.date === date);
  const next: DailyRecord = existing
    ? {
        date,
        bestChips: Math.max(existing.bestChips, endChips),
        completed: existing.completed || completed,
        attempts: existing.attempts + 1,
      }
    : {
        date,
        bestChips: endChips,
        completed,
        attempts: 1,
      };
  const others = progress.records.filter((r) => r.date !== date);
  others.push(next);
  others.sort((a, b) => a.date.localeCompare(b.date));
  return { records: others.slice(-60) };
}

export function loadLadder(): LadderProgress {
  try {
    const raw = localStorage.getItem(LADDER_KEY);
    if (!raw) return EMPTY_LADDER;
    const parsed = JSON.parse(raw) as Partial<LadderProgress>;
    const clearedCount = Math.max(
      0,
      Math.min(opponentCount(), Math.floor(num(parsed.clearedCount, 0))),
    );
    const cleared: Partial<Record<NamedOpponentId, boolean>> = {};
    if (parsed.cleared && typeof parsed.cleared === 'object') {
      for (const [id, val] of Object.entries(parsed.cleared)) {
        if (val) cleared[id as NamedOpponentId] = true;
      }
    }
    return {
      clearedCount,
      cleared,
      lastIndex: Math.max(0, Math.min(opponentCount() - 1, Math.floor(num(parsed.lastIndex, 0)))),
    };
  } catch {
    return EMPTY_LADDER;
  }
}

export function saveLadder(progress: LadderProgress): void {
  try {
    localStorage.setItem(LADDER_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

/** Apply a finished ladder duel. Winning the frontier opponent unlocks the next. */
export function applyLadderResult(
  progress: LadderProgress,
  opponentIndex: number,
  won: boolean,
  opponentId: NamedOpponentId,
): LadderProgress {
  const cleared = { ...progress.cleared };
  let clearedCount = progress.clearedCount;
  if (won) {
    cleared[opponentId] = true;
    if (opponentIndex === clearedCount && clearedCount < opponentCount()) {
      clearedCount = opponentIndex + 1;
    }
  }
  return {
    clearedCount,
    cleared,
    lastIndex: opponentIndex,
  };
}
