// ponytail: core win / gravity / legal-column checks for Connect Four.
import {
  createInitialBoard,
  getDropRow,
  getLegalColumns,
  dropPiece,
  hasWonAt,
  isBoardFull,
  COLS,
  ROWS,
} from './utils/connect4Logic.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Empty board: every column is legal; drop lands on bottom row.
{
  const board = createInitialBoard();
  const legal = getLegalColumns(board);
  assert(legal.length === COLS, `empty board should have ${COLS} legal columns`);
  assert(legal.every((c, i) => c === i), 'legal columns should be 0..6 in order');
  for (let c = 0; c < COLS; c++) {
    assert(getDropRow(board, c) === ROWS - 1, `empty col ${c} should drop to row ${ROWS - 1}`);
  }
}

// Gravity: successive drops stack upward; full column becomes illegal.
{
  let board = createInitialBoard();
  for (let i = 0; i < ROWS; i++) {
    const row = getDropRow(board, 0);
    assert(row === ROWS - 1 - i, `drop ${i} in col 0 should land on row ${ROWS - 1 - i}`);
    const next = dropPiece(board, 0, i % 2 === 0 ? 'red' : 'yellow');
    assert(next, `drop ${i} in col 0 should succeed`);
    board = next;
  }
  assert(getDropRow(board, 0) === null, 'full column should have no drop row');
  assert(!getLegalColumns(board).includes(0), 'full column should not be legal');
  assert(dropPiece(board, 0, 'red') === null, 'drop into full column should return null');
}

// Horizontal win through the last piece.
{
  let board = createInitialBoard();
  for (const c of [0, 1, 2]) {
    board = dropPiece(board, c, 'red');
  }
  board = dropPiece(board, 3, 'red');
  const row = ROWS - 1;
  assert(hasWonAt(board, row, 3, 'red'), 'four in a bottom row should win');
  assert(!hasWonAt(board, row, 3, 'yellow'), 'opponent should not win on red line');
}

// Vertical win.
{
  let board = createInitialBoard();
  for (let i = 0; i < 4; i++) {
    board = dropPiece(board, 2, 'yellow');
  }
  assert(hasWonAt(board, ROWS - 4, 2, 'yellow'), 'four stacked in one column should win');
}

// Diagonal win (bottom-left to top-right).
{
  let board = createInitialBoard();
  // Build stairs so diagonal lands: (5,0)(4,1)(3,2)(2,3) yellow.
  board = dropPiece(board, 0, 'yellow');
  board = dropPiece(board, 1, 'red');
  board = dropPiece(board, 1, 'yellow');
  board = dropPiece(board, 2, 'red');
  board = dropPiece(board, 2, 'red');
  board = dropPiece(board, 2, 'yellow');
  board = dropPiece(board, 3, 'red');
  board = dropPiece(board, 3, 'red');
  board = dropPiece(board, 3, 'red');
  board = dropPiece(board, 3, 'yellow');
  assert(hasWonAt(board, 2, 3, 'yellow'), 'ascending diagonal of four should win');
}

// Full board detection (no need for a real draw position).
{
  const board = createInitialBoard().map((row, r) =>
    row.map((_, c) => ((r + c) % 2 === 0 ? 'red' : 'yellow'))
  );
  assert(isBoardFull(board), 'filled board should report full');
  assert(getLegalColumns(board).length === 0, 'full board should have no legal columns');
}

console.log('check-connect4: ok');
