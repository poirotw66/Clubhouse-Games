import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EMPTY_CHALLENGE_PROGRESS,
  SEED_CHALLENGES,
  applyChallengeResult,
  challengeById,
  challengeCount,
  continueChallengeIndex,
  isChallengeCleared,
  isChallengeUnlocked,
} from '../src/game/challenges.js';
import { CHALLENGES_STORAGE_KEY, MAX_FLOOR } from '../src/game/config.js';
import { createRun, dash, tick } from '../src/game/engine.js';
import { RELICS, rollRelicChoices } from '../src/game/relics.js';
import { createRng, parseSeed } from '../src/game/rng.js';
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

function floor1Signature(state: GameState): string {
  return [
    state.layout,
    state.quota,
    state.snake.map((p) => `${p.x},${p.y}`).join(';'),
    [...state.tiles].join(''),
  ].join('|');
}

function expectChallengeDefsAreSound(): void {
  assert.equal(CHALLENGES_STORAGE_KEY, 'clubhouse:roguelike-snake:challenges');
  assert.ok(SEED_CHALLENGES.length >= 4 && SEED_CHALLENGES.length <= 8, 'pack size out of range');
  assert.equal(challengeCount(), SEED_CHALLENGES.length);

  const ids = SEED_CHALLENGES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'two challenges share an id');

  const seeds = SEED_CHALLENGES.map((c) => c.seedInput);
  assert.equal(new Set(seeds).size, seeds.length, 'two challenges share a seed');

  const goalKinds = new Set(SEED_CHALLENGES.map((c) => c.goal.kind));
  assert.ok(goalKinds.has('floor'), 'pack should include a floor goal');
  assert.ok(goalKinds.has('boss'), 'pack should include a boss goal');
  assert.ok(goalKinds.has('escape'), 'pack should include an escape goal');

  for (const challenge of SEED_CHALLENGES) {
    assert.ok(challenge.name.length > 0 && challenge.blurb.length > 0, `${challenge.id} missing copy`);
    assert.ok(challenge.goalLabel.length > 0, `${challenge.id} missing goal label`);
    assert.ok(/^[a-z0-9]{6,12}$/i.test(challenge.seedInput), `${challenge.id} seed looks wrong`);
    assert.ok(challengeById(challenge.id)?.id === challenge.id, `${challenge.id} lookup failed`);

    const a = createRun(parseSeed(challenge.seedInput), {
      challengeId: challenge.id,
      seedInput: challenge.seedInput,
    });
    const b = createRun(parseSeed(challenge.seedInput), {
      challengeId: challenge.id,
      seedInput: challenge.seedInput,
    });
    assert.equal(a.seed, b.seed, `${challenge.id} seed parse drifted`);
    assert.equal(
      floor1Signature(a),
      floor1Signature(b),
      `${challenge.id} floor-1 layout is not deterministic`,
    );
    assert.equal(a.challengeId, challenge.id);
    assert.equal(a.seedInput, challenge.seedInput);
  }
}

function expectChallengeUnlockMath(): void {
  assert.equal(isChallengeUnlocked(0, 0), true);
  assert.equal(isChallengeUnlocked(1, 0), false);
  assert.equal(isChallengeUnlocked(1, 1), true);
  assert.equal(isChallengeUnlocked(99, SEED_CHALLENGES.length), false);
  assert.equal(continueChallengeIndex(0), 0);
  assert.equal(continueChallengeIndex(2), 2);
  assert.equal(continueChallengeIndex(SEED_CHALLENGES.length), SEED_CHALLENGES.length - 1);
}

function finishedShell(
  challengeId: string,
  seedInput: string,
  patch: Partial<GameState>,
): GameState {
  const state = createRun(parseSeed(seedInput), { challengeId, seedInput });
  Object.assign(state, patch);
  return state;
}

function expectChallengeClearHelpers(): void {
  const first = SEED_CHALLENGES[0];
  assert.ok(first.goal.kind === 'floor');

  const clearedFloor = finishedShell(first.id, first.seedInput, {
    phase: 'dead',
    floor: first.goal.min,
    score: 120,
  });
  assert.equal(isChallengeCleared(first, clearedFloor), true);

  const shyFloor = finishedShell(first.id, first.seedInput, {
    phase: 'dead',
    floor: Math.max(1, first.goal.min - 1),
    score: 40,
  });
  assert.equal(isChallengeCleared(first, shyFloor), false);

  const scoreCard = SEED_CHALLENGES.find((c) => c.goal.kind === 'score');
  assert.ok(scoreCard && scoreCard.goal.kind === 'score');
  const scoreOk = finishedShell(scoreCard.id, scoreCard.seedInput, {
    phase: 'dead',
    floor: 4,
    score: scoreCard.goal.min,
  });
  assert.equal(isChallengeCleared(scoreCard, scoreOk), true);

  const bossCard = SEED_CHALLENGES.find((c) => c.goal.kind === 'boss' && c.goal.floor === 5);
  assert.ok(bossCard && bossCard.goal.kind === 'boss');
  const bossOk = finishedShell(bossCard.id, bossCard.seedInput, {
    phase: 'dead',
    floor: 6,
    bossesDefeated: [5],
    score: 900,
  });
  assert.equal(isChallengeCleared(bossCard, bossOk), true);
  const bossMiss = finishedShell(bossCard.id, bossCard.seedInput, {
    phase: 'dead',
    floor: 5,
    bossesDefeated: [],
    score: 400,
  });
  assert.equal(isChallengeCleared(bossCard, bossMiss), false);

  const escape = SEED_CHALLENGES.find((c) => c.goal.kind === 'escape');
  assert.ok(escape);
  const escaped = finishedShell(escape.id, escape.seedInput, {
    phase: 'won',
    floor: MAX_FLOOR,
    endless: false,
    bossesDefeated: [5, 10, 15],
    score: 5000,
  });
  assert.equal(isChallengeCleared(escape, escaped), true);

  const fromZero = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, 0, clearedFloor);
  assert.equal(fromZero.cleared, true);
  assert.equal(fromZero.progress.clearedCount, 1);
  assert.ok(fromZero.progress.cleared[first.id]);

  const late = SEED_CHALLENGES[3];
  const lateRun = finishedShell(late.id, late.seedInput, {
    phase: 'dead',
    floor: late.goal.kind === 'floor' ? late.goal.min : 12,
    bossesDefeated: late.goal.kind === 'boss' ? [late.goal.floor] : [5, 10],
    score: 2000,
  });
  const outOfOrder = applyChallengeResult(EMPTY_CHALLENGE_PROGRESS, 3, lateRun);
  assert.equal(
    outOfOrder.progress.clearedCount,
    0,
    'clearing a locked challenge must not advance the cursor',
  );
}

expectSpitterOnlyFiresWhenAligned();
expectCursedFruitUsesFlatScore();
expectBloodDashOnlyCostsHp();
expectRelicVarietyAndHonesty();
expectChallengeDefsAreSound();
expectChallengeUnlockMath();
expectChallengeClearHelpers();

console.log('Roguelike Snake logic self-check passed.');
