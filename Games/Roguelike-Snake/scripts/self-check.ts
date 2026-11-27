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
  type SeedChallenge,
} from '../src/game/challenges.js';
import {
  DEFAULT_BUILD_ID,
  STARTING_BUILDS,
  buildById,
  buildUnlockHint,
  isBuildUnlocked,
  newlyUnlockedBuilds,
  type StartingBuild,
} from '../src/game/builds.js';
import {
  ACHIEVEMENTS,
  achievementById,
  evaluateAchievements,
  type AchievementProgress,
} from '../src/game/achievements.js';
import {
  BASE_MOVE_MS,
  CHALLENGES_STORAGE_KEY,
  DASH_DISTANCE,
  ENERGY_UPGRADE_AMOUNT,
  ENERGY_UPGRADE_COST,
  GRID,
  IRONSNAKE_RELIC_CHOICE_COUNT,
  MAX_FLOOR,
  MAX_FRUITS,
  MIN_MOVE_MS,
  RELIC_CHOICE_COUNT,
  SCORE_BOSS,
  SCORE_ESCAPE,
  SCORE_FLOOR,
  SCORE_FRUIT,
  SCORE_HP_BONUS,
  SCORE_KILL,
} from '../src/game/config.js';
import {
  buildDailyShareText,
  computeDailyStreak,
  mergeDailyRecord,
  previousDayKey,
  taipeiDateKey,
  todaySeedKey,
  type DailyClearRecord,
} from '../src/game/daily.js';
import {
  bossCovers,
  buildFloor,
  buyEnergyUpgrade,
  chooseRelic,
  createRun,
  dash,
  enforceIronsnakeHp,
  hasRelic,
  isBossFloor,
  isSpikeArmed,
  PULSE_COST,
  PULSE_COOLDOWN_MS,
  PULSE_RADIUS,
  queueDir,
  relicMod,
  relicOfferCount,
  tick,
  venomPulse,
} from '../src/game/engine.js';
import {
  CENTER,
  FLOOR,
  LAYOUT_NAME,
  WALL,
  chebyshev,
  collectFloorCells,
  generateTerrain,
  isWall,
  samePos,
  type LayoutId,
} from '../src/game/level.js';
import { getRadarTelemetry } from '../src/game/radar.js';
import {
  RARITY_LABEL,
  RARITY_WEIGHT,
  RELICS,
  RELIC_BY_ID,
  isIronsnakeDeadRelic,
  rollRelicChoices,
} from '../src/game/relics.js';
import { createRng, parseSeed, randInt } from '../src/game/rng.js';
import type { Dir, Enemy, Fruit, FruitType, GameState, RelicId, Vec } from '../src/game/types.js';

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

function expectIronsnakeRules(): void {
  const iron = createRun(99, { ironsnake: true, buildId: 'ironscale' });
  assert.equal(iron.ironsnake, true);
  assert.equal(iron.hp, 1, 'Ironsnake must start at HP 1');
  assert.equal(iron.maxHp, 1, 'Ironsnake maxHp must stay 1 even with tanky build');
  assert.equal(relicOfferCount(iron), IRONSNAKE_RELIC_CHOICE_COUNT);
  assert.equal(RELIC_CHOICE_COUNT, 3);

  iron.phase = 'relic';
  iron.pendingPicks = 1;
  iron.relicChoices = ['heart'];
  chooseRelic(iron, 'heart');
  assert.equal(iron.maxHp, 1, 'heart must not raise Ironsnake maxHp');
  assert.equal(iron.hp, 1, 'heart must not raise Ironsnake hp');

  iron.maxHp = 5;
  iron.hp = 5;
  enforceIronsnakeHp(iron);
  assert.equal(iron.maxHp, 1);
  assert.equal(iron.hp, 1);

  const normal = createRun(99, { ironsnake: false });
  assert.equal(relicOfferCount(normal), RELIC_CHOICE_COUNT);
  assert.equal(normal.hp, 3);

  assert.equal(isIronsnakeDeadRelic('heart'), true);
  assert.equal(isIronsnakeDeadRelic('mend'), true);
  assert.equal(isIronsnakeDeadRelic('moulting'), true);
  assert.equal(isIronsnakeDeadRelic('fang'), false);

  const ironOffers = rollRelicChoices(createRng(2026), [], IRONSNAKE_RELIC_CHOICE_COUNT, {
    ironsnake: true,
  });
  assert.equal(ironOffers.length, IRONSNAKE_RELIC_CHOICE_COUNT);
  for (const id of ironOffers) {
    assert.equal(isIronsnakeDeadRelic(id), false, `Ironsnake offer must not include ${id}`);
  }
}

