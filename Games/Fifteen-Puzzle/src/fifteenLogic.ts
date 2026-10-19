/** Classic sliding puzzle: tiles 1…N²−1 plus null empty, variable N×N. */

import { createRng } from './rng.ts';

export const BOARD_SIZES = [3, 4, 5, 6] as const;
export type BoardSize = (typeof BOARD_SIZES)[number];

export type Board = (number | null)[];

export type VisualStyle = 'number' | 'picture';

export type ScrambleTier = 'easy' | 'normal' | 'hard';

export type PlayMode = 'classic' | 'sprint' | 'daily' | 'campaign';

export const SPRINT_LIMIT_SEC = 90;

export function cellCount(size: BoardSize): number {
  return size * size;
}

export function solvedBoard(size: BoardSize): Board {
  const n = cellCount(size);
  const board: Board = [];
  for (let i = 1; i < n; i++) board.push(i);
  board.push(null);
  return board;
}

export function emptyIndex(board: Board): number {
  return board.indexOf(null);
}

export function isSolved(board: Board, size: BoardSize): boolean {
  const n = cellCount(size);
  for (let i = 0; i < n - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[n - 1] === null;
}

/**
 * Standard sliding-puzzle solvability:
 * - odd width: even inversion count
 * - even width: (inversions + emptyRowFromBottom) is odd
 */
export function isSolvable(board: Board, size: BoardSize): boolean {
  const flat = board.filter((v): v is number => v !== null);
  let inversions = 0;
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i] > flat[j]) inversions++;
    }
  }
  if (size % 2 === 1) return inversions % 2 === 0;
  const emptyRow = Math.floor(emptyIndex(board) / size);
  const emptyRowFromBottom = size - emptyRow;
  return (inversions + emptyRowFromBottom) % 2 === 1;
}

export function neighborsOfEmpty(board: Board, size: BoardSize): number[] {
  const e = emptyIndex(board);
  const r = Math.floor(e / size);
  const c = e % size;
  const out: number[] = [];
  if (r > 0) out.push(e - size);
  if (r < size - 1) out.push(e + size);
  if (c > 0) out.push(e - 1);
  if (c < size - 1) out.push(e + 1);
  return out;
}

export function slide(board: Board, tileIndex: number, size: BoardSize): Board | null {
  if (!neighborsOfEmpty(board, size).includes(tileIndex)) return null;
  const next = board.slice();
  const e = emptyIndex(next);
  next[e] = next[tileIndex];
  next[tileIndex] = null;
  return next;
}

/** Slide the neighbor of empty that lies in `dir` (empty moves opposite). */
export type SlideDir = 'up' | 'down' | 'left' | 'right';

export function slideByDirection(board: Board, size: BoardSize, dir: SlideDir): Board | null {
  const e = emptyIndex(board);
  const r = Math.floor(e / size);
  const c = e % size;
  let tile = -1;
  if (dir === 'up' && r < size - 1) tile = e + size;
  else if (dir === 'down' && r > 0) tile = e - size;
  else if (dir === 'left' && c < size - 1) tile = e + 1;
  else if (dir === 'right' && c > 0) tile = e - 1;
  if (tile < 0) return null;
  return slide(board, tile, size);
}

/** Goal index for tile `n` (1…N²−1); empty belongs at the last cell. */
export function goalIndex(tile: number): number {
  return tile - 1;
}

export function manhattanSum(board: Board, size: BoardSize): number {
  let sum = 0;
  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    if (tile === null) continue;
    const goal = goalIndex(tile);
    sum +=
      Math.abs(Math.floor(i / size) - Math.floor(goal / size)) +
      Math.abs((i % size) - (goal % size));
  }
  return sum;
}

/**
 * Suggest one legal slide: prefer placing a tile into its home cell when that
 * move is available, otherwise pick the neighbor that most reduces Manhattan.
 */
