/**
 * Connect Four: 7 columns x 6 rows. Drop piece in column, first to connect 4 wins.
 * Row 0 = top, row 5 = bottom. Piece drops to lowest empty in column.
 */

export type PieceColor = 'red' | 'yellow';

export type Cell = PieceColor | null;
export type Board = Cell[][];

export const COLS = 7;
export const ROWS = 6;

export function createInitialBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

/** Get the row index where a piece would land in column c (0 = top, 5 = bottom). */
export function getDropRow(board: Board, col: number): number | null {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) return r;
  }
  return null;
}

/** Columns that are not full. */
export function getLegalColumns(board: Board): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) {
    if (getDropRow(board, c) !== null) out.push(c);
  }
  return out;
}

/** Drop piece in column; returns new board or null if column full. */
export function dropPiece(board: Board, col: number, color: PieceColor): Board | null {
  const row = getDropRow(board, col);
  if (row === null) return null;
  const next = board.map((r, i) => (i === row ? r.map((cell, j) => (j === col ? color : cell)) : [...r]));
  return next;
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function countInDirection(
  board: Board,
  row: number,
  col: number,
  color: PieceColor,
  dr: number,
  dc: number
): number {
  let count = 0;
  let r = row;
  let c = col;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === color) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

/** Check if placing color at (row, col) wins (4 in a row through that cell). */
export function hasWonAt(board: Board, row: number, col: number, color: PieceColor): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    const count =
      countInDirection(board, row, col, color, dr, dc) +
      countInDirection(board, row, col, color, -dr, -dc) -
      1;
    if (count >= 4) return true;
  }
  return false;
}

/** True if every cell is filled. */
export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

/** Simple bot: prefer winning move, then blocking move, else closest-to-center column. */
export function pickBotColumn(board: Board, color: PieceColor): number | null {
  const legal = getLegalColumns(board);
  if (legal.length === 0) return null;

  const opp: PieceColor = color === 'red' ? 'yellow' : 'red';

  // 1) Try to win immediately
  for (const c of legal) {
    const r = getDropRow(board, c);
    if (r === null) continue;
    const next = dropPiece(board, c, color);
    if (!next) continue;
    if (hasWonAt(next, r, c, color)) return c;
  }

  // 2) Block opponent's immediate win
  for (const c of legal) {
    const r = getDropRow(board, c);
    if (r === null) continue;
    const next = dropPiece(board, c, opp);
    if (!next) continue;
    if (hasWonAt(next, r, c, opp)) return c;
  }

  // 3) Otherwise, pick column closest to center
  const center = (COLS - 1) / 2;
  let best = legal[0];
  let bestDist = Math.abs(best - center);
  for (const c of legal) {
    const d = Math.abs(c - center);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}
