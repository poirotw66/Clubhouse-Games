/**
 * localStorage for career stats, Vegas bankroll, daily history, and challenge clears.
 * Migrates the legacy `clubhouse-klondike-stats` wins / best times.
 */

import type { ChallengeId } from './challenges.ts';
import type { DailyRecord } from './daily.ts';
import type { ScoreMode } from './scoring.ts';
import type { DrawCount } from './gameLogic.ts';

const STATS_KEY = 'clubhouse:klondike:stats:v2';
const LEGACY_STATS_KEY = 'clubhouse-klondike-stats';
const SETTINGS_KEY = 'clubhouse:klondike:settings:v1';
const LEGACY_DRAW_KEY = 'clubhouse-klondike-draw';
const DAILY_KEY = 'clubhouse:klondike:daily';

export type ModeKey = `${DrawCount}-${ScoreMode}`;

export interface ModeStats {
  plays: number;
  wins: number;
  bestScore: number | null;
  bestTimeSec: number | null;
  bestMoves: number | null;
}

export interface KlondikeStats {
  plays: number;
  wins: number;
  currentStreak: number;
  bestStreak: number;
  vegasBankroll: number;
  byMode: Partial<Record<ModeKey, ModeStats>>;
  /** Cumulative clears per challenge id. */
  challengesCleared: Partial<Record<ChallengeId, number>>;
}

export interface KlondikeSettings {
  drawCount: DrawCount;
  scoreMode: ScoreMode;
  /** Prefer deals the thoughtful solver can clear. */
  solvableOnly: boolean;
  playDaily: boolean;
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

export function modeKey(draw: DrawCount, scoreMode: ScoreMode): ModeKey {
  return `${draw}-${scoreMode}`;
}

function emptyStats(): KlondikeStats {
  return {
    plays: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    vegasBankroll: 0,
    byMode: {},
    challengesCleared: {},
  };
}

function migrateLegacy(): KlondikeStats | null {
  try {
    const raw = localStorage.getItem(LEGACY_STATS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      wins?: number;
      bestByDraw?: { '1'?: number | null; '3'?: number | null };
      bestTimeSec?: number | null;
    };
    const next = emptyStats();
    next.wins = Number(parsed.wins) || 0;
    next.plays = next.wins;
    const b1 = parsed.bestByDraw?.['1'] ?? parsed.bestTimeSec ?? null;
    const b3 = parsed.bestByDraw?.['3'] ?? null;
    if (b1 != null && Number.isFinite(Number(b1))) {
      next.byMode['1-standard'] = {
        ...emptyMode(),
        wins: next.wins,
        plays: next.wins,
        bestTimeSec: Number(b1),
      };
    }
    if (b3 != null && Number.isFinite(Number(b3))) {
      next.byMode['3-standard'] = {
        ...emptyMode(),
        bestTimeSec: Number(b3),
      };
    }
    return next;
  } catch {
    return null;
  }
}

export function loadStats(): KlondikeStats {
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
    const parsed = JSON.parse(raw) as Partial<KlondikeStats>;
    const base = emptyStats();
    return {
      plays: Number(parsed.plays) || 0,
      wins: Number(parsed.wins) || 0,
      currentStreak: Number(parsed.currentStreak) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
      vegasBankroll: Number(parsed.vegasBankroll) || 0,
      byMode:
        parsed.byMode && typeof parsed.byMode === 'object' ? { ...parsed.byMode } : {},
      challengesCleared:
        parsed.challengesCleared && typeof parsed.challengesCleared === 'object'
          ? { ...parsed.challengesCleared }
          : {},
    };
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: KlondikeStats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore quota */
  }
}

export function winRate(stats: KlondikeStats): number {
  if (stats.plays <= 0) return 0;
  return stats.wins / stats.plays;
}

export type GameResultInput = {
  won: boolean;
  drawCount: DrawCount;
  scoreMode: ScoreMode;
  score: number;
  elapsedSec: number;
  moves: number;
  clearedChallenges: ChallengeId[];
};

export function recordGameResult(prev: KlondikeStats, input: GameResultInput): KlondikeStats {
  const key = modeKey(input.drawCount, input.scoreMode);
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

  const currentStreak = input.won ? prev.currentStreak + 1 : 0;
  const challengesCleared = { ...prev.challengesCleared };
  for (const id of input.clearedChallenges) {
    challengesCleared[id] = (challengesCleared[id] ?? 0) + 1;
  }

  let vegasBankroll = prev.vegasBankroll;
  if (input.scoreMode === 'vegas') {
    // Bankroll tracks cumulative end-of-hand scores (each hand already includes −52).
    vegasBankroll += input.score;
  }

  const next: KlondikeStats = {
    plays: prev.plays + 1,
    wins: prev.wins + (input.won ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(prev.bestStreak, currentStreak),
    vegasBankroll,
    byMode: { ...prev.byMode, [key]: mode },
    challengesCleared,
  };
  saveStats(next);
  return next;
}

export function loadSettings(): KlondikeSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KlondikeSettings>;
      return {
        drawCount: parsed.drawCount === 3 ? 3 : 1,
        scoreMode: parsed.scoreMode === 'vegas' ? 'vegas' : 'standard',
        solvableOnly: Boolean(parsed.solvableOnly),
        playDaily: Boolean(parsed.playDaily),
      };
    }
  } catch {
    /* fall through */
  }
  const legacyDraw = localStorage.getItem(LEGACY_DRAW_KEY);
  return {
    drawCount: legacyDraw === '3' ? 3 : 1,
    scoreMode: 'standard',
    solvableOnly: false,
    playDaily: false,
  };
}

export function saveSettings(settings: KlondikeSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(LEGACY_DRAW_KEY, String(settings.drawCount));
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

/** One record per day; keep a win over a loss, else better score then faster. */
export function recordDaily(record: DailyRecord): DailyRecord[] {
  const existing = loadDaily();
  const previous = existing.find((r) => r.date === record.date);
  const better = (a: DailyRecord, b: DailyRecord): DailyRecord => {
    if (a.won !== b.won) return a.won ? a : b;
    if (a.score !== b.score) return a.score > b.score ? a : b;
    if (a.elapsedSec !== b.elapsedSec) return a.elapsedSec < b.elapsedSec ? a : b;
    return a.moves <= b.moves ? a : b;
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
