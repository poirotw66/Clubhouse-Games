// Core pure-logic checks for Tetris (SRS, T-Spin, B2B, garbage, modes, daily/practice).
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  COMBO_GARBAGE,
  MODES,
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
import {
  DAILY_PIECE_COUNT,
  buildDailyShareText,
  computeDailyStreak,
  dailySeed,
  emptyDailyMeta,
  generateSeededPieces,
  mergeDailyResult,
  todayKeyUTC8,
} from './utils/daily.ts';
import {
  CHEESE_DEFAULT,
  TSPIN_PUZZLES,
  cheeseStars,
  createCheeseBoard,
  puzzleBoardFromRows,
  puzzleMatchesClear,
  tspinStars,
} from './utils/practice.ts';
import {
  CPU_STYLES,
  applyCpuStyle,
  isStyleUnlocked,
  recordSeriesGame,
  resetSeries,
  seriesComplete,
} from './utils/versusMeta.ts';
import { createInitialField, finishClearing, lockPiece } from './utils/gameStep.ts';
import {
  computeStackTelemetry,
  computeBagDistribution,
  computeCombatStats,
  createInitialClearStats,
  recordClearStats,
} from './utils/telemetry.ts';

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
  assert.equal(isGoalMet('dailySprint', 40, 0), true);
  assert.equal(isGoalMet('dailyUltra', 0, 2 * 60 * 1000), true);
  assert.equal(isGoalMet('cheese', 10, 0), true);
  assert.equal(isGoalMet('tspin', 99, 0), false, 'tspin goals are puzzle-driven, not line/time');
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

// Daily: same date+kind → identical piece sequence; different kind diverges.
{
  const a = generateSeededPieces(dailySeed('2026-10-22', 'sprint'), 28);
  const b = generateSeededPieces(dailySeed('2026-10-22', 'sprint'), 28);
  const c = generateSeededPieces(dailySeed('2026-10-22', 'ultra'), 28);
  assert.deepEqual(a, b, 'daily bag must be deterministic');
  assert.notDeepEqual(a, c, 'sprint and ultra seeds must differ');
  assert.equal(a.length, 28);
  // 7-bag: first 7 are a permutation of IJLOSTZ.
  const firstBag = [...a.slice(0, 7)].sort().join('');
  assert.equal(firstBag, 'IJLOSTZ');
  assert.match(todayKeyUTC8(new Date('2026-10-21T16:00:00Z')), /^\d{4}-\d{2}-\d{2}$/);
}

// Daily meta: merge bests + streak across consecutive clears.
{
  let meta = emptyDailyMeta();
  meta = mergeDailyResult(meta, '2026-10-20', 'sprint', 50_000, 40, true);
  meta = mergeDailyResult(meta, '2026-10-21', 'ultra', 12_000, 20, true);
  meta = mergeDailyResult(meta, '2026-10-22', 'sprint', 40_000, 40, true);
  // Faster sprint on same day replaces time.
  meta = mergeDailyResult(meta, '2026-10-22', 'sprint', 35_000, 40, true);
  const day = meta.days.find((d) => d.date === '2026-10-22');
  assert.equal(day.sprint.value, 35_000);
  assert.equal(day.sprint.attempts, 2);
  assert.equal(computeDailyStreak(meta, '2026-10-22'), 3);
  const share = buildDailyShareText({
    date: '2026-10-22',
    kind: 'sprint',
    value: 35_000,
    lines: 40,
    cleared: true,
    streak: 3,
  });
  assert.ok(share.includes('每日 40 行'));
  assert.ok(share.includes('連續 3 天'));
}

// Cheese board: N garbage rows with a single hole each.
{
  const board = createCheeseBoard(10, 42);
  let garbageRows = 0;
  for (let r = 0; r < BOARD_SIZE.rows; r++) {
    const g = board[r].filter((c) => c === 'G').length;
    const empty = board[r].filter((c) => c === null).length;
    if (g > 0) {
      garbageRows += 1;
      assert.equal(g, BOARD_SIZE.cols - 1);
      assert.equal(empty, 1);
    }
  }
  assert.equal(garbageRows, 10);
  assert.equal(cheeseStars(30_000, true), 3);
  assert.equal(cheeseStars(60_000, true), 2);
  assert.equal(cheeseStars(90_000, true), 1);
  assert.equal(cheeseStars(10_000, false), 0);
  assert.equal(CHEESE_DEFAULT.lineGoal, 10);
}

// T-Spin puzzles: boards parse; TSD puzzle can be cleared with one T lock after rotate.
{
  assert.ok(TSPIN_PUZZLES.length >= 2);
  const puzzle = TSPIN_PUZZLES.find((p) => p.id === 'ts-double-1');
  assert.ok(puzzle);
  const board = puzzleBoardFromRows(puzzle.rows);
  assert.equal(board[BOARD_SIZE.rows - 1].every((c) => c === 'G'), true);
  // Drop T into the well and rotate to pointing-down for a full TSD.
  let field = createInitialField({
    board,
    pieces: ['T', 'I', 'J'],
    puzzleGoal: puzzle.require,
    refillBags: false,
    allowHold: false,
  });
  assert.equal(field.holdEnabled, false);
  assert.ok(field.active);
  // Place T already in the TSD slot (rot 2, col 3) — mirrors detectTSpin setup.
  const piece = {
    type: 'T',
    rotation: 2,
    position: { row: BOARD_SIZE.rows - 4, col: 3 },
  };
  assert.equal(collides(field.board, piece), false, 'TSD slot must accept T');
  assert.equal(detectTSpin(field.board, piece, 'rotate', 0), 'full');
  const outcome = lockPiece(
    { ...field, active: piece, lastAction: 'rotate', lastKickIndex: 0 },
    'tspin',
    0,
    0,
  );
  assert.ok(outcome.linesCleared >= 2, 'TSD setup should clear two lines');
  let next = outcome.field;
  if (next.clearing) {
    next = finishClearing(next, 'tspin');
  }
  assert.equal(next.cleared, true, 'puzzle goal should mark cleared');
  assert.equal(puzzleMatchesClear(puzzle, 'full', 2), true);
  assert.equal(tspinStars(1, true, puzzle), 3);
  assert.equal(tspinStars(10, true, puzzle), 1);
}

