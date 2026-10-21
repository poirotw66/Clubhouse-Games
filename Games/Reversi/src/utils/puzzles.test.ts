import { describe, expect, it } from 'vitest';
import { algebraicToMove, boardFromRows, moveToAlgebraic } from './boardCodec';
import { countEmpties, createInitialBoard, getLegalMoves } from './reversiLogic';
import {
  ACCEPTABLE_FIRST_MOVES,
  PUZZLES,
  acceptableFirstMoves,
  assertPuzzleSolvable,
  describePuzzleObjective,
} from './puzzles';
import { isOptimalMove, solveExact } from './solver';
import { createSeries, applySeriesResult, seriesLabel } from './match';
import { OPPONENTS, opponentCount } from './opponents';
import {
  mergeLadder,
  isOpponentUnlocked,
  isPuzzleUnlocked,
  applyLadderWin,
  applyPuzzleSolve,
  ratePuzzleAttempt,
  formatStars,
  puzzleStarTotal,
} from './ladder';
import { teachingHint, STRATEGY_PRIMER } from './teach';

describe('puzzle pack', () => {
  it('ships 10–15 fixed positions', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(10);
    expect(PUZZLES.length).toBeLessThanOrEqual(15);
  });

  it('uses unique ids and Traditional Chinese titles', () => {
    const ids = PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PUZZLES) {
      expect(p.title.trim().length).toBeGreaterThan(0);
      expect(describePuzzleObjective(p)).toMatch(/先/);
    }
  });

  it('keeps every puzzle exact-solvable and goal-consistent', () => {
    for (const puzzle of PUZZLES) {
      assertPuzzleSolvable(puzzle);
      const board = boardFromRows(puzzle.rows);
      expect(countEmpties(board)).toBeLessThanOrEqual(12);
      expect(getLegalMoves(board, puzzle.side).length).toBeGreaterThan(0);
      const solved = solveExact(board, puzzle.side);
      expect(solved.winningMoves.length).toBeGreaterThan(0);
      if (puzzle.goal === 'win') expect(solved.canForceWin).toBe(true);
    }
  });

  it('pins acceptable first moves (unique or explicitly listed)', () => {
    expect(Object.keys(ACCEPTABLE_FIRST_MOVES).sort()).toEqual(
      PUZZLES.map((p) => p.id).sort(),
    );
    for (const puzzle of PUZZLES) {
      const live = acceptableFirstMoves(puzzle);
      const pinned = [...ACCEPTABLE_FIRST_MOVES[puzzle.id]].sort();
      expect(live).toEqual(pinned);
      expect(pinned.length).toBeGreaterThan(0);
      for (const sq of pinned) {
        const move = algebraicToMove(sq);
        expect(isOptimalMove(boardFromRows(puzzle.rows), puzzle.side, move, puzzle.goal)).toBe(
          true,
        );
      }
      // Non-optimal legal moves (if any) must be rejected.
      const board = boardFromRows(puzzle.rows);
      const pinnedSet = new Set(pinned);
      for (const m of getLegalMoves(board, puzzle.side)) {
        const sq = moveToAlgebraic(m);
        if (pinnedSet.has(sq)) continue;
        expect(isOptimalMove(board, puzzle.side, m, puzzle.goal)).toBe(false);
      }
    }
  });

  it('rejects a known-suboptimal move on fork-choice', () => {
    const puzzle = PUZZLES.find((p) => p.id === 'fork-choice');
    expect(puzzle).toBeTruthy();
    const board = boardFromRows(puzzle!.rows);
    // (7,4)=e8 loses; (6,4)=e7 wins — pinned by ACCEPTABLE_FIRST_MOVES.
    expect(isOptimalMove(board, 'black', [7, 4], 'win')).toBe(false);
    expect(isOptimalMove(board, 'black', [6, 4], 'win')).toBe(true);
  });

  it('accepts either corner on two-corners', () => {
    const puzzle = PUZZLES.find((p) => p.id === 'two-corners');
    const board = boardFromRows(puzzle!.rows);
    expect(isOptimalMove(board, 'black', [0, 0], 'win')).toBe(true);
    expect(isOptimalMove(board, 'black', [0, 7], 'win')).toBe(true);
  });
});

