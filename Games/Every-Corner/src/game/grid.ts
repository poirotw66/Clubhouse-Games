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

/**
 * Where the line should go when the pointer lands somewhere that is not next to
 * the end of it.
 *
 * This is the interaction's load-bearing rule, so it lives here rather than in
 * the component: a pointermove arrives roughly every 16ms, and a finger
 * crossing a 6x6 board in half a second covers about two cells between events.
 * Treating a non-adjacent cell as an invalid move — which is what the board did
 * — means most of a real drag is discarded. Measured against a puzzle's own
 * verified solution, tracing it with one sample per cell drew 36 of 36 cells
 * while tracing the *same shape* two cells per sample drew 1. Not "harder to
 * draw": the board did not respond at all unless you crawled.
 *
 * Returns the cells to append (excluding the current end, including `target`),
 * or an empty array when the gesture should be ignored. It is ignored in two
 * cases, both deliberate:
 *
 *  - the target is further than `maxSteps` away, so a flick across the board
 *    cannot conjure a corridor the player never drew;
 *  - more than one shortest route reaches it, which is what a cut corner looks
 *    like. Guessing which side the finger went round is worse than leaving the
 *    cell for the player to fill in.
 */
export function routeTo(
  size: Size,
  neighbours: CellId[][],
  path: CellId[],
  target: CellId,
  maxSteps = 4,
): CellId[] {
  if (path.length === 0) return [];
  const last = path[path.length - 1];
  if (target === last || path.includes(target)) return [];

  const used = new Set(path);
  const prev = new Map<CellId, CellId>();
  const seen = new Set<CellId>([last]);
  let frontier: CellId[] = [last];

  for (let depth = 0; depth < maxSteps && frontier.length > 0; depth++) {
    // Everything reaching `target` at this depth is an equally short route. One
    // means the gesture is unambiguous; two is what a cut corner looks like,
    // and guessing which side the finger went round is worse than leaving the
    // cell for the player.
    const arrivals = frontier.filter((from) => neighbours[from].includes(target));
    if (arrivals.length > 0) {
      if (arrivals.length !== 1) return [];
      prev.set(target, arrivals[0]);
      const route: CellId[] = [];
      for (let at: CellId | undefined = target; at !== undefined && at !== last; at = prev.get(at)) {
        route.unshift(at);
      }
      // The route has to be as direct as the gesture was. A finger that swept
      // from here to there went in a straight-ish line; if the only way to
      // connect the two is a detour, then something is in the way and the
      // player did not draw round it. Without this a wall in the gap produced a
      // four-cell loop through the row below, which is precisely the corridor
      // nobody drew that this function exists to refuse.
      const span =
        Math.abs(rowOf(size, target) - rowOf(size, last)) +
        Math.abs(colOf(size, target) - colOf(size, last));
      if (route.length !== span) return [];
      return route.length > 0 && route.length <= maxSteps ? route : [];
    }

    const next: CellId[] = [];
    for (const from of frontier) {
      for (const to of neighbours[from]) {
        if (used.has(to) || seen.has(to)) continue;
        seen.add(to);
        prev.set(to, from);
        next.push(to);
      }
    }
    frontier = next;
  }

  return [];
}
