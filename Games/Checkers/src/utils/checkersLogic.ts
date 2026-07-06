/**
 * American/English Checkers (8×8). Dark squares only; black moves first.
 * Men move/capture diagonally forward; kings one step any diagonal.
 * Forced capture; multi-jump mandatory. Crown on last rank.
 */

export type PieceColor = 'black' | 'white';

export interface Piece {
  color: PieceColor;
  king: boolean;
}

export type Cell = Piece | null;
export type Board = Cell[][];

const SIZE = 8;

function isDark(r: number, c: number): boolean {
  return (r + c) % 2 === 1;
}

/** Move: path[0]=from, path[1..]=landing squares (captures in between). */
export interface Move {
  from: [number, number];
  path: [number, number][];
}

function opponent(color: PieceColor): PieceColor {
  return color === 'black' ? 'white' : 'black';
}

const MAN_DIRS: Record<PieceColor, [number, number][]> = {
  black: [[-1, -1], [-1, 1]],
  white: [[1, -1], [1, 1]],
};
const KING_DIRS: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isDark(r, c)) continue;
      if (r <= 2) board[r][c] = { color: 'white', king: false };
      else if (r >= 5) board[r][c] = { color: 'black', king: false };
    }
  }
  return board;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function getDirs(piece: Piece): [number, number][] {
  return piece.king ? KING_DIRS : MAN_DIRS[piece.color];
}

/** Collect all capture sequences from (r,c) with current path. */
function getCaptureSequences(
  board: Board,
  r: number,
  c: number,
  piece: Piece,
  path: [number, number][],
  results: Move[]
): void {
  const dirs = getDirs(piece);
  let anyJump = false;
  for (const [dr, dc] of dirs) {
    const midR = r + dr;
    const midC = c + dc;
    const toR = r + 2 * dr;
    const toC = c + 2 * dc;
    if (!inBounds(toR, toC) || !isDark(toR, toC)) continue;
    const mid = board[midR][midC];
    const toCell = board[toR][toC];
    if (!mid || mid.color !== opponent(piece.color) || toCell !== null) continue;
    anyJump = true;
    const newPath: [number, number][] = [...path, [toR, toC]];
    const newBoard = board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
    newBoard[midR][midC] = null;
    newBoard[r][c] = null;
    const crown = piece.king || (piece.color === 'black' && toR === 0) || (piece.color === 'white' && toR === SIZE - 1);
    newBoard[toR][toC] = { color: piece.color, king: crown };
    getCaptureSequences(newBoard, toR, toC, { color: piece.color, king: crown }, newPath, results);
  }
  if (!anyJump && path.length >= 2) {
    results.push({ from: path[0], path });
  }
}

/** All capture moves for color. */
function getAllCaptures(board: Board, color: PieceColor): Move[] {
  const results: Move[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;
      getCaptureSequences(board, r, c, piece, [[r, c]], results);
    }
  }
  return results;
}

/** All simple (non-capture) moves for color. */
function getSimpleMoves(board: Board, color: PieceColor): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;
      const dirs = getDirs(piece);
      for (const [dr, dc] of dirs) {
        const toR = r + dr;
        const toC = c + dc;
        if (!inBounds(toR, toC) || !isDark(toR, toC) || board[toR][toC] !== null) continue;
        moves.push({ from: [r, c], path: [[r, c], [toR, toC]] });
      }
    }
  }
  return moves;
}

export function getLegalMoves(board: Board, color: PieceColor): Move[] {
  const captures = getAllCaptures(board, color);
  if (captures.length > 0) return captures;
  return getSimpleMoves(board, color);
}

/** Legal moves that start from (fromR, fromC). Used for mandatory continuation after a jump. */
export function getLegalMovesFrom(
  board: Board,
  color: PieceColor,
  fromR: number,
  fromC: number
): Move[] {
  const captures = getAllCaptures(board, color).filter(
    (m) => m.from[0] === fromR && m.from[1] === fromC
  );
  if (captures.length > 0) return captures;
  return getSimpleMoves(board, color).filter(
    (m) => m.from[0] === fromR && m.from[1] === fromC
  );
}