describe('opponent roster', () => {
  it('has at least 5 named styles with distinct knobs', () => {
    expect(opponentCount()).toBeGreaterThanOrEqual(5);
    const keys = OPPONENTS.map(
      (o) =>
        `${o.style.mobilityWeight}|${o.style.cornerGreed}|${o.style.edgeWeight}|${o.style.discGreed}|${o.style.xSquareFear}`,
    );
    expect(new Set(keys).size).toBe(OPPONENTS.length);
  });

  it('unlocks ladder sequentially', () => {
    let progress = mergeLadder(null);
    expect(isOpponentUnlocked(0, progress.clearedCount)).toBe(true);
    expect(isOpponentUnlocked(1, progress.clearedCount)).toBe(false);
    const win0 = applyLadderWin(progress, 0);
    expect(win0.newlyCleared).toBe(true);
    progress = win0.progress;
    expect(isOpponentUnlocked(1, progress.clearedCount)).toBe(true);
  });

  it('records puzzle solves, stars, and sequential unlock', () => {
    let progress = mergeLadder(null);
    expect(isPuzzleUnlocked(0, progress)).toBe(true);
    expect(isPuzzleUnlocked(1, progress)).toBe(false);

    progress = applyPuzzleSolve(progress, 'corner-a1', 3);
    expect(progress.puzzlesSolved['corner-a1']).toBe(true);
    expect(progress.puzzleStars['corner-a1']).toBe(3);
    expect(progress.puzzleBest).toBe(1);
    expect(isPuzzleUnlocked(1, progress)).toBe(true);
    expect(isPuzzleUnlocked(2, progress)).toBe(false);

    progress = applyPuzzleSolve(progress, 'corner-a1', 1);
    expect(progress.puzzleStars['corner-a1']).toBe(3); // keep best
    expect(puzzleStarTotal(progress)).toBe(3);
  });

  it('rates puzzle attempts by hint/undo usage', () => {
    expect(ratePuzzleAttempt({ usedHint: false, usedUndo: false })).toBe(3);
    expect(ratePuzzleAttempt({ usedHint: true, usedUndo: false })).toBe(2);
    expect(ratePuzzleAttempt({ usedHint: false, usedUndo: true })).toBe(2);
    expect(ratePuzzleAttempt({ usedHint: true, usedUndo: true })).toBe(1);
    expect(formatStars(3)).toBe('★★★');
    expect(formatStars(1)).toBe('★☆☆');
  });

  it('backfills 1★ for legacy solved puzzles without stars', () => {
    const progress = mergeLadder({
      clearedCount: 0,
      puzzlesSolved: { 'corner-a1': true },
    });
    expect(progress.puzzleStars['corner-a1']).toBe(1);
  });
});

describe('series match', () => {
  it('labels and completes best-of-three', () => {
    expect(seriesLabel(3)).toBe('三戰兩勝');
    let m = createSeries(3);
    m = applySeriesResult(m, 'player');
    expect(m.over).toBe(false);
    m = applySeriesResult(m, 'player');
    expect(m.over).toBe(true);
    expect(m.winner).toBe('player');
  });
});

describe('teaching hints', () => {
  it('ships the three primer themes', () => {
    expect(STRATEGY_PRIMER.map((t) => t.id).sort()).toEqual(
      ['primer-corner', 'primer-mobility', 'primer-parity'].sort(),
    );
  });

  it('flags a free corner on the opening-adjacent take', () => {
    const puzzle = PUZZLES.find((p) => p.id === 'corner-a1')!;
    const board = boardFromRows(puzzle.rows);
    const tip = teachingHint(board, 'black');
    expect(tip?.id).toBe('corner');
  });

  it('returns an opening tip on the initial board', () => {
    const tip = teachingHint(createInitialBoard(), 'black');
    expect(tip?.id).toBe('opening');
  });
});
