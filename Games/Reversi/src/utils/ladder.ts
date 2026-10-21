/** Sequential opponent ladder — beat one to unlock the next. */

import { OPPONENTS, opponentByIndex, opponentCount, type OpponentId } from './opponents';
import { PUZZLES } from './puzzles';

export const LADDER_KEY = 'clubhouse-reversi-ladder';

export type PuzzleStars = 1 | 2 | 3;

export interface LadderProgress {
  /** Frontier: opponents with index < clearedCount are cleared; index === clearedCount is unlocked. */
  clearedCount: number;
  cleared: Record<string, true>;
  lastIndex: number;
  /** Puzzle ids solved at least once. */
  puzzlesSolved: Record<string, true>;
  /** Best star rating per puzzle id (1–3). */
  puzzleStars: Record<string, PuzzleStars>;
  puzzleBest: number;
}

export const EMPTY_LADDER: LadderProgress = {
  clearedCount: 0,
  cleared: {},
  lastIndex: 0,
  puzzlesSolved: {},
  puzzleStars: {},
  puzzleBest: 0,
};

function asNonNegInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function asPuzzleStars(value: unknown): PuzzleStars | null {
  const n = asNonNegInt(value);
  if (n < 1 || n > 3) return null;
  return n as PuzzleStars;
}

/**
 * Star rubric for a successful clear:
 * - 3★: no hint, no undo
 * - 2★: used hint or undo (but not both)
 * - 1★: used both hint and undo
 */
export function ratePuzzleAttempt(opts: {
  usedHint: boolean;
  usedUndo: boolean;
}): PuzzleStars {
  if (!opts.usedHint && !opts.usedUndo) return 3;
  if (opts.usedHint && opts.usedUndo) return 1;
  return 2;
}

export function mergeLadder(raw: unknown): LadderProgress {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_LADDER, cleared: {}, puzzlesSolved: {}, puzzleStars: {} };
  }
  const o = raw as Record<string, unknown>;
  const clearedCount = Math.min(opponentCount(), asNonNegInt(o.clearedCount));
  const lastIndex = Math.min(opponentCount() - 1, Math.max(0, asNonNegInt(o.lastIndex)));
  const puzzleBest = Math.min(PUZZLES.length + 64, asNonNegInt(o.puzzleBest));

  const cleared: Record<string, true> = {};
  if (o.cleared && typeof o.cleared === 'object') {
    for (const k of Object.keys(o.cleared as Record<string, unknown>)) {
      if (OPPONENTS.some((op) => op.id === k)) cleared[k] = true;
    }
  }

  const puzzlesSolved: Record<string, true> = {};
  if (o.puzzlesSolved && typeof o.puzzlesSolved === 'object') {
    for (const k of Object.keys(o.puzzlesSolved as Record<string, unknown>)) {
      puzzlesSolved[k] = true;
    }
  }

  const puzzleStars: Record<string, PuzzleStars> = {};
  if (o.puzzleStars && typeof o.puzzleStars === 'object') {
    for (const [k, v] of Object.entries(o.puzzleStars as Record<string, unknown>)) {
      const stars = asPuzzleStars(v);
      if (stars) puzzleStars[k] = stars;
    }
  }
  // Legacy saves: solved puzzles without stars count as 1★.
  for (const id of Object.keys(puzzlesSolved)) {
    if (!puzzleStars[id]) puzzleStars[id] = 1;
  }

  return { clearedCount, cleared, lastIndex, puzzlesSolved, puzzleStars, puzzleBest };
}

export function isOpponentUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= opponentCount()) return false;
  return index <= clearedCount;
}

export function applyLadderWin(
  progress: LadderProgress,
  opponentIndex: number,
): { progress: LadderProgress; newlyCleared: boolean } {
  const opp = opponentByIndex(opponentIndex);
  if (!opp) return { progress, newlyCleared: false };

  const cleared = { ...progress.cleared, [opp.id]: true as const };
  let clearedCount = progress.clearedCount;
  let newlyCleared = false;

  if (opponentIndex === clearedCount) {
    clearedCount = Math.min(opponentCount(), clearedCount + 1);
    newlyCleared = true;
  } else if (!progress.cleared[opp.id]) {
    newlyCleared = true;
  }

  return {
    progress: { ...progress, clearedCount, cleared, lastIndex: opponentIndex },
    newlyCleared,
  };
}

export function applyLadderLoss(progress: LadderProgress, opponentIndex: number): LadderProgress {
  return { ...progress, lastIndex: opponentIndex };
}

export function applyPuzzleSolve(
  progress: LadderProgress,
  puzzleId: string,
  stars: PuzzleStars = 1,
): LadderProgress {
  const puzzlesSolved = { ...progress.puzzlesSolved, [puzzleId]: true as const };
  const prev = progress.puzzleStars[puzzleId] ?? 0;
  const puzzleStars = {
    ...progress.puzzleStars,
    [puzzleId]: (Math.max(prev, stars) as PuzzleStars),
  };
  const puzzleBest = Math.max(progress.puzzleBest, Object.keys(puzzlesSolved).length);
  return { ...progress, puzzlesSolved, puzzleStars, puzzleBest };
}

/** Puzzle N unlocks after puzzle N−1 is cleared (index 0 always open). */
export function isPuzzleUnlocked(index: number, progress: LadderProgress): boolean {
  if (index < 0 || index >= PUZZLES.length) return false;
  if (index === 0) return true;
  const prev = PUZZLES[index - 1];
  return Boolean(progress.puzzlesSolved[prev.id]);
}

export function puzzleStarTotal(progress: LadderProgress): number {
  let sum = 0;
  for (const id of Object.keys(progress.puzzleStars)) {
    sum += progress.puzzleStars[id] ?? 0;
  }
  return sum;
}

export function formatStars(stars: number): string {
  const n = Math.max(0, Math.min(3, Math.floor(stars)));
  return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;
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

export function loadLadder(storage: StorageLike | null = defaultStorage()): LadderProgress {
  if (!storage) return mergeLadder(null);
  try {
    const raw = storage.getItem(LADDER_KEY);
    if (!raw) return mergeLadder(null);
    return mergeLadder(JSON.parse(raw));
  } catch {
    return mergeLadder(null);
  }
}

export function saveLadder(
  progress: LadderProgress,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(LADDER_KEY, JSON.stringify(mergeLadder(progress)));
  } catch {
    /* quota / private mode */
  }
}

export function isLadderComplete(progress: LadderProgress): boolean {
  return progress.clearedCount >= opponentCount();
}

export type { OpponentId };
