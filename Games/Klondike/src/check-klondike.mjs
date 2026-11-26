// Klondike Solitaire Comprehensive Verification Suite
// Deep coverage for Draw-1/3 mechanics, Vegas scoring and bankroll, Undo penalty and clamp,
// auto-complete safety, solvable deal seed search and determinism, Taipei daily streak,
// challenge achievements, card physics fan layout, Web Audio contracts, and Cockpit telemetry.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  applyDraw,
  canAutoComplete,
  canMoveToFoundation,
  canMoveToTableau,
  findFoundationAutoMove,
  findFoundationIndex,
  findHint,
  foundationTop,
  isFoundationMoveSafe,
  isGameWon,
  isValidTableauStack,
  rankValues,
} from './utils/gameLogic.ts';
import {
  applyScoreDelta,
  canRecycle,
  clampScore,
  initialScore,
  maxRecycles,
  pointsFromFoundation,
  pointsRecycle,
  pointsReveal,
  pointsToFoundation,
  pointsUndo,
  pointsWasteToTableau,
  scoreLabel,
  standardTimePenaltyTicks,
  standardWinBonus,
  VEGAS_DEAL_COST,
  VEGAS_FOUNDATION_PAYOUT,
} from './utils/scoring.ts';
import {
  buildGuaranteedDeal,
  buildScriptedSolvable,
  isSolvable,
  toThoughtful,
} from './utils/solver.ts';
import {
  createDeck,
  dealDailySolvable,
  dealGame,
  dealSolvableGame,
  findSolvableSeed,
  shuffleDeck,
} from './utils/deck.ts';
import {
  computeStreak,
  dailyBaseSeed,
  dailySeedCode,
  dateKey,
  todaysBest,
} from './utils/daily.ts';
import {
  CHALLENGES,
  evaluateChallenges,
  isChallengeCleared,
} from './utils/challenges.ts';
import {
  loadDaily,
  loadSettings,
  loadStats,
  modeKey,
  recordDaily,
  recordGameResult,
  saveSettings,
  saveStats,
  winRate,
} from './utils/storage.ts';
import {
  buildDailyShareText,
  dailyRecordToShare,
} from './utils/share.ts';
import { KL_FAN } from './layoutFan.mjs';
import { klondikeAudio } from './utils/klondikeAudio.ts';
import {
  getStockTelemetry,
  getHiddenCardsTelemetry,
  getFoundationTelemetry,
  computeMovableAnalysis,
  getVegasYieldTelemetry,
  getMasterAdvice,
  getStockXRayTelemetry,
  getFoundationVelocityTelemetry,
  getStepEfficiencyTelemetry,
} from './utils/cockpitAnalysis.ts';

function card(suit, rank, faceUp = true) {
  const color = suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
  return { id: `${suit}-${rank}`, suit, rank, color, faceUp };
}

// ============================================================================
// 1. Core Mechanics: Draw-1 & Draw-3, Popping Order, and Edge Cases
// ============================================================================
{
  const stock = [card('spades', 'A'), card('hearts', '2'), card('clubs', '3'), card('diamonds', '4')];
  const d1 = applyDraw(stock, [], 1);
  assert.equal(d1.waste.length, 1, 'draw-1 moves exactly one card');
  assert.equal(d1.stock.length, 3, 'draw-1 leaves three cards in stock');
  assert.equal(d1.waste[0].rank, '4', 'draw pops from the end of stock array');
  assert.equal(d1.waste[0].faceUp, true, 'drawn card is flipped face-up');

  const d3 = applyDraw(stock, [], 3);
  assert.equal(d3.waste.length, 3, 'draw-3 moves three cards');
  assert.equal(d3.stock.length, 1, 'draw-3 leaves one card in stock');
  assert.equal(d3.waste[0].rank, '4', 'first drawn card pushed to waste');
  assert.equal(d3.waste[1].rank, '3', 'second drawn card');
  assert.equal(d3.waste[2].rank, '2', 'waste top card is the last drawn card');

  // Consecutive draws accumulating onto existing waste
  const d3_accum = applyDraw(d3.stock, d3.waste, 3);
  assert.equal(d3_accum.waste.length, 4, 'draw from 1 remaining card appends to waste');
  assert.equal(d3_accum.stock.length, 0, 'stock emptied');
  assert.equal(d3_accum.waste[3].rank, 'A', 'last drawn card becomes waste top');

  // Drawing from empty stock
  const d_empty = applyDraw([], d3_accum.waste, 3);
  assert.equal(d_empty.stock.length, 0);
  assert.equal(d_empty.waste.length, 4, 'drawing from empty stock leaves waste intact');

  // Draw-3 with exact count (3 cards)
  const exact3 = [card('spades', '10'), card('hearts', 'J'), card('diamonds', 'Q')];
  const d_exact = applyDraw(exact3, [], 3);
  assert.equal(d_exact.stock.length, 0);
  assert.equal(d_exact.waste.length, 3);
  assert.equal(d_exact.waste[2].rank, '10');
}

