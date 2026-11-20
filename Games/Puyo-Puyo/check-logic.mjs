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
loadScript('src/js/tactics.js', context);
loadScript('src/js/missions.js', context);
loadScript('src/js/daily.js', context);
loadScript('src/js/audio.js', context);
loadScript('src/js/juice.js', context);

const L = context.window.PuyoLogic;
const T = context.window.PuyoTactics;
const M = context.window.PuyoMissions;
const D = context.window.PuyoDaily;
const A = context.window.PuyoAudio;
const J = context.window.PuyoJuice;

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
  assert.ok(M.MISSION_LADDER.length >= 20, 'mission pack 2 extends ladder to ≥20');
  assert.ok(
    M.MISSION_LADDER.filter(function (m) { return m.pack === 2; }).length >= 8,
    'pack 2 has at least 8 quests'
  );
  assert.ok(
    M.MISSION_LADDER.some(function (m) { return m.timeLimitSec > 0; }),
    'includes timed mission'
  );
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
  assert.ok(M.missionById('m13-stair-mirror'), 'pack 2 starts at m13');
  assert.ok(M.missionById('m22-clear-green-ojama'), 'pack 2 ends at m22');

  // Daily puzzle — Taipei seed, deterministic pool, streak + share text.
  assert.ok(D, 'PuyoDaily loaded');
  assert.ok(D.DAILY_POOL.length >= 8, 'daily pool has several puzzles');
  {
    const key = D.taipeiDateKey(new Date(Date.UTC(2026, 9, 21, 16, 0, 0))); // 2026-10-22 00:00 Taipei
    assert.equal(key, '2026-10-22', 'UTC evening maps to next Taipei calendar day');
    const a = D.puzzleForDate('2026-10-22');
    const b = D.puzzleForDate('2026-10-22');
    assert.equal(a.poolId, b.poolId, 'same date → same pool entry');
    assert.equal(a.dateKey, '2026-10-22');
    assert.equal(a.id, 'daily-2026-10-22');
    const verified = M.verifyMission(a);
    assert.ok(verified.ok, 'today-style daily puzzle solvable');
    D.DAILY_POOL.forEach(function (entry) {
      const result = M.verifyMission(entry);
      assert.ok(result.ok, entry.poolId + ' pool entry solvable');
      assert.equal(result.stars, 3, entry.poolId + ' optimal is 3★');
    });
    assert.equal(D.computeStreak(['2026-10-20', '2026-10-21'], '2026-10-22'), 2);
    assert.equal(D.computeStreak(['2026-10-22'], '2026-10-22'), 1);
    assert.equal(D.computeStreak([], '2026-10-22'), 0);
    const share = D.buildShareText({
      dateKey: '2026-10-22',
      cleared: true,
      movesUsed: 1,
      stars: 3,
      streak: 2,
      goalLabel: '目標 2 連鎖',
    });
    assert.ok(share.indexOf('2026-10-22') >= 0);
    assert.ok(share.indexOf('連勝 2 天') >= 0);
    assert.ok(share.indexOf('魔法氣泡') >= 0);
  }

  // Board themes unlock by total mission stars.
  assert.ok(L.BOARD_THEMES.length >= 3, 'at least classic + 2 unlockable themes');
  assert.equal(L.isThemeUnlocked('classic', 0), true);
  assert.equal(L.isThemeUnlocked('sunset', 0), false);
  assert.equal(L.isThemeUnlocked('sunset', 10), true);
  assert.equal(L.isThemeUnlocked('aurora', 24), true);
  assert.equal(L.isThemeUnlocked('candy', 39), false);
  assert.equal(L.isThemeUnlocked('candy', 40), true);
  {
    let s = L.mergeStats(null);
    assert.equal(s.boardTheme, 'classic');
    assert.equal(s.dailyClears.length, 0);
    assert.equal(s.dailyBest, null);
    s = L.recordDailyResult(s, {
      dateKey: '2026-10-22',
      cleared: true,
      movesUsed: 2,
      stars: 2,
      chain: 3,
    });
    assert.equal(s.dailyBest.dateKey, '2026-10-22');
    assert.equal(s.dailyBest.bestMoves, 2);
    assert.equal(s.dailyBest.bestStars, 2);
    assert.ok(s.dailyClears.indexOf('2026-10-22') >= 0);
    s = L.recordDailyResult(s, {
      dateKey: '2026-10-22',
      cleared: true,
      movesUsed: 1,
      stars: 3,
      chain: 4,
    });
    assert.equal(s.dailyBest.bestMoves, 1, 'best moves only improve');
    assert.equal(s.dailyBest.bestStars, 3, 'stars only climb');
    assert.equal(s.dailyBest.attempts, 2);
    s = L.withBoardTheme(s, 'candy');
    assert.equal(s.boardTheme, 'classic', 'locked theme rejected');
    // Unlock candy via mission stars.
    for (let i = 0; i < 14; i += 1) {
      s = L.recordMissionClear(s, 'star-fill-' + i, 2, 3);
    }
    assert.ok(L.totalMissionStars(s) >= 40);
    s = L.withBoardTheme(s, 'candy');
    assert.equal(s.boardTheme, 'candy');
    assert.ok(L.VALID_MODES.daily, 'daily mode registered');
  }

  // PuyoTactics suite: damage matrix, counter estimation, board heatmap, drop simulation, and strategies.
  assert.ok(T, 'PuyoTactics loaded');
  {
    const matrix = T.getChainDamageMatrix();
    assert.equal(matrix.length, 7, 'matrix covers 1 to 7+ chains');
    assert.equal(matrix[0].chain, 1);
    assert.equal(matrix[0].garbage, 0, '1-chain gives 0 garbage');
    assert.ok(matrix[1].garbage > 0, '2-chain sends garbage');
    assert.ok(matrix[6].garbage >= 350, '7-chain tier has 350+ garbage');

    const strats = T.getClassicStrategies();
    assert.equal(strats.length, 3, 'stairs, sandwich, gtr');
    assert.equal(strats[0].id, 'stairs');
    assert.equal(strats[1].id, 'sandwich');
    assert.equal(strats[2].id, 'gtr');
    strats.forEach(function (strat) {
      assert.ok(strat.blueprint.length === 6, strat.id + ' blueprint has 6 rows');
      assert.ok(strat.blueprint[0].length === 6, strat.id + ' blueprint has 6 cols');
      assert.ok(strat.steps.length >= 3, strat.id + ' has detailed steps');
    });

    const safeCounter = T.counterChainNeeded(0);
    assert.equal(safeCounter.requiredChain, 0);
    assert.equal(safeCounter.status, 'safe');

    const minorThreat = T.counterChainNeeded(8);
    assert.equal(minorThreat.requiredChain, 2);
    assert.equal(minorThreat.status, 'warning');

    const mediumThreat = T.counterChainNeeded(25);
    assert.equal(mediumThreat.requiredChain, 3);
    assert.equal(mediumThreat.status, 'danger');

    const heavyThreat = T.counterChainNeeded(60);
    assert.equal(heavyThreat.requiredChain, 4);

    const board = L.createBoard();
    board[12][0] = 'red';
    board[12][1] = 'red';
    board[12][2] = 'red';
    board[12][3] = 'blue';
    board[11][3] = 'blue';
    board[10][3] = 'blue';
    board[12][4] = L.GARBAGE;

    const analysis = T.analyzeBoardColors(board, 4);
    assert.equal(analysis.counts.red, 3);
    assert.equal(analysis.counts.blue, 3);
    assert.equal(analysis.counts.garbage, 1);
    assert.equal(analysis.totalSettled, 7);
    assert.ok(analysis.fuses.length >= 1, '3-connected clusters with open air are detected as fuses');

    const pair = {
      row: L.HIDDEN_ROWS,
      col: 0,
      rot: 0,
      axis: 'red',
      child: 'green',
    };
    const evalCurrent = T.evaluateCurrentDrop(board, pair);
    assert.ok(evalCurrent, 'current drop evaluated');
    assert.equal(evalCurrent.chain, 1, 'dropping fourth red triggers 1 chain');
    assert.ok(evalCurrent.cleared >= 4);

    const optimal = T.findOptimalPlacement(board, pair);
    assert.ok(optimal, 'optimal search completed');
    assert.ok(optimal.maxChain >= 1);
    assert.ok(optimal.bestSetupPlacement !== null);
  }

  // =========================================================================
  // Deepened Test Suite 1: 1-chain to 7+ chain garbage formulas & preview icons
  // =========================================================================
  {
    assert.equal(L.GARBAGE_RATE, 70, 'standard Puyo garbage conversion rate is 70 pts/puyo');

    // 1-chain to 7+ chain scoring and garbage calculation verification
    const chainScores = [
      { chain: 1, puyos: 4, expectedMult: 1, expectedScore: 40, expectedGarbage: 0 },
      { chain: 2, puyos: 4, expectedMult: 8, expectedScore: 320, expectedGarbage: 4 },
      { chain: 3, puyos: 4, expectedMult: 16, expectedScore: 640, expectedGarbage: 9 },
      { chain: 4, puyos: 4, expectedMult: 32, expectedScore: 1280, expectedGarbage: 18 },
      { chain: 5, puyos: 4, expectedMult: 64, expectedScore: 2560, expectedGarbage: 36 },
      { chain: 6, puyos: 4, expectedMult: 96, expectedScore: 3840, expectedGarbage: 54 },
      { chain: 7, puyos: 4, expectedMult: 128, expectedScore: 5120, expectedGarbage: 73 },
      { chain: 8, puyos: 4, expectedMult: 160, expectedScore: 6400, expectedGarbage: 91 },
      { chain: 12, puyos: 4, expectedMult: 288, expectedScore: 11520, expectedGarbage: 164 },
      { chain: 19, puyos: 4, expectedMult: 512, expectedScore: 20480, expectedGarbage: 292 },
      { chain: 20, puyos: 4, expectedMult: 544, expectedScore: 21760, expectedGarbage: 310 },
    ];

    chainScores.forEach(function (tc) {
      const res = L.calculateScore(tc.chain, tc.puyos, 1, 4, 70);
      assert.equal(res.multiplier, tc.expectedMult, `chain ${tc.chain} multiplier`);
      assert.equal(res.score, tc.expectedScore, `chain ${tc.chain} score`);
      assert.equal(res.garbage, tc.expectedGarbage, `chain ${tc.chain} garbage`);

      // Verify object-argument call signature
      const objRes = L.calculateScore({
        chain: tc.chain,
        cleared: tc.puyos,
        colorCount: 1,
        groupSize: 4,
        garbageRate: 70,
      });
      assert.equal(objRes.score, tc.expectedScore);
      assert.equal(objRes.garbage, tc.expectedGarbage);
    });

    // Color bonuses: 1 color=0, 2 colors=3, 3 colors=6, 4 colors=12, 5 colors=24
    assert.equal(L.calculateScore(1, 4, 1, 4).colorBonus, 0);
    assert.equal(L.calculateScore(1, 8, 2, 4).colorBonus, 3);
    assert.equal(L.calculateScore(1, 12, 3, 4).colorBonus, 6);
    assert.equal(L.calculateScore(1, 16, 4, 4).colorBonus, 12);
    assert.equal(L.calculateScore(1, 20, 5, 4).colorBonus, 24);

    // Group bonuses: 4=0, 5=2, 6=3, 7=4, 8=5, 9=6, 10=7, 11+=10
    const groupBonusChecks = [
      { size: 4, expected: 0 },
      { size: 5, expected: 2 },
      { size: 6, expected: 3 },
      { size: 7, expected: 4 },
      { size: 8, expected: 5 },
      { size: 9, expected: 6 },
      { size: 10, expected: 7 },
      { size: 11, expected: 10 },
      { size: 16, expected: 10 },
    ];
    groupBonusChecks.forEach(function (chk) {
      assert.equal(L.groupBonus(chk.size), chk.expected, `group bonus for size ${chk.size}`);
      const res = L.calculateScore(1, chk.size, 1, chk.size);
      assert.equal(res.groupBonus, chk.expected);
    });

    // Multiplier clamping (1..999)
    assert.equal(L.calculateScore(0, 4, 0, 0).multiplier, 1, 'minimum multiplier is 1');
    assert.equal(L.calculateScore(50, 40, 5, 20).multiplier, 999, 'maximum multiplier clamped to 999');

    // Array-based group calculation matching stepScore
    const dummyGroups = [
      { color: 'red', cells: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }, { r: 0, c: 3 }] },
      { color: 'blue', cells: [{ r: 1, c: 0 }, { r: 1, c: 1 }, { r: 1, c: 2 }, { r: 1, c: 3 }, { r: 1, c: 4 }] },
    ];
    const groupRes = L.calculateScore(dummyGroups, 2);
    assert.equal(groupRes.cleared, 9);
    // Chain 2: power 8 + 2 colors (3) + group 5 (2) = 13. Score = 10 * 9 * 13 = 1170. Garbage = Math.floor(1170/70) = 16.
    assert.equal(groupRes.multiplier, 13);
    assert.equal(groupRes.score, 1170);
    assert.equal(groupRes.garbage, 16);

    // Garbage preview icon breakdown (small=1, large=6, rock=30, star=180, moon=360, crown=720)
    // Points at 70 pts/garbage: small=70, large=420, rock=2100, star=12600, moon=25200, crown=50400
    function assertJson(actual, expected, msg) {
      assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);
    }
    assertJson(L.garbagePreviewIcons(0), []);
    assertJson(L.garbagePreviewIcons(1), [{ kind: 'small', value: 1, glyph: '小' }]);
    assertJson(L.garbagePreviewIcons(6), [{ kind: 'large', value: 6, glyph: '大' }]);
    assertJson(L.garbagePreviewIcons(30), [{ kind: 'rock', value: 30, glyph: '石' }]);
    assertJson(L.garbagePreviewIcons(37), [
      { kind: 'rock', value: 30, glyph: '石' },
      { kind: 'large', value: 6, glyph: '大' },
      { kind: 'small', value: 1, glyph: '小' },
    ]);
    assertJson(L.garbagePreviewIcons(180), [{ kind: 'star', value: 180, glyph: '星' }]);
    assertJson(L.garbagePreviewIcons(360), [{ kind: 'moon', value: 360, glyph: '月' }]);
    assertJson(L.garbagePreviewIcons(720), [{ kind: 'crown', value: 720, glyph: '冠' }]);
    assertJson(L.garbagePreviewIcons(1440), [
      { kind: 'crown', value: 720, glyph: '冠' },
      { kind: 'crown', value: 720, glyph: '冠' },
    ]);

    // Rock & comet breakdown in competitive chain tiers
    // Chain 6: 233 garbage -> 1 star (180) + 1 rock (30) + 3 large (18) + 5 small (5) = 233
    const tier6Icons = L.garbagePreviewIcons(233);
    const tier6Total = tier6Icons.reduce((sum, ic) => sum + ic.value, 0);
    assert.equal(tier6Total, 233);
    assert.equal(tier6Icons[0].kind, 'star');
    assert.equal(tier6Icons[1].kind, 'rock');

    // Chain 7: 356 garbage -> 1 star (180) + 5 rocks (150) + 4 large (24) + 2 small (2) = 356
    const tier7Icons = L.garbagePreviewIcons(356);
    const tier7Total = tier7Icons.reduce((sum, ic) => sum + ic.value, 0);
    assert.equal(tier7Total, 356);
    assert.equal(tier7Icons[0].kind, 'star');
    assert.equal(tier7Icons.filter(ic => ic.kind === 'rock').length, 5);

    // Preview tray capacity is capped at 12 icons maximum
    const hugeIcons = L.garbagePreviewIcons(9999);
    assert.equal(hugeIcons.length, 12, 'preview icons capped at 12 glyphs');
  }

  // =========================================================================
  // Deepened Test Suite 2: Garbage cancellation buffer (相殺) under enemy threat
  // =========================================================================
  {
    assert.ok(typeof L.resolveGarbageBuffer === 'function', 'resolveGarbageBuffer exported');

    // Scenario 1: Symmetric concurrent clash with no pending incoming threat
    {
      const res = L.resolveGarbageBuffer(
        { outgoingGarbage: 14, incomingGarbage: 0 },
        { outgoingGarbage: 14, incomingGarbage: 0 }
      );
      assert.equal(res.mutualClash, 14, 'attacks cancel each other out fully');
      assert.equal(res.playerA.outgoingGarbage, 0);
      assert.equal(res.playerA.incomingGarbage, 0);
      assert.equal(res.playerB.outgoingGarbage, 0);
      assert.equal(res.playerB.incomingGarbage, 0);
    }

    // Scenario 2: Asymmetric clash sending surplus attack to opponent
    {
      const res = L.resolveGarbageBuffer(
        { outgoingGarbage: 25, incomingGarbage: 0 },
        { outgoingGarbage: 10, incomingGarbage: 0 }
      );
      assert.equal(res.mutualClash, 10);
      assert.equal(res.playerA.outgoingGarbage, 0);
      assert.equal(res.playerA.incomingGarbage, 0);
      assert.equal(res.playerB.outgoingGarbage, 0);
      assert.equal(res.playerB.incomingGarbage, 15, 'player B absorbs 15 surplus garbage');
    }

    // Scenario 3: Defensive self-cancellation under enemy garbage threat
    // Player A has incoming 12 from previous turns, and counters with outgoing 20 while B has outgoing 0
    {
      const res = L.resolveGarbageBuffer(
        { outgoingGarbage: 20, incomingGarbage: 12 },
        { outgoingGarbage: 0, incomingGarbage: 0 }
      );
      assert.equal(res.mutualClash, 0);
      assert.equal(res.selfCancelA, 12, 'player A cancels all 12 incoming garbage');
      assert.equal(res.playerA.incomingGarbage, 0, 'player A incoming cleared to 0');
      assert.equal(res.playerA.outgoingGarbage, 0);
      assert.equal(res.playerB.incomingGarbage, 8, 'player B absorbs remaining 8 overflow');
    }

    // Scenario 4: Partial self-cancellation (incoming threat exceeds outgoing counter)
    {
      const res = L.resolveGarbageBuffer(
        { outgoingGarbage: 9, incomingGarbage: 24 },
        { outgoingGarbage: 0, incomingGarbage: 0 }
      );
      assert.equal(res.selfCancelA, 9, 'all 9 attack consumed defensively');
      assert.equal(res.playerA.incomingGarbage, 15, '15 incoming garbage remains queued');
      assert.equal(res.playerB.incomingGarbage, 0, 'no attack overflowed to player B');
    }

    // Scenario 5: Concurrent clashing attacks while BOTH players have pending incoming threats
    // Player A: outgoing 30, incoming 10
    // Player B: outgoing 18, incoming 15
    {
      const res = L.resolveGarbageBuffer(
        { outgoingGarbage: 30, incomingGarbage: 10 },
        { outgoingGarbage: 18, incomingGarbage: 15 }
      );
      // Step 1: Mutual clash min(30, 18) = 18. A leftover outgoing = 12, B leftover outgoing = 0.
      // Step 2: A self-cancel min(12, 10) = 10. A incoming becomes 0. A leftover outgoing = 2.
      // Step 3: B self-cancel = 0 (no outgoing left). B incoming remains 15.
      // Step 4: A leftover 2 overflows to B incoming: 15 + 2 = 17.
      assert.equal(res.mutualClash, 18);
      assert.equal(res.selfCancelA, 10);
      assert.equal(res.selfCancelB, 0);
      assert.equal(res.playerA.incomingGarbage, 0);
      assert.equal(res.playerA.outgoingGarbage, 0);
      assert.equal(res.playerB.incomingGarbage, 17);
      assert.equal(res.playerB.outgoingGarbage, 0);
    }

    // Scenario 6: Overwhelming lethal counter-strike wiping threat and burying enemy
    // Player A has incoming 6, fires 4-chain producing 64 garbage
    // Player B has incoming 4, fires small 2-chain producing 9 garbage
    {
      const res = L.resolveGarbageBuffer(
        { outgoingGarbage: 64, incomingGarbage: 6 },
        { outgoingGarbage: 9, incomingGarbage: 4 }
      );
      assert.equal(res.mutualClash, 9);
      assert.equal(res.selfCancelA, 6);
      assert.equal(res.playerA.incomingGarbage, 0);
      // 64 - 9 - 6 = 49 overflow attack to player B
      assert.equal(res.playerB.incomingGarbage, 4 + 49, '4 initial + 49 overflow = 53');
    }

    // Tactical threat analysis with counterChainNeeded
    const threatTests = [
      { threat: 0, expectedChain: 0, expectedStatus: 'safe' },
      { threat: 1, expectedChain: 2, expectedStatus: 'warning' },
      { threat: 9, expectedChain: 2, expectedStatus: 'warning' },
      { threat: 10, expectedChain: 3, expectedStatus: 'danger' },
      { threat: 27, expectedChain: 3, expectedStatus: 'danger' },
      { threat: 28, expectedChain: 4, expectedStatus: 'danger' },
      { threat: 64, expectedChain: 4, expectedStatus: 'danger' },
      { threat: 65, expectedChain: 5, expectedStatus: 'danger' },
      { threat: 137, expectedChain: 5, expectedStatus: 'danger' },
      { threat: 138, expectedChain: 6, expectedStatus: 'danger' },
      { threat: 233, expectedChain: 6, expectedStatus: 'danger' },
      { threat: 234, expectedChain: 7, expectedStatus: 'danger' },
      { threat: 356, expectedChain: 7, expectedStatus: 'danger' },
      { threat: 357, expectedChain: 7, expectedStatus: 'critical' },
      { threat: 500, expectedChain: 7, expectedStatus: 'critical' },
    ];
    threatTests.forEach(function (tc) {
      const c = T.counterChainNeeded(tc.threat);
      assert.equal(c.requiredChain, tc.expectedChain, `threat ${tc.threat} requires chain`);
      assert.equal(c.status, tc.expectedStatus, `threat ${tc.threat} status`);
      assert.ok(c.description && c.description.length > 0);
    });
  }

  // =========================================================================
  // Deepened Test Suite 3: Nightmare / Master AI 4-move lookahead & heuristics
  // =========================================================================
  {
    assert.ok(L.DIFFICULTIES, 'DIFFICULTIES configuration registered');
    const master = L.DIFFICULTIES.master;
    const nightmare = L.DIFFICULTIES.nightmare;

    // Both top tiers use 4-move lookahead and asynchronous frame-budgeted planning
    assert.equal(master.lookahead, 4, 'master AI uses 4-move lookahead');
    assert.equal(nightmare.lookahead, 4, 'nightmare AI uses 4-move lookahead');
    assert.equal(master.asyncPlan, true);
    assert.equal(nightmare.asyncPlan, true);
    assert.equal(master.noise, 0, 'master is zero-noise deterministic');
    assert.equal(nightmare.noise, 0, 'nightmare is zero-noise deterministic');

    // Nightmare has strictly higher or equal strategic tuning across all heuristics
    assert.ok(nightmare.futureWeight > master.futureWeight, 'nightmare futureWeight > master');
    assert.ok(nightmare.attackWeight > master.attackWeight, 'nightmare attackWeight > master');
    assert.ok(nightmare.setupWeight > master.setupWeight, 'nightmare setupWeight > master');
    assert.ok(nightmare.weakPopPenalty > master.weakPopPenalty, 'nightmare weakPopPenalty > master');
    assert.ok(nightmare.buildBias > master.buildBias, 'nightmare buildBias > master');
    assert.ok(nightmare.allClearBonus > master.allClearBonus, 'nightmare allClearBonus > master');
    assert.ok(nightmare.flatnessWeight > master.flatnessWeight, 'nightmare flatnessWeight > master');
    assert.ok(nightmare.counterWeight > master.counterWeight, 'nightmare counterWeight > master');
    assert.ok(nightmare.triggerWeight > master.triggerWeight, 'nightmare triggerWeight > master');
    assert.ok(nightmare.garbageDropCap >= master.garbageDropCap, 'nightmare garbageDropCap >= master');
    assert.ok(nightmare.cpuMin < master.cpuMin, 'nightmare has faster minimum response');

    // boardDanger evaluation metric tests
    const emptyBoard = L.createBoard();
    assert.equal(L.boardDanger(emptyBoard), 0, 'empty board danger is 0');

    const lowBoard = L.createBoard();
    lowBoard[12][0] = 'red'; // row 12 -> ROWS - 12 = 1
    assert.equal(L.boardDanger(lowBoard), 1, 'single bottom puyo danger is 1');

    const highBoard = L.createBoard();
    for (let r = 2; r < L.ROWS; r += 1) {
      highBoard[r][2] = 'blue'; // col 2 stack height 11
    }
    const dangerHigh = L.boardDanger(highBoard);
    assert.equal(dangerHigh, L.ROWS - 2, 'danger matches top puyo distance');
    assert.ok(dangerHigh > 10, 'high stack triggers strong danger score');

    // Heuristic evaluatePlacement spot checks
    const evalBoard = L.createBoard();
    // Setup 3 reds at bottom
    evalBoard[12][0] = 'red';
    evalBoard[12][1] = 'red';
    evalBoard[12][2] = 'red';

    // Placement A: completes a premature 1-chain pop on safe board
    const popCandidate = L.dropPair(evalBoard, {
      row: L.HIDDEN_ROWS,
      col: 0,
      rot: 0,
      axis: 'red',
      child: 'green',
    });
    // Placement B: places non-matching puyo quietly on right side, preserving structure
    const quietCandidate = L.dropPair(evalBoard, {
      row: L.HIDDEN_ROWS,
      col: 4,
      rot: 0,
      axis: 'blue',
      child: 'yellow',
    });

    const scorePopSafe = L.evaluatePlacement(evalBoard, popCandidate, [], 1, 0, nightmare);
    const scoreQuietSafe = L.evaluatePlacement(evalBoard, quietCandidate, [], 1, 0, nightmare);
    // On a safe board with 0 incoming garbage, nightmare heavily penalizes the weak 1-chain pop
    assert.ok(
      scoreQuietSafe > scorePopSafe,
      'nightmare AI avoids weak 1-pop on safe board due to weakPopPenalty and buildBias'
    );

    // Under extreme incoming enemy threat (incoming = 16), counter-attack bonus kicks in
    const scorePopThreat = L.evaluatePlacement(evalBoard, popCandidate, [], 1, 16, nightmare);
    const scoreQuietThreat = L.evaluatePlacement(evalBoard, quietCandidate, [], 1, 16, nightmare);
    assert.ok(
      scorePopThreat > scoreQuietThreat,
      'under heavy incoming garbage threat, AI favors triggering attack to counter/cancel'
    );

    // Multi-move recursive lookahead simulation: bestPlacementFor across plies 1 to 4
    const tacticalBoard = L.createBoard();
    // Build a 2-chain stair setup missing its trigger and bridge
    tacticalBoard[12][0] = 'red';
    tacticalBoard[12][1] = 'red';
    tacticalBoard[12][2] = 'red';
    tacticalBoard[11][1] = 'blue';
    tacticalBoard[11][2] = 'blue';
    tacticalBoard[11][3] = 'blue';

    const testPair = {
      row: L.HIDDEN_ROWS,
      col: 2,
      rot: 0,
      axis: 'blue',
      child: 'yellow',
    };
    const testQueue = [
      { row: L.HIDDEN_ROWS, col: 2, rot: 0, axis: 'red', child: 'yellow' },
      { row: L.HIDDEN_ROWS, col: 2, rot: 0, axis: 'yellow', child: 'green' },
      { row: L.HIDDEN_ROWS, col: 2, rot: 0, axis: 'green', child: 'purple' },
    ];

    // Depth 1 vs Depth 4 comparison
    const planD1 = L.bestPlacementFor(tacticalBoard, testPair, testQueue, 1, 0, nightmare);
    const planD4 = L.bestPlacementFor(tacticalBoard, testPair, testQueue, 4, 0, nightmare);

    assert.ok(planD1 && planD1.placement, 'depth 1 produces valid placement');
    assert.ok(planD4 && planD4.placement, 'depth 4 produces valid placement');
    assert.ok(planD1.placement.col >= 0 && planD1.placement.col < L.COLS);
    assert.ok(planD4.placement.col >= 0 && planD4.placement.col < L.COLS);
    assert.ok(planD1.placement.rot >= 0 && planD1.placement.rot < 4);
    assert.ok(planD4.placement.rot >= 0 && planD4.placement.rot < 4);
    assert.ok(typeof planD4.score === 'number', 'depth 4 score is a valid finite number');
    assert.ok(Number.isFinite(planD4.score));
  }

  // =========================================================================
  // Deepened Test Suite 4: All 22 Mission Puzzles (Packs 1 & 2) & Star Conditions
  // =========================================================================
  {
    assert.equal(M.MISSION_LADDER.length, 22, 'mission ladder contains exactly 22 quests');

    const pack1 = M.MISSION_LADDER.filter(m => !m.pack || m.pack === 1);
    const pack2 = M.MISSION_LADDER.filter(m => m.pack === 2);
    assert.equal(pack1.length, 12, 'Mission Pack 1 contains 12 quests');
    assert.equal(pack2.length, 10, 'Mission Pack 2 contains 10 quests');

    // Comprehensive validation of all 22 individual mission puzzles
    M.MISSION_LADDER.forEach(function (mission, idx) {
      assert.ok(mission.id, `mission #${idx + 1} has id`);
      assert.ok(mission.title, `${mission.id} has title`);
      assert.ok(mission.blurb, `${mission.id} has blurb`);
      assert.ok(mission.lines && mission.lines.length >= 6, `${mission.id} has board lines`);
      assert.ok(mission.queue && mission.queue.length >= 1, `${mission.id} has puyo queue`);
      assert.ok(mission.solution && mission.solution.length >= 1, `${mission.id} has optimal solution`);
      assert.ok(mission.moveLimit >= mission.solution.length, `${mission.id} moveLimit accommodates solution`);
      assert.ok(mission.colorCount === 4 || mission.colorCount === 5, `${mission.id} colorCount is 4 or 5`);

      // Goal-type verification
      assert.ok(['chain', 'allClear', 'clearColor'].includes(mission.goalType), `${mission.id} valid goalType`);
      if (mission.goalType === 'chain') {
        assert.ok(mission.targetChain >= 2, `${mission.id} targetChain is at least 2`);
      } else if (mission.goalType === 'clearColor') {
        assert.ok(mission.clearColor, `${mission.id} specifies clearColor`);
      }

      // Solvability and 3-Star optimal clear check
      const result = M.verifyMission(mission);
      assert.ok(result.ok, `${mission.id} clears via solution: ${JSON.stringify(result)}`);
      assert.equal(result.stars, 3, `${mission.id} optimal solution clears with 3★`);
      assert.ok(result.moves <= mission.solution.length);

      // Star rating boundary test for each mission:
      // 1. Optimal moves -> 3 stars
      const optMoves = mission.solution.length;
      assert.equal(M.rateStars(mission, optMoves), 3, `${mission.id}: ${optMoves} moves = 3★`);

      // 2. Sub-optimal moves evaluation
      if (mission.moveLimit > optMoves) {
        const midMoves = Math.ceil((optMoves + mission.moveLimit) / 2);
        assert.equal(M.rateStars(mission, midMoves), 2, `${mission.id}: ${midMoves} moves = 2★`);
        if (mission.moveLimit > midMoves) {
          assert.equal(M.rateStars(mission, mission.moveLimit), 1, `${mission.id}: ${mission.moveLimit} moves = 1★`);
        }
      }

      // 3. Beyond moveLimit -> clamps to 1 star
      assert.equal(M.rateStars(mission, mission.moveLimit + 1), 1, `${mission.id} over limit gives 1★`);

      // Detailed step-by-step physical simulation of the solution on board
      let simBoard = M.boardFromLines(mission.lines);
      let maxChainObserved = 0;
      for (let s = 0; s < mission.solution.length; s += 1) {
        const step = mission.solution[s];
        const pair = mission.queue[s];
        const candidate = {
          row: L.HIDDEN_ROWS,
          col: step.col,
          rot: step.rot,
          axis: pair.axis,
          child: pair.child,
        };
        assert.ok(L.fits(simBoard, candidate), `${mission.id} step ${s} must fit on board`);
        const dropped = L.dropPair(simBoard, candidate);
        const locked = L.simulateLock(simBoard, dropped, 70);
        if (locked.chain > maxChainObserved) maxChainObserved = locked.chain;
        simBoard = locked.board;
      }
      assert.ok(M.goalMetOnBoard(mission, simBoard, maxChainObserved), `${mission.id} goal met at end of simulation`);
    });

    // Verify mission unlock progression sequentially from m1 to m22
    let clearsTracker = {};
    for (let i = 0; i < M.MISSION_LADDER.length; i += 1) {
      const curMission = M.MISSION_LADDER[i];
      assert.ok(M.isMissionUnlocked(curMission.id, clearsTracker), `${curMission.id} should be unlocked`);
      if (i + 1 < M.MISSION_LADDER.length) {
        const nextMission = M.MISSION_LADDER[i + 1];
        assert.equal(M.isMissionUnlocked(nextMission.id, clearsTracker), false, `${nextMission.id} locked before clear`);
        assert.equal(M.nextMissionId(clearsTracker), curMission.id);
      }
      clearsTracker[curMission.id] = true;
    }

    // Timed missions in Pack 2 check
    const timedMissions = M.MISSION_LADDER.filter(m => m.timeLimitSec > 0);
    assert.ok(timedMissions.length >= 3, 'Pack 2 includes timed puzzle challenges');
    timedMissions.forEach(function (tm) {
      assert.ok(tm.pack === 2, `${tm.id} timed mission belongs to Pack 2`);
      assert.ok(tm.timeLimitSec >= 15 && tm.timeLimitSec <= 60, `${tm.id} realistic time limit`);
    });
  }

  // =========================================================================
  // Deepened Test Suite 5: Asia/Taipei Daily Seed Determinism & Win Streaks
  // =========================================================================
  {
    assert.equal(D.TZ_OFFSET_MS, 8 * 60 * 60 * 1000, 'Taipei timezone offset is UTC+8');

    // Timezone boundary conversions (UTC -> Asia/Taipei calendar date)
    const tzCases = [
      { utc: Date.UTC(2026, 4, 15, 15, 59, 59), expected: '2026-05-15' },
      { utc: Date.UTC(2026, 4, 15, 16, 0, 0), expected: '2026-05-16' },
      { utc: Date.UTC(2026, 11, 31, 15, 59, 59), expected: '2026-12-31' },
      { utc: Date.UTC(2026, 11, 31, 16, 0, 0), expected: '2027-01-01' }, // Year boundary rollover
      { utc: Date.UTC(2028, 1, 28, 16, 0, 0), expected: '2028-02-29' },  // Leap day rollover
    ];
    tzCases.forEach(function (tc) {
      assert.equal(D.taipeiDateKey(new Date(tc.utc)), tc.expected, `UTC timestamp maps to Taipei date`);
    });

    // Calendar step-back: previousTaipeiDay across standard, month, year, and leap-day boundaries
    assert.equal(D.previousTaipeiDay('2026-10-22'), '2026-10-21');
    assert.equal(D.previousTaipeiDay('2026-10-01'), '2026-09-30');
    assert.equal(D.previousTaipeiDay('2027-01-01'), '2026-12-31');
    assert.equal(D.previousTaipeiDay('2028-03-01'), '2028-02-29'); // Leap year 2028
    assert.equal(D.previousTaipeiDay('2026-03-01'), '2026-02-28'); // Non-leap year 2026

    // FNV-1a hash determinism
    const sampleKey = '2026-11-19';
    const baseHash = D.hashString(sampleKey);
    for (let iter = 0; iter < 20; iter += 1) {
      assert.equal(D.hashString(sampleKey), baseHash, 'FNV-1a hash is strictly deterministic');
    }
    assert.notEqual(D.hashString('2026-11-19'), D.hashString('2026-11-20'), 'different dates produce distinct hashes');

    // 60 consecutive days of daily puzzle generation: all valid, solvable, and 3★
    const startDate = new Date(Date.UTC(2026, 9, 1, 0, 0, 0));
    for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
      const curDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const dateKey = D.taipeiDateKey(curDate);
      const puzzle = D.puzzleForDate(dateKey);
      assert.ok(puzzle, `puzzle generated for date ${dateKey}`);
      assert.equal(puzzle.dateKey, dateKey);
      assert.ok(puzzle.poolId && puzzle.poolId.length > 0);
      assert.ok(puzzle.solution && puzzle.solution.length > 0);

      const simRes = M.verifyMission(puzzle);
      assert.ok(simRes.ok, `daily puzzle for ${dateKey} (${puzzle.poolId}) is solvable`);
      assert.equal(simRes.stars, 3, `daily puzzle for ${dateKey} optimal clear is 3★`);
    }

    // Comprehensive win streak tracking test cases
    assert.equal(D.computeStreak([], '2026-10-22'), 0, 'empty history -> 0 streak');
    assert.equal(D.computeStreak(['2026-10-22'], '2026-10-22'), 1, 'cleared today only -> 1 streak');
    assert.equal(D.computeStreak(['2026-10-21', '2026-10-22'], '2026-10-22'), 2, 'consecutive 2 days -> 2');
    assert.equal(
      D.computeStreak(['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'], '2026-10-22'),
      5,
      'consecutive 5 days -> 5'
    );
    // When today has not been cleared yet, but yesterday was cleared
    assert.equal(
      D.computeStreak(['2026-10-19', '2026-10-20', '2026-10-21'], '2026-10-22'),
      3,
      'unbroken streak up to yesterday preserves count'
    );
    // Broken streak: gap of 2 days
    assert.equal(
      D.computeStreak(['2026-10-10', '2026-10-11', '2026-10-22'], '2026-10-22'),
      1,
      'gap resets streak to current day only'
    );
    // Unsorted array and duplicates
    assert.equal(
      D.computeStreak(['2026-10-22', '2026-10-20', '2026-10-21', '2026-10-21'], '2026-10-22'),
      3,
      'unsorted history with duplicate dates handled robustly'
    );

    // Share text formatting verification
    const shareCleared = D.buildShareText({
      dateKey: '2026-10-22',
      cleared: true,
      movesUsed: 1,
      stars: 3,
      streak: 7,
      goalLabel: '目標 2 連鎖',
      bestMoves: 1,
    });
    assert.ok(shareCleared.includes('魔法氣泡'), 'share text includes Traditional Chinese title');
    assert.ok(shareCleared.includes('2026-10-22'), 'share text includes date');
    assert.ok(shareCleared.includes('★★★'), 'share text includes 3 stars');
    assert.ok(shareCleared.includes('連勝 7 天'), 'share text includes streak count');
    assert.ok(shareCleared.includes('今日最佳 1 手'), 'share text includes best moves');

    const shareFailed = D.buildShareText({
      dateKey: '2026-10-22',
      cleared: false,
      movesUsed: 0,
      stars: 0,
      streak: 0,
      goalLabel: '目標 3 連鎖',
    });
    assert.ok(shareFailed.includes('尚未通關'), 'un-cleared puzzle displays in-progress status');
  }

  // =========================================================================
  // Deepened Test Suite 6: Pentatonic Chain Audio Scale & 7+ Mega Burst Mechanics
  // =========================================================================
  {
    assert.ok(A, 'PuyoAudio module loaded successfully');
    assert.ok(J, 'PuyoJuice module loaded successfully');

    // 1. Pentatonic scale constants and progression integrity
    assert.equal(A.BASE_PITCH_C5, 523.25, 'base pitch is C5 at 523.25 Hz');
    assert.ok(Array.isArray(A.PENTATONIC_SEMITONES), 'PENTATONIC_SEMITONES is an array');
    assert.ok(A.PENTATONIC_SEMITONES.length >= 16, 'pentatonic scale covers at least 16 chain steps');
    assert.equal(A.PENTATONIC_SEMITONES[0], 0, 'first step is root C (0 semitones)');

    // Verify strict monotonic increase of semitones
    for (let i = 1; i < A.PENTATONIC_SEMITONES.length; i += 1) {
      assert.ok(
        A.PENTATONIC_SEMITONES[i] > A.PENTATONIC_SEMITONES[i - 1],
        `semitone step ${i} is strictly higher than step ${i - 1}`
      );
    }

    // Verify key octave semitone offsets (0: C5, 12: C6, 24: C7, 36: C8)
    assert.equal(A.PENTATONIC_SEMITONES[0], 0);
    assert.equal(A.PENTATONIC_SEMITONES[5], 12, 'chain 6 reaches C6 (+12 semitones / 1 octave)');
    assert.equal(A.PENTATONIC_SEMITONES[10], 24, 'chain 11 reaches C7 (+24 semitones / 2 octaves)');
    assert.equal(A.PENTATONIC_SEMITONES[15], 36, 'chain 16 reaches C8 (+36 semitones / 3 octaves)');

    // 2. Chain sensory tier boundaries: 4 distinct escalation stages
    // Tier 1: chains 1-2 (crisp bubble pops)
    assert.equal(A.getChainTier(1), 1);
    assert.equal(A.getChainTier(2), 1);
    // Tier 2: chains 3-4 (major 3rd harmonic chime)
    assert.equal(A.getChainTier(3), 2);
    assert.equal(A.getChainTier(4), 2);
    // Tier 3: chains 5-6 (sub-bass punch + octave shimmer)
    assert.equal(A.getChainTier(5), 3);
    assert.equal(A.getChainTier(6), 3);
    // Tier 4: chains 7+ (Sakurai Mega Chain chord blast)
    assert.equal(A.getChainTier(7), 4);
    assert.equal(A.getChainTier(8), 4);
    assert.equal(A.getChainTier(15), 4);

    // 3. getChainPitch pitch calculation and harmonic overtone ratios
    const pitch1 = A.getChainPitch(1);
    assert.equal(pitch1.chain, 1);
    assert.equal(pitch1.semitones, 0);
    assert.equal(pitch1.baseFreq, 523.25);
    assert.equal(pitch1.tier, 1);
    // Harmonic intervals: major third is ~1.25992 ratio, fifth is ~1.4983 ratio, octave is exactly 2x
    assert.ok(Math.abs(pitch1.thirdFreq - pitch1.baseFreq * Math.pow(2, 4 / 12)) < 0.1);
    assert.ok(Math.abs(pitch1.fifthFreq - pitch1.baseFreq * Math.pow(2, 7 / 12)) < 0.1);
    assert.equal(pitch1.octaveFreq, Math.round(523.25 * 2 * 100) / 100);

    const pitch7 = A.getChainPitch(7);
    assert.equal(pitch7.chain, 7);
    assert.equal(pitch7.semitones, 14); // D6
    assert.equal(pitch7.tier, 4);
    assert.ok(pitch7.baseFreq > 1170 && pitch7.baseFreq < 1180, 'chain 7 fundamental is D6 (~1174.66 Hz)');

    // Pitch rises monotonically with each chain
    let prevFreq = 0;
    for (let c = 1; c <= 16; c += 1) {
      const p = A.getChainPitch(c);
      assert.ok(p.baseFreq > prevFreq, `chain ${c} freq (${p.baseFreq}) > prev freq (${prevFreq})`);
      prevFreq = p.baseFreq;
    }

    // Upper boundary clamping for chains > 16
    const pitch20 = A.getChainPitch(20);
    const pitch16 = A.getChainPitch(16);
    assert.equal(pitch20.baseFreq, pitch16.baseFreq, 'chains beyond scale length clamp to highest note');

    // 4. Mega-Burst Parameters (7+ chain screen shake & confetti parameters)
    for (let c = 1; c <= 6; c += 1) {
      const mb = A.getMegaBurstParams(c);
      assert.equal(mb.isMega, false, `chain ${c} is below mega threshold`);
      assert.equal(mb.shakeIntensity, 0, `chain ${c} has 0 mega shake intensity`);
      assert.equal(mb.confettiCount, 0, `chain ${c} has 0 confetti`);
      assert.equal(mb.sparkleArpeggioCount, c >= 3 ? 1 : 0);
    }

    const mb7 = A.getMegaBurstParams(7);
    assert.equal(mb7.isMega, true, 'chain 7 is mega burst');
    assert.equal(mb7.tier, 4);
    assert.equal(mb7.shakeIntensity, 2.2, 'chain 7 base mega shake intensity is 2.2');
    assert.equal(mb7.confettiCount, 42, 'chain 7 base confetti count is 42');
    assert.equal(mb7.burstParticleCount, 18, 'chain 7 base burst particle count is 18');
    assert.equal(mb7.subBassFreq, 65.41, 'chain 7 triggers visceral C2 65.41 Hz sub-bass shockwave');
    assert.equal(mb7.sparkleArpeggioCount, 4, 'chain 7 triggers 4-tone cascading arpeggio flourish');

    // Scaling above chain 7 (8, 9, 10, 12, 15)
    let lastShake = mb7.shakeIntensity;
    let lastConfetti = mb7.confettiCount;
    let lastBurst = mb7.burstParticleCount;
    for (let c = 8; c <= 15; c += 1) {
      const mb = A.getMegaBurstParams(c);
      assert.equal(mb.isMega, true);
      assert.ok(mb.shakeIntensity >= lastShake, `chain ${c} shake >= previous`);
      assert.ok(mb.confettiCount >= lastConfetti, `chain ${c} confetti >= previous`);
      assert.ok(mb.burstParticleCount >= lastBurst, `chain ${c} burst particles >= previous`);
      assert.ok(mb.shakeIntensity <= 3.2, 'shake intensity capped at 3.2');
      assert.ok(mb.confettiCount <= 75, 'confetti count capped at 75');
      assert.ok(mb.burstParticleCount <= 32, 'burst particle count capped at 32');
      lastShake = mb.shakeIntensity;
      lastConfetti = mb.confettiCount;
      lastBurst = mb.burstParticleCount;
    }

    // 5. Audio state muting controls
    A.setMuted(true);
    assert.equal(A.isMuted(), true, 'audio muted flag is true');
    // Calling playPop while muted must execute cleanly without error
    A.playPop(1);
    A.playPop(7);
    A.playLand();
    A.playRotate();
    A.setMuted(false);
    assert.equal(A.isMuted(), false, 'audio unmuted');
    // Calling playPop while unmuted with null AudioContext runs safely
    A.playPop(1);
    A.playPop(4);
    A.playPop(7);

    // 6. PuyoJuice onMegaBurst integration
    assert.equal(typeof J.onMegaBurst, 'function', 'PuyoJuice exports onMegaBurst function');
    assert.equal(typeof J.onPop, 'function', 'PuyoJuice exports onPop function');
  }
}

runTests();
console.log('Puyo logic checks passed.');
