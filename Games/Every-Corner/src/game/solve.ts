import { cellCount } from './grid';
import type { CellId, Size } from './types';

export interface SolveInput {
  size: Size;
  neighbours: CellId[][];
  checkpoints: Record<CellId, number>;
  checkpointCount: number;
  /** Stop once this many solutions are found. 2 is enough to test uniqueness. */
  limit?: number;
  /** Turn off pruning. Only the parity self-check should ever do this. */
  prune?: boolean;
  /** Abort after this many nodes; the result is then not exhaustive. */
  nodeLimit?: number;
}

export interface SolveResult {
  solutions: CellId[][];
  /** False when the node budget ran out, which makes `solutions` inconclusive. */
  exhausted: boolean;
  nodes: number;
}

function startCell(checkpoints: Record<CellId, number>): CellId {
  for (const [cell, number] of Object.entries(checkpoints)) {
    if (number === 1) return Number(cell);
  }
  return -1;
}

function endCell(checkpoints: Record<CellId, number>, count: number): CellId {
  for (const [cell, number] of Object.entries(checkpoints)) {
    if (number === count) return Number(cell);
  }
  return -1;
}

/**
 * Depth-first search over paths, with three prunes that each correspond to
 * something a player can see on the board:
 *
 *  - connectivity: the unvisited cells must all still be reachable, or some
 *    corner has been sealed off;
 *  - forced endpoints: an unvisited cell with only one way in is a cul-de-sac,
 *    and the path has exactly one place to finish;
 *  - checkpoint reachability: the next number must still be inside the region
 *    the path can actually get to.
 *
 * Without them an 8x8 is not searchable; with them the same board resolves in
 * milliseconds.
 */
export function solve(input: SolveInput): SolveResult {
  const total = cellCount(input.size);
  const limit = input.limit ?? 2;
  const prune = input.prune ?? true;
  const nodeLimit = input.nodeLimit ?? 4_000_000;

  const start = startCell(input.checkpoints);
  const finish = endCell(input.checkpoints, input.checkpointCount);
  const solutions: CellId[][] = [];
  if (start < 0 || finish < 0) return { solutions, exhausted: true, nodes: 0 };

  const visited = new Array<boolean>(total).fill(false);
  const path: CellId[] = [];
  const stack: CellId[] = new Array(total);
  let nodes = 0;
  let exhausted = true;

  /** Every unvisited cell must still be reachable from `current`. */
  const reachableCoversRest = (current: CellId, remaining: number): boolean => {
    let head = 0;
    let size = 0;
    const seen = new Set<CellId>();
    stack[size++] = current;
    seen.add(current);
    let found = 0;
    while (head < size) {
      const cell = stack[head++];
      for (const next of input.neighbours[cell]) {
        if (visited[next] || seen.has(next)) continue;
        seen.add(next);
        found += 1;
        stack[size++] = next;
      }
    }
    return found === remaining;
  };

  /**
   * A cell with a single available neighbour can only be an endpoint. There is
   * exactly one endpoint left — the final checkpoint — so more than one such
   * cell, or one that is not the finish, is already a dead board.
   */
  const endpointsAreLegal = (current: CellId): boolean => {
    let forced = 0;
    for (let cell = 0; cell < total; cell++) {
      if (visited[cell]) continue;
      let degree = 0;
      for (const next of input.neighbours[cell]) {
        if (!visited[next] || next === current) degree += 1;
      }
      if (degree === 0) return false;
      if (degree === 1) {
        if (cell !== finish) return false;
        forced += 1;
        if (forced > 1) return false;
      }
    }
    return true;
  };

  const step = (current: CellId, expected: number): void => {
    if (solutions.length >= limit || !exhausted) return;
    nodes += 1;
    if (nodes > nodeLimit) {
      exhausted = false;
      return;
    }

    if (path.length === total) {
      // Every cell used, every number taken in order, finishing on the last one.
      if (expected > input.checkpointCount && current === finish) {
        solutions.push([...path]);
      }
      return;
    }

    if (prune) {
      const remaining = total - path.length;
      if (!reachableCoversRest(current, remaining)) return;
      if (!endpointsAreLegal(current)) return;
      const nextCheckpointCell = expected <= input.checkpointCount
        ? endCell(input.checkpoints, expected)
        : -1;
      if (nextCheckpointCell >= 0 && visited[nextCheckpointCell]) return;
    }

    for (const next of input.neighbours[current]) {
      if (visited[next]) continue;
      const number = input.checkpoints[next];
      if (number !== undefined && number !== expected) continue;
      // Reaching the final number early would strand the remaining cells.
      if (next === finish && path.length + 1 !== total) continue;

      visited[next] = true;
      path.push(next);
      step(next, number !== undefined ? expected + 1 : expected);
      path.pop();
      visited[next] = false;

      if (solutions.length >= limit || !exhausted) return;
    }
  };

  visited[start] = true;
  path.push(start);
  step(start, 2);

  return { solutions, exhausted, nodes };
}

/** Index of the first cell at which two solutions disagree. */
export function divergenceIndex(a: CellId[], b: CellId[]): number {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i++) {
    if (a[i] !== b[i]) return i;
  }
  return shared;
}
