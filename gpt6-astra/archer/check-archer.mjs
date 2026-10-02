#!/usr/bin/env node
/**
 * Logic check for Astra Stillshot (停步射手).
 * Covers mode table, limited-room victory, damage/spawn scaling, and save migration.
 */
import assert from "node:assert/strict";
import {
  MODE_ORDER,
  MODES,
  awardedGold,
  clearBonus,
  emptyMeta,
  enemyScale,
  endEyebrow,
  endTitle,
  getMode,
  incomingDamage,
  isVictoryRoom,
  migrateMeta,
  recordRun,
  spawnCount,
  upgradeCost,
} from "./rules.mjs";

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

assert.equal(endEyebrow(true), "VICTORY");
assert.equal(endTitle({ win: false, retired: true }), "暫時返回營地");
assert.equal(upgradeCost("attack", 0), 40);
assert.equal(upgradeCost("attack", 2), 110);

const legacy = migrateMeta({ gold: 80, attack: 2, health: 1, best: 7 });
assert.equal(legacy.gold, 80);
assert.equal(legacy.bestByMode.normal, 7);
assert.equal(legacy.best, 7);
assert.equal(legacy.attack, 2);

const blank = migrateMeta(null);
assert.deepEqual(blank.bestByMode, emptyMeta().bestByMode);

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

console.log("check-archer: ok");