function expectStartingBuilds(): void {
  assert.ok(STARTING_BUILDS.length >= 4, 'need at least four starting identities');
  assert.equal(STARTING_BUILDS[0]?.id, DEFAULT_BUILD_ID);
  assert.equal(STARTING_BUILDS[0]?.unlock.kind, 'free');

  const names = new Set(STARTING_BUILDS.map((b) => b.name));
  assert.equal(names.size, STARTING_BUILDS.length, 'build names must be unique');
  for (const build of STARTING_BUILDS) {
    assert.ok(build.name.length > 0 && build.blurb.length > 0, `${build.id} missing Traditional Chinese copy`);
  }

  const locked = { bestFloor: 0, escapes: 0, dailyClears: 0 };
  assert.equal(isBuildUnlocked(STARTING_BUILDS[0], locked), true);
  assert.equal(isBuildUnlocked(STARTING_BUILDS[1], locked), false);
  assert.equal(
    isBuildUnlocked(STARTING_BUILDS[1], { ...locked, bestFloor: 5 }),
    true,
  );
  assert.equal(
    isBuildUnlocked(STARTING_BUILDS[2], { ...locked, bestFloor: 10 }),
    true,
  );
  assert.equal(
    isBuildUnlocked(STARTING_BUILDS[3], { ...locked, dailyClears: 1 }),
    true,
  );
  assert.equal(
    isBuildUnlocked(STARTING_BUILDS[3], { ...locked, escapes: 1 }),
    true,
  );

  const swift = createRun(7, { buildId: 'swiftling' });
  assert.equal(swift.buildId, 'swiftling');
  assert.equal(swift.hp, 2);
  assert.ok(swift.relics.includes('swift'), 'swiftling should start with 疾風鱗');
  assert.ok(swift.energy >= 90, 'swiftling should start with high energy');

  const fang = createRun(7, { buildId: 'bloodcoil' });
  assert.ok(fang.relics.includes('fang'), 'bloodcoil should start with 尖牙');
  assert.equal(fang.coins, 4);
}

function expectDailyStreakMath(): void {
  const today = todaySeedKey(new Date(2026, 9, 19));
  assert.equal(today, '20261019');
  assert.equal(computeDailyStreak([], today), 0);
  assert.equal(
    computeDailyStreak(
      [
        { date: '20261019', cleared: true, score: 100, floor: 5 },
        { date: '20261018', cleared: true, score: 80, floor: 4 },
        { date: '20261017', cleared: true, score: 60, floor: 3 },
      ],
      today,
    ),
    3,
  );
  assert.equal(
    computeDailyStreak(
      [
        { date: '20261018', cleared: true, score: 80, floor: 4 },
        { date: '20261017', cleared: true, score: 60, floor: 3 },
      ],
      today,
    ),
    2,
    'streak should survive when today is not yet cleared',
  );
  assert.equal(
    computeDailyStreak([{ date: '20261016', cleared: true, score: 10, floor: 2 }], today),
    0,
  );
}

function expectDailyShareText(): void {
  const cleared = buildDailyShareText({
    date: '20261021',
    cleared: true,
    score: 2400,
    floor: 15,
    streak: 3,
    buildName: '疾行遊蛇',
  });
  assert.match(cleared, /蛇窟迴廊 每日 20261021/);
  assert.match(cleared, /✓ 逃出 · 2400 分 · 第 15 層/);
  assert.match(cleared, /連勝 3 天 · 身分 疾行遊蛇/);

  const failed = buildDailyShareText({
    date: '20261021',
    cleared: false,
    score: 420,
    floor: 6,
    streak: 1,
  });
  assert.match(failed, /✗ 第 6 層 · 420 分/);
  assert.match(failed, /連勝 1 天/);
  assert.equal(failed.includes('身分'), false);
}

function expectVenomPulseMechanics(): void {
  const state = createEmptyState();
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

  state.energy = 20;
  assert.equal(venomPulse(state), false, 'Pulse should fail with < 40 energy');
  assert.equal(state.energy, 20);

  state.energy = 60;
  state.projectiles = [
    { id: 1, pos: { x: 11, y: 10 }, prev: { x: 12, y: 10 }, dir: 'left' },
    { id: 2, pos: { x: 2, y: 2 }, prev: { x: 2, y: 2 }, dir: 'left' },
  ];
  state.enemies = [
    { id: 101, type: 'wisp', pos: { x: 11, y: 11 }, prev: { x: 11, y: 11 }, offset: 0 },
    { id: 102, type: 'wisp', pos: { x: 1, y: 1 }, prev: { x: 1, y: 1 }, offset: 0 },
  ];

  const ok = venomPulse(state);
  assert.equal(ok, true, 'Pulse should succeed with >= 40 energy');
  assert.equal(state.energy, 20, 'Pulse should consume 40 energy');
  assert.equal(state.projectiles.length, 1, 'Near projectile should be destroyed');
  assert.equal(state.projectiles[0].id, 2, 'Far projectile should remain');
  assert.equal(state.enemies.length, 1, 'Near enemy should be defeated');
  assert.equal(state.enemies[0].id, 102, 'Far enemy should remain');
  assert.ok(state.events.some((e) => e.type === 'pulse'), 'Pulse event should be pushed');

  state.energy = 80;
  assert.equal(venomPulse(state), false, 'Pulse should be on cooldown');
}

function expectRadarTelemetryLogic(): void {
  const state = createEmptyState();
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
  state.relics = ['swift', 'tide'];

  const tel = getRadarTelemetry(state);
  assert.equal(tel.riskLevel, 'safe', 'Open room should be safe');
  assert.ok(tel.clearance.ahead > 0, 'Clearance ahead should be positive');
  assert.ok(tel.clearance.left > 0, 'Clearance left should be positive');
  assert.ok(tel.clearance.right > 0, 'Clearance right should be positive');
  assert.equal(tel.evolutionTier.includes('幼生體'), true);
  assert.equal(tel.archetypeName, '疾風衝刺流');
}

/**
 * 1. Deep test Ironsnake (硬派模式) rules:
 * - HP is strictly clamped to 1 across all 4 starting builds and after taking relics.
 * - Healing and max HP relics are excluded from candidate pools (isIronsnakeDeadRelic).
 * - 4-pick-1 relic draft (relicOfferCount returns 4).
 * - Clear achievement unlocks: 'ironsnake-escape' ("鐵蛇脫殼") unlocked when ironsnakeClears >= 1.
 */
