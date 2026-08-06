// ponytail: covers opening legality and flip counts, not the full bot search.
import {
  createInitialBoard,
  getLegalMoves,
  getFlips,
  applyMove,
  countPieces,
  isLegalMove,
} from './utils/reversiLogic.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sameCells(a, b) {
  if (a.length !== b.length) return false;
  const key = ([r, c]) => `${r},${c}`;
  const set = new Set(a.map(key));
  return b.every((cell) => set.has(key(cell)));
}

const board = createInitialBoard();
const { black, white } = countPieces(board);
assert(black === 2 && white === 2, `opening should be 2/2, got ${black}/${white}`);

// Classic Othello: black to play has exactly these four opening squares.
const openingBlack = getLegalMoves(board, 'black');
const expectedOpening = [
  [2, 3],
  [3, 2],
  [4, 5],
  [5, 4],
];
assert(
  sameCells(openingBlack, expectedOpening),
  `black opening moves should be ${JSON.stringify(expectedOpening)}, got ${JSON.stringify(openingBlack)}`,
);

// White on the same position also has four symmetric replies (not played yet).
const openingWhite = getLegalMoves(board, 'white');
const expectedWhite = [
  [2, 4],
  [3, 5],
  [4, 2],
  [5, 3],
];
assert(
  sameCells(openingWhite, expectedWhite),
  `white opening moves should be ${JSON.stringify(expectedWhite)}, got ${JSON.stringify(openingWhite)}`,
);

// (2,3) flips the single white disc at (3,3).
const flipsAt23 = getFlips(board, 2, 3, 'black');
assert(sameCells(flipsAt23, [[3, 3]]), `black (2,3) should flip (3,3), got ${JSON.stringify(flipsAt23)}`);
assert(isLegalMove(board, 2, 3, 'black'), '(2,3) must be legal for black');
assert(!isLegalMove(board, 0, 0, 'black'), 'corner is empty but illegal on move 1');
assert(getFlips(board, 0, 0, 'black').length === 0, 'illegal square yields no flips');

const after = applyMove(board, 2, 3, 'black');
assert(after[2][3] === 'black', 'placed disc must sit at (2,3)');
assert(after[3][3] === 'black', '(3,3) must flip to black');
assert(after[3][4] === 'black' && after[4][3] === 'black' && after[4][4] === 'white', 'other opening discs unchanged');

const afterCount = countPieces(after);
assert(afterCount.black === 4 && afterCount.white === 1, `after (2,3) expect 4/1, got ${afterCount.black}/${afterCount.white}`);

// Occupied cell is never legal and never flips.
assert(!isLegalMove(after, 3, 4, 'white'), 'occupied cell is illegal');
assert(getFlips(after, 3, 4, 'white').length === 0, 'occupied cell yields no flips');

console.log('check-reversi: ok');
