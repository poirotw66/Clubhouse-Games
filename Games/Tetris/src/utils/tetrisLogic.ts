export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export type Cell = TetrominoType | 'G' | null;

export interface BoardSize {
  rows: number;
  cols: number;
}

export const BOARD_SIZE: BoardSize = { rows: 20, cols: 10 };

/** Visible playfield rows; pieces may spawn slightly above. */
export type Rotation = 0 | 1 | 2 | 3;

export interface Position {
  row: number;
  col: number;
}

export interface ActivePiece {
  type: TetrominoType;
  rotation: Rotation;
  position: Position; // top-left of shape matrix
}

export type LastAction = 'spawn' | 'move' | 'rotate' | 'drop';

export type TSpinKind = 'none' | 'mini' | 'full';

type ShapeMatrix = number[][];

const SHAPES: Record<TetrominoType, ShapeMatrix[]> = {
  I: [
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  O: [
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  T: [
    [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  J: [
    [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  L: [
    [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  S: [
    [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  Z: [
    [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
};

/**
 * SRS wall-kick offsets as (col, row) deltas.
 * Guideline tables use +Y upward; our board grows downward, so Y is negated when applied.
 */
type KickPair = readonly [number, number];

const JLSTZ_KICKS: Record<string, KickPair[]> = {
  '0>1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '1>0': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '1>2': [
    [0, 0],
    [1, 0],
    [1, -1],
    [0, 2],
    [1, 2],
  ],
  '2>1': [
    [0, 0],
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  '2>3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  '3>2': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '3>0': [
    [0, 0],
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
  '0>3': [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
};

const I_KICKS: Record<string, KickPair[]> = {
  '0>1': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '1>0': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '1>2': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  '2>1': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '2>3': [
    [0, 0],
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  '3>2': [
    [0, 0],
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  '3>0': [
    [0, 0],
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
  '0>3': [
    [0, 0],
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
};

export function getShapeMatrix(type: TetrominoType, rotation: Rotation = 0): ShapeMatrix {
  return SHAPES[type][rotation];
}

export function createEmptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_SIZE.rows }, () =>
    Array<Cell>(BOARD_SIZE.cols).fill(null),
  );
}

export function shuffleBag(bag: TetrominoType[]): TetrominoType[] {
  const result = [...bag];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createSevenBag(): TetrominoType[] {
  return shuffleBag(['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
}

export function getCellsForActive(piece: ActivePiece): Position[] {
  const matrix = SHAPES[piece.type][piece.rotation];
  const cells: Position[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (matrix[r][c]) {
        cells.push({
          row: piece.position.row + r,
          col: piece.position.col + c,
        });
      }
    }
  }
  return cells;
}

export function collides(board: Cell[][], piece: ActivePiece): boolean {
  const cells = getCellsForActive(piece);
  for (const { row, col } of cells) {
    if (
      col < 0 ||
      col >= BOARD_SIZE.cols ||
      row >= BOARD_SIZE.rows ||
      (row >= 0 && board[row][col] !== null)
    ) {
      return true;
    }
  }
  return false;
}

export function spawnPiece(type: TetrominoType): ActivePiece {
  return {
    type,
    rotation: 0,
    position: { row: -1, col: 3 },
  };
}

export function mergePiece(board: Cell[][], piece: ActivePiece): Cell[][] {
  const next = board.map((row) => [...row]);
  for (const { row, col } of getCellsForActive(piece)) {
    if (row >= 0 && row < BOARD_SIZE.rows && col >= 0 && col < BOARD_SIZE.cols) {
      next[row][col] = piece.type;
    }
  }
  return next;
}

export interface ClearResult {
  board: Cell[][];
  linesCleared: number;
}

export function clearLines(board: Cell[][]): ClearResult {
  const remaining: Cell[][] = [];
  let cleared = 0;
  for (let r = 0; r < BOARD_SIZE.rows; r++) {
    const full = board[r].every((cell) => cell !== null);
    if (full) {
      cleared += 1;
    } else {
      remaining.push(board[r]);
    }
  }
  while (remaining.length < BOARD_SIZE.rows) {
    remaining.unshift(Array<Cell>(BOARD_SIZE.cols).fill(null));
  }
  return { board: remaining, linesCleared: cleared };
}

export function findFullRows(board: Cell[][]): number[] {
  const rows: number[] = [];
  for (let r = 0; r < board.length; r++) {
    if (board[r].every((cell) => cell !== null)) rows.push(r);
  }
  return rows;
}

export function isBoardEmpty(board: Cell[][]): boolean {
  return board.every((row) => row.every((cell) => cell === null));
}

export function rotatePiece(piece: ActivePiece, direction: 1 | -1): ActivePiece {
  const nextRotation = ((piece.rotation + direction + 4) % 4) as Rotation;
  return { ...piece, rotation: nextRotation };
}

export interface RotateResult {
  piece: ActivePiece;
  /** Kick index that succeeded (0 = no offset). -1 if rotation failed. */
  kickIndex: number;
}

function kickKey(from: Rotation, to: Rotation): string {
  return `${from}>${to}`;
}

function kicksFor(type: TetrominoType, from: Rotation, to: Rotation): KickPair[] {
  if (type === 'O') return [[0, 0]];
  const table = type === 'I' ? I_KICKS : JLSTZ_KICKS;
  return table[kickKey(from, to)] ?? [[0, 0]];
}

/**
 * Guideline SRS rotation with wall kicks.
 * JLSTZ and I use their own tables; O never needs a kick.
 */
export function tryRotateWithKick(
  board: Cell[][],
  piece: ActivePiece,
  direction: 1 | -1,
): RotateResult {
  const from = piece.rotation;
  const base = rotatePiece(piece, direction);
  const to = base.rotation;
  const kicks = kicksFor(piece.type, from, to);

  for (let i = 0; i < kicks.length; i++) {
    const [dx, dyUp] = kicks[i];
    const moved: ActivePiece = {
      ...base,
      position: {
        row: base.position.row - dyUp,
        col: base.position.col + dx,
      },
    };
    if (!collides(board, moved)) {
      return { piece: moved, kickIndex: i };
    }
  }
  return { piece, kickIndex: -1 };
}

export function movePiece(
  board: Cell[][],
  piece: ActivePiece,
  deltaRow: number,
  deltaCol: number,
): ActivePiece | null {
  const moved: ActivePiece = {
    ...piece,
    position: {
      row: piece.position.row + deltaRow,
      col: piece.position.col + deltaCol,
    },
  };
  if (collides(board, moved)) return null;
  return moved;
}

function isFilledCorner(board: Cell[][], row: number, col: number): boolean {
  if (col < 0 || col >= BOARD_SIZE.cols || row >= BOARD_SIZE.rows) return true;
  if (row < 0) return false;
  return board[row][col] !== null;
}

/** T center in board coords for our 4×4 matrices. */
export function tCenter(piece: ActivePiece): Position {
  return {
    row: piece.position.row + 1,
    col: piece.position.col + 1,
  };
}

/**
 * Guideline 3-corner T-Spin rule.
 * Mini when the two front corners are not both filled (unless a rare kick upgrades it).
 */
export function detectTSpin(
  board: Cell[][],
  piece: ActivePiece,
  lastAction: LastAction,
  kickIndex: number,
): TSpinKind {
  if (piece.type !== 'T' || lastAction !== 'rotate') return 'none';

  const center = tCenter(piece);
  const corners = {
    nw: isFilledCorner(board, center.row - 1, center.col - 1),
    ne: isFilledCorner(board, center.row - 1, center.col + 1),
    sw: isFilledCorner(board, center.row + 1, center.col - 1),
    se: isFilledCorner(board, center.row + 1, center.col + 1),
  };
  const filled = [corners.nw, corners.ne, corners.sw, corners.se].filter(Boolean).length;
  if (filled < 3) return 'none';

  let frontFilled = 0;
  if (piece.rotation === 0) frontFilled = Number(corners.nw) + Number(corners.ne);
  else if (piece.rotation === 1) frontFilled = Number(corners.ne) + Number(corners.se);
  else if (piece.rotation === 2) frontFilled = Number(corners.sw) + Number(corners.se);
  else frontFilled = Number(corners.nw) + Number(corners.sw);

  // Kick index 4 on certain transitions finishes a T-Spin Triple / Immobile and is never Mini.
  if (frontFilled < 2 && kickIndex === 4) return 'full';
  if (frontFilled < 2) return 'mini';
  return 'full';
}

export interface ScoreContext {
  linesCleared: number;
  level: number;
  tSpin: TSpinKind;
  /** True if the previous clear was a Tetris or any T-Spin clear. */
  backToBackReady: boolean;
  /** Current combo before this clear (0 = not in a combo). */
  combo: number;
  perfectClear: boolean;
  softDropRows: number;
  hardDropRows: number;
}

export interface ScoreBreakdown {
  clearScore: number;
  softDropScore: number;
  hardDropScore: number;
  comboScore: number;
  perfectClearScore: number;
  /** Total added this lock. */
  total: number;
  /** Whether this clear continues / starts B2B. */
  isBackToBack: boolean;
  /** Whether this clear is B2B-capable (Tetris or T-Spin with lines). */
  isDifficult: boolean;
  label: string;
  attack: number;
  nextBackToBackReady: boolean;
  nextCombo: number;
}

const LINE_BASE = [0, 100, 300, 500, 800] as const;
const TSPIN_FULL_BASE = [400, 800, 1200, 1600] as const;
const TSPIN_MINI_BASE = [0, 100, 200, 0] as const;
const PERFECT_CLEAR_BASE = [0, 800, 1200, 1800, 2000] as const;

/** Combo garbage: index = combo count after the clear (1 = first clear in a streak). */
export const COMBO_GARBAGE = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5] as const;

function clearLabel(lines: number, tSpin: TSpinKind): string {
  if (tSpin === 'full') {
    if (lines === 0) return 'T-SPIN';
    if (lines === 1) return 'T-SPIN SINGLE';
    if (lines === 2) return 'T-SPIN DOUBLE';
    if (lines === 3) return 'T-SPIN TRIPLE';
  }
  if (tSpin === 'mini') {
    if (lines === 0) return 'T-SPIN MINI';
    if (lines === 1) return 'T-SPIN MINI SINGLE';
    if (lines === 2) return 'T-SPIN MINI DOUBLE';
  }
  if (lines === 1) return 'SINGLE';
  if (lines === 2) return 'DOUBLE';
  if (lines === 3) return 'TRIPLE';
  if (lines === 4) return 'TETRIS';
  return '';
}

export function scoreClear(ctx: ScoreContext): ScoreBreakdown {
  const { linesCleared, level, tSpin, backToBackReady, combo, perfectClear } = ctx;
  const softDropScore = ctx.softDropRows;
  const hardDropScore = ctx.hardDropRows * 2;

  let clearScore = 0;
  if (tSpin === 'full') {
    clearScore = (TSPIN_FULL_BASE[Math.min(linesCleared, 3)] ?? 0) * level;
  } else if (tSpin === 'mini') {
    clearScore = (TSPIN_MINI_BASE[Math.min(linesCleared, 3)] ?? 0) * level;
  } else {
    clearScore = (LINE_BASE[Math.min(linesCleared, 4)] ?? 0) * level;
  }

  const isDifficult =
    linesCleared > 0 && (linesCleared === 4 || tSpin === 'full' || tSpin === 'mini');
  const isBackToBack = isDifficult && backToBackReady;
  if (isBackToBack) {
    clearScore = Math.floor(clearScore * 1.5);
  }

  const comboScore =
    linesCleared > 0 && combo > 0 ? 50 * combo * level : 0;

  const perfectClearScore =
    perfectClear && linesCleared > 0
      ? (PERFECT_CLEAR_BASE[Math.min(linesCleared, 4)] ?? 0) * level
      : 0;

  const nextCombo = linesCleared > 0 ? combo + 1 : 0;
  const nextBackToBackReady = linesCleared === 0 ? backToBackReady : isDifficult;

  let attack = 0;
  if (linesCleared > 0) {
    if (tSpin === 'full') {
      attack = [0, 2, 4, 6][linesCleared] ?? 0;
    } else if (tSpin === 'mini') {
      attack = linesCleared >= 2 ? 1 : 0;
    } else {
      attack = [0, 0, 1, 2, 4][linesCleared] ?? 0;
    }
    if (isBackToBack) attack += 1;
    const comboIdx = Math.min(nextCombo, COMBO_GARBAGE.length - 1);
    attack += COMBO_GARBAGE[comboIdx] ?? 0;
    if (perfectClear) attack += 10;
  }

  const label = clearLabel(linesCleared, tSpin);
  const total = clearScore + softDropScore + hardDropScore + comboScore + perfectClearScore;

  return {
    clearScore,
    softDropScore,
    hardDropScore,
    comboScore,
    perfectClearScore,
    total,
    isBackToBack,
    isDifficult,
    label,
    attack,
    nextBackToBackReady,
    nextCombo,
  };
}

/** Build flash lines such as "T-SPIN DOUBLE", "B2B", "3 COMBO", "+1200". */
export function formatClearCallouts(breakdown: ScoreBreakdown): string[] {
  const lines: string[] = [];
  if (breakdown.label) lines.push(breakdown.label);
  if (breakdown.isBackToBack) lines.push('B2B');
  if (breakdown.nextCombo >= 2) lines.push(`${breakdown.nextCombo} COMBO`);
  if (breakdown.perfectClearScore > 0) lines.push('PERFECT CLEAR');
  if (breakdown.total > 0) lines.push(`+${breakdown.total}`);
  return lines;
}

/* ---------------- Garbage (versus) ---------------- */

export function cancelGarbage(incoming: number, attack: number): {
  incoming: number;
  outgoing: number;
} {
  if (attack >= incoming) {
    return { incoming: 0, outgoing: attack - incoming };
  }
  return { incoming: incoming - attack, outgoing: 0 };
}

/** One garbage line with a single hole; same hole for a whole burst. */
export function makeGarbageRow(holeCol: number): Cell[] {
  const row = Array<Cell>(BOARD_SIZE.cols).fill('G');
  const hole = ((holeCol % BOARD_SIZE.cols) + BOARD_SIZE.cols) % BOARD_SIZE.cols;
  row[hole] = null;
  return row;
}

/**
 * Push garbage lines from the bottom. Returns null if the stack would overflow
 * the top (top-out for the receiver).
 */
export function applyGarbage(board: Cell[][], lines: number, holeCol: number): Cell[][] | null {
  if (lines <= 0) return board.map((row) => [...row]);
  const next = board.map((row) => [...row]);
  for (let i = 0; i < lines; i++) {
    const top = next.shift();
    if (top && top.some((cell) => cell !== null)) {
      return null;
    }
    next.push(makeGarbageRow(holeCol));
  }
  return next;
}

/* ---------------- Game modes ---------------- */

export type Mode = 'marathon' | 'sprint' | 'ultra' | 'versus';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface ModeConfig {
  label: string;
  blurb: string;
  lineGoal: number | null;
  timeLimitMs: number | null;
  rank: 'fastest' | 'highest' | 'wins';
  recordKind: 'time' | 'score' | 'wins';
}

export const MODES: Record<Mode, ModeConfig> = {
  marathon: {
    label: '無盡',
    blurb: '一直玩到頂，等級隨行數上升',
    lineGoal: null,
    timeLimitMs: null,
    rank: 'highest',
    recordKind: 'score',
  },
  sprint: {
    label: '衝刺 40 行',
    blurb: '清完 40 行，比誰快',
    lineGoal: 40,
    timeLimitMs: null,
    rank: 'fastest',
    recordKind: 'time',
  },
  ultra: {
    label: '限時 2 分',
    blurb: '兩分鐘內拿到最高分',
    lineGoal: null,
    timeLimitMs: 2 * 60 * 1000,
    rank: 'highest',
    recordKind: 'score',
  },
  versus: {
    label: '對戰 CPU',
    blurb: '雙場地垃圾行對戰，先頂死對手',
    lineGoal: null,
    timeLimitMs: null,
    rank: 'wins',
    recordKind: 'wins',
  },
};

export function isGoalMet(mode: Mode, lines: number, elapsedMs: number): boolean {
  const config = MODES[mode];
  if (config.lineGoal !== null && lines >= config.lineGoal) return true;
  if (config.timeLimitMs !== null && elapsedMs >= config.timeLimitMs) return true;
  return false;
}

/* ---------------- Presentation ---------------- */

export const TETROMINO_COLOR: Record<TetrominoType | 'G', string> = {
  I: 'bg-cyan-400',
  O: 'bg-yellow-300',
  T: 'bg-purple-400',
  S: 'bg-emerald-400',
  Z: 'bg-red-500',
  J: 'bg-blue-500',
  L: 'bg-orange-400',
  G: 'bg-slate-500',
};

export function tetrominoBlockUrl(type: TetrominoType): string {
  return `${import.meta.env.BASE_URL}blocks/${type.toLowerCase()}.jpg`;
}

export function getTrimmedShape(type: TetrominoType): boolean[][] {
  const matrix = getShapeMatrix(type, 0);
  let top = matrix.length;
  let bottom = -1;
  let left = matrix[0].length;
  let right = -1;

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }
  if (bottom < 0) return [];

  const out: boolean[][] = [];
  for (let r = top; r <= bottom; r++) {
    const row: boolean[] = [];
    for (let c = left; c <= right; c++) row.push(Boolean(matrix[r][c]));
    out.push(row);
  }
  return out;
}

/** SRS kick tables exposed for checks / debugging. */
export const SRS_KICK_TABLES = {
  JLSTZ: JLSTZ_KICKS,
  I: I_KICKS,
} as const;
