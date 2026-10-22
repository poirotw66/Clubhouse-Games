/**
 * Daily puzzle — Asia/Taipei calendar day seeds a fixed board + queue.
 * Everyone gets the same puzzle on the same Taipei date.
 * Exposed as window.PuyoDaily.
 */
(function (global) {
  'use strict';

  var M = global.PuyoMissions;
  var TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

  /** YYYY-MM-DD in Asia/Taipei wall clock. */
  function taipeiDateKey(now) {
    var shifted = new Date((now || new Date()).getTime() + TZ_OFFSET_MS);
    var y = shifted.getUTCFullYear();
    var m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    var d = String(shifted.getUTCDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function previousTaipeiDay(key) {
    var parts = key.split('-').map(Number);
    var utc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    utc.setUTCDate(utc.getUTCDate() - 1);
    return taipeiDateKey(new Date(utc.getTime() - TZ_OFFSET_MS));
  }

  /** FNV-1a 32-bit — deterministic, no Math.random. */
  function hashString(input) {
    var h = 0x811c9dc5;
    for (var i = 0; i < input.length; i += 1) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function pairOf(axis, child, col, rot) {
    return M.pairOf(axis, child, col, rot);
  }

  /**
   * Curated pool — same shape as missions (solvable; verified in check-logic).
   * Day hash picks one entry so the calendar always yields a fixed puzzle.
   */
  var DAILY_POOL = [
    {
      poolId: 'd-stair-2',
      title: '每日：階梯二連鎖',
      blurb: '一手打出 2 連鎖。今日全站同題。',
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
      poolId: 'd-stair-3',
      title: '每日：三連鎖教室型',
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
      poolId: 'd-four',
      title: '每日：四連鎖挑戰',
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
      poolId: 'd-all-clear',
      title: '每日：全消',
      blurb: '一手把場上氣泡全部消光。',
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
      poolId: 'd-clear-red',
      title: '每日：消光紅色',
      blurb: '一手讓場上不再有紅色。',
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
      poolId: 'd-clear-yellow',
      title: '每日：消光黃色',
      blurb: '一手消光所有黃色。',
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
      poolId: 'd-ojama-clear',
      title: '每日：帶垃圾全消',
      blurb: '消除紅色時帶走相鄰垃圾，一手全消。',
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
      poolId: 'd-two-build',
      title: '每日：兩手二連鎖',
      blurb: '最多兩手：先補綠再用紅／黃引爆。',
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
      queue: [pairOf('green', 'yellow', 3, 0), pairOf('red', 'yellow', 2, 0)],
      hint: { col: 0, rot: 0 },
      solution: [
        { col: 0, rot: 0 },
        { col: 1, rot: 0 },
      ],
    },
    {
      poolId: 'd-three-build',
      title: '每日：兩手三連鎖',
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
      queue: [pairOf('green', 'red', 2, 0), pairOf('red', 'blue', 1, 0)],
      hint: { col: 0, rot: 2 },
      solution: [
        { col: 0, rot: 2 },
        { col: 0, rot: 1 },
      ],
    },
    {
      poolId: 'd-four-alt',
      title: '每日：四連鎖再演',
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
      poolId: 'd-bury-two',
      title: '每日：埋設再爆',
      blurb: '兩手內先補黃再引爆，至少 2 連鎖。',
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
      queue: [pairOf('green', 'red', 3, 0), pairOf('yellow', 'red', 2, 0)],
      hint: { col: 2, rot: 0 },
      solution: [
        { col: 2, rot: 0 },
        { col: 3, rot: 0 },
      ],
    },
    {
      poolId: 'd-three-limit',
      title: '每日：三連鎖限手',
      blurb: '三手內打出 3 連鎖。',
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
  ];

  function puzzleForDate(dateKey) {
    var key = typeof dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)
      ? dateKey
      : taipeiDateKey();
    var seed = hashString('puyo-puyo-daily:' + key);
    var entry = DAILY_POOL[seed % DAILY_POOL.length];
    return {
      id: 'daily-' + key,
      dateKey: key,
      poolId: entry.poolId,
      title: entry.title,
      blurb: entry.blurb + '（' + key + '・台北）',
      goalType: entry.goalType,
      clearColor: entry.clearColor,
      targetChain: entry.targetChain,
      moveLimit: entry.moveLimit,
      timeLimitSec: entry.timeLimitSec || 0,
      colorCount: entry.colorCount,
      lines: entry.lines.slice(),
      queue: entry.queue.map(function (p) {
        return { row: p.row, col: p.col, rot: p.rot, axis: p.axis, child: p.child };
      }),
      hint: entry.hint ? { col: entry.hint.col, rot: entry.hint.rot } : null,
      solution: entry.solution.map(function (s) {
        return { col: s.col, rot: s.rot };
      }),
    };
  }

  function todayPuzzle(now) {
    return puzzleForDate(taipeiDateKey(now));
  }

  /**
   * Consecutive clears ending today or yesterday (streak survives one open day).
   * @param {string[]} clearedDates YYYY-MM-DD
   */
  function computeStreak(clearedDates, today) {
    var days = {};
    (clearedDates || []).forEach(function (d) {
      if (typeof d === 'string') days[d] = true;
    });
    var cursor = days[today] ? today : previousTaipeiDay(today);
    if (!days[cursor]) return 0;
    var streak = 0;
    while (days[cursor]) {
      streak += 1;
      cursor = previousTaipeiDay(cursor);
    }
    return streak;
  }

  function buildShareText(input) {
    var date = input.dateKey || taipeiDateKey();
    var lines = ['魔法氣泡 每日謎題 ' + date];
    if (input.cleared) {
      var starLine =
        input.stars > 0
          ? ' · ' + '★'.repeat(input.stars) + '☆'.repeat(Math.max(0, 3 - input.stars))
          : '';
      lines.push(
        '✓ ' +
          (input.goalLabel || '過關') +
          ' · ' +
          (input.movesUsed || '?') +
          ' 手' +
          starLine
      );
    } else {
      lines.push('尚未通關 · 目標 ' + (input.goalLabel || '謎題'));
    }
    if (input.streak > 0) lines.push('連勝 ' + input.streak + ' 天');
    if (input.bestMoves) lines.push('今日最佳 ' + input.bestMoves + ' 手');
    return lines.join('\n');
  }

  function copyText(text) {
    try {
      if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
        return global.navigator.clipboard.writeText(text).then(
          function () {
            return true;
          },
          function () {
            return fallbackCopy(text);
          }
        );
      }
    } catch (err) {
      /* fall through */
    }
    return Promise.resolve(fallbackCopy(text));
  }

  function fallbackCopy(text) {
    try {
      var el = global.document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.left = '-9999px';
      global.document.body.appendChild(el);
      el.select();
      var ok = global.document.execCommand('copy');
      global.document.body.removeChild(el);
      return ok;
    } catch (err) {
      return false;
    }
  }

  global.PuyoDaily = {
    TZ_OFFSET_MS: TZ_OFFSET_MS,
    DAILY_POOL: DAILY_POOL,
    taipeiDateKey: taipeiDateKey,
    previousTaipeiDay: previousTaipeiDay,
    hashString: hashString,
    puzzleForDate: puzzleForDate,
    todayPuzzle: todayPuzzle,
    computeStreak: computeStreak,
    buildShareText: buildShareText,
    copyText: copyText,
  };
})(window);
