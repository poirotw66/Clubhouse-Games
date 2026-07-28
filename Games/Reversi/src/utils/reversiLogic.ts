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

/**
 * Whether placing color at (r,c) flips at least one piece. This is the hottest
 * function in the bot search, so it walks each direction directly instead of
 * building the flip lists it would only measure and throw away.
 */
export function isLegalMove(board: Board, r: number, c: number, color: Piece): boolean {
  if (board[r][c] !== null) return false;
  for (const [dr, dc] of DIRECTIONS) {
    let i = r + dr;
    let j = c + dc;
    let seenOpponent = false;
    while (i >= 0 && i < SIZE && j >= 0 && j < SIZE) {
      const cell = board[i][j];
      if (cell === null) break;
      if (cell === color) {
        if (seenOpponent) return true;
        break;
      }
      seenOpponent = true;
      i += dr;
      j += dc;
    }
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

/* ------------------------------------------------------------------ *
 * Bot
 * ------------------------------------------------------------------ */

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

type DifficultyConfig = {
  /** Plies of lookahead in the midgame. */
  depth: number;
  /** Chance of playing a random legal move instead of the best one. */
  blunderRate: number;
  /** Solve exactly once this many empty squares remain (0 = never). */
  exactEmpties: number;
  /** Weight on mobility relative to square values. */
  mobilityWeight: number;
};

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  // Shallow and openly fallible, so a first-time player can win.
  easy: { depth: 1, blunderRate: 0.35, exactEmpties: 0, mobilityWeight: 2 },
  // Roughly the strength this bot has always played at.
  normal: { depth: 4, blunderRate: 0.05, exactEmpties: 8, mobilityWeight: 8 },
  // Deeper, values mobility more, and plays the ending out perfectly.
  // 10 empties keeps the exact solve well under a visible pause; 12 can spike
  // past 400ms, and the search is synchronous so that would stall the UI.
  hard: { depth: 6, blunderRate: 0, exactEmpties: 10, mobilityWeight: 14 },
};

/** Position weights: corners best, squares next to them worst. */
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

const CORNERS: [number, number][] = [[0, 0], [0, 7], [7, 0], [7, 7]];
const WIN_SCORE = 100_000;

function countEmpties(board: Board): number {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (board[r][c] === null) n++;
  }
  return n;
}

/**
 * Heuristic score of `board` from `me`'s point of view. Every search value is
 * expressed this way — relative to the side whose turn it is — which is what
 * lets the negamax below flip signs on each ply.
 */
function evaluate(board: Board, me: Piece, mobilityWeight: number, myMoves: number): number {
  const opp = opponent(me);
  let score = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === me) score += SQUARE_WEIGHT[r][c];
      else if (board[r][c] === opp) score -= SQUARE_WEIGHT[r][c];
    }
  }
  const oppMoves = getLegalMoves(board, opp).length;
  score += (myMoves - oppMoves) * mobilityWeight;

  // Held corners are permanent, so weigh them well above their square value.
  for (const [r, c] of CORNERS) {
    if (board[r][c] === me) score += 25;
    else if (board[r][c] === opp) score -= 25;
  }
  return score;
}

/** Final disc difference from `me`'s point of view, scaled to dwarf the heuristic. */
function finalScore(board: Board, me: Piece): number {
  const { black, white } = countPieces(board);
  const diff = me === 'black' ? black - white : white - black;
  return diff * 1000;
}

/** Corners first, then by square value — cheap ordering that prunes a lot. */
function orderMoves(moves: [number, number][]): [number, number][] {
  return [...moves].sort((a, b) => {
    const aCorner = SQUARE_WEIGHT[a[0]][a[1]] === 100 ? 1 : 0;
    const bCorner = SQUARE_WEIGHT[b[0]][b[1]] === 100 ? 1 : 0;
    if (aCorner !== bCorner) return bCorner - aCorner;
    return SQUARE_WEIGHT[b[0]][b[1]] - SQUARE_WEIGHT[a[0]][a[1]];
  });
}

/**
 * Negamax with alpha-beta. Returns the value of `board` from `turn`'s point of
 * view; `exact` searches to the end of the game scoring by disc difference.
 */
function negamax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  turn: Piece,
  mobilityWeight: number,
  exact: boolean,
): number {
  const moves = getLegalMoves(board, turn);
  const stuck = moves.length === 0;

  // Both sides stuck means the game is over, at any depth.
  if (stuck && getLegalMoves(board, opponent(turn)).length === 0) {
    if (exact) return finalScore(board, turn);
    const winner = getWinner(board);
    if (winner === turn) return WIN_SCORE;
    if (winner === opponent(turn)) return -WIN_SCORE;
    return 0;
  }

  // The cutoff must come before the pass branch below, and must test `<= 0`:
  // a pass costs a ply without making a move, so depth can skip past 0 and an
  // `=== 0` test would let the search run away to the end of the game.
  // `moves` is already in hand, so the eval reuses it rather than rescanning.
  if (!exact && depth <= 0) return evaluate(board, turn, mobilityWeight, moves.length);

  // Only this side passes: the turn flips, so the value flips with it.
  if (stuck) {
    return -negamax(board, depth - 1, -beta, -alpha, opponent(turn), mobilityWeight, exact);
  }

  let value = -Infinity;
  for (const [r, c] of orderMoves(moves)) {
    const next = applyMove(board, r, c, turn);
    const score = -negamax(next, depth - 1, -beta, -alpha, opponent(turn), mobilityWeight, exact);
    if (score > value) value = score;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return value;
}

/**
 * Pick a move for the bot. `difficulty` controls lookahead, how much the bot
 * values mobility, when it switches to a perfect endgame search, and how often
 * it deliberately plays something other than its best move.
 */
export function getBestMove(
  board: Board,
  color: Piece,
  difficulty: Difficulty = 'normal',
): [number, number] | null {
  const moves = getLegalMoves(board, color);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const config = DIFFICULTY[difficulty];

  if (config.blunderRate > 0 && Math.random() < config.blunderRate) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const empties = countEmpties(board);
  const exact = config.exactEmpties > 0 && empties <= config.exactEmpties;
  const depth = exact ? empties : config.depth;

  let best = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  for (const [r, c] of orderMoves(moves)) {
    const next = applyMove(board, r, c, color);
    const score = -negamax(
      next, depth - 1, -Infinity, -alpha, opponent(color), config.mobilityWeight, exact,
    );
    if (score > bestScore) {
      bestScore = score;
      best = [r, c];
      if (score > alpha) alpha = score;
    }
  }
  return best;
}
