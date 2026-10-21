#!/usr/bin/env node
/**
 * Logic check for Astra Stillshot (停步射手).
 * Covers modes, permanent unlock tree, daily seed, boss zone patterns,
 * limited-room victory, damage/spawn scaling, and save migration.
 */
import assert from "node:assert/strict";
import {
  META_UNLOCK_ORDER,
  META_UNLOCKS,
  MODE_ORDER,
  MODES,
  UNLOCKABLE_MODE_ORDER,
  awardedGold,
  bossFanCount,
  bossPatterns,
  bossRingCount,
  buyMeta,
  clearBonus,
  dailyChallenge,
  dailySeed,
  emptyMeta,
  enemyScale,
  endEyebrow,
  endTitle,
  getMode,
  incomingDamage,
  isHealRoom,
  isUnlockOwned,
  isVictoryRoom,
  localDateKey,
  migrateMeta,
  playerHpMul,
  recordRun,
  seedFromString,
  spawnCount,
  startingBuildFromMeta,
  unlockCost,
  upgradeCost,
  visibleModes,
} from "./rules.mjs";
import {
  SFX_MUTE_STORAGE_KEY,
  isSfxMuted,
  playArcherClear,
  playArcherDeath,
  playArcherHit,
  playArcherShoot,
  playArcherUpgrade,
  setSfxMuted,
  toggleSfxMuted,
} from "../shared/sfx.mjs";

assert.equal(MODE_ORDER.length, 4);
assert.deepEqual(
  MODE_ORDER.map((id) => MODES[id].label),
  ["輕鬆", "標準", "高壓", "五房突襲"],
);

const blurbs = MODE_ORDER.map((id) => MODES[id].blurb);
assert.equal(new Set(blurbs).size, 4, "mode blurbs must be unique");

assert.equal(MODES.raid.roomCap, 5);
assert.equal(MODES.easy.roomCap, 15);
assert.equal(MODES.normal.roomCap, 15);
assert.equal(MODES.hard.roomCap, 15);
assert.equal(MODES.raid.kind, "limited");
assert.equal(MODES.hard.kind, "difficulty");
assert.equal(MODES.daily.kind, "daily");
assert.equal(MODES.daily.roomCap, 8);
assert.equal(MODES.raid_night.requiresUnlock, "raidNight");
assert.equal(MODES.raid_glass.requiresUnlock, "raidGlass");
assert.ok(playerHpMul("raid_glass") < 1);
assert.equal(playerHpMul("normal"), 1);

