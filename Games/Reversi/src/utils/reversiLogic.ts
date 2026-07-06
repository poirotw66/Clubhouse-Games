/**
 * Reversi (Othello) game logic. 8×8 board, black moves first.
 * Legal move: place on empty cell and flip at least one opponent piece in a line.
 * Pass when no legal moves; game over when both pass or board full.
 */

export type Piece = 'black' | 'white';
export type Cell = Piece | null;
export type Board = Cell[][];

const SIZE = 8;
const DIRECTIONS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

function opponent(color: Piece): Piece {
  return color === 'black' ? 'white' : 'black';
}

/** Create initial board: white at (3,3)&(4,4), black at (3,4)&(4,3). */
export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  board[3][3] = 'white';
  board[3][4] = 'black';
  board[4][3] = 'black';
  board[4][4] = 'white';
  return board;
}

/** Get coordinates of opponent pieces that would be flipped in one direction. */
function getFlipsInDirection(
  board: Board,
  r: number,
  c: number,
  color: Piece,
  dr: number,
  dc: number
): [number, number][] {
  const out: [number, number][] = [];
  let i = r + dr;
  let j = c + dc;
  while (i >= 0 && i < SIZE && j >= 0 && j < SIZE) {
    const cell = board[i][j];
    if (cell === null) return [];
    if (cell === color) return out;
    out.push([i, j]);
    i += dr;
    j += dc;
  }
  return [];
}

/** Whether placing color at (r,c) flips at least one piece. */
export function isLegalMove(board: Board, r: number, c: number, color: Piece): boolean {
  if (board[r][c] !== null) return false;
  for (const [dr, dc] of DIRECTIONS) {
    const flips = getFlipsInDirection(board, r, c, color, dr, dc);
    if (flips.length > 0) return true;
  }
  return false;
}

/** All legal (r,c) for color. */
export function getLegalMoves(board: Board, color: Piece): [number, number][] {
  const moves: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (isLegalMove(board, r, c, color)) moves.push([r, c]);
    }
  }
  return moves;
}

/** Apply move at (r,c) for color; return new board. */
export function applyMove(board: Board, r: number, c: number, color: Piece): Board {
  const next = board.map((row) => [...row]);
  next[r][c] = color;
  for (const [dr, dc] of DIRECTIONS) {
    const flips = getFlipsInDirection(board, r, c, color, dr, dc);
    for (const [i, j] of flips) next[i][j] = color;
  }
  return next;
}

/** Count pieces by color. */
export function countPieces(board: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      if (cell === 'black') black++;
      else if (cell === 'white') white++;
    }
  }
  return { black, white };
}

/** Winner when game over: 'black' | 'white' | 'draw'. */
export function getWinner(board: Board): Piece | 'draw' {
  const { black, white } = countPieces(board);
  if (black > white) return 'black';
  if (white > black) return 'white';
  return 'draw';
}

/** Position weights for heuristic: corners best, then edges. */
const SQUARE_WEIGHT = [
  [100, -20, 10, 5, 5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [10, -2, 1, 0, 0, 1, -2, 10],
  [5, -2, 0, 0, 0, 0, -2, 5],
  [5, -2, 0, 0, 0, 0, -2, 5],
  [10, -2, 1, 0, 0, 1, -2, 10],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [100, -20, 10, 5, 5, 10, -20, 100],
];

/**
 * Pick a legal move for the bot using minimax (depth 4) + mobility.
 */
export function getBestMove(board: Board, color: Piece): [number, number] | null {
  const moves = getLegalMoves(board, color);
  if (moves.length === 0) return null;

  const DEPTH = 4;
  let best = moves[0];
  let bestScore = -Infinity;

  for (const [r, c] of moves) {
    const next = applyMove(board, r, c, color);
    const score = -minimax(next, DEPTH - 1, -Infinity, Infinity, color, opponent(color));
    if (score > bestScore) {
      bestScore = score;
      best = [r, c];
    }
  }
  return best;
}

function evaluateBoard(board: Board, color: Piece): number {
  const opp = opponent(color);
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === color) score += SQUARE_WEIGHT[r][c];
      else if (board[r][c] === opp) score -= SQUARE_WEIGHT[r][c];
    }
  }
  const myMobility = getLegalMoves(board, color).length;
  const oppMobility = getLegalMoves(board, opp).length;
  score += (myMobility - oppMobility) * 8;
  return score;
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  player: Piece,
  turn: Piece,
): number {
  if (depth === 0) return evaluateBoard(board, player);

  let moves = getLegalMoves(board, turn);
  if (moves.length === 0) {
    const passMoves = getLegalMoves(board, opponent(turn));
    if (passMoves.length === 0) {
      const winner = getWinner(board);
      if (winner === player) return 10_000;
      if (winner === opponent(player)) return -10_000;
      return 0;
    }
    return minimax(board, depth - 1, alpha, beta, player, opponent(turn));
  }

  let value = -Infinity;
  for (const [r, c] of moves) {
    const next = applyMove(board, r, c, turn);
    const score = -minimax(next, depth - 1, -beta, -alpha, player, opponent(turn));
    value = Math.max(value, score);
    alpha = Math.max(alpha, value);
    if (alpha >= beta) break;
  }
  return value;
}
