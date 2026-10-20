import type { ActivePiece, Cell, Difficulty, Rotation, TetrominoType } from './tetrisLogic.ts';
import {
  BOARD_SIZE,
  clearLines,
  collides,
  detectTSpin,
  mergePiece,
  movePiece,
  scoreClear,
  spawnPiece,
  tryRotateWithKick,
} from './tetrisLogic.ts';

export interface DifficultyPreset {
  id: Difficulty;
  label: string;
  /** Thinking delay before each piece (ms range). */
  thinkMin: number;
  thinkMax: number;
  holeWeight: number;
  heightWeight: number;
  bumpWeight: number;
  clearWeight: number;
  attackWeight: number;
  tSlotWeight: number;
  /** Random noise added to placement scores (higher = weaker). */
  noise: number;
  /** Max garbage lines dropped onto CPU at once. */
  garbageDropCap: number;
  /** Look one piece ahead when true. */
  lookahead: boolean;
  /**
   * When > 0, pick uniformly among the top N scored reachable plans.
   * Absolute count (not a fraction) so Easy stays competent but imperfect.
   */
  candidatePool: number;
}

/**
 * Difficulty curve after playtesting:
 * - Easy was suiciding in ~12s (unreachable teleport plans + fast think) → free wins.
 * - Plans must be keyboard-reachable; Easy thinks longer and samples a small top pool.
 */
export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: {
    id: 'easy',
    label: '簡單',
    thinkMin: 650,
    thinkMax: 1200,
    holeWeight: 9,
    heightWeight: 0.85,
    bumpWeight: 0.45,
    clearWeight: 2.8,
    attackWeight: 0.25,
    tSlotWeight: 0.05,
    noise: 3,
    garbageDropCap: 3,
    lookahead: false,
    candidatePool: 2,
  },
  normal: {
    id: 'normal',
    label: '普通',
    thinkMin: 160,
    thinkMax: 320,
    holeWeight: 7.5,
    heightWeight: 0.55,
    bumpWeight: 0.35,
    clearWeight: 2.2,
    attackWeight: 1.0,
    tSlotWeight: 0.7,
    noise: 2,
    garbageDropCap: 6,
    lookahead: false,
    candidatePool: 2,
  },
  hard: {
    id: 'hard',
    label: '困難',
    thinkMin: 55,
    thinkMax: 130,
    holeWeight: 10,
    heightWeight: 0.7,
    bumpWeight: 0.45,
    clearWeight: 3,
    attackWeight: 1.5,
    tSlotWeight: 1.4,
    noise: 0,
    garbageDropCap: 10,
    lookahead: true,
    candidatePool: 1,
  },
};

/** Max garbage lines applied to the human player in one delivery wave. */
export const PLAYER_GARBAGE_DROP_CAP = 8;

export interface PlacementPlan {
  rotation: Rotation;
  col: number;
  /** Target landing row for the piece's position.row. */
  row: number;
  score: number;
  linesCleared: number;
  attack: number;
}

function columnHeights(board: Cell[][]): number[] {
  const heights = Array<number>(BOARD_SIZE.cols).fill(0);
  for (let c = 0; c < BOARD_SIZE.cols; c++) {
    for (let r = 0; r < BOARD_SIZE.rows; r++) {
      if (board[r][c] !== null) {
        heights[c] = BOARD_SIZE.rows - r;
        break;
      }
    }
  }
  return heights;
}

function countHoles(board: Cell[][]): number {
  let holes = 0;
  for (let c = 0; c < BOARD_SIZE.cols; c++) {
    let seenBlock = false;
    for (let r = 0; r < BOARD_SIZE.rows; r++) {
      if (board[r][c] !== null) seenBlock = true;
      else if (seenBlock) holes += 1;
    }
  }
  return holes;
}

function bumpiness(heights: number[]): number {
  let sum = 0;
  for (let c = 0; c < heights.length - 1; c++) {
    sum += Math.abs(heights[c] - heights[c + 1]);
  }
  return sum;
}

/** Rough T-slot: a flat T well (3-wide notch under a single gap). */
function tSlotBonus(board: Cell[][]): number {
  let bonus = 0;
  for (let r = 1; r < BOARD_SIZE.rows - 1; r++) {
    for (let c = 1; c < BOARD_SIZE.cols - 1; c++) {
      const open = board[r][c] === null;
      const left = board[r][c - 1] !== null;
      const right = board[r][c + 1] !== null;
      const below = board[r + 1][c] !== null;
      const aboveOpen = board[r - 1][c] === null;
      if (open && left && right && below && aboveOpen) bonus += 1;
    }
  }
  return bonus;
}

function evaluateBoard(
  board: Cell[][],
  linesCleared: number,
  attack: number,
  preset: DifficultyPreset,
): number {
  const heights = columnHeights(board);
  const aggHeight = heights.reduce((a, b) => a + b, 0);
  const maxHeight = heights.reduce((a, b) => Math.max(a, b), 0);
  const holes = countHoles(board);
  const bump = bumpiness(heights);
  const tSlots = tSlotBonus(board);
  // Panic: when the stack is tall, prefer any clear over attack grooming.
  const panicClear = maxHeight >= 12 ? linesCleared * 180 : 0;
  const nearTopPenalty = maxHeight >= 15 ? (maxHeight - 14) * 80 : 0;
  return (
    linesCleared * preset.clearWeight * 40 +
    attack * preset.attackWeight * 50 +
    tSlots * preset.tSlotWeight * 12 +
    panicClear -
    holes * preset.holeWeight * 35 -
    aggHeight * preset.heightWeight -
    bump * preset.bumpWeight -
    nearTopPenalty
  );
}

