// ponytail: cascade caps, hints, scoring, daily streak, challenges, difficulty.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  canMove,
  checkWin,
  executeMove,
  getHintMove,
  getMaxMoveCount,
  getSafeFoundationMoves,
  isValidSequence,
  INITIAL_FOUNDATIONS,
} from './utils/gameLogic.ts';
import { dealForDifficulty, dealGame } from './utils/deck.ts';
import { classifyDifficulty, estimateParMoves, solveSync } from './utils/solver.ts';
import { computeStreak, dailyBaseSeed, dailySeedCode, dateKey } from './utils/daily.ts';
import { evaluateChallenges, isChallengeCleared, CHALLENGES } from './utils/challenges.ts';
import {
  applyScoreDelta,
  clampScore,
  classicTimeBonus,
  finishMoveDelta,
  FOUNDATION_POINTS,
  initialScore,
  OVER_PAR_PENALTY,
  pointsToFoundation,
  pointsUndo,
  scoreSummaryLabel,
  timePenaltyTicks,
  UNDER_PAR_BONUS,
  UNDO_PENALTY,
} from './utils/scoring.ts';
import { modeKey, recordGameResult, winRate } from './utils/storage.ts';
import { FC_FAN } from './layoutFan.mjs';
import {
  evaluateTactics,
  getAllSafeFoundationCards,
  getSolutionRouteTelemetry,
  getSupermoveCapacity,
  getTrappedKeyCards,
  LEGENDARY_DEALS,
  MASTER_TIPS,
} from './utils/tactics.ts';
import { getNextTheme, WORKSHOP_THEMES } from './utils/theme.ts';

function card(suit, rank) {
  const color = suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
  return { id: `${suit}-${rank}`, suit, rank, color };
}

