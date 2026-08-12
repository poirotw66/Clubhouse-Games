/** Classic 15-puzzle: tiles 1–15 plus null empty. */

export const SIZE = 4;
export type Board = (number | null)[];

export function solvedBoard(): Board {
  const b: Board = [];
  for (let i = 1; i <= SIZE * SIZE - 1; i++) b.push(i);
  b.push(null);
  return b;
}

export function emptyIndex(board: Board): number {
  return board.indexOf(null);
}

export function isSolved(board: Board): boolean {
  for (let i = 0; i < SIZE * SIZE - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[SIZE * SIZE - 1] === null;
}

/** Inversion parity (ignoring empty); solvable iff even on even-width boards with empty on even row-from-bottom… use standard rule. */
export function isSolvable(board: Board): boolean {
  const flat = board.filter((v): v is number => v !== null);
  let inversions = 0;
  for (let i = 0; i < flat.length; i++) {
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[i] > flat[j]) inversions++;
    }
  }
  const emptyRow = Math.floor(emptyIndex(board) / SIZE);
  // For even-width: solvable when (inversions + emptyRowFromBottom) is odd.
  const emptyRowFromBottom = SIZE - emptyRow;
  return (inversions + emptyRowFromBottom) % 2 === 1;
}

export function neighborsOfEmpty(board: Board): number[] {
  const e = emptyIndex(board);
  const r = Math.floor(e / SIZE);
  const c = e % SIZE;
  const out: number[] = [];
  if (r > 0) out.push(e - SIZE);
  if (r < SIZE - 1) out.push(e + SIZE);
  if (c > 0) out.push(e - 1);
  if (c < SIZE - 1) out.push(e + 1);
  return out;
}

export function slide(board: Board, tileIndex: number): Board | null {
  if (!neighborsOfEmpty(board).includes(tileIndex)) return null;
  const next = board.slice();
  const e = emptyIndex(next);
  next[e] = next[tileIndex];
  next[tileIndex] = null;
  return next;
}

/** Fisher–Yates shuffle until solvable and not already solved. */
export function shuffledBoard(rand: () => number = Math.random): Board {
  for (let attempt = 0; attempt < 200; attempt++) {
    const b = solvedBoard();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = b[i];
      b[i] = b[j];
      b[j] = tmp;
    }
    if (isSolvable(b) && !isSolved(b)) return b;
  }
  // Fallback: one legal slide from solved.
  const b = solvedBoard();
  return slide(b, SIZE * SIZE - 2)!;
}
