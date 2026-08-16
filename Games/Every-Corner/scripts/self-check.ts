import * as assert from 'node:assert/strict';
import { DIFFICULTIES, DIFFICULTY_ORDER, generate } from '../src/game/generate.js';
import { buildNeighbours, cellCount, isHamiltonianPath, snakePath, wallKey } from '../src/game/grid.js';
import { randomHamiltonianPath } from '../src/game/hamiltonian.js';
import { solve } from '../src/game/solve.js';
import { analyse, computeHint } from '../src/game/hint.js';
import { computeStreak, dateKey } from '../src/game/daily.js';
import { createRng, streamRng } from '../src/game/rng.js';
import type { CellId, DifficultyId, Puzzle, Size } from '../src/game/types.js';

function neighboursOf(puzzle: Puzzle): CellId[][] {
  return buildNeighbours(puzzle.size, puzzle.walls);
}

/** Backbite must never break the "covers every cell exactly once" invariant. */
function expectBackbitePreservesInvariant(): void {
  const sizes: Size[] = [
    { rows: 4, cols: 4 },
    { rows: 5, cols: 6 },
    { rows: 8, cols: 8 },
  ];
  for (const size of sizes) {
    const neighbours = buildNeighbours(size, []);
    assert.ok(
      isHamiltonianPath(size, neighbours, snakePath(size)),
      'the boustrophedon starting path is not Hamiltonian',
    );
    for (let trial = 0; trial < 12; trial++) {
      const r = createRng(1000 + trial);
      const path = randomHamiltonianPath(size, neighbours, r);
      assert.ok(
        isHamiltonianPath(size, neighbours, path),
        `backbite produced an invalid path on ${size.rows}x${size.cols}`,
      );
    }
  }
}

/** Backbite has to actually mix, or every puzzle would be the same snake. */
function expectBackbiteMixes(): void {
  const size: Size = { rows: 6, cols: 6 };
  const neighbours = buildNeighbours(size, []);
  const snake = snakePath(size).join(',');
  const seen = new Set<string>();
  for (let trial = 0; trial < 20; trial++) {
    seen.add(randomHamiltonianPath(size, neighbours, createRng(trial + 1)).join(','));
  }
  assert.ok(seen.size >= 18, `only ${seen.size} distinct paths from 20 seeds`);
  assert.ok(!seen.has(snake) || seen.size > 1, 'backbite never left the starting snake');
}

/** Every generated puzzle must be solvable, and solvable exactly one way. */
function expectPuzzlesAreUniquelySolvable(): void {
  for (const difficulty of DIFFICULTY_ORDER) {
    for (let i = 0; i < 4; i++) {
      const puzzle = generate({ seedCode: `uniq-${i}`, difficulty });
      const neighbours = neighboursOf(puzzle);

      assert.ok(
        isHamiltonianPath(puzzle.size, neighbours, puzzle.solution),
        `${difficulty}#${i}: stored answer is not a valid path`,
      );

      const result = solve({
        size: puzzle.size,
        neighbours,
        checkpoints: puzzle.checkpoints,
        checkpointCount: puzzle.checkpointCount,
        limit: 3,
      });
      assert.ok(result.exhausted, `${difficulty}#${i}: search ran out of budget`);
      assert.equal(result.solutions.length, 1, `${difficulty}#${i}: not a unique solution`);
      assert.deepEqual(
        result.solutions[0],
        puzzle.solution,
        `${difficulty}#${i}: solver disagrees with the generator`,
      );
    }
  }
}

/** Checkpoints must read 1..N in order along the answer, and 1/N must be the ends. */
function expectCheckpointsAreOrdered(): void {
  for (const difficulty of DIFFICULTY_ORDER) {
    const puzzle = generate({ seedCode: `order-${difficulty}`, difficulty });
    const seen: number[] = [];
    puzzle.solution.forEach((cell) => {
      const number = puzzle.checkpoints[cell];
      if (number !== undefined) seen.push(number);
    });
    assert.deepEqual(
      seen,
      Array.from({ length: puzzle.checkpointCount }, (_, i) => i + 1),
      `${difficulty}: checkpoints are not ascending along the answer`,
    );
    assert.equal(puzzle.checkpoints[puzzle.solution[0]], 1, 'the path must start on 1');
    assert.equal(
      puzzle.checkpoints[puzzle.solution[puzzle.solution.length - 1]],
      puzzle.checkpointCount,
      'the path must finish on the last number',
    );
  }
}