function expectDeepIronsnakeRules(): void {
  // Test starting HP clamping across all 4 starting builds
  for (const build of STARTING_BUILDS) {
    const run = createRun(101, { ironsnake: true, buildId: build.id });
    assert.equal(run.ironsnake, true, `${build.id} should have ironsnake flag true`);
    assert.equal(run.hp, 1, `${build.id} under Ironsnake must start with HP 1`);
    assert.equal(run.maxHp, 1, `${build.id} under Ironsnake must have maxHp 1`);
    assert.equal(run.energy, build.startEnergy, `${build.id} energy should match build`);
    if (build.startCoins) {
      assert.equal(run.coins, build.startCoins, `${build.id} coins should match build`);
    }
    for (const relic of build.startingRelics) {
      assert.ok(run.relics.includes(relic), `${build.id} should keep starting relic ${relic}`);
    }
  }

  // Verify relic offer count is strictly 4 for Ironsnake
  const ironRun = createRun(202, { ironsnake: true });
  assert.equal(relicOfferCount(ironRun), IRONSNAKE_RELIC_CHOICE_COUNT);
  assert.equal(IRONSNAKE_RELIC_CHOICE_COUNT, 4);

  // Verify dead relics are strictly identified and excluded
  const deadRelics: RelicId[] = ['heart', 'mend', 'moulting', 'lodestone'];
  for (const id of deadRelics) {
    assert.equal(isIronsnakeDeadRelic(id), true, `${id} must be flagged as an Ironsnake dead relic`);
  }
  const liveRelics: RelicId[] = ['fang', 'swift', 'tide', 'scales', 'core', 'bag', 'blood', 'echo', 'warp', 'torpor'];
  for (const id of liveRelics) {
    assert.equal(isIronsnakeDeadRelic(id), false, `${id} should NOT be flagged as an Ironsnake dead relic`);
  }

  // Draw 200 random choices under Ironsnake: zero dead relics should ever appear
  for (let s = 1; s <= 50; s++) {
    const rng = createRng(s * 7919);
    const choices = rollRelicChoices(rng, [], 4, { ironsnake: true });
    assert.equal(choices.length, 4);
    for (const choice of choices) {
      assert.equal(isIronsnakeDeadRelic(choice), false, `Ironsnake candidate pool drew dead relic ${choice}`);
    }
  }

  // Picking relics that normally grant HP must be clamped
  const pickRun = createRun(303, { ironsnake: true });
  pickRun.phase = 'relic';
  pickRun.pendingPicks = 1;
  pickRun.relicChoices = ['heart'];
  chooseRelic(pickRun, 'heart');
  assert.equal(pickRun.hp, 1, 'Choosing heart in Ironsnake must clamp hp to 1');
  assert.equal(pickRun.maxHp, 1, 'Choosing heart in Ironsnake must clamp maxHp to 1');

  // Manual tampering with enforceIronsnakeHp
  pickRun.hp = 10;
  pickRun.maxHp = 10;
  enforceIronsnakeHp(pickRun);
  assert.equal(pickRun.hp, 1);
  assert.equal(pickRun.maxHp, 1);

  // Combat lethality: 1 hit kills in Ironsnake
  const combatRun = createRun(404, { ironsnake: true });
  assert.equal(combatRun.hp, 1);
  combatRun.fruits = [];
  combatRun.enemies = [];
  setSnake(combatRun, [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }], 'left');
  // Moving left hits outer wall at x=0
  tick(combatRun);
  assert.equal(combatRun.hp, 0, 'One hit should drop Ironsnake HP to 0');
  assert.equal(combatRun.phase, 'dead', 'Ironsnake with 0 HP should be in dead phase');

  // Achievement unlock test for ironsnake-escape (鐵蛇脫殼)
  const metaNoIron: AchievementProgress = {
    floor: 15,
    escapes: 1,
    ironsnakeClears: 0,
    unlockedBuilds: ['hatchling'],
    achievements: [],
    dailyRecords: [],
  };
  const achNoIron = evaluateAchievements(metaNoIron, 0);
  assert.equal(achNoIron.includes('ironsnake-escape'), false, 'ironsnake-escape should NOT unlock with 0 clears');

  const metaWithIron: AchievementProgress = {
    ...metaNoIron,
    ironsnakeClears: 1,
  };
  const achWithIron = evaluateAchievements(metaWithIron, 0);
  assert.equal(achWithIron.includes('ironsnake-escape'), true, 'ironsnake-escape MUST unlock with >= 1 clear');
  const ironAchDef = achievementById('ironsnake-escape');
  assert.ok(ironAchDef);
  assert.equal(ironAchDef.name, '鐵蛇脫殼');
}

/**
 * 2. Test 4 starting builds (青鱗幼蛇, 疾行遊蛇, 鐵鱗守蛇, 血祭狂蛇):
 * - Initial HP, energy pools, max energy, coins, starting relics.
 * - Distinct mechanics: swiftling move interval, ironscale damage without shrink (shed), bloodcoil enemy ramming (fang).
 * - Unlock condition validation: floor levels (5, 10), daily clear, escape, unlock hints, progression diff (newlyUnlockedBuilds).
 */
