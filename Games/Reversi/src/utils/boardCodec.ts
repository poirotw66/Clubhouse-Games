import type { Board, Cell, Piece } from './reversiLogic';
import { SIZE } from './reversiLogic';

/** Encode board as 64 chars: `.` empty, `B` black, `W` white. */
export function encodeBoard(board: Board): string {
  let out = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      out += cell === 'black' ? 'B' : cell === 'white' ? 'W' : '.';
    }
  }
  return out;
}

/** Decode a 64-char board string. */
export function decodeBoard(encoded: string): Board {
  if (encoded.length !== 64) {
    throw new Error(`Board codec expects 64 chars, got ${encoded.length}`);
  }
  const board: Board = Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null));
  for (let i = 0; i < 64; i++) {
    const ch = encoded[i];
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    if (ch === 'B') board[r][c] = 'black';
    else if (ch === 'W') board[r][c] = 'white';
    else if (ch === '.') board[r][c] = null;
    else throw new Error(`Invalid board char '${ch}' at ${i}`);
  }
  return board;
}

/** Build from 8 row strings of length 8. */
export function boardFromRows(rows: string[]): Board {
  if (rows.length !== 8 || rows.some((row) => row.length !== 8)) {
    throw new Error('Expected 8×8 row strings');
  }
  return decodeBoard(rows.join(''));
}

export function pieceFromCode(ch: 'B' | 'W'): Piece {
  return ch === 'B' ? 'black' : 'white';
}

/** Algebraic square: column a–h, row 1–8 from the top of the board (row 0 → 1). */
export function moveToAlgebraic([r, c]: [number, number]): string {
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
    throw new Error(`Out-of-range move ${r},${c}`);
  }
  return `${'abcdefgh'[c]}${r + 1}`;
}

export function algebraicToMove(sq: string): [number, number] {
  if (!/^[a-h][1-8]$/.test(sq)) {
    throw new Error(`Invalid algebraic square '${sq}'`);
  }
  const c = sq.charCodeAt(0) - 'a'.charCodeAt(0);
  const r = Number(sq[1]) - 1;
  return [r, c];
}