// ============================================================================
// 2. Foundation & Tableau Legality & Descending Alternating Stacks
// ============================================================================
{
  // Foundation placement
  assert.equal(canMoveToFoundation(card('hearts', 'A'), undefined), true, 'empty foundation accepts Ace');
  assert.equal(canMoveToFoundation(card('spades', 'A'), undefined), true, 'empty foundation accepts any Ace');
  assert.equal(canMoveToFoundation(card('hearts', '2'), undefined), false, 'empty foundation rejects 2');
  assert.equal(canMoveToFoundation(card('hearts', 'K'), undefined), false, 'empty foundation rejects King');

  assert.equal(canMoveToFoundation(card('hearts', '2'), card('hearts', 'A')), true, 'same suit ascending +1');
  assert.equal(canMoveToFoundation(card('hearts', '3'), card('hearts', 'A')), false, 'cannot skip rank');
  assert.equal(canMoveToFoundation(card('spades', '2'), card('hearts', 'A')), false, 'rejects suit mismatch');
  assert.equal(canMoveToFoundation(card('diamonds', '2'), card('hearts', 'A')), false, 'same color different suit rejected');
  assert.equal(canMoveToFoundation(card('hearts', 'A'), card('hearts', '2')), false, 'cannot descend in foundation');

  // Tableau placement
  assert.equal(canMoveToTableau(card('spades', 'K'), undefined), true, 'empty tableau accepts King');
  assert.equal(canMoveToTableau(card('hearts', 'K'), undefined), true, 'empty tableau accepts red King');
  assert.equal(canMoveToTableau(card('hearts', 'Q'), undefined), false, 'empty tableau rejects Queen');
  assert.equal(canMoveToTableau(card('clubs', 'A'), undefined), false, 'empty tableau rejects Ace');

  assert.equal(canMoveToTableau(card('hearts', 'Q'), card('spades', 'K')), true, 'red Queen on black King');
  assert.equal(canMoveToTableau(card('diamonds', 'Q'), card('clubs', 'K')), true, 'red Queen on black King');
  assert.equal(canMoveToTableau(card('clubs', 'Q'), card('spades', 'K')), false, 'same color black on black rejected');
  assert.equal(canMoveToTableau(card('hearts', 'Q'), card('diamonds', 'K')), false, 'same color red on red rejected');
  assert.equal(canMoveToTableau(card('hearts', 'J'), card('spades', 'K')), false, 'cannot skip rank on tableau');
  assert.equal(canMoveToTableau(card('hearts', 'K'), card('spades', 'Q')), false, 'cannot place higher rank');

  // Valid descending alternating stacks
  const col = [card('spades', 'K'), card('hearts', 'Q'), card('clubs', 'J'), card('diamonds', '10')];
  assert.equal(isValidTableauStack(col, 0), true, 'full valid stack');
  assert.equal(isValidTableauStack(col, 1), true, 'sub-stack from Q');
  assert.equal(isValidTableauStack(col, 2), true, 'sub-stack from J');
  assert.equal(isValidTableauStack(col, 3), true, 'single card stack');

  // Invalid stacks: same color adjacent
  const brokenColor = [card('spades', 'K'), card('clubs', 'Q')];
  assert.equal(isValidTableauStack(brokenColor, 0), false, 'color collision');

  // Invalid stacks: rank gap
  const brokenRank = [card('spades', 'K'), card('hearts', 'J')];
  assert.equal(isValidTableauStack(brokenRank, 0), false, 'rank gap');

  // Invalid stacks: face-down card within stack
  const hiddenInside = [card('spades', 'K'), card('hearts', 'Q', false), card('clubs', 'J')];
  assert.equal(isValidTableauStack(hiddenInside, 0), false, 'face-down card invalidates stack');
  assert.equal(isValidTableauStack(hiddenInside, 2), true, 'starting past face-down card is valid');

  // Rank values mapping check
  assert.equal(rankValues['A'], 1);
  assert.equal(rankValues['10'], 10);
  assert.equal(rankValues['J'], 11);
  assert.equal(rankValues['Q'], 12);
  assert.equal(rankValues['K'], 13);
}

// ============================================================================
// 3. Hinting, Foundation Auto-Move & Win State
// ============================================================================
{
  const stateA = {
    tableau: [[card('hearts', 'A')], [], [], [], [], [], []],
    foundation: [[], [], [], []],
    stock: [],
    waste: [],
  };
  const hintA = findHint(stateA);
  assert.ok(hintA && hintA.kind === 'move', 'tableau Ace hints foundation move');
  assert.equal(hintA.target.type, 'foundation');
  assert.equal(hintA.source.type, 'tableau');

  // Waste Ace auto-move to foundation
  const stateB = {
    tableau: [[], [], [], [], [], [], []],
    foundation: [[], [], [], []],
    stock: [],
    waste: [card('clubs', 'A')],
  };
  const moveB = findFoundationAutoMove(stateB);
  assert.ok(moveB, 'waste Ace auto-moves to foundation');
  assert.equal(moveB.source.type, 'waste');
  assert.equal(moveB.foundationIndex, 0);

  // Hint draws when tableau is empty and stock has cards
  const stateDraw = {
    tableau: [[], [], [], [], [], [], []],
    foundation: [[], [], [], []],
    stock: [card('spades', '5', false)],
    waste: [],
  };
  assert.deepEqual(findHint(stateDraw), { kind: 'draw' });

  // Hint recycles when stock is empty and waste has cards
  const stateRecycle = {
    tableau: [[], [], [], [], [], [], []],
    foundation: [[], [], [], []],
    stock: [],
    waste: [card('spades', '5')],
  };
  assert.deepEqual(findHint(stateRecycle), { kind: 'recycle' });

  // Win condition: all 4 foundations have 13 cards
  const winFoundation = [
    Array.from({ length: 13 }, (_, i) => card('spades', Object.keys(rankValues)[i])),
    Array.from({ length: 13 }, (_, i) => card('hearts', Object.keys(rankValues)[i])),
    Array.from({ length: 13 }, (_, i) => card('diamonds', Object.keys(rankValues)[i])),
    Array.from({ length: 13 }, (_, i) => card('clubs', Object.keys(rankValues)[i])),
  ];
  assert.equal(isGameWon(winFoundation), true, 'all 4 completed foundations wins the game');

  const incompleteFoundation = [
    winFoundation[0],
    winFoundation[1],
    winFoundation[2],
    winFoundation[3].slice(0, 12),
  ];
  assert.equal(isGameWon(incompleteFoundation), false, 'missing King is not won');
}

// ============================================================================
// 4. Foundation Auto-Complete Safety & Premature Move Prevention
// ============================================================================
{
  // canAutoComplete: only true when EVERY tableau card is face-up
  assert.equal(canAutoComplete([[card('hearts', '5')], [card('spades', '6')]]), true);
  assert.equal(canAutoComplete([[card('hearts', '5', false)], [card('spades', '6')]]), false);
  assert.equal(canAutoComplete([[], [], [], [], [], [], []]), true, 'empty tableau is auto-completable');

  const mixedTableau = [
    [card('spades', 'K', false), card('hearts', 'Q')],
    [card('diamonds', '10')],
    [],
    [],
    [],
    [],
    [],
  ];
  assert.equal(canAutoComplete(mixedTableau), false, 'face-down card in col 0 blocks auto-complete');

  // isFoundationMoveSafe:
  // Rule 1: Ace and 2 are ALWAYS unconditionally safe, even with face-down cards
  const emptyFoundation = [[], [], [], []];
  assert.equal(isFoundationMoveSafe(card('hearts', 'A'), emptyFoundation, mixedTableau), true, 'Ace is always safe');
  assert.equal(isFoundationMoveSafe(card('spades', 'A'), emptyFoundation, mixedTableau), true, 'Ace is always safe');
  assert.equal(isFoundationMoveSafe(card('hearts', '2'), emptyFoundation, mixedTableau), true, '2 is always safe');
  assert.equal(isFoundationMoveSafe(card('diamonds', '2'), emptyFoundation, mixedTableau), true, '2 is always safe');

  // Rule 2: Rank >= 3 is safe if BOTH opposite-color foundations have reached at least rank - 1.
  // For 3 of Spades (black 3), requires both Red foundations (hearts, diamonds) >= 2.
  const foundationRedLow = [
    [card('hearts', 'A')], // hearts at rank 1
    [card('diamonds', 'A'), card('diamonds', '2')], // diamonds at rank 2
    [],
    [],
  ];
  assert.equal(
    isFoundationMoveSafe(card('spades', '3'), foundationRedLow, mixedTableau),
    false,
    '3 of spades unsafe when hearts foundation is only at rank 1',
  );

  const foundationRedReady = [
    [card('hearts', 'A'), card('hearts', '2')], // hearts at rank 2
    [card('diamonds', 'A'), card('diamonds', '2')], // diamonds at rank 2
    [],
    [],
  ];
  assert.equal(
    isFoundationMoveSafe(card('spades', '3'), foundationRedReady, mixedTableau),
    true,
    '3 of spades safe when both red foundations have reached rank 2',
  );

  // For 5 of Diamonds (red 5), requires both Black foundations (spades, clubs) >= 4.
  const foundationBlackPartial = [
    [card('spades', 'A'), card('spades', '2'), card('spades', '3'), card('spades', '4')], // spades rank 4
    [card('clubs', 'A'), card('clubs', '2'), card('clubs', '3')], // clubs rank 3
    [],
    [],
  ];
  assert.equal(
    isFoundationMoveSafe(card('diamonds', '5'), foundationBlackPartial, mixedTableau),
    false,
    '5 of diamonds unsafe because clubs foundation is only at 3 (< 4)',
  );

  const foundationBlackFull = [
    [card('spades', 'A'), card('spades', '2'), card('spades', '3'), card('spades', '4')],
    [card('clubs', 'A'), card('clubs', '2'), card('clubs', '3'), card('clubs', '4')],
    [],
    [],
  ];
  assert.equal(
    isFoundationMoveSafe(card('diamonds', '5'), foundationBlackFull, mixedTableau),
    true,
    '5 of diamonds safe because both black foundations are at rank 4',
  );

  // Rule 3: If all tableau cards are face-up, ANY card can safely move to foundation
  const allFaceUpTableau = [
    [card('hearts', 'K'), card('spades', 'Q')],
    [card('diamonds', 'J')],
  ];
  assert.equal(
    isFoundationMoveSafe(card('diamonds', '5'), emptyFoundation, allFaceUpTableau),
    true,
    'all tableau cards face-up guarantees all foundation moves are safe',
  );
}

