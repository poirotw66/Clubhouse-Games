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

/** Simple bot: prefer capture moves, then longer capture sequences; otherwise pick first legal move. */
export function pickBotMove(
  board: Board,
  color: PieceColor,
  continuationFrom: [number, number] | null
): Move | null {
  const moves = continuationFrom
    ? getLegalMovesFrom(board, color, continuationFrom[0], continuationFrom[1])
    : getLegalMoves(board, color);
  if (moves.length === 0) return null;
  const captures = moves.filter((m) => m.path.length > 2);
  const pool = captures.length > 0 ? captures : moves;
  let best = pool[0];
  for (const m of pool) {
    if (m.path.length > best.path.length) best = m;
  }
  return best;
}
