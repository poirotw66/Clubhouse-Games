import assert from 'node:assert/strict';
import {
  BOARD_SIZES,
  emptyIndex,
  hintTileIndex,
  isSolvable,
  isSolved,
  manhattanSum,
  neighborsOfEmpty,
  parGrade,
  scrambleBoard,
  scrambleFromSeed,
  scrambleSlideCount,
  slide,
  slideByDirection,
  shuffledBoard,
  solvedBoard,
} from './fifteenLogic.ts';
import { applyPath, heuristic, linearConflict, optimalMoves, solvePuzzle } from './solver.ts';
import { CAMPAIGN_STAGES, applyStageClear, isStageUnlocked, moveLimitFor } from './campaign.ts';
import { computeStreak, dailyConfig, dailySeedNumber, dateKey } from './daily.ts';
import { hashString } from './rng.ts';

// —— Core board invariants for every size ——
for (const size of BOARD_SIZES) {
  const solved = solvedBoard(size);
  assert.equal(solved.length, size * size);
  assert.ok(isSolved(solved, size));
  assert.ok(isSolvable(solved, size));
  assert.equal(manhattanSum(solved, size), 0);
  assert.equal(linearConflict(solved, size), 0);
  assert.equal(hintTileIndex(solved, size), null);
  assert.equal(heuristic(solved, size), 0);

  const one = slide(solved, size * size - 2, size);
  assert.ok(one);
  assert.equal(emptyIndex(one), size * size - 2);
  assert.ok(neighborsOfEmpty(one, size).length >= 2);
  assert.ok(manhattanSum(one, size) > 0);
  assert.equal(hintTileIndex(one, size), size * size - 1);

  // After sliding the last numbered tile left into the empty corner, a left
  // swipe restores it (tile slides left into empty).
  const back = slideByDirection(one, size, 'left');
  assert.ok(back);
  assert.ok(isSolved(back, size));
}

// —— Seeded scramble determinism ——
{
  const a = scrambleFromSeed(4, 'normal', hashString('fp-test'));
  const b = scrambleFromSeed(4, 'normal', hashString('fp-test'));
  assert.deepEqual(a.board, b.board);
  assert.equal(a.scrambleMoves, scrambleSlideCount(4, 'normal'));
  assert.ok(isSolvable(a.board, 4));
  assert.ok(!isSolved(a.board, 4));
}

// —— Random solvability sample ——
{
  let seed = 1;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (const size of [3, 4]) {
    for (let i = 0; i < 12; i++) {
      const b = shuffledBoard(size, rand);
      assert.ok(isSolvable(b, size));
      assert.ok(!isSolved(b, size));
      const hint = hintTileIndex(b, size);
      assert.ok(hint !== null);
      assert.ok(neighborsOfEmpty(b, size).includes(hint));
    }
  }
  for (const size of BOARD_SIZES) {
    for (const tier of ['easy', 'normal', 'hard']) {
      for (let i = 0; i < 4; i++) {
        const { board } = scrambleBoard(size, /** @type {any} */ (tier), rand);
        assert.ok(isSolvable(board, size));
        assert.ok(!isSolved(board, size));
      }
    }
  }
}

// —— IDA* finds known short solutions on 3×3 ——
{
  const size = 3;
  const solved = solvedBoard(size);
  // Two "right" swipes: tiles slide right into empty → empty walks left twice.
  let board = slideByDirection(solved, size, 'right');
  assert.ok(board);
  board = slideByDirection(board, size, 'right');
  assert.ok(board);
  const result = solvePuzzle(board, size, { upperBound: 4, maxNodes: 50_000, timeMs: 200 });
  assert.equal(result.moves, 2);
  assert.equal(result.exact, true);
  assert.ok(result.path);
  assert.ok(isSolved(applyPath(board, size, result.path), size));
}

// —— Scramble walk length is an upper bound; solver ≤ that ——
{
  const size = 3;
  const fixed = scrambleFromSeed(size, 'easy', 42);
  const opt = optimalMoves(fixed.board, size, fixed.scrambleMoves);
  assert.ok(opt.moves <= (fixed.scrambleMoves ?? 99));
  assert.ok(opt.moves >= manhattanSum(fixed.board, size));
}

// —— Par grades ——
assert.equal(parGrade(10, 10), 'S');
assert.equal(parGrade(11, 10), 'A');
assert.equal(parGrade(20, 10), 'D');

// —— Daily config stable for a date ——
{
  const key = '2026-10-19';
  const a = dailyConfig(key);
  const b = dailyConfig(key);
  assert.deepEqual(a, b);
  assert.ok(BOARD_SIZES.includes(a.size) || a.size === 3 || a.size === 4 || a.size === 5);
  assert.equal(typeof dailySeedNumber(key), 'number');
  assert.equal(dateKey(new Date('2026-10-19T04:00:00+08:00')), '2026-10-19');
}

// —— Streak ——
{
  const today = '2026-10-19';
  assert.equal(computeStreak([{ date: '2026-10-19', moves: 1, elapsedSec: 1, optimal: 1, grade: 'S' }], today), 1);
  assert.equal(
    computeStreak(
      [
        { date: '2026-10-19', moves: 1, elapsedSec: 1, optimal: 1, grade: 'S' },
        { date: '2026-10-18', moves: 1, elapsedSec: 1, optimal: 1, grade: 'S' },
      ],
      today,
    ),
    2,
  );
  assert.equal(computeStreak([{ date: '2026-10-17', moves: 1, elapsedSec: 1, optimal: 1, grade: 'S' }], today), 0);
}

// —— Campaign pack ——
assert.ok(CAMPAIGN_STAGES.length >= 6);
assert.ok(isStageUnlocked(0, 0));
assert.equal(isStageUnlocked(1, 0), false);
assert.equal(isStageUnlocked(1, 1), true);
{
  const progress = applyStageClear(
    { clearedCount: 0, bestMoves: {}, bestTimeSec: {} },
    0,
    12,
    30,
  );
  assert.equal(progress.clearedCount, 1);
  assert.equal(progress.bestMoves[CAMPAIGN_STAGES[0].id], 12);
  const again = applyStageClear(progress, 0, 10, 20);
  assert.equal(again.clearedCount, 1);
  assert.equal(again.bestMoves[CAMPAIGN_STAGES[0].id], 10);
  assert.ok(moveLimitFor(10, 1.5) >= 12);
}

// —— Campaign seeds produce solvable boards ——
for (const stage of CAMPAIGN_STAGES) {
  const { board, scrambleMoves } = scrambleFromSeed(stage.size, stage.tier, hashString(stage.seedCode));
  assert.ok(isSolvable(board, stage.size), stage.id);
  assert.ok(!isSolved(board, stage.size), stage.id);
  if (scrambleMoves != null) {
    const opt = solvePuzzle(board, stage.size, {
      upperBound: scrambleMoves,
      maxNodes: 40_000,
      timeMs: 40,
    });
    assert.ok(opt.moves <= scrambleMoves, stage.id);
  }
}

console.log('fifteen-puzzle check ok');
