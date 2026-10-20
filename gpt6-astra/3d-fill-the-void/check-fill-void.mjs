#!/usr/bin/env node
/**
 * Logic + solvability check for Astra 3D Fill the Void.
 */
import assert from 'node:assert/strict';
import {
  CAMPAIGN,
  DAILY_POOL,
  PACKS,
  STORAGE_KEY,
  cellsKey,
  dailyLevel,
  emptyProgress,
  extractPieces,
  flipCells,
  isConnected,
  isLevelUnlocked,
  isPackUnlocked,
  levelIsSolvable,
  localDateKey,
  migrateProgress,
  orientationsOf,
  packCleared,
  parRotationsFor,
  rateStars,
  recordClear,
  recordDailyClear,
  rotateCells,
  scrambleTurns,
  seedFromString,
  totalStars,
  validateLevel,
} from './rules.mjs';

assert.equal(STORAGE_KEY, 'astra-fill-the-void:v1');
assert.ok(STORAGE_KEY.startsWith('astra-fill-the-void'));

assert.equal(PACKS.length, 3);
assert.equal(CAMPAIGN.length, 20, 'campaign should have 20 levels');
assert.ok(DAILY_POOL.length >= 12, 'daily pool should be generous');

assert.equal(new Set(CAMPAIGN.map((l) => l.id)).size, CAMPAIGN.length);
assert.equal(new Set(DAILY_POOL.map((l) => l.id)).size, DAILY_POOL.length);

for (const pack of PACKS) {
  const count = CAMPAIGN.filter((l) => l.pack === pack.id).length;
  assert.ok(count >= 5, `pack ${pack.id} should have enough levels`);
}

let solvable = 0;
for (const [list, label] of [
  [CAMPAIGN, 'campaign'],
  [DAILY_POOL, 'daily'],
]) {
  list.forEach((level, index) => {
    const valid = validateLevel(level);
    assert.equal(valid.ok, true, `${label} ${level.id}: ${valid.reason}`);
    for (const piece of extractPieces(level.rows)) {
      assert.equal(
        isConnected(piece.cells),
        true,
        `${level.id} piece ${piece.id} disconnected`,
      );
    }
    const result = levelIsSolvable(level, index);
    assert.equal(result.ok, true, `${label} ${level.id}: ${result.reason}`);
    solvable += 1;
    assert.ok(parRotationsFor(level, index) >= 0);
  });
}
assert.equal(solvable, CAMPAIGN.length + DAILY_POOL.length);

const shape = [
  [0, 0],
  [1, 0],
  [1, 1],
];
assert.equal(
  cellsKey(rotateCells(shape)),
  cellsKey([
    [1, 0],
    [0, 1],
    [1, 1],
  ]),
);
assert.ok(orientationsOf(shape).length >= 4);
assert.notEqual(cellsKey(shape), cellsKey(flipCells(shape)));
// Four rotates return to the same shape key.
let spun = shape;
for (let i = 0; i < 4; i++) spun = rotateCells(spun);
assert.equal(cellsKey(spun), cellsKey(shape));

assert.equal(scrambleTurns(0, 0), 1);
assert.equal(rateStars({ undos: 0, rotations: 4, parRotations: 4 }), 3);
assert.equal(rateStars({ undos: 0, rotations: 5, parRotations: 4 }), 2);
assert.equal(rateStars({ undos: 1, rotations: 99, parRotations: 4 }), 2);
assert.equal(rateStars({ undos: 3, rotations: 0, parRotations: 4 }), 1);

let progress = emptyProgress();
assert.equal(isLevelUnlocked(progress, 'breath-01'), true);
assert.equal(isLevelUnlocked(progress, 'breath-02'), false);
assert.equal(isPackUnlocked(progress, 'garden'), false);

progress = recordClear(progress, 'breath-01', {
  stars: 3,
  undos: 0,
  rotations: 2,
});
assert.equal(progress.clears['breath-01'].stars, 3);
assert.equal(isLevelUnlocked(progress, 'breath-02'), true);

progress = recordClear(progress, 'breath-01', {
  stars: 2,
  undos: 0,
  rotations: 1,
});
assert.equal(progress.clears['breath-01'].stars, 3, 'never downgrade stars');

for (const level of CAMPAIGN.filter((l) => l.pack === 'breath')) {
  progress = recordClear(progress, level.id, {
    stars: 1,
    undos: 2,
    rotations: 20,
  });
}
assert.equal(packCleared(progress, 'breath'), true);
assert.equal(isPackUnlocked(progress, 'garden'), true);
assert.equal(isLevelUnlocked(progress, 'garden-01'), true);

progress = recordDailyClear(progress, '2026-10-20', 2);
progress = recordDailyClear(progress, '2026-10-20', 3);
assert.equal(progress.daily.stars, 3);
progress = recordDailyClear(progress, '2026-10-21', 1);
assert.equal(progress.daily.dateKey, '2026-10-21');
assert.equal(progress.daily.stars, 1);

assert.match(localDateKey(), /^\d{4}-\d{2}-\d{2}$/);
const a = seedFromString('fill-void-daily:2026-10-20');
const b = seedFromString('fill-void-daily:2026-10-20');
const c = seedFromString('fill-void-daily:2026-10-21');
assert.equal(a, b);
assert.notEqual(a, c);

const day = dailyLevel(new Date(2026, 9, 20));
const day2 = dailyLevel(new Date(2026, 9, 20));
assert.equal(day.level.id, day2.level.id);
assert.ok(DAILY_POOL.some((l) => l.id === day.level.id));

const migrated = migrateProgress(null, 2);
assert.equal(migrated.currentId, 'breath-03');
assert.equal(migrated.clears['breath-01'].stars, 1);
assert.equal(migrated.clears['breath-02'].stars, 1);

const roundTrip = migrateProgress(
  recordClear(emptyProgress(), 'breath-01', {
    stars: 2,
    undos: 1,
    rotations: 4,
  }),
);
assert.equal(roundTrip.clears['breath-01'].stars, 2);
assert.ok(totalStars(roundTrip) >= 2);

console.log(
  `ok — ${CAMPAIGN.length} campaign + ${DAILY_POOL.length} daily solvable; stars/unlock/daily checked`,
);
