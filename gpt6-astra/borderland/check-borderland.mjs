#!/usr/bin/env node
/**
 * Logic check for Astra Borderland / Dust Riot.
 * Covers difficulty ordering, spawn/combat scaling, and stats migration.
 */
import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  emptyStats,
  endReasonLabel,
  enemyFireCooldown,
  enemyHp,
  enemySpeed,
  getDifficulty,
  killScore,
  migrateStats,
  projectileSpeed,
  reachedClearWave,
  recordRun,
  spawnCount,
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

assertOrdered((d) => d.enemyHpBase, "enemyHpBase");
assertOrdered((d) => d.enemyHpPerWave, "enemyHpPerWave");
assertOrdered((d) => d.enemySpeedBase, "enemySpeedBase");
assertOrdered((d) => d.enemyDamage, "enemyDamage");
assertOrdered((d) => d.spawnBase, "spawnBase");
assertOrdered((d) => d.spawnCap, "spawnCap");
assertOrdered((d) => d.clearWave, "clearWave");
assertOrdered((d) => d.projectileSpeedBase, "projectileSpeedBase");
assertOrdered((d) => d.fireCooldownBase, "fireCooldownBase", false);
assertOrdered((d) => d.fireCooldownMin, "fireCooldownMin", false);
assertOrdered((d) => d.betweenWaveHeal, "betweenWaveHeal", false);
assertOrdered((d) => d.pickupHeal, "pickupHeal", false);
assertOrdered((d) => d.startingHp, "startingHp", false);

assert.equal(getDifficulty("nope").id, "normal");
assert.equal(getDifficulty("hard").id, "hard");

const wave = 4;
assert.ok(enemyHp(wave, "easy") < enemyHp(wave, "normal"));
assert.ok(enemyHp(wave, "normal") < enemyHp(wave, "hard"));
assert.ok(enemySpeed(wave, "easy") < enemySpeed(wave, "hard"));
assert.ok(spawnCount(wave, "easy") <= spawnCount(wave, "hard"));
assert.ok(enemyFireCooldown(wave, "easy") > enemyFireCooldown(wave, "hard"));
assert.ok(projectileSpeed(wave, "easy") < projectileSpeed(wave, "hard"));

assert.equal(spawnCount(0, "normal"), 3);
assert.ok(spawnCount(99, "normal") <= DIFFICULTIES.normal.spawnCap);
assert.equal(killScore(3), 145);

assert.equal(reachedClearWave(4, "easy"), false);
assert.equal(reachedClearWave(5, "easy"), true);
assert.equal(reachedClearWave(8, "normal"), true);
assert.equal(reachedClearWave(11, "hard"), false);
assert.equal(reachedClearWave(12, "hard"), true);

assert.equal(endReasonLabel("victory"), "目標波次達成");
assert.equal(endReasonLabel("defeat"), "倒下了");

const migrated = migrateStats(null);
assert.deepEqual(migrated.bestByMode.normal, { wave: 0, score: 0 });

const flatLegacy = migrateStats({
  bestByMode: { normal: 900 },
  lastMode: "hard",
});
assert.equal(flatLegacy.bestByMode.normal.score, 900);
assert.equal(flatLegacy.lastMode, "hard");

const recorded = recordRun(migrated, {
  mode: "hard",
  wave: 7,
  score: 2200,
  won: false,
});
assert.equal(recorded.isWaveBest, true);
assert.equal(recorded.isScoreBest, true);
assert.equal(recorded.stats.bestByMode.hard.wave, 7);
assert.equal(recorded.stats.bestByMode.hard.score, 2200);
assert.equal(recorded.stats.clearsByMode.hard, 0);

const win = recordRun(recorded.stats, {
  mode: "hard",
  wave: 12,
  score: 1800,
  won: true,
});
assert.equal(win.isWaveBest, true);
assert.equal(win.isScoreBest, false);
assert.equal(win.stats.bestByMode.hard.wave, 12);
assert.equal(win.stats.bestByMode.hard.score, 2200);
assert.equal(win.stats.clearsByMode.hard, 1);

const again = recordRun(win.stats, {
  mode: "hard",
  wave: 3,
  score: 100,
  won: false,
});
assert.equal(again.isWaveBest, false);
assert.equal(again.isScoreBest, false);
assert.equal(again.stats.bestByMode.hard.wave, 12);

assert.deepEqual(emptyStats().clearsByMode, { easy: 0, normal: 0, hard: 0 });

console.log("check-borderland: ok");
