// ponytail: core pour / capacity / sorted-bottle checks; not level generation or BFS.
import assert from 'node:assert/strict';
import { canPour, pourLiquid, checkLevelComplete, revealHiddenLayers } from './services/gameLogic.ts';
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

console.log('check-liquid-sort: ok');
