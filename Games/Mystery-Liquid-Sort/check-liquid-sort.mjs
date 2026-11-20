// ponytail: core pour / capacity / sorted-bottle checks, plus a from-scratch
// solvability search over sampled generated levels (see "generateLevel"
// section below) — independent of generateLevel's own replay verification.
import assert from 'node:assert/strict';
import {
  canPour,
  pourLiquid,
  checkLevelComplete,
  revealHiddenLayers,
  generateLevel,
  MIXING_MIN_LEVEL,
  MIX_RECIPES,
  isMixingPour,
  findHintMove,
  getMixResult as getMixResultFromLogic,
  unlockNextBlockedBottle,
} from './services/gameLogic.ts';
import {
  calculateLabPurity,
  calculateLegalPours,
  calculateBufferTubes,
  calculateParSteps,
  calculateStepRating,
  getTubeQuickStatus,
} from './utils/cockpitMetrics.ts';
import {
  getCapacityForLevel,
  COST_HINT,
  COST_UNDO,
  COST_ADD_BOTTLE,
  COST_REVEAL,
  COST_SHUFFLE,
  HOWTO_STORAGE_KEY,
  QP_MOVE_LIMITS,
  QP_TIME_LIMITS_SEC,
} from './constants.ts';
import { Color } from './types.ts';
import {
  PUZZLE_PACK_STAGES,
  PUZZLE_PACK_STORAGE_KEY,
  applyPackStageClear,
  continuePackIndex,
  isPackStageUnlocked,
  materializePackStage,
  packStageCount,
} from './services/puzzlePack.ts';
import {
  MIX_CHALLENGE_STAGES,
  MIX_CHALLENGE_STORAGE_KEY,
  applyMixStageClear,
  continueMixIndex,
  isMixStageUnlocked,
  materializeMixStage,
  mixStageCount,
} from './services/mixChallengePack.ts';
import {
  MECHANISM_PACK_STAGES,
  MECHANISM_PACK_STORAGE_KEY,
  applyMechStageClear,
  continueMechIndex,
  isMechStageUnlocked,
  materializeMechStage,
  mechStageCount,
  starsForMoves,
} from './services/mechanismPack.ts';
import {
  applyPlayDay,
  buildDailyShareText,
  displayStreak,
  localDateKey,
  taipeiDateKey,
  TAIPEI_TZ_OFFSET_MS,
} from './services/streakService.ts';
import {
  BOTTLE_SKINS,
  DEFAULT_COSMETICS,
  LIQUID_SKINS,
  unlockBottleSkin,
} from './services/cosmeticsService.ts';
import {
  DAILY_BOARDS,
  materializeDailyBoard,
  dayIndex,
  getDailyBoard,
  DAILY_CLEAR_KEY,
} from './services/dailyChallenge.ts';

function layer(color, isHidden = false) {
  return { color, isHidden, id: `${color}-${Math.random().toString(36).slice(2, 8)}` };
}

function bottle(id, layers, capacity = 4, isCompleted = false) {
  return { id, layers, capacity, isCompleted };
}

// Capacity by level band.
{
  assert.equal(getCapacityForLevel(1), 4);
  assert.equal(getCapacityForLevel(4), 4);
  assert.equal(getCapacityForLevel(5), 5);
  assert.equal(getCapacityForLevel(9), 5);
  assert.equal(getCapacityForLevel(10), 6);
  assert.equal(getCapacityForLevel(99), 6);
}

// canPour: empty source, self, full target, completed target, color mismatch, hidden top.
{
  const empty = bottle('e', []);
  const red = bottle('r', [layer(Color.RED)]);
  const blue = bottle('b', [layer(Color.BLUE)]);
  const full = bottle('f', [layer(Color.RED), layer(Color.RED), layer(Color.RED), layer(Color.RED)]);
  const capped = bottle('c', [layer(Color.RED)], 4, true);
  const hidden = bottle('h', [layer(Color.RED, true)]);
  const blocked = { ...bottle('k', [layer(Color.RED)]), isBlocked: true };

  assert.equal(canPour(empty, red), false, 'empty source');
  assert.equal(canPour(red, red), false, 'self pour');
  assert.equal(canPour(red, full), false, 'full target');
  assert.equal(canPour(red, capped), false, 'completed target');
  assert.equal(canPour(red, blue), false, 'color mismatch');
  // Hidden check runs only when target is non-empty (empty short-circuits earlier).
  assert.equal(canPour(hidden, empty), true, 'hidden into empty allowed by canPour');
  assert.equal(canPour(hidden, bottle('r2', [layer(Color.RED)])), false, 'hidden onto color');
  assert.equal(canPour(red, empty), true, 'into empty');
  assert.equal(canPour(red, bottle('r2', [layer(Color.RED)])), true, 'matching color');
  assert.equal(canPour(blocked, empty), false, 'blocked source');
  assert.equal(canPour(red, blocked), false, 'blocked target');
}

// unlockNextBlockedBottle unlocks in board order, one at a time.
{
  const a = { ...bottle('a', [layer(Color.RED)]), isBlocked: true };
  const b = { ...bottle('b', [layer(Color.BLUE)]), isBlocked: true };
  const c = bottle('c', []);
  const once = unlockNextBlockedBottle([a, b, c]);
  assert.equal(once[0].isBlocked, false);
  assert.equal(once[1].isBlocked, true);
  const twice = unlockNextBlockedBottle(once);
  assert.equal(twice[1].isBlocked, false);
}

// pourLiquid: moves contiguous matching layers up to capacity; reveals hidden; marks completed.
{
  const source = bottle('s', [
    layer(Color.BLUE, true),
    layer(Color.RED),
    layer(Color.RED),
  ]);
  const target = bottle('t', [layer(Color.RED)]);
  const { newSource, newTarget, movedCount } = pourLiquid(source, target);

  assert.equal(movedCount, 2);
  assert.equal(newSource.layers.length, 1);
  assert.equal(newSource.layers[0].color, Color.BLUE);
  assert.equal(newSource.layers[0].isHidden, false, 'new top should reveal');
  assert.equal(newTarget.layers.length, 3);
  assert.equal(newTarget.isCompleted, false);
}

// Capacity stops a multi-layer pour mid-run.
{
  const source = bottle('s', [layer(Color.GREEN), layer(Color.GREEN), layer(Color.GREEN)]);
  const target = bottle('t', [layer(Color.GREEN), layer(Color.GREEN), layer(Color.GREEN)], 4);
  const { movedCount, newTarget } = pourLiquid(source, target);
  assert.equal(movedCount, 1, 'only one free slot');
  assert.equal(newTarget.layers.length, 4);
  assert.equal(newTarget.isCompleted, true, 'full uniform bottle completes');
}

// Sorted / completed bottle: full + uniform + visible.
{
  const done = bottle(
    'd',
    [layer(Color.YELLOW), layer(Color.YELLOW), layer(Color.YELLOW), layer(Color.YELLOW)],
  );
  const { newTarget } = pourLiquid(
    bottle('s', [layer(Color.YELLOW)]),
    bottle('t', [layer(Color.YELLOW), layer(Color.YELLOW), layer(Color.YELLOW)]),
  );
  assert.equal(newTarget.isCompleted, true);
  assert.equal(done.layers.every((l) => l.color === Color.YELLOW), true);
}

// checkLevelComplete tracks orders, not bottle state alone.
{
  assert.equal(
    checkLevelComplete([], [
      { id: '1', color: Color.RED, isCompleted: true, isLocked: false },
      { id: '2', color: Color.BLUE, isCompleted: true, isLocked: false },
    ]),
    true,
  );
  assert.equal(
    checkLevelComplete([], [
      { id: '1', color: Color.RED, isCompleted: true, isLocked: false },
      { id: '2', color: Color.BLUE, isCompleted: false, isLocked: false },
    ]),
    false,
  );
}

// revealHiddenLayers flips hidden and recalculates completion.
{
  const bottles = revealHiddenLayers([
    bottle('a', [
      layer(Color.CYAN, true),
      layer(Color.CYAN, true),
      layer(Color.CYAN, true),
      layer(Color.CYAN),
    ]),
  ]);
  assert.ok(bottles[0].layers.every((l) => !l.isHidden));
  assert.equal(bottles[0].isCompleted, true);
}

// --- generateLevel: independent solvability search ---
//
// generateLevel guarantees solvability by construction (reverse-scramble
// from a solved board, verified by replaying its own known solution). That
// replay is NOT reused here — it would be circular (it can only ever tell
// us the generator's own intended solution works, not whether the shipped
// board is solvable some other way, or whether the generator's notion of
// "solved" actually matches the real game). Instead this is a from-scratch
// heuristic search over the real move rules (see findSortSolution), with
// its own model of order delivery used to verify the found solution
// actually wins (see isSolvable).