function lockedCard(index) {
  return { id: `locked-${index}`, suit: 'spades', rank: 13, color: 'black' };
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

// ============================================================================
// 1. Alternating descending sequence validation
// ============================================================================
{
  assert.equal(
    isValidSequence([card('spades', 7), card('hearts', 6), card('clubs', 5)]),
    true,
    'alternating black-red-black descending is valid',
  );
  assert.equal(
    isValidSequence([card('spades', 7), card('clubs', 6)]),
    false,
    'same color (black-black) is invalid',
  );
  assert.equal(
    isValidSequence([card('hearts', 9), card('diamonds', 8)]),
    false,
    'same color (red-red) is invalid',
  );
  assert.equal(
    isValidSequence([card('spades', 7), card('hearts', 5)]),
    false,
    'rank jump (7 to 5) is invalid',
  );
  assert.equal(
    isValidSequence([card('hearts', 6), card('spades', 7)]),
    false,
    'ascending sequence is invalid',
  );
  assert.equal(isValidSequence([card('spades', 7)]), true, 'single card is always valid');
  assert.equal(isValidSequence([]), true, 'empty array is valid');
}

// ============================================================================
// 2. Deep Supermove Formula across all combinations: (freeCells + 1) * 2^emptyCols
//    Combinations: freeCells (0 to 4) x emptyTableaus (0 to 8)
// ============================================================================
{
  for (let fc = 0; fc <= 4; fc++) {
    for (let tc = 0; tc <= 8; tc++) {
      // 2.1 Moving to an occupied tableau column (emptyTableaus unchanged)
      const expectedToTableau = (fc + 1) * Math.pow(2, tc);
      const actualToTableau = getMaxMoveCount(fc, tc, false);
      assert.equal(
        actualToTableau,
        expectedToTableau,
        `Supermove to tableau (fc=${fc}, tc=${tc}) should equal ${expectedToTableau}`,
      );

      // 2.2 Moving to an empty tableau column (consumes 1 empty tableau as destination)
      const effectiveEmpty = Math.max(0, tc - 1);
      const expectedToEmpty = (fc + 1) * Math.pow(2, effectiveEmpty);
      const actualToEmpty = getMaxMoveCount(fc, tc, true);
      assert.equal(
        actualToEmpty,
        expectedToEmpty,
        `Supermove to empty tableau (fc=${fc}, tc=${tc}) should equal ${expectedToEmpty}`,
      );

      // 2.3 Verify tactics helper getSupermoveCapacity matches exact mathematical values
      const cap = getSupermoveCapacity(fc, tc);
      assert.equal(cap.capacityToTableau, expectedToTableau);
      assert.equal(cap.capacityToEmptyTableau, expectedToEmpty);
      assert.equal(
        cap.formulaString,
        `(1 + ${fc}) × 2^${tc} = ${expectedToTableau}`,
        'tactical formula string format verification',
      );

      // 2.4 Verify tactical status levels
      if (expectedToTableau >= 6) {
        assert.equal(cap.statusLevel, 'ultra');
        assert.equal(cap.statusLabel, '極致超能');
      } else if (expectedToTableau >= 3) {
        assert.equal(cap.statusLevel, 'high');
        assert.equal(cap.statusLabel, '靈活中轉');
      } else if (expectedToTableau === 2) {
        assert.equal(cap.statusLevel, 'dual');
        assert.equal(cap.statusLabel, '雙牌借位');
      } else {
        assert.equal(cap.statusLevel, 'single');
        assert.equal(cap.statusLabel, '空間告急');
      }

      // 2.5 Monotonicity invariants:
      // More free cells strictly increase capacity
      if (fc < 4) {
        assert.ok(
          getMaxMoveCount(fc + 1, tc, false) > actualToTableau,
          'increasing free cells strictly increases move capacity',
        );
      }
      // More empty tableaus double capacity (when tc >= 1)
      if (tc < 8) {
        assert.ok(
          getMaxMoveCount(fc, tc + 1, false) >= actualToTableau,
          'increasing empty tableaus increases or preserves move capacity',
        );
      }
      // Moving to occupied column is always >= moving to empty column
      assert.ok(
        actualToTableau >= actualToEmpty,
        'capacity to occupied tableau must be >= capacity to empty tableau',
      );
      if (tc >= 1) {
        assert.equal(
          actualToTableau,
          2 * actualToEmpty,
          'with tc >= 1, capacity to occupied column is exactly 2x capacity to empty column',
        );
      } else {
        assert.equal(
          actualToTableau,
          actualToEmpty,
          'with tc == 0, capacity to occupied column equals capacity to empty column',
        );
      }
    }
  }

  // Exact boundary values
  assert.equal(getMaxMoveCount(0, 0, false), 1, '0 cells, 0 empty cols -> 1');
  assert.equal(getMaxMoveCount(4, 0, false), 5, '4 cells, 0 empty cols -> 5');
  assert.equal(getMaxMoveCount(0, 1, false), 2, '0 cells, 1 empty col -> 2');
  assert.equal(getMaxMoveCount(4, 1, false), 10, '4 cells, 1 empty col -> 10');
  assert.equal(getMaxMoveCount(4, 2, false), 20, '4 cells, 2 empty cols -> 20');
  assert.equal(getMaxMoveCount(4, 8, false), 1280, '4 cells, 8 empty cols -> 1280');
  assert.equal(getMaxMoveCount(4, 8, true), 640, '4 cells, 8 empty cols (to empty) -> 640');
}

// ============================================================================
// 3. Real board cascade transfer bounds: enforce supermove limits during play
// ============================================================================
{
  // Test run of 5 cards: [Spades 9, Hearts 8, Spades 7, Hearts 6, Spades 5]
  const run5 = [
    card('spades', 9),
    card('hearts', 8),
    card('spades', 7),
    card('hearts', 6),
    card('spades', 5),
  ];

  // Scenario 3A: 4 free cells, 0 empty columns -> maxMove = (4 + 1) * 2^0 = 5.
  // Moving 5 cards onto Hearts 10 is permitted.
  const state4fc = emptyState({
    freeCells: [null, null, null, null],
    tableaus: [
      [card('hearts', 10)], // col 0 (target)
      [...run5],             // col 1 (source: 5-card valid sequence)
      [card('clubs', 13)],   // col 2 (occupied)
      [card('clubs', 13)],   // col 3 (occupied)
      [card('clubs', 13)],   // col 4 (occupied)
      [card('clubs', 13)],   // col 5 (occupied)
      [card('clubs', 13)],   // col 6 (occupied)
      [card('clubs', 13)],   // col 7 (occupied)
    ],
  });
  assert.equal(
    canMove(state4fc, { zone: 'tableau', index: 1, cardIndex: 0 }, { zone: 'tableau', index: 0 }),
    true,
    'transferring 5 cards with 4 free cells is valid (5 <= 5)',
  );

  // Scenario 3B: 3 free cells, 0 empty columns -> maxMove = (3 + 1) * 2^0 = 4.
  // Moving 5 cards onto Hearts 10 is rejected!
  const state3fc = emptyState({
    freeCells: [card('diamonds', 13), null, null, null], // 1 slot occupied -> 3 free cells
    tableaus: [
      [card('hearts', 10)],
      [...run5],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
    ],
  });
  assert.equal(
    canMove(state3fc, { zone: 'tableau', index: 1, cardIndex: 0 }, { zone: 'tableau', index: 0 }),
    false,
    'transferring 5 cards with 3 free cells is rejected (5 > 4)',
  );
  // But moving 4 cards (from index 1: Hearts 8 down to Spades 5) onto Spades 9 is valid:
  assert.equal(
    canMove(state3fc, { zone: 'tableau', index: 1, cardIndex: 1 }, { zone: 'tableau', index: 0 }),
    false,
    'cannot place Hearts 8 directly on Hearts 10 (rank mismatch)',
  );

  // Scenario 3C: Moving to an empty tableau consumes that empty column.
  // 1 free cell, 1 empty column ->
  // Moving to occupied col: (1 + 1) * 2^1 = 4.
  // Moving to empty col: (1 + 1) * 2^0 = 2.
  const stateEmptyTarget = emptyState({
    freeCells: [card('diamonds', 13), card('diamonds', 12), card('diamonds', 11), null], // 1 free cell
    tableaus: [
      [],                  // col 0 is empty (target)
      [...run5],           // col 1 has 5-card run
      [card('clubs', 13)], // cols 2..7 occupied
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
    ],
  });
  // Moving 3 cards (run5 slice from index 2) to empty col 0 should be rejected because max is 2
  assert.equal(
    canMove(stateEmptyTarget, { zone: 'tableau', index: 1, cardIndex: 2 }, { zone: 'tableau', index: 0 }),
    false,
    'transferring 3 cards to empty column with 1 cell and 1 empty col is rejected (3 > 2)',
  );
  // Moving 2 cards (run5 slice from index 3: Hearts 6, Spades 5) to empty col 0 is allowed:
  assert.equal(
    canMove(stateEmptyTarget, { zone: 'tableau', index: 1, cardIndex: 3 }, { zone: 'tableau', index: 0 }),
    true,
    'transferring 2 cards to empty column with 1 cell and 1 empty col is allowed (2 <= 2)',
  );
}

// ============================================================================
// 4. 2-Cell Challenge Mode limits, solvability heuristics, & transfer bounds
// ============================================================================
{
  const locked2 = lockedCard(2);
  const locked3 = lockedCard(3);

  // State in 2-cell challenge mode: slots 2 and 3 are locked placeholders
  const state2Cell = emptyState({
    freeCells: [null, null, locked2, locked3],
    tableaus: [
      [card('spades', 10)],
      [card('hearts', 9), card('spades', 8), card('hearts', 7), card('spades', 6)], // 4 cards
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
    ],
  });

  // 4.1 Moving from locked cells is strictly impossible
  assert.equal(
    canMove(state2Cell, { zone: 'freeCell', index: 2 }, { zone: 'tableau', index: 0 }),
    false,
    'locked free cell slot 2 cannot be moved',
  );
  assert.equal(
    canMove(state2Cell, { zone: 'freeCell', index: 3 }, { zone: 'foundation', index: 0 }),
    false,
    'locked free cell slot 3 cannot be moved',
  );

  // 4.2 Moving to locked cells is strictly impossible (slot not empty)
  assert.equal(
    canMove(state2Cell, { zone: 'tableau', index: 0, cardIndex: 0 }, { zone: 'freeCell', index: 2 }),
    false,
    'cannot move into locked slot 2',
  );
  assert.equal(
    canMove(state2Cell, { zone: 'tableau', index: 0, cardIndex: 0 }, { zone: 'freeCell', index: 3 }),
    false,
    'cannot move into locked slot 3',
  );

  // 4.3 Moving to unlocked slots 0 and 1 works normally
  assert.equal(
    canMove(state2Cell, { zone: 'tableau', index: 0, cardIndex: 0 }, { zone: 'freeCell', index: 0 }),
    true,
    'slot 0 is available in 2-cell mode',
  );
  assert.equal(
    canMove(state2Cell, { zone: 'tableau', index: 0, cardIndex: 0 }, { zone: 'freeCell', index: 1 }),
    true,
    'slot 1 is available in 2-cell mode',
  );

  // 4.4 Cascade transfer bounds in 2-cell mode:
  // With 0 empty tableaus and 2 available free cells, maxMove is (2 + 1) * 2^0 = 3 cards.
  // Col 1 has 4 cards (Hearts 9 .. Spades 6). Attempting to move all 4 cards to Col 0 (Spades 10) must fail!
  assert.equal(
    canMove(state2Cell, { zone: 'tableau', index: 1, cardIndex: 0 }, { zone: 'tableau', index: 0 }),
    false,
    '4-card cascade move must fail in 2-cell mode with 0 empty cols (4 > 3)',
  );
  // Moving 3 cards (from cardIndex 1: Spades 8 .. Spades 6) would target Spades 10 with Spades 8 (rank mismatch)
  // Let's test with a 3-card sequence matching destination:
  const state2Cell3Cards = emptyState({
    freeCells: [null, null, locked2, locked3],
    tableaus: [
      [card('spades', 10)],
      [card('hearts', 9), card('spades', 8), card('hearts', 7)], // 3 cards, starts with Hearts 9
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
      [card('clubs', 13)],
    ],
  });
  assert.equal(
    canMove(state2Cell3Cards, { zone: 'tableau', index: 1, cardIndex: 0 }, { zone: 'tableau', index: 0 }),
    true,
    '3-card cascade move succeeds in 2-cell mode with 0 empty cols (3 <= 3)',
  );

  // 4.5 Execution and history in 2-cell mode
  const afterMoveToCell = executeMove(
    state2Cell,
    { zone: 'tableau', index: 0, cardIndex: 0 },
    { zone: 'freeCell', index: 0 },
  );
  assert.equal(afterMoveToCell.freeCells[0]?.id, 'spades-10');
  assert.equal(afterMoveToCell.freeCells[2]?.id, 'locked-2');
  assert.equal(afterMoveToCell.freeCells[3]?.id, 'locked-3');

  // Now only 1 empty free cell remains in 2-cell mode. Capacity drops to (1 + 1) * 2^0 = 2.
  // Multiple cards cannot move to a free cell:
  assert.equal(
    canMove(afterMoveToCell, { zone: 'tableau', index: 1, cardIndex: 0 }, { zone: 'freeCell', index: 1 }),
    false,
    'multiple cards cannot move into a single free cell',
  );
  // Moving the exposed top card of col 1 to the last open free cell succeeds:
  const topCardIdx = afterMoveToCell.tableaus[1].length - 1;
  assert.equal(
    canMove(afterMoveToCell, { zone: 'tableau', index: 1, cardIndex: topCardIdx }, { zone: 'freeCell', index: 1 }),
    true,
    'moving single top card to the last open free cell succeeds',
  );

  // 4.6 Evaluate tactics in 2-cell mode: locked slots ignored
  const tactics2Cell = evaluateTactics(state2Cell, 2);
  assert.ok(tactics2Cell.legalMovesCount > 0);
  assert.notEqual(tactics2Cell.mobilityLevel, 'deadlock');

  // 4.7 Challenges integration: 'two-cells' vs 'no-freecell'
  const challengeBase = {
    won: true,
    usedUndo: false,
    usedFreeCell: false,
    freeCellSlots: 2,
    moves: 45,
    parMoves: 50,
    elapsedSec: 150,
  };
  assert.equal(isChallengeCleared('two-cells', challengeBase), true);
  assert.equal(isChallengeCleared('no-freecell', challengeBase), true);
  assert.equal(isChallengeCleared('two-cells', { ...challengeBase, freeCellSlots: 4 }), false);
  assert.equal(isChallengeCleared('two-cells', { ...challengeBase, won: false }), false);
}

// ============================================================================
// 5. Undo score penalty math, time penalty increments, & clampScore invariants
// ============================================================================
{
  // 5.1 Constants contract
  assert.equal(initialScore(), 0);
  assert.equal(pointsToFoundation(), 10);
  assert.equal(pointsUndo(), -5);
  assert.equal(FOUNDATION_POINTS, 10);
  assert.equal(UNDO_PENALTY, 5);
  assert.equal(OVER_PAR_PENALTY, 2);
  assert.equal(UNDER_PAR_BONUS, 5);

  // 5.2 clampScore contract: score is strictly non-negative
  assert.equal(clampScore(100), 100);
  assert.equal(clampScore(5), 5);
  assert.equal(clampScore(1), 1);
  assert.equal(clampScore(0), 0);
  assert.equal(clampScore(-1), 0, 'negative score -1 must clamp to 0');
  assert.equal(clampScore(-5), 0, 'undo penalty -5 from 0 must clamp to 0');
  assert.equal(clampScore(-50), 0, 'deep negative score must clamp to 0');
  assert.equal(clampScore(-Infinity), 0, '-Infinity must clamp to 0');

  // 5.3 applyScoreDelta contract
  assert.equal(applyScoreDelta(20, -5), 15, '20 - 5 = 15');
  assert.equal(applyScoreDelta(10, -5), 5, '10 - 5 = 5');
  assert.equal(applyScoreDelta(5, -5), 0, '5 - 5 = 0');
  assert.equal(applyScoreDelta(4, -5), 0, '4 - 5 clamps to 0');
  assert.equal(applyScoreDelta(0, -5), 0, '0 - 5 clamps to 0');
  assert.equal(applyScoreDelta(0, 10), 10, '0 + 10 = 10');

  // 5.4 Multi-step Undo simulation with score clamping
  let scoreSim = initialScore();
  assert.equal(scoreSim, 0);

  // Foundation move 1: +10 pts
  scoreSim = applyScoreDelta(scoreSim, pointsToFoundation());
  assert.equal(scoreSim, 10);

  // Foundation move 2: +10 pts
  scoreSim = applyScoreDelta(scoreSim, pointsToFoundation());
  assert.equal(scoreSim, 20);

  // Undo move 2: restored to pre-move 10, then taxed pointsUndo (-5) -> 5
  scoreSim = clampScore(10 + pointsUndo());
  assert.equal(scoreSim, 5);

  // Undo move 1: restored to pre-move 0, then taxed pointsUndo (-5) -> clamped to 0!
  scoreSim = clampScore(0 + pointsUndo());
  assert.equal(scoreSim, 0, 'undo at 0 cannot drive score negative');

  // Repeated undos at score 0 remain 0
  for (let i = 0; i < 5; i++) {
    scoreSim = applyScoreDelta(scoreSim, pointsUndo());
    assert.equal(scoreSim, 0, 'repeated undos at 0 stay 0');
  }

  // 5.5 Finish move par delta & penalty clamping
  // Under par bonus: (par - moves) * 5
  assert.equal(finishMoveDelta(40, 50), 50); // 10 under par * 5
  assert.equal(finishMoveDelta(49, 50), 5);  // 1 under par * 5
  assert.equal(finishMoveDelta(50, 50), 0);  // on par -> 0
  assert.equal(finishMoveDelta(51, 50), -2); // 1 over par * -2
  assert.equal(finishMoveDelta(60, 50), -20);// 10 over par * -2
  assert.equal(finishMoveDelta(40, null), 0);// null par -> 0
  assert.equal(finishMoveDelta(40, 0), 0);   // 0 par -> 0

  // Clamping over-par finish penalty at game end
  assert.equal(applyScoreDelta(10, finishMoveDelta(60, 50)), 0, '10 pts - 20 over-par penalty clamps to 0');
  assert.equal(applyScoreDelta(30, finishMoveDelta(60, 50)), 10, '30 pts - 20 over-par penalty drops to 10');

  // 5.6 Classic time bonus formula
  assert.equal(classicTimeBonus(0), 0);
  assert.equal(classicTimeBonus(29), 0, 'no bonus under 30 seconds');
  assert.equal(classicTimeBonus(30), Math.floor(100_000 / 30)); // 3333
  assert.equal(classicTimeBonus(50), 2000);
  assert.equal(classicTimeBonus(100), 1000);
  assert.equal(classicTimeBonus(500), 200);

  // 5.7 Time penalty increments calculation
  // Tests timePenaltyTicks(elapsedSec, appliedThroughSec, intervalSec, penaltyPerInterval)
  const tick0 = timePenaltyTicks(5, 0);
  assert.equal(tick0.penalty, 0, '5s elapsed: 0 intervals of 10s');
  assert.equal(tick0.appliedThroughSec, 0);

  const tick1 = timePenaltyTicks(10, 0);
  assert.equal(tick1.penalty, -2, '10s elapsed: 1 interval of 10s (-2 pts)');
  assert.equal(tick1.appliedThroughSec, 10);

  const tick2 = timePenaltyTicks(19, 10);
  assert.equal(tick2.penalty, 0, '19s elapsed with 10s already applied: no new tick');
  assert.equal(tick2.appliedThroughSec, 10);

  const tick3 = timePenaltyTicks(35, 10);
  assert.equal(tick3.penalty, -4, 'jumped 20s (10 -> 30): 2 intervals (-4 pts)');
  assert.equal(tick3.appliedThroughSec, 30);

  const tick4 = timePenaltyTicks(65, 30);
  assert.equal(tick4.penalty, -6, 'jumped 30s (30 -> 60): 3 intervals (-6 pts)');
  assert.equal(tick4.appliedThroughSec, 60);

  // Time penalty clamping
  assert.equal(applyScoreDelta(3, tick4.penalty), 0, '3 pts - 6 penalty clamps to 0');

  // 5.8 Score summary labels
  assert.equal(scoreSummaryLabel(null, 42), '42 步 · 標準 —');
  assert.equal(scoreSummaryLabel(55, 42), '42 / 標準 55');
  assert.equal(scoreSummaryLabel(55, 55), '55 / 標準 55');
}

// ============================================================================
// 6. Foundation auto-move safety invariants
//    A card of rank R is safe to auto-move to foundations iff:
//    R == foundations[suit] + 1 AND (R <= 2 OR R <= min(opposite-color foundations) + 1)
// ============================================================================
{
  // 6.1 Ace (Rank 1): Always safe unconditionally
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs']) {
    const stateAce = emptyState({
      tableaus: [[card(suit, 1)], [], [], [], [], [], [], []],
    });
    const move = getSafeFoundationMoves(stateAce);
    assert.ok(move, `Ace of ${suit} must be safe to auto-move with 0 foundation cards`);
    assert.equal(move.source.zone, 'tableau');
    assert.equal(move.source.index, 0);

    const safeList = getAllSafeFoundationCards(stateAce, 4);
    assert.ok(safeList.some((s) => s.card.suit === suit && s.card.rank === 1));
  }

  // 6.2 Two (Rank 2): Always safe once the Ace of that suit is in foundation,
  //     even when both opposite-color foundations are still 0!
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs']) {
    const foundationsWithAce = { spades: 0, hearts: 0, diamonds: 0, clubs: 0, [suit]: 1 };
    const stateTwo = emptyState({
      foundations: foundationsWithAce,
      tableaus: [[card(suit, 2)], [], [], [], [], [], [], []],
    });
    const move = getSafeFoundationMoves(stateTwo);
    assert.ok(
      move,
      `Two of ${suit} must be safe to auto-move even when opposite foundations are 0`,
    );

    const safeList = getAllSafeFoundationCards(stateTwo, 4);
    assert.ok(safeList.some((s) => s.card.suit === suit && s.card.rank === 2));
  }

  // 6.3 Three (Rank 3): Moving a rank 3 (e.g. Hearts 3) to foundation is safe
  //     ONLY when BOTH opposite-color 2s are already in foundations!
  //     Opposite color for Hearts (red) is black (Spades & Clubs).
  const foundationsBaseH2 = { spades: 0, hearts: 2, diamonds: 0, clubs: 0 };

  // Case A: Spades = 0, Clubs = 0 -> minOpposite = 0. 3 <= 0 + 1 is false. UNSAFE!
  {
    const state = emptyState({
      foundations: { ...foundationsBaseH2, spades: 0, clubs: 0 },
      tableaus: [[card('hearts', 3)], [], [], [], [], [], [], []],
    });
    assert.equal(getSafeFoundationMoves(state), null, 'Hearts 3 is unsafe when black foundations are 0,0');
    assert.equal(getAllSafeFoundationCards(state, 4).length, 0);
  }

  // Case B: Spades = 1, Clubs = 1 -> minOpposite = 1. 3 <= 1 + 1 is false. UNSAFE!
  {
    const state = emptyState({
      foundations: { ...foundationsBaseH2, spades: 1, clubs: 1 },
      tableaus: [[card('hearts', 3)], [], [], [], [], [], [], []],
    });
    assert.equal(getSafeFoundationMoves(state), null, 'Hearts 3 is unsafe when black foundations are 1,1');
    assert.equal(getAllSafeFoundationCards(state, 4).length, 0);
  }

  // Case C: Spades = 2, Clubs = 1 -> minOpposite = 1. 3 <= 1 + 1 is false. UNSAFE!
  // (Because Clubs 2 is not yet in foundation; Hearts 3 may still be needed to hold Clubs 2)
  {
    const state = emptyState({
      foundations: { ...foundationsBaseH2, spades: 2, clubs: 1 },
      tableaus: [[card('hearts', 3)], [], [], [], [], [], [], []],
    });
    assert.equal(getSafeFoundationMoves(state), null, 'Hearts 3 is unsafe when Clubs 2 is not in foundation');
    assert.equal(getAllSafeFoundationCards(state, 4).length, 0);
  }

  // Case D: Spades = 1, Clubs = 2 -> minOpposite = 1. 3 <= 1 + 1 is false. UNSAFE!
  // (Because Spades 2 is not yet in foundation; Hearts 3 may still be needed to hold Spades 2)
  {
    const state = emptyState({
      foundations: { ...foundationsBaseH2, spades: 1, clubs: 2 },
      tableaus: [[card('hearts', 3)], [], [], [], [], [], [], []],
    });
    assert.equal(getSafeFoundationMoves(state), null, 'Hearts 3 is unsafe when Spades 2 is not in foundation');
    assert.equal(getAllSafeFoundationCards(state, 4).length, 0);
  }

  // Case E: Spades = 2, Clubs = 2 -> minOpposite = 2. 3 <= 2 + 1 = 3 is TRUE! SAFE!
  // (Both black 2s are safely locked in foundation; Hearts 3 cannot possibly be needed as parent)
  {
    const state = emptyState({
      foundations: { ...foundationsBaseH2, spades: 2, clubs: 2 },
      tableaus: [[card('hearts', 3)], [], [], [], [], [], [], []],
    });
    const move = getSafeFoundationMoves(state);
    assert.ok(move, 'Hearts 3 is SAFE when BOTH Spades and Clubs foundations reach 2');
    assert.equal(move.source.zone, 'tableau');

    const safeList = getAllSafeFoundationCards(state, 4);
    assert.equal(safeList.length, 1);
    assert.equal(safeList[0].card.id, 'hearts-3');
  }

  // 6.4 Test the symmetric safety invariant for black card (Spades 3):
  //     Opposite color for Spades (black) is red (Hearts & Diamonds).
  const foundationsBaseS2 = { spades: 2, hearts: 0, diamonds: 0, clubs: 0 };
  {
    // Hearts = 2, Diamonds = 1 -> UNSAFE
    const stateUnsafe = emptyState({
      foundations: { ...foundationsBaseS2, hearts: 2, diamonds: 1 },
      tableaus: [[card('spades', 3)], [], [], [], [], [], [], []],
    });
    assert.equal(getSafeFoundationMoves(stateUnsafe), null);

    // Hearts = 2, Diamonds = 2 -> SAFE!
    const stateSafe = emptyState({
      foundations: { ...foundationsBaseS2, hearts: 2, diamonds: 2 },
      tableaus: [[card('spades', 3)], [], [], [], [], [], [], []],
    });
    const move = getSafeFoundationMoves(stateSafe);
    assert.ok(move, 'Spades 3 is SAFE when BOTH Hearts and Diamonds foundations reach 2');
    assert.equal(move.source.zone, 'tableau');
  }

  // 6.5 Higher rank induction: Diamonds 4 (red) requires both black foundations >= 3
  {
    const foundationsD3 = { spades: 2, hearts: 0, diamonds: 3, clubs: 3 };
    const stateUnsafeD4 = emptyState({
      foundations: foundationsD3,
      tableaus: [[card('diamonds', 4)], [], [], [], [], [], [], []],
    });
    assert.equal(getSafeFoundationMoves(stateUnsafeD4), null, 'Diamonds 4 unsafe when Spades is only 2');

    const stateSafeD4 = emptyState({
      foundations: { ...foundationsD3, spades: 3 },
      tableaus: [[card('diamonds', 4)], [], [], [], [], [], [], []],
    });
    assert.ok(getSafeFoundationMoves(stateSafeD4), 'Diamonds 4 safe when Spades >= 3 and Clubs >= 3');
  }

  // 6.6 Non-exposed cards: a card inside a tableau stack is NEVER returned by getSafeFoundationMoves
  {
    const stateCovered = emptyState({
      foundations: { spades: 0, hearts: 0, diamonds: 0, clubs: 0 },
      tableaus: [
        [card('hearts', 1), card('spades', 13)], // Ace is buried under King
        [], [], [], [], [], [], [],
      ],
    });
    assert.equal(
      getSafeFoundationMoves(stateCovered),
      null,
      'buried Ace must not be returned by safe auto-move',
    );
  }
}

