// Core pure-logic checks for Tetris (SRS, T-Spin, B2B, garbage, modes).
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  COMBO_GARBAGE,
  SRS_KICK_TABLES,
  applyGarbage,
  cancelGarbage,
  clearLines,
  collides,
  createEmptyBoard,
  detectTSpin,
  formatClearCallouts,
  isGoalMet,
  makeGarbageRow,
  mergePiece,
  movePiece,
  rotatePiece,
  scoreClear,
  spawnPiece,
  tryRotateWithKick,
} from './utils/tetrisLogic.ts';
import {
  DIFFICULTY_PRESETS,
  PLAYER_GARBAGE_DROP_CAP,
  findBestPlacement,
  reachPlacement,
} from './utils/cpuAi.ts';

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

// Rotate cycles 0→1→2→3→0; SRS kick keeps a wall-scraping T legal.
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
  assert.equal(collides(board, againstWall), true);
  const { piece: kicked, kickIndex } = tryRotateWithKick(board, againstWall, 1);
  assert.ok(kickIndex >= 0, 'SRS kick should succeed');
  assert.equal(kicked.rotation, 1);
  assert.equal(collides(board, kicked), false, 'SRS kick should resolve wall collision');
}

// tryRotateWithKick returns the original piece when every kick collides.
{
  const board = createEmptyBoard();
  for (let r = 8; r <= 12; r++) {
    for (let c = 3; c <= 6; c++) board[r][c] = 'I';
  }
  board[10][4] = null;
  board[10][5] = null;
  board[11][4] = null;
  const trapped = { type: 'T', rotation: 0, position: { row: 9, col: 3 } };
  const { piece: result, kickIndex } = tryRotateWithKick(board, trapped, 1);
  assert.equal(kickIndex, -1);
  assert.deepEqual(result, trapped, 'blocked rotate must leave piece unchanged');
}

// SRS tables: JLSTZ and I expose 8 transitions × 5 offsets; O has no table entry path.
{
  const jlstzKeys = Object.keys(SRS_KICK_TABLES.JLSTZ);
  const iKeys = Object.keys(SRS_KICK_TABLES.I);
  assert.equal(jlstzKeys.length, 8);
  assert.equal(iKeys.length, 8);
  for (const key of jlstzKeys) {
    assert.equal(SRS_KICK_TABLES.JLSTZ[key].length, 5, `JLSTZ ${key} needs 5 tests`);
  }
  for (const key of iKeys) {
    assert.equal(SRS_KICK_TABLES.I[key].length, 5, `I ${key} needs 5 tests`);
  }
  // Standard 0→R first kick after origin is (-1, 0) for JLSTZ.
  assert.deepEqual(SRS_KICK_TABLES.JLSTZ['0>1'][1], [-1, 0]);
  // I 0→R second kick is (-2, 0).
  assert.deepEqual(SRS_KICK_TABLES.I['0>1'][1], [-2, 0]);
}

// SRS: I piece against the left wall kicks right into place.
{
  const board = createEmptyBoard();
  const iFlat = { type: 'I', rotation: 0, position: { row: 8, col: -1 } };
  // Horizontal I at col -1 collides; rotate to vertical should kick.
  assert.equal(collides(board, iFlat), true);
  const { piece, kickIndex } = tryRotateWithKick(board, iFlat, 1);
  assert.ok(kickIndex >= 0);
  assert.equal(piece.rotation, 1);
  assert.equal(collides(board, piece), false);
}

// SRS: T against right wall — 0→L uses (+1,0) style kicks.
{
  const board = createEmptyBoard();
  const t = { type: 'T', rotation: 0, position: { row: 10, col: 8 } };
  // Flat T at col 8 has right arm past edge.
  assert.equal(collides(board, t), true);
  const { piece, kickIndex } = tryRotateWithKick(board, t, -1);
  assert.ok(kickIndex >= 0, 'T wall kick CCW should succeed');
  assert.equal(collides(board, piece), false);
}

// SRS: floor kick — T sitting on a ledge rotates with a vertical kick.
{
  const board = createEmptyBoard();
  // Floor at row 19; T flat just above with limited space.
  fillRow(board, 18, 'I');
  board[18][4] = null;
  board[18][5] = null;
  board[18][6] = null;
  const t = { type: 'T', rotation: 2, position: { row: 16, col: 4 } };
  // Pointing down into the well; rotate to R should be able to kick.
  const { kickIndex } = tryRotateWithKick(board, t, 1);
  assert.ok(kickIndex >= 0, 'T floor/well kick should find a slot');
}

