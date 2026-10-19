/**
 * Reversi (Othello) game logic. 8×8 board, black moves first.
 * Legal move: place on empty cell and flip at least one opponent piece in a line.
 * Pass when no legal moves; game over when both pass or board full.
 */

export type Piece = 'black' | 'white';
export type Cell = Piece | null;
export type Board = Cell[][];

export const SIZE = 8;
export const DIRECTIONS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export function opponent(color: Piece): Piece {
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

/** Cells that would flip if color placed at (r,c). Empty when the move is illegal. */
export function getFlips(board: Board, r: number, c: number, color: Piece): [number, number][] {
  if (board[r][c] !== null) return [];
  const flips: [number, number][] = [];
  for (const [dr, dc] of DIRECTIONS) {
    flips.push(...getFlipsInDirection(board, r, c, color, dr, dc));
  }
  return flips;
}

/** Apply move at (r,c) for color; return new board. */
export function applyMove(board: Board, r: number, c: number, color: Piece): Board {
  const flips = getFlips(board, r, c, color);
  const next = board.map((row) => [...row]);
  next[r][c] = color;
  for (const [i, j] of flips) next[i][j] = color;
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

/** Short player-facing blurbs so Easy / Normal / Hard read as three opponents. */
export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: '只看一步，常亂下',
  normal: '看三步，偶有失誤',
  hard: '深算搶角，殘局全解',
};

export type DifficultyConfig = {
  /** Plies of lookahead in the midgame. */
  depth: number;
  /** Chance of playing a random legal move instead of the best one. */
  blunderRate: number;
  /** Solve exactly once this many empty squares remain (0 = never). */
  exactEmpties: number;
  /** Weight on mobility relative to square values. */
  mobilityWeight: number;
};

/** Extra knobs for named opponents — layered on top of a difficulty base. */
export type BotStyle = {
  depth?: number;
  blunderRate?: number;
  exactEmpties?: number;
  mobilityWeight?: number;
  /** Extra bonus for holding / taking corners (on top of square table). */
  cornerGreed?: number;
  /** Extra weight for edge (non-corner) discs. */
  edgeWeight?: number;
  /** Prefer flipping many discs now (greedy midgame). */
  discGreed?: number;
  /** Extra penalty for X-squares (diagonal next to empty corners). */
  xSquareFear?: number;
};

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  // Depth 1 + high blunderRate: misses corners and replies often.
  easy: { depth: 1, blunderRate: 0.45, exactEmpties: 0, mobilityWeight: 2 },
  // Short midgame look-ahead with occasional slips — clearly above easy.
  normal: { depth: 3, blunderRate: 0.12, exactEmpties: 6, mobilityWeight: 8 },
  // Deeper, values mobility more, and plays the ending out perfectly.
  // 10 empties keeps the exact solve well under a visible pause; 12 can spike
  // past 400ms, and the search is synchronous so that would stall the UI.
  hard: { depth: 6, blunderRate: 0, exactEmpties: 10, mobilityWeight: 14 },
};

/** Exported so `check` can pin the three tiers staying spread apart. */
export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTY[difficulty];
}

export function mergeBotConfig(
  difficulty: Difficulty,
  style?: BotStyle,
): DifficultyConfig & Required<Pick<BotStyle, 'cornerGreed' | 'edgeWeight' | 'discGreed' | 'xSquareFear'>> {
  const base = DIFFICULTY[difficulty];
  return {
    depth: style?.depth ?? base.depth,
    blunderRate: style?.blunderRate ?? base.blunderRate,
    exactEmpties: style?.exactEmpties ?? base.exactEmpties,
    mobilityWeight: style?.mobilityWeight ?? base.mobilityWeight,
    cornerGreed: style?.cornerGreed ?? 25,
    edgeWeight: style?.edgeWeight ?? 0,
    discGreed: style?.discGreed ?? 0,
    xSquareFear: style?.xSquareFear ?? 0,
  };
}

/** Position weights: corners best, squares next to them worst. */
export const SQUARE_WEIGHT = [
  [100, -20, 10, 5, 5, 10, -20, 100],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [10, -2, 1, 0, 0, 1, -2, 10],
  [5, -2, 0, 0, 0, 0, -2, 5],
  [5, -2, 0, 0, 0, 0, -2, 5],
  [10, -2, 1, 0, 0, 1, -2, 10],
  [-20, -50, -2, -2, -2, -2, -50, -20],
  [100, -20, 10, 5, 5, 10, -20, 100],
];

export const CORNERS: [number, number][] = [[0, 0], [0, 7], [7, 0], [7, 7]];
/** Diagonal neighbors of corners — often gift the corner if taken early. */
export const X_SQUARES: [number, number][] = [[1, 1], [1, 6], [6, 1], [6, 6]];
const WIN_SCORE = 100_000;

export function countEmpties(board: Board): number {
  let n = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) if (board[r][c] === null) n++;
  }
  return n;
}

function isEdge(r: number, c: number): boolean {
  if (CORNERS.some(([cr, cc]) => cr === r && cc === c)) return false;
  return r === 0 || r === 7 || c === 0 || c === 7;
}

