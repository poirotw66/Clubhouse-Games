// ponytail: core pour / capacity / sorted-bottle checks, plus a from-scratch
// solvability search over sampled generated levels (see "generateLevel"
// section below) — independent of generateLevel's own replay verification.
import assert from 'node:assert/strict';
import { canPour, pourLiquid, checkLevelComplete, revealHiddenLayers, generateLevel } from './services/gameLogic.ts';
import { getCapacityForLevel } from './constants.ts';
import { Color } from './types.ts';

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
    if (source.isCompleted || source.layers.length === 0) continue;
    if (source.layers[source.layers.length - 1].isHidden) continue;
    for (const target of bottles) {
      if (source.id === target.id) continue;
      if (canPour(source, target)) moves.push({ sourceId: source.id, targetId: target.id });
    }
  }
  return moves;
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
  const GEN_TIME_BUDGET_MS = 100;

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

console.log('check-liquid-sort: ok');