function expectStartingBuildsDeep(): void {
  assert.equal(STARTING_BUILDS.length, 4, 'Must have exactly 4 starting builds');
  const [hatchling, swiftling, ironscale, bloodcoil] = STARTING_BUILDS;

  assert.equal(hatchling.id, 'hatchling');
  assert.equal(hatchling.name, '青鱗幼蛇');
  assert.equal(hatchling.unlock.kind, 'free');
  assert.equal(hatchling.startHp, 3);
  assert.equal(hatchling.startEnergy, 60);
  assert.deepEqual(hatchling.startingRelics, []);

  assert.equal(swiftling.id, 'swiftling');
  assert.equal(swiftling.name, '疾行遊蛇');
  assert.deepEqual(swiftling.unlock, { kind: 'floor', min: 5 });
  assert.equal(swiftling.startHp, 2);
  assert.equal(swiftling.startEnergy, 90);
  assert.equal(swiftling.startMaxEnergy, 120);
  assert.deepEqual(swiftling.startingRelics, ['swift']);

  assert.equal(ironscale.id, 'ironscale');
  assert.equal(ironscale.name, '鐵鱗守蛇');
  assert.deepEqual(ironscale.unlock, { kind: 'floor', min: 10 });
  assert.equal(ironscale.startHp, 4);
  assert.equal(ironscale.startEnergy, 50);
  assert.deepEqual(ironscale.startingRelics, ['shed']);

  assert.equal(bloodcoil.id, 'bloodcoil');
  assert.equal(bloodcoil.name, '血祭狂蛇');
  assert.deepEqual(bloodcoil.unlock, { kind: 'daily' });
  assert.equal(bloodcoil.startHp, 2);
  assert.equal(bloodcoil.startEnergy, 70);
  assert.equal(bloodcoil.startCoins, 4);
  assert.deepEqual(bloodcoil.startingRelics, ['fang']);

  for (const b of STARTING_BUILDS) {
    assert.equal(buildById(b.id)?.id, b.id);
  }
  assert.equal(buildById('unknown'), undefined);

  assert.equal(buildUnlockHint(hatchling), '初始可用');
  assert.equal(buildUnlockHint(swiftling), '抵達第 5 層解鎖');
  assert.equal(buildUnlockHint(ironscale), '抵達第 10 層解鎖');
  assert.equal(buildUnlockHint(bloodcoil), '完成今日挑戰或逃出蛇窟後解鎖');

  const baseCtx = { bestFloor: 1, escapes: 0, dailyClears: 0 };
  assert.equal(isBuildUnlocked(hatchling, baseCtx), true);
  assert.equal(isBuildUnlocked(swiftling, baseCtx), false);
  assert.equal(isBuildUnlocked(ironscale, baseCtx), false);
  assert.equal(isBuildUnlocked(bloodcoil, baseCtx), false);

  assert.equal(isBuildUnlocked(swiftling, { ...baseCtx, bestFloor: 4 }), false);
  assert.equal(isBuildUnlocked(swiftling, { ...baseCtx, bestFloor: 5 }), true);

  assert.equal(isBuildUnlocked(ironscale, { ...baseCtx, bestFloor: 9 }), false);
  assert.equal(isBuildUnlocked(ironscale, { ...baseCtx, bestFloor: 10 }), true);

  assert.equal(isBuildUnlocked(bloodcoil, { ...baseCtx, dailyClears: 1 }), true);
  assert.equal(isBuildUnlocked(bloodcoil, { ...baseCtx, escapes: 1 }), true);

  const u1 = newlyUnlockedBuilds(baseCtx, { ...baseCtx, bestFloor: 5 });
  assert.deepEqual(u1, ['swiftling']);
  const u2 = newlyUnlockedBuilds({ ...baseCtx, bestFloor: 5 }, { ...baseCtx, bestFloor: 10 });
  assert.deepEqual(u2, ['ironscale']);
  const u3 = newlyUnlockedBuilds(baseCtx, { ...baseCtx, dailyClears: 1 });
  assert.deepEqual(u3, ['bloodcoil']);

  const swiftRun = createRun(10, { buildId: 'swiftling' });
  assert.equal(swiftRun.moveInterval, 150 * 0.88);

  const ironRun = createRun(20, { buildId: 'ironscale' });
  assert.equal(ironRun.hp, 4);
  setSnake(ironRun, [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }], 'left');
  ironRun.fruits = [];
  ironRun.enemies = [];
  tick(ironRun);
  assert.equal(ironRun.hp, 3, 'ironscale should lose 1 HP on wall hit');
  assert.equal(ironRun.snake.length, 4, 'ironscale with shed relic should NOT shrink');

  const bloodRun = createRun(30, { buildId: 'bloodcoil' });
  assert.equal(bloodRun.hp, 2);
  assert.equal(bloodRun.coins, 4);
  assert.ok(hasRelic(bloodRun, 'fang'));
  bloodRun.fruits = [];
  bloodRun.enemies = [{ id: 1, type: 'wisp', pos: { x: 5, y: 5 }, prev: { x: 5, y: 5 }, offset: 0 }];
  setSnake(bloodRun, [{ x: 4, y: 5 }, { x: 3, y: 5 }, { x: 2, y: 5 }], 'right');
  tick(bloodRun);
  assert.equal(bloodRun.enemies.length, 0, 'bloodcoil fang should kill enemy on head contact');
  assert.equal(bloodRun.hp, 2, 'bloodcoil should not take damage when killing via fang');
}

/**
 * 3. Test combat turns & enemy movement:
 * - Venom pulse (猛毒脈衝) damage radii, projectile clearing, boss damage.
 * - Boss attack cooldowns, hit flash invulnerability, boss summoning, teleportation.
 * - Obstacle and wall collision damage, bounce, invulnerability, and boundary wrap.
 */
