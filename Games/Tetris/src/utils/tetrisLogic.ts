export type TetrominoType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';

export type Cell = TetrominoType | null;

export interface BoardSize {
  rows: number;
  cols: number;
}

export const BOARD_SIZE: BoardSize = { rows: 20, cols: 10 };

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

export function rotatePiece(
  piece: ActivePiece,
  direction: 1 | -1,
): ActivePiece {
  const nextRotation = ((piece.rotation + direction + 4) % 4) as Rotation;
  return { ...piece, rotation: nextRotation };
}

export function tryRotateWithKick(
  board: Cell[][],
  piece: ActivePiece,
  direction: 1 | -1,
): ActivePiece {
  const base = rotatePiece(piece, direction);
  const kicks: Position[] = [
    { row: 0, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: -1, col: 0 },
    { row: 1, col: 0 },
  ];
  for (const kick of kicks) {
    const moved: ActivePiece = {
      ...base,
      position: {
        row: base.position.row + kick.row,
        col: base.position.col + kick.col,
      },
    };
    if (!collides(board, moved)) return moved;
  }
  return piece;
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



/* ---------------- Game modes ---------------- */

export type Mode = 'marathon' | 'sprint' | 'ultra';

interface ModeConfig {
  label: string;
  blurb: string;
  /** Stop once this many lines are cleared (sprint). */
  lineGoal: number | null;
  /** Stop after this long (ultra). */
  timeLimitMs: number | null;
  /** What counts as a better run when comparing against the stored best. */
  rank: 'fastest' | 'highest';
  /** Unit shown next to the best record. */
  recordKind: 'time' | 'score';
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
};

/**
 * Whether a run has met its mode's goal — 40 lines for sprint, the clock for
 * ultra, never for marathon. Both the piece-lock path and the run timer ask
 * this, so the two cannot disagree about when a run is finished.
 */
export function isGoalMet(mode: Mode, lines: number, elapsedMs: number): boolean {
  const config = MODES[mode];
  if (config.lineGoal !== null && lines >= config.lineGoal) return true;
  if (config.timeLimitMs !== null && elapsedMs >= config.timeLimitMs) return true;
  return false;
}

/* ---------------- Presentation ---------------- */

/** Tailwind background class per tetromino, shared by the board, Hold and Next. */
export const TETROMINO_COLOR: Record<TetrominoType, string> = {
  I: 'bg-cyan-400',
  O: 'bg-yellow-300',
  T: 'bg-purple-400',
  S: 'bg-emerald-400',
  Z: 'bg-red-500',
  J: 'bg-blue-500',
  L: 'bg-orange-400',
};

/**
 * The occupied cells of a piece, trimmed to its bounding box, so a preview can
 * draw the shape centred instead of floating inside the 4×4 spawn matrix.
 */
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
