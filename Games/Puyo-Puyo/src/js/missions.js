/**
 * Mission ladder + interactive chain tutorial data for Puyo Puyo.
 * Boards are 12 visible rows (top→bottom); chars: R G B Y P . and X=garbage.
 * Exposed as window.PuyoMissions.
 */
(function (global) {
  'use strict';

  var L = global.PuyoLogic;
  var CHAR_TO_COLOR = {
    R: 'red',
    G: 'green',
    B: 'blue',
    Y: 'yellow',
    P: 'purple',
    X: 'garbage',
    '.': null,
    ' ': null,
  };

  /** Paint a 12-row ASCII diagram onto a fresh board (row 0 of lines = top visible). */
  function boardFromLines(lines) {
    var board = L.createBoard();
    var rowCount = Math.min(lines.length, L.VISIBLE_ROWS);
    var rowOffset = L.VISIBLE_ROWS - rowCount;
    for (var r = 0; r < rowCount; r += 1) {
      var line = lines[r];
      for (var c = 0; c < L.COLS; c += 1) {
        var ch = line[c] || '.';
        var color = Object.prototype.hasOwnProperty.call(CHAR_TO_COLOR, ch)
          ? CHAR_TO_COLOR[ch]
          : null;
        board[L.HIDDEN_ROWS + rowOffset + r][c] = color;
      }
    }
    return board;
  }

  function pairOf(axis, child, col, rot) {
    return {
      row: L.HIDDEN_ROWS,
      col: col == null ? L.SPAWN_COL : col,
      rot: rot || 0,
      axis: axis,
      child: child,
    };
  }

  /**
   * Interactive teaching stages (2 → 3 → 4 chain), then free practice.
   * solution hints are (col, rot) for the given first pair.
   */
  var TUTORIAL_STAGES = [
    {
      id: 'teach-2',
      title: '二連鎖教室',
      blurb: '同色連成 4 顆會消除；消除後上方落下若再連成 4 顆，就是連鎖。請用這組氣泡引爆 2 連鎖。',
      targetChain: 2,
      moveLimit: 1,
      colorCount: 4,
      lines: [
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        'YY....',
        'RRRY..',
        'GGGGR.',
      ],
      queue: [pairOf('red', 'yellow', 2, 0)],
      hint: { col: 2, rot: 0 },
    },
    {
      id: 'teach-3',
      title: '三連鎖教室',
      blurb: '階梯埋設：先爆紅／綠，黃與藍會依序掉落接上。請打出 3 連鎖。',
      targetChain: 3,
      moveLimit: 1,
      colorCount: 4,
      lines: [
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        'B.....',
        'BY....',
        'BYY...',
        'RRRY..',
        'RGGGY.',
        'GGGGR.',
      ],
      queue: [pairOf('red', 'blue', 1, 0)],
      hint: { col: 1, rot: 0 },
    },
    {
      id: 'teach-4',
      title: '四連鎖教室',
      blurb: '在三連鎖骨架上再加上紫色土台。打出 4 連鎖看看氣勢！',
      targetChain: 4,
      moveLimit: 1,
      colorCount: 5,
      lines: [
        '......',
        '......',
        '......',
        '......',
        'P.....',
        'P.....',
        'BP....',
        'BY....',
        'BYY...',
        'RRRY..',
        'RGGGY.',
        'GGGGR.',
      ],
      queue: [pairOf('purple', 'blue', 0, 1)],
      hint: { col: 0, rot: 1 },
    },
  ];

  /** Quest ladder: clear in order. Later missions unlock after earlier clears. */
  var MISSION_LADDER = [
    {
      id: 'm1-two',
      title: '任務 1：二連鎖入門',
      blurb: '一手引爆 2 連鎖。',
      targetChain: 2,
      moveLimit: 1,
      colorCount: 4,
      lines: [
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        'YY....',
        'RRRY..',
        'GGGGR.',
      ],
      queue: [pairOf('red', 'yellow', 2, 0)],
      hint: { col: 2, rot: 0 },
    },
    {
      id: 'm2-three',
      title: '任務 2：三連鎖',
      blurb: '一手打出 3 連鎖。',
      targetChain: 3,
      moveLimit: 1,
      colorCount: 4,
      lines: [
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        'B.....',
        'BY....',
        'BYY...',
        'RRRY..',
        'RGGGY.',
        'GGGGR.',
      ],
      queue: [pairOf('red', 'blue', 1, 0)],
      hint: { col: 1, rot: 0 },
    },
    {
      id: 'm3-four',
      title: '任務 3：四連鎖',
      blurb: '一手打出 4 連鎖。',
      targetChain: 4,
      moveLimit: 1,
      colorCount: 5,
      lines: [
        '......',
        '......',
        '......',
        '......',
        '......',
        'P.....',
        'BPP...',
        'BYP...',
        'BYY...',
        'RRRY..',
        'RGGGY.',
        'GGGGR.',
      ],
      queue: [pairOf('red', 'blue', 0, 1)],
      hint: { col: 0, rot: 1 },
    },
    {
      id: 'm4-two-build',
      title: '任務 4：兩手二連鎖',
      blurb: '最多兩手，達成至少 2 連鎖（可先埋再爆）。',
      targetChain: 2,
      moveLimit: 2,
      colorCount: 4,
      lines: [
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        'Y.....',
        'RRR...',
        'GGGG..',
      ],
      queue: [
        pairOf('yellow', 'red', 2, 0),
        pairOf('green', 'yellow', 3, 0),
      ],
      hint: null,
    },
    {
      id: 'm5-three-build',
      title: '任務 5：三連鎖限手',
      blurb: '三手內打出 3 連鎖。',
      targetChain: 3,
      moveLimit: 3,
      colorCount: 4,
      lines: [
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        '......',
        'B.....',
        'BY....',
        'BYY...',
        'RRR...',
        'GGGG..',
      ],
      queue: [
        pairOf('red', 'green', 2, 0),
        pairOf('yellow', 'blue', 1, 0),
        pairOf('red', 'blue', 1, 0),
      ],
      hint: null,
    },
    {
      id: 'm6-four-alt',
      title: '任務 6：四連鎖再演',
      blurb: '換一組土台，一手 4 連鎖。',
      targetChain: 4,
      moveLimit: 1,
      colorCount: 5,
      lines: [
        '......',
        '......',
        '......',
        '......',
        'P.....',
        'P.....',
        'BP....',
        'BY....',
        'BYY...',
        'RRRY..',
        'RGGGY.',
        'GGGGR.',
      ],
      queue: [pairOf('purple', 'blue', 0, 1)],
      hint: { col: 0, rot: 1 },
    },
  ];

  function missionById(id) {
    for (var i = 0; i < MISSION_LADDER.length; i += 1) {
      if (MISSION_LADDER[i].id === id) return MISSION_LADDER[i];
    }
    return null;
  }

  function tutorialStageById(id) {
    for (var i = 0; i < TUTORIAL_STAGES.length; i += 1) {
      if (TUTORIAL_STAGES[i].id === id) return TUTORIAL_STAGES[i];
    }
    return null;
  }

  /** First uncleared mission id, or null if all cleared. */
  function nextMissionId(clearedMap) {
    var cleared = clearedMap || {};
    for (var i = 0; i < MISSION_LADDER.length; i += 1) {
      if (!cleared[MISSION_LADDER[i].id]) return MISSION_LADDER[i].id;
    }
    return null;
  }

  function isMissionUnlocked(id, clearedMap) {
    var cleared = clearedMap || {};
    for (var i = 0; i < MISSION_LADDER.length; i += 1) {
      if (MISSION_LADDER[i].id === id) return true;
      if (!cleared[MISSION_LADDER[i].id]) return false;
    }
    return false;
  }

  /**
   * Verify a one-move puzzle: dropping the first queue pair at hint (or any placement)
   * can reach targetChain. Used by check-logic.
   */
  function verifyOneMove(def) {
    var board = boardFromLines(def.lines);
    var pair = def.queue[0];
    if (def.hint) {
      var hinted = {
        row: L.HIDDEN_ROWS,
        col: def.hint.col,
        rot: def.hint.rot,
        axis: pair.axis,
        child: pair.child,
      };
      if (!L.fits(board, hinted)) return { ok: false, reason: 'hint does not fit' };
      var result = L.simulateLock(board, L.dropPair(board, hinted), 70);
      return {
        ok: result.chain >= def.targetChain,
        chain: result.chain,
        score: result.score,
      };
    }
    var placements = L.enumeratePlacements(board, pair);
    var best = 0;
    for (var i = 0; i < placements.length; i += 1) {
      var r = L.simulateLock(board, placements[i], 70);
      if (r.chain > best) best = r.chain;
    }
    return { ok: best >= def.targetChain, chain: best };
  }

  global.PuyoMissions = {
    boardFromLines: boardFromLines,
    pairOf: pairOf,
    TUTORIAL_STAGES: TUTORIAL_STAGES,
    MISSION_LADDER: MISSION_LADDER,
    missionById: missionById,
    tutorialStageById: tutorialStageById,
    nextMissionId: nextMissionId,
    isMissionUnlocked: isMissionUnlocked,
    verifyOneMove: verifyOneMove,
  };
})(window);