// Versus meta: style unlocks + BO3 series + weight multipliers.
{
  assert.equal(isStyleUnlocked('balanced', 0), true);
  assert.equal(isStyleUnlocked('conservative', 0), false);
  assert.equal(isStyleUnlocked('conservative', 1), true);
  assert.equal(isStyleUnlocked('digger', 3), true);
  assert.equal(isStyleUnlocked('tspin', 4), false);
  assert.equal(isStyleUnlocked('tspin', 5), true);
  const digger = applyCpuStyle('normal', 'digger');
  const base = DIFFICULTY_PRESETS.normal;
  assert.ok(digger.clearWeight > base.clearWeight);
  assert.ok(digger.holeWeight < base.holeWeight);
  let series = { bo3: true, style: 'balanced', seriesPlayer: 0, seriesCpu: 0 };
  series = recordSeriesGame(series, 'player');
  series = recordSeriesGame(series, 'player');
  assert.equal(seriesComplete(series), true);
  assert.equal(series.seriesPlayer, 2);
  series = resetSeries(series);
  assert.equal(series.seriesPlayer, 0);
  assert.ok(CPU_STYLES.tspin.unlockWins >= 5);
}

// Telemetry & Cockpit analytics checks.
{
  const board = createEmptyBoard();
  // Stack 4 blocks in column 0, leaving hole at row 19 col 0.
  board[BOARD_SIZE.rows - 2][0] = 'I';
  board[BOARD_SIZE.rows - 3][0] = 'I';
  const tele = computeStackTelemetry(board);
  assert.equal(tele.colHeights[0], 3);
  assert.equal(tele.peakHeight, 3);
  assert.equal(tele.holesCount, 1, 'empty cell under block must count as hole');
  assert.equal(tele.dangerZone, 'safe');

  // Danger zone warning / critical.
  const dangerBoard = createEmptyBoard();
  for (let r = BOARD_SIZE.rows - 16; r < BOARD_SIZE.rows; r++) {
    dangerBoard[r][5] = 'O';
  }
  const dangerTele = computeStackTelemetry(dangerBoard);
  assert.equal(dangerTele.peakHeight, 16);
  assert.equal(dangerTele.dangerZone, 'critical');

  // Bag distribution status.
  const bag = computeBagDistribution('T', ['I', 'J', 'O', 'L']);
  const tPiece = bag.find((p) => p.type === 'T');
  const iPiece = bag.find((p) => p.type === 'I');
  const zPiece = bag.find((p) => p.type === 'Z');
  assert.equal(tPiece?.status, 'active');
  assert.equal(iPiece?.status, 'next');
  assert.equal(zPiece?.status, 'pool');

  // Combat stats (Tetris Rate, Fever).
  let clearStats = createInitialClearStats();
  clearStats = recordClearStats(clearStats, 4, false, 4);
  clearStats = recordClearStats(clearStats, 4, false, 4);
  const combat = computeCombatStats(clearStats, 8, 12, 10000, 3);
  assert.equal(combat.tetrisRate, 100, 'two tetrises should give 100% tetris rate');
  assert.equal(combat.feverTier, 'ignited');
  assert.ok(combat.linesPerMinute > 0);
}

// =========================================================================
// Deep Super Rotation System (SRS) Wall Kick Matrix Verification
// =========================================================================

// Comprehensive JLSTZ SRS Kick Table Verification (all 8 transitions x 5 offsets)
{
  const expectedJLSTZKicks = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };

  const transitions = Object.keys(expectedJLSTZKicks);
  assert.equal(transitions.length, 8);

  for (const trans of transitions) {
    const tableKicks = SRS_KICK_TABLES.JLSTZ[trans];
    assert.ok(tableKicks, `Missing JLSTZ kick transition: ${trans}`);
    assert.equal(tableKicks.length, 5, `JLSTZ ${trans} must have exactly 5 kick tests`);
    assert.deepEqual(tableKicks[0], [0, 0], `First kick test for JLSTZ ${trans} must be [0,0]`);
    assert.deepEqual(tableKicks, expectedJLSTZKicks[trans], `JLSTZ ${trans} kicks must match Guideline offsets`);
  }
}

// Comprehensive I-Tetromino SRS Kick Table Verification (all 8 transitions x 5 offsets)
{
  const expectedIKicks = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };

  const transitions = Object.keys(expectedIKicks);
  assert.equal(transitions.length, 8);

  for (const trans of transitions) {
    const tableKicks = SRS_KICK_TABLES.I[trans];
    assert.ok(tableKicks, `Missing I kick transition: ${trans}`);
    assert.equal(tableKicks.length, 5, `I ${trans} must have exactly 5 kick tests`);
    assert.deepEqual(tableKicks[0], [0, 0], `First kick test for I ${trans} must be [0,0]`);
    assert.deepEqual(tableKicks, expectedIKicks[trans], `I ${trans} kicks must match Guideline offsets`);
  }
}

// In-board JLSTZ Wall Kicks for J, L, S, Z Pieces
{
  // J piece against left wall rotating CCW (0->3) kicks right.
  const board = createEmptyBoard();
  const jLeft = { type: 'J', rotation: 0, position: { row: 10, col: -1 } };
  assert.equal(collides(board, jLeft), true, 'J at col -1 must collide with left boundary');
  const { piece: jKicked, kickIndex: jKickIdx } = tryRotateWithKick(board, jLeft, -1);
  assert.ok(jKickIdx >= 0, 'J CCW wall kick should succeed');
  assert.equal(jKicked.rotation, 3);
  assert.equal(collides(board, jKicked), false, 'J kicked piece must be in legal bounds');

  // L piece against right wall rotating CW (0->1) kicks left.
  const lRight = { type: 'L', rotation: 0, position: { row: 10, col: 8 } };
  assert.equal(collides(board, lRight), true, 'L at col 8 must collide with right boundary');
  const { piece: lKicked, kickIndex: lKickIdx } = tryRotateWithKick(board, lRight, 1);
  assert.ok(lKickIdx >= 0, 'L CW wall kick should succeed');
  assert.equal(lKicked.rotation, 1);
  assert.equal(collides(board, lKicked), false, 'L kicked piece must be in legal bounds');

  // S piece rotating against right wall: rot 0 col 8 collides with right wall; CW (0->1) kicks left.
  const sRight = { type: 'S', rotation: 0, position: { row: 10, col: 8 } };
  assert.equal(collides(board, sRight), true, 'S at col 8 must collide with right boundary');
  const { piece: sKicked, kickIndex: sKickIdx } = tryRotateWithKick(board, sRight, 1);
  assert.ok(sKickIdx >= 0, 'S CW kick from 0->1 should resolve collision');
  assert.equal(sKicked.rotation, 1);
  assert.equal(collides(board, sKicked), false);

  // Z piece rotating against left wall: rot 0 col -1 collides; CCW (0->3) kicks right.
  const zLeft = { type: 'Z', rotation: 0, position: { row: 10, col: -1 } };
  assert.equal(collides(board, zLeft), true, 'Z at col -1 must collide with left boundary');
  const { piece: zKicked, kickIndex: zKickIdx } = tryRotateWithKick(board, zLeft, -1);
  assert.ok(zKickIdx >= 0, 'Z CCW kick from 0->3 should resolve collision');
  assert.equal(zKicked.rotation, 3);
  assert.equal(collides(board, zKicked), false);
}