// ============================================================================
// 5. Vegas Mode: Cumulative Balance, Deal Cost ($52), Recycling Passes & Payouts
// ============================================================================
{
  // Deal cost and base points
  assert.equal(VEGAS_DEAL_COST, 52);
  assert.equal(VEGAS_FOUNDATION_PAYOUT, 5);
  assert.equal(initialScore('vegas'), -52, 'vegas opening score is -$52');
  assert.equal(initialScore('standard'), 0, 'standard opening score is 0');
  assert.equal(pointsToFoundation('vegas'), 5, 'vegas pays +$5 per foundation card');
  assert.equal(pointsToFoundation('standard'), 10, 'standard pays +10');
  assert.equal(pointsWasteToTableau('vegas'), 0, 'vegas awards 0 for waste to tableau');
  assert.equal(pointsWasteToTableau('standard'), 5, 'standard awards +5');
  assert.equal(pointsReveal('vegas'), 0, 'vegas awards 0 for revealing hidden cards');
  assert.equal(pointsReveal('standard'), 5, 'standard awards +5');
  assert.equal(pointsFromFoundation('vegas'), 0, 'vegas no penalty from foundation');
  assert.equal(pointsFromFoundation('standard'), -15, 'standard penalizes -15');
  assert.equal(pointsUndo('vegas'), 0, 'vegas undo tax is 0');
  assert.equal(pointsUndo('standard'), -2, 'standard undo tax is -2');
  assert.equal(scoreLabel('vegas'), '維加斯');
  assert.equal(scoreLabel('standard'), '標準');

  // Payout calculation boundaries
  const calcVegasScore = (cardsOnFoundation) => -VEGAS_DEAL_COST + cardsOnFoundation * VEGAS_FOUNDATION_PAYOUT;
  assert.equal(calcVegasScore(0), -52, '0 cards on foundation = -$52 net');
  assert.equal(calcVegasScore(5), -27, '5 cards on foundation = -$27 net');
  assert.equal(calcVegasScore(10), -2, '10 cards on foundation = -$2 (just shy of break-even)');
  assert.equal(calcVegasScore(11), 3, '11 cards on foundation = +$3 (break-even reached)');
  assert.equal(calcVegasScore(20), 48, '20 cards on foundation = +$48');
  assert.equal(calcVegasScore(52), 208, '52 cards cleared = +$208 net profit ($260 payout - $52 deal cost)');

  // Recycling pass limits
  // Draw-1: 1 pass only (0 recycles allowed)
  assert.equal(maxRecycles('vegas', 1), 0, 'vegas draw-1 allows 0 recycles (1 pass total)');
  assert.equal(canRecycle('vegas', 1, 0), false, 'vegas draw-1 cannot recycle after pass 1');
  assert.equal(canRecycle('vegas', 1, 1), false);

  // Draw-3: 3 passes total (2 recycles allowed)
  assert.equal(maxRecycles('vegas', 3), 2, 'vegas draw-3 allows 2 recycles (3 passes total)');
  assert.equal(canRecycle('vegas', 3, 0), true, 'first recycle permitted (starts pass 2)');
  assert.equal(canRecycle('vegas', 3, 1), true, 'second recycle permitted (starts pass 3)');
  assert.equal(canRecycle('vegas', 3, 2), false, 'third recycle forbidden (3 passes completed)');
  assert.equal(canRecycle('vegas', 3, 3), false);

  // Standard mode: infinite recycles allowed (with penalty)
  assert.equal(maxRecycles('standard', 1), null, 'standard draw-1 allows infinite passes');
  assert.equal(maxRecycles('standard', 3), null, 'standard draw-3 allows infinite passes');
  assert.equal(canRecycle('standard', 1, 999), true);
  assert.equal(canRecycle('standard', 3, 999), true);
  assert.equal(pointsRecycle('standard', 1), -100, 'standard draw-1 penalty is -100');
  assert.equal(pointsRecycle('standard', 3), -20, 'standard draw-3 penalty is -20');
  assert.equal(pointsRecycle('vegas', 1), 0, 'vegas recycle penalty is 0 (passes strictly limited)');
  assert.equal(pointsRecycle('vegas', 3), 0);

  // Cumulative bankroll tracking across games
  let stats = {
    plays: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    vegasBankroll: 0,
    byMode: {},
    challengesCleared: {},
  };

  // Game 1: Vegas loss with 4 cards on foundation (score: -32)
  stats = recordGameResult(stats, {
    won: false,
    drawCount: 3,
    scoreMode: 'vegas',
    score: -32,
    elapsedSec: 120,
    moves: 45,
    clearedChallenges: [],
  });
  assert.equal(stats.vegasBankroll, -32, 'bankroll tracks -$32');
  assert.equal(stats.plays, 1);
  assert.equal(stats.wins, 0);

  // Game 2: Vegas profit with 15 cards on foundation (score: +23)
  stats = recordGameResult(stats, {
    won: false,
    drawCount: 3,
    scoreMode: 'vegas',
    score: 23,
    elapsedSec: 180,
    moves: 70,
    clearedChallenges: [],
  });
  assert.equal(stats.vegasBankroll, -9, 'bankroll adds +23 -> -$9');

  // Game 3: Vegas full clear win (score: +208)
  stats = recordGameResult(stats, {
    won: true,
    drawCount: 1,
    scoreMode: 'vegas',
    score: 208,
    elapsedSec: 250,
    moves: 85,
    clearedChallenges: ['vegas-profit'],
  });
  assert.equal(stats.vegasBankroll, 199, 'bankroll adds +208 -> +$199');
  assert.equal(stats.wins, 1);
  assert.equal(stats.currentStreak, 1);

  // Game 4: Standard game played (score: 450) - bankroll must NOT change!
  stats = recordGameResult(stats, {
    won: true,
    drawCount: 1,
    scoreMode: 'standard',
    score: 450,
    elapsedSec: 160,
    moves: 75,
    clearedChallenges: ['standard-300'],
  });
  assert.equal(stats.vegasBankroll, 199, 'standard games do not mutate vegas bankroll');
  assert.equal(stats.wins, 2);
  assert.equal(stats.currentStreak, 2);

  // Game 5: Vegas immediate fold (score: -52)
  stats = recordGameResult(stats, {
    won: false,
    drawCount: 1,
    scoreMode: 'vegas',
    score: -52,
    elapsedSec: 10,
    moves: 2,
    clearedChallenges: [],
  });
  assert.equal(stats.vegasBankroll, 147, 'bankroll subtracts -$52 -> +$147');
  assert.equal(stats.currentStreak, 0, 'streak reset on loss');

  // Game 6: Pure skill win increments pureStreak
  stats = recordGameResult(stats, {
    won: true,
    drawCount: 1,
    scoreMode: 'standard',
    score: 300,
    elapsedSec: 120,
    moves: 60,
    usedReshuffle: false,
    clearedChallenges: ['pure-skill'],
  });
  assert.equal(stats.currentStreak, 1);
  assert.equal(stats.pureStreak, 1);

  // Game 7: Win with reshuffle preserves normal streak but resets pureStreak to 0
  stats = recordGameResult(stats, {
    won: true,
    drawCount: 1,
    scoreMode: 'standard',
    score: 300,
    elapsedSec: 120,
    moves: 60,
    usedReshuffle: true,
    clearedChallenges: [],
  });
  assert.equal(stats.currentStreak, 2, 'normal win streak advances to 2');
  assert.equal(stats.pureStreak, 0, 'pureStreak resets to 0 when reshuffle was used');
}

