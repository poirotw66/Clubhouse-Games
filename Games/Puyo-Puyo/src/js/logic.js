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
  var DEFAULT_STATS = {
    wins: 0,
    losses: 0,
    winStreak: 0,
    bestMaxChain: 0,
    lastDifficulty: 'normal',
    lastMode: 'cpu',
  };
  var VALID_DIFFICULTIES = { easy: true, normal: true, hard: true };
  var VALID_MODES = { cpu: true, versus: true };

  function asNonNegInt(value) {
    var n = Number(value);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  /** Merge partial / corrupt storage into a valid career-stats object. */
  function mergeStats(raw) {
    if (!raw || typeof raw !== 'object') {
      return {
        wins: DEFAULT_STATS.wins,
        losses: DEFAULT_STATS.losses,
        winStreak: DEFAULT_STATS.winStreak,
        bestMaxChain: DEFAULT_STATS.bestMaxChain,
        lastDifficulty: DEFAULT_STATS.lastDifficulty,
        lastMode: DEFAULT_STATS.lastMode,
      };
    }
    var lastDifficulty = typeof raw.lastDifficulty === 'string' && VALID_DIFFICULTIES[raw.lastDifficulty]
      ? raw.lastDifficulty
      : DEFAULT_STATS.lastDifficulty;
    var lastMode = typeof raw.lastMode === 'string' && VALID_MODES[raw.lastMode]
      ? raw.lastMode
      : DEFAULT_STATS.lastMode;
    return {
      wins: asNonNegInt(raw.wins),
      losses: asNonNegInt(raw.losses),
      winStreak: asNonNegInt(raw.winStreak),
      bestMaxChain: asNonNegInt(raw.bestMaxChain),
      lastDifficulty: lastDifficulty,
      lastMode: lastMode,
    };
  }

  /** Apply a vs-CPU win or loss. Streak climbs on win, resets on loss. */
  function recordCpuResult(stats, won) {
    var next = mergeStats(stats);
    if (won) {
      next.wins += 1;
      next.winStreak += 1;
    } else {
      next.losses += 1;
      next.winStreak = 0;
    }
    return next;
  }

  /** Track personal-best max chain from a finished match (win or lose). */
  function noteMaxChain(stats, chain) {
    var next = mergeStats(stats);
    var n = asNonNegInt(chain);
    if (n > next.bestMaxChain) next.bestMaxChain = n;
    return next;
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
    createPair: createPair,
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

    // Vs-CPU career stats (pure helpers; localStorage I/O lives in main.js).
    STATS_KEY: STATS_KEY,
    DEFAULT_STATS: DEFAULT_STATS,
    mergeStats: mergeStats,
    recordCpuResult: recordCpuResult,
    noteMaxChain: noteMaxChain,
    withPrefs: withPrefs,
  };
})(window);