/** A wall across the answer would make the puzzle unsolvable. */
function expectWallsNeverBlockTheAnswer(): void {
  for (const difficulty of DIFFICULTY_ORDER) {
    for (let i = 0; i < 3; i++) {
      const puzzle = generate({ seedCode: `wall-${i}`, difficulty });
      const walls = new Set(puzzle.walls);
      for (let step = 1; step < puzzle.solution.length; step++) {
        const key = wallKey(puzzle.solution[step - 1], puzzle.solution[step]);
        assert.ok(!walls.has(key), `${difficulty}#${i}: a wall sits on the answer at step ${step}`);
      }
      assert.equal(new Set(puzzle.walls).size, puzzle.walls.length, 'duplicate wall');
    }
  }
}

/**
 * The one that matters most. A bad prune silently discards valid solutions
 * while the board still looks perfectly normal, so the pruned solver is
 * checked against a brute-force search that trusts nothing.
 */
function expectPrunedSolverMatchesBruteForce(): void {
  const sizes: Size[] = [
    { rows: 3, cols: 4 },
    { rows: 4, cols: 4 },
    { rows: 4, cols: 5 },
  ];

  let compared = 0;
  for (const size of sizes) {
    for (let trial = 0; trial < 8; trial++) {
      const r = streamRng(7, `parity:${size.rows}x${size.cols}:${trial}`);
      const open = buildNeighbours(size, []);
      const path = randomHamiltonianPath(size, open, r);

      // Deliberately under-constrained: only the two ends are pinned, so these
      // boards have many solutions and exercise the prunes hard.
      const checkpoints: Record<CellId, number> = {
        [path[0]]: 1,
        [path[path.length - 1]]: 2,
      };

      const common = { size, neighbours: open, checkpoints, checkpointCount: 2, limit: 500 };
      const pruned = solve({ ...common, prune: true });
      const brute = solve({ ...common, prune: false });

      assert.ok(pruned.exhausted && brute.exhausted, 'parity run exceeded its budget');
      assert.equal(
        pruned.solutions.length,
        brute.solutions.length,
        `${size.rows}x${size.cols}#${trial}: pruned found ${pruned.solutions.length}, brute force ${brute.solutions.length}`,
      );
      const key = (s: CellId[][]) => s.map((p) => p.join(',')).sort().join('|');
      assert.equal(key(pruned.solutions), key(brute.solutions), 'the two solvers found different paths');
      assert.ok(pruned.nodes <= brute.nodes, 'pruning should not visit more nodes');
      compared += 1;
    }
  }
  assert.ok(compared >= 20, 'not enough parity comparisons ran');
}

/** Solutions must always cover the board exactly once. */
function expectSolutionsCoverEveryCell(): void {
  for (const difficulty of DIFFICULTY_ORDER) {
    const puzzle = generate({ seedCode: `cover-${difficulty}`, difficulty });
    const total = cellCount(puzzle.size);
    assert.equal(puzzle.solution.length, total, `${difficulty}: answer does not fill the board`);
    assert.equal(new Set(puzzle.solution).size, total, `${difficulty}: answer repeats a cell`);
  }
}

/** Same seed, same board — including walls, numbers and the answer. */
function expectDeterministicGeneration(): void {
  for (const difficulty of DIFFICULTY_ORDER) {
    const a = generate({ seedCode: 'det-1234', difficulty });
    const b = generate({ seedCode: 'det-1234', difficulty });
    assert.deepEqual(a, b, `${difficulty}: same seed produced a different puzzle`);
  }
  const x = generate({ seedCode: 'det-1234', difficulty: 'normal' });
  const y = generate({ seedCode: 'det-9999', difficulty: 'normal' });
  assert.notDeepEqual(x.checkpoints, y.checkpoints, 'two seeds produced identical puzzles');
}