// ============================================================================
// 6. Undo Score Penalty Math & Boundary Clamping (Score >= 0 Clamp)
// ============================================================================
{
  // clampScore: Standard score clamped >= 0, Vegas unconstrained
  assert.equal(clampScore(150, 'standard'), 150);
  assert.equal(clampScore(1, 'standard'), 1);
  assert.equal(clampScore(0, 'standard'), 0);
  assert.equal(clampScore(-1, 'standard'), 0, 'standard clamps negative to 0');
  assert.equal(clampScore(-2, 'standard'), 0, 'standard clamps -2 tax to 0');
  assert.equal(clampScore(-52, 'standard'), 0, 'standard clamps -52 to 0');
  assert.equal(clampScore(-100, 'standard'), 0, 'standard clamps recycle penalty to 0');

  assert.equal(clampScore(150, 'vegas'), 150);
  assert.equal(clampScore(0, 'vegas'), 0);
  assert.equal(clampScore(-1, 'vegas'), -1, 'vegas preserves negative scores');
  assert.equal(clampScore(-52, 'vegas'), -52, 'vegas preserves initial -$52');
  assert.equal(clampScore(-100, 'vegas'), -100);

  // applyScoreDelta helper
  assert.equal(applyScoreDelta(10, -2, 'standard'), 8, 'standard undo tax drops 10 -> 8');
  assert.equal(applyScoreDelta(1, -2, 'standard'), 0, 'standard undo tax clamps 1 -> 0');
  assert.equal(applyScoreDelta(0, -2, 'standard'), 0, 'standard undo at 0 stays at 0');
  assert.equal(applyScoreDelta(10, -20, 'standard'), 0, 'draw-3 recycle clamps 10 -> 0');
  assert.equal(applyScoreDelta(50, -100, 'standard'), 0, 'draw-1 recycle clamps 50 -> 0');
  assert.equal(applyScoreDelta(10, -15, 'standard'), 0, 'foundation return clamps 10 -> 0');
  assert.equal(applyScoreDelta(25, -15, 'standard'), 10, 'foundation return drops 25 -> 10');

  assert.equal(applyScoreDelta(-52, 5, 'vegas'), -47, 'vegas foundation move -52 -> -47');
  assert.equal(applyScoreDelta(-52, 0, 'vegas'), -52, 'vegas undo tax 0 keeps score at -52');

  // Timed scoring penalty ticks and clamps
  const tick1 = standardTimePenaltyTicks(25, 0);
  assert.equal(tick1.penalty, -4, '25s passed -> 2 ticks (-4 pts)');
  assert.equal(tick1.appliedThroughSec, 20);
  assert.equal(applyScoreDelta(2, tick1.penalty, 'standard'), 0, 'time penalty clamps at 0');

  const tick2 = standardTimePenaltyTicks(28, 20);
  assert.equal(tick2.penalty, 0, 'no new 10s tick passed');
  assert.equal(tick2.appliedThroughSec, 20);

  const tick3 = standardTimePenaltyTicks(62, 20);
  assert.equal(tick3.penalty, -8, 'jumped 40s -> 4 ticks (-8 pts)');
  assert.equal(tick3.appliedThroughSec, 60);

  // Standard win bonus formula
  assert.equal(standardWinBonus(0), 0);
  assert.equal(standardWinBonus(29), 0, 'no bonus under 30 seconds');
  assert.equal(standardWinBonus(30), 23333, 'floor(700000 / 30)');
  assert.equal(standardWinBonus(70), 10000, 'floor(700000 / 70)');
  assert.equal(standardWinBonus(350), 2000, 'floor(700000 / 350)');

  // Simulation of multi-step Undo with score clamping
  let simScore = 0;
  const history = [];

  // Step 1: Waste to tableau (+5)
  history.push({ score: simScore });
  simScore = applyScoreDelta(simScore, pointsWasteToTableau('standard'), 'standard');
  assert.equal(simScore, 5);

  // Step 2: Foundation play (+10)
  history.push({ score: simScore });
  simScore = applyScoreDelta(simScore, pointsToFoundation('standard'), 'standard');
  assert.equal(simScore, 15);

  // Undo Step 2: Revert +10 and apply pointsUndo (-2)
  const meta2 = history.pop();
  simScore = applyScoreDelta(meta2.score, pointsUndo('standard'), 'standard');
  assert.equal(simScore, 3, 'reverts to 5 then -2 tax -> 3');

  // Undo Step 1: Revert +5 and apply pointsUndo (-2)
  const meta1 = history.pop();
  simScore = applyScoreDelta(meta1.score, pointsUndo('standard'), 'standard');
  assert.equal(simScore, 0, 'reverts to 0 and -2 tax clamped -> 0');

  // Additional undo attempt on empty history
  assert.equal(history.length, 0);
  assert.equal(simScore, 0, 'score remained clamped at 0');
}

