/**
 * IDA* sliding-puzzle solver with Manhattan + linear-conflict heuristic.
 * Exact on small / shallow boards; returns a bounded near-optimal length when
 * the node budget is exhausted (using scramble upper bound when available).
 */

import {
  emptyIndex,
  isSolved,
  manhattanSum,
  neighborsOfEmpty,
  slide,
  type Board,
  type BoardSize,
} from './fifteenLogic.ts';

export type SolveResult = {
  /** Best solution length found (optimal when `exact`). */
  moves: number;
  /** True when IDA* proved optimality (or board already solved). */
  exact: boolean;
  /** Optional tile indices of one optimal/near-optimal path (tap order). */
  path: number[] | null;
};

export type SolveOptions = {
  /** Hard ceiling — never search beyond this depth (e.g. known scramble length). */
  upperBound?: number | null;
  /** Stop after this many node expansions. */
  maxNodes?: number;
  /** Wall-clock budget in ms (best-effort). */
  timeMs?: number;
};

const DEFAULT_MAX_NODES = 250_000;
const DEFAULT_TIME_MS = 80;

/** Linear conflicts: two tiles in the same row/col that must swap past each other (+2 each). */
export function linearConflict(board: Board, size: BoardSize): number {
  let conflicts = 0;

  for (let row = 0; row < size; row++) {
    for (let c1 = 0; c1 < size; c1++) {
      const i1 = row * size + c1;
      const t1 = board[i1];
      if (t1 === null) continue;
      const g1 = t1 - 1;
      if (Math.floor(g1 / size) !== row) continue;
      for (let c2 = c1 + 1; c2 < size; c2++) {
        const i2 = row * size + c2;
        const t2 = board[i2];
        if (t2 === null) continue;
        const g2 = t2 - 1;
        if (Math.floor(g2 / size) !== row) continue;
        if (g1 > g2) conflicts++;
      }
    }
  }

  for (let col = 0; col < size; col++) {
    for (let r1 = 0; r1 < size; r1++) {
      const i1 = r1 * size + col;
      const t1 = board[i1];
      if (t1 === null) continue;
      const g1 = t1 - 1;
      if (g1 % size !== col) continue;
      for (let r2 = r1 + 1; r2 < size; r2++) {
        const i2 = r2 * size + col;
        const t2 = board[i2];
        if (t2 === null) continue;
        const g2 = t2 - 1;
        if (g2 % size !== col) continue;
        if (g1 > g2) conflicts++;
      }
    }
  }

  return conflicts * 2;
}

export function heuristic(board: Board, size: BoardSize): number {
  return manhattanSum(board, size) + linearConflict(board, size);
}

function encode(board: Board): string {
  return board.map((v) => (v === null ? '0' : String(v))).join(',');
}

/**
 * Find an optimal (or near-optimal) solution length.
 * When `upperBound` is known from a scramble walk, a failed/truncated search
 * still returns that bound as a conservative par.
 */
export function solvePuzzle(
  board: Board,
  size: BoardSize,
  options: SolveOptions = {},
): SolveResult {
  if (isSolved(board, size)) {
    return { moves: 0, exact: true, path: [] };
  }

  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const timeMs = options.timeMs ?? DEFAULT_TIME_MS;
  const ceiling =
    options.upperBound != null && options.upperBound > 0
      ? options.upperBound
      : size <= 3
        ? 31
        : size === 4
          ? 80
          : size === 5
            ? 120
            : 160;

  const start = Date.now();
  let nodes = 0;
  let truncated = false;
  let bestPath: number[] | null = null;
  let bestLen = ceiling;

  const h0 = heuristic(board, size);
  let bound = h0;

  const path: number[] = [];

  const search = (state: Board, g: number, boundNow: number, prevEmpty: number): number => {
    if (nodes >= maxNodes || Date.now() - start > timeMs) {
      truncated = true;
      return Number.POSITIVE_INFINITY;
    }
    nodes++;
    const f = g + heuristic(state, size);
    if (f > boundNow) return f;
    if (isSolved(state, size)) {
      bestPath = path.slice();
      bestLen = g;
      return -1;
    }

    let min = Number.POSITIVE_INFINITY;
    const opts = neighborsOfEmpty(state, size);
    // Order by ascending heuristic of the child (cheap tie-break).
    opts.sort((a, b) => {
      const na = slide(state, a, size)!;
      const nb = slide(state, b, size)!;
      return heuristic(na, size) - heuristic(nb, size);
    });

    for (const tileIdx of opts) {
      if (tileIdx === prevEmpty) continue; // don't undo
      const next = slide(state, tileIdx, size);
      if (!next) continue;
      path.push(tileIdx);
      const t = search(next, g + 1, boundNow, emptyIndex(state));
      path.pop();
      if (t === -1) return -1;
      if (t < min) min = t;
      if (truncated) return Number.POSITIVE_INFINITY;
    }
    return min;
  };

  while (bound <= ceiling) {
    const t = search(board, 0, bound, -1);
    if (t === -1) {
      return { moves: bestLen, exact: !truncated, path: bestPath };
    }
    if (truncated || !Number.isFinite(t)) break;
    bound = t;
  }

  // Truncated / unsolved within budget: use upper bound as near-optimal par.
  const fallback = options.upperBound != null && options.upperBound > 0 ? options.upperBound : bestLen;
  return {
    moves: fallback,
    exact: false,
    path: bestPath,
  };
}

/** Convenience: optimal moves only (for checks / UI). */
export function optimalMoves(
  board: Board,
  size: BoardSize,
  upperBound: number | null = null,
): SolveResult {
  // Scramble-bounded boards (easy/normal) get a larger budget so the result
  // screen can show a true optimal more often than "≤ scramble length".
  const bounded = upperBound != null && upperBound > 0;
  const maxNodes =
    size <= 3 ? 500_000 : size === 4 ? (bounded ? 600_000 : 250_000) : bounded ? 120_000 : 60_000;
  const timeMs = size <= 3 ? 250 : size === 4 ? (bounded ? 280 : 100) : bounded ? 90 : 50;
  return solvePuzzle(board, size, { upperBound, maxNodes, timeMs });
}

/** Verify a tap-path restores the board (used by checks). */
export function applyPath(board: Board, size: BoardSize, path: number[]): Board {
  let cur = board;
  for (const idx of path) {
    const next = slide(cur, idx, size);
    if (!next) throw new Error(`illegal slide at ${idx} from ${encode(cur)}`);
    cur = next;
  }
  return cur;
}