// ============================================================================
// 7. Asia/Taipei Daily Seed generation, dateKey formatting, & streak preservation
// ============================================================================
{
  // 7.1 dateKey timezone shifting (UTC+8) exact boundary tests
  // UTC 15:59:59.999 on Mar 15 -> Taipei 23:59:59.999 on Mar 15
  assert.equal(dateKey(new Date('2026-03-15T15:59:59.999Z')), '2026-03-15');

  // UTC 16:00:00.000 on Mar 15 -> Taipei 00:00:00.000 on Mar 16 (date rolled over!)
  assert.equal(dateKey(new Date('2026-03-15T16:00:00.000Z')), '2026-03-16');

  // UTC 00:00:00 on Mar 15 -> Taipei 08:00:00 on Mar 15
  assert.equal(dateKey(new Date('2026-03-15T00:00:00.000Z')), '2026-03-15');

  // Year boundary rollover in Taipei:
  // UTC 15:59:59 on Dec 31, 2026 -> Taipei 23:59:59 on Dec 31, 2026
  assert.equal(dateKey(new Date('2026-12-31T15:59:59.000Z')), '2026-12-31');
  // UTC 16:00:00 on Dec 31, 2026 -> Taipei 00:00:00 on Jan 1, 2027
  assert.equal(dateKey(new Date('2026-12-31T16:00:00.000Z')), '2027-01-01');

  // Leap year boundary in Taipei:
  // 2024 is a leap year; UTC 16:00 on Feb 28, 2024 -> Taipei Feb 29, 2024
  assert.equal(dateKey(new Date('2024-02-28T16:00:00.000Z')), '2024-02-29');
  // UTC 16:00 on Feb 29, 2024 -> Taipei Mar 1, 2024
  assert.equal(dateKey(new Date('2024-02-29T16:00:00.000Z')), '2024-03-01');

  // Non-leap year: 2026 Feb 28 rolls directly into Mar 1
  assert.equal(dateKey(new Date('2026-02-28T16:00:00.000Z')), '2026-03-01');

  // 7.2 dailySeedCode and dailyBaseSeed determinism
  assert.equal(dailySeedCode('2026-03-15'), 'freecell-daily-2026-03-15');
  const seedA1 = dailyBaseSeed('2026-03-15');
  const seedA2 = dailyBaseSeed('2026-03-15');
  assert.equal(seedA1, seedA2, 'dailyBaseSeed must be strictly deterministic');
  assert.ok(typeof seedA1 === 'number' && seedA1 > 0);

  // Distinct daily seeds across consecutive calendar days
  const marchSeeds = new Set();
  for (let day = 1; day <= 31; day++) {
    const key = `2026-03-${String(day).padStart(2, '0')}`;
    const seed = dailyBaseSeed(key);
    assert.equal(marchSeeds.has(seed), false, `Seed for ${key} must be unique`);
    marchSeeds.add(seed);
  }
  assert.equal(marchSeeds.size, 31);

  // 7.3 Streak computation: preservation, unbroken chains, and missing days
  const rec = (date, won = true) => ({
    date,
    won,
    score: 100,
    elapsedSec: 120,
    moves: 45,
    playMode: 'classic',
    freeCellSlots: 4,
  });

  // Scenario 1: Played and won today -> streak = 1
  assert.equal(computeStreak([rec('2026-03-15')], '2026-03-15'), 1);

  // Scenario 2: Won today and yesterday -> streak = 2
  assert.equal(
    computeStreak([rec('2026-03-14'), rec('2026-03-15')], '2026-03-15'),
    2,
  );

  // Scenario 3: Has NOT played today yet, but won yesterday -> streak preserved!
  assert.equal(
    computeStreak([rec('2026-03-14')], '2026-03-15'),
    1,
    'streak must survive if yesterday was won and today is not yet played',
  );
  assert.equal(
    computeStreak([rec('2026-03-13'), rec('2026-03-14')], '2026-03-15'),
    2,
    '2-day streak preserved pending today play',
  );

  // Scenario 4: Missed yesterday (no win yesterday, no win today) -> streak broken (0)
  assert.equal(
    computeStreak([rec('2026-03-13')], '2026-03-15'),
    0,
    'missed yesterday resets streak to 0',
  );
  assert.equal(
    computeStreak([rec('2026-03-10'), rec('2026-03-11')], '2026-03-15'),
    0,
  );

  // Scenario 5: Played today after breaking streak -> fresh streak of 1
  assert.equal(
    computeStreak([rec('2026-03-10'), rec('2026-03-15')], '2026-03-15'),
    1,
    'win today starts new streak even if gap preceded it',
  );

  // Scenario 6: Losses do not extend streak, but preserved win survives
  assert.equal(
    computeStreak([rec('2026-03-14', true), rec('2026-03-15', false)], '2026-03-15'),
    1,
    'loss today preserves yesterday win streak',
  );

  // Scenario 7: Multiple plays on the same day (duplicate deduplication)
  assert.equal(
    computeStreak(
      [
        rec('2026-03-14', true),
        rec('2026-03-14', true),
        rec('2026-03-15', false),
        rec('2026-03-15', true),
        rec('2026-03-15', true),
      ],
      '2026-03-15',
    ),
    2,
    'multiple wins on same date must be deduplicated to 1 day each',
  );

  // Scenario 8: Out of order records
  assert.equal(
    computeStreak(
      [rec('2026-03-15'), rec('2026-03-13'), rec('2026-03-14'), rec('2026-03-12')],
      '2026-03-15',
    ),
    4,
    'scrambled record order must compute correct streak',
  );

  // Scenario 9: Month boundary streak (Feb 27 -> Mar 2 in non-leap year 2026)
  assert.equal(
    computeStreak(
      [
        rec('2026-02-27'),
        rec('2026-02-28'),
        rec('2026-03-01'),
        rec('2026-03-02'),
      ],
      '2026-03-02',
    ),
    4,
    'streak spanning month boundary (Feb 28 -> Mar 1) is preserved',
  );

  // Scenario 10: Year boundary streak (Dec 30 -> Jan 2)
  assert.equal(
    computeStreak(
      [
        rec('2025-12-30'),
        rec('2025-12-31'),
        rec('2026-01-01'),
        rec('2026-01-02'),
      ],
      '2026-01-02',
    ),
    4,
    'streak spanning year boundary (Dec 31 -> Jan 1) is preserved',
  );
}

