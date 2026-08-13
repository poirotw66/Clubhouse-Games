import assert from 'node:assert/strict';
import {
  emptyIndex,
  isSolvable,
  isSolved,
  neighborsOfEmpty,
  scrambleBoard,
  slide,
  shuffledBoard,
  solvedBoard,
} from './fifteenLogic.ts';

assert.equal(solvedBoard().length, 16);
assert.ok(isSolved(solvedBoard()));
assert.ok(isSolvable(solvedBoard()));

const one = slide(solvedBoard(), 14);
assert.ok(one);
assert.equal(emptyIndex(one), 14);
assert.ok(neighborsOfEmpty(one).length >= 2);

let seed = 1;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};
for (let i = 0; i < 20; i++) {
  const b = shuffledBoard(rand);
  assert.ok(isSolvable(b));
  assert.ok(!isSolved(b));
}
for (const tier of ['easy', 'normal', 'hard']) {
  for (let i = 0; i < 10; i++) {
    const b = scrambleBoard(/** @type {any} */ (tier), rand);
    assert.ok(isSolvable(b));
    assert.ok(!isSolved(b));
  }
}

console.log('fifteen-puzzle check ok');
