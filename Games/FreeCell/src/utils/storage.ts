/**
 * localStorage for career stats, daily history, settings, and challenge clears.
 * Migrates the legacy `clubhouse-freecell-stats` wins / best times.
 */

import type { ChallengeId } from './challenges.ts';
import type { DailyRecord } from './daily.ts';
import type { PlayMode } from './scoring.ts';

const STATS_KEY = 'clubhouse:freecell:stats:v2';
const LEGACY_STATS_KEY = 'clubhouse-freecell-stats';
const SETTINGS_KEY = 'clubhouse:freecell:settings:v1';
const LEGACY_MODE_KEY = 'clubhouse-freecell-mode';
const LEGACY_AUTO_KEY = 'clubhouse-freecell-auto-move';
const DAILY_KEY = 'clubhouse:freecell:daily';

export type Difficulty = 'any' | 'easy' | 'medium' | 'hard';
export type FreeCellSlots = 2 | 4;
export type ModeKey = `${PlayMode}-${FreeCellSlots}`;

export interface ModeStats {
  plays: number;
  wins: number;
  bestScore: number | null;
  bestTimeSec: number | null;
  bestMoves: number | null;
}

export interface FreeCellStats {
  plays: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  byMode: Partial<Record<ModeKey, ModeStats>>;
  /** Per-deal bests keyed by seed string. */
  byDeal: Record<string, { bestTimeSec: number | null; bestMoves: number | null; bestScore: number | null }>;
  challengesCleared: Partial<Record<ChallengeId, number>>;
}

export interface FreeCellSettings {
  playMode: PlayMode;
  autoMove: boolean;
  playDaily: boolean;
  difficulty: Difficulty;
  freeCellSlots: FreeCellSlots;
}

function emptyMode(): ModeStats {
  return {
    plays: 0,
    wins: 0,
    bestScore: null,
    bestTimeSec: null,
    bestMoves: null,
  };
}

export function modeKey(playMode: PlayMode, freeCellSlots: FreeCellSlots): ModeKey {
  return `${playMode}-${freeCellSlots}`;
}

function emptyStats(): FreeCellStats {
  return {
    plays: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    byMode: {},
    byDeal: {},
    challengesCleared: {},
  };
}

function migrateLegacy(): FreeCellStats | null {
  try {
    const raw = localStorage.getItem(LEGACY_STATS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      wins?: number;
      bestByMode?: { classic?: number | null; timed?: number | null };
      bestTimeSec?: number | null;
    };
    const next = emptyStats();
    next.wins = Number(parsed.wins) || 0;
    next.plays = next.wins;
    const classic = parsed.bestByMode?.classic ?? parsed.bestTimeSec ?? null;
    const timed = parsed.bestByMode?.timed ?? null;
    if (classic != null && Number.isFinite(Number(classic))) {
      next.byMode['classic-4'] = {
        ...emptyMode(),
        wins: next.wins,
        plays: next.wins,
        bestTimeSec: Number(classic),
      };
    }
    if (timed != null && Number.isFinite(Number(timed))) {
      next.byMode['timed-4'] = {
        ...emptyMode(),
        bestTimeSec: Number(timed),
      };
    }
    return next;
  } catch {
    return null;
  }
}

export function loadStats(): FreeCellStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) {
      const migrated = migrateLegacy();
      if (migrated) {
        saveStats(migrated);
        return migrated;
      }
      return emptyStats();
    }
    const parsed = JSON.parse(raw) as Partial<FreeCellStats>;
    return {
      plays: Number(parsed.plays) || 0,
      wins: Number(parsed.wins) || 0,
      currentStreak: Number(parsed.currentStreak) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
      byMode: parsed.byMode && typeof parsed.byMode === 'object' ? { ...parsed.byMode } : {},
      byDeal: parsed.byDeal && typeof parsed.byDeal === 'object' ? { ...parsed.byDeal } : {},
      challengesCleared:
        parsed.challengesCleared && typeof parsed.challengesCleared === 'object'
          ? { ...parsed.challengesCleared }
          : {},
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: FreeCellStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore quota */
  }
}

export function winRate(stats: FreeCellStats): number {
  if (stats.plays <= 0) return 0;
  return stats.wins / stats.plays;
}

export type GameResultInput = {
  won: boolean;
  playMode: PlayMode;
  freeCellSlots: FreeCellSlots;
  seed: number;
  score: number;
  elapsedSec: number;
  moves: number;
  clearedChallenges: ChallengeId[];
};

