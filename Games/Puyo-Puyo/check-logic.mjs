import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadScript(relPath, context) {
  const logicPath = path.join(process.cwd(), relPath);
  const source = fs.readFileSync(logicPath, 'utf8');
  vm.runInNewContext(source, context, { filename: logicPath });
}

const context = { window: {}, console };
loadScript('src/js/logic.js', context);
loadScript('src/js/missions.js', context);

const L = context.window.PuyoLogic;
const M = context.window.PuyoMissions;

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
  assert.ok(L.heightVariance(setupBoard) >= 0, 'heightVariance is non-negative');

  // Career stats pure helpers (vs-CPU + missions).
  assert.equal(L.STATS_KEY, 'clubhouse-puyo-stats');
  {
    const m = L.mergeStats({ wins: 3, winStreak: -2, lastDifficulty: 'nightmare', lastMode: 'coop' });
    assert.equal(m.byDifficulty.normal.wins, 3, 'legacy wins → normal');
    assert.equal(m.byDifficulty.normal.losses, 0, 'missing losses → 0');
    assert.equal(m.byDifficulty.normal.winStreak, 0, 'negative streak clamped');
    assert.equal(m.lastDifficulty, 'normal', 'bad difficulty → normal');
    assert.equal(m.lastMode, 'cpu', 'bad mode → cpu');
    assert.equal(m.byDifficulty.normal.bestMaxChain, 0, 'missing bestMaxChain → 0');
    assert.equal(m.byDifficulty.master.wins, 0, 'master tier present');
    assert.equal(L.mergeStats(null).byDifficulty.easy.wins, 0, 'null → defaults');
    assert.equal(L.mergeStats('nope').byDifficulty.hard.wins, 0, 'non-object → defaults');
    assert.equal(m.missionsClearedCount, 0);
    assert.equal(m.tutorialComplete, false);
  }
  {
    let s = L.mergeStats(null);
    s = L.recordCpuResult(s, true, 'hard');
    s = L.recordCpuResult(s, true, 'hard');
    assert.equal(L.modeOf(s, 'hard').wins, 2);
    assert.equal(L.modeOf(s, 'hard').winStreak, 2);
    assert.equal(L.modeOf(s, 'hard').bestWinStreak, 2);
    assert.equal(L.modeOf(s, 'easy').wins, 0, 'other difficulty untouched');
    s = L.recordCpuResult(s, false, 'hard');
    assert.equal(L.modeOf(s, 'hard').losses, 1);
    assert.equal(L.modeOf(s, 'hard').winStreak, 0);
    assert.equal(L.modeOf(s, 'hard').bestWinStreak, 2);
    assert.equal(L.modeOf(s, 'hard').wins, 2);
    s = L.noteMaxChain(s, 5, 'hard');
    s = L.noteMaxChain(s, 3, 'hard');
    assert.equal(L.modeOf(s, 'hard').bestMaxChain, 5, 'keeps higher chain');
    assert.equal(s.bestChainOverall, 5, 'overall best chain tracked');
    s = L.withPrefs(s, 'master', 'mission');
    assert.equal(s.lastDifficulty, 'master');
    assert.equal(s.lastMode, 'mission');
    s = L.recordMissionClear(s, 'm1-two', 2);
    s = L.recordMissionClear(s, 'm1-two', 2);
    assert.equal(s.missionsClearedCount, 1, 'mission clear idempotent');
    assert.equal(s.missionClears['m1-two'], true);
    s = L.markTutorialComplete(s, 4);
    assert.equal(s.tutorialComplete, true);
    assert.equal(s.bestChainOverall, 5);
    s = L.noteMaxChain(s, 7, null);
    assert.equal(s.bestChainOverall, 7);
  }

  // Undo helpers: clonePair / simulateLock for Hint ranking.
  {
    const pair = { row: 1, col: 2, rot: 0, axis: 'red', child: 'blue' };
    const cloned = L.clonePair(pair);
    assert.equal(cloned.row, pair.row);
    assert.equal(cloned.col, pair.col);
    assert.equal(cloned.rot, pair.rot);
    assert.equal(cloned.axis, pair.axis);
    assert.equal(cloned.child, pair.child);
    cloned.col = 5;
    assert.equal(pair.col, 2, 'clonePair must not share refs');
    assert.equal(L.clonePair(null), null);
  }
  {
    const board = L.createBoard();
    board[12][0] = 'red';
    board[11][0] = 'red';
    board[10][0] = 'red';
    const popPlacement = L.dropPair(board, {
      row: L.HIDDEN_ROWS,
      col: 0,
      rot: 0,
      axis: 'red',
      child: 'green',
    });
    const popResult = L.simulateLock(board, popPlacement, 70);
    assert.ok(popResult.chain >= 1, 'stacking a fourth red should start a chain');
    assert.ok(popResult.score > 0);

    const quietPlacement = L.dropPair(board, {
      row: L.HIDDEN_ROWS,
      col: 3,
      rot: 0,
      axis: 'blue',
      child: 'yellow',
    });
    const quietResult = L.simulateLock(board, quietPlacement, 70);
    assert.equal(quietResult.chain, 0, 'far-column drop should not pop');
    assert.ok(popResult.score > quietResult.score, 'hint ranking prefers the pop');
  }

  // Mission / tutorial one-move puzzles must reach their target chain.
  assert.ok(M.TUTORIAL_STAGES.length >= 3, 'tutorial covers 2–4 chains');
  assert.ok(M.MISSION_LADDER.length >= 5, 'mission ladder has several quests');
  M.TUTORIAL_STAGES.forEach(function (stage) {
    const result = M.verifyOneMove(stage);
    assert.ok(result.ok, stage.id + ' should clear at hint, got chain ' + result.chain);
    assert.ok(result.chain >= stage.targetChain);
  });
  M.MISSION_LADDER.forEach(function (mission) {
    if (mission.moveLimit !== 1 || !mission.hint) return;
    const result = M.verifyOneMove(mission);
    assert.ok(result.ok, mission.id + ' should clear at hint, got chain ' + result.chain);
  });

  assert.equal(M.nextMissionId({}), 'm1-two');
  assert.equal(M.nextMissionId({ 'm1-two': true }), 'm2-three');
  assert.equal(M.isMissionUnlocked('m1-two', {}), true);
  assert.equal(M.isMissionUnlocked('m2-three', {}), false);
  assert.equal(M.isMissionUnlocked('m2-three', { 'm1-two': true }), true);
}

runTests();
console.log('Puyo logic checks passed.');