// ============================================================================
// 8. Solvability Heuristics, Solver Bounds & Par Estimation
// ============================================================================
{
  // Near-won board with 1 card remaining
  const almost = emptyState({
    foundations: { spades: 12, hearts: 13, diamonds: 13, clubs: 13 },
    tableaus: [[card('spades', 13)], [], [], [], [], [], [], []],
  });
  const solved = solveSync(almost, { maxNodes: 200 });
  assert.ok(solved, 'near-won board should solve');
  assert.equal(solved.path.length, 1);
  assert.equal(solved.path[0].source.zone, 'tableau');
  assert.equal(solved.path[0].dest.zone, 'foundation');

  // Near-won board with 2 cards remaining
  const twoCardsLeft = emptyState({
    foundations: { spades: 12, hearts: 12, diamonds: 13, clubs: 13 },
    tableaus: [[card('spades', 13)], [card('hearts', 13)], [], [], [], [], [], []],
  });
  const solvedTwo = solveSync(twoCardsLeft, { maxNodes: 500 });
  assert.ok(solvedTwo, 'two-card near-won board should solve');
  assert.equal(solvedTwo.path.length, 2);

  // Difficulty classification boundaries
  assert.equal(classifyDifficulty(30), 'easy');
  assert.equal(classifyDifficulty(52), 'easy', 'par 52 is easy upper bound');
  assert.equal(classifyDifficulty(53), 'medium', 'par 53 is medium lower bound');
  assert.equal(classifyDifficulty(65), 'medium');
  assert.equal(classifyDifficulty(78), 'medium', 'par 78 is medium upper bound');
  assert.equal(classifyDifficulty(79), 'hard', 'par 79 is hard');
  assert.equal(classifyDifficulty(120), 'hard');
  assert.equal(classifyDifficulty(null), 'hard', 'unsolvable deal treated as hard');

  // dealForDifficulty('any') returns immediately without running solver
  const metaAny = dealForDifficulty('any', 42, { maxNodes: 500 }, 1);
  assert.equal(metaAny.seed, 42);
  assert.equal(metaAny.parMoves, null);
  assert.equal(metaAny.difficulty, 'any');

  // Par estimation on standard deal seed 1
  const deal1 = dealGame(1);
  const par = estimateParMoves(deal1.tableaus, { maxNodes: 1000 });
  assert.ok(['easy', 'medium', 'hard'].includes(classifyDifficulty(par)));
}