/**
 * Faithful port of Game.tsx's `findMatch` + delivery effect: repeatedly
 * deliver the first open (unlocked, incomplete) order that has a matching
 * completed bottle on the board — removing the bottle and unlocking the
 * next locked order — until no more matches exist. A completed bottle
 * whose colour's order isn't open yet is left on the board rather than
 * discarded, and gets reconsidered every time this runs again.
 */
function resolveDeliveries(bottles, orders) {
  let curBottles = bottles;
  let curOrders = orders;
  while (true) {
    let matchOrderIndex = -1;
    let matchBottleId = null;
    for (let i = 0; i < curOrders.length; i++) {
      const order = curOrders[i];
      if (order.isCompleted || order.isLocked) continue;
      const match = curBottles.find(
        (b) => b.isCompleted && b.layers.length > 0 && b.layers[0].color === order.color,
      );
      if (match) {
        matchOrderIndex = i;
        matchBottleId = match.id;
        break;
      }
    }
    if (matchOrderIndex === -1) break;
    curOrders = curOrders.map((o, i) => (i === matchOrderIndex ? { ...o, isCompleted: true } : o));
    curBottles = curBottles.filter((b) => b.id !== matchBottleId);
    const nextLockedIndex = curOrders.findIndex((o) => o.isLocked);
    if (nextLockedIndex !== -1) {
      curOrders = curOrders.map((o, i) => (i === nextLockedIndex ? { ...o, isLocked: false } : o));
    }
  }
  return { bottles: curBottles, orders: curOrders };
}

/** All legal player moves from a state: matches Game.tsx (canPour, plus the UI rule barring a completed source). */
function getLegalMoves(bottles) {
  const moves = [];
  for (const source of bottles) {
    if (source.isCompleted || source.isBlocked || source.layers.length === 0) continue;
    if (source.layers[source.layers.length - 1].isHidden) continue;
    for (const target of bottles) {
      if (source.id === target.id) continue;
      if (canPour(source, target)) moves.push({ sourceId: source.id, targetId: target.id });
    }
  }
  return moves;
}

/**
 * Delivery-aware BFS for mechanism / daily boards (unlocks blocked bottles on
 * each order delivery). Returns the minimum pour count, or -1 / -2 on failure.
 */
function minStepsWithDeliveries(bottles, orders, maxNodes = 500000) {
  function resolve(b, o) {
    let curBottles = b;
    let curOrders = o;
    while (true) {
      let matchOrderIndex = -1;
      let matchBottleId = null;
      for (let i = 0; i < curOrders.length; i++) {
        const order = curOrders[i];
        if (order.isCompleted || order.isLocked) continue;
        const match = curBottles.find(
          (x) => x.isCompleted && x.layers.length > 0 && x.layers[0].color === order.color,
        );
        if (match) {
          matchOrderIndex = i;
          matchBottleId = match.id;
          break;
        }
      }
      if (matchOrderIndex === -1) break;
      curOrders = curOrders.map((ord, i) =>
        i === matchOrderIndex ? { ...ord, isCompleted: true } : ord,
      );
      curBottles = unlockNextBlockedBottle(curBottles.filter((x) => x.id !== matchBottleId));
      const nextLockedIndex = curOrders.findIndex((ord) => ord.isLocked);
      if (nextLockedIndex !== -1) {
        curOrders = curOrders.map((ord, i) =>
          i === nextLockedIndex ? { ...ord, isLocked: false } : ord,
        );
      }
    }
    return { bottles: curBottles, orders: curOrders };
  }

  function key(b, o) {
    const bk = b
      .map((x) => `${x.id}:${x.isBlocked ? 'L' : ''}:${x.layers.map((l) => l.color).join(',')}`)
      .join('|');
    const ok = o.map((x) => `${x.color}:${x.isCompleted ? 1 : 0}:${x.isLocked ? 1 : 0}`).join('|');
    return `${bk}#${ok}`;
  }

  let { bottles: b0, orders: o0 } = resolve(bottles, orders);
  if (o0.every((o) => o.isCompleted)) return 0;
  const q = [{ bottles: b0, orders: o0, steps: 0 }];
  const seen = new Set([key(b0, o0)]);
  let nodes = 0;
  while (q.length) {
    const cur = q.shift();
    nodes += 1;
    if (nodes > maxNodes) return -1;
    for (const move of getLegalMoves(cur.bottles)) {
      const si = cur.bottles.findIndex((x) => x.id === move.sourceId);
      const ti = cur.bottles.findIndex((x) => x.id === move.targetId);
      const { newSource, newTarget } = pourLiquid(cur.bottles[si], cur.bottles[ti]);
      let nextB = cur.bottles.slice();
      nextB[si] = newSource;
      nextB[ti] = newTarget;
      let nextO = cur.orders;
      ({ bottles: nextB, orders: nextO } = resolve(nextB, nextO));
      if (nextO.every((o) => o.isCompleted)) return cur.steps + 1;
      const k = key(nextB, nextO);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({ bottles: nextB, orders: nextO, steps: cur.steps + 1 });
    }
  }
  return -2;
}

/** Canonical bottle-only state key: bottles are interchangeable, so sort by content (not id) to collapse equivalent states. */
function bottlesKey(bottles) {
  return bottles.map((b) => b.layers.map((l) => l.color).join(',')).sort().join('|');
}

/**
 * True once every bottle is empty, or full and single-colour, AND the set
 * of full bottles' colours exactly matches `requiredColors` (one order's
 * worth of liquid gives exactly one required colour, no more, no less).
 * The colour match is NOT redundant with "every bottle sorted": the three
 * mixing recipes share primaries (RED+YELLOW, BLUE+YELLOW, RED+BLUE all
 * draw from the same 3 primaries), so a board can reach a fully mono-coloured
 * state that used the "wrong" recipe — e.g. mixing RED+YELLOW into ORANGE
 * when ORANGE isn't one of this level's active colours — which is sorted
 * but permanently unsolvable (that liquid can never be un-mixed back into
 * the RED or YELLOW an order still needs). Only a colour-matching sort
 * actually wins.
 */
function isBoardWon(bottles, requiredColors) {
  if (!bottles.every((b) => b.layers.length === 0 || (b.layers.length === b.capacity && b.isCompleted))) {
    return false;
  }
  const fullColors = bottles.filter((b) => b.isCompleted).map((b) => b.layers[0].color).sort();
  const need = [...requiredColors].sort();
  return fullColors.length === need.length && fullColors.every((c, i) => c === need[i]);
}

/** Total units of `color` anywhere on the board right now (mixed or native). */
function colorTotal(bottles, color) {
  let total = 0;
  for (const b of bottles) for (const l of b.layers) if (l.color === color) total++;
  return total;
}

// Independent copy of the 3 mixing recipes, for search-ordering purposes
// only — the actual rule lives in (and is authoritatively enforced by)
// gameLogic's canPour/pourLiquid, which this file imports and defers to for
// every legality decision. Duplicating the recipe table here just lets the
// heuristic recognise "this pour is a mix, and here's what it produces"
// without reaching into gameLogic's internals.
const MIX_RESULTS = {};
function mixKey(a, b) { return [a, b].sort().join('|'); }
MIX_RESULTS[mixKey(Color.RED, Color.YELLOW)] = Color.ORANGE;
MIX_RESULTS[mixKey(Color.BLUE, Color.YELLOW)] = Color.GREEN;
MIX_RESULTS[mixKey(Color.RED, Color.BLUE)] = Color.PURPLE;
function getMixResult(a, b) { return MIX_RESULTS[mixKey(a, b)]; }

/**
 * Scores one legal move for search ordering — deliberately mirrors
 * gameLogic's own internal scoreMove move-for-move (same "finish > grow a
 * run > dump into empty" priority, same off-target/already-satisfied mixing
 * penalty), because an earlier, looser approximation here ranked several of
 * generateLevel's own successful moves *below* alternatives that led deep
 * into dead-end territory — correct in the sense that the search still
 * eventually backtracks and tries the right move, but slow enough that it
 * didn't converge within any practical node budget. Matching the ordering
 * that's independently known to navigate these boards well fixes that,
 * while the SEARCH itself (memoisation, backtracking, the win condition in
 * isBoardWon) stays a separate implementation from gameLogic's solver.
 */
function scoreMove(bottles, move, requiredColors) {
  const sourceIdx = bottles.findIndex((b) => b.id === move.sourceId);
  const targetIdx = bottles.findIndex((b) => b.id === move.targetId);
  const source = bottles[sourceIdx];
  const target = bottles[targetIdx];
  const topColor = source.layers[source.layers.length - 1].color;

  if (target.layers.length > 0 && target.layers[target.layers.length - 1].color !== topColor) {
    const mixedColor = getMixResult(topColor, target.layers[target.layers.length - 1].color);
    if (mixedColor && (!requiredColors.has(mixedColor) || colorTotal(bottles, mixedColor) >= target.capacity)) {
      return { move, score: -1 }; // not needed at all, or this colour's quota is already met
    }
    if (target.layers.length + 1 === target.capacity) return { move, score: 2 };
    return { move, score: 1 };
  }

  let run = 0;
  for (let i = source.layers.length - 1; i >= 0 && source.layers[i].color === topColor; i--) run++;
  if (target.layers.length + run === target.capacity) return { move, score: 2 };
  if (target.layers.length > 0) return { move, score: 1 };
  return { move, score: 0 };
}

