import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const logicPath = path.join(process.cwd(), 'src/js/logic.js');
const source = fs.readFileSync(logicPath, 'utf8');
const context = { window: {}, console };
vm.runInNewContext(source, context, { filename: logicPath });

const L = context.window.PuyoLogic;

function runTests() {
  const board = L.createBoard();
  board[12][0] = 'red';
  board[12][1] = 'red';
  board[12][2] = 'red';
  board[12][3] = 'red';
  board[11][1] = L.GARBAGE;
  board[11][2] = L.GARBAGE;

  const groups = L.findGroups(board);
  assert.equal(groups.length, 1, 'expected one red group to pop');
  const cleared = L.clearGroups(board, groups);
  assert.equal(cleared[12][0], null);
  assert.equal(cleared[12][3], null);
  assert.equal(cleared[11][1], null, 'adjacent garbage should clear with the pop');
  assert.equal(cleared[11][2], null, 'adjacent garbage should clear with the pop');

  const garbageBoard = L.withGarbage(L.createBoard(), 8);
  const garbageCells = garbageBoard.flat().filter(function (cell) { return cell === L.GARBAGE; }).length;
  assert.equal(garbageCells, 8, 'garbage count should match requested amount');
  assert.equal(L.findGroups(garbageBoard).length, 0, 'garbage alone must not pop');

  const placements = L.enumeratePlacements(L.createBoard(), {
    row: L.HIDDEN_ROWS,
    col: L.SPAWN_COL,
    rot: 0,
    axis: 'red',
    child: 'blue',
  });
  assert.ok(placements.length >= 10, 'empty board should have many legal placements');

  const icons = L.garbagePreviewIcons(547);
  assert.equal(icons[0].kind, 'moon', '360+ should start with moon/crown units');
  assert.equal(icons.reduce(function (sum, icon) { return sum + icon.value; }, 0), 547);

  const setupBoard = L.createBoard();
  setupBoard[12][0] = 'red';
  setupBoard[12][1] = 'red';
  setupBoard[12][2] = 'red';
  assert.ok(L.setupPotential(setupBoard) > 0, 'three connected puyos should count as setup');

  // Career stats pure helpers (vs-CPU replay hook).
  assert.equal(L.STATS_KEY, 'clubhouse-puyo-stats');
  {
    const m = L.mergeStats({ wins: 3, winStreak: -2, lastDifficulty: 'nightmare', lastMode: 'coop' });
    assert.equal(m.wins, 3, 'wins kept');
    assert.equal(m.losses, 0, 'missing losses → 0');
    assert.equal(m.winStreak, 0, 'negative streak clamped');
    assert.equal(m.lastDifficulty, 'normal', 'bad difficulty → normal');
    assert.equal(m.lastMode, 'cpu', 'bad mode → cpu');
    assert.equal(L.mergeStats(null).wins, 0, 'null → defaults');
    assert.equal(L.mergeStats('nope').wins, 0, 'non-object → defaults');
  }
  {
    let s = L.mergeStats(null);
    s = L.recordCpuResult(s, true);
    s = L.recordCpuResult(s, true);
    assert.equal(s.wins, 2);
    assert.equal(s.winStreak, 2);
    s = L.recordCpuResult(s, false);
    assert.equal(s.losses, 1);
    assert.equal(s.winStreak, 0);
    assert.equal(s.wins, 2);
    s = L.withPrefs(s, 'hard', 'versus');
    assert.equal(s.lastDifficulty, 'hard');
    assert.equal(s.lastMode, 'versus');
  }
}

runTests();
console.log('Puyo logic checks passed.');
