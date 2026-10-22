#!/usr/bin/env node
/**
 * Campaign / progress logic check for WebMCP Mini Factory.
 */
import assert from 'node:assert/strict';
import {
  DAILY_LEVEL_ID,
  GATED_RECIPES,
  LEVELS,
  LEGACY_LAYOUT_KEY,
  MACHINE_POWER,
  RESEARCH,
  STORAGE_KEY,
  canAffordPower,
  canEnablePower,
  dailyBlueprint,
  emptyProgress,
  formatDailyShareText,
  getLevel,
  grantLevelResearch,
  hasResearch,
  isLevelUnlocked,
  maxMachineLevel,
  migrateProgress,
  minerCycleMult,
  nextLevelId,
  powerDiscount,
  powerDraw,
  powerUsed,
  productLabel,
  rateStars,
  recordClear,
  recordDailyClear,
  seedFromString,
  shiftDateKey,
  storageMult,
  taipeiDateKey,
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
assert.equal(maxMachineLevel(progress), 3);
assert.equal(powerDiscount(progress), 0);

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

progress.research.push('overclock');
assert.equal(powerDiscount(progress), 1);
assert.equal(powerDraw('smelter', progress), MACHINE_POWER.smelter - 1);
assert.equal(
  powerUsed(machines, MACHINE_POWER, progress),
  powerDraw('miner', progress) + powerDraw('smelter', progress),
);

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
assert.ok(migrated.daily);
assert.equal(migrated.mode, 'campaign');

const fromLegacyOnly = migrateProgress(null, { version: 1, credits: 800, machines: [], conveyors: [] });
assert.ok(fromLegacyOnly.layouts.L01);
assert.equal(totalStars(progress) >= 3, true);

assert.ok(RESEARCH.every((r) => r.id && r.unlocks));
assert.ok(MACHINE_POWER.robot_assembler > MACHINE_POWER.assembler);

/* ---- Expanded research + new products ---- */
assert.ok(RESEARCH.length >= 8, 'research tree should have at least 8 nodes');
const researchIds = new Set(RESEARCH.map((r) => r.id));
for (const id of [
  'splitter',
  'circuits',
  'robotics',
  'overclock',
  'wiring',
  'motors',
  'bulk_storage',
  'deep_mining',
]) {
  assert.ok(researchIds.has(id), `missing research ${id}`);
}
assert.ok(GATED_RECIPES.has('wire'));
assert.ok(GATED_RECIPES.has('motor'));
assert.equal(productLabel('wire'), 'wire');
assert.equal(productLabel('motor'), 'motors');

assert.equal(storageMult(emptyProgress()), 1);
assert.equal(minerCycleMult(emptyProgress()), 1);
const bonusProgress = emptyProgress();
bonusProgress.research.push('bulk_storage', 'deep_mining', 'wiring', 'motors');
assert.equal(storageMult(bonusProgress), 2);
assert.equal(minerCycleMult(bonusProgress), 0.75);
assert.ok(unlockedRecipes(bonusProgress).includes('wire'));
assert.ok(unlockedRecipes(bonusProgress).includes('motor'));

assert.ok(LEVELS.find((l) => l.id === 'L04')?.unlockResearch.includes('wiring'));
assert.ok(LEVELS.find((l) => l.id === 'L06')?.unlockResearch.includes('bulk_storage'));
assert.ok(LEVELS.find((l) => l.id === 'L08')?.unlockResearch.includes('motors'));
assert.ok(LEVELS.find((l) => l.id === 'L09')?.unlockResearch.includes('deep_mining'));

/* ---- Daily blueprint (Asia/Taipei) ---- */
const dateKey = taipeiDateKey(new Date('2026-10-20T04:00:00Z'));
assert.match(dateKey, /^\d{4}-\d{2}-\d{2}$/);
// 04:00 UTC is 12:00 Taipei — still Oct 20
assert.equal(dateKey, '2026-10-20');
const lateUtc = taipeiDateKey(new Date('2026-10-20T16:30:00Z'));
// 16:30 UTC = 00:30 next day Taipei
assert.equal(lateUtc, '2026-10-21');

const bpA = dailyBlueprint(new Date('2026-06-15T04:00:00Z'));
const bpB = dailyBlueprint(new Date('2026-06-15T10:00:00Z'));
const bpC = dailyBlueprint(new Date('2026-06-16T04:00:00Z'));
assert.equal(bpA.id, DAILY_LEVEL_ID);
assert.equal(bpA.dateKey, bpB.dateKey);
assert.equal(bpA.seed, bpB.seed);
assert.equal(bpA.product, bpB.product);
assert.equal(bpA.target, bpB.target);
assert.notEqual(bpA.seed, bpC.seed);
assert.ok(['gear', 'circuit', 'robot', 'wire', 'motor'].includes(bpA.product));
assert.ok(bpA.target > 0);
assert.ok(Array.isArray(bpA.researchGrant));
assert.ok(bpA.researchGrant.every((id) => researchIds.has(id)));
assert.ok(Array.isArray(bpA.allowedMachines));
assert.ok(bpA.allowedMachines.includes('assembler'));

assert.equal(shiftDateKey('2026-06-15', 1), '2026-06-16');
assert.equal(seedFromString('mini-factory-daily:2026-06-15'), bpA.seed);

const dailyProgress = emptyProgress();
const dailyClear = recordDailyClear(dailyProgress, bpA, {
  machineCount: 5,
  powerPeak: 20,
  creditsLeft: 400,
  completeTime: 55,
  rate: bpA.target,
});
assert.ok(dailyClear.stars >= 1);
assert.equal(dailyClear.streak, 1);
assert.equal(dailyProgress.daily.streak, 1);
assert.equal(dailyProgress.daily.lastClearedDate, bpA.dateKey);
assert.equal(dailyProgress.daily.byDate[bpA.dateKey].stars, dailyClear.stars);

const sameDay = recordDailyClear(dailyProgress, bpA, {
  machineCount: 9,
  powerPeak: 40,
  creditsLeft: 0,
  completeTime: 90,
  rate: bpA.target,
});
assert.equal(sameDay.streak, 1);
assert.equal(
  dailyProgress.daily.byDate[bpA.dateKey].stars,
  Math.max(dailyClear.stars, sameDay.stars),
);

const nextDayBp = { ...bpC, dateKey: shiftDateKey(bpA.dateKey, 1) };
const streak2 = recordDailyClear(dailyProgress, nextDayBp, {
  machineCount: 6,
  powerPeak: 22,
  creditsLeft: 300,
  completeTime: 60,
  rate: nextDayBp.target,
});
assert.equal(streak2.streak, 2);

const share = formatDailyShareText(dailyProgress, bpA);
assert.ok(share.includes('每日藍圖'));
assert.ok(share.includes(bpA.dateKey));
assert.ok(share.includes('連續天數'));
assert.ok(share.includes('Asia/Taipei'));

console.log(
  `Mini Factory check OK · ${LEVELS.length} levels · ${RESEARCH.length} research · daily ${bpA.dateKey} · L01 classic mission intact`,
);
