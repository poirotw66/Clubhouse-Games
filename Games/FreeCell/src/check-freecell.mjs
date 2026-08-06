// ponytail: covers cascade move caps + hint preference; not full solvability.
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
import { dealGame } from './utils/deck.ts';

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
  assert.equal(
    isValidSequence([card('spades', 7), card('clubs', 6)]),
    false,
  );
}

// Freecell supermove formula: (emptyCells + 1) * 2^emptyTableaus.
{
  assert.equal(getMaxMoveCount(0, 0, false), 1);
  assert.equal(getMaxMoveCount(1, 0, false), 2);
  assert.equal(getMaxMoveCount(0, 1, false), 2);
  assert.equal(getMaxMoveCount(1, 1, false), 4);
  // Moving into an empty tableau spends one empty column.
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

  afterAce.tableaus[0] = [card('hearts', 3)];
  assert.equal(
    canMove(
      afterAce,
      { zone: 'tableau', index: 0, cardIndex: 0 },
      { zone: 'foundation', index: 0 },
    ),
    false,
  );
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
  assert.equal(
    canMove(
      state,
      { zone: 'tableau', index: 1, cardIndex: 0 },
      { zone: 'tableau', index: 2 },
    ),
    true,
  );
}

// Cascade length blocked by empty freecell/tableau budget.
{
  const state = emptyState({
    freeCells: [card('clubs', 2), card('diamonds', 3), card('hearts', 4), card('spades', 5)],
    tableaus: [
      [card('spades', 10), card('hearts', 9), card('clubs', 8)],
      [card('diamonds', 9)],
      [card('spades', 1)],
      [card('hearts', 1)],
      [card('clubs', 1)],
      [card('diamonds', 1)],
      [card('spades', 2)],
      [card('hearts', 2)],
    ],
  });
  // 0 empty freecells, 0 empty tableaus → max 1 card.
  assert.equal(getMaxMoveCount(0, 0, false), 1);
  assert.equal(
    canMove(
      state,
      { zone: 'tableau', index: 0, cardIndex: 0 },
      { zone: 'tableau', index: 1 },
    ),
    false,
  );
  assert.equal(
    canMove(
      state,
      { zone: 'tableau', index: 0, cardIndex: 2 },
      { zone: 'tableau', index: 1 },
    ),
    true,
  );
}

// FreeCell accepts a single card only.
{
  const state = emptyState({
    tableaus: [[card('spades', 5), card('hearts', 4)], [], [], [], [], [], [], []],
  });
  assert.equal(
    canMove(
      state,
      { zone: 'tableau', index: 0, cardIndex: 0 },
      { zone: 'freeCell', index: 0 },
    ),
    false,
  );
  assert.equal(
    canMove(
      state,
      { zone: 'tableau', index: 0, cardIndex: 1 },
      { zone: 'freeCell', index: 0 },
    ),
    true,
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
  assert.equal(hint.source.zone, 'tableau');
}

// Safe auto-move exposes Ace-like ranks.
{
  const state = emptyState({
    freeCells: [card('spades', 1), null, null, null],
  });
  const move = getSafeFoundationMoves(state);
  assert.ok(move, 'freecell ace should be safe to auto-move');
  assert.equal(move.source.zone, 'freeCell');
  assert.equal(move.dest.zone, 'foundation');
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
  const c = dealGame(42);
  assert.notDeepEqual(
    a.tableaus.map((col) => col.map((c) => c.id)),
    c.tableaus.map((col) => col.map((c) => c.id)),
  );
}

console.log('check-freecell: ok');
