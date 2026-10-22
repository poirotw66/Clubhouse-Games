/**
 * Puyo Puyo rules engine — pure functions over a board, no DOM and no timers.
 * Board is board[row][col]; row 0 is the hidden buffer row, rows 1..12 are visible.
 * Exposed as window.PuyoLogic so the page works from file:// without a bundler.
 */
(function (global) {
  'use strict';

  var COLS = 6;
  var HIDDEN_ROWS = 1;
  var VISIBLE_ROWS = 12;
  var ROWS = HIDDEN_ROWS + VISIBLE_ROWS;
  var SPAWN_COL = 2;

  /** Colour ids in difficulty order: the first 4 are the beginner set. */
  var ALL_COLORS = ['red', 'green', 'blue', 'yellow', 'purple'];

  /** Chain power by chain number; chains past the table keep adding 32. */
  var CHAIN_POWER = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512];
  /** Colour bonus indexed by how many distinct colours popped in one step. */
  var COLOR_BONUS = [0, 0, 3, 6, 12, 24];
  var ALL_CLEAR_BONUS = 2100;
  var POP_SIZE = 4;
  var GARBAGE = 'garbage';

  // Vs-CPU career stats (replay hook). 2P local matches are not counted.
  var STATS_KEY = 'clubhouse-puyo-stats';
  var EMPTY_MODE = {
    wins: 0,
    losses: 0,
    winStreak: 0,
    bestWinStreak: 0,
    bestMaxChain: 0,
  };
  var DEFAULT_STATS = {
    lastDifficulty: 'normal',
    lastMode: 'cpu',
    byDifficulty: null,
    missionClears: null,
    missionStars: null,
    missionsClearedCount: 0,
    tutorialComplete: false,
    bestChainOverall: 0,
    dailyBest: null,
    dailyClears: null,
    boardTheme: 'classic',
  };
  var VALID_DIFFICULTIES = {
    easy: true,
    normal: true,
    hard: true,
    master: true,
    nightmare: true,
  };
  var VALID_MODES = {
    cpu: true,
    versus: true,
    mission: true,
    tutorial: true,
    practice: true,
    daily: true,
  };
  var DIFFICULTY_IDS = ['easy', 'normal', 'hard', 'master', 'nightmare'];

  /**
   * Board / page themes unlocked by total mission stars.
   * classic is always free; others unlock at rising star thresholds.
   */
  var BOARD_THEMES = [
    {
      id: 'classic',
      label: '經典夜場',
      starsRequired: 0,
      pageBg:
        'linear-gradient(rgba(6, 4, 23, 0.55), rgba(6, 4, 23, 0.78)), url("./art/stage-bg.jpg") center / cover no-repeat, radial-gradient(900px 520px at 50% -10%, rgba(122, 66, 214, 0.35), transparent 70%), #060417',
      fieldTop: '#1b1440',
      fieldBottom: '#120d2c',
      fieldTint: 'rgba(18, 13, 44, 0.45)',
    },
    {
      id: 'sunset',
      label: '夕燒海岸',
      starsRequired: 10,
      pageBg:
        'linear-gradient(rgba(40, 12, 8, 0.55), rgba(20, 8, 6, 0.82)), radial-gradient(800px 480px at 70% 0%, rgba(255, 140, 60, 0.45), transparent 65%), radial-gradient(600px 400px at 20% 100%, rgba(255, 80, 100, 0.25), transparent 60%), #1a0c08',
      fieldTop: '#4a1e14',
      fieldBottom: '#1a0c10',
      fieldTint: 'rgba(60, 20, 12, 0.4)',
    },
    {
      id: 'aurora',
      label: '極光庭園',
      starsRequired: 24,
      pageBg:
        'linear-gradient(rgba(4, 18, 22, 0.6), rgba(4, 12, 18, 0.85)), radial-gradient(700px 420px at 30% 10%, rgba(60, 220, 180, 0.35), transparent 60%), radial-gradient(500px 360px at 90% 80%, rgba(80, 140, 255, 0.3), transparent 55%), #041216',
      fieldTop: '#0d2e36',
      fieldBottom: '#061820',
      fieldTint: 'rgba(8, 28, 32, 0.42)',
    },
    {
      id: 'candy',
      label: '糖果工房',
      starsRequired: 40,
      pageBg:
        'linear-gradient(rgba(28, 10, 28, 0.55), rgba(18, 8, 22, 0.82)), radial-gradient(700px 400px at 50% -5%, rgba(255, 120, 180, 0.4), transparent 60%), radial-gradient(500px 340px at 10% 90%, rgba(120, 200, 255, 0.28), transparent 55%), #160816',
      fieldTop: '#3a1840',
      fieldBottom: '#1a0c22',
      fieldTint: 'rgba(40, 16, 44, 0.4)',
    },
  ];
  var VALID_THEMES = {};
  BOARD_THEMES.forEach(function (theme) {
    VALID_THEMES[theme.id] = true;
  });

  function asNonNegInt(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  function emptyByDifficulty() {
    return {
      easy: Object.assign({}, EMPTY_MODE),
      normal: Object.assign({}, EMPTY_MODE),
      hard: Object.assign({}, EMPTY_MODE),
      master: Object.assign({}, EMPTY_MODE),
      nightmare: Object.assign({}, EMPTY_MODE),
    };
  }

  function normalizeMissionClears(raw) {
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function (key) {
      if (raw[key]) out[key] = true;
    });
    return out;
  }

  /** Best star rating per mission id (1–3). Legacy boolean clears → 1 star. */
  function normalizeMissionStars(rawStars, clears) {
    var out = {};
    if (rawStars && typeof rawStars === 'object') {
      Object.keys(rawStars).forEach(function (key) {
        var n = asNonNegInt(rawStars[key]);
        if (n > 0) out[key] = Math.min(3, n);
      });
    }
    if (clears && typeof clears === 'object') {
      Object.keys(clears).forEach(function (key) {
        if (clears[key] && !out[key]) out[key] = 1;
      });
    }
    return out;
  }

  function normalizeMode(raw) {
    if (!raw || typeof raw !== 'object') return Object.assign({}, EMPTY_MODE);
    var streak = asNonNegInt(raw.winStreak);
    return {
      wins: asNonNegInt(raw.wins),
      losses: asNonNegInt(raw.losses),
      winStreak: streak,
      bestWinStreak: Math.max(asNonNegInt(raw.bestWinStreak), streak),
      bestMaxChain: asNonNegInt(raw.bestMaxChain),
    };
  }

  function normalizeDailyBest(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.dateKey)) return null;
    return {
      dateKey: raw.dateKey,
      cleared: !!raw.cleared,
      bestMoves: asNonNegInt(raw.bestMoves) || 0,
      bestStars: Math.min(3, asNonNegInt(raw.bestStars)),
      bestChain: asNonNegInt(raw.bestChain),
      attempts: asNonNegInt(raw.attempts),
    };
  }

  function normalizeDailyClears(raw) {
    var out = [];
    if (!Array.isArray(raw)) return out;
    var seen = {};
    raw.forEach(function (key) {
      if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
      if (seen[key]) return;
      seen[key] = true;
      out.push(key);
    });
    out.sort();
    return out.slice(-90);
  }

  function totalMissionStars(stats) {
    var stars = (stats && stats.missionStars) || {};
    var sum = 0;
    Object.keys(stars).forEach(function (id) {
      sum += asNonNegInt(stars[id]);
    });
    return sum;
  }

  function themeById(id) {
    for (var i = 0; i < BOARD_THEMES.length; i += 1) {
      if (BOARD_THEMES[i].id === id) return BOARD_THEMES[i];
    }
    return BOARD_THEMES[0];
  }

  function isThemeUnlocked(themeId, starTotal) {
    var theme = themeById(themeId);
    return asNonNegInt(starTotal) >= theme.starsRequired;
  }

  function normalizeBoardTheme(rawTheme, starTotal) {
    var id = typeof rawTheme === 'string' && VALID_THEMES[rawTheme] ? rawTheme : 'classic';
    if (!isThemeUnlocked(id, starTotal)) return 'classic';
    return id;
  }

  /** Merge partial / corrupt storage into a valid career-stats object. */
  function mergeStats(raw) {
    var byDifficulty = emptyByDifficulty();
    if (!raw || typeof raw !== 'object') {
      return {
        lastDifficulty: DEFAULT_STATS.lastDifficulty,
        lastMode: DEFAULT_STATS.lastMode,
        byDifficulty: byDifficulty,
        missionClears: {},
        missionStars: {},
        missionsClearedCount: 0,
        tutorialComplete: false,
        bestChainOverall: 0,
        dailyBest: null,
        dailyClears: [],
        boardTheme: 'classic',
      };
    }
    var lastDifficulty = typeof raw.lastDifficulty === 'string' && VALID_DIFFICULTIES[raw.lastDifficulty]
      ? raw.lastDifficulty
      : DEFAULT_STATS.lastDifficulty;
    var lastMode = typeof raw.lastMode === 'string' && VALID_MODES[raw.lastMode]
      ? raw.lastMode
      : DEFAULT_STATS.lastMode;
    var missionClears = normalizeMissionClears(raw.missionClears);
    var missionStars = normalizeMissionStars(raw.missionStars, missionClears);
    // Stars imply clear; keep clears in sync for unlock helpers.
    Object.keys(missionStars).forEach(function (key) {
      missionClears[key] = true;
    });
    var missionsClearedCount = Math.max(
      asNonNegInt(raw.missionsClearedCount),
      Object.keys(missionClears).length
    );
    var tutorialComplete = !!raw.tutorialComplete;
    var bestChainOverall = asNonNegInt(raw.bestChainOverall);
    var dailyBest = normalizeDailyBest(raw.dailyBest);
    var dailyClears = normalizeDailyClears(raw.dailyClears);
    var starTotal = 0;
    Object.keys(missionStars).forEach(function (key) {
      starTotal += asNonNegInt(missionStars[key]);
    });
    var boardTheme = normalizeBoardTheme(raw.boardTheme, starTotal);

    function finish(payload) {
      payload.dailyBest = dailyBest;
      payload.dailyClears = dailyClears;
      payload.boardTheme = boardTheme;
      return payload;
    }

    if (raw.byDifficulty && typeof raw.byDifficulty === 'object') {
      for (var i = 0; i < DIFFICULTY_IDS.length; i += 1) {
        var id = DIFFICULTY_IDS[i];
        byDifficulty[id] = normalizeMode(raw.byDifficulty[id]);
        if (byDifficulty[id].bestMaxChain > bestChainOverall) {
          bestChainOverall = byDifficulty[id].bestMaxChain;
        }
      }
      return finish({
        lastDifficulty: lastDifficulty,
        lastMode: lastMode,
        byDifficulty: byDifficulty,
        missionClears: missionClears,
        missionStars: missionStars,
        missionsClearedCount: missionsClearedCount,
        tutorialComplete: tutorialComplete,
        bestChainOverall: bestChainOverall,
      });
    }

    // Legacy flat career → migrate into normal.
    byDifficulty.normal = normalizeMode({
      wins: raw.wins,
      losses: raw.losses,
      winStreak: raw.winStreak,
      bestWinStreak: raw.winStreak,
      bestMaxChain: raw.bestMaxChain,
    });
    if (byDifficulty.normal.bestMaxChain > bestChainOverall) {
      bestChainOverall = byDifficulty.normal.bestMaxChain;
    }
    return finish({
      lastDifficulty: lastDifficulty,
      lastMode: lastMode,
      byDifficulty: byDifficulty,
      missionClears: missionClears,
      missionStars: missionStars,
      missionsClearedCount: missionsClearedCount,
      tutorialComplete: tutorialComplete,
      bestChainOverall: bestChainOverall,
    });
  }

  function modeOf(stats, difficulty) {
    var merged = mergeStats(stats);
    var d = typeof difficulty === 'string' && VALID_DIFFICULTIES[difficulty]
      ? difficulty
      : merged.lastDifficulty;
    return merged.byDifficulty[d] || Object.assign({}, EMPTY_MODE);
  }

  /** Apply a vs-CPU win or loss. Streak climbs on win, resets on loss. */
  function recordCpuResult(stats, won, difficulty) {
    var next = mergeStats(stats);
    var d = typeof difficulty === 'string' && VALID_DIFFICULTIES[difficulty]
      ? difficulty
      : next.lastDifficulty;
    var mode = Object.assign({}, next.byDifficulty[d]);
    if (won) {
      mode.wins += 1;
      mode.winStreak += 1;
      if (mode.winStreak > mode.bestWinStreak) mode.bestWinStreak = mode.winStreak;
    } else {
      mode.losses += 1;
      mode.winStreak = 0;
    }
    next.byDifficulty[d] = mode;
    next.lastDifficulty = d;
    return next;
  }

  /** Track personal-best max chain from a finished match (win or lose). */
  function noteMaxChain(stats, chain, difficulty) {
    var next = mergeStats(stats);
    var n = asNonNegInt(chain);
    if (n > next.bestChainOverall) next.bestChainOverall = n;
    if (typeof difficulty === 'string' && VALID_DIFFICULTIES[difficulty]) {
      var mode = Object.assign({}, next.byDifficulty[difficulty]);
      if (n > mode.bestMaxChain) mode.bestMaxChain = n;
      next.byDifficulty[difficulty] = mode;
      next.lastDifficulty = difficulty;
    }
    return next;
  }

  /**
   * Record a cleared mission id and best star rating (1–3).
   * Idempotent for clears; stars only climb.
   */
  function recordMissionClear(stats, missionId, chain, stars) {
    var next = mergeStats(stats);
    if (typeof missionId !== 'string' || !missionId) return next;
    if (!next.missionClears[missionId]) {
      next.missionClears[missionId] = true;
      next.missionsClearedCount = Object.keys(next.missionClears).length;
    }
    var rated = Math.min(3, Math.max(1, asNonNegInt(stars) || 1));
    var prev = asNonNegInt(next.missionStars[missionId]);
    if (rated > prev) next.missionStars[missionId] = rated;
    else if (!prev) next.missionStars[missionId] = rated;
    return noteMaxChain(next, chain, null);
  }

  function markTutorialComplete(stats, chain) {
    var next = mergeStats(stats);
    next.tutorialComplete = true;
    return noteMaxChain(next, chain, null);
  }

  function withPrefs(stats, difficulty, mode) {
    var next = mergeStats(stats);
    if (typeof difficulty === 'string' && VALID_DIFFICULTIES[difficulty]) {
      next.lastDifficulty = difficulty;
    }
    if (typeof mode === 'string' && VALID_MODES[mode]) {
      next.lastMode = mode;
    }
    return next;
  }

  /**
   * Record a daily clear / attempt. Best moves only improve (lower wins);
   * stars only climb. Clears list drives streak.
   */
  function recordDailyResult(stats, result) {
    var next = mergeStats(stats);
    if (!result || typeof result.dateKey !== 'string') return next;
    var dateKey = result.dateKey;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return next;

    var prev = next.dailyBest && next.dailyBest.dateKey === dateKey ? next.dailyBest : null;
    var attempts = (prev ? prev.attempts : 0) + 1;
    var cleared = !!(prev && prev.cleared) || !!result.cleared;
    var bestMoves = prev && prev.bestMoves > 0 ? prev.bestMoves : 0;
    var bestStars = prev ? prev.bestStars : 0;
    var bestChain = prev ? prev.bestChain : 0;
    var chain = asNonNegInt(result.chain);
    if (chain > bestChain) bestChain = chain;
    if (result.cleared) {
      var moves = Math.max(1, asNonNegInt(result.movesUsed) || 1);
      var stars = Math.min(3, Math.max(1, asNonNegInt(result.stars) || 1));
      if (!bestMoves || moves < bestMoves) bestMoves = moves;
      if (stars > bestStars) bestStars = stars;
      if (next.dailyClears.indexOf(dateKey) < 0) {
        next.dailyClears = next.dailyClears.concat([dateKey]).sort().slice(-90);
      }
    }
    next.dailyBest = {
      dateKey: dateKey,
      cleared: cleared,
      bestMoves: bestMoves,
      bestStars: bestStars,
      bestChain: bestChain,
      attempts: attempts,
    };
    return noteMaxChain(next, chain, null);
  }

  function withBoardTheme(stats, themeId) {
    var next = mergeStats(stats);
    var stars = totalMissionStars(next);
    next.boardTheme = normalizeBoardTheme(themeId, stars);
    return next;
  }

  /** Column-height variance — flatter boards are safer for deep AI. */
  function heightVariance(board) {
    var heights = [];
    var sum = 0;
    for (var col = 0; col < COLS; col += 1) {
      var h = 0;
      for (var row = 0; row < ROWS; row += 1) {
        if (board[row][col] !== null) {
          h = ROWS - row;
          break;
        }
      }
      heights.push(h);
      sum += h;
    }
    var mean = sum / COLS;
    var variance = 0;
    for (var i = 0; i < heights.length; i += 1) {
      var d = heights[i] - mean;
      variance += d * d;
    }
    return variance;
  }

  function createBoard() {
    var board = [];
    for (var r = 0; r < ROWS; r += 1) {
      var row = [];
      for (var c = 0; c < COLS; c += 1) row.push(null);
      board.push(row);
    }
    return board;
  }

  function cloneBoard(board) {
    return board.map(function (row) { return row.slice(); });
  }

  function clonePair(pair) {
    if (!pair) return null;
    return {
      row: pair.row,
      col: pair.col,
      rot: pair.rot,
      axis: pair.axis,
      child: pair.child,
    };
  }

  /**
   * Lock a pair and fully resolve gravity / pops. Used by CPU planning and Hint.
   * Returns chain / score / attack (garbage units at GARBAGE_RATE=70) / setupPotential.
   */
  function simulateLock(board, placement, garbageRate) {
    var rate = garbageRate || 70;
    var testBoard = lockPair(board, placement);
    var chain = 0;
    var totalScore = 0;
    var totalCleared = 0;

    while (true) {
      testBoard = applyGravity(testBoard).board;
      var groups = findGroups(testBoard);
      if (groups.length === 0) break;
      chain += 1;
      var step = stepScore(groups, chain);
      totalScore += step.score;
      totalCleared += step.cleared;
      testBoard = clearGroups(testBoard, groups);
    }

    if (chain > 0 && isBoardEmpty(testBoard)) totalScore += ALL_CLEAR_BONUS;
    return {
      board: testBoard,
      chain: chain,
      score: totalScore,
      cleared: totalCleared,
      attack: Math.floor(totalScore / rate),
      setup: setupPotential(testBoard),
    };
  }

  function randomColor(colorCount) {
    return ALL_COLORS[Math.floor(Math.random() * colorCount)];
  }

  /** A pair is {row, col, rot, axis, child}: row/col is the axis puyo, rot 0=up 1=right 2=down 3=left. */
  function createPair(colorCount) {
    return {
      row: HIDDEN_ROWS,
      col: SPAWN_COL,
      rot: 0,
      axis: randomColor(colorCount),
      child: randomColor(colorCount),
    };
  }

  function childPos(pair) {
    if (pair.rot === 0) return { row: pair.row - 1, col: pair.col };
    if (pair.rot === 1) return { row: pair.row, col: pair.col + 1 };
    if (pair.rot === 2) return { row: pair.row + 1, col: pair.col };
    return { row: pair.row, col: pair.col - 1 };
  }

  /** Free means inside the field and empty; the row above the hidden row counts as blocked. */
  function isFree(board, row, col) {
    if (col < 0 || col >= COLS) return false;
    if (row < 0 || row >= ROWS) return false;
    return board[row][col] === null;
  }

  function fits(board, pair) {
    var child = childPos(pair);
    return isFree(board, pair.row, pair.col) && isFree(board, child.row, child.col);
  }

  function movePair(board, pair, dRow, dCol) {
    var moved = { row: pair.row + dRow, col: pair.col + dCol, rot: pair.rot, axis: pair.axis, child: pair.child };
    return fits(board, moved) ? moved : null;
  }

  /**
   * Kick offsets tried (in order) when the axis stays put would collide.
   * Rotating into a wall pushes the pair away from it; rotating down floor-kicks up.
   */
  function kickOffsets(targetRot) {
    if (targetRot === 0) return [[0, 0], [1, 0], [0, -1], [0, 1]];
    if (targetRot === 1) return [[0, 0], [0, -1], [-1, 0]];
    if (targetRot === 2) return [[0, 0], [-1, 0], [0, -1], [0, 1]];
    return [[0, 0], [0, 1], [-1, 0]];
  }

  /** Rotate by dir (1 = clockwise, -1 = counter-clockwise); returns the original pair if nothing fits. */
  function rotatePair(board, pair, dir) {
    var targetRot = (pair.rot + (dir > 0 ? 1 : 3)) % 4;
    var offsets = kickOffsets(targetRot);
    for (var i = 0; i < offsets.length; i += 1) {
      var candidate = {
        row: pair.row + offsets[i][0],
        col: pair.col + offsets[i][1],
        rot: targetRot,
        axis: pair.axis,
        child: pair.child,
      };
      if (fits(board, candidate)) return candidate;
    }
    // Both sides blocked: quick turn (180°), as in the arcade games.
    var flipped = { row: pair.row, col: pair.col, rot: (pair.rot + 2) % 4, axis: pair.axis, child: pair.child };
    if (fits(board, flipped)) return flipped;
    flipped = { row: pair.row - 1, col: pair.col, rot: (pair.rot + 2) % 4, axis: pair.axis, child: pair.child };
    if (fits(board, flipped)) return flipped;
    return pair;
  }

  /** Drop the pair as far as it goes without locking it. */
  function dropPair(board, pair) {
    var current = pair;
    while (true) {
      var next = movePair(board, current, 1, 0);
      if (!next) return current;
      current = next;
    }
  }

  /** Write both puyos into a copy of the board. */
  function lockPair(board, pair) {
    var next = cloneBoard(board);
    var child = childPos(pair);
    if (pair.row >= 0 && pair.row < ROWS) next[pair.row][pair.col] = pair.axis;
    if (child.row >= 0 && child.row < ROWS) next[child.row][child.col] = pair.child;
    return next;
  }

  /**
   * Compact every column downwards. Returns the settled board plus the list of
   * puyos that moved, so the UI can animate the fall.
   */
  function applyGravity(board) {
    var next = createBoard();
    var moves = [];
    for (var c = 0; c < COLS; c += 1) {
      var writeRow = ROWS - 1;
      for (var r = ROWS - 1; r >= 0; r -= 1) {
        var color = board[r][c];
        if (color === null) continue;
        next[writeRow][c] = color;
        if (writeRow !== r) moves.push({ col: c, fromRow: r, toRow: writeRow, color: color });
        writeRow -= 1;
      }
    }
    return { board: next, moves: moves };
  }

  /** Connected same-colour groups of 4+; puyos in the hidden row never pop. */
  function findGroups(board) {
    var seen = [];
    for (var r = 0; r < ROWS; r += 1) seen.push(new Array(COLS).fill(false));

    var groups = [];
    for (var row = HIDDEN_ROWS; row < ROWS; row += 1) {
      for (var col = 0; col < COLS; col += 1) {
        var color = board[row][col];
        if (color === null || color === GARBAGE || seen[row][col]) continue;
        var cells = [];
        var stack = [{ r: row, c: col }];
        seen[row][col] = true;
        while (stack.length > 0) {
          var cell = stack.pop();
          cells.push(cell);
          var neighbours = [
            { r: cell.r - 1, c: cell.c },
            { r: cell.r + 1, c: cell.c },
            { r: cell.r, c: cell.c - 1 },
            { r: cell.r, c: cell.c + 1 },
          ];
          for (var i = 0; i < neighbours.length; i += 1) {
            var n = neighbours[i];
            if (n.r < HIDDEN_ROWS || n.r >= ROWS || n.c < 0 || n.c >= COLS) continue;
            if (seen[n.r][n.c] || board[n.r][n.c] !== color) continue;
            seen[n.r][n.c] = true;
            stack.push(n);
          }
        }
        if (cells.length >= POP_SIZE) groups.push({ color: color, cells: cells });
      }
    }
    return groups;
  }

  function clearGroups(board, groups) {
    var next = cloneBoard(board);
    groups.forEach(function (group) {
      group.cells.forEach(function (cell) {
        next[cell.r][cell.c] = null;
        var neighbours = [
          { r: cell.r - 1, c: cell.c },
          { r: cell.r + 1, c: cell.c },
          { r: cell.r, c: cell.c - 1 },
          { r: cell.r, c: cell.c + 1 },
        ];
        neighbours.forEach(function (n) {
          if (n.r < 0 || n.r >= ROWS || n.c < 0 || n.c >= COLS) return;
          if (next[n.r][n.c] === GARBAGE) next[n.r][n.c] = null;
        });
      });
    });
    return next;
  }

  function topEmptyRow(board, col) {
    for (var row = 0; row < ROWS; row += 1) {
      if (board[row][col] !== null) return row - 1;
    }
    return ROWS - 1;
  }

  function withGarbage(board, count) {
    var next = cloneBoard(board);
    var left = count;
    var offset = 0;
    while (left > 0) {
      var placedAny = false;
      for (var i = 0; i < COLS && left > 0; i += 1) {
        var col = (i + offset) % COLS;
        var row = topEmptyRow(next, col);
        if (row < 0) continue;
        next[row][col] = GARBAGE;
        left -= 1;
        placedAny = true;
      }
      if (!placedAny) break;
      offset = (offset + 2) % COLS;
    }
    return next;
  }

  function placementKey(pair) {
    var child = childPos(pair);
    return [pair.col, pair.rot, pair.row, child.col, child.row].join(':');
  }

  function enumeratePlacements(board, pair) {
    var placements = [];
    var seen = {};
    for (var rot = 0; rot < 4; rot += 1) {
      for (var col = 0; col < COLS; col += 1) {
        var candidate = {
          row: HIDDEN_ROWS,
          col: col,
          rot: rot,
          axis: pair.axis,
          child: pair.child,
        };
        if (!fits(board, candidate)) continue;
        var landed = dropPair(board, candidate);
        var key = placementKey(landed);
        if (seen[key]) continue;
        seen[key] = true;
        placements.push(landed);
      }
    }
    return placements;
  }

  function groupBonus(size) {
    if (size <= 4) return 0;
    if (size >= 11) return 10;
    return size - 3;
  }

  function chainPower(chain) {
    if (chain <= 0) return 0;
    if (chain <= CHAIN_POWER.length) return CHAIN_POWER[chain - 1];
    return CHAIN_POWER[CHAIN_POWER.length - 1] + (chain - CHAIN_POWER.length) * 32;
  }

  /** Standard Puyo scoring: 10 x puyos x (chain + colour + group bonus), multiplier clamped to 1..999. */
  function stepScore(groups, chain) {
    var cleared = 0;
    var bonus = 0;
    var colors = {};
    groups.forEach(function (group) {
      cleared += group.cells.length;
      bonus += groupBonus(group.cells.length);
      colors[group.color] = true;
    });
    var colorCount = Object.keys(colors).length;
    var colorBonus = COLOR_BONUS[Math.min(colorCount, COLOR_BONUS.length - 1)] || 0;
    var multiplier = chainPower(chain) + colorBonus + bonus;
    if (multiplier < 1) multiplier = 1;
    if (multiplier > 999) multiplier = 999;
    return { score: 10 * cleared * multiplier, cleared: cleared, multiplier: multiplier };
  }

  function isBoardEmpty(board) {
    for (var r = 0; r < ROWS; r += 1) {
      for (var c = 0; c < COLS; c += 1) {
        if (board[r][c] !== null) return false;
      }
    }
    return true;
  }

  /** The spawn cell being occupied is the classic death condition. */
  function isDead(board) {
    return board[HIDDEN_ROWS][SPAWN_COL] !== null;
  }

  /**
   * Classic nuisance preview breakdown:
   * small=1, large=6, rock=30, star=180, moon=360, crown=720.
   */
  function garbagePreviewIcons(count) {
    var remaining = Math.max(0, count | 0);
    var units = [
      { kind: 'crown', value: 720, glyph: '冠' },
      { kind: 'moon', value: 360, glyph: '月' },
      { kind: 'star', value: 180, glyph: '星' },
      { kind: 'rock', value: 30, glyph: '石' },
      { kind: 'large', value: 6, glyph: '大' },
      { kind: 'small', value: 1, glyph: '小' },
    ];
    var icons = [];
    for (var i = 0; i < units.length; i += 1) {
      var unit = units[i];
      while (remaining >= unit.value) {
        icons.push({ kind: unit.kind, value: unit.value, glyph: unit.glyph });
        remaining -= unit.value;
        if (icons.length >= 12) return icons;
      }
    }
    return icons;
  }

  /** Score unfinished same-colour clusters so Hard can prefer building over weak early pops. */
  function setupPotential(board) {
    var seen = [];
    for (var r = 0; r < ROWS; r += 1) seen.push(new Array(COLS).fill(false));
    var score = 0;

    for (var row = HIDDEN_ROWS; row < ROWS; row += 1) {
      for (var col = 0; col < COLS; col += 1) {
        var color = board[row][col];
        if (color === null || color === GARBAGE || seen[row][col]) continue;
        var cells = [];
        var stack = [{ r: row, c: col }];
        seen[row][col] = true;
        while (stack.length > 0) {
          var cell = stack.pop();
          cells.push(cell);
          var neighbours = [
            { r: cell.r - 1, c: cell.c },
            { r: cell.r + 1, c: cell.c },
            { r: cell.r, c: cell.c - 1 },
            { r: cell.r, c: cell.c + 1 },
          ];
          for (var i = 0; i < neighbours.length; i += 1) {
            var n = neighbours[i];
            if (n.r < HIDDEN_ROWS || n.r >= ROWS || n.c < 0 || n.c >= COLS) continue;
            if (seen[n.r][n.c] || board[n.r][n.c] !== color) continue;
            seen[n.r][n.c] = true;
            stack.push(n);
          }
        }
        if (cells.length === 2) score += 18;
        else if (cells.length === 3) score += 55;
        else if (cells.length === 1) score += 2;
      }
    }
    return score;
  }

  /**
   * Extra score for 3-groups that already have an empty adjacent cell (near trigger).
   * Helps deeper CPU favour chain-ready scaffolding over inert stacks.
   */
  function nearTriggerScore(board) {
    var seen = [];
    for (var r = 0; r < ROWS; r += 1) seen.push(new Array(COLS).fill(false));
    var score = 0;

    for (var row = HIDDEN_ROWS; row < ROWS; row += 1) {
      for (var col = 0; col < COLS; col += 1) {
        var color = board[row][col];
        if (color === null || color === GARBAGE || seen[row][col]) continue;
        var cells = [];
        var stack = [{ r: row, c: col }];
        seen[row][col] = true;
        while (stack.length > 0) {
          var cell = stack.pop();
          cells.push(cell);
          var neighbours = [
            { r: cell.r - 1, c: cell.c },
            { r: cell.r + 1, c: cell.c },
            { r: cell.r, c: cell.c - 1 },
            { r: cell.r, c: cell.c + 1 },
          ];
          for (var i = 0; i < neighbours.length; i += 1) {
            var n = neighbours[i];
            if (n.r < HIDDEN_ROWS || n.r >= ROWS || n.c < 0 || n.c >= COLS) continue;
            if (seen[n.r][n.c] || board[n.r][n.c] !== color) continue;
            seen[n.r][n.c] = true;
            stack.push(n);
          }
        }
        if (cells.length !== 3) continue;
        var open = false;
        for (var j = 0; j < cells.length && !open; j += 1) {
          var adj = [
            { r: cells[j].r - 1, c: cells[j].c },
            { r: cells[j].r + 1, c: cells[j].c },
            { r: cells[j].r, c: cells[j].c - 1 },
            { r: cells[j].r, c: cells[j].c + 1 },
          ];
          for (var k = 0; k < adj.length; k += 1) {
            var a = adj[k];
            if (a.r < HIDDEN_ROWS || a.r >= ROWS || a.c < 0 || a.c >= COLS) continue;
            if (board[a.r][a.c] === null) {
              open = true;
              break;
            }
          }
        }
        if (open) score += 70;
      }
    }
    return score;
  }

  global.PuyoLogic = {
    COLS: COLS,
    ROWS: ROWS,
    HIDDEN_ROWS: HIDDEN_ROWS,
    VISIBLE_ROWS: VISIBLE_ROWS,
    SPAWN_COL: SPAWN_COL,
    ALL_COLORS: ALL_COLORS,
    GARBAGE: GARBAGE,
    ALL_CLEAR_BONUS: ALL_CLEAR_BONUS,
    createBoard: createBoard,
    cloneBoard: cloneBoard,
    clonePair: clonePair,
    createPair: createPair,
    simulateLock: simulateLock,
    childPos: childPos,
    isFree: isFree,
    fits: fits,
    movePair: movePair,
    rotatePair: rotatePair,
    dropPair: dropPair,
    lockPair: lockPair,
    applyGravity: applyGravity,
    withGarbage: withGarbage,
    enumeratePlacements: enumeratePlacements,
    findGroups: findGroups,
    clearGroups: clearGroups,
    stepScore: stepScore,
    chainPower: chainPower,
    groupBonus: groupBonus,
    isBoardEmpty: isBoardEmpty,
    isDead: isDead,
    garbagePreviewIcons: garbagePreviewIcons,
    setupPotential: setupPotential,
    nearTriggerScore: nearTriggerScore,

    // Vs-CPU career stats (pure helpers; localStorage I/O lives in main.js).
    STATS_KEY: STATS_KEY,
    DEFAULT_STATS: mergeStats(null),
    VALID_DIFFICULTIES: VALID_DIFFICULTIES,
    VALID_MODES: VALID_MODES,
    DIFFICULTY_IDS: DIFFICULTY_IDS,
    BOARD_THEMES: BOARD_THEMES,
    VALID_THEMES: VALID_THEMES,
    mergeStats: mergeStats,
    modeOf: modeOf,
    recordCpuResult: recordCpuResult,
    noteMaxChain: noteMaxChain,
    recordMissionClear: recordMissionClear,
    markTutorialComplete: markTutorialComplete,
    withPrefs: withPrefs,
    recordDailyResult: recordDailyResult,
    withBoardTheme: withBoardTheme,
    totalMissionStars: totalMissionStars,
    themeById: themeById,
    isThemeUnlocked: isThemeUnlocked,
    heightVariance: heightVariance,
  };
})(window);
