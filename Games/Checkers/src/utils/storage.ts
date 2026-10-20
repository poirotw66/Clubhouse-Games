/**
 * Persist streaks, ladder unlocks, puzzle clears/stars, and match preferences.
 */

import type { MatchLength } from './match';
import type { OpponentId } from './opponents';
import type { RulesetId } from './rules';

const KEY = 'clubhouse-checkers:progress:v1';

export type PuzzleStar = 1 | 2 | 3;

export type CheckersProgress = {
  winStreak: number;
  bestStreak: number;
  bestMargin: number;
  beatenOpponents: OpponentId[];
  /** Cleared puzzle ids (kept in sync with puzzleStars keys). */
  puzzlesCleared: string[];
  /** Best star rating per puzzle id. */
  puzzleStars: Record<string, PuzzleStar>;
  lastRuleset: RulesetId;
  lastMatchTarget: MatchLength;
  seriesWins: number;
};

const DEFAULT: CheckersProgress = {
  winStreak: 0,
  bestStreak: 0,
  bestMargin: 0,
  beatenOpponents: [],
  puzzlesCleared: [],
  puzzleStars: {},
  lastRuleset: 'american',
  lastMatchTarget: 2,
  seriesWins: 0,
};

function isOpponentId(v: unknown): v is OpponentId {
  return (
    v === 'rookie' ||
    v === 'rusher' ||
    v === 'wall' ||
    v === 'flyer' ||
    v === 'champ'
  );
}

function asPuzzleStar(v: unknown): PuzzleStar | null {
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3) return n;
  return null;
}

function parsePuzzleStars(
  raw: unknown,
  cleared: string[],
): Record<string, PuzzleStar> {
  const out: Record<string, PuzzleStar> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      const star = asPuzzleStar(value);
      if (star) out[id] = star;
    }
  }
  // Legacy clears without stars count as 1★ so unlock chains stay intact.
  for (const id of cleared) {
    if (out[id] == null) out[id] = 1;
  }
  return out;
}

function parseProgress(raw: unknown): CheckersProgress {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT, puzzleStars: {} };
  const o = raw as Record<string, unknown>;
  const beaten = Array.isArray(o.beatenOpponents)
    ? o.beatenOpponents.filter(isOpponentId)
    : [];
  const puzzles = Array.isArray(o.puzzlesCleared)
    ? o.puzzlesCleared.filter((x): x is string => typeof x === 'string')
    : [];
  const puzzleStars = parsePuzzleStars(o.puzzleStars, puzzles);
  const cleared = [...new Set([...puzzles, ...Object.keys(puzzleStars)])];
  const lastRuleset: RulesetId =
    o.lastRuleset === 'international' ? 'international' : 'american';
  const lastMatchTarget: MatchLength =
    o.lastMatchTarget === 3 || o.lastMatchTarget === 4 ? o.lastMatchTarget : 2;
  return {
    winStreak: num(o.winStreak),
    bestStreak: num(o.bestStreak),
    bestMargin: num(o.bestMargin),
    beatenOpponents: beaten,
    puzzlesCleared: cleared,
    puzzleStars,
    lastRuleset,
    lastMatchTarget,
    seriesWins: num(o.seriesWins),
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function loadProgress(): CheckersProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // Migrate legacy streak keys once.
      const legacyStreak = num(localStorage.getItem('clubhouse-checkers-win-streak'));
      const legacyBest = num(localStorage.getItem('clubhouse-checkers-best-streak'));
      const legacyMargin = num(localStorage.getItem('clubhouse-checkers-best-margin'));
      if (legacyStreak || legacyBest || legacyMargin) {
        const migrated: CheckersProgress = {
          ...DEFAULT,
          winStreak: legacyStreak,
          bestStreak: legacyBest,
          bestMargin: legacyMargin,
          puzzleStars: {},
        };
        saveProgress(migrated);
        return migrated;
      }
      return { ...DEFAULT, puzzleStars: {} };
    }
    return parseProgress(JSON.parse(raw));
  } catch {
    return { ...DEFAULT, puzzleStars: {} };
  }
}

export function saveProgress(progress: CheckersProgress): void {
  localStorage.setItem(KEY, JSON.stringify(progress));
}

export function recordBotWin(
  progress: CheckersProgress,
  margin: number,
  opponentId: OpponentId | null,
): CheckersProgress {
  const winStreak = progress.winStreak + 1;
  const bestStreak = Math.max(progress.bestStreak, winStreak);
  const bestMargin = Math.max(progress.bestMargin, margin);
  const beaten = new Set(progress.beatenOpponents);
  if (opponentId) beaten.add(opponentId);
  const next: CheckersProgress = {
    ...progress,
    winStreak,
    bestStreak,
    bestMargin,
    beatenOpponents: [...beaten],
  };
  saveProgress(next);
  return next;
}

export function recordBotLoss(progress: CheckersProgress): CheckersProgress {
  const next = { ...progress, winStreak: 0 };
  saveProgress(next);
  return next;
}

export function recordPuzzleClear(
  progress: CheckersProgress,
  puzzleId: string,
  stars: PuzzleStar,
): CheckersProgress {
  const prev = progress.puzzleStars[puzzleId] ?? 0;
  const best = Math.max(prev, stars) as PuzzleStar;
  const cleared = progress.puzzlesCleared.includes(puzzleId)
    ? progress.puzzlesCleared
    : [...progress.puzzlesCleared, puzzleId];
  const next: CheckersProgress = {
    ...progress,
    puzzlesCleared: cleared,
    puzzleStars: { ...progress.puzzleStars, [puzzleId]: best },
  };
  saveProgress(next);
  return next;
}

export function recordSeriesWin(progress: CheckersProgress): CheckersProgress {
  const next = { ...progress, seriesWins: progress.seriesWins + 1 };
  saveProgress(next);
  return next;
}