// ============================================================================
// 9. Microsoft Classic Deals, Deck Generation & Determinism Invariants
// ============================================================================
{
  // Deal 11982 is the famous Microsoft unsolvable deal
  const deal11982_A = dealGame(11982);
  const deal11982_B = dealGame(11982);
  assert.equal(deal11982_A.seed, 11982);
  assert.deepEqual(
    deal11982_A.tableaus.map((col) => col.map((c) => c.id)),
    deal11982_B.tableaus.map((col) => col.map((c) => c.id)),
    'deal 11982 must be completely deterministic',
  );

  // Invariant: 52 cards total across 8 tableaus
  const totalCards = deal11982_A.tableaus.reduce((acc, col) => acc + col.length, 0);
  assert.equal(totalCards, 52, 'total cards in deal must be 52');

  // Columns 0..3 have 7 cards; columns 4..7 have 6 cards
  for (let i = 0; i < 4; i++) {
    assert.equal(deal11982_A.tableaus[i].length, 7, `column ${i} must have 7 cards`);
  }
  for (let i = 4; i < 8; i++) {
    assert.equal(deal11982_A.tableaus[i].length, 6, `column ${i} must have 6 cards`);
  }

  // All 52 distinct cards present with no duplicates
  const allCardIds = new Set(deal11982_A.tableaus.flatMap((col) => col.map((c) => c.id)));
  assert.equal(allCardIds.size, 52, 'every card in the 52-card deck must be unique');

  // Check legendary deals catalogue
  assert.equal(LEGENDARY_DEALS.length, 5);
  const seeds = LEGENDARY_DEALS.map((d) => d.seed);
  assert.ok(seeds.includes(11982), 'must include #11982');
  assert.ok(seeds.includes(617), 'must include #617');
  assert.ok(seeds.includes(1941), 'must include #1941');
  assert.ok(seeds.includes(10692), 'must include #10692');
  assert.ok(seeds.includes(1), 'must include #1');

  // Master tips catalogue
  assert.equal(MASTER_TIPS.length, 5);
  for (const tip of MASTER_TIPS) {
    assert.ok(typeof tip.title === 'string' && tip.title.length > 0);
    assert.ok(typeof tip.detail === 'string' && tip.detail.length > 0);
  }
}