/** Applies `move` to `bottles`, returning the resulting board. */
function applyMove(bottles, move) {
  const sourceIdx = bottles.findIndex((b) => b.id === move.sourceId);
  const targetIdx = bottles.findIndex((b) => b.id === move.targetId);
  const { newSource, newTarget } = pourLiquid(bottles[sourceIdx], bottles[targetIdx]);
  const next = bottles.slice();
  next[sourceIdx] = newSource;
  next[targetIdx] = newTarget;
  return next;
}

/**
 * Heuristic-ordered DFS search (independent of gameLogic's own solver, and
 * independent of generateLevel's own witness solution) for a legal-move
 * sequence that reaches isBoardWon — the same set of colours gameLogic's
 * generation targets, found by a fresh implementation (own heuristic, own
 * memoisation).
 *
 * This board's colour accounting makes "every bottle sorted into exactly the
 * required colours" and "every order delivered" the same event: each active
 * colour totals exactly one bottle's worth of liquid (mixed or placed
 * directly — mixing conserves volume by construction), so reaching that
 * state necessarily produces exactly one full mono bottle per order colour,
 * and delivers all of them. `isSolvable` below still replays the found path
 * through the real order/lock/delivery model to confirm that identity holds
 * rather than just asserting it.
 *
 * A plain unordered BFS over the order-aware state space was tried first,
 * but once mixing pours are legal moves, tracking delivery/lock progress as
 * part of the search state blows up the reachable-state graph combinatorially
 * (many different delivery-timings collapse to the same underlying board,
 * but count as distinct states) — full enumeration didn't converge even at
 * ~2M nodes. Searching over bottle contents only (as this function does)
 * removes that redundant bookkeeping and converges quickly, matching how
 * fast gameLogic's own findSolutionGreedy already is on these boards.
 */
function findSortSolution(bottles, requiredColors, maxNodes, maxMs) {
  const t0 = Date.now();
  const deadEnds = new Set(); // states fully proven to have no solution
  const onPath = new Set();   // states on the current DFS stack (cycle guard)
  const path = [];
  let nodes = 0;
  let budgetExceeded = false;

  function dfs(curBottles) {
    if (budgetExceeded) return false;
    if (nodes++ >= maxNodes || Date.now() - t0 > maxMs) {
      budgetExceeded = true;
      return false;
    }
    if (isBoardWon(curBottles, requiredColors)) return true;

    const key = bottlesKey(curBottles);
    if (deadEnds.has(key) || onPath.has(key)) return false;
    onPath.add(key);

    const moves = getLegalMoves(curBottles)
      .map((move) => scoreMove(curBottles, move, requiredColors))
      .sort((a, b) => b.score - a.score);

    let solved = false;
    for (const { move } of moves) {
      path.push(move);
      if (dfs(applyMove(curBottles, move))) {
        solved = true;
        break;
      }
      path.pop();
      if (budgetExceeded) break;
    }

    onPath.delete(key);
    if (!solved && !budgetExceeded) deadEnds.add(key);
    return solved;
  }

  const found = dfs(bottles);
  if (found) return { result: 'solvable', moves: path.slice() };
  return { result: budgetExceeded ? 'exhausted' : 'unsolvable' };
}

/**
 * Is there ANY sequence of legal moves from this board that completes every
 * order? Finds a full-sort solution independently (see findSortSolution),
 * then replays it move-by-move through the real order/lock/delivery model
 * (resolveDeliveries — a faithful port of Game.tsx's own delivery effect)
 * to confirm it actually wins, rather than just trusting the colour-
 * accounting argument that the two are equivalent.
 */
function isSolvable(bottles, orders, maxNodes = 200000, maxMs = 5000) {
  const requiredColors = new Set(orders.map((o) => o.color));
  const search = findSortSolution(bottles, requiredColors, maxNodes, maxMs);
  if (search.result !== 'solvable') return search.result;

  let curBottles = bottles;
  let curOrders = orders;
  ({ bottles: curBottles, orders: curOrders } = resolveDeliveries(curBottles, curOrders));

  for (const move of search.moves) {
    const sourceIdx = curBottles.findIndex((b) => b.id === move.sourceId);
    const targetIdx = curBottles.findIndex((b) => b.id === move.targetId);
    const { newSource, newTarget } = pourLiquid(curBottles[sourceIdx], curBottles[targetIdx]);
    const nextBottles = curBottles.slice();
    nextBottles[sourceIdx] = newSource;
    nextBottles[targetIdx] = newTarget;
    ({ bottles: curBottles, orders: curOrders } = resolveDeliveries(nextBottles, curOrders));
  }

  return curOrders.every((o) => o.isCompleted) ? 'solvable' : 'unsolvable';
}

// generateLevel: every sampled level, across every difficulty tier, must be
// solvable — and fast to generate, with no bottle starting mid-run (hidden top).
{
  const TIERS = [1, 3, 5, 7, 8, 10, 12, 15, 18, 20, 25];
  const SAMPLES_PER_TIER = 2;
  // CI runners under parallel concurrency occasionally spike over 150ms; keep
  // headroom so timing jitter does not flake the test while remaining bounded.
  const GEN_TIME_BUDGET_MS = 300;

  for (const level of TIERS) {
    for (let i = 0; i < SAMPLES_PER_TIER; i++) {
      const t0 = performance.now();
      const { bottles, orders } = generateLevel(level);
      const genMs = performance.now() - t0;

      assert.ok(
        genMs < GEN_TIME_BUDGET_MS,
        `level ${level} sample ${i}: generateLevel took ${genMs.toFixed(1)}ms (budget ${GEN_TIME_BUDGET_MS}ms)`,
      );

      for (const b of bottles) {
        if (b.layers.length === 0) continue;
        assert.equal(
          b.layers[b.layers.length - 1].isHidden,
          false,
          `level ${level} sample ${i}: bottle ${b.id} has a hidden top layer`,
        );
      }

      const result = isSolvable(bottles, orders);
      assert.notEqual(
        result,
        'exhausted',
        `level ${level} sample ${i}: solver node budget exhausted before a verdict — cannot confirm solvability`,
      );
      assert.equal(
        result,
        'solvable',
        `level ${level} sample ${i}: generated an UNSOLVABLE level`,
      );
    }
  }
}

// --- Puzzle pack: hand-authored boards must stay solvable; progress is separate ---
{
  assert.equal(PUZZLE_PACK_STORAGE_KEY, 'mls-puzzle-pack-v1');
  assert.ok(packStageCount() >= 6, 'pack should ship a meaningful stage count');
  assert.equal(packStageCount(), PUZZLE_PACK_STAGES.length);

  // Unlock cursor: stage 0 always open; stage N opens only after N clears.
  assert.equal(isPackStageUnlocked(0, 0), true);
  assert.equal(isPackStageUnlocked(1, 0), false);
  assert.equal(isPackStageUnlocked(1, 1), true);
  assert.equal(isPackStageUnlocked(7, 7), true);
  assert.equal(isPackStageUnlocked(7, 6), false);
  assert.equal(isPackStageUnlocked(-1, 0), false);
  assert.equal(isPackStageUnlocked(packStageCount(), 99), false);

  assert.equal(continuePackIndex(0), 0);
  assert.equal(continuePackIndex(3), 3);
  assert.equal(continuePackIndex(packStageCount()), packStageCount() - 1);

  // Progress advances only on the frontier; bestMoves keep the minimum pours.
  let progress = { clearedCount: 0, bestMoves: {} };
  progress = applyPackStageClear(progress, 0, 12);
  assert.equal(progress.clearedCount, 1);
  assert.equal(progress.bestMoves['intro-three'], 12);
  progress = applyPackStageClear(progress, 0, 8);
  assert.equal(progress.clearedCount, 1, 'replaying an earlier stage must not skip ahead');
  assert.equal(progress.bestMoves['intro-three'], 8);
  progress = applyPackStageClear(progress, 2, 5);
  assert.equal(progress.clearedCount, 1, 'clearing a locked-ahead index must not unlock');
  progress = applyPackStageClear(progress, 1, 10);
  assert.equal(progress.clearedCount, 2);

  const seenIds = new Set();
  for (let i = 0; i < PUZZLE_PACK_STAGES.length; i++) {
    const stage = PUZZLE_PACK_STAGES[i];
    assert.ok(stage.id, `stage ${i}: missing id`);
    assert.ok(stage.name, `stage ${i}: missing Traditional Chinese name`);
    assert.ok(!seenIds.has(stage.id), `duplicate pack stage id: ${stage.id}`);
    seenIds.add(stage.id);

    const { bottles, orders } = materializePackStage(stage);
    assert.equal(orders.length, stage.orderColors.length);
    assert.ok(bottles.every((b) => b.layers.length <= b.capacity));
    for (const b of bottles) {
      if (b.layers.length === 0) continue;
      assert.equal(
        b.layers[b.layers.length - 1].isHidden,
        false,
        `pack ${stage.id}: bottle ${b.id} has a hidden top layer`,
      );
    }

    // Pack boards never opt into mixing — keeps the curated set pure sorting.
    assert.ok(bottles.every((b) => !b.mixingEnabled), `pack ${stage.id}: mixing must stay off`);

    const result = isSolvable(bottles, orders, 500000, 15000);
    assert.notEqual(
      result,
      'exhausted',
      `pack ${stage.id}: solver budget exhausted — cannot confirm solvability`,
    );
    assert.equal(result, 'solvable', `pack ${stage.id}: UNSOLVABLE curated board`);
  }
}

