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
// BFS over the real move rules, with its own model of order delivery.

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

/** Canonical state key: bottles are interchangeable, so sort by content (not id) to collapse equivalent states. */
function stateKey(bottles, orders) {
  const bottleReps = bottles
    .map((b) => b.layers.map((l) => l.color).join(',') + '#' + (b.isCompleted ? 1 : 0))
    .sort();
  const orderRep = orders.map((o) => `${o.color}:${o.isCompleted ? 1 : 0}:${o.isLocked ? 1 : 0}`).join(',');
  return bottleReps.join('|') + '||' + orderRep;
}

/**
 * BFS reachability search: is there ANY sequence of legal moves from this
 * board that completes every order? Returns 'solvable', 'unsolvable' (fully
 * explored, no solution), or 'exhausted' (node budget ran out — inconclusive).
 */
function isSolvable(bottles, orders, maxNodes = 200000) {
  const start = resolveDeliveries(bottles, orders);
  if (start.orders.every((o) => o.isCompleted)) return 'solvable';

  const visited = new Set([stateKey(start.bottles, start.orders)]);
  const queue = [{ bottles: start.bottles, orders: start.orders }];
  let head = 0;
  let nodes = 0;

  while (head < queue.length) {
    if (nodes++ >= maxNodes) return 'exhausted';
    const { bottles: curBottles, orders: curOrders } = queue[head++];

    for (const move of getLegalMoves(curBottles)) {
      const sourceIdx = curBottles.findIndex((b) => b.id === move.sourceId);
      const targetIdx = curBottles.findIndex((b) => b.id === move.targetId);
      const { newSource, newTarget } = pourLiquid(curBottles[sourceIdx], curBottles[targetIdx]);
      const nextBottles = curBottles.slice();
      nextBottles[sourceIdx] = newSource;
      nextBottles[targetIdx] = newTarget;

      const resolved = resolveDeliveries(nextBottles, curOrders);
      if (resolved.orders.every((o) => o.isCompleted)) return 'solvable';

      const key = stateKey(resolved.bottles, resolved.orders);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ bottles: resolved.bottles, orders: resolved.orders });
    }
  }
  return 'unsolvable';
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