// ============================================================================
// 10. Tactical Radar, Trapped Key Cards, & Solution Route Telemetry
// ============================================================================
{
  const stateComplex = emptyState({
    freeCells: [card('spades', 1), null, null, null],
    tableaus: [
      [card('hearts', 13), card('spades', 2)],
      [card('diamonds', 1), card('clubs', 7)],
      [],
      [],
      [],
      [],
      [],
      [],
    ],
  });

  const safeCards = getAllSafeFoundationCards(stateComplex, 4);
  assert.ok(safeCards.length >= 1);
  assert.equal(safeCards[0].card.suit, 'spades');
  assert.equal(safeCards[0].card.rank, 1);

  const trapped = getTrappedKeyCards(stateComplex);
  assert.ok(Array.isArray(trapped));

  const telemetry = getSolutionRouteTelemetry(stateComplex, 4);
  assert.ok(telemetry.supermove);
  assert.ok(telemetry.mobilityPercent >= 0);
  assert.ok(telemetry.riskIndex >= 0);
  assert.ok(['low', 'medium', 'high', 'critical'].includes(telemetry.riskLevel));
  assert.ok(typeof telemetry.recommendedRoute === 'string');
  assert.ok(telemetry.recommendedRoute.length > 0);
}

// ============================================================================
// 11. Luxury Workshop Themes & Layout Fan Verification
// ============================================================================
{
  // Theme definitions and transitions
  assert.ok(WORKSHOP_THEMES['royal-velvet']);
  assert.ok(WORKSHOP_THEMES['obsidian-gold']);
  assert.ok(WORKSHOP_THEMES['cyber-neon']);
  assert.equal(getNextTheme('royal-velvet'), 'obsidian-gold');
  assert.equal(getNextTheme('obsidian-gold'), 'cyber-neon');
  assert.equal(getNextTheme('cyber-neon'), 'royal-velvet');

  // Layout Fan CSS verification
  const cssPath = fileURLToPath(new URL('./index.css', import.meta.url));
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(
    css,
    /\.fc-tableau-slot--stacked\s*\{[^}]*margin-top:\s*calc\(-150%\s*\+\s*var\(--fc-fan-peek\)\)/s,
  );
  assert.match(css, /--fc-fan-peek:\s*calc\(var\(--fc-corner-size\)\s*\*\s*2\.35/);
  assert.equal(FC_FAN.aspectHeightPercent, 150);
  assert.equal(FC_FAN.stackedMarginCss, 'calc(-150% + var(--fc-fan-peek))');

  const appPath = fileURLToPath(new URL('./App.tsx', import.meta.url));
  const app = fs.readFileSync(appPath, 'utf8');
  assert.equal(
    app.includes('-mt-[115%]'),
    false,
    'legacy fixed tableau fan class must stay removed',
  );
}

// ============================================================================
// 12. Storage, Stats & Mode Key Invariants
// ============================================================================
{
  assert.equal(modeKey('classic', 4), 'classic-4');
  assert.equal(modeKey('classic', 2), 'classic-2');
  assert.equal(modeKey('timed', 4), 'timed-4');
  assert.equal(modeKey('timed', 2), 'timed-2');

  const emptyStats = {
    plays: 0,
    wins: 0,
    currentStreak: 0,
    bestStreak: 0,
    byMode: {},
    byDeal: {},
    challengesCleared: {},
  };
  assert.equal(winRate(emptyStats), 0);

  const stats1 = recordGameResult(emptyStats, {
    won: true,
    playMode: 'classic',
    freeCellSlots: 4,
    seed: 42,
    score: 150,
    elapsedSec: 85,
    moves: 48,
    clearedChallenges: ['no-undo'],
  });
  assert.equal(stats1.wins, 1);
  assert.equal(stats1.plays, 1);
  assert.equal(winRate(stats1), 1);
  assert.equal(stats1.byMode['classic-4']?.bestScore, 150);
  assert.equal(stats1.byDeal['42']?.bestMoves, 48);
  assert.equal(stats1.challengesCleared['no-undo'], 1);

  const stats2 = recordGameResult(stats1, {
    won: false,
    playMode: 'classic',
    freeCellSlots: 4,
    seed: 42,
    score: 50,
    elapsedSec: 120,
    moves: 60,
    clearedChallenges: [],
  });
  assert.equal(stats2.wins, 1);
  assert.equal(stats2.plays, 2);
  assert.equal(winRate(stats2), 0.5);
  // Best score and moves should preserve prior winning result
  assert.equal(stats2.byMode['classic-4']?.bestScore, 150);
  assert.equal(stats2.byDeal['42']?.bestMoves, 48);
}

// ============================================================================
// 13. Strict Traditional Chinese Compliance (Zero Simplified Chinese)
// ============================================================================
{
  // Unicode escapes for common simplified Chinese characters to avoid raw SC in source code:
  const scStrict = [
    '\u5f20', '\u95e8', '\u5173', '\u8fd9', '\u4e3a', '\u4e66', '\u957f', '\u89c1',
    '\u5b66', '\u56fd', '\u4f53', '\u5199', '\u5355', '\u4ec5', '\u4ece', '\u4e0e',
    '\u5bf9', '\u6b22', '\u753b', '\u7ebf', '\u8fde', '\u5b9e', '\u65f6', '\u8ba1', '\u52a8',
  ];
  const filesToCheck = [
    fileURLToPath(new URL('./App.tsx', import.meta.url)),
    fileURLToPath(new URL('./utils/tactics.ts', import.meta.url)),
    fileURLToPath(new URL('./utils/theme.ts', import.meta.url)),
    fileURLToPath(new URL('./utils/soundEffects.ts', import.meta.url)),
    fileURLToPath(new URL('./components/SupermoveWaveBanner.tsx', import.meta.url)),
    fileURLToPath(new URL('./components/PlayingCard.tsx', import.meta.url)),
    fileURLToPath(new URL('./components/TacticalLeftWing.tsx', import.meta.url)),
    fileURLToPath(new URL('./components/TacticalRightWing.tsx', import.meta.url)),
    fileURLToPath(new URL('./components/TacticalMobileBar.tsx', import.meta.url)),
    fileURLToPath(new URL('./components/KeyboardShortcutsModal.tsx', import.meta.url)),
    fileURLToPath(new URL('../../../01-cards/freecell.md', import.meta.url)),
  ];

  for (const filePath of filesToCheck) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const sc of scStrict) {
        assert.equal(
          content.includes(sc),
          false,
          `File ${filePath} contains simplified Chinese character "${sc}"`,
        );
      }
    }
  }
}

console.log('check-freecell: ok');
