// ponytail: draw-1/3, scoring, solvable filter, daily streak, challenges.
import assert from 'node:assert/strict';
import {
  applyDraw,
  canAutoComplete,
  canMoveToFoundation,
  canMoveToTableau,
  findFoundationAutoMove,
  findHint,
  isValidTableauStack,
} from './utils/gameLogic.ts';
import {
  canRecycle,
  initialScore,
  pointsRecycle,
  pointsToFoundation,
  standardTimePenaltyTicks,
  standardWinBonus,
  VEGAS_DEAL_COST,
} from './utils/scoring.ts';
import { buildScriptedSolvable, isSolvable } from './utils/solver.ts';
import { dealDailySolvable, dealGame, findSolvableSeed } from './utils/deck.ts';
import { computeStreak, dailyBaseSeed, dateKey } from './utils/daily.ts';
import { evaluateChallenges, isChallengeCleared } from './utils/challenges.ts';
import { modeKey, recordGameResult, winRate } from './utils/storage.ts';

function card(suit, rank, faceUp = true) {
  const color = suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
  return { id: `${suit}-${rank}`, suit, rank, color, faceUp };
}

// Draw-1 takes one card; Draw-3 takes up to three.
{
  const stock = [card('spades', 'A'), card('hearts', '2'), card('clubs', '3'), card('diamonds', '4')];
  const d1 = applyDraw(stock, [], 1);
  assert.equal(d1.waste.length, 1, 'draw-1 should move one card');
  assert.equal(d1.stock.length, 3, 'draw-1 should leave three in stock');
  assert.equal(d1.waste[0].rank, '4', 'draw pops from end of stock');
  assert.equal(d1.waste[0].faceUp, true, 'drawn card must be face-up');

  const d3 = applyDraw(stock, [], 3);
  assert.equal(d3.waste.length, 3, 'draw-3 should move three cards');
  assert.equal(d3.stock.length, 1, 'draw-3 should leave one in stock');
  assert.equal(d3.waste[2].rank, '2', 'waste top is the last drawn');
}

// Short stock: draw-3 takes remaining cards only.
{
  const stock = [card('spades', 'A'), card('hearts', '2')];
  const drawn = applyDraw(stock, [], 3);
  assert.equal(drawn.waste.length, 2, 'draw-3 with two left should take both');
  assert.equal(drawn.stock.length, 0);
}

// Foundation / tableau legality.
{
  assert.equal(canMoveToFoundation(card('hearts', 'A'), undefined), true);
  assert.equal(canMoveToFoundation(card('hearts', '2'), undefined), false);
  assert.equal(canMoveToFoundation(card('hearts', '2'), card('hearts', 'A')), true);
  assert.equal(canMoveToFoundation(card('spades', '2'), card('hearts', 'A')), false);

  assert.equal(canMoveToTableau(card('spades', 'K'), undefined), true);
  assert.equal(canMoveToTableau(card('hearts', 'Q'), undefined), false);
  assert.equal(canMoveToTableau(card('hearts', 'Q'), card('spades', 'K')), true);
  assert.equal(canMoveToTableau(card('clubs', 'Q'), card('spades', 'K')), false);
}

// Valid descending alternating stack.
{
  const col = [card('spades', 'K'), card('hearts', 'Q'), card('clubs', 'J')];
  assert.equal(isValidTableauStack(col, 0), true);
  assert.equal(isValidTableauStack(col, 1), true);
  const broken = [card('spades', 'K'), card('clubs', 'Q')];
  assert.equal(isValidTableauStack(broken, 0), false);
}

// Hint prefers foundation from tableau.
{
  const state = {
    tableau: [[card('hearts', 'A')], [], [], [], [], [], []],
    foundation: [[], [], [], []],
    stock: [],
    waste: [],
  };
  const hint = findHint(state);
  assert.ok(hint && hint.kind === 'move', 'ace on tableau should hint foundation');
  assert.equal(hint.target.type, 'foundation');
  assert.equal(hint.source.type, 'tableau');
}

// Hint draws when nothing else is playable.
{
  const state = {
    tableau: [[], [], [], [], [], [], []],
    foundation: [[], [], [], []],
    stock: [card('spades', '5', false)],
    waste: [],
  };
  const hint = findHint(state);
  assert.deepEqual(hint, { kind: 'draw' });
}

// Auto-complete ready only when all tableau cards are face-up.
{
  assert.equal(canAutoComplete([[card('hearts', '5')], [card('spades', '6')]]), true);
  assert.equal(canAutoComplete([[card('hearts', '5', false)], [card('spades', '6')]]), false);
}