export function hintTileIndex(board: Board, size: BoardSize): number | null {
  if (isSolved(board, size)) return null;
  const opts = neighborsOfEmpty(board, size);
  if (opts.length === 0) return null;

  for (const idx of opts) {
    const tile = board[idx];
    if (tile !== null && goalIndex(tile) === emptyIndex(board)) return idx;
  }

  let best = opts[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const idx of opts) {
    const next = slide(board, idx, size);
    if (!next) continue;
    const score = manhattanSum(next, size);
    if (score < bestScore || (score === bestScore && idx < best)) {
      bestScore = score;
      best = idx;
    }
  }
  return best;
}

/** Scramble slide budgets scale with board area so larger boards stay approachable. */
export function scrambleSlideCount(size: BoardSize, tier: ScrambleTier): number {
  if (tier === 'hard') {
    // Full shuffle for 3×3 / 4×4; long walk for larger boards so a par exists.
    if (size <= 4) return 0;
    return size * size * 4;
  }
  if (tier === 'easy') return size * 5;
  return size * 12;
}

/** Fisher–Yates shuffle until solvable and not already solved. */
export function shuffledBoard(size: BoardSize, rand: () => number = Math.random): Board {
  for (let attempt = 0; attempt < 200; attempt++) {
    const b = solvedBoard(size);
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = b[i];
      b[i] = b[j];
      b[j] = tmp;
    }
    if (isSolvable(b, size) && !isSolved(b, size)) return b;
  }
  const b = solvedBoard(size);
  return slide(b, cellCount(size) - 2, size)!;
}

export type ScrambleResult = {
  board: Board;
  /** Exact walk length when generated by slides; null for full shuffle. */
  scrambleMoves: number | null;
};

/** N random legal slides from solved (always solvable). Hard 3×3/4×4 → full shuffle. */
export function scrambleBoard(
  size: BoardSize,
  tier: ScrambleTier,
  rand: () => number = Math.random,
): ScrambleResult {
  const slides = scrambleSlideCount(size, tier);
  if (slides === 0) {
    return { board: shuffledBoard(size, rand), scrambleMoves: null };
  }
  let board = solvedBoard(size);
  let lastEmpty = emptyIndex(board);
  let actual = 0;
  for (let i = 0; i < slides; i++) {
    const opts = neighborsOfEmpty(board, size).filter((idx) => idx !== lastEmpty);
    const pick = opts[Math.floor(rand() * opts.length)] ?? neighborsOfEmpty(board, size)[0];
    const prevEmpty = emptyIndex(board);
    board = slide(board, pick, size)!;
    lastEmpty = prevEmpty;
    actual++;
  }
  if (isSolved(board, size)) return scrambleBoard(size, tier, rand);
  return { board, scrambleMoves: actual };
}

export function scrambleFromSeed(
  size: BoardSize,
  tier: ScrambleTier,
  seed: number,
): ScrambleResult {
  return scrambleBoard(size, tier, createRng(seed));
}

/** Letter-style par from player moves vs optimal (or upper-bound) length. */
export type ParGrade = 'S' | 'A' | 'B' | 'C' | 'D';

export function parGrade(moves: number, optimal: number): ParGrade {
  if (!Number.isFinite(optimal) || optimal <= 0) {
    if (moves <= 0) return 'S';
    return 'B';
  }
  const extra = moves - optimal;
  if (extra <= 0) return 'S';
  if (extra <= Math.max(1, Math.ceil(optimal * 0.15))) return 'A';
  if (extra <= Math.max(2, Math.ceil(optimal * 0.35))) return 'B';
  if (extra <= Math.max(4, Math.ceil(optimal * 0.6))) return 'C';
  return 'D';
}

export const PAR_LABEL: Record<ParGrade, string> = {
  S: '完美',
  A: '優秀',
  B: '達標',
  C: '尚可',
  D: '再接再厲',
};

export function sizeLabel(size: BoardSize): string {
  return `${size}×${size}`;
}