// ============================================================================
// 7. Solvable Deal Seed Generator: Search, Determinism & Fallback Behavior
// ============================================================================
{
  // Standard deck creation invariants
  const deck = createDeck();
  assert.equal(deck.length, 52, 'standard deck must have 52 cards');
  const suitCounts = deck.reduce((acc, c) => ({ ...acc, [c.suit]: (acc[c.suit] || 0) + 1 }), {});
  assert.deepEqual(suitCounts, { hearts: 13, diamonds: 13, clubs: 13, spades: 13 });

  // dealGame determinism: same seed yields exact same layout
  const dealA = dealGame(424242);
  const dealB = dealGame(424242);
  assert.equal(dealA.seed, 424242);
  assert.equal(dealB.seed, 424242);
  assert.deepEqual(
    dealA.tableau.map((col) => col.map((c) => c.id)),
    dealB.tableau.map((col) => col.map((c) => c.id)),
    'tableau cards match identically for same seed',
  );
  assert.deepEqual(
    dealA.stock.map((c) => c.id),
    dealB.stock.map((c) => c.id),
    'stock order matches identically for same seed',
  );

  // Layout structural invariants
  assert.equal(dealA.tableau.length, 7, 'tableau has 7 columns');
  for (let c = 0; c < 7; c++) {
    assert.equal(dealA.tableau[c].length, c + 1, `column ${c} has ${c + 1} cards`);
    for (let r = 0; r < c; r++) {
      assert.equal(dealA.tableau[c][r].faceUp, false, `column ${c} card ${r} is face-down`);
    }
    assert.equal(dealA.tableau[c][c].faceUp, true, `column ${c} top card is face-up`);
  }
  const totalTableauCards = dealA.tableau.reduce((sum, col) => sum + col.length, 0);
  assert.equal(totalTableauCards, 28, 'tableau has 28 cards (1+2+3+4+5+6+7)');
  assert.equal(dealA.stock.length, 24, 'stock has 24 cards (52 - 28)');
  assert.equal(dealA.waste.length, 0, 'waste starts empty');
  assert.equal(dealA.foundation.every((p) => p.length === 0), true, 'foundations start empty');

  // Scripted solvable deal generator
  const scripted = buildScriptedSolvable(777);
  assert.equal(scripted.tableau.reduce((sum, col) => sum + col.length, 0), 28);
  assert.equal(scripted.stock.length, 24);
  assert.equal(isSolvable(scripted, 1, { maxNodes: 5_000 }), true, 'scripted layout is proven solvable');

  // Reverse-built guaranteed deal validates solvability against active drawCount (1 and 3)
  const guaranteed = buildGuaranteedDeal(999, 1);
  assert.equal(guaranteed.tableau.reduce((sum, col) => sum + col.length, 0), 28);
  assert.equal(guaranteed.stock.length, 24);
  assert.equal(isSolvable(guaranteed, 1, { maxNodes: 8_000 }), true, 'guaranteed deal is solvable under Draw-1');

  const guaranteed3 = buildGuaranteedDeal(999, 3);
  assert.equal(guaranteed3.tableau.reduce((sum, col) => sum + col.length, 0), 28);
  assert.equal(guaranteed3.stock.length, 24);
  assert.equal(isSolvable(guaranteed3, 3, { maxNodes: 8_000 }), true, 'guaranteed deal is solvable under Draw-3');

  // findSolvableSeed search & determinism
  const foundSearch = findSolvableSeed(100, {
    drawCount: 1,
    maxAttempts: 12,
    solve: { maxNodes: 8_000 },
  });
  assert.ok(foundSearch.seed >= 100);
  assert.ok(foundSearch.attempts >= 1 && foundSearch.attempts <= 12);
  assert.ok(foundSearch.kind === 'filtered' || foundSearch.kind === 'guaranteed');

  // Fallback behavior when maxAttempts exceeded without a match
  const fallbackResult = findSolvableSeed(12345, {
    drawCount: 1,
    maxAttempts: 1,
    solve: { maxNodes: 1 }, // impossible node limit
  });
  assert.equal(fallbackResult.kind, 'guaranteed', 'falls back to guaranteed generator');
  assert.equal(fallbackResult.attempts, 1);
  assert.equal(fallbackResult.seed, 12345);

  // dealSolvableGame and dealDailySolvable contracts
  const gameSolvable = dealSolvableGame(1, 888, { maxNodes: 5_000 });
  assert.ok(gameSolvable.seed > 0);
  assert.equal(gameSolvable.tableau.length, 7);

  const dailyGame = dealDailySolvable(dailyBaseSeed('2026-11-19'), 1);
  assert.equal(isSolvable(dailyGame, 1, { maxNodes: 20_000 }), true, 'daily deal is solvable');
}