// Foundation auto-move picks waste ace.
{
  const state = {
    tableau: [[], [], [], [], [], [], []],
    foundation: [[], [], [], []],
    stock: [],
    waste: [card('clubs', 'A')],
  };
  const move = findFoundationAutoMove(state);
  assert.ok(move, 'waste ace should auto-move to foundation');
  assert.equal(move.source.type, 'waste');
  assert.equal(move.foundationIndex, 0);
}

// —— Scoring ——
{
  assert.equal(initialScore('standard'), 0);
  assert.equal(initialScore('vegas'), -VEGAS_DEAL_COST);
  assert.equal(pointsToFoundation('standard'), 10);
  assert.equal(pointsToFoundation('vegas'), 5);
  assert.equal(pointsRecycle('standard', 1), -100);
  assert.equal(pointsRecycle('standard', 3), -20);
  assert.equal(canRecycle('vegas', 1, 0), false);
  assert.equal(canRecycle('vegas', 3, 0), true);
  assert.equal(canRecycle('vegas', 3, 2), false);
  assert.equal(canRecycle('standard', 1, 99), true);

  const tick = standardTimePenaltyTicks(25, 0);
  assert.equal(tick.penalty, -4);
  assert.equal(tick.appliedThroughSec, 20);
  assert.ok(standardWinBonus(70) > 0);
  assert.equal(standardWinBonus(10), 0);
}

// —— Seeded deal determinism ——
{
  const a = dealGame(11982);
  const b = dealGame(11982);
  assert.equal(a.seed, 11982);
  assert.deepEqual(
    a.tableau.map((col) => col.map((c) => c.id)),
    b.tableau.map((col) => col.map((c) => c.id)),
  );
}

// —— Guaranteed solvable (scripted) ——
{
  const scripted = buildScriptedSolvable(7);
  assert.equal(
    scripted.tableau.reduce((n, c) => n + c.length, 0),
    28,
  );
  assert.equal(scripted.stock.length, 24);
  assert.equal(isSolvable(scripted, 1, { maxNodes: 5_000 }), true);
}

// —— Filter finds a solvable seed or reports guaranteed fallback ——
{
  const found = findSolvableSeed(1, {
    drawCount: 1,
    maxAttempts: 8,
    solve: { maxNodes: 8_000 },
  });
  assert.ok(found.seed >= 0);
  assert.ok(found.kind === 'filtered' || found.kind === 'guaranteed');
  const daily = dealDailySolvable(dailyBaseSeed('2099-01-01'), 1);
  assert.equal(isSolvable(daily, 1, { maxNodes: 20_000 }), true);
}

// —— Daily streak (Taipei date key shape) ——
{
  const today = dateKey(new Date('2026-10-19T04:00:00Z')); // UTC+8 → 2026-10-19
  assert.equal(today, '2026-10-19');
  const records = [
    { date: '2026-10-19', won: true, score: 1, elapsedSec: 1, moves: 1, drawCount: 1, scoreMode: 'standard' },
    { date: '2026-10-18', won: true, score: 1, elapsedSec: 1, moves: 1, drawCount: 1, scoreMode: 'standard' },
    { date: '2026-10-16', won: true, score: 1, elapsedSec: 1, moves: 1, drawCount: 1, scoreMode: 'standard' },
  ];
  assert.equal(computeStreak(records, '2026-10-19'), 2);
}

// —— Challenges ——
{
  const base = {
    won: true,
    usedUndo: false,
    moves: 90,
    elapsedSec: 200,
    score: 320,
    scoreMode: 'standard',
  };
  assert.equal(isChallengeCleared('no-undo', base), true);
  assert.equal(isChallengeCleared('moves-80', base), false);
  assert.equal(isChallengeCleared('moves-120', base), true);
  assert.equal(isChallengeCleared('standard-300', base), true);
  assert.equal(isChallengeCleared('vegas-profit', { ...base, scoreMode: 'vegas', score: 10 }), true);
  const cleared = evaluateChallenges(base);
  assert.ok(cleared.includes('no-undo'));
  assert.ok(cleared.includes('standard-300'));
}

// —— Stats helpers (no localStorage required for pure bits) ——
{
  assert.equal(modeKey(1, 'vegas'), '1-vegas');
  const empty = {
    plays: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    vegasBankroll: 0,
    byMode: {},
    challengesCleared: {},
  };
  assert.equal(winRate(empty), 0);
  // recordGameResult needs localStorage — skip if unavailable.
  if (typeof localStorage !== 'undefined') {
    const next = recordGameResult(empty, {
      won: true,
      drawCount: 1,
      scoreMode: 'standard',
      score: 100,
      elapsedSec: 40,
      moves: 50,
      clearedChallenges: ['no-undo'],
    });
    assert.equal(next.wins, 1);
    assert.equal(next.currentStreak, 1);
  }
}

console.log('check-klondike: ok');
