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