// ============================================================================
// 8. Asia/Taipei Daily Key, Streak Preservation & Daily Challenges
// ============================================================================
{
  // Asia/Taipei timezone (UTC+8) boundary tests
  // UTC 15:59:59 is 23:59:59 in Taipei (same date)
  const t1 = new Date('2026-05-15T15:59:59.999Z');
  assert.equal(dateKey(t1), '2026-05-15');

  // UTC 16:00:00 is 00:00:00 next day in Taipei
  const t2 = new Date('2026-05-15T16:00:00.000Z');
  assert.equal(dateKey(t2), '2026-05-16');

  // Year rollover in Taipei timezone
  const tNewYear = new Date('2026-12-31T16:00:00.000Z');
  assert.equal(dateKey(tNewYear), '2027-01-01');

  // Leap day in Taipei timezone
  const tLeap = new Date('2028-02-28T16:00:00.000Z');
  assert.equal(dateKey(tLeap), '2028-02-29');

  // dailySeedCode and dailyBaseSeed
  assert.equal(dailySeedCode('2026-11-19'), 'klondike-daily-2026-11-19');
  assert.ok(Number.isInteger(dailyBaseSeed('2026-11-19')));
  assert.equal(dailyBaseSeed('2026-11-19'), dailyBaseSeed('2026-11-19'), 'base seed is deterministic');

  // Streak preservation across consecutive days and grace days
  const dailyHistory = [
    { date: '2026-11-19', won: true, score: 350, elapsedSec: 180, moves: 75, drawCount: 1, scoreMode: 'standard' },
    { date: '2026-11-18', won: true, score: 310, elapsedSec: 210, moves: 82, drawCount: 1, scoreMode: 'standard' },
    { date: '2026-11-17', won: true, score: 280, elapsedSec: 240, moves: 90, drawCount: 1, scoreMode: 'standard' },
    { date: '2026-11-15', won: true, score: 400, elapsedSec: 150, moves: 65, drawCount: 1, scoreMode: 'standard' },
  ];

  // Won today (2026-11-19) with yesterday and day before -> streak is 3
  assert.equal(computeStreak(dailyHistory, '2026-11-19'), 3);

  // Grace period: Haven't won today (2026-11-20) yet, but won yesterday (2026-11-19) -> streak is 3!
  assert.equal(computeStreak(dailyHistory, '2026-11-20'), 3, 'streak survives until day ends without a win');

  // Missed yesterday (played on 19th, but today is 21st and 20th was missed) -> streak is 0
  assert.equal(computeStreak(dailyHistory, '2026-11-21'), 0, 'streak reset when yesterday was missed');

  // Duplicate wins on the same day do not inflate streak
  const duplicateDayHistory = [
    { date: '2026-11-19', won: true, score: 200, elapsedSec: 300, moves: 100, drawCount: 1, scoreMode: 'standard' },
    { date: '2026-11-19', won: true, score: 350, elapsedSec: 180, moves: 75, drawCount: 1, scoreMode: 'standard' },
    { date: '2026-11-18', won: true, score: 310, elapsedSec: 210, moves: 82, drawCount: 1, scoreMode: 'standard' },
  ];
  assert.equal(computeStreak(duplicateDayHistory, '2026-11-19'), 2, 'duplicate days count as 1 streak day');

  // Month rollover streak: 2026-09-30 -> 2026-10-01
  const rolloverHistory = [
    { date: '2026-10-01', won: true, score: 300, elapsedSec: 200, moves: 80, drawCount: 1, scoreMode: 'standard' },
    { date: '2026-09-30', won: true, score: 320, elapsedSec: 190, moves: 78, drawCount: 1, scoreMode: 'standard' },
  ];
  assert.equal(computeStreak(rolloverHistory, '2026-10-01'), 2, 'streak crosses month boundaries');

  // todaysBest record selection
  assert.equal(todaysBest(dailyHistory, '2026-11-19')?.score, 350);
  assert.equal(todaysBest(dailyHistory, '2026-11-25'), null);

  // Daily challenge achievements
  assert.equal(CHALLENGES.length, 7, '7 defined challenge goals');
  const baseChallenge = {
    won: true,
    usedUndo: false,
    moves: 78,
    elapsedSec: 240,
    score: 320,
    scoreMode: 'standard',
  };

  // no-undo and pure-skill (disqualified by reshuffle)
  assert.equal(isChallengeCleared('no-undo', baseChallenge), true);
  assert.equal(isChallengeCleared('no-undo', { ...baseChallenge, usedUndo: true }), false);
  assert.equal(isChallengeCleared('no-undo', { ...baseChallenge, usedReshuffle: true }), false, 'reshuffle disqualifies no-undo');
  assert.equal(isChallengeCleared('no-undo', { ...baseChallenge, won: false }), false);

  assert.equal(isChallengeCleared('pure-skill', baseChallenge), true);
  assert.equal(isChallengeCleared('pure-skill', { ...baseChallenge, usedReshuffle: true }), false, 'reshuffle disqualifies pure-skill');
  assert.equal(isChallengeCleared('pure-skill', { ...baseChallenge, won: false }), false);

  // moves-120 and moves-80
  assert.equal(isChallengeCleared('moves-120', baseChallenge), true);
  assert.equal(isChallengeCleared('moves-120', { ...baseChallenge, moves: 120 }), true);
  assert.equal(isChallengeCleared('moves-120', { ...baseChallenge, moves: 121 }), false);

  assert.equal(isChallengeCleared('moves-80', baseChallenge), true);
  assert.equal(isChallengeCleared('moves-80', { ...baseChallenge, moves: 80 }), true);
  assert.equal(isChallengeCleared('moves-80', { ...baseChallenge, moves: 81 }), false);

  // time-300
  assert.equal(isChallengeCleared('time-300', baseChallenge), true);
  assert.equal(isChallengeCleared('time-300', { ...baseChallenge, elapsedSec: 300 }), true);
  assert.equal(isChallengeCleared('time-300', { ...baseChallenge, elapsedSec: 301 }), false);

  // standard-300
  assert.equal(isChallengeCleared('standard-300', baseChallenge), true);
  assert.equal(isChallengeCleared('standard-300', { ...baseChallenge, score: 299 }), false);
  assert.equal(isChallengeCleared('standard-300', { ...baseChallenge, scoreMode: 'vegas', score: 350 }), false);

  // vegas-profit
  assert.equal(isChallengeCleared('vegas-profit', { ...baseChallenge, scoreMode: 'vegas', score: 1 }), true);
  assert.equal(isChallengeCleared('vegas-profit', { ...baseChallenge, scoreMode: 'vegas', score: 0 }), false);
  assert.equal(isChallengeCleared('vegas-profit', { ...baseChallenge, scoreMode: 'vegas', score: -2 }), false);
  assert.equal(isChallengeCleared('vegas-profit', { ...baseChallenge, scoreMode: 'standard', score: 100 }), false);

  // evaluateChallenges aggregation
  const clearedAll = evaluateChallenges(baseChallenge);
  assert.ok(clearedAll.includes('no-undo'));
  assert.ok(clearedAll.includes('moves-120'));
  assert.ok(clearedAll.includes('moves-80'));
  assert.ok(clearedAll.includes('time-300'));
  assert.ok(clearedAll.includes('standard-300'));

  // Lost game clears 0 challenges
  assert.equal(evaluateChallenges({ ...baseChallenge, won: false }).length, 0);

  // Daily share text generation
  const winShare = buildDailyShareText({
    date: '2026-11-19',
    won: true,
    score: 350,
    elapsedSec: 180,
    moves: 75,
    drawCount: 1,
    scoreMode: 'standard',
    streak: 3,
  });
  assert.match(winShare, /接龍 每日 2026-11-19/);
  assert.match(winShare, /✓ 350 分 · 3:00 · 75 步/);
  assert.match(winShare, /翻 1 · 標準 · 連勝 3 天/);

  const lossShare = buildDailyShareText({
    date: '2026-11-19',
    won: false,
    score: -27,
    elapsedSec: 95,
    moves: 35,
    drawCount: 3,
    scoreMode: 'vegas',
    streak: 0,
  });
  assert.match(lossShare, /✗ 未過關 · 本局 -27 分 · 35 步/);
  assert.match(lossShare, /翻 3 · 維加斯 · 連勝 0 天/);
}