// In-board I-Tetromino Wall Kicks and Floor Kicks
{
  const board = createEmptyBoard();

  // Horizontal I on the floor (row 19) rotating into vertical.
  const iFloor = { type: 'I', rotation: 0, position: { row: 18, col: 3 } };
  // Rotation 0->1 attempts base vertical which extends to row 21 (collides floor),
  // kick tests should find upward kick.
  const { piece: iFloorKicked, kickIndex: iFloorIdx } = tryRotateWithKick(board, iFloor, 1);
  assert.ok(iFloorIdx >= 0, 'I floor kick must succeed');
  assert.equal(iFloorKicked.rotation, 1);
  assert.equal(collides(board, iFloorKicked), false, 'Kicked I must clear floor boundary');

  // Horizontal I against right wall at col 7 (extends past col 9) rotating CCW 0->3.
  const iRight = { type: 'I', rotation: 0, position: { row: 8, col: 7 } };
  const { piece: iRightKicked, kickIndex: iRightIdx } = tryRotateWithKick(board, iRight, -1);
  assert.ok(iRightIdx >= 0, 'I CCW wall kick from right boundary must succeed');
  assert.equal(iRightKicked.rotation, 3);
  assert.equal(collides(board, iRightKicked), false);

  // I piece rotation in a narrow channel: blocked when walls on both sides prevent all 5 kick offsets.
  const channelBoard = createEmptyBoard();
  for (let r = 5; r <= 15; r++) {
    for (let c = 0; c < BOARD_SIZE.cols; c++) {
      if (c !== 4) channelBoard[r][c] = 'G';
    }
  }
  // Vertical I in column 4 (matrix col 2 -> board col 4).
  const iInChannel = { type: 'I', rotation: 1, position: { row: 8, col: 2 } };
  assert.equal(collides(channelBoard, iInChannel), false, 'Vertical I fits in 1-wide column');
  // Attempting to rotate to horizontal in a 1-wide channel must fail all 5 kicks.
  const { kickIndex: blockedIdx } = tryRotateWithKick(channelBoard, iInChannel, 1);
  assert.equal(blockedIdx, -1, 'I piece cannot rotate to horizontal in 1-wide vertical well');
}

// Deep T-Spin 3-Corner Rule & T-Spin Mini Edge Cases
{
  const board = createEmptyBoard();
  // Center is at (11, 5) for T at position { row: 10, col: 4 }.
  // Corners: NW(10,4), NE(10,6), SW(12,4), SE(12,6).

  // Test 1: Rotation 0 (pointing UP). Front corners are NW & NE; back corners are SW & SE.
  // 2 front corners + 1 back corner filled (NW, NE, SW) -> exactly 3 corners filled.
  // Both front corners filled -> FULL T-Spin (NOT Mini).
  board[10][4] = 'G'; // NW (front)
  board[10][6] = 'G'; // NE (front)
  board[12][4] = 'G'; // SW (back)
  board[12][6] = null; // SE (back) empty
  const tUp = { type: 'T', rotation: 0, position: { row: 10, col: 4 } };
  assert.equal(
    detectTSpin(board, tUp, 'rotate', 0),
    'full',
    '3 corners filled with 2 front corners filled must be full T-Spin',
  );

  // Test 2: All 4 corners filled -> full T-Spin.
  board[12][6] = 'G'; // SE filled
  assert.equal(
    detectTSpin(board, tUp, 'rotate', 0),
    'full',
    '4 corners filled must be full T-Spin',
  );

  // Test 3: 3 corners filled with only 1 front corner filled (NW filled, NE empty, SW & SE filled).
  // With kickIndex < 4 -> must be T-Spin MINI.
  board[10][6] = null; // NE (front) open
  assert.equal(
    detectTSpin(board, tUp, 'rotate', 0),
    'mini',
    '3 corners filled with 1 front corner filled must be T-Spin Mini when kickIndex < 4',
  );
  assert.equal(
    detectTSpin(board, tUp, 'rotate', 1),
    'mini',
    'kickIndex 1 retains mini',
  );
  assert.equal(
    detectTSpin(board, tUp, 'rotate', 2),
    'mini',
    'kickIndex 2 retains mini',
  );
  assert.equal(
    detectTSpin(board, tUp, 'rotate', 3),
    'mini',
    'kickIndex 3 retains mini',
  );

  // Test 4: Guideline kick 4 upgrade rule:
  // If 3 corners filled with < 2 front corners, but kickIndex === 4, it upgrades to FULL T-Spin!
  assert.equal(
    detectTSpin(board, tUp, 'rotate', 4),
    'full',
    'T-Spin Mini upgrades to full T-Spin when kickIndex === 4',
  );

  // Test 5: Only 2 corners filled (even if both are front corners) -> NONE (needs >= 3 corners).
  const twoCornersBoard = createEmptyBoard();
  twoCornersBoard[10][4] = 'G'; // NW
  twoCornersBoard[10][6] = 'G'; // NE
  assert.equal(
    detectTSpin(twoCornersBoard, tUp, 'rotate', 0),
    'none',
    '2 corners filled must evaluate to none',
  );

  // Test 6: Rotation 1 (pointing RIGHT). Front corners are NE & SE; back corners are NW & SW.
  const r1Board = createEmptyBoard();
  r1Board[10][6] = 'G'; // NE (front)
  r1Board[12][6] = 'G'; // SE (front)
  r1Board[10][4] = 'G'; // NW (back)
  r1Board[12][4] = null; // SW (back) empty
  const tRight = { type: 'T', rotation: 1, position: { row: 10, col: 4 } };
  assert.equal(
    detectTSpin(r1Board, tRight, 'rotate', 0),
    'full',
    'Rotation 1 with 2 front corners filled must be full T-Spin',
  );

  // Open one front corner (SE) -> 1 front (NE) + 2 back (NW, SW) = 3 corners -> mini.
  r1Board[12][6] = null;
  r1Board[12][4] = 'G';
  assert.equal(
    detectTSpin(r1Board, tRight, 'rotate', 0),
    'mini',
    'Rotation 1 with 1 front corner filled must be T-Spin Mini',
  );

  // Test 7: Rotation 2 (pointing DOWN). Front corners are SW & SE; back corners are NW & NE.
  const r2Board = createEmptyBoard();
  r2Board[12][4] = 'G'; // SW (front)
  r2Board[12][6] = 'G'; // SE (front)
  r2Board[10][4] = 'G'; // NW (back)
  r2Board[10][6] = null; // NE (back) empty
  const tDown = { type: 'T', rotation: 2, position: { row: 10, col: 4 } };
  assert.equal(
    detectTSpin(r2Board, tDown, 'rotate', 0),
    'full',
    'Rotation 2 with 2 front corners filled must be full T-Spin',
  );
  // Open one front corner -> mini
  r2Board[12][6] = null;
  r2Board[10][6] = 'G';
  assert.equal(
    detectTSpin(r2Board, tDown, 'rotate', 0),
    'mini',
    'Rotation 2 with 1 front corner filled must be T-Spin Mini',
  );

  // Test 8: Rotation 3 (pointing LEFT). Front corners are NW & SW; back corners are NE & SE.
  const r3Board = createEmptyBoard();
  r3Board[10][4] = 'G'; // NW (front)
  r3Board[12][4] = 'G'; // SW (front)
  r3Board[10][6] = 'G'; // NE (back)
  r3Board[12][6] = null; // SE (back) empty
  const tLeft = { type: 'T', rotation: 3, position: { row: 10, col: 4 } };
  assert.equal(
    detectTSpin(r3Board, tLeft, 'rotate', 0),
    'full',
    'Rotation 3 with 2 front corners filled must be full T-Spin',
  );
  // Open one front corner -> mini
  r3Board[10][4] = null;
  r3Board[12][6] = 'G';
  assert.equal(
    detectTSpin(r3Board, tLeft, 'rotate', 0),
    'mini',
    'Rotation 3 with 1 front corner filled must be T-Spin Mini',
  );

  // Test 9: Last action invariants: only 'rotate' qualifies.
  assert.equal(detectTSpin(board, tUp, 'move', 0), 'none');
  assert.equal(detectTSpin(board, tUp, 'drop', 0), 'none');
  assert.equal(detectTSpin(board, tUp, 'spawn', 0), 'none');

  // Test 10: Non-T pieces always return 'none'.
  const nonTPieces = ['I', 'J', 'L', 'O', 'S', 'Z'];
  for (const pType of nonTPieces) {
    const piece = { type: pType, rotation: 0, position: { row: 10, col: 4 } };
    assert.equal(
      detectTSpin(board, piece, 'rotate', 0),
      'none',
      `${pType} piece must never qualify for T-Spin`,
    );
  }
}

