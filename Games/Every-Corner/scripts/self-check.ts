import * as assert from 'node:assert/strict';
import {
  applyClear,
  emptyPlayerStats,
  evaluateAchievements,
  markWeeklyCompletion,
} from '../src/game/achievements.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, generate } from '../src/game/generate.js';
import {
  buildNeighbours,
  cellCount,
  isHamiltonianPath,
  playableCount,
  routeTo,
  snakePath,
  wallKey,
} from '../src/game/grid.js';
import { motionAtCell, randomHamiltonianPath, validateWaypoints } from '../src/game/hamiltonian.js';
import { divergenceIndex, solve } from '../src/game/solve.js';
import { HINT_SEQUENCE, analyse, computeHint } from '../src/game/hint.js';
import {
  DAILY_DIFFICULTY,
  computeStreak,
  dailySeed,
  dateKey,
  summarise,
} from '../src/game/daily.js';
import { createRng, streamRng } from '../src/game/rng.js';
import { loadStats, loadStrictMode, saveStats, saveStrictMode } from '../src/game/storage.js';
import type { CellId, DifficultyId, Puzzle, Size, WaypointKind } from '../src/game/types.js';
import {
  WEEKLY_DAYS,
  isWeeklyComplete,
  todayWeekDayIndex,
  weekKey,
  weeklySeed,
} from '../src/game/weekly.js';
import { analyzeCircuit } from '../src/game/circuit.js';
import {
  CYBER_SCALE,
  isAudioMuted,
  playCircuitExtend,
  playCircuitRetract,
  playFullGridDischarge,
  playOverloadAlarm,
  playSafeRollback,
  resetAudioContextForTesting,
  setAudioMuted,
} from '../src/game/circuitAudio.js';

class MockAudioParam {
  value = 0;
  events: Array<{ type: string; value: number; time: number }> = [];

  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'setValueAtTime', value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'linearRampToValueAtTime', value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'exponentialRampToValueAtTime', value, time });
  }
}

class MockAudioNode {
  destination: unknown = null;
  connect(dest: unknown): unknown {
    this.destination = dest;
    return dest;
  }
}

class MockGainNode extends MockAudioNode {
  gain = new MockAudioParam();
}

class MockOscillatorNode extends MockAudioNode {
  type = 'sine';
  frequency = new MockAudioParam();
  started = false;
  stopped = false;
  startTime = 0;
  stopTime = 0;

  start(time = 0): void {
    this.started = true;
    this.startTime = time;
  }

  stop(time = 0): void {
    this.stopped = true;
    this.stopTime = time;
  }
}

let activeMockContext: MockAudioContext | null = null;

class MockAudioContext {
  currentTime = 0;
  state = 'running';
  destination = new MockAudioNode();
  oscillators: MockOscillatorNode[] = [];
  gains: MockGainNode[] = [];

  constructor() {
    activeMockContext = this;
  }

  createOscillator(): MockOscillatorNode {
    const osc = new MockOscillatorNode();
    this.oscillators.push(osc);
    return osc;
  }

  createGain(): MockGainNode {
    const gain = new MockGainNode();
    this.gains.push(gain);
    return gain;
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
}

/** Minimal localStorage and AudioContext mocks so browser logic runs under Node. */
function installMockEnvironment(): void {
  const map = new Map<string, string>();
  const memory = {
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      map.set(key, String(value));
    },
    removeItem(key: string): void {
      map.delete(key);
    },
    clear(): void {
      map.clear();
    },
  };

  const MockCtor = MockAudioContext as unknown as typeof AudioContext;

  (globalThis as unknown as { localStorage?: typeof memory }).localStorage = memory;
  (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext = MockCtor;
  (globalThis as unknown as {
    window?: { localStorage: typeof memory; AudioContext?: typeof AudioContext };
  }).window = {
    localStorage: memory,
    AudioContext: MockCtor,
  };
}

installMockEnvironment();

function neighboursOf(puzzle: Puzzle): CellId[][] {
  return buildNeighbours(puzzle.size, puzzle.walls, puzzle.blocked);
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
        isHamiltonianPath(puzzle.size, neighbours, puzzle.solution, puzzle.blocked),
        `${difficulty}#${i}: stored answer is not a valid path`,
      );