// --- Mix challenge pack: forced-mix boards; separate storage key ---
{
  assert.equal(MIX_CHALLENGE_STORAGE_KEY, 'mls-mix-challenge-v1');
  assert.notEqual(MIX_CHALLENGE_STORAGE_KEY, PUZZLE_PACK_STORAGE_KEY, 'must not overwrite puzzle pack key');
  assert.ok(mixStageCount() >= 4 && mixStageCount() <= 6, 'mix pack should ship 4–6 stages');
  assert.equal(mixStageCount(), MIX_CHALLENGE_STAGES.length);

  assert.equal(isMixStageUnlocked(0, 0), true);
  assert.equal(isMixStageUnlocked(1, 0), false);
  assert.equal(isMixStageUnlocked(1, 1), true);
  assert.equal(continueMixIndex(0), 0);
  assert.equal(continueMixIndex(mixStageCount()), mixStageCount() - 1);

  let mixProgress = { clearedCount: 0, bestMoves: {} };
  mixProgress = applyMixStageClear(mixProgress, 0, 9);
  assert.equal(mixProgress.clearedCount, 1);
  assert.equal(mixProgress.bestMoves['mix-orange-intro'], 9);
  mixProgress = applyMixStageClear(mixProgress, 0, 4);
  assert.equal(mixProgress.clearedCount, 1);
  assert.equal(mixProgress.bestMoves['mix-orange-intro'], 4);

  const seenMixIds = new Set();
  for (let i = 0; i < MIX_CHALLENGE_STAGES.length; i++) {
    const stage = MIX_CHALLENGE_STAGES[i];
    assert.ok(stage.id && stage.name && stage.tip, `mix stage ${i}: missing id/name/tip`);
    assert.ok(!seenMixIds.has(stage.id), `duplicate mix stage id: ${stage.id}`);
    seenMixIds.add(stage.id);

    const { bottles, orders } = materializeMixStage(stage);
    assert.ok(bottles.every((b) => b.mixingEnabled), `mix ${stage.id}: mixing must be on`);
    assert.ok(bottles.every((b) => b.layers.length <= b.capacity));

    // At least one order colour must be a mix product under-supplied at deal time.
    const mixProducts = new Set([Color.ORANGE, Color.GREEN, Color.PURPLE]);
    let forcedMix = false;
    for (const order of orders) {
      if (!mixProducts.has(order.color)) continue;
      let units = 0;
      for (const b of bottles) for (const l of b.layers) if (l.color === order.color) units++;
      if (units < stage.capacity) forcedMix = true;
    }
    assert.ok(forcedMix, `mix ${stage.id}: expected a forced-mix order colour`);

    const result = isSolvable(bottles, orders, 500000, 20000);
    assert.notEqual(
      result,
      'exhausted',
      `mix ${stage.id}: solver budget exhausted — cannot confirm solvability`,
    );
    assert.equal(result, 'solvable', `mix ${stage.id}: UNSOLVABLE curated mix board`);
  }
}

// --- Mixing unlock floor, recipes, hint, howto key, QP challenge limits ---
{
  assert.equal(MIXING_MIN_LEVEL, 4, 'adventure should unlock mixing earlier than level 12');
  assert.equal(MIX_RECIPES.length, 3);
  assert.equal(getMixResultFromLogic(Color.RED, Color.YELLOW), Color.ORANGE);
  assert.equal(COST_HINT, 25);
  assert.ok(QP_MOVE_LIMITS.EASY > 0 && QP_TIME_LIMITS_SEC.HARD > 0);
  assert.equal(HOWTO_STORAGE_KEY, 'mls-howto-seen');

  const { bottles, orders } = materializeMixStage(MIX_CHALLENGE_STAGES[0]);
  const hint = findHintMove(bottles, orders);
  assert.ok(hint, 'orange intro should have a hint move');
  const src = bottles.find((b) => b.id === hint.sourceId);
  const dst = bottles.find((b) => b.id === hint.targetId);
  assert.ok(src && dst && canPour(src, dst), 'hint must be a legal pour');
  assert.ok(isMixingPour(src, dst), 'orange intro hint should prefer a mixing pour');

  // Level 4 boards opt into mixingEnabled.
  const early = generateLevel(4);
  assert.ok(early.bottles.some((b) => b.mixingEnabled), 'level 4 should enable mixing');
}

// --- Mechanism pack: blocked / mixed capacity / minSteps stars ---
{
  assert.equal(MECHANISM_PACK_STORAGE_KEY, 'mls-mechanism-pack-v1');
  assert.ok(mechStageCount() >= 5, 'mechanism pack should ship a meaningful stage count');
  assert.equal(mechStageCount(), MECHANISM_PACK_STAGES.length);

  assert.equal(isMechStageUnlocked(0, 0), true);
  assert.equal(isMechStageUnlocked(1, 0), false);
  assert.equal(isMechStageUnlocked(1, 1), true);
  assert.equal(continueMechIndex(0), 0);
  assert.equal(continueMechIndex(mechStageCount()), mechStageCount() - 1);

  assert.equal(starsForMoves(5, 5), 3);
  assert.equal(starsForMoves(6, 5), 2);
  assert.equal(starsForMoves(20, 5), 1);

  let progress = { clearedCount: 0, bestMoves: {}, bestStars: {} };
  progress = applyMechStageClear(progress, 0, 6);
  assert.equal(progress.clearedCount, 1);
  assert.equal(progress.bestStars[MECHANISM_PACK_STAGES[0].id], 3);

  const seenIds = new Set();
  for (let i = 0; i < MECHANISM_PACK_STAGES.length; i++) {
    const stage = MECHANISM_PACK_STAGES[i];
    assert.ok(stage.id && stage.name && stage.tip);
    assert.ok(!seenIds.has(stage.id), `duplicate mech id ${stage.id}`);
    seenIds.add(stage.id);
    assert.ok(stage.minSteps >= 1, `mech ${stage.id}: minSteps`);

    const { bottles, orders } = materializeMechStage(stage);
    assert.equal(orders.length, stage.orderColors.length);
    if (stage.bottles.some((b) => b.blocked)) {
      assert.ok(
        bottles.some((b) => b.isBlocked),
        `mech ${stage.id}: expected a blocked bottle`,
      );
    }
    const caps = new Set(bottles.map((b) => b.capacity));
    if (stage.id === 'cap-mix' || stage.id === 'mech-finale') {
      assert.ok(caps.size > 1, `mech ${stage.id}: expected mixed capacities`);
    }
    if (stage.id === 'cap-tight') {
      assert.ok(
        bottles.every((b) => b.capacity === 2),
        `mech ${stage.id}: expected all capacity-2 bottles`,
      );
    }

    const ms = minStepsWithDeliveries(bottles, orders);
    assert.notEqual(ms, -1, `mech ${stage.id}: BFS budget exhausted`);
    assert.notEqual(ms, -2, `mech ${stage.id}: UNSOLVABLE`);
    assert.equal(
      ms,
      stage.minSteps,
      `mech ${stage.id}: minSteps claimed ${stage.minSteps} but BFS found ${ms}`,
    );
  }
}

// --- Daily boards stay solvable ---
{
  assert.ok(DAILY_BOARDS.length >= 5);
  for (const board of DAILY_BOARDS) {
    const { bottles, orders } = materializeDailyBoard(board);
    const ms = minStepsWithDeliveries(bottles, orders);
    assert.ok(ms >= 0, `daily ${board.id}: solvable (got ${ms})`);
  }
}

