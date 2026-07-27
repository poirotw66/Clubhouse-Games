/**
 * Versus loop for Puyo Puyo: 1P vs CPU or local 1P vs 2P.
 * Plain script (no bundler) so the page runs from file:// as well as the dev server.
 */
(function (global) {
  'use strict';

  var L = global.PuyoLogic;
  var R = global.PuyoRender;
  var A = global.PuyoAudio;

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

  // Hard leans into setupPotential / future chains; Easy pops early and plays slow.
  var DIFFICULTY_PRESETS = {
    easy: {
      label: 'Easy',
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
    },
    normal: {
      label: 'Normal',
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
    },
    hard: {
      label: 'Hard',
      lookahead: 2,
      cpuMin: 45,
      cpuMax: 95,
      futureWeight: 0.72,
      attackWeight: 1.35,
      setupWeight: 1.35,
      weakPopPenalty: 260,
      buildBias: 0.85,
      garbageDropCap: 18,
      noise: 0,
    },
  };

  var ui = {
    matchStatus: document.getElementById('match-status'),
    modeBadge: document.getElementById('mode-badge'),
    modeSelect: document.getElementById('match-mode'),
    difficultyField: document.getElementById('difficulty-field'),
    overlay: document.getElementById('result-overlay'),
    resultTitle: document.getElementById('result-title'),
    resultSummary: document.getElementById('result-summary'),
    resultP1Score: document.getElementById('result-p1-score'),
    resultP1Chain: document.getElementById('result-p1-chain'),
    resultP2Label: document.getElementById('result-p2-label'),
    resultP2Score: document.getElementById('result-p2-score'),
    resultP2ChainLabel: document.getElementById('result-p2-chain-label'),
    resultP2Chain: document.getElementById('result-p2-chain'),
    pauseButton: document.getElementById('btn-pause'),
    pauseLabel: document.getElementById('btn-pause-label'),
    muteButton: document.getElementById('btn-mute'),
    colorSelect: document.getElementById('color-count'),
    difficultySelect: document.getElementById('cpu-difficulty'),
    p2Title: document.getElementById('p2-title'),
    p2Badge: document.getElementById('p2-badge'),
    p2ControlsList: document.getElementById('p2-controls-list'),
  };

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

  function syncModeUi() {
    match.mode = ui.modeSelect.value === 'versus' ? 'versus' : 'cpu';
    players[1].isCpu = !isVersusMode();
    players[1].label = isVersusMode() ? '2P' : 'CPU';
    ui.p2Title.textContent = players[1].label;
    ui.p2Badge.textContent = isVersusMode() ? '玩家 2' : '自動對手';
    ui.p2Badge.classList.toggle('cpu-badge', !isVersusMode());
    ui.modeBadge.textContent = isVersusMode()
      ? '1P vs 2P · 6×12 · 連鎖送垃圾'
      : '1P vs CPU · 6×12 · 連鎖送垃圾';
    ui.difficultyField.hidden = isVersusMode();
    ui.resultP2Label.textContent = players[1].label + ' 分數';
    ui.resultP2ChainLabel.textContent = players[1].label + ' 最大連鎖';
    ui.p2ControlsList.innerHTML = isVersusMode()
      ? '<li><kbd>A</kbd> <kbd>D</kbd> 左右移動</li>'
        + '<li><kbd>S</kbd> 加速落下</li>'
        + '<li><kbd>Q</kbd> 逆時針 · <kbd>E</kbd>/<kbd>W</kbd> 順時針</li>'
        + '<li><kbd>Shift</kbd> 瞬間落下</li>'
      : '<li>CPU 依難度自動思考與落子</li>';
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
    das[0].direction = 0;
    das[0].timer = 0;
    das[1].direction = 0;
    das[1].timer = 0;
    ui.pauseLabel.textContent = '暫停';
    ui.overlay.hidden = true;
    syncModeUi();

    var colorCount = Number(ui.colorSelect.value) || 4;
    players.forEach(function (player) {
      player.state = newPlayerState(colorCount);
      hidePopup(player);
      spawnNext(player);
      updateStats(player);
    });
    updateMatchStatus();
  }

  function spawnNext(player) {
    var state = player.state;
    state.garbageJustDropped = 0;
    if (state.incomingGarbage > 0) {
      state.garbageJustDropped = Math.min(state.incomingGarbage, match.difficulty.garbageDropCap);
      state.board = L.withGarbage(state.board, state.garbageJustDropped);
      state.incomingGarbage -= state.garbageJustDropped;
    }

    if (L.isDead(state.board)) {
      finishMatch(opponentOf(player), player, player.label + ' 被垃圾壓垮了。');
      return;
    }

    var pair = state.queue.shift();
    state.queue.push(L.createPair(state.colorCount));
    state.pair = pair;
    state.fallProgress = 0;
    state.lockTimer = 0;
    state.softDrop = false;
    state.phase = 'control';
    state.cpuPlan = null;

    if (!L.fits(state.board, pair)) {
      state.pair = null;
      finishMatch(opponentOf(player), player, player.label + ' 無法再出塊。');
      return;
    }

    if (player.isCpu) planCpu(player);
  }

  function finishMatch(winner, loser, summary) {
    if (match.over) return;
    match.over = true;
    match.winner = winner;
    match.loser = loser;
    players.forEach(function (player) {
      player.state.over = true;
      player.state.phase = 'over';
      player.state.softDrop = false;
      updateStats(player);
    });
    A.playLose();
    ui.resultTitle.textContent = winner.label + ' 勝利';
    ui.resultSummary.textContent = summary;
    ui.resultP1Score.textContent = String(players[0].state.score);
    ui.resultP1Chain.textContent = String(players[0].state.maxChain);
    ui.resultP2Score.textContent = String(players[1].state.score);
    ui.resultP2Chain.textContent = String(players[1].state.maxChain);
    ui.overlay.hidden = false;
    updateMatchStatus();
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
    var state = player.state;
    state.board = L.lockPair(state.board, state.pair);
    state.pair = null;
    state.chain = 0;
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
      state.outgoingGarbage += Math.floor(step.score / GARBAGE_RATE);
      A.playPop(state.chain);
      showPopup(player, state.chain > 1 ? state.chain + ' 連鎖！' : '消除！', '+' + step.score, state.chain);
      state.pop = { groups: groups, elapsed: 0 };
      state.phase = 'pop';
      updateStats(player);
      return;
    }

    if (state.chain > 0 && L.isBoardEmpty(state.board)) {
      state.score += L.ALL_CLEAR_BONUS;
      state.outgoingGarbage += Math.floor(L.ALL_CLEAR_BONUS / GARBAGE_RATE);
      A.playAllClear();
      showPopup(player, '全消！', '+' + L.ALL_CLEAR_BONUS, 5);
    }

    state.chain = 0;
    updateStats(player);
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
      ui.matchStatus.textContent = match.winner.label + ' 勝利，' + match.loser.label + ' 倒下。';
    } else if (match.paused) {
      ui.matchStatus.textContent = '對戰已暫停。';
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
    player.popup.innerHTML = '<strong>' + title + '</strong><span>' + detail + '</span>';
    player.popup.dataset.intensity = String(Math.min(intensity, 5));
    player.popup.classList.remove('is-visible');
    void player.popup.offsetWidth;
    player.popup.classList.add('is-visible');
    if (player.popupTimer) global.clearTimeout(player.popupTimer);
    player.popupTimer = global.setTimeout(function () { hidePopup(player); }, 1100);
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
    var testBoard = L.lockPair(board, placement);
    var chain = 0;
    var totalScore = 0;
    var totalCleared = 0;

    while (true) {
      testBoard = L.applyGravity(testBoard).board;
      var groups = L.findGroups(testBoard);
      if (groups.length === 0) break;
      chain += 1;
      var step = L.stepScore(groups, chain);
      totalScore += step.score;
      totalCleared += step.cleared;
      testBoard = L.clearGroups(testBoard, groups);
    }

    if (chain > 0 && L.isBoardEmpty(testBoard)) totalScore += L.ALL_CLEAR_BONUS;
    return {
      board: testBoard,
      chain: chain,
      score: totalScore,
      cleared: totalCleared,
      attack: Math.floor(totalScore / GARBAGE_RATE),
      setup: L.setupPotential(testBoard),
    };
  }

  function evaluatePlacement(board, placement, queue, depth, incomingGarbage) {
    var diff = match.difficulty;
    var resolved = resolvePlacement(board, placement);
    var danger = boardDanger(resolved.board);
    var stackPenalty = danger * 11;
    var attackValue = resolved.attack * 120 * diff.attackWeight;
    var chainValue = resolved.chain * 180;
    var setupValue = resolved.setup * diff.setupWeight;

    // Hard: keep building unless under pressure or already firing a real chain.
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
      - stackPenalty
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
    if (match.over || match.paused) return;
    updateDasFor(0, dt);
    if (isVersusMode()) updateDasFor(1, dt);

    players.forEach(function (player) {
      var state = player.state;
      if (state.over) return;
      if (state.phase === 'control') {
        updateCpu(player, dt);
        updateControl(player, dt);
      } else if (state.phase === 'settle') {
        state.settle.elapsed += dt;
        if (state.settle.elapsed >= state.settle.duration) {
          state.board = state.settle.targetBoard;
          afterSettle(player);
        }
      } else if (state.phase === 'pop') {
        state.pop.elapsed += dt;
        if (state.pop.elapsed >= POP_DURATION) endPop(player);
      }
    });

    resolveGarbage();
    players.forEach(updateStats);
    updateMatchStatus();
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

  ui.pauseButton.addEventListener('click', togglePause);
  ui.muteButton.addEventListener('click', toggleMute);
  document.getElementById('btn-restart').addEventListener('click', resetMatch);
  document.getElementById('result-restart').addEventListener('click', resetMatch);
  ui.colorSelect.addEventListener('change', resetMatch);
  ui.difficultySelect.addEventListener('change', resetMatch);
  ui.modeSelect.addEventListener('change', resetMatch);

  players.forEach(function (player) {
    setupCanvas(player.field, player.fieldCtx, L.COLS * CELL, L.ROWS * CELL);
    setupCanvas(player.next, player.nextCtx, PREVIEW_CELL * 1.5, PREVIEW_CELL * 6.2);
  });

  resetMatch();
  global.requestAnimationFrame(frame);
})(window);