      const result = solve({
        size: puzzle.size,
        neighbours,
        checkpoints: puzzle.checkpoints,
        checkpointCount: puzzle.checkpointCount,
        blocked: puzzle.blocked,
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

/** Solutions must always cover every playable cell exactly once. */
function expectSolutionsCoverEveryCell(): void {
  for (const difficulty of DIFFICULTY_ORDER) {
    const puzzle = generate({ seedCode: `cover-${difficulty}`, difficulty });
    const total = playableCount(puzzle.size, puzzle.blocked);
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

/** Daily seeds stay on their own namespace — weekly must not collide. */
function expectDailyAlgorithmUnchanged(): void {
  assert.equal(dailySeed('2026-10-20'), 'daily-2026-10-20');
  assert.equal(weeklySeed('2026-10-19', 3), 'weekly-2026-10-19-d3');
  assert.notEqual(dailySeed('2026-10-20'), weeklySeed('2026-10-20', 0));

  // Classic generation for a daily seed must remain deterministic and hole-free.
  const a = generate({ seedCode: dailySeed('2026-10-20'), difficulty: 'normal' });
  const b = generate({ seedCode: dailySeed('2026-10-20'), difficulty: 'normal' });
  assert.deepEqual(a, b);
  assert.equal(a.variant, 'classic');
  assert.equal(a.blocked.length, 0);
}

/** Weekly set is seven escalating days with a stable Monday key. */
function expectWeeklySchedule(): void {
  assert.equal(WEEKLY_DAYS.length, 7);
  assert.ok(WEEKLY_DAYS.some((d) => d.blockedCount > 0), 'week needs a blocked variant day');
  assert.ok(WEEKLY_DAYS.every((d, i) => d.dayIndex === i), 'dayIndex must be 0..6 in order');

  // 2026-10-20 is a Tuesday in UTC+8-aware dateKey land; Monday is 2026-10-19.
  const monday = weekKey(new Date('2026-10-20T04:00:00Z'));
  assert.equal(monday, '2026-10-19');

  const incomplete = { weekKey: monday, days: [{ dayIndex: 0, elapsedMs: 1, hintsUsed: 0 }], completed: false };
  assert.equal(isWeeklyComplete(incomplete), false);
  const complete = {
    weekKey: monday,
    days: WEEKLY_DAYS.map((d) => ({ dayIndex: d.dayIndex, elapsedMs: 1000, hintsUsed: 0 })),
    completed: false,
  };
  assert.equal(isWeeklyComplete(complete), true);

  // Generate every weekly board and demand a unique solution.
  for (const day of WEEKLY_DAYS) {
    const puzzle = generate({
      seedCode: weeklySeed(monday, day.dayIndex),
      difficulty: day.difficulty,
      blockedCount: day.blockedCount,
    });
    assert.equal(puzzle.blocked.length, day.blockedCount, `day ${day.dayIndex} hole count`);
    const neighbours = buildNeighbours(puzzle.size, puzzle.walls, puzzle.blocked);
    assert.ok(
      isHamiltonianPath(puzzle.size, neighbours, puzzle.solution, puzzle.blocked),
      `weekly day ${day.dayIndex}: answer is not Hamiltonian`,
    );
    const result = solve({
      size: puzzle.size,
      neighbours,
      checkpoints: puzzle.checkpoints,
      checkpointCount: puzzle.checkpointCount,
      blocked: puzzle.blocked,
      limit: 2,
    });
    assert.ok(result.exhausted, `weekly day ${day.dayIndex}: search budget`);
    assert.equal(result.solutions.length, 1, `weekly day ${day.dayIndex}: not unique`);
  }
}

/** Blocked-cell variant keeps uniqueness and never asks the path to enter a hole. */
function expectBlockedVariantIsUnique(): void {
  for (let i = 0; i < 4; i++) {
    const puzzle = generate({
      seedCode: `blocked-${i}`,
      difficulty: 'normal',
      blockedCount: 3,
    });
    assert.equal(puzzle.variant, 'blocked');
    assert.equal(puzzle.blocked.length, 3);
    assert.equal(puzzle.solution.length, playableCount(puzzle.size, puzzle.blocked));
    for (const hole of puzzle.blocked) {
      assert.ok(!puzzle.solution.includes(hole), 'solution entered a hole');
      assert.equal(puzzle.checkpoints[hole], undefined, 'checkpoint on a hole');
    }
    const neighbours = buildNeighbours(puzzle.size, puzzle.walls, puzzle.blocked);
    const result = solve({
      size: puzzle.size,
      neighbours,
      checkpoints: puzzle.checkpoints,
      checkpointCount: puzzle.checkpointCount,
      blocked: puzzle.blocked,
      limit: 3,
    });
    assert.ok(result.exhausted);
    assert.equal(result.solutions.length, 1);
    assert.deepEqual(result.solutions[0], puzzle.solution);
  }
}

/** Achievements unlock from stats; corrupt storage is rejected. */
function expectAchievementsAndStatsValidation(): void {
  let stats = emptyPlayerStats();
  assert.deepEqual(evaluateAchievements(stats, 0), []);

  const first = applyClear(
    stats,
    {
      difficulty: 'easy',
      sizeKey: '5x5',
      elapsedMs: 20_000,
      hintsUsed: 0,
      isDaily: false,
      isWeekly: false,
      variant: 'classic',
      gaveUp: false,
    },
    0,
  );
  assert.ok(first.newAchievements.includes('first-clear'));
  assert.ok(first.newAchievements.includes('no-hint-any'));
  assert.ok(first.newAchievements.includes('no-hint-easy'));
  assert.ok(first.newAchievements.includes('speed-5x5'));
  stats = first.stats;

  const streaked = evaluateAchievements(stats, 7);
  assert.ok(streaked.includes('streak-3'));
  assert.ok(streaked.includes('streak-7'));

  const weekly = markWeeklyCompletion(stats, 0);
  assert.ok(weekly.newAchievements.includes('weekly-complete'));

  saveStats(weekly.stats);
  assert.deepEqual(loadStats(), weekly.stats);

  // Corrupt payload must not crash and must not invent progress.
  globalThis.localStorage.setItem('clubhouse:every-corner:stats', '{"totalSolved":"nope","achievements":[1,2]}');
  const recovered = loadStats();
  assert.equal(recovered.totalSolved, 0);
  assert.deepEqual(recovered.achievements, []);
}

/**
 * A drag has to work at the speed people actually drag.
 *
 * The board used to accept only a cell orthogonally adjacent to the end of the
 * line. A pointermove arrives about every 16ms, and a finger crossing a 6x6
 * board in half a second covers roughly two cells between events, so most of a
 * real gesture was silently discarded. Measured in a browser against a puzzle's
 * own verified solution: tracing it with one sample per cell drew all 36 cells
 * and solved, tracing the SAME shape with two cells per sample drew 1. The
 * board did not respond unless you crawled — which is what "unplayable" meant.
 *
 * Nothing headless could see it, because the rule lived in a pointer handler.
 * routeTo() is that rule extracted, so it can be checked here.
 */
function expectDragRoutingFollowsTheFinger(): void {
  const size = { rows: 5, cols: 5 };
  const open = buildNeighbours(size, []);
  const cell = (r: number, c: number): number => r * size.cols + c;

  // Two cells ahead in a straight line: unambiguous, so fill in the gap.
  assert.deepEqual(
    routeTo(size, open, [cell(0, 0)], cell(0, 2)),
    [cell(0, 1), cell(0, 2)],
    'a straight jump of two cells must fill in the cell it swept over',
  );

  // Three ahead, still straight, still one route.
  assert.deepEqual(
    routeTo(size, open, [cell(2, 0)], cell(2, 3)),
    [cell(2, 1), cell(2, 2), cell(2, 3)],
    'a straight jump of three cells must fill in both cells between',
  );

  // Diagonal: two equally short ways round, which is a cut corner. Refusing is
  // the point — guessing which side the finger went is worse than leaving it.
  assert.deepEqual(
    routeTo(size, open, [cell(0, 0)], cell(1, 1)),
    [],
    'a cut corner has two equal routes and must not be guessed at',
  );

  // A wall makes the same corner unambiguous again, so it should route.
  const walled = buildNeighbours(size, [wallKey(cell(0, 0), cell(0, 1))]);
  assert.deepEqual(
    routeTo(size, walled, [cell(0, 0)], cell(1, 1)),
    [cell(1, 0), cell(1, 1)],
    'with one side walled off the corner has a single route and must be taken',
  );

  // Never route through cells already on the line, and never across a wall.
  assert.deepEqual(
    routeTo(size, open, [cell(0, 0), cell(0, 1)], cell(0, 2)),
    [cell(0, 2)],
    'an adjacent target is still just one step',
  );
  const blocked = buildNeighbours(size, [wallKey(cell(0, 1), cell(0, 2))]);
  assert.deepEqual(
    routeTo(size, blocked, [cell(0, 0)], cell(0, 2)),
    [],
    'a wall in the swept gap must stop the route, not be jumped',
  );

  // A flick across the board must not conjure a corridor the player never drew.
  assert.deepEqual(
    routeTo(size, open, [cell(0, 0)], cell(4, 4)),
    [],
    'a target far away must be ignored rather than routed to',
  );

  // The end of the line and cells already used are not targets.
  assert.deepEqual(routeTo(size, open, [cell(1, 1)], cell(1, 1)), [], 'the current end is not a move');
  assert.deepEqual(
    routeTo(size, open, [cell(0, 0), cell(0, 1), cell(0, 2)], cell(0, 1)),
    [],
    'a cell already on the line must not be routed to',
  );
}

/** Circuit topology & conductivity analysis (circuit.ts). */
function expectCircuitTopologyAndConductivity(): void {
  const size: Size = { rows: 5, cols: 5 };
  const open = buildNeighbours(size, []);

  // 1. Impedance calculation and baseline properties
  const emptyAnalysis = analyzeCircuit(size, open, [], { 0: 1, 24: 2 });
  assert.equal(emptyAnalysis.conductedCount, 0);
  assert.equal(emptyAnalysis.conductedPct, 0);
  assert.equal(emptyAnalysis.turnsCount, 0);
  assert.equal(emptyAnalysis.impedanceOhms, 48, 'baseline impedance must be 48Ω');
  assert.equal(emptyAnalysis.hasDeadEnd, false);
  assert.equal(emptyAnalysis.safeRollbackLength, null);
  assert.equal(emptyAnalysis.directionToNext, '起點 1');
  assert.equal(emptyAnalysis.distanceToNext, 0);

  // Single cell: 48Ω baseline + 1*6Ω node resistance = 54Ω
  const single = analyzeCircuit(size, open, [0], { 0: 1, 24: 2 });
  assert.equal(single.conductedCount, 1);
  assert.equal(single.conductedPct, 4); // 1/25 = 4%
  assert.equal(single.turnsCount, 0);
  assert.equal(single.impedanceOhms, 54);
  assert.equal(single.hasDeadEnd, false);

  // Straight line of 5 cells: 48 + 5*6 + 0*14 = 78Ω
  const straight = analyzeCircuit(size, open, [0, 1, 2, 3, 4], { 0: 1, 24: 2 });
  assert.equal(straight.conductedCount, 5);
  assert.equal(straight.conductedPct, 20);
  assert.equal(straight.turnsCount, 0);
  assert.equal(straight.impedanceOhms, 78);

  // Path with single 90-degree corner turn: [0, 1, 2, 7] -> 48 + 4*6 + 1*14 = 86Ω
  const corner = analyzeCircuit(size, open, [0, 1, 2, 7], { 0: 1, 24: 2 });
  assert.equal(corner.conductedCount, 4);
  assert.equal(corner.turnsCount, 1);
  assert.equal(corner.impedanceOhms, 86);

  // Zigzag path with 4 turns: [0, 1, 6, 7, 12, 13] -> 48 + 6*6 + 4*14 = 140Ω
  const zigzag = analyzeCircuit(size, open, [0, 1, 6, 7, 12, 13], { 0: 1, 24: 2 });
  assert.equal(zigzag.conductedCount, 6);
  assert.equal(zigzag.turnsCount, 4);
  assert.equal(zigzag.impedanceOhms, 140);

  // Solved puzzle: 100% conducted, no dead ends
  const puzzle = generate({ seedCode: 'circuit-topo-solved', difficulty: 'easy' });
  const solved = analyzeCircuit(
    puzzle.size,
    neighboursOf(puzzle),
    puzzle.solution,
    puzzle.checkpoints,
  );
  assert.equal(solved.conductedCount, puzzle.solution.length);
  assert.equal(solved.conductedPct, 100);
  assert.equal(solved.hasDeadEnd, false);
  assert.equal(solved.safeRollbackLength, null);

  // 2. Disconnected island detection
  // Path visits 5, 6, 1, 2. Cell 0 is unvisited but both of its neighbours (1 and 5) are visited.
  // Head is at cell 2, so cell 0 is trapped in a fatal dead-end island.
  const trappedPath = [5, 6, 1, 2];
  const trapped = analyzeCircuit(size, open, trappedPath, { 5: 1, 24: 2 });
  assert.equal(trapped.hasDeadEnd, true, 'dead-end island must be flagged');
  assert.ok(trapped.isolatedCells.has(0), 'cell 0 must be in isolatedCells');
  assert.equal(trapped.safeRollbackLength, 3, 'safe rollback length should be 3');

  // Verify safe backtrack derivation: rolling back to prefix restores safety
  const safePrefix = trappedPath.slice(0, trapped.safeRollbackLength!);
  const restored = analyzeCircuit(size, open, safePrefix, { 5: 1, 24: 2 });
  assert.equal(restored.hasDeadEnd, false);
  assert.equal(restored.isolatedCells.size, 0);
  assert.equal(restored.safeRollbackLength, null);

  // Trapping two disconnected corners: cell 0 and cell 4
  const doubleTrappedPath = [5, 6, 1, 2, 3, 8, 9, 14];
  const doubleTrapped = analyzeCircuit(size, open, doubleTrappedPath, { 5: 1, 24: 2 });
  assert.equal(doubleTrapped.hasDeadEnd, true);
  assert.ok(doubleTrapped.isolatedCells.has(0));
  assert.ok(doubleTrapped.isolatedCells.has(4));
  assert.equal(doubleTrapped.safeRollbackLength, 3);

  // Blocked hole exclusion: if cell 0 is a hole, it is not an unvisited playable cell
  const holeAnalysis = analyzeCircuit(size, open, trappedPath, { 5: 1, 24: 2 }, [0]);
  assert.equal(holeAnalysis.hasDeadEnd, false, 'holes must not count as isolated cells');
  assert.equal(holeAnalysis.isolatedCells.size, 0);

  // 3. Target checkpoints, distance, and 8-compass direction
  const checkpoints: Record<CellId, number> = { 0: 1, 12: 2, 24: 3 };
  const targetCheck = analyzeCircuit(size, open, [0], checkpoints);
  assert.equal(targetCheck.nextCheckpointNumber, 2);
  assert.equal(targetCheck.nextCheckpointCell, 12);
  assert.equal(targetCheck.distanceToNext, 4); // Manhattan distance from (0,0) to (2,2)
  assert.equal(targetCheck.directionToNext, '東南 ↘');
  assert.equal(targetCheck.checkpointStatus[0].reached, true);
  assert.equal(targetCheck.checkpointStatus[1].isCurrentTarget, true);
  assert.equal(targetCheck.checkpointStatus[2].isCurrentTarget, false);

  // Compass directions from center cell 12 (row 2, col 2)
  const dirNorth = analyzeCircuit(size, open, [12], { 12: 1, 7: 2 }).directionToNext;
  assert.equal(dirNorth, '北 ↑');
  const dirSouth = analyzeCircuit(size, open, [12], { 12: 1, 17: 2 }).directionToNext;
  assert.equal(dirSouth, '南 ↓');
  const dirEast = analyzeCircuit(size, open, [12], { 12: 1, 13: 2 }).directionToNext;
  assert.equal(dirEast, '東 →');
  const dirWest = analyzeCircuit(size, open, [12], { 12: 1, 11: 2 }).directionToNext;
  assert.equal(dirWest, '西 ←');
  const dirNorthEast = analyzeCircuit(size, open, [12], { 12: 1, 8: 2 }).directionToNext;
  assert.equal(dirNorthEast, '東北 ↗');
  const dirNorthWest = analyzeCircuit(size, open, [12], { 12: 1, 6: 2 }).directionToNext;
  assert.equal(dirNorthWest, '西北 ↖');
  const dirSouthEast = analyzeCircuit(size, open, [12], { 12: 1, 18: 2 }).directionToNext;
  assert.equal(dirSouthEast, '東南 ↘');
  const dirSouthWest = analyzeCircuit(size, open, [12], { 12: 1, 16: 2 }).directionToNext;
  assert.equal(dirSouthWest, '西南 ↙');
  const dirAllDone = analyzeCircuit(size, open, [12, 13], { 12: 1, 13: 2 }).directionToNext;
  assert.equal(dirAllDone, '待定');
  const dirStart = analyzeCircuit(size, open, [], { 12: 1 }).directionToNext;
  assert.equal(dirStart, '起點 1');
}

function resetMockAudio(): void {
  activeMockContext = null;
  resetAudioContextForTesting();
}

/** Cyber circuit Web Audio synthesizer contracts (circuitAudio.ts). */
function expectCyberCircuitAudioSynthesizerContracts(): void {
  setAudioMuted(false);
  resetMockAudio();

  // 1. Arpeggio glide frequencies on path extension
  playCircuitExtend(1, false);
  assert.ok(activeMockContext !== null, 'audio context must be initialized');
  assert.equal(activeMockContext.oscillators.length, 1);
  assert.equal(activeMockContext.oscillators[0].type, 'triangle');
  assert.equal(activeMockContext.oscillators[0].frequency.value, CYBER_SCALE[0]);
  assert.equal(activeMockContext.gains.length, 1);
  assert.ok(activeMockContext.oscillators[0].started);
  assert.ok(activeMockContext.oscillators[0].stopped);

  // Progressive steps scale across the pentatonic octaves
  for (let step = 1; step <= 12; step++) {
    resetMockAudio();
    playCircuitExtend(step, false);
    assert.equal(
      activeMockContext!.oscillators[0].frequency.value,
      CYBER_SCALE[step - 1],
      `step ${step} frequency`,
    );
  }

  // Step 13 wraps modulo back to root frequency
  resetMockAudio();
  playCircuitExtend(13, false);
  assert.equal(activeMockContext!.oscillators[0].frequency.value, CYBER_SCALE[0]);

  // Checkpoint reached: triggers primary tone + harmonic octave chime
  resetMockAudio();
  playCircuitExtend(3, true);
  assert.equal(activeMockContext!.oscillators.length, 2, 'checkpoint triggers 2 oscillators');
  assert.equal(activeMockContext!.oscillators[0].type, 'sine');
  assert.equal(activeMockContext!.oscillators[0].frequency.value, CYBER_SCALE[2]);
  assert.equal(activeMockContext!.oscillators[1].type, 'triangle');
  const sweepEvents = activeMockContext!.oscillators[1].frequency.events;
  assert.ok(sweepEvents.some((e) => e.type === 'exponentialRampToValueAtTime'));

  // 2. Downward energy discharge glide on retract
  resetMockAudio();
  playCircuitRetract();
  assert.equal(activeMockContext!.oscillators.length, 1);
  assert.equal(activeMockContext!.oscillators[0].type, 'sine');
  const retractFreqEvents = activeMockContext!.oscillators[0].frequency.events;
  assert.equal(retractFreqEvents[0].value, 480);
  const rampDown = retractFreqEvents.find((e) => e.type === 'exponentialRampToValueAtTime');
  assert.ok(rampDown);
  assert.equal(rampDown.value, 180);

  // 3. Overload alarm: dissonant minor-second pair (165Hz & 175Hz sawtooth)
  resetMockAudio();
  playOverloadAlarm();
  assert.equal(activeMockContext!.oscillators.length, 2);
  assert.equal(activeMockContext!.oscillators[0].type, 'sawtooth');
  assert.equal(activeMockContext!.oscillators[1].type, 'sawtooth');
  assert.equal(activeMockContext!.oscillators[0].frequency.value, 165);
  assert.equal(activeMockContext!.oscillators[1].frequency.value, 175);

  // Debouncing: immediate second call within 350ms is suppressed
  playOverloadAlarm();
  assert.equal(activeMockContext!.oscillators.length, 2, 'debouncing should suppress re-trigger');

  // 4. Safe rollback healing chime: C major resolution triad
  resetMockAudio();
  playSafeRollback();
  assert.equal(activeMockContext!.oscillators.length, 3);
  const chimeFreqs = activeMockContext!.oscillators.map((o) => o.frequency.value);
  assert.deepEqual(chimeFreqs, [392.0, 523.25, 659.25]);
  assert.ok(activeMockContext!.oscillators.every((o) => o.type === 'triangle'));

  // 5. Full grid discharge fanfare: sub-bass drop + 7-tier arpeggio
  resetMockAudio();
  playFullGridDischarge();
  assert.equal(activeMockContext!.oscillators.length, 8, '1 sub-bass + 7 arpeggio oscillators');
  // First oscillator is sub-bass
  assert.equal(activeMockContext!.oscillators[0].type, 'sine');
  assert.equal(activeMockContext!.oscillators[0].frequency.events[0].value, 110);
  const subBassRamp = activeMockContext!.oscillators[0].frequency.events.find(
    (e) => e.type === 'exponentialRampToValueAtTime',
  );
  assert.ok(subBassRamp);
  assert.equal(subBassRamp.value, 45);

  // Remaining 7 oscillators form the fanfare arpeggio
  const fanfareFreqs = activeMockContext!.oscillators.slice(1).map((o) => o.frequency.value);
  assert.deepEqual(fanfareFreqs, [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5]);

  // 6. Mute toggle contract
  setAudioMuted(true);
  assert.equal(isAudioMuted(), true);
  resetMockAudio();
  playCircuitExtend(1, true);
  playCircuitRetract();
  playOverloadAlarm();
  playSafeRollback();
  playFullGridDischarge();
  assert.equal(activeMockContext, null, 'no audio context or nodes should be created when muted');

  setAudioMuted(false);
  assert.equal(isAudioMuted(), false);
}

/** Large board (8x8, 10x10) unique solvability with blocked cells (empty holes). */
function expectLargeBoardUniqueSolvabilityWithBlockedCells(): void {
  // 1. 8x8 expert board with blocked holes
  const p8 = generate({
    seedCode: 'large-8x8-blocked-unique',
    difficulty: 'expert',
    blockedCount: 4,
  });
  assert.equal(p8.size.rows, 8);
  assert.equal(p8.size.cols, 8);
  assert.equal(p8.blocked.length, 4);
  const total8 = playableCount(p8.size, p8.blocked);
  assert.equal(total8, 60);
  assert.equal(p8.solution.length, 60);

  for (const hole of p8.blocked) {
    assert.ok(!p8.solution.includes(hole), '8x8 solution must never enter a hole');
    assert.equal(p8.checkpoints[hole], undefined, 'checkpoint must not be on a hole');
  }

  const nb8 = neighboursOf(p8);
  assert.ok(
    isHamiltonianPath(p8.size, nb8, p8.solution, p8.blocked),
    '8x8 answer is not Hamiltonian on open cells',
  );

  const sPruned8 = solve({
    size: p8.size,
    neighbours: nb8,
    checkpoints: p8.checkpoints,
    checkpointCount: p8.checkpointCount,
    blocked: p8.blocked,
    prune: true,
    limit: 2,
  });
  assert.ok(sPruned8.exhausted);
  assert.equal(sPruned8.solutions.length, 1, '8x8 pruned solver must find a unique solution');
  assert.deepEqual(sPruned8.solutions[0], p8.solution);

  const sUnpruned8 = solve({
    size: p8.size,
    neighbours: nb8,
    checkpoints: p8.checkpoints,
    checkpointCount: p8.checkpointCount,
    blocked: p8.blocked,
    prune: false,
    limit: 2,
    nodeLimit: 500_000,
  });
  assert.ok(sUnpruned8.exhausted);
  assert.equal(sUnpruned8.solutions.length, 1, '8x8 unpruned solver must find a unique solution');
  assert.deepEqual(sUnpruned8.solutions[0], p8.solution);
  assert.deepEqual(sPruned8.solutions[0], sUnpruned8.solutions[0]);
  assert.ok(sPruned8.nodes <= sUnpruned8.nodes, 'pruning must not explore more nodes');

  // 2. 10x10 large board with blocked holes and custom targets
  const p10 = generate({
    seedCode: 'large-10x10-blocked-unique',
    difficulty: 'expert',
    size: { rows: 10, cols: 10 },
    blockedCount: 6,
    checkpointTarget: 22,
    wallTarget: 42,
  });
  assert.equal(p10.size.rows, 10);
  assert.equal(p10.size.cols, 10);
  assert.equal(p10.blocked.length, 6);
  const total10 = playableCount(p10.size, p10.blocked);
  assert.equal(total10, 94);
  assert.equal(p10.solution.length, 94);

  for (const hole of p10.blocked) {
    assert.ok(!p10.solution.includes(hole), '10x10 solution must never enter a hole');
    assert.equal(p10.checkpoints[hole], undefined);
  }

  const nb10 = neighboursOf(p10);
  assert.ok(isHamiltonianPath(p10.size, nb10, p10.solution, p10.blocked));

  const sPruned10 = solve({
    size: p10.size,
    neighbours: nb10,
    checkpoints: p10.checkpoints,
    checkpointCount: p10.checkpointCount,
    blocked: p10.blocked,
    prune: true,
    limit: 2,
  });
  assert.ok(sPruned10.exhausted);
  assert.equal(sPruned10.solutions.length, 1, '10x10 pruned solver must find a unique solution');
  assert.deepEqual(sPruned10.solutions[0], p10.solution);

  const sUnpruned10 = solve({
    size: p10.size,
    neighbours: nb10,
    checkpoints: p10.checkpoints,
    checkpointCount: p10.checkpointCount,
    blocked: p10.blocked,
    prune: false,
    limit: 2,
    nodeLimit: 500_000,
  });
  assert.ok(sUnpruned10.exhausted);
  assert.equal(sUnpruned10.solutions.length, 1, '10x10 unpruned solver must find a unique solution');
  assert.deepEqual(sUnpruned10.solutions[0], p10.solution);
  assert.equal(
    divergenceIndex(sPruned10.solutions[0], sUnpruned10.solutions[0]),
    total10,
    'pruned and unpruned answers must have zero divergence',
  );
}

/** Four-stage progressive hint logic (hint.ts). */
function expectFourStageProgressiveHintLogic(): void {
  assert.deepEqual(HINT_SEQUENCE, ['locate', 'rewind', 'reveal', 'segment']);

  const puzzle = generate({ seedCode: 'hint-deep-coverage', difficulty: 'normal' });

  // 1. Stage 1: Locate
  // On track: preserves path length, confirms route is good
  const correctPrefix = puzzle.solution.slice(0, 5);
  const h1On = computeHint(puzzle, correctPrefix, 'locate');
  assert.equal(h1On.kind, 'locate');
  assert.equal(h1On.keepLength, 5);
  assert.equal(h1On.nextCell, null);
  assert.equal(h1On.revealCells.length, 0);
  assert.ok(h1On.message.includes('目前為止都是對的'));

  // Off track: identifies the first wrong step without truncating
  const wrongCell = puzzle.solution[puzzle.solution.length - 1];
  const strayed = [...correctPrefix, wrongCell];
  const h1Off = computeHint(puzzle, strayed, 'locate');
  assert.equal(h1Off.keepLength, 6);
  assert.ok(h1Off.message.includes('第 6 步'));

  // 2. Stage 2: Rewind
  // Backtrack recommendation: rewinds to the last verified step
  const h2On = computeHint(puzzle, correctPrefix, 'rewind');
  assert.equal(h2On.keepLength, 5);
  assert.ok(h2On.message.includes('路線沒有錯'));

  const h2Off = computeHint(puzzle, strayed, 'rewind');
  assert.equal(h2Off.keepLength, 5, 'rewind must keep exactly the valid prefix length');
  assert.ok(h2Off.message.includes('第 5 步'));

  // 3. Stage 3: Reveal
  // Reveals the immediate next cell
  const h3On = computeHint(puzzle, correctPrefix, 'reveal');
  assert.equal(h3On.keepLength, 5);
  assert.equal(h3On.nextCell, puzzle.solution[5]);
  assert.deepEqual(h3On.revealCells, [puzzle.solution[5]]);
  assert.ok(h3On.message.includes('下一格已經標出來了'));

  const h3Off = computeHint(puzzle, strayed, 'reveal');
  assert.equal(h3Off.keepLength, 5);
  assert.equal(h3Off.nextCell, puzzle.solution[5]);
  assert.deepEqual(h3Off.revealCells, [puzzle.solution[5]]);

  // 4. Stage 4: Segment
  // Unveils the entire leg to the next numbered checkpoint
  const h4Off = computeHint(puzzle, strayed, 'segment');
  assert.equal(h4Off.keepLength, 5);
  assert.equal(h4Off.nextCell, puzzle.solution[5]);
  assert.ok(h4Off.revealCells.length >= 1);
  assert.equal(h4Off.revealCells[0], puzzle.solution[5]);

  const rest = puzzle.solution.slice(5);
  const nextCpIdx = rest.findIndex((c) => puzzle.checkpoints[c] !== undefined);
  if (nextCpIdx !== -1) {
    const expectedLeg = rest.slice(0, nextCpIdx + 1);
    assert.deepEqual(h4Off.revealCells, expectedLeg);
    const cpNumber = puzzle.checkpoints[expectedLeg[expectedLeg.length - 1]];
    assert.ok(h4Off.message.includes(String(cpNumber)));
  }

  // Edge cases: Empty path
  const emptyLocate = computeHint(puzzle, [], 'locate');
  assert.equal(emptyLocate.keepLength, 0);
  const emptyReveal = computeHint(puzzle, [], 'reveal');
  assert.equal(emptyReveal.nextCell, puzzle.solution[0]);
  assert.deepEqual(emptyReveal.revealCells, [puzzle.solution[0]]);

  // Edge cases: Completed path
  const completedLocate = computeHint(puzzle, puzzle.solution, 'locate');
  assert.equal(completedLocate.keepLength, puzzle.solution.length);
  const completedReveal = computeHint(puzzle, puzzle.solution, 'reveal');
  assert.equal(completedReveal.nextCell, null);
  assert.deepEqual(completedReveal.revealCells, []);
  assert.ok(completedReveal.message.includes('已經走完了'));

  const completedSegment = computeHint(puzzle, puzzle.solution, 'segment');
  assert.deepEqual(completedSegment.revealCells, []);
  assert.ok(completedSegment.message.includes('已經走完了'));
}

/** Asia/Taipei daily & weekly seed determinism, streak preservation, and year/month boundary crossings. */
function expectAsiaTaipeiDailyAndWeeklySeedDeterminismAndStreaks(): void {
  // 1. Asia/Taipei (UTC+8) dateKey determinism
  // 15:59:59 UTC is 23:59:59 in Taipei (same day)
  assert.equal(dateKey(new Date('2026-06-15T15:59:59.000Z')), '2026-06-15');
  // 16:00:00 UTC is 00:00:00 in Taipei (next day)
  assert.equal(dateKey(new Date('2026-06-15T16:00:00.000Z')), '2026-06-16');

  // Year boundary transition in UTC+8
  assert.equal(dateKey(new Date('2026-12-31T15:59:59.000Z')), '2026-12-31');
  assert.equal(dateKey(new Date('2026-12-31T16:00:00.000Z')), '2027-01-01');

  // Leap-year February 29th transition
  assert.equal(dateKey(new Date('2024-02-28T16:00:00.000Z')), '2024-02-29');
  assert.equal(dateKey(new Date('2024-02-29T16:00:00.000Z')), '2024-03-01');

  // Non-leap year February 28th transition
  assert.equal(dateKey(new Date('2026-02-28T16:00:00.000Z')), '2026-03-01');

  // 2. Daily streak preservation across month and year boundaries
  const makeRecords = (dates: string[]) =>
    dates.map((date) => ({ date, elapsedMs: 15_000, hintsUsed: 0 }));

  // Year boundary crossing
  const yearRecords = makeRecords(['2026-12-30', '2026-12-31', '2027-01-01']);
  assert.equal(computeStreak(yearRecords, '2027-01-01'), 3, 'streak survives across year boundary');
  // Today not yet played, yesterday played across year boundary
  assert.equal(
    computeStreak(makeRecords(['2026-12-30', '2026-12-31']), '2027-01-01'),
    2,
    'streak remains alive on Jan 1 before playing',
  );
  // Missed yesterday breaks streak
  assert.equal(
    computeStreak(makeRecords(['2026-12-30']), '2027-01-01'),
    0,
    'missing Dec 31 breaks streak on Jan 1',
  );

  // Leap-year month boundary
  const leapRecords = makeRecords(['2024-02-28', '2024-02-29', '2024-03-01']);
  assert.equal(computeStreak(leapRecords, '2024-03-01'), 3, 'streak survives across leap day');

  // Non-leap February boundary
  const nonLeapRecords = makeRecords(['2026-02-28', '2026-03-01']);
  assert.equal(computeStreak(nonLeapRecords, '2026-03-01'), 2, 'streak survives Feb 28 -> Mar 1');

  // 30-day month boundary (Apr 30 -> May 1)
  const aprMayRecords = makeRecords(['2026-04-30', '2026-05-01']);
  assert.equal(computeStreak(aprMayRecords, '2026-05-01'), 2, 'streak survives Apr 30 -> May 1');

  // 31-day month boundary (May 31 -> Jun 1)
  const mayJunRecords = makeRecords(['2026-05-31', '2026-06-01']);
  assert.equal(computeStreak(mayJunRecords, '2026-06-01'), 2, 'streak survives May 31 -> Jun 1');

  // Summarise records
  const summary = summarise(
    [
      { date: '2026-10-20', elapsedMs: 45_000, hintsUsed: 0 },
      { date: '2026-10-19', elapsedMs: 32_000, hintsUsed: 1 },
    ],
    '2026-10-20',
  );
  assert.equal(summary.streak, 2);
  assert.equal(summary.bestMs, 32_000);

  // 3. Weekly schedule across year boundaries
  // 2026-12-31 is Thursday of the week starting Monday 2026-12-28
  assert.equal(weekKey(new Date('2026-12-28T04:00:00Z')), '2026-12-28');
  assert.equal(weekKey(new Date('2026-12-31T04:00:00Z')), '2026-12-28');
  assert.equal(weekKey(new Date('2027-01-01T04:00:00Z')), '2026-12-28');
  assert.equal(weekKey(new Date('2027-01-03T04:00:00Z')), '2026-12-28');
  assert.equal(weekKey(new Date('2027-01-04T04:00:00Z')), '2027-01-04'); // Next Monday

  // Day indices within week (0 = Monday ... 6 = Sunday)
  assert.equal(todayWeekDayIndex(new Date('2026-12-28T04:00:00Z')), 0);
  assert.equal(todayWeekDayIndex(new Date('2026-12-31T04:00:00Z')), 3);
  assert.equal(todayWeekDayIndex(new Date('2027-01-01T04:00:00Z')), 4);
  assert.equal(todayWeekDayIndex(new Date('2027-01-03T04:00:00Z')), 6);

  // Seed determinism and puzzle reproducibility
  const seedD1 = dailySeed('2026-12-31');
  const pDaily1 = generate({ seedCode: seedD1, difficulty: DAILY_DIFFICULTY });
  const pDaily2 = generate({ seedCode: seedD1, difficulty: DAILY_DIFFICULTY });
  assert.deepEqual(pDaily1, pDaily2, 'daily generator must be deterministic');

  const seedW1 = weeklySeed('2026-12-28', 5);
  const pWeekly1 = generate({ seedCode: seedW1, difficulty: 'normal', blockedCount: 3 });
  const pWeekly2 = generate({ seedCode: seedW1, difficulty: 'normal', blockedCount: 3 });
  assert.deepEqual(pWeekly1, pWeekly2, 'weekly generator must be deterministic');
}

/** Wave 3b structural waypoint constraints & Strict Mode validation. */
function expectWaypointsAndStrictMode(): void {
  const size: Size = { rows: 5, cols: 5 };

  // 1. motionAtCell arithmetic checks
  // Straight horizontal: (0, 0) -> (0, 1) -> (0, 2)
  assert.equal(motionAtCell(size, 0, 1, 2), 'straight');
  // Straight vertical: (0, 1) -> (1, 1) -> (2, 1)
  assert.equal(motionAtCell(size, 1, 6, 11), 'straight');
  // Turn: (0, 0) -> (0, 1) -> (1, 1)
  assert.equal(motionAtCell(size, 0, 1, 6), 'turn');
  // Turn: (1, 0) -> (0, 0) -> (0, 1)
  assert.equal(motionAtCell(size, 5, 0, 1), 'turn');

  // 2. validateWaypoints checks
  const waypoints: Record<CellId, WaypointKind> = { 1: 'straight', 6: 'turn' };
  assert.equal(validateWaypoints(size, [0, 1, 2, 7, 6, 11], waypoints), true);
  assert.equal(validateWaypoints(size, [0, 1, 6, 5], waypoints), false); // 1 turned, violated

  // 3. Generation with waypointMode produces unique puzzles obeying constraints
  const p = generate({
    seedCode: 'wp-test-unique-1',
    difficulty: 'hard',
    waypointMode: true,
  });
  assert.ok(p.waypoints, 'puzzle must contain waypoints when waypointMode is requested');
  const wpKeys = Object.keys(p.waypoints);
  assert.ok(wpKeys.length >= 2, 'puzzle should have at least 2 waypoints');
  assert.ok(validateWaypoints(p.size, p.solution, p.waypoints), 'canonical solution must satisfy waypoints');

  // Check unique solvability with waypoints
  const nb = buildNeighbours(p.size, p.walls, p.blocked);
  const s = solve({
    size: p.size,
    neighbours: nb,
    checkpoints: p.checkpoints,
    checkpointCount: p.checkpointCount,
    blocked: p.blocked,
    waypoints: p.waypoints,
    limit: 2,
  });
  assert.equal(s.solutions.length, 1, 'puzzle with waypoints must be uniquely solvable');
  assert.deepEqual(s.solutions[0], p.solution);

  // 4. Strict Mode storage contracts
  assert.equal(typeof loadStrictMode(), 'boolean');
  saveStrictMode(true);
  saveStrictMode(false);
}

const checks: [string, () => void][] = [
  ['drag routing follows the finger', expectDragRoutingFollowsTheFinger],
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
  ['daily algorithm unchanged', expectDailyAlgorithmUnchanged],
  ['weekly schedule and unique boards', expectWeeklySchedule],
  ['blocked variant is uniquely solvable', expectBlockedVariantIsUnique],
  ['achievements and stats validation', expectAchievementsAndStatsValidation],
  ['circuit topology and conductivity analysis', expectCircuitTopologyAndConductivity],
  ['cyber circuit Web Audio synthesizer contracts', expectCyberCircuitAudioSynthesizerContracts],
  ['large board unique solvability with blocked cells', expectLargeBoardUniqueSolvabilityWithBlockedCells],
  ['four-stage progressive hint logic', expectFourStageProgressiveHintLogic],
  ['Asia/Taipei daily & weekly seed determinism and streaks', expectAsiaTaipeiDailyAndWeeklySeedDeterminismAndStreaks],
  ['waypoints and Strict Mode validation', expectWaypointsAndStrictMode],
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