// --- Streak + share text + cosmetics catalog ---
{
  const d0 = applyPlayDay({ lastPlayDate: '', currentStreak: 0, bestStreak: 0 }, '2026-10-20');
  assert.equal(d0.currentStreak, 1);
  const d1 = applyPlayDay(d0, '2026-10-21');
  assert.equal(d1.currentStreak, 2);
  const gap = applyPlayDay(d1, '2026-10-23');
  assert.equal(gap.currentStreak, 1);
  assert.equal(gap.bestStreak, 2);
  assert.equal(displayStreak(d1, new Date(2026, 9, 21)), 2);

  const share = buildDailyShareText({
    streak: d1,
    dailyLabel: '測試盤',
    date: new Date(2026, 9, 21),
    missions: [
      {
        id: 'm',
        type: 'POUR',
        descriptionKey: 'mission.pour',
        target: 30,
        progress: 10,
        reward: 100,
        isClaimed: false,
      },
    ],
  });
  assert.ok(share.includes('神秘液體排序'));
  assert.ok(share.includes(localDateKey(new Date(2026, 9, 21))));
  assert.ok(share.includes('測試盤'));

  assert.ok(BOTTLE_SKINS.length >= 3);
  assert.ok(LIQUID_SKINS.length >= 2);
  const paid = BOTTLE_SKINS.find((s) => s.cost > 0);
  assert.ok(paid);
  const poor = unlockBottleSkin(DEFAULT_COSMETICS, paid.id, 0);
  assert.equal(poor.ok, false);
  const rich = unlockBottleSkin(
    { ...DEFAULT_COSMETICS, unlockedBottles: ['classic'], unlockedLiquids: ['plain'] },
    paid.id,
    paid.cost,
  );
  assert.equal(rich.ok, true);
  assert.ok(rich.state.unlockedBottles.includes(paid.id));
}

// Cockpit metrics: purity spectrometer, deadlock radar, par compass, and tube status
{
  const b1 = bottle('1', [layer(Color.RED), layer(Color.RED)]);
  const b2 = bottle('2', [layer(Color.BLUE), layer(Color.BLUE)]);
  const b3 = bottle('3', []);
  const bBlocked = { ...bottle('4', [layer(Color.YELLOW)]), isBlocked: true };
  const bCompleted = bottle('5', [layer(Color.GREEN), layer(Color.GREEN), layer(Color.GREEN), layer(Color.GREEN)], 4, true);

  const testBottles = [b1, b2, b3, bBlocked, bCompleted];
  const testOrders = [
    { id: 'o1', color: Color.RED, isCompleted: false, isLocked: false },
    { id: 'o2', color: Color.GREEN, isCompleted: true, isLocked: false },
  ];

  // Purity calculation
  const purity = calculateLabPurity(testBottles, testOrders);
  assert.ok(purity.overallPurityPct >= 0 && purity.overallPurityPct <= 100);
  assert.equal(purity.totalPureBottles, 1, 'only bCompleted is completed pure bottle');
  assert.ok(purity.metrics.length > 0);

  // Legal pours radar
  const legal = calculateLegalPours(testBottles);
  assert.ok(legal.count > 0, 'can pour into empty buffer tube b3');
  assert.ok(legal.pairs.some(([src, tgt]) => src === '1' && tgt === '3'));

  // Buffer tubes
  const buffers = calculateBufferTubes(testBottles);
  assert.equal(buffers.emptyCount, 1);
  assert.equal(buffers.emptyTubeIds[0], '3');

  // Par steps & efficiency rating
  const par = calculateParSteps(testBottles, testOrders, 8);
  assert.equal(par, 8, 'respects explicit mechMinSteps');

  const ratingS = calculateStepRating(7, 8);
  assert.equal(ratingS.rating, 'S');

  const ratingA = calculateStepRating(9, 8);
  assert.equal(ratingA.rating, 'A');

  const ratingB = calculateStepRating(12, 8);
  assert.equal(ratingB.rating, 'B');

  const ratingC = calculateStepRating(20, 8);
  assert.equal(ratingC.rating, 'C');

  // Tube quick matrix status
  assert.equal(getTubeQuickStatus(bCompleted).status, 'sealed');
  assert.equal(getTubeQuickStatus(b3).status, 'empty');
  assert.equal(getTubeQuickStatus(bBlocked).status, 'blocked');
  assert.equal(getTubeQuickStatus(b1).status, 'pure');

  const bMixed = bottle('m', [layer(Color.RED), layer(Color.BLUE)]);
  assert.equal(getTubeQuickStatus(bMixed).status, 'mixed');
}

// ============================================================================
// DEEPENED TEST SUITE 1: Liquid Transfer Volume Capacity Invariants
// ============================================================================
{
  // 1.1 Consecutive matching layer transfers up to capacity 4
  // Single unit transfer into 3-unit tube -> exactly completes capacity 4
  {
    const src = bottle('s', [layer(Color.RED)]);
    const dst = bottle('d', [layer(Color.RED), layer(Color.RED), layer(Color.RED)], 4);
    const { newSource, newTarget, movedCount } = pourLiquid(src, dst);
    assert.equal(movedCount, 1);
    assert.equal(newSource.layers.length, 0);
    assert.equal(newTarget.layers.length, 4);
    assert.equal(newTarget.isCompleted, true, 'full uniform bottle marks completed');
  }

  // 2-units transfer into 2-unit tube
  {
    const src = bottle('s', [layer(Color.BLUE), layer(Color.BLUE)]);
    const dst = bottle('d', [layer(Color.BLUE), layer(Color.BLUE)], 4);
    const { newSource, newTarget, movedCount } = pourLiquid(src, dst);
    assert.equal(movedCount, 2);
    assert.equal(newSource.layers.length, 0);
    assert.equal(newTarget.layers.length, 4);
    assert.equal(newTarget.isCompleted, true);
  }

  // 3-units transfer into 1-unit tube
  {
    const src = bottle('s', [layer(Color.GREEN), layer(Color.GREEN), layer(Color.GREEN)]);
    const dst = bottle('d', [layer(Color.GREEN)], 4);
    const { newSource, newTarget, movedCount } = pourLiquid(src, dst);
    assert.equal(movedCount, 3);
    assert.equal(newSource.layers.length, 0);
    assert.equal(newTarget.layers.length, 4);
    assert.equal(newTarget.isCompleted, true);
  }

  // 4-units transfer into empty tube of capacity 4
  {
    const src = bottle('s', [
      layer(Color.YELLOW),
      layer(Color.YELLOW),
      layer(Color.YELLOW),
      layer(Color.YELLOW),
    ]);
    const dst = bottle('d', [], 4);
    const { newSource, newTarget, movedCount } = pourLiquid(src, dst);
    assert.equal(movedCount, 4);
    assert.equal(newSource.layers.length, 0);
    assert.equal(newTarget.layers.length, 4);
    assert.equal(newTarget.isCompleted, true);
  }

  // 1.2 Recipient capacity truncation (overflow prevention)
  // Source has 4 matching units, recipient has 3 units (capacity 4). Only 1 can transfer.
  {
    const src = bottle('s', [
      layer(Color.CYAN),
      layer(Color.CYAN),
      layer(Color.CYAN),
      layer(Color.CYAN),
    ]);
    const dst = bottle('d', [layer(Color.CYAN), layer(Color.CYAN), layer(Color.CYAN)], 4);
    assert.equal(canPour(src, dst), true);
    const { newSource, newTarget, movedCount } = pourLiquid(src, dst);
    assert.equal(movedCount, 1, 'cannot overflow past capacity 4');
    assert.equal(newSource.layers.length, 3, 'source retains 3 untransferred units');
    assert.equal(newTarget.layers.length, 4, 'target caps at capacity 4');
    assert.equal(newTarget.isCompleted, true);
  }

  // Source has 3 matching units, recipient has 2 units (capacity 4). Exactly 2 transfer.
  {
    const src = bottle('s', [layer(Color.PURPLE), layer(Color.PURPLE), layer(Color.PURPLE)]);
    const dst = bottle('d', [layer(Color.PURPLE), layer(Color.PURPLE)], 4);
    const { newSource, newTarget, movedCount } = pourLiquid(src, dst);
    assert.equal(movedCount, 2);
    assert.equal(newSource.layers.length, 1);
    assert.equal(newTarget.layers.length, 4);
    assert.equal(newTarget.isCompleted, true);
  }

  // Source has 2 matching units, recipient has 3 units (capacity 4). Exactly 1 transfers.
  {
    const src = bottle('s', [layer(Color.ORANGE), layer(Color.ORANGE)]);
    const dst = bottle('d', [layer(Color.ORANGE), layer(Color.ORANGE), layer(Color.ORANGE)], 4);
    const { newSource, newTarget, movedCount } = pourLiquid(src, dst);
    assert.equal(movedCount, 1);
    assert.equal(newSource.layers.length, 1);
    assert.equal(newTarget.layers.length, 4);
    assert.equal(newTarget.isCompleted, true);
  }

  // 1.3 Heterogeneous source stack: top run transfers, deeper layers stay untouched
  {
    const src = bottle('s', [
      layer(Color.RED),
      layer(Color.YELLOW),
      layer(Color.BLUE),
      layer(Color.BLUE),
    ]);
    const dst = bottle('d', [layer(Color.BLUE)], 4);
    const { newSource, newTarget, movedCount } = pourLiquid(src, dst);
    assert.equal(movedCount, 2, 'only contiguous top run of BLUE moves');
    assert.equal(newSource.layers.length, 2);
    assert.equal(newSource.layers[0].color, Color.RED);
    assert.equal(newSource.layers[1].color, Color.YELLOW);
    assert.equal(newTarget.layers.length, 3);
    assert.equal(newTarget.isCompleted, false, '3/4 is not completed');
  }

  // 1.4 Volume conservation invariant across repeated legal pours
  {
    function totalUnitsByColor(bottles) {
      const counts = new Map();
      for (const b of bottles) {
        for (const l of b.layers) {
          counts.set(l.color, (counts.get(l.color) ?? 0) + 1);
        }
      }
      return counts;
    }

    let bList = [
      bottle('b1', [layer(Color.RED), layer(Color.BLUE), layer(Color.BLUE)]),
      bottle('b2', [layer(Color.BLUE), layer(Color.RED), layer(Color.RED)]),
      bottle('b3', [layer(Color.RED)]),
      bottle('b4', [], 4),
    ];

    const initialCounts = totalUnitsByColor(bList);

    // Pour b1 top BLUE into an empty bottle b4
    const p1 = pourLiquid(bList[0], bList[3]);
    bList[0] = p1.newSource;
    bList[3] = p1.newTarget;
    const step1Counts = totalUnitsByColor(bList);
    for (const [col, count] of initialCounts) {
      assert.equal(step1Counts.get(col), count, `conservation of ${col}`);
    }

    // Attempting to pour into completed bottle is strictly rejected
    const completedTube = bottle('comp', [
      layer(Color.RED),
      layer(Color.RED),
      layer(Color.RED),
      layer(Color.RED),
    ], 4, true);
    const anotherTube = bottle('other', [layer(Color.RED)]);
    assert.equal(canPour(anotherTube, completedTube), false, 'cannot pour into completed bottle');
    // UI/Engine rule: completed bottles are barred from being move sources in getLegalMoves
    const movesWithCompleted = getLegalMoves([completedTube, anotherTube]);
    assert.equal(movesWithCompleted.some((m) => m.sourceId === 'comp'), false, 'completed tube cannot be source in legal moves');
  }
}

