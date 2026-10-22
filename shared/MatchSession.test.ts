import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  advanceScoreSeriesHand,
  applyScoreHandResult,
  applyWinSeriesResult,
  bestOfLabel,
  createScoreSeries,
  createWinSeries,
  decideScoreSeriesWinner,
  firstToLabel,
  formatKeyFor,
  isScoreSeriesComplete,
  isSeriesMode,
  scoreSeriesProgressLabel,
  seatWithMost,
  winSeriesScoreLine,
} from './MatchSession.ts';

describe('score series winner', () => {
  it('single ends after one hand with lowest-seat tie-break', () => {
    assert.equal(
      decideScoreSeriesWinner({ mode: 'single', hands: 4, target: 100 }, [5, -5], 0),
      null,
    );
    assert.equal(
      decideScoreSeriesWinner({ mode: 'single', hands: 4, target: 100 }, [5, -5], 1),
      0,
    );
    assert.equal(
      decideScoreSeriesWinner({ mode: 'single', hands: 4, target: 100 }, [5, 5], 1),
      0,
    );
  });

  it('hands waits for N then picks highest balance', () => {
    const cfg = { mode: 'hands' as const, hands: 4, target: 100 };
    assert.equal(decideScoreSeriesWinner(cfg, [10, 20], 3), null);
    assert.equal(decideScoreSeriesWinner(cfg, [10, 20], 4), 1);
  });

  it('target races to threshold', () => {
    const cfg = { mode: 'target' as const, hands: 4, target: 50 };
    assert.equal(decideScoreSeriesWinner(cfg, [40, 10], 1), null);
    assert.equal(decideScoreSeriesWinner(cfg, [50, 10], 1), 0);
    assert.equal(decideScoreSeriesWinner(cfg, [60, 70], 2), 1);
  });

  it('daily uses dailyHands when provided', () => {
    const cfg = { mode: 'daily' as const, hands: 4, target: 100, dailyHands: 5 };
    assert.equal(decideScoreSeriesWinner(cfg, [10, -5], 4), null);
    assert.equal(decideScoreSeriesWinner(cfg, [10, -5], 5), 0);
  });
});

describe('score series session', () => {
  it('folds hands until matchOver and advances phase', () => {
    let match = createScoreSeries({
      config: { mode: 'hands', hands: 2, target: 100 },
      seatCount: 2,
    });
    match = applyScoreHandResult(match, [10, -10], { hand: 0 });
    assert.equal(match.phase, 'handOver');
    assert.deepEqual(match.balances, [10, -10]);
    assert.equal(isScoreSeriesComplete(match), false);

    match = advanceScoreSeriesHand(match);
    assert.equal(match.phase, 'playing');

    match = applyScoreHandResult(match, [5, -5], { hand: 1 });
    assert.equal(match.phase, 'matchOver');
    assert.equal(match.winner, 0);
    assert.equal(match.history.length, 2);
  });

  it('format keys and progress labels stay stable', () => {
    assert.equal(isSeriesMode('single'), false);
    assert.equal(isSeriesMode('hands'), true);
    assert.equal(formatKeyFor({ mode: 'single', hands: 4, target: 100 }), 'single');
    assert.equal(formatKeyFor({ mode: 'hands', hands: 4, target: 100 }), 'hands-4');
    assert.equal(formatKeyFor({ mode: 'target', hands: 4, target: 200 }), 'target-200');
    assert.equal(formatKeyFor({ mode: 'hands', hands: 7, target: 100 }), null);
    assert.equal(formatKeyFor({ mode: 'daily', hands: 4, target: 100 }), 'daily');

    assert.equal(
      scoreSeriesProgressLabel(
        { config: { mode: 'hands', hands: 4, target: 100 }, handIndex: 0 },
        { unit: '圈' },
      ),
      '第 1／4 圈',
    );
    assert.equal(
      scoreSeriesProgressLabel({
        config: { mode: 'target', hands: 4, target: 100 },
        handIndex: 2,
      }),
      '目標 100 分',
    );
  });

  it('seatWithMost breaks ties toward seat 0', () => {
    assert.equal(seatWithMost([3, 3, 1]), 0);
    assert.equal(seatWithMost([1, 5, 5]), 1);
  });
});

describe('win series — best-of (Reversi shape)', () => {
  it('labels and completes best-of-three', () => {
    assert.equal(bestOfLabel(3), '三戰兩勝');
    let m = createWinSeries({ kind: 'bestOf', value: 3 });
    assert.equal(m.winsNeeded, 2);
    assert.equal(m.length, 3);
    assert.equal(m.gameIndex, 0);

    m = applyWinSeriesResult(m, 0);
    assert.equal(m.over, false);
    assert.deepEqual(m.scores, [1, 0]);
    assert.equal(m.gameIndex, 1);

    m = applyWinSeriesResult(m, 0);
    assert.equal(m.over, true);
    assert.equal(m.winner, 0);
    assert.equal(winSeriesScoreLine(m, { includeDraws: true }), '2 — 0');
  });

  it('settles draw-heavy series on exhaust', () => {
    let m = createWinSeries({ kind: 'bestOf', value: 3 });
    m = applyWinSeriesResult(m, 'draw');
    m = applyWinSeriesResult(m, 'draw');
    m = applyWinSeriesResult(m, 'draw');
    assert.equal(m.over, true);
    assert.equal(m.winner, null);
    assert.equal(m.draws, 3);
    assert.equal(winSeriesScoreLine(m, { includeDraws: true }), '0 — 0（和 3）');
  });
});

describe('win series — first-to (Checkers / Connect-Four)', () => {
  it('Checkers: untilOver gameIndex and first-to-2', () => {
    assert.equal(firstToLabel(2), '兩勝制');
    let m = createWinSeries({ kind: 'firstTo', value: 2, gameIndexStart: 1 });
    m = applyWinSeriesResult(m, 0, { gameIndexMode: 'untilOver', settleOnExhaust: false });
    assert.equal(m.over, false);
    assert.equal(m.gameIndex, 2);
    m = applyWinSeriesResult(m, 0, { gameIndexMode: 'untilOver', settleOnExhaust: false });
    assert.equal(m.over, true);
    assert.equal(m.winner, 0);
    assert.equal(m.gameIndex, 2);
  });

  it('Connect-Four: draws do not score; first to N wins', () => {
    let m = createWinSeries({ kind: 'firstTo', value: 2 });
    m = applyWinSeriesResult(m, 'draw', { settleOnExhaust: false });
    assert.deepEqual(m.scores, [0, 0]);
    assert.equal(m.gameIndex, 1);
    assert.equal(m.over, false);

    m = applyWinSeriesResult(m, 0, { settleOnExhaust: false });
    assert.deepEqual(m.scores, [1, 0]);
    m = applyWinSeriesResult(m, 1, { settleOnExhaust: false });
    assert.deepEqual(m.scores, [1, 1]);
    m = applyWinSeriesResult(m, 0, { settleOnExhaust: false });
    assert.equal(m.over, true);
    assert.equal(m.winner, 0);
  });
});
