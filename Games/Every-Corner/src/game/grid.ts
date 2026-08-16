import type { CellId, Size, WallKey } from './types';

export function cellId(size: Size, row: number, col: number): CellId {
  return row * size.cols + col;
}

export function rowOf(size: Size, cell: CellId): number {
  return Math.floor(cell / size.cols);
}

export function colOf(size: Size, cell: CellId): number {
  return cell % size.cols;
}

export function cellCount(size: Size): number {
  return size.rows * size.cols;
}

/** Walls are undirected, so the key is the sorted pair. */
export function wallKey(a: CellId, b: CellId): WallKey {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function areAdjacent(size: Size, a: CellId, b: CellId): boolean {
  const dr = Math.abs(rowOf(size, a) - rowOf(size, b));
  const dc = Math.abs(colOf(size, a) - colOf(size, b));
  return dr + dc === 1;
}

/**
 * Precomputed adjacency, with walls already removed. Every hot loop in the
 * generator and solver walks this, so it is built once per puzzle rather than
 * recomputed from coordinates each time.
 */
export function buildNeighbours(size: Size, walls: Iterable<WallKey>): CellId[][] {
  const blocked = new Set(walls);
  const total = cellCount(size);
  const out: CellId[][] = [];

  for (let cell = 0; cell < total; cell++) {
    const row = rowOf(size, cell);
    const col = colOf(size, cell);
    const list: CellId[] = [];
    if (row > 0) list.push(cell - size.cols);
    if (row < size.rows - 1) list.push(cell + size.cols);
    if (col > 0) list.push(cell - 1);
    if (col < size.cols - 1) list.push(cell + 1);
    out.push(list.filter((other) => !blocked.has(wallKey(cell, other))));
  }
  return out;
}

/** Row-major boustrophedon: right along one row, left along the next. */
export function snakePath(size: Size): CellId[] {
  const path: CellId[] = [];
  for (let row = 0; row < size.rows; row++) {
    for (let i = 0; i < size.cols; i++) {
      const col = row % 2 === 0 ? i : size.cols - 1 - i;
      path.push(cellId(size, row, col));
    }
  }
  return path;
}

/**
 * True when the sequence is a Hamiltonian path: every cell exactly once, and
 * every consecutive pair genuinely adjacent and not separated by a wall.
 * This is the invariant the whole generator rests on.
 */
export function isHamiltonianPath(
  size: Size,
  neighbours: CellId[][],
  path: CellId[],
): boolean {
  const total = cellCount(size);
  if (path.length !== total) return false;
  const seen = new Set(path);
  if (seen.size !== total) return false;
  for (let i = 1; i < path.length; i++) {
    if (!neighbours[path[i - 1]].includes(path[i])) return false;
  }
  return true;
}
