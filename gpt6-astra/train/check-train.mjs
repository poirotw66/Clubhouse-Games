#!/usr/bin/env node
/**
 * Logic check for Astra Endless Train (不停號).
 * Covers difficulty ordering, daily seed/modifiers, hazards, scoring, stats.
 */
import assert from "node:assert/strict";
import {
  DAILY_MODIFIERS,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  MAX_LEVEL,
  MODIFIER_ORDER,
  applyRunModifiers,
  craftDurationSec,
  dailySeed,
  emptyStats,
  endReasonLabel,
  getDifficulty,
  getModifier,
  isGapCell,
  isStormCell,
  localDateKey,
  migrateStats,
  modifiersFromSeed,
  railsLaid,
  recordRun,
  scoreFromProgress,
  seedFromString,
  trainSpeed,
  upgradeCost,
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
assert.equal(MAX_LEVEL, 5, "upgrade cap should reach depth-5 ceiling");
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
  waterDrainPerSec(0, MAX_LEVEL, "normal") < waterDrainPerSec(0, 0, "normal"),
  "upgrades reduce water drain",
);
assert.ok(
  waterDrainPerSec(0, 0, "normal", { waterMul: 2 }) ===
    waterDrainPerSec(0, 0, "normal") * 2,
  "double_water modifier doubles drain",
);
assert.ok(
  waterDrainPerSec(0, 0, "normal", { inStorm: true }) >
    waterDrainPerSec(0, 0, "normal"),
  "storm cells drain faster",
);

assert.ok(
  craftDurationSec(0, "easy") < craftDurationSec(0, "hard"),
  "easy crafts faster than hard",
);
assert.ok(
  craftDurationSec(2, "normal") < craftDurationSec(0, "normal"),
  "higher level crafts faster",
);
assert.ok(
  craftDurationSec(MAX_LEVEL, "normal") < craftDurationSec(3, "normal"),
  "level 5 still improves craft time vs level 3",
);

assert.equal(upgradeCost(0), 6);
assert.equal(upgradeCost(3), 15);
assert.ok(upgradeCost(MAX_LEVEL) >= upgradeCost(MAX_LEVEL - 1));

assert.equal(scoreFromProgress(18, 8, "normal"), 100);
assert.equal(railsLaid(40, 25), 15);
assert.equal(endReasonLabel("water"), "鍋爐過熱");
assert.equal(endReasonLabel("rail"), "衝出軌道");
assert.equal(endReasonLabel("gap"), "斷橋未補");

const dayA = localDateKey(new Date(Date.UTC(2026, 9, 2, 12)));
const dayB = localDateKey(new Date(Date.UTC(2026, 9, 3, 12)));
assert.match(localDateKey(), /^\d{4}-\d{2}-\d{2}$/);

const s1 = seedFromString("train-daily:2026-10-02");
const s2 = seedFromString("train-daily:2026-10-02");
const s3 = seedFromString("train-daily:2026-10-03");
assert.equal(s1, s2, "daily seed must be stable");
assert.notEqual(s1, s3, "different days → different seeds");
assert.ok(s1 >= 1 && s1 <= 999998);

const dSeed = dailySeed(new Date(2026, 9, 2, 15, 0, 0));
assert.equal(
  dSeed,
  seedFromString(`train-daily:${localDateKey(new Date(2026, 9, 2, 15, 0, 0))}`),
);

/* ---- Daily modifiers ---- */
assert.ok(MODIFIER_ORDER.length >= 4, "need a pool of daily modifiers");
for (const id of MODIFIER_ORDER) {
  assert.ok(DAILY_MODIFIERS[id], `modifier ${id} missing`);
  assert.equal(getModifier(id).id, id);
  assert.ok(DAILY_MODIFIERS[id].label, `modifier ${id} needs label`);
}

const mA = modifiersFromSeed(s1);
const mA2 = modifiersFromSeed(s1);
assert.deepEqual(
  mA.map((m) => m.id),
  mA2.map((m) => m.id),
  "modifiersFromSeed must be stable",
);
assert.ok(mA.length === 1 || mA.length === 2, "pick one or two modifiers");
const idsBySeed = new Set(
  [s1, s3, 111, 222, 333, 444, 555].map((s) =>
    modifiersFromSeed(s)
      .map((m) => m.id)
      .join(","),
  ),
);
assert.ok(idsBySeed.size >= 2, "different seeds should yield varied modifier sets");

const cheap = applyRunModifiers(DIFFICULTIES.hard, [DAILY_MODIFIERS.cheap_bridge]);
assert.equal(cheap.bridgeWood, 2, "hard bridge 3 + (−1) → 2");
const cheapEasy = applyRunModifiers(DIFFICULTIES.easy, [DAILY_MODIFIERS.cheap_bridge]);
assert.equal(cheapEasy.bridgeWood, 1, "bridge cost never below 1");

const doubled = applyRunModifiers(DIFFICULTIES.normal, [DAILY_MODIFIERS.double_water]);
assert.equal(doubled.waterMul, 2);
assert.equal(doubled.fog, false);

const foggy = applyRunModifiers(DIFFICULTIES.normal, [
  DAILY_MODIFIERS.fog,
  DAILY_MODIFIERS.scrap_drop,
]);
assert.equal(foggy.fog, true);
assert.equal(foggy.cargoCharges, 2);
assert.deepEqual(foggy.ids.sort(), ["fog", "scrap_drop"].sort());

/* ---- Hazards ---- */
const stormHits = [];
const gapHits = [];
for (let x = 0; x < 120; x++) {
  for (let y = -6; y <= 6; y++) {
    if (isStormCell(x, y, 4242, 1)) stormHits.push([x, y]);
    if (isGapCell(x, y, 4242)) gapHits.push([x, y]);
  }
}
assert.ok(stormHits.length > 0, "storm bands should appear for a fixed seed");
assert.ok(gapHits.length > 0, "broken-bridge gaps should appear");
assert.equal(
  isStormCell(0, 0, 4242, 1),
  false,
  "tutorial stretch must stay storm-free",
);
assert.deepEqual(
  stormHits.slice(0, 5),
  (() => {
    const again = [];
    for (let x = 0; x < 120; x++) {
      for (let y = -6; y <= 6; y++) {
        if (isStormCell(x, y, 4242, 1)) again.push([x, y]);
      }
    }
    return again.slice(0, 5);
  })(),
  "storm layout must be seed-stable",
);

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
assert.ok(typeof dayA === "string" && typeof dayB === "string");

console.log("check-train: ok");
