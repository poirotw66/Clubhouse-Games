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
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  easy: {
    id: 'easy',
    label: '簡單',
    thinkMin: 280,
    thinkMax: 520,
    holeWeight: 4,
    heightWeight: 0.4,
    bumpWeight: 0.2,
    clearWeight: 1.2,
    attackWeight: 0.6,
    tSlotWeight: 0.1,
    noise: 8,
    garbageDropCap: 4,
    lookahead: false,
  },
  normal: {
    id: 'normal',
    label: '普通',
    thinkMin: 120,
    thinkMax: 260,
    holeWeight: 7.5,
    heightWeight: 0.55,
    bumpWeight: 0.35,
    clearWeight: 2.2,
    attackWeight: 1.1,
    tSlotWeight: 0.8,
    noise: 2.5,
    garbageDropCap: 8,
    lookahead: false,
  },
  hard: {
    id: 'hard',
    label: '困難',
    thinkMin: 40,
    thinkMax: 110,
    holeWeight: 10,
    heightWeight: 0.7,
    bumpWeight: 0.45,
    clearWeight: 3,
    attackWeight: 1.6,
    tSlotWeight: 1.4,
    noise: 0,
    garbageDropCap: 14,
    lookahead: true,
  },
};

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
  const holes = countHoles(board);
  const bump = bumpiness(heights);
  const tSlots = tSlotBonus(board);
  return (
    linesCleared * preset.clearWeight * 40 +
    attack * preset.attackWeight * 50 +
    tSlots * preset.tSlotWeight * 12 -
    holes * preset.holeWeight * 35 -
    aggHeight * preset.heightWeight -
    bump * preset.bumpWeight
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

function trySpawnAt(type: TetrominoType, rotation: Rotation, col: number): ActivePiece {
  let piece = spawnPiece(type);
  // Rotate in place with kicks against an empty board to reach the target orientation.
  const empty = Array.from({ length: BOARD_SIZE.rows }, () =>
    Array<Cell>(BOARD_SIZE.cols).fill(null),
  );
  let guard = 0;
  while (piece.rotation !== rotation && guard < 4) {
    const { piece: next, kickIndex } = tryRotateWithKick(empty, piece, 1);
    if (kickIndex < 0) break;
    piece = next;
    guard += 1;
  }
  piece = {
    ...piece,
    position: { row: piece.position.row, col },
  };
  return piece;
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
  const floated = trySpawnAt(type, rotation, col);
  const landed = landPiece(board, floated);
  if (!landed) return null;

  // Approximate last action: if we needed a non-zero kick path we still mark rotate for T.
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

/**
 * Pick the best hard-drop placement for the current piece.
 * Searches columns × rotations; hard difficulty adds a shallow next-piece lookahead.
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
  let best: PlacementPlan | null = null;

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
      if (!plan) continue;
      if (!best || plan.score > best.score) best = plan;
    }
  }
  return best;
}

export function thinkDelayMs(preset: DifficultyPreset): number {
  const span = Math.max(0, preset.thinkMax - preset.thinkMin);
  return preset.thinkMin + Math.floor(Math.random() * (span + 1));
}
