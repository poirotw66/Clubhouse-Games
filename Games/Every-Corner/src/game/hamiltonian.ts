import { isHamiltonianPath, snakePath } from './grid';
import type { CellId, Size } from './types';

/**
 * Backbite: the move that makes random Hamiltonian paths cheap.
 *
 * Take the tail of the path and a random neighbour `v` of it. If `v` is not
 * already the tail's predecessor, reverse everything after `v`. The old tail
 * becomes `v`'s successor — a legal step, because they are neighbours — and
 * the cell that used to follow `v` becomes the new tail.
 *
 * The point is that the move cannot fail and cannot break the invariant: the
 * result still covers every cell exactly once. Randomised backtracking, the
 * obvious alternative, stalls constantly on an 8x8 and needs restart logic.
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

export { isHamiltonianPath };