function landPiece(board: Cell[][], piece: ActivePiece): ActivePiece | null {
  let current = piece;
  if (collides(board, current)) return null;
  for (;;) {
    const down = movePiece(board, current, 1, 0);
    if (!down) break;
    current = down;
  }
  return current;
}

/**
 * Walk the same rotate→shift path the versus loop uses.
 * Returns null when the target orientation/column is not reachable on this board
 * (teleport placements were the main Easy-mode suicide cause).
 */
export function reachPlacement(
  board: Cell[][],
  type: TetrominoType,
  rotation: Rotation,
  col: number,
): ActivePiece | null {
  let piece = spawnPiece(type);
  if (collides(board, piece)) return null;

  let rotGuard = 0;
  while (piece.rotation !== rotation && rotGuard < 4) {
    const { piece: next, kickIndex } = tryRotateWithKick(board, piece, 1);
    if (kickIndex < 0) return null;
    piece = next;
    rotGuard += 1;
  }
  if (piece.rotation !== rotation) return null;

  let shiftGuard = 0;
  while (piece.position.col !== col && shiftGuard < 12) {
    const dir = col > piece.position.col ? 1 : -1;
    const moved = movePiece(board, piece, 0, dir);
    if (!moved) return null;
    piece = moved;
    shiftGuard += 1;
  }
  if (piece.position.col !== col) return null;

  return landPiece(board, piece);
}

function simulatePlacement(
  board: Cell[][],
  type: TetrominoType,
  rotation: Rotation,
  col: number,
  backToBackReady: boolean,
  combo: number,
  level: number,
): { board: Cell[][]; linesCleared: number; attack: number; piece: ActivePiece } | null {
  const landed = reachPlacement(board, type, rotation, col);
  if (!landed) return null;

  // AI heuristic: credit a T-Spin shape only when the piece is T. Exact last-action
  // rotate rules are enforced in the real lock path; this is for placement ranking.
  const tSpin = detectTSpin(board, landed, type === 'T' ? 'rotate' : 'drop', 0);
  const merged = mergePiece(board, landed);
  const { board: cleared, linesCleared } = clearLines(merged);
  const breakdown = scoreClear({
    linesCleared,
    level,
    tSpin,
    backToBackReady,
    combo,
    perfectClear: cleared.every((row) => row.every((cell) => cell === null)),
    softDropRows: 0,
    hardDropRows: 0,
  });
  return {
    board: cleared,
    linesCleared,
    attack: breakdown.attack,
    piece: landed,
  };
}

function scorePlacement(
  board: Cell[][],
  type: TetrominoType,
  nextType: TetrominoType | null,
  rotation: Rotation,
  col: number,
  preset: DifficultyPreset,
  backToBackReady: boolean,
  combo: number,
  level: number,
): PlacementPlan | null {
  const sim = simulatePlacement(board, type, rotation, col, backToBackReady, combo, level);
  if (!sim) return null;

  let score = evaluateBoard(sim.board, sim.linesCleared, sim.attack, preset);
  if (preset.lookahead && nextType) {
    let bestNext = -Infinity;
    for (let rot = 0 as Rotation; rot < 4; rot = (rot + 1) as Rotation) {
      for (let c = -2; c < BOARD_SIZE.cols; c++) {
        const nextB2b =
          sim.linesCleared > 0
            ? sim.linesCleared === 4 || sim.attack >= 2
            : backToBackReady;
        const next = simulatePlacement(
          sim.board,
          nextType,
          rot,
          c,
          nextB2b,
          sim.linesCleared > 0 ? combo + 1 : 0,
          level,
        );
        if (!next) continue;
        const s = evaluateBoard(next.board, next.linesCleared, next.attack, preset);
        if (s > bestNext) bestNext = s;
      }
    }
    if (bestNext > -Infinity) score += bestNext * 0.55;
  }

  if (preset.noise > 0) {
    score += (Math.random() * 2 - 1) * preset.noise;
  }

  return {
    rotation,
    col,
    row: sim.piece.position.row,
    score,
    linesCleared: sim.linesCleared,
    attack: sim.attack,
  };
}

function pickFromRanked(plans: PlacementPlan[], poolSize: number): PlacementPlan {
  if (plans.length === 0) {
    throw new Error('pickFromRanked requires at least one plan');
  }
  const sorted = [...plans].sort((a, b) => b.score - a.score);
  const size = Math.max(1, Math.min(sorted.length, poolSize));
  const pool = sorted.slice(0, size);
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/**
 * Pick a hard-drop placement for the current piece.
 * Only reachable (rotate→shift→drop) slots are considered.
 */
export function findBestPlacement(
  board: Cell[][],
  type: TetrominoType,
  nextType: TetrominoType | null,
  preset: DifficultyPreset,
  options: { backToBackReady?: boolean; combo?: number; level?: number } = {},
): PlacementPlan | null {
  const backToBackReady = options.backToBackReady ?? false;
  const combo = options.combo ?? 0;
  const level = options.level ?? 1;
  const candidates: PlacementPlan[] = [];

  for (let rot = 0 as Rotation; rot < 4; rot = (rot + 1) as Rotation) {
    for (let col = -2; col < BOARD_SIZE.cols + 1; col++) {
      const plan = scorePlacement(
        board,
        type,
        nextType,
        rot,
        col,
        preset,
        backToBackReady,
        combo,
        level,
      );
      if (plan) candidates.push(plan);
    }
  }

  if (candidates.length === 0) return null;
  return pickFromRanked(candidates, preset.candidatePool);
}

export function thinkDelayMs(preset: DifficultyPreset): number {
  const span = Math.max(0, preset.thinkMax - preset.thinkMin);
  return preset.thinkMin + Math.floor(Math.random() * (span + 1));
}