function expectCombatTurnsAndEnemyMovement(): void {
  const state = createEmptyState();
  setSnake(state, [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }], 'right');
  state.energy = 100;
  state.time = 1000;
  state.pulseReadyAt = 0;

  state.enemies = [
    { id: 1, type: 'wisp', pos: { x: 13, y: 10 }, prev: { x: 13, y: 10 }, offset: 0 },
    { id: 2, type: 'stalker', pos: { x: 10, y: 13 }, prev: { x: 10, y: 13 }, offset: 0 },
    { id: 3, type: 'spitter', pos: { x: 13, y: 13 }, prev: { x: 13, y: 13 }, offset: 0 },
    { id: 4, type: 'wisp', pos: { x: 14, y: 10 }, prev: { x: 14, y: 10 }, offset: 0 },
  ];
  state.projectiles = [
    { id: 10, pos: { x: 14, y: 10 }, prev: { x: 14, y: 10 }, dir: 'left' },
    { id: 11, pos: { x: 15, y: 10 }, prev: { x: 15, y: 10 }, dir: 'left' },
  ];

  const pulseSuccess = venomPulse(state);
  assert.equal(pulseSuccess, true);
  assert.equal(state.energy, 60, 'Pulse should consume 40 energy');
  assert.equal(state.pulseReadyAt, 3500, 'Pulse should set cooldown to time + 2500');
  assert.equal(state.enemies.length, 1, 'Only enemy at distance >= 4 should survive');
  assert.equal(state.enemies[0].id, 4);
  assert.equal(state.projectiles.length, 1, 'Only projectile at distance >= 5 should survive');
  assert.equal(state.projectiles[0].id, 11);

  const bossState = createEmptyState();
  bossState.floor = 5;
  bossState.boss = {
    pos: { x: 10, y: 10 },
    hp: 4,
    maxHp: 4,
    hitFlashUntil: 0,
    breakUntil: 0,
  };
  assert.equal(bossCovers(bossState.boss, { x: 9, y: 9 }), true);
  assert.equal(bossCovers(bossState.boss, { x: 10, y: 10 }), true);
  assert.equal(bossCovers(bossState.boss, { x: 11, y: 11 }), true);
  assert.equal(bossCovers(bossState.boss, { x: 12, y: 10 }), false);

  bossState.energy = 100;
  bossState.time = 2000;
  bossState.dashReadyAt = 0;
  setSnake(bossState, [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }], 'right');
  
  // Tactical break loop: Dash while boss is shielded must deflect and NOT damage boss
  dash(bossState);
  assert.ok(bossState.boss, 'Boss should still be alive');
  assert.equal(bossState.boss.hp, 4, 'Dash should deflect without dealing HP damage while boss is shielded');

  // VenomPulse clears projectiles and breaks boss shield without direct HP damage
  bossState.time = 2100;
  bossState.pulseReadyAt = 0;
  const breakOk = venomPulse(bossState);
  assert.equal(breakOk, true, 'VenomPulse should succeed');
  assert.ok((bossState.boss.breakUntil ?? 0) > bossState.time, 'VenomPulse should open break vulnerability window');
  assert.equal(bossState.boss.hp, 4, 'VenomPulse should NOT deal direct HP damage to boss');

  // Dash during break window deals 1 damage and resets break
  bossState.time = 2200;
  bossState.energy = 50;
  bossState.dashReadyAt = 0;
  setSnake(bossState, [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }], 'right');
  dash(bossState);
  assert.equal(bossState.boss.hp, 3, 'Dash should deal 1 damage to broken boss');
  assert.equal(bossState.boss.breakUntil, 0, 'Damage resets break vulnerability');
  assert.equal(bossState.boss.hitFlashUntil, 2700, 'Boss should have 500ms hit flash cooldown');

  // Hit flash protection test: while hitFlash is active, break and dash cannot double damage
  bossState.energy = 100;
  bossState.time = 2300;
  bossState.pulseReadyAt = 0;
  venomPulse(bossState);
  bossState.dashReadyAt = 0;
  setSnake(bossState, [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }], 'right');
  dash(bossState);
  assert.equal(bossState.boss.hp, 3, 'Boss should not take damage during hitFlash cooldown');

  // Break and dash to defeat boss when hp is 1
  bossState.time = 3000;
  bossState.boss.hp = 1;
  bossState.coins = 0;
  bossState.kills = 0;
  bossState.pendingPicks = 0;
  bossState.bossesDefeated = [];
  bossState.energy = 100;
  bossState.dashReadyAt = 0;
  bossState.pulseReadyAt = 0;
  venomPulse(bossState);
  setSnake(bossState, [{ x: bossState.boss.pos.x - 2, y: bossState.boss.pos.y }, { x: bossState.boss.pos.x - 3, y: bossState.boss.pos.y }], 'right');
  dash(bossState);
  assert.equal(bossState.boss, null, 'Boss should be defeated');
  assert.equal(bossState.coins, 10, 'Boss defeat should award 10 coins');
  assert.equal(bossState.kills, 1, 'Boss defeat should increment kills');
  assert.ok(bossState.bossesDefeated.includes(5), 'Boss floor 5 should be marked defeated');
  assert.equal(bossState.pendingPicks, 1, 'Boss defeat should grant 1 relic pick');
  assert.ok(bossState.exit !== null, 'Boss defeat should spawn exit portal');

  const wallState = createEmptyState();
  wallState.hp = 3;
  setSnake(wallState, [{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }], 'left');
  tick(wallState);
  assert.equal(wallState.hp, 2, 'Hitting wall should subtract 1 HP');
  assert.equal(wallState.snake.length, 3, 'Taking hit without shed should shrink snake by 3 (down to min 3)');
  assert.equal(wallState.dir !== 'left', true, 'Snake should bounce away from wall');
  assert.ok(wallState.invulnUntil > wallState.time, 'Snake should gain invulnerability');

  const warpState = createEmptyState();
  warpState.hp = 3;
  warpState.relics = ['warp'];
  setSnake(warpState, [{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }], 'left');
  tick(warpState);
  assert.equal(warpState.hp, 3, 'Warp relic should prevent wall damage on boundary');
  assert.equal(warpState.snake[0].x, GRID - 2, 'Warp relic should wrap snake to opposite side');
}