// ============================================================================
// 9. Card Physics Layout Fan Coordinates & Web Audio Trigger Contracts
// ============================================================================
{
  // KL_FAN contract constants in layoutFan.mjs
  assert.equal(KL_FAN.cornerSizeCss, 'clamp(0.7rem, 20cqi, 1.05rem)');
  assert.equal(KL_FAN.faceUpPeekCss, 'calc(var(--kl-corner-size) * 2.35 + 0.5rem)');
  assert.equal(KL_FAN.faceDownPeekCss, 'max(0.55rem, calc(var(--kl-corner-size) * 0.75))');
  assert.equal(KL_FAN.wasteFanXCss, 'calc(var(--kl-corner-size) * 1.15 + 0.45rem)');

  // index.css alignment verification
  const cssPath = fileURLToPath(new URL('./index.css', import.meta.url));
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /--kl-corner-size:\s*clamp\(0\.7rem,\s*20cqi,\s*1\.05rem\);/);
  assert.match(css, /--kl-fan-face-up:\s*calc\(var\(--kl-corner-size\)\s*\*\s*2\.35\s*\+\s*0\.5rem\);/);
  assert.match(css, /--kl-fan-face-down:\s*max\(0\.55rem,\s*calc\(var\(--kl-corner-size\)\s*\*\s*0\.75\)\);/);
  assert.match(css, /--kl-waste-fan-x:\s*calc\(var\(--kl-corner-size\)\s*\*\s*1\.15\s*\+\s*0\.45rem\);/);
  assert.match(css, /clip-path:\s*inset\(0 0 calc\(100% - var\(--kl-slot-peek, var\(--kl-fan-face-up\)\)\) 0\);/);

  // App.tsx fan coordinates verification
  const appPath = fileURLToPath(new URL('./App.tsx', import.meta.url));
  const app = fs.readFileSync(appPath, 'utf8');
  assert.equal(app.includes('faceUp ? 20 : 10'), false, 'hardcoded 20/10px tableau step removed');
  assert.equal(app.includes('displayIndex * 12'), false, 'hardcoded 12px waste step removed');
  assert.match(app, /top:\s*`calc\(\$\{faceDownAbove\}\s*\*\s*var\(--kl-fan-face-down\)\s*\+\s*\$\{faceUpAbove\}\s*\*\s*var\(--kl-fan-face-up\)\)`/);
  assert.match(app, /transform:\s*`translateX\(calc\(\$\{displayIndex\}\s*\*\s*var\(--kl-waste-fan-x\)\)\)`/);

  // Tableau top coordinate formula verification
  const calcTopOffsetFormula = (faceDownAbove, faceUpAbove) =>
    `calc(${faceDownAbove} * var(--kl-fan-face-down) + ${faceUpAbove} * var(--kl-fan-face-up))`;
  assert.equal(calcTopOffsetFormula(0, 0), 'calc(0 * var(--kl-fan-face-down) + 0 * var(--kl-fan-face-up))');
  assert.equal(calcTopOffsetFormula(4, 2), 'calc(4 * var(--kl-fan-face-down) + 2 * var(--kl-fan-face-up))');

  // Waste 3-card fan display indices calculation
  const getWasteDisplayIndex = (cardIdx, totalWasteCards) => cardIdx - Math.max(0, totalWasteCards - 3);
  // Waste has 1 card:
  assert.equal(getWasteDisplayIndex(0, 1), 0);
  // Waste has 2 cards:
  assert.equal(getWasteDisplayIndex(0, 2), 0);
  assert.equal(getWasteDisplayIndex(1, 2), 1);
  // Waste has 5 cards: cards 0 and 1 are hidden, cards 2, 3, 4 are visible with indices 0, 1, 2
  assert.equal(getWasteDisplayIndex(2, 5), 0);
  assert.equal(getWasteDisplayIndex(3, 5), 1);
  assert.equal(getWasteDisplayIndex(4, 5), 2);

  // Web Audio trigger contracts (klondikeAudio)
  assert.equal(typeof klondikeAudio.setMuted, 'function');
  assert.equal(typeof klondikeAudio.playCardFlick, 'function');
  assert.equal(typeof klondikeAudio.playCardSnap, 'function');
  assert.equal(typeof klondikeAudio.playFoundationAscent, 'function');
  assert.equal(typeof klondikeAudio.playVegasBassDrop, 'function');
  assert.equal(typeof klondikeAudio.playRiffleShuffle, 'function');
  assert.equal(typeof klondikeAudio.playVictoryFanfare, 'function');
  assert.equal(typeof klondikeAudio.playFireworkPop, 'function');

  // Headless safe execution: running all audio calls in Node.js (without window) does not throw
  klondikeAudio.setMuted(false);
  assert.doesNotThrow(() => klondikeAudio.playCardFlick());
  assert.doesNotThrow(() => klondikeAudio.playCardSnap());
  assert.doesNotThrow(() => klondikeAudio.playFoundationAscent(1));
  assert.doesNotThrow(() => klondikeAudio.playFoundationAscent(13));
  assert.doesNotThrow(() => klondikeAudio.playFoundationAscent(52));
  assert.doesNotThrow(() => klondikeAudio.playVegasBassDrop());
  assert.doesNotThrow(() => klondikeAudio.playRiffleShuffle());
  assert.doesNotThrow(() => klondikeAudio.playVictoryFanfare());
  assert.doesNotThrow(() => klondikeAudio.playFireworkPop());

  // Muted behavior
  klondikeAudio.setMuted(true);
  assert.doesNotThrow(() => klondikeAudio.playCardFlick());
  assert.doesNotThrow(() => klondikeAudio.playVegasBassDrop());
  klondikeAudio.setMuted(false);

  // Simulated Web Audio API node creation contract verification
  const mockAudioEvents = [];
  const mockContext = {
    currentTime: 0.1,
    sampleRate: 44100,
    destination: {},
    state: 'running',
    createBuffer: (channels, length, rate) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createBufferSource: () => ({
      buffer: null,
      connect: () => {},
      start: (t) => mockAudioEvents.push({ type: 'buffer-start', time: t }),
      stop: (t) => mockAudioEvents.push({ type: 'buffer-stop', time: t }),
    }),
    createBiquadFilter: () => ({
      type: 'lowpass',
      frequency: { setValueAtTime: (val) => mockAudioEvents.push({ type: 'filter-freq', val }) },
      Q: { setValueAtTime: (val) => mockAudioEvents.push({ type: 'filter-Q', val }) },
      connect: () => {},
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: {
        setValueAtTime: (val) => mockAudioEvents.push({ type: 'osc-freq', val }),
        exponentialRampToValueAtTime: (val, t) => mockAudioEvents.push({ type: 'osc-ramp', val, time: t }),
      },
      connect: () => {},
      start: () => mockAudioEvents.push({ type: 'osc-start' }),
      stop: () => mockAudioEvents.push({ type: 'osc-stop' }),
    }),
    createGain: () => ({
      gain: {
        setValueAtTime: (val) => mockAudioEvents.push({ type: 'gain-set', val }),
        exponentialRampToValueAtTime: (val, t) => mockAudioEvents.push({ type: 'gain-ramp', val, time: t }),
      },
      connect: () => {},
    }),
  };

  // Attach mock window for contract testing
  globalThis.window = { AudioContext: function () { return mockContext; } };
  try {
    klondikeAudio.playCardFlick();
    assert.ok(mockAudioEvents.some((e) => e.type === 'filter-freq' && e.val === 1400), 'flick bandpass 1400Hz');

    mockAudioEvents.length = 0;
    klondikeAudio.playCardSnap();
    assert.ok(mockAudioEvents.some((e) => e.type === 'osc-freq' && e.val === 160), 'snap low thud oscillator');
    assert.ok(mockAudioEvents.some((e) => e.type === 'osc-freq' && e.val === 900), 'snap click oscillator');

    mockAudioEvents.length = 0;
    klondikeAudio.playVegasBassDrop();
    assert.ok(mockAudioEvents.some((e) => e.type === 'osc-ramp' && e.val === 32), 'bass drop ramps to 32Hz');

    mockAudioEvents.length = 0;
    klondikeAudio.playFoundationAscent(0); // Note 0: C4 (261.63Hz)
    assert.ok(mockAudioEvents.some((e) => e.type === 'osc-freq' && Math.abs(e.val - 261.63) < 0.01), 'ascent note 0 is C4');

    mockAudioEvents.length = 0;
    klondikeAudio.playFoundationAscent(4); // Note 4: A4 (440.00Hz)
    assert.ok(mockAudioEvents.some((e) => e.type === 'osc-freq' && Math.abs(e.val - 440.0) < 0.01), 'ascent note 4 is A4');
  } finally {
    delete globalThis.window;
  }
}

