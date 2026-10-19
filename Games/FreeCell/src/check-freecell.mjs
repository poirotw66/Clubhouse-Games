// ponytail: cascade caps, hints, scoring, daily streak, challenges, difficulty.
import assert from 'node:assert/strict';
import {
  canMove,
  checkWin,
  executeMove,
  getHintMove,
  getMaxMoveCount,
  getSafeFoundationMoves,
  isValidSequence,
} from './utils/gameLogic.ts';
import { dealForDifficulty, dealGame } from './utils/deck.ts';
import { classifyDifficulty, estimateParMoves, solveSync } from './utils/solver.ts';
import { computeStreak, dailyBaseSeed, dateKey } from './utils/daily.ts';
import { evaluateChallenges, isChallengeCleared } from './utils/challenges.ts';
import {
  classicTimeBonus,
  finishMoveDelta,
  initialScore,
  pointsToFoundation,
  pointsUndo,
} from './utils/scoring.ts';
import { modeKey, recordGameResult, winRate } from './utils/storage.ts';

function card(suit, rank) {
  const color = suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
  return { id: `${suit}-${rank}`, suit, rank, color };
}

function emptyState(overrides = {}) {
  return {
    freeCells: [null, null, null, null],
    foundations: { spades: 0, hearts: 0, diamonds: 0, clubs: 0 },
    tableaus: [[], [], [], [], [], [], [], []],
    history: [],
    ...overrides,
  };
}

// Alternating descending sequence is valid; same-color is not.
{
  assert.equal(
    isValidSequence([card('spades', 7), card('hearts', 6), card('clubs', 5)]),
    true,
  );
  assert.equal(isValidSequence([card('spades', 7), card('clubs', 6)]), false);
}

// Freecell supermove formula: (emptyCells + 1) * 2^emptyTableaus.
{
  assert.equal(getMaxMoveCount(0, 0, false), 1);
  assert.equal(getMaxMoveCount(1, 0, false), 2);
  assert.equal(getMaxMoveCount(0, 1, false), 2);
  assert.equal(getMaxMoveCount(1, 1, false), 4);
  assert.equal(getMaxMoveCount(1, 1, true), 2);
  assert.equal(getMaxMoveCount(0, 1, true), 1);
}

// Foundation: same suit ascending from Ace.
{
  const state = emptyState({
    tableaus: [[card('hearts', 1)], [], [], [], [], [], [], []],
  });
  assert.equal(
    canMove(state, { zone: 'tableau', index: 0, cardIndex: 0 }, { zone: 'foundation', index: 0 }),
    true,
  );
  const afterAce = executeMove(
    state,
    { zone: 'tableau', index: 0, cardIndex: 0 },
    { zone: 'foundation', index: 0 },
  );
  assert.equal(afterAce.foundations.hearts, 1);
}

// Tableau: opposite color, rank one lower.
{
  const state = emptyState({
    tableaus: [[card('spades', 8)], [card('hearts', 7)], [], [], [], [], [], []],
  });
  assert.equal(
    canMove(
      state,
      { zone: 'tableau', index: 1, cardIndex: 0 },
      { zone: 'tableau', index: 0 },
    ),
    true,
  );
}

// Locked free-cell placeholders cannot move (2-cell mode).
{
  const locked = { id: 'locked-2', suit: 'spades', rank: 13, color: 'black' };
  const state = emptyState({
    freeCells: [null, null, locked, locked],
    tableaus: [[card('hearts', 12)], [], [], [], [], [], [], []],
  });
  assert.equal(
    canMove(state, { zone: 'freeCell', index: 2 }, { zone: 'tableau', index: 0 }),
    false,
  );
}

// Hint prefers safe foundation (Ace).
{
  const state = emptyState({
    tableaus: [[card('clubs', 1)], [], [], [], [], [], [], []],
  });
  const hint = getHintMove(state);
  assert.ok(hint, 'ace should produce a hint');
  assert.equal(hint.dest.zone, 'foundation');
}

// Safe auto-move exposes Ace-like ranks.
{
  const state = emptyState({
    freeCells: [card('spades', 1), null, null, null],
  });
  const move = getSafeFoundationMoves(state);
  assert.ok(move, 'freecell ace should be safe to auto-move');
  assert.equal(move.source.zone, 'freeCell');
}

// Win when all foundations reach King.
{
  assert.equal(
    checkWin(
      emptyState({
        foundations: { spades: 13, hearts: 13, diamonds: 13, clubs: 13 },
      }),
    ),
    true,
  );
  assert.equal(checkWin(emptyState()), false);
}