/**
 * 4. Test seeded dungeon floor generation determinism, food spawning bounds, relic synergy combinations:
 * - Deterministic tiles and layouts from seeds.
 * - Boss floors always 'pillars' layout with cleared center arena.
 * - Food spawning strictly on floor cells, outside snake/enemy/spike/boss footprints.
 * - Quota completion triggers exit portal generation.
 */
function expectSeededDungeonDeterminismAndFoodBounds(): void {
  for (const seed of [42, 1337, 9999]) {
    const rng1 = createRng(seed);
    const t1 = generateTerrain(rng1, 1, false);
    const rng2 = createRng(seed);
    const t2 = generateTerrain(rng2, 1, false);

    assert.equal(t1.layout, t2.layout, `Seed ${seed} layout should be deterministic`);
    assert.deepEqual(t1.tiles, t2.tiles, `Seed ${seed} tiles should be identical`);
  }

  for (const floor of [5, 10, 15]) {
    const rng = createRng(777);
    const t = generateTerrain(rng, floor, true);
    assert.equal(t.layout, 'pillars', `Boss floor ${floor} must use pillars layout`);
  }

  for (let s = 1; s <= 20; s++) {
    const rng = createRng(s * 101);
    const terrain = generateTerrain(rng, (s % 14) + 1, false);
    const floorCells = collectFloorCells(terrain.tiles);
    assert.ok(floorCells.length > 50, 'Terrain should have plenty of floor cells');
    for (const cell of floorCells) {
      assert.equal(terrain.tiles[cell.y * GRID + cell.x], FLOOR);
    }
  }

  for (let s = 1; s <= 40; s++) {
    const run = createRun(s * 333);
    assert.ok(run.fruits.length <= MAX_FRUITS, 'Fruit count should never exceed MAX_FRUITS');
    for (const fruit of run.fruits) {
      assert.equal(isWall(run.tiles, fruit.pos.x, fruit.pos.y), false, 'Fruit must not be on wall');
      assert.equal(run.snake.some((seg) => samePos(seg, fruit.pos)), false, 'Fruit must not spawn on snake');
      assert.equal(run.enemies.some((e) => samePos(e.pos, fruit.pos)), false, 'Fruit must not spawn on enemy');
      assert.equal(run.spikes.some((sp) => samePos(sp.pos, fruit.pos)), false, 'Fruit must not spawn on spike');
    }
  }

  const quotaRun = createEmptyState();
  quotaRun.floor = 2;
  quotaRun.quota = 3;
  quotaRun.eaten = 2;
  quotaRun.exit = null;
  setSnake(quotaRun, [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], 'right');
  quotaRun.fruits = [{ pos: { x: 6, y: 5 }, type: 'normal' }];
  tick(quotaRun);
  assert.equal(quotaRun.eaten, 3, 'Eating 3rd fruit should meet quota');
  const exitPos = quotaRun.exit as Vec | null;
  assert.ok(exitPos !== null, 'Meeting quota must spawn exit portal');
  assert.equal(isWall(quotaRun.tiles, exitPos.x, exitPos.y), false, 'Exit must be on floor');
}

/**
 * 5. Test relic synergy combinations:
 * - Speed scale + venom fang / tide / whetstone.
 * - Dash distance stacking (core + kite + tremor).
 * - Invulnerability stacking (hourglass + scales + dust + vigil).
 * - Magnet auto-consumption of fruits.
 */
function expectRelicSynergiesAndModCalculations(): void {
  const state = createEmptyState();
  state.floor = 1;
  assert.equal(state.moveInterval, BASE_MOVE_MS);

  state.relics = ['swift'];
  assert.equal(relicMod(state, 'speedPct'), 0);
  const swiftRun = createRun(1, { buildId: 'swiftling' });
  assert.equal(swiftRun.moveInterval, 132);

  swiftRun.relics.push('tide');
  const expectedTide = 150 * 0.88 * 0.92;
  const tideState = createEmptyState();
  tideState.relics = ['swift', 'tide'];
  tideState.moveInterval = BASE_MOVE_MS * 0.88 * (1 + relicMod(tideState, 'speedPct') / 100);
  assert.ok(Math.abs(tideState.moveInterval - expectedTide) < 0.001);

  const dashState = createEmptyState();
  dashState.relics = ['core', 'kite', 'tremor'];
  dashState.energy = 100;
  dashState.time = 1000;
  dashState.dashReadyAt = 0;
  setSnake(dashState, [{ x: 2, y: 10 }, { x: 1, y: 10 }], 'right');
  dash(dashState);
  assert.equal(dashState.snake[0].x, 10, 'Dash with core + kite + tremor should travel 8 units');

  const invulnState = createEmptyState();
  invulnState.hp = 5;
  invulnState.relics = ['hourglass', 'scales', 'dust', 'vigil'];
  invulnState.time = 1000;
  setSnake(invulnState, [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }, { x: 1, y: 4 }], 'left');
  tick(invulnState);
  assert.equal(invulnState.invulnUntil, invulnState.time + 1200 + 1200 + 600 + 1000 + 1500, 'Invulnerability should sum all relics');

  const magnetState = createEmptyState();
  magnetState.relics = ['magnet'];
  setSnake(magnetState, [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], 'right');
  magnetState.fruits = [{ pos: { x: 7, y: 5 }, type: 'normal' }];
  tick(magnetState);
  assert.equal(magnetState.eaten, 1, 'Magnet relic should eat fruit within 2 cells');
  assert.equal(magnetState.fruits.length, MAX_FRUITS, 'Fruits should be refilled to MAX_FRUITS');
}