// =========================================================================
// 40-Line Sprint & 2-Minute Ultra Modes: Countdowns, Metrics & Record Persistence
// =========================================================================

// 40-Line Sprint Goal Met and Line Countdowns
{
  assert.equal(MODES.sprint.lineGoal, 40);
  assert.equal(MODES.sprint.timeLimitMs, null);
  assert.equal(MODES.sprint.recordKind, 'time');
  assert.equal(MODES.sprint.rank, 'fastest');

  // Line countdown progression: 40 -> 0.
  for (let lines = 0; lines < 40; lines++) {
    const linesRemaining = Math.max(0, 40 - lines);
    assert.equal(linesRemaining, 40 - lines);
    assert.equal(isGoalMet('sprint', lines, 45_000), false, `Sprint must not be met at ${lines} lines`);
  }
  assert.equal(isGoalMet('sprint', 40, 45_000), true);
  assert.equal(isGoalMet('sprint', 43, 45_000), true, 'Overshoot line clear must meet goal');

  // Field integration: clear 40 lines sequentially.
  let field = createInitialField();
  for (let batch = 0; batch < 10; batch++) {
    // Fill bottom 4 rows except col 3 for a vertical I piece drop.
    const board = createEmptyBoard();
    for (let r = BOARD_SIZE.rows - 4; r < BOARD_SIZE.rows; r++) {
      fillRow(board, r, 'G');
      board[r][3] = null;
    }
    // Drop vertical I piece (rot 1) into col 3 (matrix col 2 -> board col 3 when pos.col = 1).
    const iPiece = { type: 'I', rotation: 1, position: { row: BOARD_SIZE.rows - 4, col: 1 } };
    field = { ...field, board, active: iPiece, lastAction: 'drop', lastKickIndex: 0 };
    const outcome = lockPiece(field, 'sprint', 0, 0);
    assert.equal(outcome.linesCleared, 4);
    field = finishClearing(outcome.field, 'sprint');
    assert.equal(field.lines, (batch + 1) * 4);
  }
  assert.equal(field.lines, 40);
  assert.equal(field.cleared, true, 'Sprint 40 lines must mark field cleared');
  assert.equal(field.gameOver, true, 'Sprint completion triggers game over');
  assert.equal(field.active, null, 'Active piece is cleared on game over');
}

// 2-Minute Ultra Goal Met and Timer Expiration
{
  assert.equal(MODES.ultra.lineGoal, null);
  assert.equal(MODES.ultra.timeLimitMs, 120_000);
  assert.equal(MODES.ultra.recordKind, 'score');
  assert.equal(MODES.ultra.rank, 'highest');

  // Countdown timer calculations.
  const timeLimit = MODES.ultra.timeLimitMs;
  assert.equal(Math.max(0, timeLimit - 0), 120_000);
  assert.equal(Math.max(0, timeLimit - 60_000), 60_000);
  assert.equal(Math.max(0, timeLimit - 119_999), 1);
  assert.equal(Math.max(0, timeLimit - 120_000), 0);
  assert.equal(Math.max(0, timeLimit - 135_000), 0);

  // Goal met threshold checks.
  assert.equal(isGoalMet('ultra', 999, 0), false);
  assert.equal(isGoalMet('ultra', 999, 119_999), false);
  assert.equal(isGoalMet('ultra', 999, 120_000), true);
  assert.equal(isGoalMet('ultra', 999, 120_001), true);

  // Field integration: lockPiece when elapsedMs reaches 120_000 ms.
  let field = createInitialField();
  field = { ...field, elapsedMs: 120_000 };
  const outcome = lockPiece(field, 'ultra', 0, 0);
  assert.equal(outcome.field.cleared, true, 'Ultra time limit met marks cleared');
  assert.equal(outcome.field.gameOver, true, 'Ultra time limit met marks game over');
}

