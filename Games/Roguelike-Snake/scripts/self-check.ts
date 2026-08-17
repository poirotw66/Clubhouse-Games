import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RELICS, rollRelicChoices } from '../src/game/relics.js';
import { MAX_FLOOR } from '../src/game/config.js';
import { createRng } from '../src/game/rng.js';
import { createRun, dash, tick } from '../src/game/engine.js';
import type { Enemy, Fruit, GameState, RelicId, Vec } from '../src/game/types.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setSnake(state: GameState, segments: Vec[], dir: GameState['dir']): void {
  state.snake = clone(segments);
  state.prevSnake = clone(segments);
  state.dir = dir;
  state.pendingDirs = [];
}

function createEmptyState(): GameState {
  const state = createRun(42);
  state.fruits = [];
  state.enemies = [];
  state.projectiles = [];
  state.spikes = [];
  state.effects = [];
  state.events = [];
  state.exit = null;
  state.boss = null;
  state.quota = 99;
  state.eaten = 0;
  return state;
}

function createSpitter(pos: Vec, offset = 11): Enemy {
  return {
    id: 999,
    type: 'spitter',
    pos: clone(pos),
    prev: clone(pos),
    offset,
  };
}

function expectSpitterOnlyFiresWhenAligned(): void {
  const aligned = createEmptyState();
  setSnake(
    aligned,
    [
      { x: 8, y: 5 },
      { x: 7, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 5 },
    ],
    'right',
  );
  aligned.enemies = [createSpitter({ x: 3, y: 5 })];
  tick(aligned);
  assert.equal(aligned.projectiles.length, 1, 'Spitter should fire when aligned on the same row.');

  const diagonal = createEmptyState();
  setSnake(
    diagonal,
    [
      { x: 8, y: 7 },
      { x: 7, y: 7 },
      { x: 6, y: 7 },
      { x: 5, y: 7 },
    ],
    'right',
  );
  diagonal.enemies = [createSpitter({ x: 3, y: 5 })];
  tick(diagonal);
  assert.equal(diagonal.projectiles.length, 0, 'Spitter should stay idle when the head is diagonal.');
}

function expectCursedFruitUsesFlatScore(): void {
  const state = createEmptyState();
  state.floor = 6;
  state.score = 0;
  state.energy = 0;
  setSnake(
    state,
    [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 },
    ],
    'right',
  );
  state.fruits = [{ pos: { x: 11, y: 10 }, type: 'cursed' } satisfies Fruit];
  tick(state);
  assert.equal(state.score, 5, 'Cursed fruit should award a flat 5 score.');
}

function expectBloodDashOnlyCostsHp(): void {
  const state = createEmptyState();
  state.relics = ['blood'];
  state.hp = 3;
  state.dashCount = 3;
  setSnake(
    state,
    [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
      { x: 5, y: 10 },
    ],
    'right',
  );

  dash(state);
  assert.equal(state.hp, 2, 'The fourth blood dash should cost 1 HP.');
  assert.equal(state.snake.length, 6, 'Blood dash should not shrink the snake.');
}

/**
 * Two runs have to feel different, and no relic may be a lie.
 *
 * The audit that prompted this: eighteen relics against up to fifteen picks a
 * run meant a run was offered **17.7 of the 18** — 98% of the pool — and two
 * runs shared **72%** of the relics they ended up carrying. For a roguelike that
 * is the whole game collapsing into one run played repeatedly.
 *
 * The second half matters just as much. Relics are now data, so it is easy to
 * add one whose text promises "能量上限 +25" while the engine never reads that
 * lever — worse than not shipping the relic, because the player is told
 * something false. Every declared `ModKey` must therefore appear in the engine.
 */
function expectRelicVarietyAndHonesty(): void {
  // No relic may advertise a lever the simulation ignores.
  // Compiled to CommonJS, so `import.meta.url` is unavailable here; resolve
  // from the repo layout instead.
  const engineSource = readFileSync(
    resolve(__dirname, '..', '..', 'src', 'game', 'engine.ts'),
    'utf8',
  );
  const used = new Set<string>();
  for (const relic of RELICS) {
    for (const key of Object.keys(relic.mods ?? {})) used.add(key);
  }
  for (const key of used) {
    assert.ok(
      engineSource.includes(`'${key}'`) || engineSource.includes(`.${key}`),
      `relics advertise "${key}" but engine.ts never reads it — the text would be a lie`,
    );
  }

  // Variety: simulate the relic draw alone, one pick per floor.
  const runs: RelicId[][] = [];
  const offered: number[] = [];
  for (let seed = 1; seed <= 120; seed++) {
    const rng = createRng(seed);
    const owned: RelicId[] = [];
    const seen = new Set<RelicId>();
    for (let pick = 0; pick < MAX_FLOOR; pick++) {
      const choices = rollRelicChoices(rng, owned, 3);
      if (choices.length === 0) break;
      choices.forEach((c) => seen.add(c));
      owned.push(choices[0]);
    }
    runs.push(owned);
    offered.push(seen.size);
  }

  const avgOffered = offered.reduce((a, b) => a + b, 0) / offered.length;
  assert.ok(
    avgOffered / RELICS.length < 0.8,
    `a run is offered ${((avgOffered / RELICS.length) * 100).toFixed(0)}% of the pool — too little is held back`,
  );

  let overlap = 0;
  let pairs = 0;
  for (let i = 0; i < 40; i++) {
    for (let j = i + 1; j < 40; j++) {
      const a = new Set(runs[i]);
      const b = new Set(runs[j]);
      const shared = [...a].filter((x) => b.has(x)).length;
      overlap += shared / new Set([...a, ...b]).size;
      pairs += 1;
    }
  }
  const avgOverlap = overlap / pairs;
  assert.ok(
    avgOverlap < 0.45,
    `two runs share ${(avgOverlap * 100).toFixed(0)}% of their build — runs are not diverging`,
  );
}

expectSpitterOnlyFiresWhenAligned();
expectCursedFruitUsesFlatScore();
expectBloodDashOnlyCostsHp();
expectRelicVarietyAndHonesty();

console.log('Roguelike Snake logic self-check passed.');
