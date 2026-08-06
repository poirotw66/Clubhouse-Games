// ponytail: covers draw-1/3 and legal-move hints; not full deal solvability.
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

console.log('check-klondike: ok');
