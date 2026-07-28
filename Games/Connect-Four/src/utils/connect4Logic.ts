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

/** Cells belonging to a winning four-in-a-row, if any. */
export function getWinningCells(board: Board): Set<string> | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const color = board[r][c];
      if (!color || !hasWonAt(board, r, c, color)) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const line: [number, number][] = [[r, c]];
        let rr = r + dr;
        let cc = c + dc;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === color) {
          line.push([rr, cc]);
          rr += dr;
          cc += dc;
        }
        rr = r - dr;
        cc = c - dc;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === color) {
          line.unshift([rr, cc]);
          rr -= dr;
          cc -= dc;
        }
        if (line.length >= 4) {
          return new Set(line.map(([row, col]) => `${row},${col}`));
        }
      }
    }
  }
  return null;
}

/** True if every cell is filled. */
export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

const WIN_SCORE = 1_000_000;

function opponent(color: PieceColor): PieceColor {
  return color === 'red' ? 'yellow' : 'red';
}

function scoreWindow(cells: Cell[], player: PieceColor): number {
  let playerCount = 0;
  let empty = 0;
  for (const cell of cells) {
    if (cell === null) empty++;
    else if (cell === player) playerCount++;
    else return 0;
  }
  if (playerCount === 0) return 0;
  if (playerCount + empty < 4) return 0;
  if (playerCount === 4) return 50_000;
  if (playerCount === 3 && empty === 1) return 120;
  if (playerCount === 2 && empty === 2) return 20;
  if (playerCount === 1 && empty === 3) return 2;
  return 0;
}

function evaluateBoard(board: Board, player: PieceColor): number {
  const opp = opponent(player);
  let score = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const line = [board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]];
      score += scoreWindow(line, player) - scoreWindow(line, opp);
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const line = [board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]];
      score += scoreWindow(line, player) - scoreWindow(line, opp);
    }
  }
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const line = [board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]];
      score += scoreWindow(line, player) - scoreWindow(line, opp);
    }
  }
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const line = [board[r][c], board[r - 1][c + 1], board[r - 2][c + 2], board[r - 3][c + 3]];
      score += scoreWindow(line, player) - scoreWindow(line, opp);
    }
  }

  const center = Math.floor(COLS / 2);
  for (let r = 0; r < ROWS; r++) {
    if (board[r][center] === player) score += 8;
    if (board[r][center] === opp) score -= 8;
  }

  return score;
}

function orderColumns(cols: number[]): number[] {
  const centerOrder = [3, 2, 4, 1, 5, 0, 6];
  return [...cols].sort((a, b) => centerOrder.indexOf(a) - centerOrder.indexOf(b));
}

/**
 * Negamax with alpha-beta. Returns the value of `board` from `turn`'s point of
 * view — including the terminal scores, which is what lets each ply negate the
 * value it gets back. Deeper wins score lower so the bot prefers a fast finish.
 */
function negamax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  turn: PieceColor,
  lastRow: number,
  lastCol: number,
): number {
  // Only the piece just dropped can have completed a line, so check that one
  // cell rather than rescanning all 42. Whoever dropped it is not `turn`, so a
  // win here is always a loss from `turn`'s point of view.
  if (hasWonAt(board, lastRow, lastCol, board[lastRow][lastCol] as PieceColor)) {
    return -WIN_SCORE - depth;
  }
  if (depth <= 0 || isBoardFull(board)) return evaluateBoard(board, turn);

  const legal = orderColumns(getLegalColumns(board));
  if (legal.length === 0) return evaluateBoard(board, turn);

  let value = -Infinity;
  for (const col of legal) {
    const row = getDropRow(board, col);
    if (row === null) continue;
    const next = dropPiece(board, col, turn);
    if (!next) continue;
    const score = -negamax(next, depth - 1, -beta, -alpha, opponent(turn), row, col);
    if (score > value) value = score;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return value;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

type DifficultyConfig = {
  /** Plies of lookahead. */
  depth: number;
  /** Chance of ignoring the search and dropping in a random column. */
  blunderRate: number;
};

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  // Sees an immediate win or block, not much further.
  easy: { depth: 2, blunderRate: 0.3 },
  normal: { depth: 4, blunderRate: 0.05 },
  // Deep enough to build and see forks. Held at 6 because the search blocks
  // the main thread and 7 can spike past half a second in sharp positions.
  hard: { depth: 6, blunderRate: 0 },
};

/**
 * Pick a column for the bot. Ties are broken at random so repeated games
 * against the same difficulty do not replay move for move.
 */
export function pickBotColumn(
  board: Board,
  color: PieceColor,
  difficulty: Difficulty = 'normal',
): number | null {
  const legal = getLegalColumns(board);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  const config = DIFFICULTY[difficulty];
  if (config.blunderRate > 0 && Math.random() < config.blunderRate) {
    return legal[Math.floor(Math.random() * legal.length)];
  }

  // Full window at the root: a narrowed one returns bounds rather than exact
  // values, which would make the equal-score test below pick up false ties.
  let best: number[] = [];
  let bestScore = -Infinity;
  for (const col of orderColumns(legal)) {
    const row = getDropRow(board, col);
    if (row === null) continue;
    const next = dropPiece(board, col, color);
    if (!next) continue;
    const score = -negamax(next, config.depth - 1, -Infinity, Infinity, opponent(color), row, col);
    if (score > bestScore) {
      bestScore = score;
      best = [col];
    } else if (score === bestScore) {
      best.push(col);
    }
  }
  if (best.length === 0) return legal[0];
  return best[Math.floor(Math.random() * best.length)];
}
