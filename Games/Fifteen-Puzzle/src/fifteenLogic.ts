/** Classic sliding puzzle: tiles 1…N²−1 plus null empty, variable N×N. */

import { createRng } from './rng.ts';
import { heuristic, solvePuzzle } from './solver.ts';

export const BOARD_SIZES = [3, 4, 5, 6] as const;
export type BoardSize = (typeof BOARD_SIZES)[number];

export type Board = (number | null)[];

export type VisualStyle = 'number' | 'picture';

export type ThemeId = 'walnut' | 'obsidian' | 'cyber';

export type ThemeConfig = {
  id: ThemeId;
  name: string;
  desc: string;
  accentColor: string;
};

export const THEME_CONFIGS: Record<ThemeId, ThemeConfig> = {
  walnut: {
    id: 'walnut',
    name: '胡桃木黃銅',
    desc: '典藏深色胡桃木刻槽與拉絲黃銅方塊',
    accentColor: '#d4af37',
  },
  obsidian: {
    id: 'obsidian',
    name: '黑曜石金箔',
    desc: '火山黑曜石啞光底盤與鍍金雕刻文字',
    accentColor: '#f59e0b',
  },
  cyber: {
    id: 'cyber',
    name: '賽博鈦金',
    desc: '航太鈦合金導軌與霓虹量子鎖定刻線',
    accentColor: '#38bdf8',
  },
};

export type ScrambleTier = 'easy' | 'normal' | 'hard';

export type PlayMode = 'classic' | 'sprint' | 'daily' | 'campaign';

export const SPRINT_LIMIT_SEC = 90;

export const OBSTACLE_TILE = -1;

export function isObstacle(tile: number | null): boolean {
  return tile === OBSTACLE_TILE;
}

export function defaultObstacleIndex(size: BoardSize): number {
  if (size === 3) return 4;
  if (size === 4) return 5;
  if (size === 5) return 12;
  return 14;
}

export function cellCount(size: BoardSize): number {
  return size * size;
}

export function solvedBoard(size: BoardSize, obstacleIndex: number | null = null): Board {
  const n = cellCount(size);
  const board: Board = [];
  if (obstacleIndex != null && obstacleIndex >= 0 && obstacleIndex < n - 1) {
    let currentTile = 1;
    for (let i = 0; i < n - 1; i++) {
      if (i === obstacleIndex) {
        board.push(OBSTACLE_TILE);
      } else {
        board.push(currentTile++);
      }
    }
    board.push(null);
  } else {
    for (let i = 1; i < n; i++) board.push(i);
    board.push(null);
  }
  return board;
}

export function emptyIndex(board: Board): number {
  return board.indexOf(null);
}