// ============================================================================
// 10. Dual-Wing Royal Cockpit Telemetry Suite
// ============================================================================
{
  const testState = {
    tableau: [
      [card('spades', 'K')],
      [card('hearts', 'Q', false), card('hearts', 'J')],
      [],
      [],
      [],
      [],
      [],
    ],
    foundation: [[card('spades', 'A'), card('spades', '2')], [], [], []],
    stock: [card('clubs', '3'), card('clubs', '4')],
    waste: [card('hearts', 'A')],
    history: [],
    seed: 1234,
  };

  // Stock telemetry
  const stockVegas1 = getStockTelemetry(testState, 'vegas', 1, 0);
  assert.equal(stockVegas1.stockCount, 2);
  assert.equal(stockVegas1.wasteCount, 1);
  assert.equal(stockVegas1.passesAllowed, 1);
  assert.equal(stockVegas1.passesRemaining, 1);

  const stockVegas3 = getStockTelemetry(testState, 'vegas', 3, 1);
  assert.equal(stockVegas3.passesAllowed, 3);
  assert.equal(stockVegas3.passesRemaining, 2);

  const stockStd = getStockTelemetry(testState, 'standard', 1, 0);
  assert.equal(stockStd.passesAllowed, 'infinite');
  assert.equal(stockStd.passesRemaining, 'infinite');

  // Hidden cards telemetry
  const hidden = getHiddenCardsTelemetry(testState.tableau);
  assert.equal(hidden.totalHidden, 1);
  assert.equal(hidden.deepestColIndex, 1);
  assert.equal(hidden.deepestColCount, 1);
  assert.equal(hidden.isAllRevealed, false);

  const hiddenClear = getHiddenCardsTelemetry([[card('spades', 'A')], [card('hearts', '2')]]);
  assert.equal(hiddenClear.totalHidden, 0);
  assert.equal(hiddenClear.isAllRevealed, true);

  // Foundation telemetry
  const fTel = getFoundationTelemetry(testState.foundation);
  assert.equal(fTel.totalCards, 2);
  assert.equal(fTel.minCount, 0);
  assert.equal(fTel.maxCount, 2);
  assert.equal(fTel.isBalanced, true);

  // Movable cards analysis
  const mov = computeMovableAnalysis(testState);
  assert.equal(mov.wasteMovable, true, 'waste Ace can move to foundation');
  assert.ok(mov.movableCardIds.has('hearts-A'));

  // Vegas yield telemetry
  const vYield = getVegasYieldTelemetry(testState.foundation, -42, {
    plays: 1,
    wins: 1,
    currentStreak: 2,
    bestStreak: 2,
    vegasBankroll: 100,
    byMode: {},
    challengesCleared: {},
  });
  assert.equal(vYield.dealCost, 52);
  assert.equal(vYield.payout, 10);
  assert.equal(vYield.netProfit, -42);
  assert.equal(vYield.breakEvenCardsNeeded, 9);
  assert.equal(vYield.streakFeverMultiplier, 1.5);

  // Master tactical advice
  const advice = getMasterAdvice(testState, hidden, fTel, stockVegas1, mov.totalMovableCount);
  assert.ok(advice.title.length > 0);
  assert.ok(advice.detail.length > 0);

  // Stock X-Ray distribution radar
  const xray = getStockXRayTelemetry(testState);
  assert.equal(xray.redCount, 1, 'waste has hearts-A');
  assert.equal(xray.blackCount, 2, 'stock has clubs-3, clubs-4');
  assert.equal(xray.suitCounts.clubs, 2);
  assert.equal(xray.suitCounts.hearts, 1);
  assert.equal(xray.targets.length, 4);

  // Foundation velocity meter
  const vel = getFoundationVelocityTelemetry(12, 60);
  assert.equal(vel.progressPercent, 23);
  assert.ok(vel.ratePerMinute > 0);
  assert.ok(['charging', 'steady', 'rush'].includes(vel.tier));

  // Step efficiency telemetry
  const eff = getStepEfficiencyTelemetry(50, 10, 10);
  assert.equal(eff.parMoves, 80);
  assert.ok(eff.efficiencyPercent > 0);
  assert.ok(['S', 'A', 'B', 'C'].includes(eff.rating));

  // Mode key format
  assert.equal(modeKey(1, 'standard'), '1-standard');
  assert.equal(modeKey(3, 'vegas'), '3-vegas');

  // Win rate calculation
  assert.equal(winRate({ plays: 10, wins: 7 }), 0.7);
  assert.equal(winRate({ plays: 0, wins: 0 }), 0);
}

console.log('check-klondike: ok');