// T-Spin Double setup: three corners filled, last action rotate, front corners filled.
{
  const board = createEmptyBoard();
  // Build a classic TSD well around center (row 17, col 4) for T at pos (16, 3) rot 2.
  // Center = (17, 4). Corners NW(16,3) NE(16,5) SW(18,3) SE(18,5).
  board[16][3] = 'I';
  board[16][5] = 'I';
  board[18][3] = 'I';
  board[18][5] = 'I';
  // Fill rows 17-18 except T slot so a double clear is possible after lock.
  for (let c = 0; c < BOARD_SIZE.cols; c++) {
    if (c !== 4) board[17][c] = 'J';
    board[19][c] = 'L';
  }
  board[18][4] = null;
  const t = { type: 'T', rotation: 2, position: { row: 16, col: 3 } };
  const kind = detectTSpin(board, t, 'rotate', 0);
  assert.equal(kind, 'full', '3 corners + both front → full T-Spin');
}

// T-Spin Mini: 3 corners but not both front.
{
  const board = createEmptyBoard();
  // T pointing up (rot 0), center (10,4). Front = NW+NE.
  // Fill NW, SW, SE but leave NE open → 3 corners, front only 1 → mini.
  board[9][3] = 'I'; // NW
  board[11][3] = 'I'; // SW
  board[11][5] = 'I'; // SE
  const t = { type: 'T', rotation: 0, position: { row: 9, col: 3 } };
  assert.equal(detectTSpin(board, t, 'rotate', 0), 'mini');
  assert.equal(detectTSpin(board, t, 'move', 0), 'none', 'must be last-action rotate');
  assert.equal(detectTSpin(board, t, 'rotate', 4), 'full', 'kick 4 upgrades mini to full');
}

// T-Spin: fewer than 3 corners → none.
{
  const board = createEmptyBoard();
  board[9][3] = 'I';
  board[9][5] = 'I';
  const t = { type: 'T', rotation: 0, position: { row: 9, col: 3 } };
  assert.equal(detectTSpin(board, t, 'rotate', 0), 'none');
}

// Non-T piece never T-Spins.
{
  const board = createEmptyBoard();
  for (let r = 8; r <= 12; r++) {
    for (let c = 3; c <= 6; c++) board[r][c] = 'I';
  }
  const j = { type: 'J', rotation: 0, position: { row: 9, col: 3 } };
  assert.equal(detectTSpin(board, j, 'rotate', 0), 'none');
}

// Immobile T with 3+ corners after rotate.
{
  const board = createEmptyBoard();
  board[10][3] = 'I';
  board[10][5] = 'I';
  board[12][3] = 'I';
  board[12][5] = 'I';
  const t = { type: 'T', rotation: 0, position: { row: 10, col: 3 } };
  // Center (11,4); corners at (10,3)(10,5)(12,3)(12,5) — all filled → full.
  assert.equal(detectTSpin(board, t, 'rotate', 1), 'full');
}

// Scoring: guideline bases × level, B2B ×1.5, combo, attack table.
{
  const single = scoreClear({
    linesCleared: 1,
    level: 2,
    tSpin: 'none',
    backToBackReady: false,
    combo: 0,
    perfectClear: false,
    softDropRows: 0,
    hardDropRows: 0,
  });
  assert.equal(single.clearScore, 200);
  assert.equal(single.attack, 0);
  assert.equal(single.nextBackToBackReady, false);
  assert.equal(single.nextCombo, 1);

  const tetris = scoreClear({
    linesCleared: 4,
    level: 1,
    tSpin: 'none',
    backToBackReady: false,
    combo: 0,
    perfectClear: false,
    softDropRows: 0,
    hardDropRows: 5,
  });
  assert.equal(tetris.clearScore, 800);
  assert.equal(tetris.hardDropScore, 10);
  assert.equal(tetris.attack, 4);
  assert.equal(tetris.isDifficult, true);
  assert.equal(tetris.nextBackToBackReady, true);

  const b2bTetris = scoreClear({
    linesCleared: 4,
    level: 1,
    tSpin: 'none',
    backToBackReady: true,
    combo: 0,
    perfectClear: false,
    softDropRows: 0,
    hardDropRows: 0,
  });
  assert.equal(b2bTetris.clearScore, 1200);
  assert.equal(b2bTetris.isBackToBack, true);
  assert.equal(b2bTetris.attack, 5, 'Tetris 4 + B2B 1');

  const tsd = scoreClear({
    linesCleared: 2,
    level: 1,
    tSpin: 'full',
    backToBackReady: false,
    combo: 2,
    perfectClear: false,
    softDropRows: 0,
    hardDropRows: 0,
  });
  assert.equal(tsd.clearScore, 1200);
  assert.equal(tsd.comboScore, 100);
  assert.equal(tsd.label, 'T-SPIN DOUBLE');
  assert.equal(tsd.attack, 4 + COMBO_GARBAGE[3]);

  const mini = scoreClear({
    linesCleared: 1,
    level: 1,
    tSpin: 'mini',
    backToBackReady: false,
    combo: 0,
    perfectClear: false,
    softDropRows: 0,
    hardDropRows: 0,
  });
  assert.equal(mini.clearScore, 100);
  assert.equal(mini.label, 'T-SPIN MINI SINGLE');
}