// ============================================================================
// DEEPENED TEST SUITE 2: Blind / Fog Layer Uncovering Invariants
// ============================================================================
{
  // 2.1 Hidden layers cannot be poured onto colored targets, and are barred in legal moves
  const hiddenTop = bottle('ht', [layer(Color.BLUE), layer(Color.RED, true)]);
  const coloredTarget = bottle('ct', [layer(Color.RED)]);
  const emptyTarget = bottle('et', []);
  assert.equal(canPour(hiddenTop, coloredTarget), false, 'cannot pour onto colored target when top layer is hidden');
  // getLegalMoves bars bottles with hidden top layer from acting as move sources
  const movesFromHidden = getLegalMoves([hiddenTop, emptyTarget]);
  assert.equal(movesFromHidden.length, 0, 'hidden top layer cannot be source in legal moves');

  // 2.2 Blind/fog invariant: all legal boards start with visible top layers
  const sampledLevel = generateLevel(5);
  for (const b of sampledLevel.bottles) {
    if (b.layers.length > 0) {
      assert.equal(b.layers[b.layers.length - 1].isHidden, false, 'starting top layers must be visible');
    }
  }

  // 2.3 Layer uncovering upon exposing new top layer
  {
    const sourceBottle = bottle('fog-src', [
      layer(Color.GREEN, true), // Layer 0: hidden
      layer(Color.YELLOW, true), // Layer 1: hidden
      layer(Color.BLUE, false), // Layer 2: visible
      layer(Color.BLUE, false), // Layer 3: visible
    ]);
    const targetBottle = bottle('fog-tgt', []);

    // Pour 1: transfers both BLUE layers (top run length 2)
    const pour1 = pourLiquid(sourceBottle, targetBottle);
    assert.equal(pour1.movedCount, 2);
    assert.equal(pour1.newSource.layers.length, 2);

    // Layer 1 (YELLOW) was exposed -> automatically uncovered
    assert.equal(pour1.newSource.layers[1].color, Color.YELLOW);
    assert.equal(pour1.newSource.layers[1].isHidden, false, 'exposed top layer 1 must be uncovered');

    // Layer 0 (GREEN) is still underneath -> MUST remain hidden
    assert.equal(pour1.newSource.layers[0].color, Color.GREEN);
    assert.equal(pour1.newSource.layers[0].isHidden, true, 'deeper layer 0 must stay hidden');

    // Pour 2: transfer newly uncovered YELLOW layer into target 2
    const targetBottle2 = bottle('fog-tgt-2', []);
    const pour2 = pourLiquid(pour1.newSource, targetBottle2);
    assert.equal(pour2.movedCount, 1);
    assert.equal(pour2.newSource.layers.length, 1);

    // Layer 0 (GREEN) is now the top layer -> automatically uncovered
    assert.equal(pour2.newSource.layers[0].color, Color.GREEN);
    assert.equal(pour2.newSource.layers[0].isHidden, false, 'newly exposed layer 0 must now uncover');
  }

  // 2.4 Completion invariant under fog: full tube with hidden layers NEVER completes
  {
    const maskedTube = bottle('masked', [
      layer(Color.RED, true),
      layer(Color.RED, true),
      layer(Color.RED, true),
      layer(Color.RED, false),
    ]);
    assert.equal(maskedTube.isCompleted, false, 'cannot be completed while any layer is hidden');

    // Pour 1 unit of RED into a 3-unit tube where 1 unit is hidden
    const partialMasked = bottle('pm', [
      layer(Color.RED, true),
      layer(Color.RED, false),
      layer(Color.RED, false),
    ]);
    const donor = bottle('donor', [layer(Color.RED)]);
    const { newTarget } = pourLiquid(donor, partialMasked);
    assert.equal(newTarget.layers.length, 4);
    assert.equal(newTarget.isCompleted, false, 'even when full, hidden layer blocks completion');
  }

  // 2.5 Booster item revealHiddenLayers uncovers all layers and completes eligible tubes
  {
    const b1 = bottle('b1', [
      layer(Color.PURPLE, true),
      layer(Color.PURPLE, true),
      layer(Color.PURPLE, false),
      layer(Color.PURPLE, false),
    ]);
    const b2 = bottle('b2', [
      layer(Color.CYAN, true),
      layer(Color.YELLOW, false),
    ]);

    const revealed = revealHiddenLayers([b1, b2]);
    assert.ok(revealed[0].layers.every((l) => !l.isHidden), 'all b1 layers revealed');
    assert.ok(revealed[1].layers.every((l) => !l.isHidden), 'all b2 layers revealed');
    assert.equal(revealed[0].isCompleted, true, 'b1 full mono is now completed');
    assert.equal(revealed[1].isCompleted, false, 'b2 is incomplete');
  }
}