type EvalWeights = {
  mobilityWeight: number;
  cornerGreed: number;
  edgeWeight: number;
  discGreed: number;
  xSquareFear: number;
};

/**
 * Heuristic score of `board` from `me`'s point of view. Every search value is
 * expressed this way — relative to the side whose turn it is — which is what
 * lets the negamax below flip signs on each ply.
 */
function evaluate(
  board: Board,
  me: Piece,
  myMoves: number,
  weights: EvalWeights,
): number {
  const opp = opponent(me);
  let score = 0;
  let myDiscs = 0;
  let oppDiscs = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      if (cell === me) {
        score += SQUARE_WEIGHT[r][c];
        myDiscs++;
        if (isEdge(r, c)) score += weights.edgeWeight;
      } else if (cell === opp) {
        score -= SQUARE_WEIGHT[r][c];
        oppDiscs++;
        if (isEdge(r, c)) score -= weights.edgeWeight;
      }
    }
  }
  const oppMoves = getLegalMoves(board, opp).length;
  score += (myMoves - oppMoves) * weights.mobilityWeight;
  score += (myDiscs - oppDiscs) * weights.discGreed;

  // Held corners are permanent, so weigh them well above their square value.
  for (const [r, c] of CORNERS) {
    if (board[r][c] === me) score += weights.cornerGreed;
    else if (board[r][c] === opp) score -= weights.cornerGreed;
  }

  if (weights.xSquareFear > 0) {
    for (const [r, c] of X_SQUARES) {
      const corner: [number, number] =
        r === 1 && c === 1 ? [0, 0] : r === 1 && c === 6 ? [0, 7] : r === 6 && c === 1 ? [7, 0] : [7, 7];
      if (board[corner[0]][corner[1]] !== null) continue;
      if (board[r][c] === me) score -= weights.xSquareFear;
      else if (board[r][c] === opp) score += weights.xSquareFear;
    }
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
export function orderMoves(moves: [number, number][]): [number, number][] {
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
  weights: EvalWeights,
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
  if (!exact && depth <= 0) return evaluate(board, turn, moves.length, weights);

  // Only this side passes: the turn flips, so the value flips with it.
  if (stuck) {
    return -negamax(board, depth - 1, -beta, -alpha, opponent(turn), weights, exact);
  }

  let value = -Infinity;
  for (const [r, c] of orderMoves(moves)) {
    const next = applyMove(board, r, c, turn);
    const score = -negamax(next, depth - 1, -beta, -alpha, opponent(turn), weights, exact);
    if (score > value) value = score;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return value;
}

/**
 * Pick a move for the bot. `difficulty` controls lookahead, how much the bot
 * values mobility, when it switches to a perfect endgame search, and how often
 * it deliberately plays something other than its best move. Optional `style`
 * overlays named-opponent preferences (corners, edges, greed, …).
 */
export function getBestMove(
  board: Board,
  color: Piece,
  difficulty: Difficulty = 'normal',
  style?: BotStyle,
): [number, number] | null {
  const moves = getLegalMoves(board, color);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const config = mergeBotConfig(difficulty, style);

  if (config.blunderRate > 0 && Math.random() < config.blunderRate) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const empties = countEmpties(board);
  const exact = config.exactEmpties > 0 && empties <= config.exactEmpties;
  const depth = exact ? empties : config.depth;
  const weights: EvalWeights = {
    mobilityWeight: config.mobilityWeight,
    cornerGreed: config.cornerGreed,
    edgeWeight: config.edgeWeight,
    discGreed: config.discGreed,
    xSquareFear: config.xSquareFear,
  };

  let best = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  for (const [r, c] of orderMoves(moves)) {
    const next = applyMove(board, r, c, color);
    const score = -negamax(
      next, depth - 1, -Infinity, -alpha, opponent(color), weights, exact,
    );
    if (score > bestScore) {
      bestScore = score;
      best = [r, c];
      if (score > alpha) alpha = score;
    }
  }
  return best;
}

/** Score every legal move from `color`'s view (heuristic or exact). Used by review. */
export function scoreMoves(
  board: Board,
  color: Piece,
  difficulty: Difficulty = 'hard',
): Array<{ move: [number, number]; score: number }> {
  const moves = getLegalMoves(board, color);
  if (moves.length === 0) return [];
  const config = mergeBotConfig(difficulty);
  const empties = countEmpties(board);
  const exact = config.exactEmpties > 0 && empties <= config.exactEmpties;
  const depth = exact ? empties : config.depth;
  const weights: EvalWeights = {
    mobilityWeight: config.mobilityWeight,
    cornerGreed: config.cornerGreed,
    edgeWeight: config.edgeWeight,
    discGreed: config.discGreed,
    xSquareFear: config.xSquareFear,
  };
  return orderMoves(moves).map(([r, c]) => {
    const next = applyMove(board, r, c, color);
    const score = -negamax(
      next, depth - 1, -Infinity, Infinity, opponent(color), weights, exact,
    );
    return { move: [r, c] as [number, number], score };
  });
}
