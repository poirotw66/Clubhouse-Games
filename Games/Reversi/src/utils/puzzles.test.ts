import { describe, expect, it } from 'vitest';
import { boardFromRows } from './boardCodec';
import { countEmpties, getLegalMoves } from './reversiLogic';
import { PUZZLES, assertPuzzleSolvable, describePuzzleObjective } from './puzzles';
import { isOptimalMove, solveExact } from './solver';
import { createSeries, applySeriesResult, seriesLabel } from './match';
import { OPPONENTS, opponentCount } from './opponents';
import { mergeLadder, isOpponentUnlocked, applyLadderWin, applyPuzzleSolve } from './ladder';
import { teachingHint, STRATEGY_PRIMER } from './teach';
import { createInitialBoard } from './reversiLogic';

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

  it('rejects a known-suboptimal move on fork-choice', () => {
    const puzzle = PUZZLES.find((p) => p.id === 'fork-choice');
    expect(puzzle).toBeTruthy();
    const board = boardFromRows(puzzle!.rows);
    // (7,4) loses; (6,4) wins — pinned by the generator.
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

  it('records puzzle solves on the ladder blob', () => {
    const next = applyPuzzleSolve(mergeLadder(null), 'corner-a1');
    expect(next.puzzlesSolved['corner-a1']).toBe(true);
    expect(next.puzzleBest).toBe(1);
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
    expect(STRATEGY_PRIMER.map((t) => t.id).sort()).toEqual([
      'primer-corner',
      'primer-mobility',
      'primer-parity',
    ].sort());
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