export function applyMove(board: Board, move: Move): Board {
  const next = board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
  const [fromR, fromC] = move.from;
  const piece = next[fromR][fromC];
  if (!piece) return next;
  next[fromR][fromC] = null;
  for (let i = 1; i < move.path.length; i++) {
    const [pr, pc] = move.path[i - 1];
    const [r, c] = move.path[i];
    const midR = (pr + r) >> 1;
    const midC = (pc + c) >> 1;
    next[midR][midC] = null;
  }
  const [lastR, lastC] = move.path[move.path.length - 1];
  const crown =
    piece.king ||
    (piece.color === 'black' && lastR === 0) ||
    (piece.color === 'white' && lastR === SIZE - 1);
  next[lastR][lastC] = { color: piece.color, king: crown };
  return next;
}

export function countPieces(board: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      if (cell?.color === 'black') black++;
      else if (cell?.color === 'white') white++;
    }
  }
  return { black, white };
}

export function getWinner(board: Board, currentTurn: PieceColor): PieceColor | 'draw' | null {
  const moves = getLegalMoves(board, currentTurn);
  if (moves.length > 0) return null;
  const { black, white } = countPieces(board);
  if (black === 0) return 'white';
  if (white === 0) return 'black';
  return currentTurn === 'black' ? 'white' : 'black';
}

export function isDarkSquare(r: number, c: number): boolean {
  return isDark(r, c);
}

/** Bot: forced captures with longest chain; otherwise minimax for quiet moves. */
export function pickBotMove(
  board: Board,
  color: PieceColor,
  continuationFrom: [number, number] | null,
): Move | null {
  const moves = continuationFrom
    ? getLegalMovesFrom(board, color, continuationFrom[0], continuationFrom[1])
    : getLegalMoves(board, color);
  if (moves.length === 0) return null;

  const captures = moves.filter((m) => m.path.length > 2);
  if (captures.length > 0) {
    return captures.reduce((best, move) => {
      if (move.path.length !== best.path.length) {
        return move.path.length > best.path.length ? move : best;
      }
      const moveKing = promotesKing(board, move, color);
      const bestKing = promotesKing(board, best, color);
      if (moveKing !== bestKing) return moveKing ? move : best;
      return move;
    });
  }

  const DEPTH = 3;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyMove(board, move);
    const score = -minimaxCheckers(next, DEPTH - 1, -Infinity, Infinity, color, opponent(color));
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function promotesKing(board: Board, move: Move, color: PieceColor): boolean {
  const [lastR] = move.path[move.path.length - 1];
  const piece = board[move.from[0]][move.from[1]];
  if (!piece || piece.king) return false;
  return (color === 'black' && lastR === 0) || (color === 'white' && lastR === SIZE - 1);
}

function evaluateCheckers(board: Board, color: PieceColor): number {
  const opp = opponent(color);
  const counts = countPieces(board);
  const mine = color === 'black' ? counts.black : counts.white;
  const theirs = color === 'black' ? counts.white : counts.black;
  let score = (mine - theirs) * 120;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const sign = piece.color === color ? 1 : -1;
      score += piece.king ? 35 * sign : 12 * sign;
      if (!piece.king) {
        if (piece.color === 'black' && r === SIZE - 1) score += 6 * sign;
        if (piece.color === 'white' && r === 0) score += 6 * sign;
      }
    }
  }

  score += (getLegalMoves(board, color).length - getLegalMoves(board, opp).length) * 4;
  return score;
}

function minimaxCheckers(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  player: PieceColor,
  turn: PieceColor,
): number {
  const winner = getWinner(board, turn);
  if (winner === player) return 8_000 + depth;
  if (winner === opponent(player)) return -8_000 - depth;
  if (depth === 0) return evaluateCheckers(board, player);

  const moves = getLegalMoves(board, turn);
  if (moves.length === 0) {
    return turn === player ? -8_000 : 8_000;
  }

  let value = -Infinity;
  for (const move of moves) {
    const next = applyMove(board, move);
    const score = -minimaxCheckers(next, depth - 1, -beta, -alpha, player, opponent(turn));
    value = Math.max(value, score);
    alpha = Math.max(alpha, value);
    if (alpha >= beta) break;
  }
  return value;
}