// PPS / LPM Metrics Calculation & Tetris Rate Invariants
{
  // Zero/early duration safeguards:
  const earlyStats = createInitialClearStats();
  const earlyCombat = computeCombatStats(earlyStats, 10, 20, 2000, 0);
  assert.equal(earlyCombat.piecesPerSecond, 0, 'PPS should be 0 before 3 seconds');
  assert.equal(earlyCombat.linesPerMinute, 0, 'LPM should be 0 before 0.05 minutes');

  // 40 lines in 60,000 ms (1.0 minute) with 102 locks:
  let sprintStats = createInitialClearStats();
  for (let i = 0; i < 10; i++) sprintStats = recordClearStats(sprintStats, 4, false, 4);
  const sprintCombat = computeCombatStats(sprintStats, 40, 102, 60_000, 0);
  assert.equal(sprintCombat.linesPerMinute, 40.0, '40 lines in 1 min must be 40.0 LPM');
  assert.equal(sprintCombat.piecesPerSecond, 1.70, '102 locks in 60s must be 1.70 PPS');
  assert.equal(sprintCombat.tetrisRate, 100, 'All 40 lines from Tetrises must be 100% Tetris Rate');

  // Mixed clears: 5 Tetrises (20 lines) + 20 Singles (20 lines) = 40 total lines.
  let mixedStats = createInitialClearStats();
  for (let i = 0; i < 5; i++) mixedStats = recordClearStats(mixedStats, 4, false, 4);
  for (let i = 0; i < 20; i++) mixedStats = recordClearStats(mixedStats, 1, false, 0);
  const mixedCombat = computeCombatStats(mixedStats, 40, 100, 80_000, 0);
  assert.equal(mixedCombat.tetrisRate, 50, '20 of 40 lines from Tetrises must be 50% Tetris Rate');
  assert.equal(mixedCombat.linesPerMinute, 30.0, '40 lines in 80s (1.333 min) must be 30.0 LPM');
  assert.equal(mixedCombat.piecesPerSecond, 1.25, '100 locks in 80s must be 1.25 PPS');

  // Zero lines edge case:
  const emptyCombat = computeCombatStats(createInitialClearStats(), 0, 0, 10_000, 0);
  assert.equal(emptyCombat.tetrisRate, 0);
}