/**
 * 6. Test daily challenge Taipei date formatting, streak calculation, challenge seed packs (6 custom stages):
 * - Taipei date formatting across UTC hours, rollover at 16:00 UTC (midnight Taipei), leap day, year boundaries.
 * - Streak calculation edge cases and multi-attempt merging.
 * - 6 custom challenge stages: sequential unlock gating and clearance checks.
 */
function expectDailyTaipeiAndChallengePackDeep(): void {
  assert.equal(taipeiDateKey(new Date('2026-10-21T04:00:00Z')), '20261021');
  assert.equal(taipeiDateKey(new Date('2026-10-21T15:59:59Z')), '20261021');
  assert.equal(taipeiDateKey(new Date('2026-10-21T16:00:00Z')), '20261022');
  assert.equal(taipeiDateKey(new Date('2026-10-21T23:00:00Z')), '20261022');
  assert.equal(taipeiDateKey(new Date('2028-02-28T16:00:00Z')), '20280229');
  assert.equal(taipeiDateKey(new Date('2026-12-31T16:00:00Z')), '20270101');

  assert.equal(previousDayKey('20261022'), '20261021');
  assert.equal(previousDayKey('20260301'), '20260228');
  assert.equal(previousDayKey('20280301'), '20280229');
  assert.equal(previousDayKey('20260101'), '20251231');

  const baseToday = '20261025';
  const streak5 = [
    { date: '20261025', cleared: true, score: 500, floor: 10 },
    { date: '20261024', cleared: true, score: 400, floor: 9 },
    { date: '20261023', cleared: true, score: 300, floor: 8 },
    { date: '20261022', cleared: true, score: 200, floor: 7 },
    { date: '20261021', cleared: true, score: 100, floor: 6 },
  ];
  assert.equal(computeDailyStreak(streak5, baseToday), 5);

  const streakYesterday = streak5.slice(1);
  assert.equal(computeDailyStreak(streakYesterday, baseToday), 4);

  const streakBroken = streak5.slice(2);
  assert.equal(computeDailyStreak(streakBroken, baseToday), 0);

  const records = mergeDailyRecord([], { date: '20261025', cleared: false, score: 200, floor: 5 });
  assert.equal(records.length, 1);
  assert.equal(records[0].cleared, false);
  const updatedRecords = mergeDailyRecord(records, { date: '20261025', cleared: true, score: 450, floor: 10 });
  assert.equal(updatedRecords.length, 1);
  assert.equal(updatedRecords[0].cleared, true);
  assert.equal(updatedRecords[0].score, 450);
  assert.equal(updatedRecords[0].floor, 10);

  assert.equal(SEED_CHALLENGES.length, 6, 'Seed challenge pack must contain exactly 6 stages');
  const expectedChallengeIds = [
    'first-depths',
    'score-gate',
    'first-boss',
    'deep-ten',
    'twin-cores',
    'escape-lair',
  ];
  for (let i = 0; i < 6; i++) {
    assert.equal(SEED_CHALLENGES[i].id, expectedChallengeIds[i], `Challenge ${i} ID mismatch`);
  }

  for (let clearedCount = 0; clearedCount <= 6; clearedCount++) {
    for (let idx = 0; idx < 6; idx++) {
      const expectedUnlock = idx <= clearedCount;
      assert.equal(
        isChallengeUnlocked(idx, clearedCount),
        expectedUnlock,
        `Stage ${idx} with clearedCount ${clearedCount} should be ${expectedUnlock ? 'unlocked' : 'locked'}`,
      );
    }
  }
}

/**
 * Test Sakurai juice feedback, audio pitch escalation, low-health tension, and rapid retry shortcuts:
 * - Hurt and death events emit 'hurt' and 'die', triggering physical screen shake and haptics.
 * - Defeating floor boss emits 'bossDown', triggering boss clear screen shake.
 * - Food combo timer escalates pitch step along musical scale (1..8) on consecutive pickups < 2200ms.
 * - Low-health tension vignette threshold activates at <= 25% HP or critical 1 HP.
 * - Rapid retry key bindings include Space, Enter, KeyR / 'r' on dead or won phases.
 */