export function isSolved(
  board: Board,
  size: BoardSize,
  obstacleIndex: number | null = null,
): boolean {
  const n = cellCount(size);
  if (board[n - 1] !== null) return false;
  if (obstacleIndex != null && obstacleIndex >= 0 && obstacleIndex < n - 1) {
    if (board[obstacleIndex] !== OBSTACLE_TILE) return false;
    let expected = 1;
    for (let i = 0; i < n - 1; i++) {
      if (i === obstacleIndex) continue;
      if (board[i] !== expected) return false;
      expected++;
    }
    return true;
  }
  for (let i = 0; i < n - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return true;
}

/**
 * Standard sliding-puzzle solvability:
 * - odd width: even inversion count
 * - even width: (inversions + emptyRowFromBottom) is odd
 */
export function isSolvable(board: Board, size: BoardSize): boolean {
  const flat = board.filter((v): v is number => v !== null && v !== OBSTACLE_TILE);
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

/**
 * BFS reachability check: ensures all non-obstacle cells form a single connected component
 * so the empty space can traverse to every movable tile position.
 */
export function isReachableWithObstacle(size: BoardSize, obstacleIndex: number): boolean {
  const total = cellCount(size);
  if (obstacleIndex < 0 || obstacleIndex >= total) return false;
  const start = obstacleIndex === 0 ? 1 : 0;
  const visited = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const r = Math.floor(cur / size);
    const c = cur % size;
    const nbs: number[] = [];
    if (r > 0) nbs.push(cur - size);
    if (r < size - 1) nbs.push(cur + size);
    if (c > 0) nbs.push(cur - 1);
    if (c < size - 1) nbs.push(cur + 1);
    for (const nb of nbs) {
      if (nb === obstacleIndex || visited.has(nb)) continue;
      visited.add(nb);
      queue.push(nb);
    }
  }
  return visited.size === total - 1;
}

/**
 * Parity and structural validity check for a board with a bolted obstacle.
 */
export function isSolvableWithObstacle(
  board: Board,
  size: BoardSize,
  obstacleIndex: number,
): boolean {
  if (!isReachableWithObstacle(size, obstacleIndex)) return false;
  if (board[obstacleIndex] !== OBSTACLE_TILE) return false;
  const e = emptyIndex(board);
  if (e < 0) return false;
  const total = cellCount(size);
  const seen = new Set<number>();
  for (let i = 0; i < total; i++) {
    const v = board[i];
    if (i === obstacleIndex) {
      if (v !== OBSTACLE_TILE) return false;
    } else if (v === null) {
      continue;
    } else if (v > 0 && v <= total - 2) {
      if (seen.has(v)) return false;
      seen.add(v);
    } else {
      return false;
    }
  }
  return seen.size === total - 2;
}

export function neighborsOfEmpty(board: Board, size: BoardSize): number[] {
  const e = emptyIndex(board);
  if (e < 0) return [];
  const r = Math.floor(e / size);
  const c = e % size;
  const out: number[] = [];
  if (r > 0) out.push(e - size);
  if (r < size - 1) out.push(e + size);
  if (c > 0) out.push(e - 1);
  if (c < size - 1) out.push(e + 1);
  return out.filter((idx) => board[idx] !== OBSTACLE_TILE);
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

export type MultiSlideResult = {
  nextBoard: Board;
  movedCount: number;
  movedIndices: number[];
};

/**
 * Check if a tile can slide into empty, either directly or as part of a multi-tile
 * line push (sharing the same row or column as the empty space).
 * A bolted obstacle cell blocks any multi-slide path through it.
 */
export function canMultiSlide(board: Board, tileIndex: number, size: BoardSize): boolean {
  const e = emptyIndex(board);
  if (tileIndex === e || tileIndex < 0 || tileIndex >= board.length) return false;
  if (board[tileIndex] === OBSTACLE_TILE) return false;
  const rEmpty = Math.floor(e / size);
  const cEmpty = e % size;
  const rTile = Math.floor(tileIndex / size);
  const cTile = tileIndex % size;
  if (rEmpty !== rTile && cEmpty !== cTile) return false;

  if (rEmpty === rTile) {
    const minC = Math.min(cEmpty, cTile);
    const maxC = Math.max(cEmpty, cTile);
    for (let c = minC; c <= maxC; c++) {
      if (board[rEmpty * size + c] === OBSTACLE_TILE) return false;
    }
  } else {
    const minR = Math.min(rEmpty, rTile);
    const maxR = Math.max(rEmpty, rTile);
    for (let r = minR; r <= maxR; r++) {
      if (board[r * size + cEmpty] === OBSTACLE_TILE) return false;
    }
  }
  return true;
}

/**
 * Push an entire row or column segment toward the empty space in a single fluid action.
 * Allows multi-tile train slides for speed-solving and tactile comfort.
 */
export function multiSlide(
  board: Board,
  tileIndex: number,
  size: BoardSize,
): MultiSlideResult | null {
  if (!canMultiSlide(board, tileIndex, size)) return null;
  const e = emptyIndex(board);
  const rEmpty = Math.floor(e / size);
  const cEmpty = e % size;
  const rTile = Math.floor(tileIndex / size);
  const cTile = tileIndex % size;

  const next = board.slice();
  const movedIndices: number[] = [];

  if (rEmpty === rTile) {
    const step = cTile < cEmpty ? 1 : -1;
    for (let c = cEmpty; c !== cTile; c -= step) {
      const targetCol = c;
      const sourceCol = c - step;
      const targetIdx = rEmpty * size + targetCol;
      const sourceIdx = rEmpty * size + sourceCol;
      next[targetIdx] = next[sourceIdx];
      movedIndices.push(sourceIdx);
    }
    next[rEmpty * size + cTile] = null;
  } else {
    const step = rTile < rEmpty ? 1 : -1;
    for (let r = rEmpty; r !== rTile; r -= step) {
      const targetRow = r;
      const sourceRow = r - step;
      const targetIdx = targetRow * size + cEmpty;
      const sourceIdx = sourceRow * size + cEmpty;
      next[targetIdx] = next[sourceIdx];
      movedIndices.push(sourceIdx);
    }
    next[rTile * size + cEmpty] = null;
  }

  return {
    nextBoard: next,
    movedCount: movedIndices.length,
    movedIndices,
  };
}

/** Count tiles currently occupying their solved home index. */
export function countInPlace(
  board: Board,
  size: BoardSize,
  obstacleIndex: number | null = null,
): number {
  let count = 0;
  const n = cellCount(size);
  for (let i = 0; i < n - 1; i++) {
    const tile = board[i];
    if (tile !== null && !isObstacle(tile) && goalIndex(tile, obstacleIndex) === i) {
      count++;
    }
  }
  return count;
}

/** Percentage of tiles currently in their solved home position (0% - 100%). */
export function harmonyPct(
  board: Board,
  size: BoardSize,
  obstacleIndex: number | null = null,
): number {
  const total = obstacleIndex != null ? cellCount(size) - 2 : cellCount(size) - 1;
  if (total <= 0) return 100;
  return Math.round((countInPlace(board, size, obstacleIndex) / total) * 100);
}

/** Goal index for tile `n` (1…N²−1); empty belongs at the last cell. */
export function goalIndex(tile: number, obstacleIndex: number | null = null): number {
  if (obstacleIndex != null && obstacleIndex >= 0) {
    if (tile <= obstacleIndex) {
      return tile - 1;
    }
    return tile;
  }
  return tile - 1;
}

/**
 * Manhattan distance of a tile at `currentIndex` to its solved goal position.
 * Returns 0 if the tile is in its solved home slot.
 */
export function tileManhattan(
  tile: number,
  currentIndex: number,
  size: BoardSize,
  obstacleIndex: number | null = null,
): number {
  if (tile <= 0) return 0;
  const goal = goalIndex(tile, obstacleIndex);
  const curRow = Math.floor(currentIndex / size);
  const curCol = currentIndex % size;
  const goalRow = Math.floor(goal / size);
  const goalCol = goal % size;
  return Math.abs(curRow - goalRow) + Math.abs(curCol - goalCol);
}

export function manhattanSum(
  board: Board,
  size: BoardSize,
  obstacleIndex: number | null = null,
): number {
  let sum = 0;
  for (let i = 0; i < board.length; i++) {
    const tile = board[i];
    if (tile === null || tile <= 0) continue;
    const goal = goalIndex(tile, obstacleIndex);
    sum +=
      Math.abs(Math.floor(i / size) - Math.floor(goal / size)) +
      Math.abs((i % size) - (goal % size));
  }
  return sum;
}

/**
 * Suggest one legal slide: routes 3x3/4x4 boards through IDA* solver (with bounded
 * node/ms budget) and falls back cleanly to Manhattan + LinearConflict heuristic.
 */
export function hintTileIndex(
  board: Board,
  size: BoardSize,
  options?: { maxNodes?: number; timeMs?: number; obstacleIndex?: number | null },
): number | null {
  if (isSolved(board, size, options?.obstacleIndex)) return null;
  const opts = neighborsOfEmpty(board, size);
  if (opts.length === 0) return null;

  const hasObstacle = board.includes(OBSTACLE_TILE);

  // Route 3x3 and 4x4 boards without obstacle through IDA* solver with bounded budget
  if (!hasObstacle && (size === 3 || size === 4)) {
    try {
      const timeBudget = options?.timeMs ?? (size === 3 ? 120 : 60);
      const nodeBudget = options?.maxNodes ?? (size === 3 ? 150_000 : 60_000);
      const res = solvePuzzle(board, size, { maxNodes: nodeBudget, timeMs: timeBudget });
      if (res.path && res.path.length > 0) {
        return res.path[0];
      }
    } catch {
      // Fallback cleanly to heuristic
    }
  }

  // Fallback: evaluate Manhattan + LinearConflict (or Manhattan for obstacle)
  for (const idx of opts) {
    const tile = board[idx];
    if (
      tile !== null &&
      !isObstacle(tile) &&
      goalIndex(tile, options?.obstacleIndex) === emptyIndex(board)
    ) {
      return idx;
    }
  }

  let best = opts[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const idx of opts) {
    const next = slide(board, idx, size);
    if (!next) continue;
    const score = hasObstacle
      ? manhattanSum(next, size, options?.obstacleIndex)
      : heuristic(next, size);
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
  obstacleIndex: number | null = null,
): ScrambleResult {
  const slides = scrambleSlideCount(size, tier);
  if (slides === 0 && obstacleIndex == null) {
    return { board: shuffledBoard(size, rand), scrambleMoves: null };
  }
  const moveCount = slides === 0 ? size * size * 4 : slides;
  let board = solvedBoard(size, obstacleIndex);
  let lastEmpty = emptyIndex(board);
  let actual = 0;
  for (let i = 0; i < moveCount; i++) {
    const opts = neighborsOfEmpty(board, size).filter((idx) => idx !== lastEmpty);
    const pick = opts[Math.floor(rand() * opts.length)] ?? neighborsOfEmpty(board, size)[0];
    const prevEmpty = emptyIndex(board);
    board = slide(board, pick, size)!;
    lastEmpty = prevEmpty;
    actual++;
  }
  if (isSolved(board, size, obstacleIndex)) return scrambleBoard(size, tier, rand, obstacleIndex);
  return { board, scrambleMoves: actual };
}

export function scrambleFromSeed(
  size: BoardSize,
  tier: ScrambleTier,
  seed: number,
  obstacleIndex: number | null = null,
): ScrambleResult {
  return scrambleBoard(size, tier, createRng(seed), obstacleIndex);
}

export function scrambleBoardWithObstacle(
  size: BoardSize,
  tier: ScrambleTier,
  obstacleIndex: number,
  rand: () => number = Math.random,
): ScrambleResult {
  return scrambleBoard(size, tier, rand, obstacleIndex);
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