// Local Storage Record Persistence Logic (clubhouse:tetris-best)
{
  function updateBestRecord(prev, mode, value, cleared = true) {
    const config = MODES[mode];
    if (config.recordKind === 'time' && !cleared) return prev;
    const current = prev[mode];
    const better =
      current === undefined ||
      (config.rank === 'fastest' ? value < current : value > current);
    if (!better) return prev;
    return { ...prev, [mode]: value };
  }

  // Sprint persistence (fastest time in ms, requires cleared=true).
  let best = {};
  // Initial clear: 65,000 ms.
  best = updateBestRecord(best, 'sprint', 65_000, true);
  assert.equal(best.sprint, 65_000);
  // Faster clear: 52,000 ms -> updates.
  best = updateBestRecord(best, 'sprint', 52_000, true);
  assert.equal(best.sprint, 52_000);
  // Slower clear: 58,000 ms -> does NOT overwrite.
  best = updateBestRecord(best, 'sprint', 58_000, true);
  assert.equal(best.sprint, 52_000);
  // Game over without clearing (e.g. topped out): does NOT write even if elapsed time is low.
  best = updateBestRecord(best, 'sprint', 30_000, false);
  assert.equal(best.sprint, 52_000);

  // Ultra persistence (highest score).
  // Initial run: 25,000 score.
  best = updateBestRecord(best, 'ultra', 25_000);
  assert.equal(best.ultra, 25_000);
  // Higher score: 38,000 -> updates.
  best = updateBestRecord(best, 'ultra', 38_000);
  assert.equal(best.ultra, 38_000);
  // Lower score: 31,000 -> does NOT overwrite.
  best = updateBestRecord(best, 'ultra', 31_000);
  assert.equal(best.ultra, 38_000);

  // Marathon persistence (highest score).
  best = updateBestRecord(best, 'marathon', 120_000);
  assert.equal(best.marathon, 120_000);
  best = updateBestRecord(best, 'marathon', 200_000);
  assert.equal(best.marathon, 200_000);

  // JSON serialization & parsing round-trip.
  const serialized = JSON.stringify(best);
  const deserialized = JSON.parse(serialized);
  assert.deepEqual(deserialized, {
    sprint: 52_000,
    ultra: 38_000,
    marathon: 200_000,
  });

  // Malformed storage recovery.
  function safeParseBest(raw) {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  assert.deepEqual(safeParseBest('not-json'), {});
  assert.deepEqual(safeParseBest('null'), {});
  assert.deepEqual(safeParseBest('42'), {});
}

// =========================================================================
// CPU Battle Simulation: Tactical AI Styles, Garbage Cancellation & BO3 Series
// =========================================================================

// Tactical AI Styles: Balanced, Defensive (Conservative), T-Spin Focused & Digger
{
  const base = DIFFICULTY_PRESETS.normal;

  // 1. Balanced: uses unmodified preset weights.
  const balanced = applyCpuStyle('normal', 'balanced');
  assert.equal(balanced.holeWeight, base.holeWeight);
  assert.equal(balanced.heightWeight, base.heightWeight);
  assert.equal(balanced.attackWeight, base.attackWeight);
  assert.equal(balanced.tSlotWeight, base.tSlotWeight);

  // 2. Defensive (Conservative): high hole and height aversion, lower attack priority.
  const conservative = applyCpuStyle('normal', 'conservative');
  assert.ok(conservative.holeWeight > base.holeWeight, 'Conservative must penalize holes more heavily');
  assert.ok(conservative.heightWeight > base.heightWeight, 'Conservative must keep stack lower');
  assert.ok(conservative.bumpWeight > base.bumpWeight, 'Conservative must maintain a flatter surface');
  assert.ok(conservative.attackWeight < base.attackWeight, 'Conservative prioritizes survival over attack');

  // 3. T-Spin Focused: strong preference for T-slots and attack output.
  const tspinStyle = applyCpuStyle('normal', 'tspin');
  assert.ok(tspinStyle.tSlotWeight > base.tSlotWeight * 2, 'T-Spin style must strongly prioritize T-slots');
  assert.ok(tspinStyle.attackWeight > base.attackWeight, 'T-Spin style must value attack weight higher');

  // 4. Digger Style: aggressive line clearing and garbage digging.
  const diggerStyle = applyCpuStyle('normal', 'digger');
  assert.ok(diggerStyle.clearWeight > base.clearWeight, 'Digger must aggressively clear lines');
  assert.ok(diggerStyle.holeWeight < base.holeWeight, 'Digger tolerates holes while digging');

  // AI placement generation with styles:
  const testBoard = createEmptyBoard();
  fillRow(testBoard, 19, 'G');
  testBoard[19][4] = null; // single hole at col 4
  const planBalanced = findBestPlacement(testBoard, 'T', 'I', balanced);
  const planConservative = findBestPlacement(testBoard, 'T', 'I', conservative);
  const planTSpin = findBestPlacement(testBoard, 'T', 'I', tspinStyle);

  assert.ok(planBalanced, 'Balanced CPU must find a legal placement');
  assert.ok(planConservative, 'Conservative CPU must find a legal placement');
  assert.ok(planTSpin, 'T-Spin CPU must find a legal placement');
  assert.ok(reachPlacement(testBoard, 'T', planBalanced.rotation, planBalanced.col));
  assert.ok(reachPlacement(testBoard, 'T', planConservative.rotation, planConservative.col));
  assert.ok(reachPlacement(testBoard, 'T', planTSpin.rotation, planTSpin.col));
}

// Garbage Cancellation (相殺), Queue Accumulation & Top-Out KO
{
  // Cancellation pure logic:
  assert.deepEqual(cancelGarbage(0, 4), { incoming: 0, outgoing: 4 });
  assert.deepEqual(cancelGarbage(4, 4), { incoming: 0, outgoing: 0 });
  assert.deepEqual(cancelGarbage(5, 2), { incoming: 3, outgoing: 0 });
  assert.deepEqual(cancelGarbage(3, 7), { incoming: 0, outgoing: 4 });

  // Multi-turn battle garbage exchange simulation:
  let playerIncoming = 0;
  let cpuIncoming = 0;

  // Round 1: Player clears Tetris (4 attack).
  const pAttackR1 = 4;
  const cancel1 = cancelGarbage(playerIncoming, pAttackR1);
  playerIncoming = cancel1.incoming;
  cpuIncoming += cancel1.outgoing;
  assert.equal(cpuIncoming, 4, 'CPU receives 4 queued garbage from Tetris');

  // Round 2: CPU executes Double (1 attack).
  const cpuAttackR2 = 1;
  const cancel2 = cancelGarbage(cpuIncoming, cpuAttackR2);
  cpuIncoming = cancel2.incoming;
  playerIncoming += cancel2.outgoing;
  assert.equal(cpuIncoming, 3, 'CPU cancels 1 garbage; 3 remain in queue');
  assert.equal(playerIncoming, 0);

  // Round 3: Player lands B2B Tetris (4 + 1 = 5 attack).
  const pAttackR3 = 5;
  const cancel3 = cancelGarbage(playerIncoming, pAttackR3);
  playerIncoming = cancel3.incoming;
  cpuIncoming += cancel3.outgoing;
  assert.equal(cpuIncoming, 8, 'CPU queued garbage accumulates to 3 + 5 = 8');

  // Round 4: CPU counters with B2B T-Spin Double (4 + 1 = 5 attack).
  const cpuAttackR4 = 5;
  const cancel4 = cancelGarbage(cpuIncoming, cpuAttackR4);
  cpuIncoming = cancel4.incoming;
  playerIncoming += cancel4.outgoing;
  assert.equal(cpuIncoming, 3, 'CPU cancels 5 garbage; 3 remain in queue');
  assert.equal(playerIncoming, 0);

  // Round 5: CPU executes T-Spin Triple (6 attack).
  const cpuAttackR5 = 6;
  const cancel5 = cancelGarbage(cpuIncoming, cpuAttackR5);
  cpuIncoming = cancel5.incoming;
  playerIncoming += cancel5.outgoing;
  assert.equal(cpuIncoming, 0, 'CPU fully clears its garbage queue');
  assert.equal(playerIncoming, 3, 'Player receives counter-attack of 3 garbage lines');

  // Applying garbage to board:
  const simBoard = createEmptyBoard();
  const withGarbage = applyGarbage(simBoard, playerIncoming, 2);
  assert.ok(withGarbage);
  assert.equal(withGarbage[19][2], null, 'Hole must be at col 2');
  assert.equal(withGarbage[19][0], 'G', 'Other cells must be garbage G');

  // Top-out KO: when stack cannot accommodate incoming garbage.
  const fullBoard = createEmptyBoard();
  for (let r = 1; r < BOARD_SIZE.rows; r++) fillRow(fullBoard, r, 'G');
  // Stack height is 19. Applying 2 garbage lines pushes row 1 above top -> null (KO).
  const koResult = applyGarbage(fullBoard, 2, 0);
  assert.equal(koResult, null, 'Stack overflowing playfield top must return null (KO)');
}

// BO3 Series Progression & Style Unlocking
{
  // Initial BO3 state:
  let series = { bo3: true, style: 'balanced', seriesPlayer: 0, seriesCpu: 0 };
  assert.equal(seriesComplete(series), false);

  // Game 1: Player wins.
  series = recordSeriesGame(series, 'player');
  assert.equal(series.seriesPlayer, 1);
  assert.equal(series.seriesCpu, 0);
  assert.equal(seriesComplete(series), false);

  // Game 2: CPU wins.
  series = recordSeriesGame(series, 'cpu');
  assert.equal(series.seriesPlayer, 1);
  assert.equal(series.seriesCpu, 1);
  assert.equal(seriesComplete(series), false);

  // Game 3: CPU wins again -> series complete!
  series = recordSeriesGame(series, 'cpu');
  assert.equal(series.seriesPlayer, 1);
  assert.equal(series.seriesCpu, 2);
  assert.equal(seriesComplete(series), true, 'First to 2 wins finishes BO3 series');

  // Series reset:
  series = resetSeries(series);
  assert.equal(series.seriesPlayer, 0);
  assert.equal(series.seriesCpu, 0);
  assert.equal(seriesComplete(series), false);

  // When bo3 is false, recordSeriesGame is a no-op.
  let nonBo3 = { bo3: false, style: 'balanced', seriesPlayer: 0, seriesCpu: 0 };
  nonBo3 = recordSeriesGame(nonBo3, 'player');
  assert.equal(nonBo3.seriesPlayer, 0, 'Non-BO3 matches do not advance series scores');

  // Career unlock progression:
  assert.equal(isStyleUnlocked('balanced', 0), true);
  assert.equal(isStyleUnlocked('conservative', 0), false);
  assert.equal(isStyleUnlocked('conservative', 1), true);
  assert.equal(isStyleUnlocked('digger', 2), false);
  assert.equal(isStyleUnlocked('digger', 3), true);
  assert.equal(isStyleUnlocked('tspin', 4), false);
  assert.equal(isStyleUnlocked('tspin', 5), true);
  assert.equal(isStyleUnlocked('tspin', 10), true);
}

// =========================================================================
// Combo Fever Multiplier Scaling & Back-to-Back 1.5x Score Bonus Invariants
// =========================================================================

// Combo Fever Tier Progression & Labels
{
  const stats = createInitialClearStats();

  // Combo 0: Idle / 冷靜
  const c0 = computeCombatStats(stats, 10, 10, 10_000, 0);
  assert.equal(c0.feverTier, 'idle');
  assert.equal(c0.feverRatio, 0.0);
  assert.equal(c0.feverLabel, '冷靜');

  // Combo 1: Ignited / 連擊起步
  const c1 = computeCombatStats(stats, 10, 10, 10_000, 1);
  assert.equal(c1.feverTier, 'ignited');
  assert.equal(c1.feverRatio, 0.25);
  assert.equal(c1.feverLabel, '連擊起步');

  // Combo 2 & 3: Ignited / 連鎖點火
  const c2 = computeCombatStats(stats, 10, 10, 10_000, 2);
  assert.equal(c2.feverTier, 'ignited');
  assert.equal(c2.feverRatio, 0.50);
  assert.equal(c2.feverLabel, '連鎖點火');

  const c3 = computeCombatStats(stats, 10, 10, 10_000, 3);
  assert.equal(c3.feverTier, 'ignited');
  assert.equal(c3.feverRatio, 0.50);
  assert.equal(c3.feverLabel, '連鎖點火');

  // Combo 4 & 5: Overdrive / 狂熱超頻
  const c4 = computeCombatStats(stats, 10, 10, 10_000, 4);
  assert.equal(c4.feverTier, 'overdrive');
  assert.equal(c4.feverRatio, 0.80);
  assert.equal(c4.feverLabel, '狂熱超頻');

  const c5 = computeCombatStats(stats, 10, 10, 10_000, 5);
  assert.equal(c5.feverTier, 'overdrive');
  assert.equal(c5.feverRatio, 0.80);
  assert.equal(c5.feverLabel, '狂熱超頻');

  // Combo 6+: Maximum Fever / 極限狂熱
  const c6 = computeCombatStats(stats, 10, 10, 10_000, 6);
  assert.equal(c6.feverTier, 'max');
  assert.equal(c6.feverRatio, 1.0);
  assert.equal(c6.feverLabel, '極限狂熱');

  const c12 = computeCombatStats(stats, 10, 10, 10_000, 12);
  assert.equal(c12.feverTier, 'max');
  assert.equal(c12.feverRatio, 1.0);
  assert.equal(c12.feverLabel, '極限狂熱');
}

// Combo Garbage Table & Invariants
{
  // Standard Guideline combo garbage table:
  assert.deepEqual(
    COMBO_GARBAGE,
    [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5],
    'Combo garbage array must follow guideline steps',
  );

  // Score clear combo attack checks:
  const clearWithCombo = (comboCount) =>
    scoreClear({
      linesCleared: 1,
      level: 1,
      tSpin: 'none',
      backToBackReady: false,
      combo: comboCount,
      perfectClear: false,
      softDropRows: 0,
      hardDropRows: 0,
    });

  // Combo 0 -> nextCombo 1 -> attack 0
  assert.equal(clearWithCombo(0).attack, 0);
  // Combo 1 -> nextCombo 2 -> attack 1
  assert.equal(clearWithCombo(1).attack, 1);
  // Combo 3 -> nextCombo 4 -> attack 2
  assert.equal(clearWithCombo(3).attack, 2);
  // Combo 5 -> nextCombo 6 -> attack 3
  assert.equal(clearWithCombo(5).attack, 3);
  // Combo 7 -> nextCombo 8 -> attack 4
  assert.equal(clearWithCombo(7).attack, 4);
  // Combo 11 -> nextCombo 12 -> attack 5 (clamped to max)
  assert.equal(clearWithCombo(11).attack, 5);

  // Combo score formula: 50 * combo * level
  const comboScored = clearWithCombo(4);
  assert.equal(comboScored.comboScore, 50 * 4 * 1);
  const comboScoredL3 = scoreClear({
    linesCleared: 2,
    level: 3,
    tSpin: 'none',
    backToBackReady: false,
    combo: 6,
    perfectClear: false,
    softDropRows: 0,
    hardDropRows: 0,
  });
  assert.equal(comboScoredL3.comboScore, 50 * 6 * 3);
}

// Back-to-Back 1.5x Score Bonus Invariants
{
  const difficultCases = [
    { name: 'Tetris', lines: 4, tSpin: 'none', baseScore: 800, baseAttack: 4 },
    { name: 'T-Spin Single', lines: 1, tSpin: 'full', baseScore: 800, baseAttack: 2 },
    { name: 'T-Spin Double', lines: 2, tSpin: 'full', baseScore: 1200, baseAttack: 4 },
    { name: 'T-Spin Triple', lines: 3, tSpin: 'full', baseScore: 1600, baseAttack: 6 },
    { name: 'T-Spin Mini Single', lines: 1, tSpin: 'mini', baseScore: 100, baseAttack: 0 },
    { name: 'T-Spin Mini Double', lines: 2, tSpin: 'mini', baseScore: 200, baseAttack: 1 },
  ];

  for (const { name, lines, tSpin, baseScore, baseAttack } of difficultCases) {
    for (const level of [1, 2, 5, 10]) {
      // Non-B2B clear:
      const normalClear = scoreClear({
        linesCleared: lines,
        level,
        tSpin,
        backToBackReady: false,
        combo: 0,
        perfectClear: false,
        softDropRows: 0,
        hardDropRows: 0,
      });
      assert.equal(
        normalClear.clearScore,
        baseScore * level,
        `${name} level ${level} base score must equal base * level`,
      );
      assert.equal(normalClear.isBackToBack, false);
      assert.equal(normalClear.isDifficult, true);
      assert.equal(normalClear.nextBackToBackReady, true, `${name} must charge B2B readiness`);
      assert.equal(normalClear.attack, baseAttack);

      // B2B clear:
      const b2bClear = scoreClear({
        linesCleared: lines,
        level,
        tSpin,
        backToBackReady: true,
        combo: 0,
        perfectClear: false,
        softDropRows: 0,
        hardDropRows: 0,
      });
      assert.equal(
        b2bClear.clearScore,
        Math.floor(baseScore * level * 1.5),
        `${name} level ${level} B2B score must strictly equal floor(base * level * 1.5)`,
      );
      assert.equal(b2bClear.isBackToBack, true);
      assert.equal(b2bClear.nextBackToBackReady, true);
      assert.equal(b2bClear.attack, baseAttack + 1, `${name} B2B must add +1 attack bonus`);
    }
  }

  // Non-difficult clear breaking B2B:
  for (const plainLines of [1, 2, 3]) {
    const breaking = scoreClear({
      linesCleared: plainLines,
      level: 1,
      tSpin: 'none',
      backToBackReady: true,
      combo: 0,
      perfectClear: false,
      softDropRows: 0,
      hardDropRows: 0,
    });
    assert.equal(breaking.isBackToBack, false);
    assert.equal(breaking.isDifficult, false);
    assert.equal(breaking.nextBackToBackReady, false, `Plain ${plainLines}-line clear must break B2B chain`);
  }

  // Lock without clearing lines maintains B2B state:
  const noClearPreserve = scoreClear({
    linesCleared: 0,
    level: 1,
    tSpin: 'none',
    backToBackReady: true,
    combo: 0,
    perfectClear: false,
    softDropRows: 0,
    hardDropRows: 0,
  });
  assert.equal(noClearPreserve.nextBackToBackReady, true, 'Zero line clear must preserve B2B readiness');
}

// =========================================================================
// Cheese Race Digging Depth & Daily Challenge Seed Determinism
// =========================================================================

// Cheese Race Board Digging Depth & Stars
{
  for (const depth of [3, 5, 10, 15, 18]) {
    const cheeseBoard = createCheeseBoard(depth, 99);
    assert.equal(cheeseBoard.length, BOARD_SIZE.rows);

    let countGarbageRows = 0;
    for (let r = 0; r < BOARD_SIZE.rows; r++) {
      const gCells = cheeseBoard[r].filter((c) => c === 'G').length;
      const emptyCells = cheeseBoard[r].filter((c) => c === null).length;
      if (r < BOARD_SIZE.rows - depth) {
        assert.equal(emptyCells, BOARD_SIZE.cols, `Row ${r} must be empty above depth ${depth}`);
        assert.equal(gCells, 0);
      } else {
        countGarbageRows++;
        assert.equal(gCells, BOARD_SIZE.cols - 1, `Row ${r} must have 9 garbage cells`);
        assert.equal(emptyCells, 1, `Row ${r} must have exactly 1 hole`);
      }
    }
    assert.equal(countGarbageRows, depth, `Cheese board must contain exactly ${depth} garbage rows`);
  }

  // Seed determinism for cheese boards:
  const cheese1 = createCheeseBoard(10, 12345);
  const cheese2 = createCheeseBoard(10, 12345);
  const cheese3 = createCheeseBoard(10, 54321);
  assert.deepEqual(cheese1, cheese2, 'Identical seed must produce identical cheese board');
  assert.notDeepEqual(cheese1, cheese3, 'Different seed must produce different hole positions');

  // Simulated digging step: filling the hole of row 19 clears the row.
  const digBoard = createCheeseBoard(3, 42);
  const holeCol = digBoard[19].indexOf(null);
  assert.ok(holeCol >= 0);
  digBoard[19][holeCol] = 'T'; // fill the hole
  const { board: clearedBoard, linesCleared } = clearLines(digBoard);
  assert.equal(linesCleared, 1, 'Filling hole clears 1 garbage line');
  const remainingGarbage = clearedBoard.filter((row) => row.some((c) => c === 'G')).length;
  assert.equal(remainingGarbage, 2, 'Remaining garbage rows should decrease from 3 to 2');

  // Cheese stars tier boundaries (45s / 75s / 120s):
  assert.equal(cheeseStars(30_000, true), 3);
  assert.equal(cheeseStars(45_000, true), 3);
  assert.equal(cheeseStars(45_001, true), 2);
  assert.equal(cheeseStars(75_000, true), 2);
  assert.equal(cheeseStars(75_001, true), 1);
  assert.equal(cheeseStars(120_000, true), 1);
  assert.equal(cheeseStars(150_000, true), 1);
  assert.equal(cheeseStars(30_000, false), 0, 'Uncleared run gives 0 stars');
}

// Daily Challenge Seed Determinism & 7-Bag Integrity
{
  // Daily seed stability:
  const seedSprint1 = dailySeed('2026-11-19', 'sprint');
  const seedSprint2 = dailySeed('2026-11-19', 'sprint');
  const seedUltra = dailySeed('2026-11-19', 'ultra');
  const seedNextDay = dailySeed('2026-11-20', 'sprint');

  assert.equal(seedSprint1, seedSprint2, 'Daily seed for same date and mode must be deterministic');
  assert.notEqual(seedSprint1, seedUltra, 'Sprint and Ultra must produce distinct seeds');
  assert.notEqual(seedSprint1, seedNextDay, 'Different dates must produce distinct seeds');

  // Piece sequence 7-bag permutation integrity across 40 full bags:
  const pieces = generateSeededPieces(seedSprint1, DAILY_PIECE_COUNT);
  assert.equal(pieces.length, DAILY_PIECE_COUNT);
  assert.equal(DAILY_PIECE_COUNT % 7, 0, 'Daily piece count should be a multiple of 7');

  const bagCount = DAILY_PIECE_COUNT / 7;
  for (let b = 0; b < bagCount; b++) {
    const bagSlice = pieces.slice(b * 7, (b + 1) * 7);
    const sorted = [...bagSlice].sort().join('');
    assert.equal(sorted, 'IJLOSTZ', `Bag #${b} must contain each of IJLOSTZ exactly once`);
  }

  // Reproducibility across multiple generator runs:
  const piecesRepeat = generateSeededPieces(seedSprint1, DAILY_PIECE_COUNT);
  assert.deepEqual(pieces, piecesRepeat, 'Seeded bag generator must be completely reproducible');

  // Daily streak calculation logic:
  let meta = emptyDailyMeta();
  meta = mergeDailyResult(meta, '2026-11-16', 'sprint', 55_000, 40, true);
  meta = mergeDailyResult(meta, '2026-11-17', 'sprint', 50_000, 40, true);
  meta = mergeDailyResult(meta, '2026-11-18', 'ultra', 30_000, 30, true);
  meta = mergeDailyResult(meta, '2026-11-19', 'sprint', 45_000, 40, true);
  assert.equal(computeDailyStreak(meta, '2026-11-19'), 4, 'Consecutive 4 days must yield streak of 4');

  // Broken streak (skip 2026-11-20, clear 2026-11-21):
  meta = mergeDailyResult(meta, '2026-11-21', 'sprint', 42_000, 40, true);
  assert.equal(computeDailyStreak(meta, '2026-11-21'), 1, 'Gap in daily clears must reset streak to 1');

  // Daily share text format checks:
  const sprintShare = buildDailyShareText({
    date: '2026-11-19',
    kind: 'sprint',
    value: 45_000,
    lines: 40,
    cleared: true,
    streak: 4,
  });
  assert.ok(sprintShare.includes('每日 40 行'));
  assert.ok(sprintShare.includes('2026-11-19'));
  assert.ok(sprintShare.includes('連續 4 天'));

  const ultraShare = buildDailyShareText({
    date: '2026-11-19',
    kind: 'ultra',
    value: 48_500,
    lines: 60,
    cleared: true,
    streak: 4,
  });
  assert.ok(ultraShare.includes('每日 Ultra'));
  assert.ok(ultraShare.includes('48500 分'));
  assert.ok(ultraShare.includes('連續 4 天'));
}

console.log('check-tetris: ok');