// B2B breaks on a plain Single.
{
  const broken = scoreClear({
    linesCleared: 1,
    level: 1,
    tSpin: 'none',
    backToBackReady: true,
    combo: 3,
    perfectClear: false,
    softDropRows: 0,
    hardDropRows: 0,
  });
  assert.equal(broken.isBackToBack, false);
  assert.equal(broken.nextBackToBackReady, false, 'plain single breaks B2B chain');
  assert.equal(broken.nextCombo, 4);
}

// No clear resets combo but keeps B2B readiness.
{
  const noClear = scoreClear({
    linesCleared: 0,
    level: 1,
    tSpin: 'none',
    backToBackReady: true,
    combo: 5,
    perfectClear: false,
    softDropRows: 3,
    hardDropRows: 0,
  });
  assert.equal(noClear.nextCombo, 0);
  assert.equal(noClear.nextBackToBackReady, true);
  assert.equal(noClear.softDropScore, 3);
}

// Callouts include B2B / combo / T-Spin.
{
  const breakdown = scoreClear({
    linesCleared: 2,
    level: 1,
    tSpin: 'full',
    backToBackReady: true,
    combo: 1,
    perfectClear: true,
    softDropRows: 0,
    hardDropRows: 0,
  });
  const lines = formatClearCallouts(breakdown);
  assert.ok(lines.includes('T-SPIN DOUBLE'));
  assert.ok(lines.includes('B2B'));
  assert.ok(lines.includes('2 COMBO'));
  assert.ok(lines.includes('PERFECT CLEAR'));
  assert.ok(
    lines.some((line) => /^\+\d+$/.test(line)),
    'callouts should include +score so players see where points come from',
  );
}

// Garbage cancel and apply.
{
  assert.deepEqual(cancelGarbage(3, 5), { incoming: 0, outgoing: 2 });
  assert.deepEqual(cancelGarbage(4, 1), { incoming: 3, outgoing: 0 });

  const row = makeGarbageRow(3);
  assert.equal(row.filter((c) => c === null).length, 1);
  assert.equal(row[3], null);
  assert.equal(row[0], 'G');

  const board = createEmptyBoard();
  board[BOARD_SIZE.rows - 1][0] = 'T';
  const withGarbage = applyGarbage(board, 2, 5);
  assert.ok(withGarbage);
  assert.equal(withGarbage[BOARD_SIZE.rows - 1][5], null);
  assert.equal(withGarbage[BOARD_SIZE.rows - 1][0], 'G');
  assert.equal(withGarbage[BOARD_SIZE.rows - 2][5], null);
  assert.equal(withGarbage[BOARD_SIZE.rows - 3][0], 'T', 'stack shifts up');
}

// Mode goals: sprint = 40 lines; ultra = 2 minutes; marathon never; versus never by lines/time.
{
  assert.equal(isGoalMet('sprint', 39, 0), false);
  assert.equal(isGoalMet('sprint', 40, 0), true);
  assert.equal(isGoalMet('ultra', 0, 2 * 60 * 1000 - 1), false);
  assert.equal(isGoalMet('ultra', 0, 2 * 60 * 1000), true);
  assert.equal(isGoalMet('marathon', 999, 9_999_999), false);
  assert.equal(isGoalMet('versus', 999, 9_999_999), false);
}

// CPU AI finds a legal placement on an empty board.
{
  const board = createEmptyBoard();
  const plan = findBestPlacement(board, 'T', 'I', DIFFICULTY_PRESETS.normal);
  assert.ok(plan, 'CPU must find a placement on empty board');
  assert.ok(plan.row >= 0);
}

// Reachability: planned column must be achievable via rotate→shift (no teleport).
{
  const board = createEmptyBoard();
  const landed = reachPlacement(board, 'O', 0, 4);
  assert.ok(landed, 'O at col 4 must be reachable');
  assert.equal(landed.position.col, 4);
  // Far-left column that O cannot shift into from spawn should fail.
  assert.equal(reachPlacement(board, 'O', 0, -2), null);
}

// Difficulty polish: Easy is slower / softer; player garbage waves are capped.
{
  assert.ok(DIFFICULTY_PRESETS.easy.thinkMin >= 400, 'Easy should think longer');
  assert.ok(
    DIFFICULTY_PRESETS.easy.candidatePool >= 2,
    'Easy should sample at least two top placements',
  );
  assert.ok(
    DIFFICULTY_PRESETS.easy.candidatePool > DIFFICULTY_PRESETS.hard.candidatePool,
    'Easy should sample a wider top pool than Hard',
  );
  assert.ok(DIFFICULTY_PRESETS.easy.garbageDropCap <= DIFFICULTY_PRESETS.normal.garbageDropCap);
  assert.ok(PLAYER_GARBAGE_DROP_CAP >= 4 && PLAYER_GARBAGE_DROP_CAP <= 12);
  assert.equal(DIFFICULTY_PRESETS.hard.candidatePool, 1);
}

console.log('check-tetris: ok');
