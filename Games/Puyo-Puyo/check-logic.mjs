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
  assert.ok(L.nearTriggerScore(setupBoard) > 0, 'open 3-group is a near trigger');
  assert.ok(L.heightVariance(setupBoard) >= 0, 'heightVariance is non-negative');

  // Career stats pure helpers (vs-CPU + missions + stars + nightmare).
  assert.equal(L.STATS_KEY, 'clubhouse-puyo-stats');
  assert.ok(L.VALID_DIFFICULTIES.nightmare, 'nightmare difficulty registered');
  assert.ok(L.DIFFICULTY_IDS.includes('nightmare'));
  {
    const m = L.mergeStats({ wins: 3, winStreak: -2, lastDifficulty: 'nightmare', lastMode: 'coop' });
    assert.equal(m.byDifficulty.normal.wins, 3, 'legacy wins → normal');
    assert.equal(m.byDifficulty.normal.losses, 0, 'missing losses → 0');
    assert.equal(m.byDifficulty.normal.winStreak, 0, 'negative streak clamped');
    assert.equal(m.lastDifficulty, 'nightmare', 'nightmare difficulty preserved');
    assert.equal(m.lastMode, 'cpu', 'bad mode → cpu');
    assert.equal(m.byDifficulty.normal.bestMaxChain, 0, 'missing bestMaxChain → 0');
    assert.equal(m.byDifficulty.master.wins, 0, 'master tier present');
    assert.equal(m.byDifficulty.nightmare.wins, 0, 'nightmare tier present');
    assert.equal(L.mergeStats(null).byDifficulty.easy.wins, 0, 'null → defaults');
    assert.equal(L.mergeStats('nope').byDifficulty.hard.wins, 0, 'non-object → defaults');
    assert.equal(m.missionsClearedCount, 0);
    assert.equal(m.tutorialComplete, false);
    assert.equal(Object.keys(m.missionStars).length, 0);
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
    s = L.withPrefs(s, 'nightmare', 'mission');
    assert.equal(s.lastDifficulty, 'nightmare');
    assert.equal(s.lastMode, 'mission');
    s = L.recordMissionClear(s, 'm1-two', 2, 2);
    s = L.recordMissionClear(s, 'm1-two', 2, 1);
    assert.equal(s.missionsClearedCount, 1, 'mission clear idempotent');
    assert.equal(s.missionClears['m1-two'], true);
    assert.equal(s.missionStars['m1-two'], 2, 'stars only climb');
    s = L.recordMissionClear(s, 'm1-two', 2, 3);
    assert.equal(s.missionStars['m1-two'], 3, '3-star upgrade');
    // Legacy boolean clears migrate to 1★.
    const legacy = L.mergeStats({ missionClears: { 'm2-three': true } });
    assert.equal(legacy.missionStars['m2-three'], 1);
    assert.equal(legacy.missionClears['m2-three'], true);
    s = L.markTutorialComplete(s, 4);
    assert.equal(s.tutorialComplete, true);
    assert.equal(s.bestChainOverall, 5);
    s = L.noteMaxChain(s, 7, null);
    assert.equal(s.bestChainOverall, 7);
    s = L.recordCpuResult(s, true, 'nightmare');
    assert.equal(L.modeOf(s, 'nightmare').wins, 1);
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

  // Mission ladder + tutorial coverage and solvability.
  assert.ok(M.TUTORIAL_STAGES.length >= 4, 'tutorial covers connect + stair + 3 + 4');
  assert.ok(M.MISSION_LADDER.length >= 12, 'mission ladder has at least 12 quests');
  assert.ok(
    M.MISSION_LADDER.some(function (m) { return m.goalType === 'allClear'; }),
    'includes all-clear mission'
  );
  assert.ok(
    M.MISSION_LADDER.some(function (m) { return m.goalType === 'clearColor'; }),
    'includes clear-color mission'
  );
  assert.ok(
    M.TUTORIAL_STAGES.some(function (s) { return s.id === 'teach-stair'; }),
    'tutorial teaches stair setup'
  );

  assert.equal(M.rateStars({ moveLimit: 2, solution: [{}, {}] }, 2), 3);
  assert.equal(M.rateStars({ moveLimit: 3, solution: [{}, {}] }, 3), 2);
  assert.equal(M.rateStars({ moveLimit: 3, solution: [{}] }, 3), 1);

  M.TUTORIAL_STAGES.forEach(function (stage) {
    const result = M.verifyMission(stage);
    assert.ok(result.ok, stage.id + ' should clear via solution, got ' + JSON.stringify(result));
    assert.ok(result.stars >= 1 && result.stars <= 3);
  });
  M.MISSION_LADDER.forEach(function (mission) {
    assert.ok(mission.solution && mission.solution.length, mission.id + ' needs solution');
    const result = M.verifyMission(mission);
    assert.ok(result.ok, mission.id + ' should clear via solution, got ' + JSON.stringify(result));
    assert.equal(result.stars, 3, mission.id + ' optimal solution earns 3★');
    // Goal-type spot checks
    if (mission.goalType === 'allClear') {
      assert.ok(L.isBoardEmpty(
        (function () {
          let board = M.boardFromLines(mission.lines);
          for (let i = 0; i < mission.solution.length; i += 1) {
            const step = mission.solution[i];
            const pair = mission.queue[i];
            const candidate = {
              row: L.HIDDEN_ROWS,
              col: step.col,
              rot: step.rot,
              axis: pair.axis,
              child: pair.child,
            };
            board = L.simulateLock(board, L.dropPair(board, candidate), 70).board;
          }
          return board;
        })()
      ), mission.id + ' ends empty');
    }
    if (mission.goalType === 'clearColor') {
      let board = M.boardFromLines(mission.lines);
      let maxChain = 0;
      for (let i = 0; i < mission.solution.length; i += 1) {
        const step = mission.solution[i];
        const pair = mission.queue[i];
        const candidate = {
          row: L.HIDDEN_ROWS,
          col: step.col,
          rot: step.rot,
          axis: pair.axis,
          child: pair.child,
        };
        const locked = L.simulateLock(board, L.dropPair(board, candidate), 70);
        maxChain = Math.max(maxChain, locked.chain);
        board = locked.board;
      }
      assert.equal(M.countColor(board, mission.clearColor), 0, mission.id + ' clears color');
      assert.ok(M.goalMetOnBoard(mission, board, maxChain));
    }
  });

  assert.equal(M.nextMissionId({}), 'm1-two');
  assert.equal(M.nextMissionId({ 'm1-two': true }), 'm2-three');
  assert.equal(M.isMissionUnlocked('m1-two', {}), true);
  assert.equal(M.isMissionUnlocked('m2-three', {}), false);
  assert.equal(M.isMissionUnlocked('m2-three', { 'm1-two': true }), true);
  assert.equal(M.goalLabel(M.missionById('m7-all-clear')), '全消');
  assert.ok(M.goalLabel(M.missionById('m8-clear-red')).indexOf('紅') >= 0);
}

runTests();
console.log('Puyo logic checks passed.');
