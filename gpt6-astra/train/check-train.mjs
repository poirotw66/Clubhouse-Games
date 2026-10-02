#!/usr/bin/env node
/**
 * Logic check for Astra Endless Train (不停號).
 * Covers difficulty ordering, daily seed stability, scoring, and stats migration.
 */
import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  craftDurationSec,
  dailySeed,
  emptyStats,
  endReasonLabel,
  getDifficulty,
  localDateKey,
  migrateStats,
  railsLaid,
  recordRun,
  scoreFromProgress,
  seedFromString,
  trainSpeed,
  waterDrainPerSec,
} from "./rules.mjs";

function assertOrdered(getter, label, ascending = true) {
  const values = DIFFICULTY_ORDER.map((id) => getter(DIFFICULTIES[id]));
  for (let i = 1; i < values.length; i++) {
    if (ascending) {
      assert.ok(
        values[i] >= values[i - 1],
        `${label} should be non-decreasing easy→hard: ${values.join(", ")}`,
      );
    } else {
      assert.ok(
        values[i] <= values[i - 1],
        `${label} should be non-increasing easy→hard: ${values.join(", ")}`,
      );
    }
  }
}

assert.equal(DIFFICULTY_ORDER.length, 3);
assert.deepEqual(
  DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].label),
  ["輕鬆", "標準", "高壓"],
);

const blurbs = DIFFICULTY_ORDER.map((id) => DIFFICULTIES[id].blurb);
assert.equal(new Set(blurbs).size, 3, "difficulty blurbs must be unique");

assertOrdered((d) => d.baseSpeed, "baseSpeed");
assertOrdered((d) => d.speedRamp, "speedRamp");
assertOrdered((d) => d.speedCap, "speedCap");
assertOrdered((d) => d.waterDrain, "waterDrain");
assertOrdered((d) => d.dryDrain, "dryDrain");
assertOrdered((d) => d.bridgeWood, "bridgeWood");
assertOrdered((d) => d.craftBaseSec, "craftBaseSec");
assertOrdered((d) => d.startBank.rail, "start rails", false);
assertOrdered((d) => d.treeDensityMul, "treeDensityMul", false);
assertOrdered((d) => d.startWater, "startWater", false);

assert.equal(getDifficulty("nope").id, "normal");
assert.equal(getDifficulty("hard").id, "hard");

const tEasy = trainSpeed(120, "easy");
const tNormal = trainSpeed(120, "normal");
const tHard = trainSpeed(120, "hard");
assert.ok(tEasy < tNormal && tNormal < tHard, "train speed should rise with difficulty");

const wEasy = waterDrainPerSec(0, 0, "easy");
const wHard = waterDrainPerSec(0, 0, "hard");
assert.ok(wEasy < wHard, "water drain should rise with difficulty");
assert.ok(
  waterDrainPerSec(2, 0, "normal") > waterDrainPerSec(0, 0, "normal"),
  "dry zones drain faster",
);
assert.ok(
  waterDrainPerSec(0, 3, "normal") < waterDrainPerSec(0, 0, "normal"),
  "upgrades reduce water drain",
);

assert.ok(
  craftDurationSec(0, "easy") < craftDurationSec(0, "hard"),
  "easy crafts faster than hard",
);
assert.ok(
  craftDurationSec(2, "normal") < craftDurationSec(0, "normal"),
  "higher level crafts faster",
);

assert.equal(scoreFromProgress(18, 8, "normal"), 100);
assert.equal(railsLaid(40, 25), 15);
assert.equal(endReasonLabel("water"), "鍋爐過熱");
assert.equal(endReasonLabel("rail"), "衝出軌道");

const dayA = localDateKey(new Date(Date.UTC(2026, 9, 2, 12)));
const dayB = localDateKey(new Date(Date.UTC(2026, 9, 3, 12)));
// localDateKey uses local TZ — just assert format
assert.match(localDateKey(), /^\d{4}-\d{2}-\d{2}$/);

const s1 = seedFromString("train-daily:2026-10-02");
const s2 = seedFromString("train-daily:2026-10-02");
const s3 = seedFromString("train-daily:2026-10-03");
assert.equal(s1, s2, "daily seed must be stable");
assert.notEqual(s1, s3, "different days → different seeds");
assert.ok(s1 >= 1 && s1 <= 999998);

const dSeed = dailySeed(new Date(2026, 9, 2, 15, 0, 0));
assert.equal(dSeed, seedFromString(`train-daily:${localDateKey(new Date(2026, 9, 2, 15, 0, 0))}`));

const migrated = migrateStats(null, 420);
assert.equal(migrated.bestByMode.normal, 420);
assert.equal(migrated.bestByMode.easy, 0);

const recorded = recordRun(migrated, {
  mode: "hard",
  score: 880,
  daily: true,
  dateKey: "2026-10-02",
});
assert.equal(recorded.isModeBest, true);
assert.equal(recorded.isDailyBest, true);
assert.equal(recorded.stats.bestByMode.hard, 880);
assert.equal(recorded.stats.bestDaily.score, 880);

const again = recordRun(recorded.stats, {
  mode: "hard",
  score: 100,
  daily: true,
  dateKey: "2026-10-02",
});
assert.equal(again.isModeBest, false);
assert.equal(again.isDailyBest, false);
assert.equal(again.stats.bestDaily.score, 880);

const nextDay = recordRun(again.stats, {
  mode: "easy",
  score: 50,
  daily: true,
  dateKey: "2026-10-03",
});
assert.equal(nextDay.isDailyBest, true);
assert.equal(nextDay.stats.bestDaily.date, "2026-10-03");

assert.deepEqual(emptyStats().bestByMode, { easy: 0, normal: 0, hard: 0 });

// Silence unused in case TZ makes dayA===dayB unlikely — keep referenced
assert.ok(typeof dayA === "string" && typeof dayB === "string");

console.log("check-train: ok");
