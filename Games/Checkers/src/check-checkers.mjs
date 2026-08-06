// ponytail: opening legality, forced capture, and win detection — not the full bot search.
import {
  createInitialBoard,
  getLegalMoves,
  getLegalMovesFrom,
  applyMove,
  countPieces,
  getWinner,
  isDarkSquare,
} from './utils/checkersLogic.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function moveKey(m) {
  return `${m.from[0]},${m.from[1]}→${m.path.map(([r, c]) => `${r},${c}`).join('|')}`;
}

function sameMoveSet(a, b) {
  if (a.length !== b.length) return false;
  const set = new Set(a.map(moveKey));
  return b.every((m) => set.has(moveKey(m)));
}

// Opening: 12 / 12 on dark squares only.
{
  const board = createInitialBoard();
  const { black, white } = countPieces(board);
  assert(black === 12 && white === 12, `opening should be 12/12, got ${black}/${white}`);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (cell) assert(isDarkSquare(r, c), `piece on light square ${r},${c}`);
    }
  }
}

// Black to move: only quiet forward steps from the front rank (row 5).
{
  const board = createInitialBoard();
  const moves = getLegalMoves(board, 'black');
  assert(moves.length === 7, `black opening should have 7 quiet moves, got ${moves.length}`);
  assert(
    moves.every((m) => m.path.length === 2),
    'opening must be quiet (no captures yet)',
  );
  for (const m of moves) {
    assert(m.from[0] === 5, `opening black move must start on row 5, got ${m.from[0]}`);
    assert(m.path[1][0] === 4, `opening black step must land on row 4, got ${m.path[1][0]}`);
  }
}

// Forced capture: place a white man that black must jump.
{
  const board = createInitialBoard();
  // Clear a corridor and set up black (5,2) jumping white (4,3) → (3,4).
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      board[r][c] = null;
    }
  }
  board[5][2] = { color: 'black', king: false };
  board[4][3] = { color: 'white', king: false };
  const moves = getLegalMoves(board, 'black');
  assert(moves.length === 1, `forced single jump should be unique, got ${moves.length}`);
  // Capture path is [from, ...landings]; a single jump has length 2.
  assert(moves[0].path.length === 2, `single jump path length 2, got ${moves[0].path.length}`);
  assert(
    moves[0].from[0] === 5 && moves[0].from[1] === 2,
    'capture must start at (5,2)',
  );
  assert(
    moves[0].path[1][0] === 3 && moves[0].path[1][1] === 4,
    'capture must land at (3,4)',
  );

  const after = applyMove(board, moves[0]);
  assert(after[5][2] === null, 'origin must clear');
  assert(after[4][3] === null, 'jumped piece must be removed');
  assert(after[3][4]?.color === 'black', 'jumper must land at (3,4)');
  const counts = countPieces(after);
  assert(counts.black === 1 && counts.white === 0, `after jump expect 1/0, got ${counts.black}/${counts.white}`);
}

// Multi-jump continuation: after landing, getLegalMovesFrom only offers further jumps.
{
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[5][2] = { color: 'black', king: false };
  board[4][3] = { color: 'white', king: false };
  board[2][5] = { color: 'white', king: false };
  const first = getLegalMoves(board, 'black');
  assert(first.length >= 1, 'setup must allow a capture');
  // Full sequence captures both whites: path [from, land1, land2] length 3.
  const long = first.reduce((a, b) => (a.path.length >= b.path.length ? a : b));
  assert(long.path.length === 3, `double jump path length 3, got ${long.path.length}`);
  const midBoard = applyMove(board, {
    from: long.from,
    path: long.path.slice(0, 2),
  });
  const [midR, midC] = long.path[1];
  const cont = getLegalMovesFrom(midBoard, 'black', midR, midC);
  assert(cont.length >= 1, 'continuation after first hop must exist');
  assert(
    cont.every((m) => m.path.length >= 2 && Math.abs(m.path[1][0] - m.from[0]) === 2),
    'continuation must be a jump when the second capture is available',
  );
}

// Win: side with no pieces loses; side with pieces but no moves loses.
{
  const emptyOpp = Array.from({ length: 8 }, () => Array(8).fill(null));
  emptyOpp[7][0] = { color: 'black', king: false };
  assert(getWinner(emptyOpp, 'white') === 'black', 'no white pieces → black wins');

  const blocked = Array.from({ length: 8 }, () => Array(8).fill(null));
  // White man on the last rank cannot step forward off the board.
  blocked[7][0] = { color: 'white', king: false };
  blocked[5][2] = { color: 'black', king: false };
  assert(getLegalMoves(blocked, 'white').length === 0, 'white should have no legal moves');
  assert(getWinner(blocked, 'white') === 'black', 'no moves for white → black wins');
  assert(getWinner(blocked, 'black') === null, 'black still has moves → game live');
}

// Same move set stability: opening black moves are deterministic.
{
  const a = getLegalMoves(createInitialBoard(), 'black');
  const b = getLegalMoves(createInitialBoard(), 'black');
  assert(sameMoveSet(a, b), 'opening legal set must be stable');
}

console.log('check-checkers: ok');
