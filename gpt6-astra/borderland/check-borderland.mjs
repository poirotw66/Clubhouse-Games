#!/usr/bin/env node
/**
 * Logic check for Astra Borderland / Dust Riot.
 * Covers difficulty ordering, weapons, enemy kinds, spawn/combat scaling, and stats.
 */
import assert from "node:assert/strict";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  WEAPONS,
  WEAPON_ORDER,
  ENEMY_KINDS,
  ENEMY_KIND_ORDER,
  ELITE_EVERY,
  STORAGE_KEY,
  emptyStats,
  endReasonLabel,
  enemyFireCooldown,
  enemyHp,
  enemySpeed,
  getDifficulty,
  getWeapon,
  getEnemyKind,
  isEliteWave,
  killScore,
  migrateStats,
  pickWaveComposition,
  projectileSpeed,
  reachedClearWave,
  recordRun,
  shieldBlocksHit,
  spawnCount,
  weaponHitDamage,
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

assert.equal(STORAGE_KEY, "dust-riot-v2", "save key must stay game-prefixed");
assert.match(STORAGE_KEY, /^dust-riot-/);

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

/* ---- Weapons: identity tradeoffs, not pure DPS clones ---- */
assert.equal(WEAPON_ORDER.length, 3);
assert.deepEqual(WEAPON_ORDER, ["smg", "rifle", "shotgun"]);
for (const id of WEAPON_ORDER) {
  const w = WEAPONS[id];
  assert.ok(w.magSize > 0 && w.fireCooldown > 0 && w.range > 0);
  assert.ok(w.bodyDamage > 0 && w.pellets >= 1);
  assert.ok(w.blurb && w.tip && w.label && w.code);
}
assert.ok(WEAPONS.smg.fireCooldown < WEAPONS.rifle.fireCooldown);
assert.ok(WEAPONS.smg.magSize > WEAPONS.rifle.magSize);
assert.ok(WEAPONS.smg.range < WEAPONS.rifle.range);
assert.ok(WEAPONS.shotgun.pellets > WEAPONS.rifle.pellets);
assert.ok(WEAPONS.shotgun.range < WEAPONS.smg.range);
assert.ok(WEAPONS.rifle.headMult >= WEAPONS.smg.headMult);

const close = weaponHitDamage("shotgun", 4, false);
const farShotgun = weaponHitDamage("shotgun", 30, false);
const farRifle = weaponHitDamage("rifle", 30, false);
assert.ok(close.inRange && close.damage > 0);
assert.equal(farShotgun.inRange, false);
assert.ok(farRifle.inRange && farRifle.damage > 0);

const smgFar = weaponHitDamage("smg", 30, false);
const rifleFar = weaponHitDamage("rifle", 30, false);
assert.ok(
  smgFar.damage < rifleFar.damage,
  "SMG should deal less at range than rifle",
);

const head = weaponHitDamage("rifle", 10, true);
const body = weaponHitDamage("rifle", 10, false);
assert.ok(head.damage > body.damage);
assert.equal(getWeapon("nope").id, "rifle");

/* ---- Enemy kinds ---- */
assert.deepEqual(ENEMY_KIND_ORDER, ["grunt", "rusher", "mortar", "shield"]);
assert.ok(ENEMY_KINDS.rusher.meleeOnly);
assert.ok(ENEMY_KINDS.mortar.lobShot);
assert.ok(ENEMY_KINDS.shield.shieldFront);
assert.ok(ENEMY_KINDS.rusher.speedMult > ENEMY_KINDS.mortar.speedMult);
assert.ok(ENEMY_KINDS.shield.hpMult > ENEMY_KINDS.rusher.hpMult);

assert.ok(enemyHp(5, "normal", "rusher") < enemyHp(5, "normal", "grunt"));
assert.ok(enemyHp(5, "normal", "shield") > enemyHp(5, "normal", "grunt"));
assert.ok(enemyHp(5, "normal", "grunt", true) > enemyHp(5, "normal", "grunt", false));
assert.ok(enemySpeed(5, "normal", "rusher") > enemySpeed(5, "normal", "mortar"));
assert.ok(killScore(5, "mortar") > killScore(5, "grunt"));
assert.ok(killScore(5, "grunt", true) > killScore(5, "grunt", false));
assert.equal(getEnemyKind("nope").id, "grunt");

assert.equal(ELITE_EVERY, 4);
assert.equal(isEliteWave(4), true);
assert.equal(isEliteWave(3), false);
assert.equal(isEliteWave(8), true);

const comp4 = pickWaveComposition(4, 6);
assert.equal(comp4.length, 6);
assert.ok(comp4.some((s) => s.elite), "elite wave must include an elite");
assert.ok(
  comp4.some((s) => s.kind === "rusher" || s.kind === "mortar" || s.kind === "shield"),
  "mid waves unlock specialty kinds",
);
const comp1 = pickWaveComposition(1, 3);
assert.ok(comp1.every((s) => s.kind === "grunt"));

/* ---- Shield facing ---- */
// Enemy faces +Z (rotation 0). Shot from +Z is frontal.
assert.equal(shieldBlocksHit(0, 0, 5, 0, 0, "rifle"), true);
// Shot from behind (-Z)
assert.equal(shieldBlocksHit(0, 0, -5, 0, 0, "rifle"), false);
// Shotgun needs more frontal alignment to fully block
assert.equal(shieldBlocksHit(0, 3, 3, 0, 0, "shotgun"), false);

/* ---- Stats migration / record ---- */
const migrated = migrateStats(null);
assert.deepEqual(migrated.bestByMode.normal, { wave: 0, score: 0 });
assert.equal(migrated.lastWeapon, "rifle");
assert.deepEqual(migrated.weaponClears, { smg: 0, rifle: 0, shotgun: 0 });

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
  weapon: "smg",
});
assert.equal(recorded.isWaveBest, true);
assert.equal(recorded.isScoreBest, true);
assert.equal(recorded.stats.bestByMode.hard.wave, 7);
assert.equal(recorded.stats.bestByMode.hard.score, 2200);
assert.equal(recorded.stats.clearsByMode.hard, 0);
assert.equal(recorded.stats.lastWeapon, "smg");
assert.equal(recorded.stats.weaponClears.smg, 0);

const win = recordRun(recorded.stats, {
  mode: "hard",
  wave: 12,
  score: 1800,
  won: true,
  weapon: "shotgun",
});
assert.equal(win.isWaveBest, true);
assert.equal(win.isScoreBest, false);
assert.equal(win.stats.bestByMode.hard.wave, 12);
assert.equal(win.stats.bestByMode.hard.score, 2200);
assert.equal(win.stats.clearsByMode.hard, 1);
assert.equal(win.stats.weaponClears.shotgun, 1);
assert.equal(win.stats.lastWeapon, "shotgun");

const again = recordRun(win.stats, {
  mode: "hard",
  wave: 3,
  score: 100,
  won: false,
  weapon: "rifle",
});
assert.equal(again.isWaveBest, false);
assert.equal(again.isScoreBest, false);
assert.equal(again.stats.bestByMode.hard.wave, 12);

assert.deepEqual(emptyStats().clearsByMode, { easy: 0, normal: 0, hard: 0 });

console.log("check-borderland: ok");
