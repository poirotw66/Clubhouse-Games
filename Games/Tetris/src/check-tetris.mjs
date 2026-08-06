// ponytail: core pure-logic checks for Tetris; not a full playthrough.
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  clearLines,
  collides,
  createEmptyBoard,
  isGoalMet,
  mergePiece,
  movePiece,
  rotatePiece,
  spawnPiece,
  tryRotateWithKick,
} from './utils/tetrisLogic.ts';

function fillRow(board, row, type = 'I') {
  for (let c = 0; c < BOARD_SIZE.cols; c++) board[row][c] = type;
}

// Spawn: I piece starts above the visible board, centered-ish at col 3.
{
  const piece = spawnPiece('I');
  assert.equal(piece.rotation, 0);
  assert.equal(piece.position.row, -1);
  assert.equal(piece.position.col, 3);
  const board = createEmptyBoard();
  assert.equal(collides(board, piece), false, 'spawn on empty board must be legal');
}

// Lock: merge writes cells; a piece that cannot drop further collides on move down.
{
  const board = createEmptyBoard();
  const piece = spawnPiece('O');
  piece.position = { row: BOARD_SIZE.rows - 2, col: 4 };
  assert.equal(movePiece(board, piece, 1, 0), null, 'O on floor cannot drop');
  const locked = mergePiece(board, piece);
  assert.equal(locked[BOARD_SIZE.rows - 2][5], 'O');
  assert.equal(locked[BOARD_SIZE.rows - 1][5], 'O');
  assert.equal(board[BOARD_SIZE.rows - 2][5], null, 'merge must not mutate input');
}

// Line clears: full rows vanish and empty rows are pushed from the top.
{
  const board = createEmptyBoard();
  fillRow(board, BOARD_SIZE.rows - 1, 'T');
  fillRow(board, BOARD_SIZE.rows - 2, 'J');
  board[BOARD_SIZE.rows - 3][0] = 'L';
  const { board: next, linesCleared } = clearLines(board);
  assert.equal(linesCleared, 2);
  assert.equal(next[BOARD_SIZE.rows - 1][0], 'L');
  assert.equal(
    next[0].every((c) => c === null),
    true,
    'cleared lines should insert empty rows at top',
  );
}

// Partial row is not cleared.
{
  const board = createEmptyBoard();
  fillRow(board, BOARD_SIZE.rows - 1, 'S');
  board[BOARD_SIZE.rows - 1][0] = null;
  const { linesCleared } = clearLines(board);
  assert.equal(linesCleared, 0);
}

// Rotate cycles 0→1→2→3→0; kick keeps a wall-scraping T legal.
{
  const t = spawnPiece('T');
  assert.equal(rotatePiece(t, 1).rotation, 1);
  assert.equal(rotatePiece(rotatePiece(t, 1), 1).rotation, 2);
  assert.equal(rotatePiece(t, -1).rotation, 3);

  const board = createEmptyBoard();
  const againstWall = {
    type: 'T',
    rotation: 0,
    position: { row: 10, col: -1 },
  };
  // Flat T at col -1 has the left arm off-board; kick should shift right.
  assert.equal(collides(board, againstWall), true);
  const kicked = tryRotateWithKick(board, againstWall, 1);
  assert.equal(kicked.rotation, 1);
  assert.equal(collides(board, kicked), false, 'SRS kick should resolve wall collision');
}

// tryRotateWithKick returns the original piece when every kick collides.
{
  const board = createEmptyBoard();
  // Surround a T so no kick fits.
  for (let r = 8; r <= 12; r++) {
    for (let c = 3; c <= 6; c++) board[r][c] = 'I';
  }
  board[10][4] = null;
  board[10][5] = null;
  board[11][4] = null;
  const trapped = { type: 'T', rotation: 0, position: { row: 9, col: 3 } };
  const result = tryRotateWithKick(board, trapped, 1);
  assert.deepEqual(result, trapped, 'blocked rotate must leave piece unchanged');
}

// Mode goals: sprint = 40 lines; ultra = 2 minutes; marathon never.
{
  assert.equal(isGoalMet('sprint', 39, 0), false);
  assert.equal(isGoalMet('sprint', 40, 0), true);
  assert.equal(isGoalMet('sprint', 41, 999), true);

  assert.equal(isGoalMet('ultra', 0, 2 * 60 * 1000 - 1), false);
  assert.equal(isGoalMet('ultra', 0, 2 * 60 * 1000), true);
  assert.equal(isGoalMet('ultra', 999, 2 * 60 * 1000 + 1), true);

  assert.equal(isGoalMet('marathon', 999, 9_999_999), false);
}

console.log('check-tetris: ok');