export function recordGameResult(prev: FreeCellStats, input: GameResultInput): FreeCellStats {
  const key = modeKey(input.playMode, input.freeCellSlots);
  const mode = { ...(prev.byMode[key] ?? emptyMode()) };
  mode.plays += 1;
  if (input.won) {
    mode.wins += 1;
    if (mode.bestScore == null || input.score > mode.bestScore) mode.bestScore = input.score;
    if (mode.bestTimeSec == null || input.elapsedSec < mode.bestTimeSec) {
      mode.bestTimeSec = input.elapsedSec;
    }
    if (mode.bestMoves == null || input.moves < mode.bestMoves) mode.bestMoves = input.moves;
  }

  const byDeal = { ...prev.byDeal };
  if (input.won) {
    const dealKey = String(input.seed);
    const prevDeal = byDeal[dealKey] ?? {
      bestTimeSec: null,
      bestMoves: null,
      bestScore: null,
    };
    byDeal[dealKey] = {
      bestScore:
        prevDeal.bestScore == null || input.score > prevDeal.bestScore
          ? input.score
          : prevDeal.bestScore,
      bestTimeSec:
        prevDeal.bestTimeSec == null || input.elapsedSec < prevDeal.bestTimeSec
          ? input.elapsedSec
          : prevDeal.bestTimeSec,
      bestMoves:
        prevDeal.bestMoves == null || input.moves < prevDeal.bestMoves
          ? input.moves
          : prevDeal.bestMoves,
    };
  }

  const currentStreak = input.won ? prev.currentStreak + 1 : 0;
  const challengesCleared = { ...prev.challengesCleared };
  for (const id of input.clearedChallenges) {
    challengesCleared[id] = (challengesCleared[id] ?? 0) + 1;
  }

  const next: FreeCellStats = {
    plays: prev.plays + 1,
    wins: prev.wins + (input.won ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(prev.bestStreak, currentStreak),
    byMode: { ...prev.byMode, [key]: mode },
    byDeal,
    challengesCleared,
  };
  saveStats(next);
  return next;
}

function normalizeDifficulty(value: unknown): Difficulty {
  if (value === 'easy' || value === 'medium' || value === 'hard' || value === 'any') {
    return value;
  }
  return 'any';
}

export function loadSettings(): FreeCellSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FreeCellSettings>;
      return {
        playMode: parsed.playMode === 'timed' ? 'timed' : 'classic',
        autoMove: parsed.autoMove !== false,
        playDaily: Boolean(parsed.playDaily),
        difficulty: normalizeDifficulty(parsed.difficulty),
        freeCellSlots: parsed.freeCellSlots === 2 ? 2 : 4,
      };
    }
  } catch {
    /* fall through */
  }
  const legacyMode = localStorage.getItem(LEGACY_MODE_KEY);
  const legacyAuto = localStorage.getItem(LEGACY_AUTO_KEY);
  return {
    playMode: legacyMode === 'timed' ? 'timed' : 'classic',
    autoMove: legacyAuto === null ? true : legacyAuto === '1',
    playDaily: false,
    difficulty: 'any',
    freeCellSlots: 4,
  };
}

export function saveSettings(settings: FreeCellSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(LEGACY_MODE_KEY, settings.playMode);
    localStorage.setItem(LEGACY_AUTO_KEY, settings.autoMove ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadDaily(): DailyRecord[] {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyRecord[];
    return Array.isArray(parsed)
      ? parsed.filter((r) => r && typeof r.date === 'string')
      : [];
  } catch {
    return [];
  }
}

/** One record per day; keep a win over a loss, else better score then fewer moves. */
export function recordDaily(record: DailyRecord): DailyRecord[] {
  const existing = loadDaily();
  const previous = existing.find((r) => r.date === record.date);
  const better = (a: DailyRecord, b: DailyRecord): DailyRecord => {
    if (a.won !== b.won) return a.won ? a : b;
    if (a.score !== b.score) return a.score > b.score ? a : b;
    if (a.moves !== b.moves) return a.moves < b.moves ? a : b;
    return a.elapsedSec <= b.elapsedSec ? a : b;
  };
  const next = previous
    ? existing.map((r) => (r.date === record.date ? better(previous, record) : r))
    : [...existing, record];
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
