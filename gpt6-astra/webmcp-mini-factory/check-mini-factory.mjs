#!/usr/bin/env node
/**
 * Campaign / progress logic check for WebMCP Mini Factory.
 */
import assert from 'node:assert/strict';
import {
  LEVELS,
  LEGACY_LAYOUT_KEY,
  MACHINE_POWER,
  RESEARCH,
  STORAGE_KEY,
  canAffordPower,
  canEnablePower,
  emptyProgress,
  getLevel,
  grantLevelResearch,
  hasResearch,
  isLevelUnlocked,
  maxMachineLevel,
  migrateProgress,
  nextLevelId,
  powerUsed,
  productLabel,
  rateStars,
  recordClear,
  totalStars,
  unlockedMachineTypes,
  unlockedRecipes,
} from './rules.mjs';

assert.equal(STORAGE_KEY, 'astra-webmcp-mini-factory:v1');
assert.ok(STORAGE_KEY.includes(':v1'));
assert.equal(LEGACY_LAYOUT_KEY, 'webmcp-mini-factory-v1');

assert.ok(LEVELS.length >= 8 && LEVELS.length <= 12, 'campaign should have 8–12 levels');
assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length);
assert.equal(new Set(LEVELS.map((l) => l.index)).size, LEVELS.length);

const L01 = getLevel('L01');
assert.ok(L01);
assert.equal(L01.product, 'gear');
assert.equal(L01.target, 10);
assert.equal(L01.sustain, 10);
assert.equal(L01.credits, 1000);
assert.equal(L01.starter, 'classic');
assert.equal(L01.powerBudget, null);
assert.equal(L01.maxMachines, null);

for (let i = 0; i < LEVELS.length; i++) {
  assert.equal(LEVELS[i].index, i + 1, `level index chain at ${LEVELS[i].id}`);
  assert.ok(LEVELS[i].target > 0);
  assert.ok(LEVELS[i].sustain >= 10);
  assert.ok(['gear', 'circuit', 'robot'].includes(LEVELS[i].product));
  for (const id of LEVELS[i].unlockResearch) {
    assert.ok(RESEARCH.some((r) => r.id === id), `unknown research unlock ${id}`);
  }
  for (const id of LEVELS[i].requiresResearch) {
    assert.ok(RESEARCH.some((r) => r.id === id), `unknown research req ${id}`);
  }
}

assert.ok(LEVELS.some((l) => l.product === 'circuit'), 'need circuit levels');
assert.ok(LEVELS.some((l) => l.product === 'robot'), 'need robot levels');
assert.ok(LEVELS.some((l) => l.powerBudget != null), 'need power-budget levels');
assert.ok(LEVELS.some((l) => l.maxMachines != null), 'need machine-cap levels');

assert.equal(productLabel('gear'), 'gears');
assert.equal(productLabel('robot'), 'robots');

let progress = emptyProgress();
assert.equal(isLevelUnlocked(progress, 'L01'), true);
assert.equal(isLevelUnlocked(progress, 'L02'), false);
assert.deepEqual(unlockedMachineTypes(progress).sort(), [
  'assembler',
  'miner',
  'smelter',
  'storage',
]);
assert.ok(unlockedRecipes(progress).includes('gear'));
assert.ok(!unlockedRecipes(progress).includes('circuit'));
assert.equal(maxMachineLevel(progress), 2);

assert.equal(
  rateStars(L01, { machineCount: 4, powerPeak: 0, creditsLeft: 500 }),
  3,
);
assert.equal(
  rateStars(L01, { machineCount: 4, powerPeak: 0, creditsLeft: 100 }),
  2,
);
assert.equal(
  rateStars(L01, { machineCount: 8, powerPeak: 0, creditsLeft: 100 }),
  1,
);

const clear = recordClear(progress, 'L01', {
  machineCount: 4,
  powerPeak: 12,
  creditsLeft: 440,
  completeTime: 42,
  rate: 10.5,
});
assert.equal(clear.stars, 3);
assert.ok(clear.newlyResearch.includes('splitter'));
assert.ok(hasResearch(progress, 'splitter'));
assert.equal(isLevelUnlocked(progress, 'L02'), true);
assert.ok(unlockedMachineTypes(progress).includes('splitter'));

// Never downgrade stars
recordClear(progress, 'L01', {
  machineCount: 9,
  powerPeak: 40,
  creditsLeft: 0,
  completeTime: 99,
  rate: 10,
});
assert.equal(progress.clears.L01.stars, 3);
assert.equal(progress.clears.L01.bestTime, 42);
assert.equal(progress.clears.L01.clears, 2);

assert.equal(nextLevelId('L01'), 'L02');
assert.equal(nextLevelId('L10'), null);

const machines = [
  { id: 'a', type: 'miner', online: true },
  { id: 'b', type: 'smelter', online: true },
  { id: 'c', type: 'storage', online: false },
];
assert.equal(powerUsed(machines), MACHINE_POWER.miner + MACHINE_POWER.smelter);
assert.equal(canAffordPower(machines, 'assembler', 12), true);
assert.equal(canAffordPower(machines, 'assembler', 10), false);
assert.equal(canEnablePower(machines, 'c', 8), true);
assert.equal(canEnablePower(machines, 'c', 7), false);

grantLevelResearch(progress, 'L03');
assert.ok(hasResearch(progress, 'circuits'));
assert.ok(unlockedRecipes(progress).includes('circuit'));

progress.clears.L02 = { stars: 1, bestTime: 50, bestMachines: 6, bestPowerPeak: null, bestRate: 10, clears: 1 };
progress.clears.L03 = { stars: 1, bestTime: 50, bestMachines: 6, bestPowerPeak: 18, bestRate: 10, clears: 1 };
grantLevelResearch(progress, 'L03');
assert.equal(isLevelUnlocked(progress, 'L04'), true);

const migrated = migrateProgress(
  {
    version: 1,
    currentLevelId: 'L99',
    research: ['splitter', 'bogus'],
    clears: { L01: { stars: 2, bestTime: 30, clears: 1 } },
    layouts: {},
  },
  { version: 1, credits: 900, machines: [], conveyors: [] },
);
assert.equal(migrated.currentLevelId, 'L01');
assert.deepEqual(migrated.research.sort(), ['splitter'].sort());
assert.equal(migrated.clears.L01.stars, 2);
assert.ok(migrated.layouts.L01);

const fromLegacyOnly = migrateProgress(null, { version: 1, credits: 800, machines: [], conveyors: [] });
assert.ok(fromLegacyOnly.layouts.L01);
assert.equal(totalStars(progress) >= 3, true);

assert.ok(RESEARCH.every((r) => r.id && r.unlocks));
assert.ok(MACHINE_POWER.robot_assembler > MACHINE_POWER.assembler);

console.log(
  `Mini Factory check OK · ${LEVELS.length} levels · ${RESEARCH.length} research · L01 classic mission intact`,
);