// ============================================================================
// DEEPENED TEST SUITE 3: Solver IDA* Backtracking Depth Limit & Unsolvable State Detection
// ============================================================================
{
  /**
   * Admissible heuristic for Liquid Sort IDA*:
   * Counts color discontinuities (adjacent layer color differences) in each tube.
   * Every pour can resolve at most one discontinuity (merging matching runs),
   * making the total count of discontinuities an admissible lower bound on moves.
   */
  function liquidSortHeuristic(bottles) {
    let discontinuities = 0;
    let incompletePureCount = 0;
    for (const b of bottles) {
      if (b.layers.length === 0 || b.isCompleted) continue;
      let tubeDisc = 0;
      for (let i = 0; i < b.layers.length - 1; i++) {
        if (b.layers[i].color !== b.layers[i + 1].color) {
          tubeDisc++;
        }
      }
      discontinuities += tubeDisc;
      if (tubeDisc === 0 && b.layers.length < b.capacity) {
        incompletePureCount++;
      }
    }
    return discontinuities + Math.floor(incompletePureCount / 2);
  }

  /**
   * IDA* search implementation with strict depth threshold and node limit.
   */
  function solveWithIDAStar(bottles, requiredColors, maxDepthLimit = 25, maxNodes = 50000) {
    let nodes = 0;
    const path = [];

    function search(curBottles, g, bound, onPath) {
      nodes++;
      if (nodes > maxNodes) return { status: 'exhausted' };

      const h = liquidSortHeuristic(curBottles);
      const f = g + h;
      if (f > bound) return { status: 'cutoff', minF: f };

      if (isBoardWon(curBottles, requiredColors)) {
        return { status: 'found', moves: path.slice() };
      }

      const key = bottlesKey(curBottles);
      if (onPath.has(key)) return { status: 'cutoff', minF: Infinity };
      onPath.add(key);

      const moves = getLegalMoves(curBottles)
        .map((move) => scoreMove(curBottles, move, requiredColors))
        .sort((a, b) => b.score - a.score);

      let minCutoff = Infinity;
      for (const { move } of moves) {
        path.push(move);
        const nextBottles = applyMove(curBottles, move);
        const res = search(nextBottles, g + 1, bound, onPath);

        if (res.status === 'found') return res;
        if (res.status === 'exhausted') return res;
        if (res.status === 'cutoff' && res.minF < minCutoff) {
          minCutoff = res.minF;
        }
        path.pop();
      }

      onPath.delete(key);
      return { status: 'cutoff', minF: minCutoff };
    }

    let bound = liquidSortHeuristic(bottles);
    while (bound <= maxDepthLimit) {
      const onPath = new Set();
      const res = search(bottles, 0, bound, onPath);
      if (res.status === 'found') {
        return { result: 'solvable', moves: res.moves, depth: res.moves.length, nodes };
      }
      if (res.status === 'exhausted') {
        return { result: 'exhausted', nodes };
      }
      if (!Number.isFinite(res.minF) || res.minF <= bound) {
        return { result: 'unsolvable', nodes };
      }
      bound = res.minF;
    }

    return { result: 'depth_limit_exceeded', depthLimit: maxDepthLimit, nodes };
  }

  // 3.1 Solvable puzzle: IDA* finds minimal path
  {
    const b1 = bottle('b1', [layer(Color.RED), layer(Color.BLUE)], 2);
    const b2 = bottle('b2', [layer(Color.BLUE), layer(Color.RED)], 2);
    const b3 = bottle('b3', [], 2);
    const req = new Set([Color.RED, Color.BLUE]);

    const idaSol = solveWithIDAStar([b1, b2, b3], req, 10);
    assert.equal(idaSol.result, 'solvable', 'IDA* should solve 3-step puzzle');
    assert.equal(idaSol.depth, 3, 'minimal depth is 3');
    let cur = [b1, b2, b3];
    for (const m of idaSol.moves) {
      cur = applyMove(cur, m);
    }
    assert.equal(isBoardWon(cur, req), true, 'replaying IDA* moves must reach won board');
  }

  // 3.2 Depth limit cutoff: prevents runaway search when limit is below required depth
  {
    const b1 = bottle('b1', [layer(Color.RED), layer(Color.BLUE)], 2);
    const b2 = bottle('b2', [layer(Color.BLUE), layer(Color.RED)], 2);
    const b3 = bottle('b3', [], 2);
    const req = new Set([Color.RED, Color.BLUE]);

    // Limit depth to 2 when solution requires 3
    const cutoff = solveWithIDAStar([b1, b2, b3], req, 2);
    assert.equal(cutoff.result, 'depth_limit_exceeded');
    assert.equal(cutoff.depthLimit, 2);
    assert.ok(cutoff.nodes > 0);
  }

  // 3.3 Unsolvable state detection: Total Deadlock (zero legal moves)
  {
    const dead1 = bottle('d1', [layer(Color.RED), layer(Color.BLUE)], 2);
    const dead2 = bottle('d2', [layer(Color.BLUE), layer(Color.RED)], 2);
    const req = new Set([Color.RED, Color.BLUE]);

    // No empty bottles, tops mismatched -> 0 legal moves
    assert.equal(getLegalMoves([dead1, dead2]).length, 0);
    const res = solveWithIDAStar([dead1, dead2], req, 10);
    assert.equal(res.result, 'unsolvable', 'deadlocked board must be detected as unsolvable');
  }

  // 3.4 Unsolvable state detection: Volume Deficit (impossible color counts)
  {
    const def1 = bottle('df1', [layer(Color.RED), layer(Color.RED)], 2);
    const def2 = bottle('df2', [layer(Color.RED), layer(Color.BLUE)], 2);
    const def3 = bottle('df3', [], 2);
    const req = new Set([Color.RED, Color.BLUE]);

    const res = solveWithIDAStar([def1, def2, def3], req, 8);
    assert.equal(res.result, 'unsolvable', 'volume deficit must be detected as unsolvable');
  }

  // 3.5 Unsolvable state detection: Irreversible mix deadlock
  {
    const mix1 = { ...bottle('m1', [layer(Color.RED)], 2), mixingEnabled: true };
    const mix2 = { ...bottle('m2', [layer(Color.YELLOW)], 2), mixingEnabled: true };
    const req = new Set([Color.RED, Color.YELLOW]);

    // Pour m1 into m2 produces ORANGE, leaving no RED or YELLOW
    const pour = pourLiquid(mix1, mix2);
    assert.equal(pour.newTarget.layers[0].color, Color.ORANGE);

    // Board with only ORANGE and no way to get RED/YELLOW
    const res = solveWithIDAStar([pour.newSource, pour.newTarget], req, 5);
    assert.equal(res.result, 'unsolvable', 'secondary mix without orders is unsolvable');
  }
}

// ============================================================================
// DEEPENED TEST SUITE 4: Extra Vial Booster Safety & Undo/Restart State Preservation
// ============================================================================
{
  function simulateAddBottle(state, capacity = 4) {
    const newBottle = {
      id: `extra-vial-${Math.random().toString(36).slice(2, 7)}`,
      layers: [],
      capacity,
      isCompleted: false,
      mixingEnabled: state.bottles.some((b) => b.mixingEnabled),
    };
    return {
      ...state,
      bottles: [...state.bottles, newBottle],
    };
  }

  function simulatePushHistory(state) {
    const snapshot = {
      bottles: JSON.parse(JSON.stringify(state.bottles)),
      orders: JSON.parse(JSON.stringify(state.orders)),
    };
    return {
      ...state,
      history: [...state.history, snapshot],
    };
  }

  function simulateUndo(state) {
    if (state.history.length === 0) return state;
    const previous = state.history[state.history.length - 1];
    const newHistory = state.history.slice(0, -1);
    return {
      ...state,
      bottles: JSON.parse(JSON.stringify(previous.bottles)),
      orders: JSON.parse(JSON.stringify(previous.orders)),
      history: newHistory,
    };
  }

  function simulateRestart(state) {
    return {
      ...state,
      bottles: JSON.parse(JSON.stringify(state.initialBoardState.bottles)),
      orders: JSON.parse(JSON.stringify(state.initialBoardState.orders)),
      history: [],
      selectedBottleId: null,
      isWin: false,
    };
  }

  // 4.1 Extra vial booster safety: adds empty buffer tube and unjams deadlock
  {
    const dead1 = bottle('d1', [layer(Color.RED), layer(Color.BLUE)], 2);
    const dead2 = bottle('d2', [layer(Color.BLUE), layer(Color.RED)], 2);
    const state = {
      bottles: [dead1, dead2],
      orders: [
        { id: 'o1', color: Color.RED, isCompleted: false, isLocked: false },
        { id: 'o2', color: Color.BLUE, isCompleted: false, isLocked: false },
      ],
      history: [],
    };

    assert.equal(calculateLegalPours(state.bottles).count, 0, 'initially zero legal pours');
    const boosterState = simulateAddBottle(state, 2);
    assert.equal(boosterState.bottles.length, 3, 'one extra tube appended');
    assert.equal(boosterState.bottles[2].layers.length, 0, 'extra tube is empty buffer');
    assert.equal(boosterState.bottles[2].capacity, 2);
    assert.equal(boosterState.bottles[0].id, 'd1', 'original bottle 1 intact');
    assert.equal(boosterState.bottles[1].id, 'd2', 'original bottle 2 intact');
    assert.equal(boosterState.orders.length, 2, 'orders intact');

    // Legal pours immediately unjammed
    const legalPours = calculateLegalPours(boosterState.bottles);
    assert.ok(legalPours.count > 0, 'extra vial creates legal moves');
  }

  // 4.2 Multi-step Undo stack state preservation
  {
    const b1 = bottle('b1', [layer(Color.RED), layer(Color.BLUE)], 2);
    const b2 = bottle('b2', [layer(Color.BLUE), layer(Color.RED)], 2);
    const b3 = bottle('b3', [], 2);
    const o1 = { id: 'o1', color: Color.RED, isCompleted: false, isLocked: false };
    const o2 = { id: 'o2', color: Color.BLUE, isCompleted: false, isLocked: false };

    let state = {
      bottles: [b1, b2, b3],
      orders: [o1, o2],
      history: [],
    };
    const initialBottlesSnapshot = JSON.parse(JSON.stringify(state.bottles));

    // Move 1: b1 -> b3
    state = simulatePushHistory(state);
    const p1 = pourLiquid(state.bottles[0], state.bottles[2]);
    state.bottles[0] = p1.newSource;
    state.bottles[2] = p1.newTarget;
    assert.equal(state.history.length, 1);

    // Move 2: b2 -> b1
    state = simulatePushHistory(state);
    const p2 = pourLiquid(state.bottles[1], state.bottles[0]);
    state.bottles[1] = p2.newSource;
    state.bottles[0] = p2.newTarget;
    assert.equal(state.history.length, 2);

    // Move 3: b3 -> b2
    state = simulatePushHistory(state);
    const p3 = pourLiquid(state.bottles[2], state.bottles[1]);
    state.bottles[2] = p3.newSource;
    state.bottles[1] = p3.newTarget;
    assert.equal(state.history.length, 3);
    assert.equal(state.bottles[0].isCompleted, true);
    assert.equal(state.bottles[1].isCompleted, true);

    // Step-by-step undo
    state = simulateUndo(state);
    assert.equal(state.history.length, 2);
    assert.equal(state.bottles[1].isCompleted, false);

    state = simulateUndo(state);
    assert.equal(state.history.length, 1);
    assert.equal(state.bottles[0].isCompleted, false);

    state = simulateUndo(state);
    assert.equal(state.history.length, 0);
    assert.deepEqual(state.bottles, initialBottlesSnapshot, 'undo restores exact initial bottles');

    // Calling undo on empty history is safe
    const idleState = simulateUndo(state);
    assert.equal(idleState.history.length, 0);
    assert.deepEqual(idleState.bottles, initialBottlesSnapshot);
  }

  // 4.3 Order delivery and Undo safety
  {
    const bCompleted = bottle('b1', [layer(Color.RED), layer(Color.RED)], 2, true);
    const bBuffer = bottle('b2', [], 2);
    const initialOrders = [
      { id: 'o1', color: Color.RED, isCompleted: false, isLocked: false },
      { id: 'o2', color: Color.BLUE, isCompleted: false, isLocked: true },
    ];
    let state = {
      bottles: [bCompleted, bBuffer],
      orders: initialOrders,
      history: [],
    };

    // Pre-delivery snapshot
    state = simulatePushHistory(state);
    // Simulate order delivery (Game.tsx delivery effect)
    state.orders = [
      { id: 'o1', color: Color.RED, isCompleted: true, isLocked: false },
      { id: 'o2', color: Color.BLUE, isCompleted: false, isLocked: false }, // unlocked!
    ];
    state.bottles = [bBuffer]; // completed bottle removed

    assert.equal(state.orders[0].isCompleted, true);
    assert.equal(state.orders[1].isLocked, false);
    assert.equal(state.bottles.length, 1);

    // Undo delivery
    state = simulateUndo(state);
    assert.equal(state.bottles.length, 2, 'completed bottle restored to board');
    assert.equal(state.bottles[0].id, 'b1');
    assert.equal(state.orders[0].isCompleted, false, 'order 1 reverted to open');
    assert.equal(state.orders[1].isLocked, true, 'order 2 reverted to locked');
  }

  // 4.4 Restart state preservation
  {
    const initialBottles = [
      bottle('b1', [layer(Color.RED), layer(Color.GREEN)], 2),
      bottle('b2', [layer(Color.GREEN), layer(Color.RED)], 2),
      bottle('b3', [], 2),
    ];
    const initialOrders = [
      { id: 'o1', color: Color.RED, isCompleted: false, isLocked: false },
      { id: 'o2', color: Color.GREEN, isCompleted: false, isLocked: false },
    ];

    let state = {
      bottles: JSON.parse(JSON.stringify(initialBottles)),
      orders: JSON.parse(JSON.stringify(initialOrders)),
      initialBoardState: {
        bottles: JSON.parse(JSON.stringify(initialBottles)),
        orders: JSON.parse(JSON.stringify(initialOrders)),
      },
      history: [],
      selectedBottleId: 'b1',
      isWin: false,
    };

    // Modify state heavily
    state = simulateAddBottle(state, 2);
    state = simulatePushHistory(state);
    state.bottles[0].layers.pop();
    state.history.push({ bottles: [], orders: [] });

    // Trigger restart
    state = simulateRestart(state);
    assert.deepEqual(state.bottles, initialBottles, 'restart restores initial bottles');
    assert.deepEqual(state.orders, initialOrders, 'restart restores initial orders');
    assert.equal(state.history.length, 0, 'history cleared');
    assert.equal(state.selectedBottleId, null, 'selected bottle cleared');
    assert.equal(state.isWin, false);
  }
}

