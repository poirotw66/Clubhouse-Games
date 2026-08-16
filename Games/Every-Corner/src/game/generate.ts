import { buildNeighbours, cellCount, wallKey } from './grid';
import { randomHamiltonianPath } from './hamiltonian';
import { streamRng } from './rng';
import { divergenceIndex, solve } from './solve';
import type { CellId, DifficultyId, Puzzle, Size, WallKey } from './types';

export interface DifficultyInfo {
  id: DifficultyId;
  label: string;
  blurb: string;
  size: Size;
  checkpoints: number;
  walls: number;
}

/**
 * Walls are the real difficulty lever, not the checkpoint target.
 *
 * Measured over the generator: a 6x6 with a single wall needs a median of 24
 * checkpoints before the answer becomes unique — 24 numbers on 36 cells is a
 * dot-to-dot, not a puzzle. The same board with twelve walls needs 7. Walls
 * cut the number of rival paths directly, which is what buys the sparse,
 * interesting boards.
 *
 * `checkpoints` here is the *acceptable* count: generation keeps trying boards
 * until one comes in at or under it, and otherwise returns the sparsest board
 * it found.
 */
export const DIFFICULTIES: Record<DifficultyId, DifficultyInfo> = {
  easy: {
    id: 'easy',
    label: '輕鬆',
    blurb: '5×5，檢查點多，適合先摸熟規則。',
    size: { rows: 5, cols: 5 },
    checkpoints: 7,
    walls: 6,
  },
  normal: {
    id: 'normal',
    label: '普通',
    blurb: '6×6，開始要留意有沒有把角落封死。',
    size: { rows: 6, cols: 6 },
    checkpoints: 9,
    walls: 12,
  },
  hard: {
    id: 'hard',
    label: '困難',
    blurb: '7×7，牆變多，中間有大段要自己推。',
    size: { rows: 7, cols: 7 },
    checkpoints: 11,
    walls: 18,
  },
  expert: {
    id: 'expert',
    label: '專家',
    blurb: '8×8，最大的盤面，一步走錯就整盤重來。',
    size: { rows: 8, cols: 8 },
    checkpoints: 14,
    walls: 26,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'normal', 'hard', 'expert'];

function shuffled<T>(items: readonly T[], r: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Walls are only ever placed on edges the answer does not use, so adding them
 * can never destroy the solution the puzzle was built around. Choosing walls
 * first and hoping a Hamiltonian path still exists would mean generation could
 * fail, and on an 8x8 it would fail often.
 */
function pickWalls(size: Size, path: CellId[], count: number, r: () => number): WallKey[] {
  const used = new Set<WallKey>();
  for (let i = 1; i < path.length; i++) used.add(wallKey(path[i - 1], path[i]));

  const candidates: WallKey[] = [];
  for (let cell = 0; cell < cellCount(size); cell++) {
    const col = cell % size.cols;
    const right = cell + 1;
    const down = cell + size.cols;
    if (col < size.cols - 1 && !used.has(wallKey(cell, right))) candidates.push(wallKey(cell, right));
    if (down < cellCount(size) && !used.has(wallKey(cell, down))) candidates.push(wallKey(cell, down));
  }
  return shuffled(candidates, r).slice(0, count);
}

/**
 * Checkpoints go on the answer: 1 at the start, N at the finish, and the rest
 * spread along it with a little jitter so every puzzle does not have the same
 * rhythm. Returned as indices into the answer, because the refinement step
 * needs to insert more of them at specific positions along it.
 */
function checkpointIndices(path: CellId[], count: number, r: () => number): number[] {
  const indices = new Set<number>([0, path.length - 1]);
  const interior = Math.max(0, count - 2);
  for (let i = 1; i <= interior; i++) {
    const ideal = (path.length * i) / (interior + 1);
    const jitter = Math.floor((r() - 0.5) * (path.length / (interior + 2)));
    const index = Math.min(path.length - 2, Math.max(1, Math.round(ideal + jitter)));
    indices.add(index);
  }
  return [...indices].sort((a, b) => a - b);
}

function checkpointsFrom(path: CellId[], indices: number[]): Record<CellId, number> {
  const checkpoints: Record<CellId, number> = {};
  indices.forEach((index, i) => {
    checkpoints[path[index]] = i + 1;
  });
  return checkpoints;
}

function samePath(a: CellId[], b: CellId[]): boolean {
  return a.length === b.length && a.every((cell, i) => cell === b[i]);
}

export interface GenerateOptions {
  seedCode: string;
  difficulty: DifficultyId;
  /** Overrides for tests; production always uses the difficulty table. */
  size?: Size;
  checkpointTarget?: number;
  wallTarget?: number;
}

/**
 * Builds a puzzle backwards: draw the answer, hide the puzzle in it, then keep
 * adding checkpoints until the answer is the *only* answer.
 *
 * When two solutions exist, the extra checkpoint is placed where they first
 * diverge rather than at random, and the whole board is only re-rolled once
 * that has been tried to its limit. Aiming at the ambiguity converges in a
 * couple of iterations; re-rolling blindly does not.
 */
export function generate(options: GenerateOptions): Puzzle {
  const info = DIFFICULTIES[options.difficulty];
  const acceptable = options.checkpointTarget ?? info.checkpoints;

  let best: Puzzle | null = null;
  for (let attempt = 0; attempt < 14; attempt++) {
    const candidate = buildCandidate(options, attempt);
    if (!candidate) continue;
    if (best === null || candidate.checkpointCount < best.checkpointCount) best = candidate;
    // Sparse enough to be worth solving; stop looking.
    if (candidate.checkpointCount <= acceptable) return candidate;
  }

  if (best) return best;
  throw new Error(`could not generate a unique puzzle for ${options.seedCode}`);
}

/**
 * One board: an answer, its walls, and the fewest checkpoints that make the
 * answer unique. Returns null when the board could not be resolved at all.
 */
function buildCandidate(options: GenerateOptions, attempt: number): Puzzle | null {
  const info = DIFFICULTIES[options.difficulty];
  const size = options.size ?? info.size;
  const wallTarget = options.wallTarget ?? info.walls;
  const total = cellCount(size);

  {
    const r = streamRng(0, `${options.seedCode}:${options.difficulty}:${attempt}`);
    const open = buildNeighbours(size, []);
    const path = randomHamiltonianPath(size, open, r);
    const walls = pickWalls(size, path, wallTarget, r);
    const neighbours = buildNeighbours(size, walls);

    const target = Math.min(total, options.checkpointTarget ?? info.checkpoints);
    let indices = checkpointIndices(path, target, r);

    for (let refine = 0; refine < total; refine++) {
      const checkpoints = checkpointsFrom(path, indices);
      const result = solve({
        size,
        neighbours,
        checkpoints,
        checkpointCount: indices.length,
        limit: 2,
      });

      // A budget overrun means uniqueness is unproven, so the board is unusable.
      if (!result.exhausted) break;
      if (result.solutions.length === 0) break;

      if (result.solutions.length === 1) {
        return {
          seedCode: options.seedCode,
          difficulty: options.difficulty,
          size,
          checkpoints,
          checkpointCount: indices.length,
          walls,
          solution: path,
        };
      }

      // Pin the earliest step at which a rival solution leaves the intended
      // answer. The comparison has to be against `path` itself: measuring the
      // gap between two rival solutions gives an index into *their* ordering,
      // which does not address the ambiguity and never converges.
      const other = result.solutions.find((s) => !samePath(s, path)) ?? result.solutions[0];
      const at = divergenceIndex(other, path);

      let insert = Math.min(path.length - 2, Math.max(1, at));
      while (insert < path.length - 1 && indices.includes(insert)) insert += 1;
      if (insert >= path.length - 1) break;

      indices = [...indices, insert].sort((a, b) => a - b);
    }
  }

  return null;
}
