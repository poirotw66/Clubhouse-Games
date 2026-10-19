/** Sequential opponent ladder — beat one to unlock the next. */

import { OPPONENTS, opponentByIndex, opponentCount, type OpponentId } from './opponents';

export const LADDER_KEY = 'clubhouse-reversi-ladder';

export interface LadderProgress {
  /** Frontier: opponents with index < clearedCount are cleared; index === clearedCount is unlocked. */
  clearedCount: number;
  cleared: Record<string, true>;
  lastIndex: number;
  /** Puzzle ids solved at least once. */
  puzzlesSolved: Record<string, true>;
  puzzleBest: number;
}

export const EMPTY_LADDER: LadderProgress = {
  clearedCount: 0,
  cleared: {},
  lastIndex: 0,
  puzzlesSolved: {},
  puzzleBest: 0,
};

function asNonNegInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export function mergeLadder(raw: unknown): LadderProgress {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_LADDER, cleared: {}, puzzlesSolved: {} };
  }
  const o = raw as Record<string, unknown>;
  const clearedCount = Math.min(opponentCount(), asNonNegInt(o.clearedCount));
  const lastIndex = Math.min(opponentCount() - 1, Math.max(0, asNonNegInt(o.lastIndex)));
  const puzzleBest = Math.min(opponentCount() + 64, asNonNegInt(o.puzzleBest));

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

  return { clearedCount, cleared, lastIndex, puzzlesSolved, puzzleBest };
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

export function applyPuzzleSolve(progress: LadderProgress, puzzleId: string): LadderProgress {
  const puzzlesSolved = { ...progress.puzzlesSolved, [puzzleId]: true as const };
  const puzzleBest = Math.max(progress.puzzleBest, Object.keys(puzzlesSolved).length);
  return { ...progress, puzzlesSolved, puzzleBest };
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