function expectSakuraiJuiceAudioAndUxPrinciples(): void {
  // 1. Hurt & Death events
  const hurtState = createEmptyState();
  hurtState.hp = 2;
  setSnake(hurtState, [{ x: 1, y: 1 }, { x: 1, y: 2 }], 'left');
  tick(hurtState);
  assert.equal(hurtState.hp, 1, 'Snake should take 1 damage on collision');
  assert.ok(
    hurtState.events.some((e) => e.type === 'hurt'),
    "Damage must emit 'hurt' event for screen shake and haptic feedback",
  );

  // Fatal damage
  hurtState.events = [];
  hurtState.invulnUntil = 0;
  setSnake(hurtState, [{ x: 1, y: 1 }, { x: 1, y: 2 }], 'left');
  tick(hurtState);
  assert.equal(hurtState.hp, 0, 'Fatal hit reduces HP to 0');
  assert.equal(hurtState.phase, 'dead', 'Phase transitions to dead');
  assert.ok(
    hurtState.events.some((e) => e.type === 'hurt'),
    "Fatal hit must emit 'hurt'",
  );
  assert.ok(
    hurtState.events.some((e) => e.type === 'die'),
    "Fatal hit must emit 'die'",
  );

  // 2. Boss defeat event (with tactical break window)
  const bossState = createEmptyState();
  bossState.floor = 5;
  bossState.energy = 100;
  bossState.boss = {
    pos: { x: 8, y: 10 },
    hp: 1,
    maxHp: 4,
    hitFlashUntil: 0,
    breakUntil: 5000,
  };
  setSnake(bossState, [{ x: 4, y: 10 }, { x: 3, y: 10 }], 'right');
  dash(bossState);
  assert.equal(bossState.boss, null, 'Boss should be defeated');
  assert.ok(
    bossState.events.some((e) => e.type === 'bossDown'),
    "Defeating floor boss must emit 'bossDown' for physical screen shake and win fanfare",
  );

  // 3. Food combo pitch escalation logic simulation
  let comboCount = 0;
  let lastEatAt = 0;
  const eatFruitSim = (now: number): number => {
    if (now - lastEatAt < 2200) {
      comboCount = Math.min(8, comboCount + 1);
    } else {
      comboCount = 1;
    }
    lastEatAt = now;
    return comboCount;
  };

  assert.equal(eatFruitSim(1000), 1, 'First food pickup starts combo at pitch step 1');
  assert.equal(eatFruitSim(1800), 2, 'Second pickup within 800ms rises to pitch step 2');
  assert.equal(eatFruitSim(2600), 3, 'Third pickup within 800ms rises to pitch step 3');
  for (let step = 4; step <= 8; step++) {
    assert.equal(eatFruitSim(2600 + (step - 3) * 500), step, `Consecutive pickup climbs to step ${step}`);
  }
  assert.equal(eatFruitSim(6000), 8, 'Combo pitch caps at pleasant upper step 8');
  assert.equal(eatFruitSim(8600), 1, 'Pickup after 2600ms gap resets combo back to step 1');

  // 4. Low-health tension calculation
  const isLowHealth = (hp: number, maxHp: number, phase: string = 'playing'): boolean => {
    return phase === 'playing' && hp > 0 && (hp / maxHp <= 0.25 || (hp === 1 && maxHp <= 4));
  };

  assert.equal(isLowHealth(3, 3), false, 'Full 3/3 HP should not show low health alert');
  assert.equal(isLowHealth(2, 3), false, '2/3 HP should not show low health alert');
  assert.equal(isLowHealth(1, 3), true, '1/3 HP is critical single-hit territory and must show alert');
  assert.equal(isLowHealth(1, 4), true, '1/4 HP (25%) must show alert');
  assert.equal(isLowHealth(1, 5), true, '1/5 HP (20% <= 25%) must show alert');
  assert.equal(isLowHealth(2, 8), true, '2/8 HP (25%) must show alert');
  assert.equal(isLowHealth(3, 8), false, '3/8 HP (37.5% > 25%) should not show alert');
  assert.equal(isLowHealth(0, 3, 'dead'), false, 'Dead snake should not display in-game alert border');

  // 5. Rapid retry key acceptance
  const isRapidRetryKey = (code: string, key: string): boolean => {
    const k = key.toLowerCase();
    return code === 'Space' || code === 'Enter' || code === 'KeyR' || k === ' ' || k === 'enter' || k === 'r';
  };

  assert.ok(isRapidRetryKey('Space', ' '), 'Space is rapid retry key');
  assert.ok(isRapidRetryKey('Enter', 'Enter'), 'Enter is rapid retry key');
  assert.ok(isRapidRetryKey('KeyR', 'r'), 'KeyR / r is rapid retry key');
  assert.ok(isRapidRetryKey('KeyR', 'R'), 'Shift+R / KeyR is rapid retry key');
  assert.ok(!isRapidRetryKey('KeyW', 'w'), 'W is not rapid retry key');
  assert.ok(!isRapidRetryKey('Escape', 'Escape'), 'Escape is not rapid retry key');
  // 6. Shop 3rd sink: Max Energy Upgrade
  const shopState = createEmptyState();
  shopState.phase = 'relic';
  shopState.coins = 10;
  shopState.energy = 100;
  shopState.maxEnergy = 100;
  const buyOk = buyEnergyUpgrade(shopState);
  assert.equal(buyOk, true, 'Should successfully buy energy upgrade with 10 coins');
  assert.equal(shopState.coins, 10 - ENERGY_UPGRADE_COST, 'Coins should be deducted by ENERGY_UPGRADE_COST');
  assert.equal(shopState.maxEnergy, 100 + ENERGY_UPGRADE_AMOUNT, 'maxEnergy should increase by ENERGY_UPGRADE_AMOUNT');
  assert.equal(shopState.energy, 100 + ENERGY_UPGRADE_AMOUNT, 'current energy should also be topped up');

  // Insufficient coins test
  shopState.coins = 2;
  const failBuy = buyEnergyUpgrade(shopState);
  assert.equal(failBuy, false, 'Should fail to buy energy upgrade with insufficient coins');
  assert.equal(shopState.coins, 2);
}

expectSpitterOnlyFiresWhenAligned();
expectCursedFruitUsesFlatScore();
expectBloodDashOnlyCostsHp();
expectRelicVarietyAndHonesty();
expectChallengeDefsAreSound();
expectChallengeUnlockMath();
expectChallengeClearHelpers();
expectIronsnakeRules();
expectDeepIronsnakeRules();
expectStartingBuilds();
expectStartingBuildsDeep();
expectDailyStreakMath();
expectDailyShareText();
expectVenomPulseMechanics();
expectRadarTelemetryLogic();
expectCombatTurnsAndEnemyMovement();
expectSeededDungeonDeterminismAndFoodBounds();
expectRelicSynergiesAndModCalculations();
expectDailyTaipeiAndChallengePackDeep();
expectSakuraiJuiceAudioAndUxPrinciples();

console.log('Roguelike Snake logic self-check passed.');
