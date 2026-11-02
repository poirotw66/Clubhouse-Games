/**
 * Puyo Puyo tactical analyzer, chain simulator, and classic strategy blueprints.
 * Pure functions over boards and pairs, exposed as window.PuyoTactics.
 * Plain script without bundler requirement for static/file:// compatibility.
 */
(function (global) {
  'use strict';

  var L = global.PuyoLogic;

  /** Standard chain damage and nuisance puyo matrix for competitive play. */
  var CHAIN_DAMAGE_MATRIX = [
    {
      chain: 1,
      multiplier: 1,
      baseScore: 40,
      garbage: 0,
      title: '單消整地',
      desc: '單組 4 顆消除，通常不足 70 分，不送垃圾。適合微調整地，但須防誤爆連鎖引信。',
      badge: '整地',
      tacticalRole: '整地排障',
      threatClass: 'tier-1',
    },
    {
      chain: 2,
      multiplier: 8,
      baseScore: 640,
      garbage: 9,
      title: '速攻催促',
      desc: '送出約 9 顆垃圾（小×3、大×1）。能立即打亂對手佈局，或用於微量垃圾即時相殺。',
      badge: '催促',
      tacticalRole: '速攻相殺',
      threatClass: 'tier-2',
    },
    {
      chain: 3,
      multiplier: 16,
      baseScore: 1920,
      garbage: 27,
      title: '牽制反擊',
      desc: '送出約 27 顆垃圾（大×4、小×3）。接近半場垃圾量，足以抵銷對手一般小攻勢。',
      badge: '牽制',
      tacticalRole: '中度反擊',
      threatClass: 'tier-3',
    },
    {
      chain: 4,
      multiplier: 32,
      baseScore: 4480,
      garbage: 64,
      title: '重創打擊',
      desc: '送出約 64 顆垃圾（岩石×2、大×4）。超過整面場地容量（12×6=72格），極具壓迫。',
      badge: '重創',
      tacticalRole: '主力致勝',
      threatClass: 'tier-4',
    },
    {
      chain: 5,
      multiplier: 64,
      baseScore: 9600,
      garbage: 137,
      title: '致命絕殺',
      desc: '送出約 137 顆垃圾（岩石×4、大×2、小×5）。近兩面場地垃圾量，對戰主流必勝水嶺。',
      badge: '絕殺',
      tacticalRole: '致命絕殺',
      threatClass: 'tier-5',
    },
    {
      chain: 6,
      multiplier: 96,
      baseScore: 16320,
      garbage: 233,
      title: '滅頂風暴',
      desc: '送出約 233 顆垃圾（彗星/月級×1、岩石×1）。對手無完整連鎖防備時將直接被掩埋。',
      badge: '滅頂',
      tacticalRole: '滅頂制勝',
      threatClass: 'tier-6',
    },
    {
      chain: 7,
      multiplier: 128,
      baseScore: 24960,
      garbage: 356,
      title: '傳奇神技',
      desc: '送出 350+ 顆垃圾（彗星×1、岩石×5+）。電競大師級土台折返神技，勢不可擋。',
      badge: '傳奇',
      tacticalRole: '傳奇終結',
      threatClass: 'tier-7',
    },
  ];

  /** Classic architecture blueprints: Stairs, Sandwich, and GTR. */
  var CLASSIC_STRATEGIES = [
    {
      id: 'stairs',
      name: '階梯消',
      subtitle: '階段積み（Stairs）',
      tag: '基礎必修 ★☆☆',
      summary: '魔法氣泡最易入門、結構最穩固的骨牌型連鎖。',
      motto: '「三顆立柱、隔列放一、斜向引爆、逐級推進」',
      targetChains: '3 ～ 5 連鎖',
      keyRule: '每列直立堆放 3 顆同色氣泡，在相鄰列頂端擺放 1 顆相同顏色作為引爆下落珠。當第一列消除時，相鄰列頂部的氣泡落下填補，形成流暢的骨牌式連續爆炸。',
      steps: [
        '第 1 列豎直堆疊 3 顆紅色，第 2 列豎直堆疊 3 顆藍色，第 3 列豎直堆疊 3 顆綠色。',
        '在第 2 列頂端放 1 顆紅色（作為紅色的引爆下落珠），第 3 列頂端放 1 顆藍色。',
        '在第 1 列頂端投下第 4 顆紅色點火引爆，第 2 列的紅色隨即落下觸發藍色消除，連鎖自右向左奔流！',
      ],
      blueprint: [
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'blue',  'empty', 'empty', 'empty'],
        ['empty', 'red',   'green', 'empty', 'empty', 'empty'],
        ['red',   'blue',  'green', 'yellow','empty', 'empty'],
        ['red',   'blue',  'green', 'yellow','empty', 'empty'],
      ],
    },
    {
      id: 'sandwich',
      name: '夾消',
      subtitle: '挾み込み（Sandwich）',
      tag: '空間極致 ★★☆',
      summary: '高密度空間壓縮連鎖，橫向與縱向皆能靈活鋪設。',
      motto: '「上下同色夾異色、消除中層重力合體」',
      targetChains: '4 ～ 7 連鎖',
      keyRule: '將目標色的氣泡分別擺在夾心異色氣泡的上方與下方（例如下層 2 顆黃色，中層 4 顆紅色，上層 2 顆黃色）。當夾在中間的異色被消除後，上層的同色氣泡直接下墜與底層合體成 4 顆消除。',
      steps: [
        '底層鋪設 2 顆黃色氣泡。',
        '中層完整填入 4 顆紅色氣泡作為夾心消除層。',
        '在紅色夾心層頂部再擺放 2 顆黃色氣泡完成「三明治包夾」。',
        '一旦紅色消除，上層 2 顆黃色受重力直落底層合體為 4 顆，瞬間引發下一段連鎖！',
      ],
      blueprint: [
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['yellow','yellow','empty', 'empty', 'empty', 'empty'],
        ['red',   'red',   'red',   'red',   'empty', 'empty'],
        ['yellow','yellow','blue',  'blue',  'empty', 'empty'],
        ['green', 'green', 'green', 'green', 'empty', 'empty'],
      ],
    },
    {
      id: 'gtr',
      name: 'GTR 轉向構造',
      subtitle: 'Great Tanaka Rensa',
      tag: '電競王道 ★★★',
      summary: '現代魔法氣泡競技對戰勝率最高、必學的轉向折返型土台。',
      motto: '「左角轉向核心、突破高度天花板、二樓折返無極限」',
      targetChains: '6 ～ 12+ 連鎖',
      keyRule: '在場地左下角落（第 1 與第 2 列）建造 L 型轉向核，將底部橫向連鎖順暢引導折返至二樓上方。突破傳統階梯高度受限的致命缺點，是構築 10 連鎖以上大連鎖的必備基石。',
      steps: [
        '第 1 列由底向上放「藍-紅-紅」，第 2 列放「藍-藍-綠」，在角落構成堅固的 L 型轉向核心。',
        '第 3 至第 6 列鋪設穩固的階梯或夾消地基，作為一樓前段連鎖。',
        '當一樓右側連鎖串聯回左角時，L 型轉向核消除並帶動上方二樓氣泡崩塌，順利往右側折返點火！',
      ],
      blueprint: [
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['green', 'empty', 'empty', 'empty', 'empty', 'empty'],
        ['red',   'green', 'yellow','yellow','empty', 'empty'],
        ['red',   'blue',  'blue',  'yellow','empty', 'empty'],
        ['blue',  'blue',  'green', 'green', 'empty', 'empty'],
      ],
    },
  ];

  /** Return the damage matrix definitions. */
  function getChainDamageMatrix() {
    return CHAIN_DAMAGE_MATRIX;
  }

  /** Return the classic strategy blueprints. */
  function getClassicStrategies() {
    return CLASSIC_STRATEGIES;
  }

  /**
   * Determine minimum chain required to neutralize or counter incoming garbage.
   * Standard Puyo rate: 70 points = 1 nuisance puyo.
   */
  function counterChainNeeded(incomingGarbage) {
    var count = Math.max(0, Number(incomingGarbage) || 0);
    if (count <= 0) {
      return {
        requiredChain: 0,
        estimatedGarbage: 0,
        description: '場上安全 · 暫無待降垃圾威脅',
        status: 'safe',
      };
    }

    for (var i = 0; i < CHAIN_DAMAGE_MATRIX.length; i += 1) {
      var item = CHAIN_DAMAGE_MATRIX[i];
      if (item.garbage >= count) {
        var surplus = item.garbage - count;
        return {
          requiredChain: item.chain,
          estimatedGarbage: item.garbage,
          surplus: surplus,
          description: '需 ' + item.chain + ' 連鎖相殺（預估送出 ' + item.garbage + ' 顆，淨勝 +' + surplus + '）',
          status: item.chain <= 2 ? 'warning' : 'danger',
        };
      }
    }

    return {
      requiredChain: 7,
      estimatedGarbage: 356,
      surplus: Math.max(0, 356 - count),
      description: '極度危急！需 7+ 連鎖巨型反擊才能逆轉勝局',
      status: 'critical',
    };
  }

  /**
   * Count colors on the board and locate near-trigger fuse clusters (3 puyos connected with an open cell).
   */
  function analyzeBoardColors(board, colorCount) {
    var cols = (board && board[0] && board[0].length) || 6;
    var rows = (board && board.length) || 13;
    var counts = {
      red: 0,
      green: 0,
      blue: 0,
      yellow: 0,
      purple: 0,
      garbage: 0,
    };
    var totalSettled = 0;

    for (var r = 1; r < rows; r += 1) {
      for (var c = 0; c < cols; c += 1) {
        var val = board[r][c];
        if (val && counts[val] !== undefined) {
          counts[val] += 1;
          totalSettled += 1;
        }
      }
    }

    var percentages = {};
    Object.keys(counts).forEach(function (color) {
      percentages[color] = totalSettled > 0 ? Math.round((counts[color] / totalSettled) * 100) : 0;
    });

    // Detect 3-clusters that have an empty adjacent cell (point of ignition / fuse)
    var seen = [];
    for (var i = 0; i < rows; i += 1) seen.push(new Array(cols).fill(false));
    var fuses = [];

    for (var row = 1; row < rows; row += 1) {
      for (var col = 0; col < cols; col += 1) {
        var color = board[row][col];
        if (!color || color === 'garbage' || seen[row][col]) continue;

        var cluster = [];
        var stack = [{ r: row, c: col }];
        seen[row][col] = true;

        while (stack.length > 0) {
          var curr = stack.pop();
          cluster.push(curr);
          var neighbors = [
            { r: curr.r - 1, c: curr.c },
            { r: curr.r + 1, c: curr.c },
            { r: curr.r, c: curr.c - 1 },
            { r: curr.r, c: curr.c + 1 },
          ];
          for (var j = 0; j < neighbors.length; j += 1) {
            var n = neighbors[j];
            if (n.r < 1 || n.r >= rows || n.c < 0 || n.c >= cols) continue;
            if (seen[n.r][n.c] || board[n.r][n.c] !== color) continue;
            seen[n.r][n.c] = true;
            stack.push(n);
          }
        }

        if (cluster.length === 3) {
          var hasAir = false;
          for (var k = 0; k < cluster.length && !hasAir; k += 1) {
            var cand = [
              { r: cluster[k].r - 1, c: cluster[k].c },
              { r: cluster[k].r + 1, c: cluster[k].c },
              { r: cluster[k].r, c: cluster[k].c - 1 },
              { r: cluster[k].r, c: cluster[k].c + 1 },
            ];
            for (var m = 0; m < cand.length; m += 1) {
              var a = cand[m];
              if (a.r >= 1 && a.r < rows && a.c >= 0 && a.c < cols && board[a.r][a.c] === null) {
                hasAir = true;
                break;
              }
            }
          }
          if (hasAir) {
            fuses.push({
              color: color,
              size: 3,
              head: cluster[0],
            });
          }
        }
      }
    }

    return {
      counts: counts,
      totalSettled: totalSettled,
      percentages: percentages,
      fuses: fuses,
    };
  }

  /**
   * Evaluate outcome if the active pair is dropped at its current position & rotation.
   */
  function evaluateCurrentDrop(board, pair) {
    if (!board || !pair) return null;
    var logic = global.PuyoLogic;
    if (!logic) return null;

    var landed = logic.dropPair(board, pair);
    var sim = logic.simulateLock(board, landed, 70);

    return {
      landing: landed,
      chain: sim.chain,
      score: sim.score,
      attack: sim.attack,
      cleared: sim.cleared,
      setup: sim.setup,
    };
  }

  /**
   * Search all possible placements of the current pair to identify:
   * 1. Max chain possible right now.
   * 2. Best structural setup placement if no immediate chain.
   */
  function findOptimalPlacement(board, pair) {
    if (!board || !pair) return null;
    var logic = global.PuyoLogic;
    if (!logic) return null;

    var placements = logic.enumeratePlacements(board, pair);
    if (!placements || placements.length === 0) return null;

    var bestChainPlacement = null;
    var maxChain = 0;
    var bestChainScore = 0;
    var bestSetupPlacement = null;
    var maxSetupScore = -1;

    for (var i = 0; i < placements.length; i += 1) {
      var p = placements[i];
      var sim = logic.simulateLock(board, p, 70);

      if (sim.chain > maxChain || (sim.chain === maxChain && sim.score > bestChainScore)) {
        maxChain = sim.chain;
        bestChainScore = sim.score;
        bestChainPlacement = p;
      }

      // If this placement does not trigger an accidental 1-chain pop, evaluate its setup potential
      if (sim.chain === 0) {
        var score = sim.setup - logic.heightVariance(sim.board) * 0.5;
        if (score > maxSetupScore) {
          maxSetupScore = score;
          bestSetupPlacement = p;
        }
      }
    }

    if (!bestSetupPlacement && placements.length > 0) {
      bestSetupPlacement = placements[0];
    }

    return {
      maxChain: maxChain,
      bestChainPlacement: bestChainPlacement,
      bestChainScore: bestChainScore,
      bestSetupPlacement: bestSetupPlacement,
      maxSetupScore: maxSetupScore,
    };
  }

  global.PuyoTactics = {
    getChainDamageMatrix: getChainDamageMatrix,
    getClassicStrategies: getClassicStrategies,
    counterChainNeeded: counterChainNeeded,
    analyzeBoardColors: analyzeBoardColors,
    evaluateCurrentDrop: evaluateCurrentDrop,
    findOptimalPlacement: findOptimalPlacement,
  };
})(typeof window !== 'undefined' ? window : global);