function assertOrdered(getter, label, ascending = true) {
  const ids = ["easy", "normal", "hard"];
  const values = ids.map((id) => getter(MODES[id]));
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

assertOrdered((m) => m.enemyHpMul, "enemyHpMul");
assertOrdered((m) => m.enemyDmgMul, "enemyDmgMul");
assertOrdered((m) => m.spawnCountMul, "spawnCountMul");
assertOrdered((m) => m.enemySpeedMul, "enemySpeedMul");
assertOrdered((m) => m.clearBonus, "clearBonus");
assertOrdered((m) => m.goldMul, "goldMul");

assert.equal(getMode("nope").id, "normal");
assert.equal(getMode("raid").id, "raid");
assert.equal(getMode("daily").id, "daily");

assert.ok(
  enemyScale("chaser", 5, "easy") < enemyScale("chaser", 5, "normal"),
);
assert.ok(
  enemyScale("chaser", 5, "normal") < enemyScale("chaser", 5, "hard"),
);
assert.ok(
  430 * enemyScale("boss", 5, "normal") > 34 * enemyScale("chaser", 5, "normal"),
  "boss HP after scale should exceed trash",
);
assert.ok(
  enemyScale("boss", 15, "hard") > enemyScale("boss", 5, "easy"),
);

assert.ok(
  incomingDamage(10, 5, 0, "easy") < incomingDamage(10, 5, 0, "hard"),
);
assert.ok(
  incomingDamage(10, 8, 0, "normal") > incomingDamage(10, 1, 0, "normal"),
);
assert.ok(
  incomingDamage(10, 5, 0.2, "normal") < incomingDamage(10, 5, 0, "normal"),
);

assert.ok(spawnCount(3, "easy") <= spawnCount(3, "normal"));
assert.ok(spawnCount(3, "hard") >= spawnCount(3, "normal"));
assert.ok(spawnCount(1, "normal") >= 3);

assert.equal(awardedGold(10, "normal"), 10);
assert.equal(awardedGold(10, "easy"), 9);
assert.ok(awardedGold(10, "hard") >= 11);

assert.equal(clearBonus("normal"), 150);
assert.equal(clearBonus("raid"), 90);

assert.equal(isVictoryRoom(15, "normal"), true);
assert.equal(isVictoryRoom(14, "normal"), false);
assert.equal(isVictoryRoom(5, "raid"), true);
assert.equal(isVictoryRoom(4, "raid"), false);
assert.equal(isVictoryRoom(8, "daily"), true);
assert.equal(isVictoryRoom(7, "daily"), false);

assert.equal(endEyebrow(true), "VICTORY");
assert.equal(endTitle({ win: false, retired: true }), "暫時返回營地");
assert.equal(upgradeCost("attack", 0), 40);
assert.equal(upgradeCost("attack", 2), 110);

// --- Permanent unlock tree ---
assert.equal(META_UNLOCK_ORDER.length, Object.keys(META_UNLOCKS).length);
for (const id of META_UNLOCK_ORDER) {
  assert.ok(META_UNLOCKS[id].cost > 0, `${id} needs cost`);
  assert.ok(META_UNLOCKS[id].label, `${id} needs label`);
  assert.ok(META_UNLOCKS[id].blurb, `${id} needs blurb`);
}
assert.equal(unlockCost("startPierce"), 90);
assert.equal(unlockCost("healRooms"), 140);

const rich = migrateMeta({ gold: 500 });
assert.deepEqual(visibleModes(rich), MODE_ORDER);
const boughtNight = buyMeta(rich, "raidNight");
assert.equal(boughtNight.ok, true);
assert.ok(isUnlockOwned(boughtNight.meta, "raidNight"));
assert.ok(visibleModes(boughtNight.meta).includes("raid_night"));
assert.ok(!visibleModes(boughtNight.meta).includes("raid_glass"));
assert.equal(boughtNight.meta.gold, 500 - 160);

const againNight = buyMeta(boughtNight.meta, "raidNight");
assert.equal(againNight.ok, false);
assert.equal(againNight.reason, "owned");

const poor = buyMeta(emptyMeta(), "startPierce");
assert.equal(poor.ok, false);
assert.equal(poor.reason, "gold");

const withStarts = buyMeta(
  buyMeta(migrateMeta({ gold: 400 }), "startPierce").meta,
  "startMulti",
).meta;
const startBuild = startingBuildFromMeta(withStarts);
assert.equal(startBuild.pierce, 1);
assert.equal(startBuild.multi, 1);

assert.equal(isHealRoom(6, "normal", withStarts), false);
const withHeal = buyMeta(migrateMeta({ gold: 200 }), "healRooms").meta;
assert.equal(isHealRoom(6, "normal", withHeal), true);
assert.equal(isHealRoom(11, "normal", withHeal), true);
assert.equal(isHealRoom(6, "raid", withHeal), false);
assert.equal(isHealRoom(6, "daily", withHeal), false);
assert.equal(isHealRoom(5, "normal", withHeal), false);

for (const id of UNLOCKABLE_MODE_ORDER) {
  assert.ok(MODES[id].requiresUnlock, `${id} must gate behind unlock`);
}

// Legacy % refunds into gold
const legacy = migrateMeta({ gold: 80, attack: 2, health: 1, best: 7 });
assert.equal(legacy.bestByMode.normal, 7);
assert.equal(legacy.best, 7);
assert.equal(legacy.attack, 0);
assert.equal(legacy.health, 0);
assert.equal(legacy.gold, 80 + upgradeCost("attack", 0) + upgradeCost("attack", 1) + upgradeCost("health", 0));

const blank = migrateMeta(null);
assert.deepEqual(blank.bestByMode.easy, 0);
assert.equal(blank.bestDaily.date, "");

const recorded = recordRun(legacy, { mode: "hard", room: 9, win: false });
assert.equal(recorded.isModeBest, true);
assert.equal(recorded.meta.bestByMode.hard, 9);
assert.equal(recorded.meta.best, 9);
assert.equal(recorded.meta.lastMode, "hard");

const again = recordRun(recorded.meta, { mode: "hard", room: 4, win: false });
assert.equal(again.isModeBest, false);
assert.equal(again.meta.bestByMode.hard, 9);

const raidWin = recordRun(again.meta, { mode: "raid", room: 5, win: true });
assert.equal(raidWin.meta.bestByMode.raid, 5);
assert.equal(raidWin.meta.clearsByMode.raid, 1);
assert.equal(raidWin.isModeBest, true);

// --- Daily seed + bestDaily ---
const dayA = new Date(2026, 9, 20);
const dayB = new Date(2026, 9, 21);
assert.equal(localDateKey(dayA), "2026-10-20");
assert.equal(dailySeed(dayA), dailySeed(dayA));
assert.notEqual(dailySeed(dayA), dailySeed(dayB));
assert.equal(seedFromString("stillshot-daily:2026-10-20"), dailySeed(dayA));

const challenge = dailyChallenge(dayA);
assert.equal(challenge.dateKey, "2026-10-20");
assert.equal(challenge.roomCap, 8);
assert.equal(challenge.rooms.length, 8);
assert.equal(challenge.bannedAbilityIds.length, 3);
assert.equal(new Set(challenge.bannedAbilityIds).size, 3);
assert.equal(dailyChallenge(dayA).seed, challenge.seed);
assert.deepEqual(dailyChallenge(dayA).bannedAbilityIds, challenge.bannedAbilityIds);
assert.notEqual(dailyChallenge(dayB).seed, challenge.seed);
// Enemy picks inside rooms must diverge across days (seeded).
assert.notDeepEqual(
  dailyChallenge(dayB).rooms[0].enemies,
  challenge.rooms[0].enemies,
);

const dailyRec = recordRun(raidWin.meta, {
  mode: "daily",
  room: 6,
  win: false,
  dateKey: "2026-10-20",
});
assert.equal(dailyRec.isDailyBest, true);
assert.equal(dailyRec.meta.bestDaily.date, "2026-10-20");
assert.equal(dailyRec.meta.bestDaily.room, 6);
assert.equal(dailyRec.meta.bestByMode.daily, 6);

const dailyWorse = recordRun(dailyRec.meta, {
  mode: "daily",
  room: 3,
  win: false,
  dateKey: "2026-10-20",
});
assert.equal(dailyWorse.isDailyBest, false);
assert.equal(dailyWorse.meta.bestDaily.room, 6);

const dailyWin = recordRun(dailyWorse.meta, {
  mode: "daily",
  room: 8,
  win: true,
  dateKey: "2026-10-20",
});
assert.equal(dailyWin.isDailyBest, true);
assert.equal(dailyWin.meta.bestDaily.win, true);
assert.equal(dailyWin.meta.clearsByMode.daily, 1);

// --- Boss zone patterns differ ---
const z1 = bossPatterns(1, 1);
const z2 = bossPatterns(2, 1);
const z3 = bossPatterns(3, 1);
assert.ok(z1.includes("dash") || z1.includes("lunge"));
assert.ok(z2.includes("area"));
assert.ok(z3.includes("ring"));
assert.notDeepEqual(z1, z2);
assert.notDeepEqual(z2, z3);
assert.ok(bossFanCount(3, 2) > bossFanCount(1, 1));
assert.ok(bossRingCount(3, 2) > bossRingCount(1, 1));

// --- SFX helpers exist and mute gates them ---
assert.equal(typeof playArcherShoot, "function");
assert.equal(typeof playArcherHit, "function");
assert.equal(typeof playArcherUpgrade, "function");
assert.equal(typeof playArcherDeath, "function");
assert.equal(typeof playArcherClear, "function");
assert.equal(typeof SFX_MUTE_STORAGE_KEY, "string");

const prevMute = isSfxMuted();
setSfxMuted(true);
assert.equal(isSfxMuted(), true);
playArcherShoot();
playArcherHit(true);
playArcherUpgrade();
playArcherDeath();
playArcherClear(true);
assert.equal(toggleSfxMuted(), false);
assert.equal(isSfxMuted(), false);
setSfxMuted(prevMute);

console.log("check-archer: ok");
