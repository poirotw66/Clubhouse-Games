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

  function countColor(board, color) {
    var n = 0;
    for (var r = 0; r < L.ROWS; r += 1) {
      for (var c = 0; c < L.COLS; c += 1) {
        if (board[r][c] === color) n += 1;
      }
    }
    return n;
  }

  /**
   * Interactive teaching stages: connect → 2-chain stair → 3-chain → 4-chain.
   * `hint` / `solution` are (col, rot) for the active queue step.
   */
  var TUTORIAL_STAGES = [
    {
      id: 'teach-connect',
      title: '消除入門',
      blurb: '同色上下左右連成 4 顆就會消除。請依金色落點提示，把紅氣泡接上。',
      goalType: 'chain',
      targetChain: 1,
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
        '......',
        'RRR...',
        'GGG...',
      ],
      queue: [pairOf('red', 'green', 2, 0)],
      hint: { col: 0, rot: 1 },
      solution: [{ col: 0, rot: 1 }],
      autoHint: true,
    },
    {
      id: 'teach-stair',
      title: '階梯型二連鎖',
      blurb: '階梯埋設：綠在底、紅錯一格、黃再錯一格。拔掉綠色後紅黃會依序接上——打出 2 連鎖。',
      goalType: 'chain',
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
      solution: [{ col: 2, rot: 0 }],
      autoHint: true,
    },
    {
      id: 'teach-3',
      title: '三連鎖教室',
      blurb: '在階梯上再疊藍／黃土台。先爆紅／綠，黃與藍會依序掉落接上。請打出 3 連鎖。',
      goalType: 'chain',
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
      solution: [{ col: 1, rot: 0 }],
      autoHint: true,
    },
    {
      id: 'teach-4',
      title: '四連鎖教室',
      blurb: '在三連鎖骨架上再加上紫色土台。打出 4 連鎖看看氣勢！',
      goalType: 'chain',
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
      solution: [{ col: 0, rot: 1 }],
      autoHint: true,
    },
  ];

  /**
   * Quest ladder (≥12): chain / all-clear / clear-color goals.
   * Later missions unlock after earlier clears. `solution` enables auto-verify.
   */
  var MISSION_LADDER = [
    {
      id: 'm1-two',
      title: '任務 1：二連鎖入門',
      blurb: '一手引爆 2 連鎖。',
      goalType: 'chain',
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
      solution: [{ col: 2, rot: 0 }],
    },
    {
      id: 'm2-three',
      title: '任務 2：三連鎖',
      blurb: '一手打出 3 連鎖。',
      goalType: 'chain',
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
      solution: [{ col: 1, rot: 0 }],
    },
    {
      id: 'm3-four',
      title: '任務 3：四連鎖',
      blurb: '一手打出 4 連鎖。',
      goalType: 'chain',
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
      solution: [{ col: 0, rot: 1 }],
    },
    {
      id: 'm4-two-build',
      title: '任務 4：兩手二連鎖',
      blurb: '最多兩手：先補齊綠色，再用紅／黃引爆 2 連鎖。',
      goalType: 'chain',
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
        '......',
        'RRR...',
        'GGG...',
      ],
      queue: [
        pairOf('green', 'yellow', 3, 0),
        pairOf('red', 'yellow', 2, 0),
      ],
      hint: { col: 0, rot: 0 },
      solution: [
        { col: 0, rot: 0 },
        { col: 1, rot: 0 },
      ],
    },
    {
      id: 'm5-three-build',
      title: '任務 5：兩手三連鎖',
      blurb: '兩手內補土台並打出 3 連鎖。',
      goalType: 'chain',
      targetChain: 3,
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
        'B.....',
        'BY....',
        'BYY...',
        'RRR...',
        'GGG...',
      ],
      queue: [
        pairOf('green', 'red', 2, 0),
        pairOf('red', 'blue', 1, 0),
      ],
      hint: { col: 0, rot: 2 },
      solution: [
        { col: 0, rot: 2 },
        { col: 0, rot: 1 },
      ],
    },
    {
      id: 'm6-four-alt',
      title: '任務 6：四連鎖再演',
      blurb: '換一組土台，一手 4 連鎖。',
      goalType: 'chain',
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
      solution: [{ col: 0, rot: 1 }],
    },
    {
      id: 'm7-all-clear',
      title: '任務 7：全消入門',
      blurb: '一手把場上氣泡全部消光（全消）。',
      goalType: 'allClear',
      targetChain: 1,
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
        '......',
        'RRR...',
        'R.....',
      ],
      queue: [pairOf('red', 'red', 1, 0)],
      hint: { col: 0, rot: 0 },
      solution: [{ col: 0, rot: 0 }],
    },
    {
      id: 'm8-clear-red',
      title: '任務 8：清掉紅色',
      blurb: '一手內讓場上不再有紅色氣泡（綠色可留下）。',
      goalType: 'clearColor',
      clearColor: 'red',
      targetChain: 1,
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
        'GGG...',
        'RRR...',
        'R.....',
      ],
      queue: [pairOf('red', 'red', 2, 0)],
      hint: { col: 3, rot: 0 },
      solution: [{ col: 3, rot: 0 }],
    },
    {
      id: 'm9-clear-yellow',
      title: '任務 9：清掉黃色',
      blurb: '一手消光所有黃色氣泡。',
      goalType: 'clearColor',
      clearColor: 'yellow',
      targetChain: 1,
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
        'YYY...',
        'RRRY..',
        'GGGG..',
      ],
      queue: [pairOf('yellow', 'red', 2, 0)],
      hint: { col: 3, rot: 0 },
      solution: [{ col: 3, rot: 0 }],
    },
    {
      id: 'm10-all-clear-ojama',
      title: '任務 10：帶垃圾全消',
      blurb: '紅色消除時會帶走相鄰垃圾。一手全消！',
      goalType: 'allClear',
      targetChain: 1,
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
        'XXX...',
        'RRRX..',
        'RRR...',
      ],
      queue: [pairOf('red', 'red', 2, 0)],
      hint: { col: 3, rot: 0 },
      solution: [{ col: 3, rot: 0 }],
    },
    {
      id: 'm11-two-alt',
      title: '任務 11：埋設再爆',
      blurb: '兩手內先補黃再引爆，達成至少 2 連鎖。',
      goalType: 'chain',
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
        'YY....',
        'RRR...',
        'GGG...',
      ],
      queue: [
        pairOf('green', 'red', 3, 0),
        pairOf('yellow', 'red', 2, 0),
      ],
      hint: { col: 2, rot: 0 },
      solution: [
        { col: 2, rot: 0 },
        { col: 3, rot: 0 },
      ],
    },
    {
      id: 'm12-three-limit',
      title: '任務 12：三連鎖限手',
      blurb: '沿用教室土台，三手內打出 3 連鎖（可先埋再爆）。',
      goalType: 'chain',
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
      hint: { col: 0, rot: 0 },
      solution: [
        { col: 0, rot: 0 },
        { col: 0, rot: 0 },
        { col: 0, rot: 1 },
      ],
    },
    // —— 任務包 2：階梯／GTR 進階、限時、限手 ——
    {
      id: 'm13-stair-mirror',
      title: '任務 13：鏡像階梯',
      blurb: '任務包 2・階梯進階：鏡像土台，一手 2 連鎖。',
      pack: 2,
      goalType: 'chain',
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
        '....YY',
        '..YRRR',
        '.RGGGG',
      ],
      queue: [pairOf('red', 'yellow', 3, 0)],
      hint: { col: 3, rot: 0 },
      solution: [{ col: 3, rot: 0 }],
    },
    {
      id: 'm14-gtr-intro',
      title: '任務 14：GTR 入門',
      blurb: '任務包 2・GTR／階梯基本型：拔掉綠色後紅→黃依序接上，一手 3 連鎖。',
      pack: 2,
      goalType: 'chain',
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
        'Y.....',
        'YR....',
        'YRR...',
        'GGGR..',
        'GBBBR.',
        'BBBBG.',
      ],
      queue: [pairOf('green', 'yellow', 1, 0)],
      hint: { col: 1, rot: 0 },
      solution: [{ col: 1, rot: 0 }],
    },
    {
      id: 'm15-gtr-four',
      title: '任務 15：GTR 四連鎖',
      blurb: '任務包 2・在基本型上再疊紫／紅土台，一手 4 連鎖。',
      pack: 2,
      goalType: 'chain',
      targetChain: 4,
      moveLimit: 1,
      colorCount: 5,
      lines: [
        '......',
        '......',
        '......',
        '......',
        '......',
        'R.....',
        'YRR...',
        'YGR...',
        'YGG...',
        'BBBG..',
        'BPPPG.',
        'PPPPB.',
      ],
      queue: [pairOf('blue', 'yellow', 0, 1)],
      hint: { col: 0, rot: 1 },
      solution: [{ col: 0, rot: 1 }],
    },
    {
      id: 'm16-stair-timed',
      title: '任務 16：限時階梯',
      blurb: '任務包 2・限時 45 秒內一手打出 2 連鎖。',
      pack: 2,
      goalType: 'chain',
      targetChain: 2,
      moveLimit: 1,
      timeLimitSec: 45,
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
        'BB....',
        'RRRB..',
        'YYYYR.',
      ],
      queue: [pairOf('red', 'blue', 2, 0)],
      hint: { col: 2, rot: 0 },
      solution: [{ col: 2, rot: 0 }],
    },
    {
      id: 'm17-clear-blue-timed',
      title: '任務 17：限時消藍',
      blurb: '任務包 2・60 秒內一手消光所有藍色。',
      pack: 2,
      goalType: 'clearColor',
      clearColor: 'blue',
      targetChain: 1,
      moveLimit: 1,
      timeLimitSec: 60,
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
        'RRR...',
        'BBB...',
        'B.....',
      ],
      queue: [pairOf('blue', 'blue', 2, 0)],
      hint: { col: 3, rot: 0 },
      solution: [{ col: 3, rot: 0 }],
    },
    {
      id: 'm18-two-gtr-build',
      title: '任務 18：兩手 GTR',
      blurb: '任務包 2・兩手內補齊土台並引爆至少 3 連鎖。',
      pack: 2,
      goalType: 'chain',
      targetChain: 3,
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
        'Y.....',
        'YR....',
        'YRR...',
        'BBB...',
        'PPP...',
      ],
      queue: [
        pairOf('purple', 'blue', 2, 0),
        pairOf('blue', 'yellow', 1, 0),
      ],
      hint: { col: 0, rot: 2 },
      solution: [
        { col: 0, rot: 2 },
        { col: 0, rot: 1 },
      ],
    },
    {
      id: 'm19-all-clear-timed',
      title: '任務 19：限時全消',
      blurb: '任務包 2・40 秒內一手全消。',
      pack: 2,
      goalType: 'allClear',
      targetChain: 1,
      moveLimit: 1,
      timeLimitSec: 40,
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
        '......',
        'YYY...',
        'Y.....',
      ],
      queue: [pairOf('yellow', 'yellow', 1, 0)],
      hint: { col: 0, rot: 0 },
      solution: [{ col: 0, rot: 0 }],
    },
    {
      id: 'm20-sandwich',
      title: '任務 20：夾擊階梯',
      blurb: '任務包 2・夾擊／階梯複合土台，一手 3 連鎖。',
      pack: 2,
      goalType: 'chain',
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
        'P.....',
        'PY....',
        'PYY...',
        'GGGY..',
        'GBBBY.',
        'BBBBG.',
      ],
      queue: [pairOf('green', 'purple', 1, 0)],
      hint: { col: 1, rot: 0 },
      solution: [{ col: 1, rot: 0 }],
    },
    {
      id: 'm21-three-limit-pack2',
      title: '任務 21：限手階梯再建',
      blurb: '任務包 2・三手內打出 3 連鎖（可先埋再爆）。',
      pack: 2,
      goalType: 'chain',
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
        'Y.....',
        'YG....',
        'YGG...',
        'RRR...',
        'BBBB..',
      ],
      queue: [
        pairOf('red', 'blue', 2, 0),
        pairOf('green', 'yellow', 1, 0),
        pairOf('red', 'yellow', 0, 1),
      ],
      hint: { col: 0, rot: 0 },
      solution: [
        { col: 0, rot: 0 },
        { col: 0, rot: 0 },
        { col: 0, rot: 1 },
      ],
    },
    {
      id: 'm22-clear-green-ojama',
      title: '任務 22：清綠帶垃圾',
      blurb: '任務包 2・一手消光綠色（相鄰垃圾一併帶走）。',
      pack: 2,
      goalType: 'clearColor',
      clearColor: 'green',
      targetChain: 1,
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
        'XXX...',
        'GGGX..',
        'GGG...',
      ],
      queue: [pairOf('green', 'green', 2, 0)],
      hint: { col: 3, rot: 0 },
      solution: [{ col: 3, rot: 0 }],
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

  function goalTypeOf(def) {
    return def.goalType || 'chain';
  }

  /** Human-readable goal line for HUD. */
  function goalLabel(def) {
    var type = goalTypeOf(def);
    if (type === 'allClear') return '全消';
    if (type === 'clearColor') {
      var names = {
        red: '紅色',
        green: '綠色',
        blue: '藍色',
        yellow: '黃色',
        purple: '紫色',
      };
      return '消光' + (names[def.clearColor] || def.clearColor);
    }
    return '目標 ' + def.targetChain + ' 連鎖';
  }

  /**
   * Star rating 1–3 from moves used vs optimal solution length.
   * 3 = optimal (or better), 2 = within mid band, 1 = cleared within limit.
   */
  function rateStars(def, movesUsed) {
    var used = Math.max(1, movesUsed | 0);
    var limit = Math.max(1, def.moveLimit | 0);
    var optimal =
      def.solution && def.solution.length
        ? def.solution.length
        : Math.min(limit, 1);
    if (used <= optimal) return 3;
    if (used <= Math.ceil((optimal + limit) / 2)) return 2;
    return 1;
  }

  function applySolutionStep(board, pair, step) {
    var candidate = {
      row: L.HIDDEN_ROWS,
      col: step.col,
      rot: step.rot,
      axis: pair.axis,
      child: pair.child,
    };
    if (!L.fits(board, candidate)) return null;
    return L.simulateLock(board, L.dropPair(board, candidate), 70);
  }

  function goalMetOnBoard(def, board, maxChain) {
    var type = goalTypeOf(def);
    if (type === 'allClear') return L.isBoardEmpty(board);
    if (type === 'clearColor') return countColor(board, def.clearColor) === 0;
    return maxChain >= (def.targetChain || 1);
  }

  /**
   * Replay `solution` (or single `hint`) and confirm the goal is reachable.
   * Used by check-logic for every mission / tutorial stage.
   */
  function verifyMission(def) {
    var steps =
      def.solution && def.solution.length
        ? def.solution
        : def.hint
          ? [def.hint]
          : null;
    if (!steps || !steps.length) {
      return { ok: false, reason: 'missing solution' };
    }
    if (steps.length > def.moveLimit) {
      return { ok: false, reason: 'solution longer than moveLimit' };
    }
    if (steps.length > def.queue.length) {
      return { ok: false, reason: 'solution longer than queue' };
    }

    var board = boardFromLines(def.lines);
    var maxChain = 0;
    var last = null;
    for (var i = 0; i < steps.length; i += 1) {
      var pair = def.queue[i];
      last = applySolutionStep(board, pair, steps[i]);
      if (!last) {
        return { ok: false, reason: 'step ' + i + ' does not fit', step: i };
      }
      if (last.chain > maxChain) maxChain = last.chain;
      board = last.board;
      if (goalMetOnBoard(def, board, maxChain)) {
        return {
          ok: true,
          chain: maxChain,
          score: last.score,
          moves: i + 1,
          stars: rateStars(def, i + 1),
        };
      }
    }
    return {
      ok: false,
      reason: 'goal not met after solution',
      chain: maxChain,
      goalType: goalTypeOf(def),
    };
  }

  /** @deprecated alias — prefer verifyMission (supports multi-move + goal types). */
  function verifyOneMove(def) {
    return verifyMission(def);
  }

  /** Hint for the current move index (0-based). */
  function hintForMove(def, moveIndex) {
    if (!def) return null;
    if (def.solution && def.solution.length && moveIndex < def.solution.length) {
      return def.solution[moveIndex];
    }
    if (moveIndex === 0 && def.hint) return def.hint;
    return null;
  }

  global.PuyoMissions = {
    boardFromLines: boardFromLines,
    pairOf: pairOf,
    countColor: countColor,
    TUTORIAL_STAGES: TUTORIAL_STAGES,
    MISSION_LADDER: MISSION_LADDER,
    missionById: missionById,
    tutorialStageById: tutorialStageById,
    nextMissionId: nextMissionId,
    isMissionUnlocked: isMissionUnlocked,
    goalTypeOf: goalTypeOf,
    goalLabel: goalLabel,
    rateStars: rateStars,
    goalMetOnBoard: goalMetOnBoard,
    verifyMission: verifyMission,
    verifyOneMove: verifyOneMove,
    hintForMove: hintForMove,
  };
})(window);
