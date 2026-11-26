import { cellCount, colOf, isHamiltonianPath, rowOf, snakePath } from './grid';
import type { CellId, Size, WaypointKind } from './types';

/**
 * Backbite: the move that makes random Hamiltonian paths cheap.
 *
 * Take the tail of the path and a random neighbour `v` of it. If `v` is not
 * already the tail's predecessor, reverse everything after `v`. The old tail
 * becomes `v`'s successor — a legal step, because they are neighbours — and
 * the cell that used to follow `v` becomes the new tail.
 *
 * The point is that the move cannot fail and cannot break the invariant: the
 * result still covers every playable cell exactly once. Randomised backtracking,
 * the obvious alternative, stalls constantly on an 8x8 and needs restart logic.
 */
function backbiteTail(path: CellId[], neighbours: CellId[][], r: () => number): void {
  const tail = path[path.length - 1];
  const options = neighbours[tail];
  if (options.length === 0) return;

  const v = options[Math.floor(r() * options.length)];
  if (v === path[path.length - 2]) return;

  const index = path.indexOf(v);
  if (index < 0 || index >= path.length - 1) return;

  // Reverse the tail segment in place: path[index+1 .. end].
  let lo = index + 1;
  let hi = path.length - 1;
  while (lo < hi) {
    const tmp = path[lo];
    path[lo] = path[hi];
    path[hi] = tmp;
    lo += 1;
    hi -= 1;
  }
}

/**
 * A random Hamiltonian path over the whole grid, produced by mixing a
 * boustrophedon start with many backbite moves. Half the moves work from the
 * other end, which is done by reversing the array — the two ends are otherwise
 * symmetric and this keeps one implementation instead of two.
 */
export function randomHamiltonianPath(
  size: Size,
  neighbours: CellId[][],
  r: () => number,
  iterations?: number,
): CellId[] {
  const path = snakePath(size);
  const steps = iterations ?? path.length * 60;
  for (let i = 0; i < steps; i++) {
    if (r() < 0.5) path.reverse();
    backbiteTail(path, neighbours, r);
  }
  return path;
}

/**
 * Warnsdorff-style depth-first search for any Hamiltonian path on a (possibly
 * holed) board. Used only to seed backbite when the snake start is unavailable
 * because cells have been removed.
 */
function findAnyHamiltonian(
  neighbours: CellId[][],
  playable: CellId[],
  r: () => number,
  nodeBudget = 250_000,
): CellId[] | null {
  const n = playable.length;
  if (n === 0) return null;
  const playableSet = new Set(playable);
  const visited = new Set<CellId>();
  const path: CellId[] = [];
  let nodes = 0;

  const degree = (cell: CellId): number => {
    let count = 0;
    for (const next of neighbours[cell]) {
      if (playableSet.has(next) && !visited.has(next)) count += 1;
    }
    return count;
  };

  const dfs = (cell: CellId): boolean => {
    nodes += 1;
    if (nodes > nodeBudget) return false;
    visited.add(cell);
    path.push(cell);
    if (path.length === n) return true;

    const nexts = neighbours[cell]
      .filter((next) => playableSet.has(next) && !visited.has(next))
      .sort((a, b) => {
        const da = degree(a) - degree(b);
        return da !== 0 ? da : r() - 0.5;
      });

    for (const next of nexts) {
      if (dfs(next)) return true;
      if (nodes > nodeBudget) return false;
    }
    visited.delete(cell);
    path.pop();
    return false;
  };

  const starts = [...playable].sort((a, b) => degree(a) - degree(b) || r() - 0.5);
  for (const start of starts.slice(0, Math.min(12, starts.length))) {
    visited.clear();
    path.length = 0;
    nodes = 0;
    if (dfs(start)) return [...path];
  }
  return null;
}

/**
 * Hamiltonian path over the playable cells of a board that may contain holes.
 * Finds any covering path, then mixes it with backbite so the weekly boards
 * are not all the same corridor shape.
 */
export function randomHamiltonianPathWithHoles(
  size: Size,
  neighbours: CellId[][],
  holes: Iterable<CellId>,
  r: () => number,
  iterations?: number,
): CellId[] | null {
  const holeSet = new Set(holes);
  const playable: CellId[] = [];
  for (let cell = 0; cell < cellCount(size); cell++) {
    if (!holeSet.has(cell)) playable.push(cell);
  }

  const seed = findAnyHamiltonian(neighbours, playable, r);
  if (!seed) return null;

  const path = [...seed];
  const steps = iterations ?? path.length * 60;
  for (let i = 0; i < steps; i++) {
    if (r() < 0.5) path.reverse();
    backbiteTail(path, neighbours, r);
  }

  if (!isHamiltonianPath(size, neighbours, path, holeSet)) return null;
  return path;
}

/**
 * Determine whether a path moves straight or turns at an interior cell `curr`.
 */
export function motionAtCell(
  size: Size,
  prev: CellId,
  curr: CellId,
  next: CellId,
): WaypointKind {
  const dr1 = rowOf(size, curr) - rowOf(size, prev);
  const dc1 = colOf(size, curr) - colOf(size, prev);
  const dr2 = rowOf(size, next) - rowOf(size, curr);
  const dc2 = colOf(size, next) - colOf(size, curr);
  return dr1 === dr2 && dc1 === dc2 ? 'straight' : 'turn';
}

/**
 * Validate that a path respects all waypoint turn/straight constraints.
 */
export function validateWaypoints(
  size: Size,
  path: CellId[],
  waypoints: Record<CellId, WaypointKind>,
): boolean {
  if (path.length < 3) return true;
  for (let i = 1; i < path.length - 1; i++) {
    const cell = path[i];
    const required = waypoints[cell];
    if (required !== undefined) {
      const motion = motionAtCell(size, path[i - 1], cell, path[i + 1]);
      if (motion !== required) return false;
    }
  }
  return true;
}

export { isHamiltonianPath };