// Same deal seed yields identical cascades.
{
  const a = dealGame(11982);
  const b = dealGame(11982);
  assert.equal(a.seed, 11982);
  assert.deepEqual(
    a.tableaus.map((col) => col.map((c) => c.id)),
    b.tableaus.map((col) => col.map((c) => c.id)),
  );
}

// —— Scoring ——
{
  assert.equal(initialScore(), 0);
  assert.equal(pointsToFoundation(), 10);
  assert.equal(pointsUndo(), -5);
  assert.equal(finishMoveDelta(40, 50), 50); // 10 under × 5
  assert.equal(finishMoveDelta(60, 50), -20); // 10 over × 2
  assert.equal(finishMoveDelta(50, 50), 0);
  assert.equal(finishMoveDelta(40, null), 0);
  assert.ok(classicTimeBonus(70) > 0);
  assert.equal(classicTimeBonus(10), 0);
}

// —— Daily / streak ——
{
  const key = dateKey(new Date('2026-03-15T04:00:00Z')); // Taipei 12:00
  assert.equal(key, '2026-03-15');
  const seedA = dailyBaseSeed('2026-03-15');
  const seedB = dailyBaseSeed('2026-03-16');
  assert.notEqual(seedA, seedB);
  assert.equal(
    computeStreak(
      [
        { date: '2026-03-14', won: true, score: 1, elapsedSec: 1, moves: 1, playMode: 'classic', freeCellSlots: 4 },
        { date: '2026-03-15', won: true, score: 1, elapsedSec: 1, moves: 1, playMode: 'classic', freeCellSlots: 4 },
      ],
      '2026-03-15',
    ),
    2,
  );
  assert.equal(
    computeStreak(
      [{ date: '2026-03-13', won: true, score: 1, elapsedSec: 1, moves: 1, playMode: 'classic', freeCellSlots: 4 }],
      '2026-03-15',
    ),
    0,
  );
}

// —— Challenges ——
{
  const base = {
    won: true,
    usedUndo: false,
    usedFreeCell: false,
    freeCellSlots: 4,
    moves: 50,
    parMoves: 60,
    elapsedSec: 200,
  };
  assert.equal(isChallengeCleared('no-undo', base), true);
  assert.equal(isChallengeCleared('no-freecell', base), true);
  assert.equal(isChallengeCleared('moves-par', base), true);
  assert.equal(isChallengeCleared('two-cells', { ...base, freeCellSlots: 2 }), true);
  assert.equal(isChallengeCleared('two-cells', base), false);
  assert.ok(evaluateChallenges(base).includes('no-undo'));
}

// —— Stats helpers (pure, no localStorage required for modeKey/winRate) ——
{
  assert.equal(modeKey('classic', 4), 'classic-4');
  assert.equal(modeKey('timed', 2), 'timed-2');
  const empty = {
    plays: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    byMode: {},
    byDeal: {},
    challengesCleared: {},
  };
  assert.equal(winRate(empty), 0);
  const after = recordGameResult(empty, {
    won: true,
    playMode: 'classic',
    freeCellSlots: 4,
    seed: 42,
    score: 100,
    elapsedSec: 90,
    moves: 55,
    clearedChallenges: ['no-undo'],
  });
  assert.equal(after.wins, 1);
  assert.equal(after.plays, 1);
  assert.equal(after.byDeal['42']?.bestMoves, 55);
  assert.equal(after.challengesCleared['no-undo'], 1);
}

// —— Difficulty banding ——
{
  assert.equal(classifyDifficulty(40), 'easy');
  assert.equal(classifyDifficulty(60), 'medium');
  assert.equal(classifyDifficulty(90), 'hard');
  assert.equal(classifyDifficulty(null), 'hard');
}

// —— Solver par on a trivial near-won board ——
{
  const almost = emptyState({
    foundations: { spades: 12, hearts: 13, diamonds: 13, clubs: 13 },
    tableaus: [[card('spades', 13)], [], [], [], [], [], [], []],
  });
  const solved = solveSync(almost, { maxNodes: 200 });
  assert.ok(solved, 'near-won board should solve');
  assert.equal(solved.path.length, 1);
  const deal = dealGame(1);
  const par = estimateParMoves(deal.tableaus, { maxNodes: 2000 });
  // May or may not solve within budget; classify must still return a band.
  assert.ok(['easy', 'medium', 'hard'].includes(classifyDifficulty(par)));
}

// dealForDifficulty('any') returns meta for the requested seed.
{
  const meta = dealForDifficulty('any', 42, { maxNodes: 500 }, 1);
  assert.equal(meta.seed, 42);
  assert.ok(['any', 'easy', 'medium', 'hard'].includes(meta.difficulty));
}

console.log('check-freecell: ok');