/** Harder settings really do use bigger boards. */
function expectDifficultyLadder(): void {
  let previous = 0;
  for (const difficulty of DIFFICULTY_ORDER) {
    const info = DIFFICULTIES[difficulty as DifficultyId];
    const cells = info.size.rows * info.size.cols;
    assert.ok(cells >= previous, `${difficulty} is not at least as big as the tier below`);
    previous = cells;
    const puzzle = generate({ seedCode: `ladder-${difficulty}`, difficulty });
    assert.ok(puzzle.checkpointCount >= 2, 'a puzzle needs at least a start and a finish');
    assert.ok(
      puzzle.checkpointCount <= cells,
      'more checkpoints than cells',
    );
  }
}

/** Hints must describe the player's actual mistake. */
function expectHintsTrackTheMistake(): void {
  const puzzle = generate({ seedCode: 'hint-1', difficulty: 'easy' });
  const correct = puzzle.solution.slice(0, 4);

  const onTrack = analyse(puzzle, correct);
  assert.equal(onTrack.correctLength, 4);
  assert.equal(onTrack.firstWrongStep, null, 'a correct prefix must not report a mistake');

  // Divert onto some cell the answer does not use at this point.
  const wrongCell = puzzle.solution[puzzle.solution.length - 2];
  const strayed = [...correct, wrongCell];
  const off = analyse(puzzle, strayed);
  assert.equal(off.correctLength, 4);
  assert.equal(off.firstWrongStep, 5, 'the mistake should be reported at the step it happened');

  const rewind = computeHint(puzzle, strayed, 'rewind');
  assert.equal(rewind.keepLength, 4, 'rewind must keep exactly the correct prefix');

  const reveal = computeHint(puzzle, strayed, 'reveal');
  assert.equal(reveal.nextCell, puzzle.solution[4], 'reveal must name the next correct cell');

  const locate = computeHint(puzzle, strayed, 'locate');
  assert.equal(locate.keepLength, strayed.length, 'locate must not erase anything');
}

/** Streaks survive to the end of the day, and break when a day is missed. */
function expectStreakCounting(): void {
  const days = (list: string[]) => list.map((date) => ({ date, elapsedMs: 1000, hintsUsed: 0 }));
  assert.equal(computeStreak(days(['2026-08-16', '2026-08-15', '2026-08-14']), '2026-08-16'), 3);
  // Not played yet today, but yesterday counts — the streak is still alive.
  assert.equal(computeStreak(days(['2026-08-15', '2026-08-14']), '2026-08-16'), 2);
  assert.equal(computeStreak(days(['2026-08-14', '2026-08-13']), '2026-08-16'), 0, 'a missed day breaks it');
  assert.equal(computeStreak([], '2026-08-16'), 0);
  assert.equal(computeStreak(days(['2026-03-01', '2026-02-28']), '2026-03-01'), 2, 'month boundary');
  assert.match(dateKey(new Date('2026-08-16T10:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
}

const checks: [string, () => void][] = [
  ['backbite preserves the invariant', expectBackbitePreservesInvariant],
  ['backbite actually mixes', expectBackbiteMixes],
  ['puzzles are uniquely solvable', expectPuzzlesAreUniquelySolvable],
  ['checkpoints are ordered along the answer', expectCheckpointsAreOrdered],
  ['walls never block the answer', expectWallsNeverBlockTheAnswer],
  ['pruned solver matches brute force', expectPrunedSolverMatchesBruteForce],
  ['solutions cover every cell', expectSolutionsCoverEveryCell],
  ['generation is deterministic', expectDeterministicGeneration],
  ['difficulty ladder', expectDifficultyLadder],
  ['hints track the mistake', expectHintsTrackTheMistake],
  ['streak counting', expectStreakCounting],
];

let failed = 0;
for (const [name, check] of checks) {
  try {
    check();
    console.log(`ok  - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL - ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll self-checks passed.');
