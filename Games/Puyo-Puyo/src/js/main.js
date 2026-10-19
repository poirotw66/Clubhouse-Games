/**
 * Puyo Puyo loop: vs CPU / local 2P / mission ladder / chain tutorial / free practice.
 * Plain script (no bundler) so the page runs from file:// as well as the dev server.
 */
(function (global) {
  'use strict';

  var L = global.PuyoLogic;
  var M = global.PuyoMissions;
  var R = global.PuyoRender;
  var A = global.PuyoAudio;
  var prefersReducedMotion = !!(
    global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  var CELL = 40;
  var PREVIEW_CELL = 26;
  var LOCK_DELAY = 480;
  var POP_DURATION = 430;
  var SETTLE_BASE = 70;
  var SETTLE_PER_ROW = 24;
  var SETTLE_MAX = 250;
  var SOFT_DROP_INTERVAL = 34;
  var DAS_DELAY = 170;
  var DAS_REPEAT = 55;
  var BASE_INTERVAL = 820;
  var MIN_INTERVAL = 110;
  var PUYOS_PER_LEVEL = 30;
  var GARBAGE_RATE = 70;

  // Hard/Master deepen lookahead; Easy pops early and plays slow.
  var DIFFICULTY_PRESETS = {
    easy: {
      label: '簡單',
      lookahead: 1,
      cpuMin: 140,
      cpuMax: 230,
      futureWeight: 0,
      attackWeight: 0.75,
      setupWeight: 0.15,
      weakPopPenalty: 0,
      buildBias: 0,
      garbageDropCap: 6,
      noise: 90,
      allClearBonus: 200,
      flatnessWeight: 0,
    },
    normal: {
      label: '普通',
      lookahead: 2,
      cpuMin: 90,
      cpuMax: 160,
      futureWeight: 0.4,
      attackWeight: 1,
      setupWeight: 0.55,
      weakPopPenalty: 80,
      buildBias: 0.25,
      garbageDropCap: 12,
      noise: 18,
      allClearBonus: 400,
      flatnessWeight: 4,
    },
    hard: {
      label: '困難',
      lookahead: 3,
      cpuMin: 40,
      cpuMax: 85,
      futureWeight: 0.78,
      attackWeight: 1.4,
      setupWeight: 1.4,
      weakPopPenalty: 280,
      buildBias: 0.95,
      garbageDropCap: 18,
      noise: 0,
      allClearBonus: 700,
      flatnessWeight: 10,
    },
    master: {
      label: '達人',
      lookahead: 3,
      cpuMin: 24,
      cpuMax: 55,
      futureWeight: 0.9,
      attackWeight: 1.55,
      setupWeight: 1.7,
      weakPopPenalty: 340,
      buildBias: 1.15,
      garbageDropCap: 24,
      noise: 0,
      allClearBonus: 1100,
      flatnessWeight: 16,
    },
  };

  var ui = {
    matchStatus: document.getElementById('match-status'),
    careerStats: document.getElementById('career-stats'),
    modeBadge: document.getElementById('mode-badge'),
    modeSelect: document.getElementById('match-mode'),
    difficultyField: document.getElementById('difficulty-field'),
    missionField: document.getElementById('mission-field'),
    missionSelect: document.getElementById('mission-select'),
    questPanel: document.getElementById('quest-panel'),
    questTitle: document.getElementById('quest-title'),
    questProgress: document.getElementById('quest-progress'),
    questBlurb: document.getElementById('quest-blurb'),
    questHintBtn: document.getElementById('btn-quest-hint'),
    questSkipBtn: document.getElementById('btn-quest-skip'),
    versusLayout: document.getElementById('versus-layout'),
    playerCardP2: document.getElementById('player-card-p2'),
    overlay: document.getElementById('result-overlay'),
    resultTitle: document.getElementById('result-title'),
    resultSummary: document.getElementById('result-summary'),
    resultP1Score: document.getElementById('result-p1-score'),
    resultP1Chain: document.getElementById('result-p1-chain'),
    resultP2Label: document.getElementById('result-p2-label'),
    resultP2Score: document.getElementById('result-p2-score'),
    resultP2ChainLabel: document.getElementById('result-p2-chain-label'),
    resultP2Chain: document.getElementById('result-p2-chain'),
    resultCareer: document.getElementById('result-career'),
    pauseButton: document.getElementById('btn-pause'),
    pauseLabel: document.getElementById('btn-pause-label'),
    muteButton: document.getElementById('btn-mute'),
    undoButton: document.getElementById('btn-undo'),
    hintButton: document.getElementById('btn-hint'),
    colorSelect: document.getElementById('color-count'),
    difficultySelect: document.getElementById('cpu-difficulty'),
    p2Title: document.getElementById('p2-title'),
    p2Badge: document.getElementById('p2-badge'),
    p2ControlsList: document.getElementById('p2-controls-list'),
  };

  var UNDO_LIMIT = 40;
  var HINT_MS = 3800;
  var undoStack = [];
  var hintCells = null;
  var hintUntil = 0;

  var career = L.mergeStats(null);

  var players = [
    createPlayerHandle('p1', '1P', false),
    createPlayerHandle('p2', 'CPU', true),
  ];

  var match = {
    mode: 'cpu',
    paused: false,
    over: false,
    winner: null,
    loser: null,
    difficulty: DIFFICULTY_PRESETS.normal,
    quest: null,
    tutorialIndex: 0,
    movesLeft: 0,
    lastChainPulse: 0,
  };

  var keysDown = {};
  var das = [
    { direction: 0, timer: 0 },
    { direction: 0, timer: 0 },
  ];
  var lastFrame = 0;

  function createPlayerHandle(prefix, label, isCpu) {
    return {
      prefix: prefix,
      label: label,
      isCpu: isCpu,
      field: document.getElementById(prefix + '-field'),
      fieldCtx: document.getElementById(prefix + '-field').getContext('2d'),
      next: document.getElementById(prefix + '-next'),
      nextCtx: document.getElementById(prefix + '-next').getContext('2d'),
      status: document.getElementById(prefix + '-status'),
      popup: document.getElementById(prefix + '-chain-popup'),
      ojama: document.getElementById(prefix + '-ojama'),
      statScore: document.getElementById(prefix + '-score'),
      statChain: document.getElementById(prefix + '-chain'),
      statMaxChain: document.getElementById(prefix + '-max-chain'),
      statCleared: document.getElementById(prefix + '-cleared'),
      statLevel: document.getElementById(prefix + '-level'),
      statGarbage: document.getElementById(prefix + '-garbage'),
      popupTimer: null,
      state: null,
    };
  }

  function setupCanvas(target, context, logicalWidth, logicalHeight) {
    var ratio = global.devicePixelRatio || 1;
    target.width = logicalWidth * ratio;
    target.height = logicalHeight * ratio;
    target.style.aspectRatio = logicalWidth + ' / ' + logicalHeight;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function newPlayerState(colorCount) {
    return {
      board: L.createBoard(),
      pair: null,
      queue: [L.createPair(colorCount), L.createPair(colorCount)],
      colorCount: colorCount,
      score: 0,
      chain: 0,
      maxChain: 0,
      totalCleared: 0,
      level: 1,
      phase: 'control',
      over: false,
      fallProgress: 0,
      lockTimer: 0,
      softDrop: false,
      settle: null,
      pop: null,
      incomingGarbage: 0,
      garbageJustDropped: 0,
      outgoingGarbage: 0,
      cpuPlan: null,
      cpuTimer: 0,
    };
  }

  function cloneSettle(settle) {
    if (!settle) return null;
    return {
      moves: settle.moves.map(function (move) {
        return {
          col: move.col,
          fromRow: move.fromRow,
          toRow: move.toRow,
          color: move.color,
        };
      }),
      targetBoard: L.cloneBoard(settle.targetBoard),
      elapsed: settle.elapsed,
      duration: settle.duration,
    };
  }

  function clonePop(pop) {
    if (!pop) return null;
    return {
      groups: pop.groups.map(function (group) {
        return {
          color: group.color,
          cells: group.cells.map(function (cell) {
            return { r: cell.r, c: cell.c };
          }),
        };
      }),
      elapsed: pop.elapsed,
    };
  }

  /** Deep copy of one side's runtime state for the undo stack. */
  function clonePlayerState(state) {
    return {
      board: L.cloneBoard(state.board),
      pair: L.clonePair(state.pair),
      queue: state.queue.map(L.clonePair),
      colorCount: state.colorCount,
      score: state.score,
      chain: state.chain,
      maxChain: state.maxChain,
      totalCleared: state.totalCleared,
      level: state.level,
      phase: state.phase,
      over: state.over,
      fallProgress: state.fallProgress,
      lockTimer: state.lockTimer,
      softDrop: false,
      settle: cloneSettle(state.settle),
      pop: clonePop(state.pop),
      incomingGarbage: state.incomingGarbage,
      garbageJustDropped: state.garbageJustDropped,
      outgoingGarbage: state.outgoingGarbage,
      cpuPlan: state.cpuPlan
        ? { targetCol: state.cpuPlan.targetCol, targetRot: state.cpuPlan.targetRot }
        : null,
      cpuTimer: state.cpuTimer,
    };
  }

  function clearHint() {
    hintCells = null;
    hintUntil = 0;
  }

  function refreshAssistButtons() {
    if (ui.undoButton) {
      ui.undoButton.disabled = match.over || undoStack.length === 0;
    }
    if (ui.hintButton) {
      ui.hintButton.disabled = match.over || match.paused || !canControl(players[0]);
    }
  }

  function pushUndoSnapshot() {
    undoStack.push({
      p1: clonePlayerState(players[0].state),
      p2: clonePlayerState(players[1].state),
    });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    refreshAssistButtons();
  }

  function undoLast() {
    if (match.over || undoStack.length === 0) return false;
    var snap = undoStack.pop();
    players[0].state = snap.p1;
    players[1].state = snap.p2;
    das[0].direction = 0;
    das[0].timer = 0;
    das[1].direction = 0;
    das[1].timer = 0;
    clearHint();
    players.forEach(function (player) {
      hidePopup(player);
      updateStats(player);
    });
    updateMatchStatus();
    refreshAssistButtons();
    A.playMove();
    return true;
  }

  function showHint() {
    if (match.over || match.paused || !canControl(players[0])) return false;
    var state = players[0].state;
    var landing = null;
    if (match.quest && match.quest.hint && state.pair) {
      var hinted = {
        row: L.HIDDEN_ROWS,
        col: match.quest.hint.col,
        rot: match.quest.hint.rot,
        axis: state.pair.axis,
        child: state.pair.child,
      };
      if (L.fits(state.board, hinted)) landing = L.dropPair(state.board, hinted);
    }
    if (!landing) {
      var best = bestPlacementFor(
        state.board,
        state.pair,
        state.queue,
        Math.max(2, match.difficulty.lookahead),
        state.incomingGarbage
      );
      if (!best) return false;
      landing = best.placement;
    }
    var child = L.childPos(landing);
    hintCells = [
      { row: landing.row, col: landing.col, color: landing.axis },
      { row: child.row, col: child.col, color: landing.child },
    ];
    hintUntil = global.performance.now() + HINT_MS;
    players[0].status.textContent = '提示：建議落點已標示（金色）';
    A.playMove();
    refreshAssistButtons();
    return true;
  }

  function opponentOf(player) {
    return players[0] === player ? players[1] : players[0];
  }

  function currentInterval(player) {
    return Math.max(MIN_INTERVAL, BASE_INTERVAL - (player.state.level - 1) * 55);
  }

  function currentDifficulty() {
    return DIFFICULTY_PRESETS[ui.difficultySelect.value] || DIFFICULTY_PRESETS.normal;
  }

  function isVersusMode() {
    return match.mode === 'versus';
  }

  function isSoloMode() {
    return match.mode === 'mission' || match.mode === 'tutorial' || match.mode === 'practice';
  }

  function formatCareerLine(stats, difficulty) {
    var diffId = difficulty || stats.lastDifficulty;
    var preset = DIFFICULTY_PRESETS[diffId] || DIFFICULTY_PRESETS.normal;
    var mode = L.modeOf(stats, diffId);
    return (
      '對 CPU（' +
      preset.label +
      '）：' +
      mode.wins +
      ' 勝 · ' +
      mode.losses +
      ' 敗 · 連勝 ' +
      mode.winStreak +
      ' · 最高連鎖 ' +
      mode.bestMaxChain +
      ' · 任務 ' +
      stats.missionsClearedCount +
      '/' +
      M.MISSION_LADDER.length +
      ' · 生涯最大連鎖 ' +
      stats.bestChainOverall
    );
  }

  function refreshMissionSelect() {
    if (!ui.missionSelect) return;
    var cleared = career.missionClears || {};
    var html = '';
    M.MISSION_LADDER.forEach(function (mission, index) {
      var unlocked = M.isMissionUnlocked(mission.id, cleared);
      var done = !!cleared[mission.id];
      html +=
        '<option value="' +
        mission.id +
        '"' +
        (unlocked ? '' : ' disabled') +
        '>' +
        (done ? '✓ ' : '') +
        mission.title +
        (unlocked ? '' : '（未解鎖）') +
        '</option>';
      if (!ui.missionSelect.value && unlocked && !done) {
        // defer selection after options exist
      }
      void index;
    });
    ui.missionSelect.innerHTML = html;
    var nextId = M.nextMissionId(cleared);
    if (nextId) ui.missionSelect.value = nextId;
    else if (M.MISSION_LADDER.length) ui.missionSelect.value = M.MISSION_LADDER[0].id;
  }

  function refreshCareerUi() {
    var difficulty = ui.difficultySelect ? ui.difficultySelect.value : career.lastDifficulty;
    var line = formatCareerLine(career, difficulty);
    ui.careerStats.textContent = line;
    ui.resultCareer.textContent = line;
  }

  function loadCareer() {
    try {
      var raw = global.localStorage.getItem(L.STATS_KEY);
      if (!raw) return L.mergeStats(null);
      return L.mergeStats(JSON.parse(raw));
    } catch (err) {
      return L.mergeStats(null);
    }
  }

  function saveCareer() {
    try {
      global.localStorage.setItem(L.STATS_KEY, JSON.stringify(L.mergeStats(career)));
    } catch (err) {
      // ponytail: quota / private mode — skip persist
    }
  }

  function persistPrefs() {
    var difficulty = ui.difficultySelect.value;
    var mode = ui.modeSelect.value;
    if (!L.VALID_MODES[mode]) mode = 'cpu';
    career = L.withPrefs(career, difficulty, mode);
    saveCareer();
  }

  function applySavedPrefs() {
    if (career.lastMode && L.VALID_MODES[career.lastMode]) {
      ui.modeSelect.value = career.lastMode;
    }
    if (career.lastDifficulty && L.VALID_DIFFICULTIES[career.lastDifficulty]) {
      ui.difficultySelect.value = career.lastDifficulty;
    }
  }

  function selectedMode() {
    var value = ui.modeSelect.value;
    return L.VALID_MODES[value] ? value : 'cpu';
  }

  function syncModeUi() {
    match.mode = selectedMode();
    var solo = isSoloMode();
    players[1].isCpu = match.mode === 'cpu';
    players[1].label = isVersusMode() ? '2P' : 'CPU';
    ui.p2Title.textContent = players[1].label;
    ui.p2Badge.textContent = isVersusMode() ? '玩家 2' : '自動對手';
    ui.p2Badge.classList.toggle('cpu-badge', !isVersusMode());
    if (match.mode === 'mission') ui.modeBadge.textContent = '任務模式 · 限手連鎖';
    else if (match.mode === 'tutorial') ui.modeBadge.textContent = '連鎖教室 · 互動教學';
    else if (match.mode === 'practice') ui.modeBadge.textContent = '自由練習 · 單人無對手';
    else if (isVersusMode()) ui.modeBadge.textContent = '1P vs 2P · 6×12 · 連鎖送垃圾';
    else ui.modeBadge.textContent = '1P vs CPU · 6×12 · 連鎖送垃圾';

    ui.difficultyField.hidden = match.mode !== 'cpu';
    ui.missionField.hidden = match.mode !== 'mission';
    ui.questPanel.hidden = !(match.mode === 'mission' || match.mode === 'tutorial');
    ui.colorSelect.disabled = match.mode === 'mission' || match.mode === 'tutorial';
    if (ui.playerCardP2) ui.playerCardP2.hidden = solo;
    if (ui.versusLayout) ui.versusLayout.classList.toggle('solo-layout', solo);
    document.body.classList.toggle('solo-mode', solo);

    ui.resultP2Label.textContent = solo ? '模式' : players[1].label + ' 分數';
    ui.resultP2ChainLabel.textContent = solo ? '剩餘手数' : players[1].label + ' 最大連鎖';
    ui.p2ControlsList.innerHTML = isVersusMode()
      ? '<li><kbd>A</kbd> <kbd>D</kbd> 左右移動</li>'
        + '<li><kbd>S</kbd> 加速落下</li>'
        + '<li><kbd>Q</kbd> 逆時針 · <kbd>E</kbd>/<kbd>W</kbd> 順時針</li>'
        + '<li><kbd>Shift</kbd> 瞬間落下</li>'
      : solo
        ? '<li>單人模式：無對手、無垃圾對攻</li>'
        : '<li>CPU 依難度自動思考與落子</li>';
    if (ui.questSkipBtn) {
      ui.questSkipBtn.hidden = match.mode !== 'tutorial';
    }
  }

  function updateQuestHud() {
    if (!match.quest) return;
    ui.questTitle.textContent = match.quest.title;
    ui.questBlurb.textContent = match.quest.blurb;
    ui.questProgress.textContent =
      '目標 ' +
      match.quest.targetChain +
      ' 連鎖 · 剩餘 ' +
      match.movesLeft +
      ' 手 · 本局最大 ' +
      players[0].state.maxChain;
  }

  function currentQuestDef() {
    if (match.mode === 'mission') {
      return M.missionById(ui.missionSelect.value) || M.MISSION_LADDER[0];
    }
    if (match.mode === 'tutorial') {
      return M.TUTORIAL_STAGES[match.tutorialIndex] || M.TUTORIAL_STAGES[0];
    }
    return null;
  }

  function flashGarbage(player) {
    if (!player.field || !player.state.garbageJustDropped) return;
    var frame = player.field.closest('.field-frame');
    if (!frame) return;
    frame.classList.remove('garbage-flash');
    void frame.offsetWidth;
    frame.classList.add('garbage-flash');
    if (prefersReducedMotion) {
      global.setTimeout(function () { frame.classList.remove('garbage-flash'); }, 200);
    }
  }

  function flashAllClear() {
    document.body.classList.remove('all-clear-flash');
    void document.body.offsetWidth;
    document.body.classList.add('all-clear-flash');
    global.setTimeout(function () {
      document.body.classList.remove('all-clear-flash');
    }, prefersReducedMotion ? 200 : 900);
  }

  function renderOjamaTray(player) {
    var icons = L.garbagePreviewIcons(player.state.incomingGarbage);
    player.ojama.innerHTML = icons.map(function (icon) {
      return '<span class="ojama-icon" data-kind="' + icon.kind + '" title="'
        + icon.value + ' 顆">' + icon.glyph + '</span>';
    }).join('');
  }

  function resetMatch() {
    match.paused = false;
    match.over = false;
    match.winner = null;
    match.loser = null;
    match.difficulty = currentDifficulty();
    match.lastChainPulse = 0;
    das[0].direction = 0;
    das[0].timer = 0;
    das[1].direction = 0;
    das[1].timer = 0;
    undoStack = [];
    clearHint();
    ui.pauseLabel.textContent = '暫停';
    ui.overlay.hidden = true;
    syncModeUi();
    refreshMissionSelect();

    var quest = currentQuestDef();
    match.quest = quest;
    match.movesLeft = quest ? quest.moveLimit : 0;

    var colorCount = quest ? quest.colorCount : Number(ui.colorSelect.value) || 4;
    if (quest) ui.colorSelect.value = String(colorCount);

    players[0].state = newPlayerState(colorCount);
    hidePopup(players[0]);
    if (quest) {
      players[0].state.board = M.boardFromLines(quest.lines);
      players[0].state.queue = quest.queue.map(L.clonePair);
      while (players[0].state.queue.length < 2) {
        players[0].state.queue.push(L.createPair(colorCount));
      }
      players[0].state.pair = null;
      spawnNext(players[0]);
      updateQuestHud();
    } else {
      spawnNext(players[0]);
    }
    updateStats(players[0]);

    if (isSoloMode()) {
      players[1].state = newPlayerState(colorCount);
      players[1].state.over = true;
      players[1].state.phase = 'over';
      players[1].isCpu = false;
      hidePopup(players[1]);
      updateStats(players[1]);
    } else {
      players[1].state = newPlayerState(colorCount);
      hidePopup(players[1]);
      spawnNext(players[1]);
      updateStats(players[1]);
    }

    updateMatchStatus();
    refreshAssistButtons();
  }

  function spawnNext(player) {
    var state = player.state;
    state.garbageJustDropped = 0;
    if (!isSoloMode() && state.incomingGarbage > 0) {
      state.garbageJustDropped = Math.min(state.incomingGarbage, match.difficulty.garbageDropCap);
      state.board = L.withGarbage(state.board, state.garbageJustDropped);
      state.incomingGarbage -= state.garbageJustDropped;
      flashGarbage(player);
    }

    if (L.isDead(state.board)) {
      if (isSoloMode()) finishSolo(false, player.label + ' 場地頂端被堵住了。');
      else finishMatch(opponentOf(player), player, player.label + ' 被垃圾壓垮了。');
      return;
    }

    if (isSoloMode() && match.quest && match.movesLeft <= 0 && !state.pair) {
      finishSolo(false, '手数用盡，未達目標連鎖。');
      return;
    }

    var pair = state.queue.shift();
    if (!pair) {
      if (isSoloMode() && match.quest) {
        finishSolo(
          players[0].state.maxChain >= match.quest.targetChain,
          players[0].state.maxChain >= match.quest.targetChain
            ? '達成目標連鎖！'
            : '沒有下一組氣泡了。'
        );
        return;
      }
      pair = L.createPair(state.colorCount);
    }
    if (!(isSoloMode() && match.quest)) {
      state.queue.push(L.createPair(state.colorCount));
    } else if (state.queue.length < 1) {
      // Keep a preview slot filled with a neutral upcoming pair for UI.
      state.queue.push(L.createPair(state.colorCount));
    }
    state.pair = pair;
    state.fallProgress = 0;
    state.lockTimer = 0;
    state.softDrop = false;
    state.phase = 'control';
    state.cpuPlan = null;

    if (!L.fits(state.board, pair)) {
      state.pair = null;
      if (isSoloMode()) finishSolo(false, player.label + ' 無法再出塊。');
      else finishMatch(opponentOf(player), player, player.label + ' 無法再出塊。');
      return;
    }

    if (player.isCpu) planCpu(player);
  }

  function finishSolo(won, summary) {
    if (match.over) return;
    match.over = true;
    match.winner = won ? players[0] : null;
    match.loser = won ? null : players[0];
    players[0].state.over = true;
    players[0].state.phase = 'over';
    players[0].state.softDrop = false;
    updateStats(players[0]);

    var chain = players[0].state.maxChain;
    career = L.noteMaxChain(career, chain, null);
    if (match.mode === 'mission' && won && match.quest) {
      career = L.recordMissionClear(career, match.quest.id, chain);
      refreshMissionSelect();
    }
    if (match.mode === 'tutorial' && won) {
      if (match.tutorialIndex >= M.TUTORIAL_STAGES.length - 1) {
        career = L.markTutorialComplete(career, chain);
      }
    }
    career = L.withPrefs(career, ui.difficultySelect.value, match.mode);
    saveCareer();
    refreshCareerUi();
    ui.resultCareer.hidden = false;

    if (won) A.playWin();
    else A.playLose();
    ui.resultTitle.textContent = won ? '任務成功' : '再試一次';
    ui.resultSummary.textContent = summary;
    ui.resultP1Score.textContent = String(players[0].state.score);
    ui.resultP1Chain.textContent = String(chain);
    ui.resultP2Score.textContent =
      match.mode === 'tutorial'
        ? '教室 ' + (match.tutorialIndex + 1) + '/' + M.TUTORIAL_STAGES.length
        : match.mode === 'mission'
          ? match.quest
            ? match.quest.title
            : '任務'
          : '自由練習';
    ui.resultP2Chain.textContent = String(match.movesLeft);
    ui.overlay.hidden = false;
    updateMatchStatus();
    refreshAssistButtons();
  }

  function finishMatch(winner, loser, summary) {
    if (match.over) return;
    if (isSoloMode()) {
      finishSolo(winner === players[0], summary);
      return;
    }
    match.over = true;
    match.winner = winner;
    match.loser = loser;
    players.forEach(function (player) {
      player.state.over = true;
      player.state.phase = 'over';
      player.state.softDrop = false;
      updateStats(player);
    });

    // Replay hook: only vs-CPU career counts (skip local 2P).
    if (!isVersusMode()) {
      career = L.recordCpuResult(career, winner === players[0], ui.difficultySelect.value);
      career = L.noteMaxChain(career, players[0].state.maxChain, ui.difficultySelect.value);
      career = L.withPrefs(career, ui.difficultySelect.value, 'cpu');
      saveCareer();
      refreshCareerUi();
      ui.resultCareer.hidden = false;
    } else {
      career = L.noteMaxChain(career, players[0].state.maxChain, null);
      saveCareer();
      refreshCareerUi();
      ui.resultCareer.hidden = true;
    }

    if (winner === players[0]) A.playWin();
    else A.playLose();
    ui.resultTitle.textContent = winner.label + ' 勝利';
    ui.resultSummary.textContent = summary;
    ui.resultP1Score.textContent = String(players[0].state.score);
    ui.resultP1Chain.textContent = String(players[0].state.maxChain);
    ui.resultP2Score.textContent = String(players[1].state.score);
    ui.resultP2Chain.textContent = String(players[1].state.maxChain);
    ui.overlay.hidden = false;
    updateMatchStatus();
    refreshAssistButtons();
  }

  function canControl(player) {
    return !match.over && !match.paused && player.state && !player.state.over && player.state.phase === 'control' && player.state.pair;
  }

  function moveSideways(player, dCol) {
    if (!canControl(player)) return false;
    var moved = L.movePair(player.state.board, player.state.pair, 0, dCol);
    if (!moved) return false;
    player.state.pair = moved;
    player.state.lockTimer = 0;
    A.playMove();
    return true;
  }

  function rotate(player, dir) {
    if (!canControl(player)) return false;
    var rotated = L.rotatePair(player.state.board, player.state.pair, dir);
    if (rotated === player.state.pair) return false;
    player.state.pair = rotated;
    player.state.lockTimer = 0;
    A.playRotate();
    return true;
  }

  function hardDrop(player) {
    if (!canControl(player)) return false;
    var state = player.state;
    var dropped = L.dropPair(state.board, state.pair);
    state.score += (dropped.row - state.pair.row) * 2;
    state.pair = dropped;
    state.fallProgress = 0;
    lockCurrent(player);
    updateStats(player);
    return true;
  }

  function lockCurrent(player) {
    if (!player.isCpu) pushUndoSnapshot();
    clearHint();
    var state = player.state;
    state.board = L.lockPair(state.board, state.pair);
    state.pair = null;
    state.chain = 0;
    if (isSoloMode() && match.quest && player === players[0]) {
      match.movesLeft = Math.max(0, match.movesLeft - 1);
      updateQuestHud();
    }
    A.playLand();
    beginSettle(player);
  }

  function beginSettle(player) {
    var state = player.state;
    var settled = L.applyGravity(state.board);
    if (settled.moves.length === 0) {
      state.board = settled.board;
      afterSettle(player);
      return;
    }
    var distance = settled.moves.reduce(function (max, move) {
      return Math.max(max, move.toRow - move.fromRow);
    }, 0);
    state.settle = {
      moves: settled.moves,
      targetBoard: settled.board,
      elapsed: 0,
      duration: Math.min(SETTLE_MAX, SETTLE_BASE + distance * SETTLE_PER_ROW),
    };
    state.phase = 'settle';
  }

  function afterSettle(player) {
    var state = player.state;
    state.settle = null;
    var groups = L.findGroups(state.board);
    if (groups.length > 0) {
      state.chain += 1;
      if (state.chain > state.maxChain) state.maxChain = state.chain;
      var step = L.stepScore(groups, state.chain);
      state.score += step.score;
      state.totalCleared += step.cleared;
      state.level = 1 + Math.floor(state.totalCleared / PUYOS_PER_LEVEL);
      if (!isSoloMode()) {
        state.outgoingGarbage += Math.floor(step.score / GARBAGE_RATE);
      }
      A.playPop(state.chain);
      showPopup(
        player,
        state.chain > 1 ? state.chain + ' 連鎖！' : '消除！',
        '+' + step.score,
        state.chain
      );
      state.pop = { groups: groups, elapsed: 0 };
      state.phase = 'pop';
      updateStats(player);
      return;
    }

    if (state.chain > 0 && L.isBoardEmpty(state.board)) {
      state.score += L.ALL_CLEAR_BONUS;
      if (!isSoloMode()) {
        state.outgoingGarbage += Math.floor(L.ALL_CLEAR_BONUS / GARBAGE_RATE);
      }
      A.playAllClear();
      flashAllClear();
      showPopup(player, '全消！', '+' + L.ALL_CLEAR_BONUS, 5);
    }

    var finishedChain = state.chain;
    state.chain = 0;
    updateStats(player);
    if (match.quest) updateQuestHud();

    if (
      isSoloMode() &&
      match.quest &&
      player === players[0] &&
      finishedChain >= match.quest.targetChain
    ) {
      finishSolo(true, '達成 ' + finishedChain + ' 連鎖！目標 ' + match.quest.targetChain + ' 連鎖。');
      return;
    }

    spawnNext(player);
  }

  function endPop(player) {
    player.state.board = L.clearGroups(player.state.board, player.state.pop.groups);
    player.state.pop = null;
    beginSettle(player);
  }

  function updateStats(player) {
    var state = player.state;
    player.statScore.textContent = String(state.score);
    player.statChain.textContent = String(state.chain);
    player.statMaxChain.textContent = String(state.maxChain);
    player.statCleared.textContent = String(state.totalCleared);
    player.statLevel.textContent = String(state.level);
    player.statGarbage.textContent = String(state.incomingGarbage);
    renderOjamaTray(player);

    if (match.over) {
      player.status.textContent = match.winner === player ? '勝利' : '戰敗';
      return;
    }
    if (match.paused) {
      player.status.textContent = '暫停中';
      return;
    }
    if (player.isCpu) {
      player.status.textContent = state.garbageJustDropped > 0
        ? 'CPU 本回合先吃 ' + state.garbageJustDropped + ' 顆垃圾'
        : state.incomingGarbage > 0
          ? 'CPU 後面還有 ' + state.incomingGarbage + ' 顆垃圾排隊'
          : state.cpuPlan
            ? 'CPU ' + match.difficulty.label + ' 思考完成，準備落子'
            : 'CPU 正在思考';
      return;
    }

    var controlsHint = player === players[0]
      ? '方向鍵移動 · Z / X 旋轉 · Space 落下'
      : 'A/D 移動 · Q/E 旋轉 · Shift 落下';
    player.status.textContent = state.garbageJustDropped > 0
      ? '這回合先掉下 ' + state.garbageJustDropped + ' 顆垃圾'
      : state.incomingGarbage > 0
        ? '小心，後面還有 ' + state.incomingGarbage + ' 顆垃圾排隊'
        : controlsHint;
  }

  function updateMatchStatus() {
    if (match.over) {
      if (isSoloMode()) {
        ui.matchStatus.textContent = match.winner
          ? '過關！可再開下一任務或進入自由練習。'
          : '尚未達標，按重新開始再挑戰。';
      } else {
        ui.matchStatus.textContent = match.winner.label + ' 勝利，' + match.loser.label + ' 倒下。';
      }
    } else if (match.paused) {
      ui.matchStatus.textContent = '對戰已暫停。';
    } else if (match.mode === 'mission' && match.quest) {
      ui.matchStatus.textContent =
        match.quest.title + '：目標 ' + match.quest.targetChain + ' 連鎖，剩餘 ' + match.movesLeft + ' 手。';
    } else if (match.mode === 'tutorial' && match.quest) {
      ui.matchStatus.textContent =
        '教室進度 ' +
        (match.tutorialIndex + 1) +
        '/' +
        M.TUTORIAL_STAGES.length +
        ' — ' +
        match.quest.blurb;
    } else if (match.mode === 'practice') {
      ui.matchStatus.textContent = '自由練習：沒有對手與垃圾，專心練連鎖。生涯最大連鎖會寫入統計。';
    } else if (isVersusMode()) {
      ui.matchStatus.textContent = '雙人同機：1P 用方向鍵/Z/X/Space，2P 用 A/D/S/Q/E/W/Shift。垃圾預告先顯示再分批落下。';
    } else {
      ui.matchStatus.textContent = '難度 ' + match.difficulty.label + '：CPU 會做 '
        + match.difficulty.lookahead + ' 手前瞻'
        + (match.difficulty.buildBias > 0.5 ? '並主動蓄連鎖' : '')
        + '，垃圾每回合最多落下 '
        + match.difficulty.garbageDropCap + ' 顆。';
    }
  }

  function showPopup(player, title, detail, intensity) {
    var chainNum = intensity > 1 ? intensity : 0;
    if (chainNum > 1 && !prefersReducedMotion) {
      player.popup.innerHTML =
        '<strong><span class="chain-count" data-target="' +
        chainNum +
        '">1</span> 連鎖！</strong><span>' +
        detail +
        '</span>';
      animateChainCount(player.popup.querySelector('.chain-count'), chainNum);
    } else {
      player.popup.innerHTML = '<strong>' + title + '</strong><span>' + detail + '</span>';
    }
    player.popup.dataset.intensity = String(Math.min(intensity, 5));
    player.popup.classList.toggle('reduced-motion', prefersReducedMotion);
    player.popup.classList.remove('is-visible');
    void player.popup.offsetWidth;
    player.popup.classList.add('is-visible');
    if (player.popupTimer) global.clearTimeout(player.popupTimer);
    player.popupTimer = global.setTimeout(function () { hidePopup(player); }, prefersReducedMotion ? 700 : 1200);
  }

  function animateChainCount(el, target) {
    if (!el) return;
    var current = 1;
    var step = Math.max(40, 160 / Math.max(1, target));
    function tick() {
      el.textContent = String(current);
      if (current >= target) return;
      current += 1;
      global.setTimeout(tick, step);
    }
    tick();
  }

  function hidePopup(player) {
    player.popup.classList.remove('is-visible');
  }

  function togglePause() {
    if (match.over) return;
    match.paused = !match.paused;
    ui.pauseLabel.textContent = match.paused ? '繼續' : '暫停';
    players.forEach(updateStats);
    updateMatchStatus();
    refreshAssistButtons();
  }

  function toggleMute() {
    A.setMuted(!A.isMuted());
    ui.muteButton.textContent = A.isMuted() ? '🔇 音效' : '🔊 音效';
    ui.muteButton.setAttribute('aria-pressed', A.isMuted() ? 'true' : 'false');
  }

  function updateControl(player, dt) {
    var state = player.state;
    if (!state.pair) return;
    if (L.movePair(state.board, state.pair, 1, 0) === null) {
      state.fallProgress = 0;
      state.lockTimer += dt;
      if (state.lockTimer >= LOCK_DELAY) lockCurrent(player);
      return;
    }
    state.lockTimer = 0;
    var interval = state.softDrop ? Math.min(currentInterval(player), SOFT_DROP_INTERVAL) : currentInterval(player);
    state.fallProgress += dt / interval;
    while (state.fallProgress >= 1) {
      var moved = L.movePair(state.board, state.pair, 1, 0);
      if (!moved) {
        state.fallProgress = 0;
        break;
      }
      state.pair = moved;
      state.fallProgress -= 1;
      if (state.softDrop && !player.isCpu) {
        state.score += 1;
        updateStats(player);
      }
    }
  }

  function updateDasFor(playerIndex, dt) {
    var player = players[playerIndex];
    var slot = das[playerIndex];
    if (slot.direction === 0 || !canControl(player)) return;
    slot.timer -= dt;
    while (slot.timer <= 0) {
      moveSideways(player, slot.direction);
      slot.timer += DAS_REPEAT;
    }
  }

  function resolveGarbage() {
    if (isSoloMode()) {
      players[0].state.outgoingGarbage = 0;
      players[1].state.outgoingGarbage = 0;
      return;
    }
    var a = players[0].state;
    var b = players[1].state;
    var cancelled = Math.min(a.outgoingGarbage, b.outgoingGarbage);
    a.outgoingGarbage -= cancelled;
    b.outgoingGarbage -= cancelled;

    if (a.outgoingGarbage > 0) {
      players[1].state.incomingGarbage += a.outgoingGarbage;
      a.outgoingGarbage = 0;
    }
    if (b.outgoingGarbage > 0) {
      players[0].state.incomingGarbage += b.outgoingGarbage;
      b.outgoingGarbage = 0;
    }
  }

  function cpuDelay() {
    return match.difficulty.cpuMin + Math.random() * (match.difficulty.cpuMax - match.difficulty.cpuMin);
  }

  function planCpu(player) {
    var state = player.state;
    if (!state.pair) return;
    var best = bestPlacementFor(
      state.board,
      state.pair,
      state.queue,
      match.difficulty.lookahead,
      state.incomingGarbage
    );
    if (!best) {
      state.cpuPlan = null;
      return;
    }
    state.cpuPlan = {
      targetCol: best.placement.col,
      targetRot: best.placement.rot,
    };
    state.cpuTimer = cpuDelay();
  }

  function bestPlacementFor(board, pair, queue, depth, incomingGarbage) {
    var placements = L.enumeratePlacements(board, pair);
    if (placements.length === 0) return null;

    var bestPlacement = placements[0];
    var bestScore = evaluatePlacement(board, placements[0], queue, depth, incomingGarbage);
    for (var i = 1; i < placements.length; i += 1) {
      var score = evaluatePlacement(board, placements[i], queue, depth, incomingGarbage);
      if (score > bestScore) {
        bestScore = score;
        bestPlacement = placements[i];
      }
    }
    return { placement: bestPlacement, score: bestScore };
  }

  function resolvePlacement(board, placement) {
    return L.simulateLock(board, placement, GARBAGE_RATE);
  }

  function evaluatePlacement(board, placement, queue, depth, incomingGarbage) {
    var diff = match.difficulty;
    var resolved = resolvePlacement(board, placement);
    var danger = boardDanger(resolved.board);
    var stackPenalty = danger * 11;
    var attackValue = resolved.attack * 120 * diff.attackWeight;
    var chainValue = resolved.chain * 180 + (resolved.chain >= 3 ? resolved.chain * 90 : 0);
    var setupValue = resolved.setup * diff.setupWeight;
    var flatPenalty = L.heightVariance(resolved.board) * (diff.flatnessWeight || 0);
    var allClearValue =
      resolved.chain > 0 && L.isBoardEmpty(resolved.board) ? diff.allClearBonus || 0 : 0;

    // Hard/Master: keep building unless under pressure or already firing a real chain.
    var panic = danger > 48 || (incomingGarbage || 0) >= 12;
    var weakPop = resolved.chain === 1 && resolved.attack <= 1;
    var weakPenalty = (!panic && weakPop) ? diff.weakPopPenalty : 0;
    var buildBonus = (!panic && resolved.chain === 0) ? resolved.setup * diff.buildBias * 18 : 0;

    var base = resolved.score
      + attackValue
      + resolved.cleared * 6
      + chainValue
      + setupValue
      + buildBonus
      + allClearValue
      - stackPenalty
      - flatPenalty
      - weakPenalty
      + (Math.random() * 2 - 1) * diff.noise;

    if (depth <= 1 || !queue || queue.length === 0) return base;
    var future = bestPlacementFor(resolved.board, queue[0], queue.slice(1), depth - 1, 0);
    return base + (future ? future.score * diff.futureWeight : 0);
  }

  function boardDanger(board) {
    var danger = 0;
    for (var col = 0; col < L.COLS; col += 1) {
      for (var row = 0; row < L.ROWS; row += 1) {
        if (board[row][col] !== null) {
          danger += L.ROWS - row;
          break;
        }
      }
    }
    return danger;
  }

  function updateCpu(player, dt) {
    var state = player.state;
    if (!player.isCpu || !canControl(player)) return;
    if (!state.cpuPlan) planCpu(player);
    if (!state.cpuPlan) return;

    state.cpuTimer -= dt;
    if (state.cpuTimer > 0) return;

    var rotDiff = (state.cpuPlan.targetRot - state.pair.rot + 4) % 4;
    if (rotDiff !== 0) {
      rotate(player, rotDiff === 3 ? -1 : 1);
      state.cpuTimer = cpuDelay();
      return;
    }
    if (state.pair.col < state.cpuPlan.targetCol) {
      moveSideways(player, 1);
      state.cpuTimer = cpuDelay();
      return;
    }
    if (state.pair.col > state.cpuPlan.targetCol) {
      moveSideways(player, -1);
      state.cpuTimer = cpuDelay();
      return;
    }
    hardDrop(player);
    state.cpuTimer = cpuDelay();
  }

  function update(dt) {
    if (match.over || match.paused) {
      refreshAssistButtons();
      return;
    }
    updateDasFor(0, dt);
    if (isVersusMode()) updateDasFor(1, dt);

    players.forEach(function (player) {
      if (isSoloMode() && player !== players[0]) return;
      var state = player.state;
      if (state.over) return;
      if (state.phase === 'control') {
        updateCpu(player, dt);
        updateControl(player, dt);
      } else if (state.phase === 'settle') {
        var settleDuration = prefersReducedMotion ? Math.min(60, state.settle.duration) : state.settle.duration;
        state.settle.elapsed += dt;
        if (state.settle.elapsed >= settleDuration) {
          state.board = state.settle.targetBoard;
          afterSettle(player);
        }
      } else if (state.phase === 'pop') {
        var popDuration = prefersReducedMotion ? Math.min(120, POP_DURATION) : POP_DURATION;
        state.pop.elapsed += dt;
        if (state.pop.elapsed >= popDuration) endPop(player);
      }
    });

    resolveGarbage();
    players.forEach(function (player) {
      if (isSoloMode() && player !== players[0]) return;
      updateStats(player);
    });
    updateMatchStatus();
    refreshAssistButtons();
  }

  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  function popAppearance(t) {
    if (t < 0.5) return { scale: 1, alpha: Math.floor(t * 14) % 2 === 0 ? 1 : 0.3 };
    var u = (t - 0.5) / 0.5;
    return { scale: 1 + 0.45 * u, alpha: 1 - u };
  }

  function buildSprites(player) {
    var state = player.state;
    var sprites = [];
    var hidden = {};
    var popping = {};

    if (state.phase === 'settle') {
      state.settle.moves.forEach(function (move) {
        hidden[move.fromRow + ',' + move.col] = true;
      });
    }
    if (state.phase === 'pop') {
      var look = popAppearance(Math.min(1, state.pop.elapsed / POP_DURATION));
      state.pop.groups.forEach(function (group) {
        group.cells.forEach(function (cell) {
          popping[cell.r + ',' + cell.c] = look;
        });
      });
    }

    for (var row = 0; row < L.ROWS; row += 1) {
      for (var col = 0; col < L.COLS; col += 1) {
        var color = state.board[row][col];
        if (!color) continue;
        var key = row + ',' + col;
        if (hidden[key]) continue;
        var look2 = popping[key];
        sprites.push({
          row: row,
          col: col,
          color: color,
          scale: look2 ? look2.scale : 1,
          alpha: look2 ? look2.alpha : 1,
          eyes: color !== L.GARBAGE,
        });
      }
    }

    if (state.phase === 'settle') {
      var t = easeOutQuad(Math.min(1, state.settle.elapsed / state.settle.duration));
      state.settle.moves.forEach(function (move) {
        sprites.push({
          row: move.fromRow + (move.toRow - move.fromRow) * t,
          col: move.col,
          color: move.color,
          connect: false,
          eyes: move.color !== L.GARBAGE,
        });
      });
    }

    if (state.pair) {
      var offset = state.fallProgress;
      var child = L.childPos(state.pair);
      sprites.push({ row: state.pair.row + offset, col: state.pair.col, color: state.pair.axis, connect: false });
      sprites.push({ row: child.row + offset, col: child.col, color: state.pair.child, connect: false });
    }

    return sprites;
  }

  function drawPlayer(player) {
    R.drawFieldBackground(player.fieldCtx, L.COLS, L.ROWS, CELL);
    R.drawFieldMarkers(player.fieldCtx, L.COLS, L.HIDDEN_ROWS, L.SPAWN_COL, CELL);

    if (player.state.pair && player.state.phase === 'control' && !match.over) {
      var landing = L.dropPair(player.state.board, player.state.pair);
      var landingChild = L.childPos(landing);
      R.drawGhost(
        player.fieldCtx,
        [
          { row: landing.row, col: landing.col },
          { row: landingChild.row, col: landingChild.col },
        ],
        CELL,
        0
      );
    }

    if (player === players[0] && hintCells && hintUntil > global.performance.now()) {
      R.drawHint(player.fieldCtx, hintCells, CELL, 0);
    } else if (player === players[0] && hintCells) {
      clearHint();
    }

    R.drawSprites(player.fieldCtx, buildSprites(player), CELL, 0);
    drawNext(player);
  }

  function drawNext(player) {
    player.nextCtx.clearRect(0, 0, player.next.width, player.next.height);
    var gap = PREVIEW_CELL * 0.9;
    for (var i = 0; i < player.state.queue.length; i += 1) {
      R.drawPreviewPair(
        player.nextCtx,
        PREVIEW_CELL * 0.25,
        PREVIEW_CELL * 0.25 + i * (PREVIEW_CELL * 2 + gap),
        PREVIEW_CELL,
        player.state.queue[i]
      );
    }
  }

  function draw() {
    players.forEach(drawPlayer);
  }

  function frame(timestamp) {
    var dt = lastFrame === 0 ? 16 : Math.min(80, timestamp - lastFrame);
    lastFrame = timestamp;
    update(dt);
    draw();
    global.requestAnimationFrame(frame);
  }

  var HANDLED_KEYS = {
    ArrowLeft: true, ArrowRight: true, ArrowDown: true, ArrowUp: true, ' ': true,
    z: true, Z: true, x: true, X: true, p: true, P: true, r: true, R: true,
    u: true, U: true, h: true, H: true,
    a: true, A: true, d: true, D: true, s: true, S: true,
    q: true, Q: true, e: true, E: true, w: true, W: true,
    Shift: true,
  };

  function startDas(playerIndex, direction) {
    das[playerIndex].direction = direction;
    das[playerIndex].timer = DAS_DELAY;
    moveSideways(players[playerIndex], direction);
  }

  function stopDas(playerIndex, direction) {
    if (das[playerIndex].direction === direction) das[playerIndex].direction = 0;
  }

  document.addEventListener('keydown', function (event) {
    var key = event.key;
    if (HANDLED_KEYS[key]) event.preventDefault();
    if (keysDown[key] && key !== 'ArrowDown' && key !== 's' && key !== 'S') return;
    keysDown[key] = true;

    if (key === 'ArrowLeft') startDas(0, -1);
    else if (key === 'ArrowRight') startDas(0, 1);
    else if (key === 'ArrowDown') players[0].state.softDrop = true;
    else if (key === 'ArrowUp' || key === 'x' || key === 'X') rotate(players[0], 1);
    else if (key === 'z' || key === 'Z') rotate(players[0], -1);
    else if (key === ' ') hardDrop(players[0]);
    else if (isVersusMode() && (key === 'a' || key === 'A')) startDas(1, -1);
    else if (isVersusMode() && (key === 'd' || key === 'D')) startDas(1, 1);
    else if (isVersusMode() && (key === 's' || key === 'S')) players[1].state.softDrop = true;
    else if (isVersusMode() && (key === 'e' || key === 'E' || key === 'w' || key === 'W')) rotate(players[1], 1);
    else if (isVersusMode() && (key === 'q' || key === 'Q')) rotate(players[1], -1);
    else if (isVersusMode() && key === 'Shift') hardDrop(players[1]);
    else if (key === 'p' || key === 'P') togglePause();
    else if (key === 'r' || key === 'R') resetMatch();
    else if (key === 'u' || key === 'U') undoLast();
    else if (key === 'h' || key === 'H') showHint();
  });

  document.addEventListener('keyup', function (event) {
    var key = event.key;
    keysDown[key] = false;
    if (key === 'ArrowLeft') stopDas(0, -1);
    else if (key === 'ArrowRight') stopDas(0, 1);
    else if (key === 'ArrowDown') players[0].state.softDrop = false;
    else if (key === 'a' || key === 'A') stopDas(1, -1);
    else if (key === 'd' || key === 'D') stopDas(1, 1);
    else if (key === 's' || key === 'S') players[1].state.softDrop = false;
  });

  function bindTouch(id, onPress, onRelease) {
    var button = document.getElementById(id);
    if (!button) return;
    button.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      onPress();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (name) {
      button.addEventListener(name, function () {
        if (onRelease) onRelease();
      });
    });
  }

  bindTouch('touch-left', function () { startDas(0, -1); }, function () { stopDas(0, -1); });
  bindTouch('touch-right', function () { startDas(0, 1); }, function () { stopDas(0, 1); });
  bindTouch('touch-down', function () { players[0].state.softDrop = true; }, function () { players[0].state.softDrop = false; });
  bindTouch('touch-rotate-ccw', function () { rotate(players[0], -1); });
  bindTouch('touch-rotate-cw', function () { rotate(players[0], 1); });
  bindTouch('touch-drop', function () { hardDrop(players[0]); });
  bindTouch('touch-undo', function () { undoLast(); });
  bindTouch('touch-hint', function () { showHint(); });

  function advanceTutorialOrReset() {
    if (match.mode === 'tutorial' && match.winner) {
      if (match.tutorialIndex < M.TUTORIAL_STAGES.length - 1) {
        match.tutorialIndex += 1;
      } else {
        // After final lesson, jump to free practice.
        ui.modeSelect.value = 'practice';
        match.tutorialIndex = 0;
        persistPrefs();
      }
    }
    resetMatch();
  }

  ui.pauseButton.addEventListener('click', togglePause);
  ui.muteButton.addEventListener('click', toggleMute);
  if (ui.undoButton) ui.undoButton.addEventListener('click', undoLast);
  if (ui.hintButton) ui.hintButton.addEventListener('click', showHint);
  if (ui.questHintBtn) ui.questHintBtn.addEventListener('click', showHint);
  if (ui.questSkipBtn) {
    ui.questSkipBtn.addEventListener('click', function () {
      if (match.mode !== 'tutorial') return;
      if (match.tutorialIndex < M.TUTORIAL_STAGES.length - 1) {
        match.tutorialIndex += 1;
        resetMatch();
      } else {
        ui.modeSelect.value = 'practice';
        match.tutorialIndex = 0;
        persistPrefs();
        resetMatch();
      }
    });
  }
  document.getElementById('btn-restart').addEventListener('click', resetMatch);
  document.getElementById('result-restart').addEventListener('click', advanceTutorialOrReset);
  ui.colorSelect.addEventListener('change', resetMatch);
  ui.difficultySelect.addEventListener('change', function () {
    persistPrefs();
    refreshCareerUi();
    resetMatch();
  });
  ui.modeSelect.addEventListener('change', function () {
    if (ui.modeSelect.value === 'tutorial') match.tutorialIndex = 0;
    persistPrefs();
    resetMatch();
  });
  if (ui.missionSelect) {
    ui.missionSelect.addEventListener('change', function () {
      resetMatch();
    });
  }

  players.forEach(function (player) {
    setupCanvas(player.field, player.fieldCtx, L.COLS * CELL, L.ROWS * CELL);
    setupCanvas(player.next, player.nextCtx, PREVIEW_CELL * 1.5, PREVIEW_CELL * 6.2);
  });

  career = loadCareer();
  applySavedPrefs();
  refreshMissionSelect();
  refreshCareerUi();
  resetMatch();
  global.requestAnimationFrame(frame);
})(window);