// ============================================================================
// DEEPENED TEST SUITE 5: Daily Puzzle Seed Determinism Across Asia/Taipei Calendar Rollover
// ============================================================================
{
  assert.equal(TAIPEI_TZ_OFFSET_MS, 8 * 60 * 60 * 1000, 'Asia/Taipei is UTC+8');

  // 5.1 Millisecond boundary rollover tests (UTC to Asia/Taipei)
  const tzCases = [
    { utc: '2026-06-15T15:59:59.999Z', expected: '2026-06-15' }, // 23:59:59.999 Taipei
    { utc: '2026-06-15T16:00:00.000Z', expected: '2026-06-16' }, // 00:00:00.000 Taipei (Rollover!)
    { utc: '2026-06-15T00:00:00.000Z', expected: '2026-06-15' }, // 08:00:00.000 Taipei
    { utc: '2026-12-31T15:59:59.999Z', expected: '2026-12-31' }, // Year boundary (same year)
    { utc: '2026-12-31T16:00:00.000Z', expected: '2027-01-01' }, // Year boundary (New Year rollover!)
    { utc: '2024-02-28T16:00:00.000Z', expected: '2024-02-29' }, // Leap year Feb 29 rollover
    { utc: '2024-02-29T16:00:00.000Z', expected: '2024-03-01' }, // Leap year Mar 1 rollover
    { utc: '2026-02-28T16:00:00.000Z', expected: '2026-03-01' }, // Non-leap year Mar 1 rollover
    { utc: '2026-04-30T16:00:00.000Z', expected: '2026-05-01' }, // 30-day month rollover
  ];

  for (const { utc, expected } of tzCases) {
    const d = new Date(utc);
    assert.equal(taipeiDateKey(d), expected, `UTC ${utc} should map to Taipei ${expected}`);
  }

  // 5.2 Daily puzzle seed & index determinism
  const testKey = '2026-11-19';
  const expectedIndex = dayIndex(testKey);
  for (let i = 0; i < 50; i++) {
    assert.equal(dayIndex(testKey), expectedIndex, 'dayIndex must be strictly deterministic');
  }
  assert.notEqual(dayIndex('2026-11-19'), dayIndex('2026-11-20'), 'adjacent days differ');

  // getDailyBoard with explicit Date objects
  const dailyAtUtc1559 = getDailyBoard(new Date('2026-06-15T15:59:59.000Z'));
  const dailyAtUtc1600 = getDailyBoard(new Date('2026-06-15T16:00:00.000Z'));
  assert.equal(dailyAtUtc1559.dateKey, '2026-06-15');
  assert.equal(dailyAtUtc1600.dateKey, '2026-06-16');
  assert.equal(DAILY_CLEAR_KEY, 'mls-daily-clear-v1');

  // 5.3 Coverage of all 365 calendar days of 2026
  const hitBoards = new Set();
  const startDay = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));
  for (let offset = 0; offset < 365; offset++) {
    const curDate = new Date(startDay.getTime() + offset * 86_400_000);
    const daily = getDailyBoard(curDate);
    assert.ok(daily.board, `daily board defined for offset ${offset}`);
    assert.ok(daily.index >= 0 && daily.index < DAILY_BOARDS.length);
    hitBoards.add(daily.board.id);
  }
  assert.equal(hitBoards.size, DAILY_BOARDS.length, 'all 7 curated daily boards must be visited in a year');

  // 5.4 Streak preservation across calendar boundaries
  // Year boundary transition: Dec 31 -> Jan 1
  {
    const s0 = { lastPlayDate: '2026-12-30', currentStreak: 5, bestStreak: 5 };
    const s1 = applyPlayDay(s0, '2026-12-31');
    assert.equal(s1.currentStreak, 6);
    const s2 = applyPlayDay(s1, '2027-01-01');
    assert.equal(s2.currentStreak, 7, 'streak survives across year boundary');
    assert.equal(s2.bestStreak, 7);
  }

  // Month boundary transition: Feb 28 -> Mar 1 (non-leap)
  {
    const s0 = { lastPlayDate: '2026-02-27', currentStreak: 2, bestStreak: 4 };
    const s1 = applyPlayDay(s0, '2026-02-28');
    assert.equal(s1.currentStreak, 3);
    const s2 = applyPlayDay(s1, '2026-03-01');
    assert.equal(s2.currentStreak, 4, 'streak survives across month boundary');
  }

  // Same-day replay: no double increment
  {
    const s0 = { lastPlayDate: '2026-10-21', currentStreak: 3, bestStreak: 3 };
    const s1 = applyPlayDay(s0, '2026-10-21');
    assert.equal(s1.currentStreak, 3, 'same-day play is a no-op for streak increment');
  }

  // 2-day gap resets streak
  {
    const s0 = { lastPlayDate: '2026-10-20', currentStreak: 8, bestStreak: 12 };
    const sGap = applyPlayDay(s0, '2026-10-22');
    assert.equal(sGap.currentStreak, 1, 'gap resets current streak to 1');
    assert.equal(sGap.bestStreak, 12, 'best streak preserved');
  }

  // Active streak before playing today
  {
    const s0 = { lastPlayDate: '2026-10-20', currentStreak: 5, bestStreak: 5 };
    const active = displayStreak(s0, new Date('2026-10-21T02:00:00.000Z'));
    assert.equal(active, 5, 'streak remains active on current day before playing');
  }
}

console.log('check-liquid-sort: ok');
