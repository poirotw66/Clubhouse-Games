#!/usr/bin/env node
/**
 * Logic check for WebMCP Mini Tactical Dungeon (depth-4).
 * Covers seeds, tutorial fixture, procedural floors, rewards, and save migration.
 */
import assert from "node:assert/strict";
import {
  FLOOR_COUNT,
  GRID_SIZE,
  MODE_ORDER,
  MODES,
  REWARD_POOL,
  STORAGE_KEY,
  TUTORIAL_FLOOR,
  TUTORIAL_MAP,
  TUTORIAL_SEED,
  applyRewardToPlayer,
  coverBonus,
  dailySeed,
  emptyMeta,
  floorSeed,
  generateFloor,
  getMode,
  isBossFloor,
  isWalkable,
  localDateKey,
  migrateMeta,
  recordRun,
  resolveRunSeed,
  rewardChoices,
  scoreRun,
  seedFromString,
  terrainAt,
  validateFloorLayout,
} from "./rules.mjs";

assert.equal(STORAGE_KEY, "astra-tactical-dungeon:v1");
assert.equal(FLOOR_COUNT, 6);
assert.equal(GRID_SIZE, 8);
assert.deepEqual(MODE_ORDER, ["tutorial", "campaign", "daily"]);
assert.equal(MODES.tutorial.floors, 1);
assert.equal(MODES.campaign.floors, 6);
assert.equal(MODES.daily.floors, 6);
assert.equal(getMode("nope").id, "tutorial");

assert.equal(TUTORIAL_MAP.length, 8);
assert.ok(TUTORIAL_MAP.every((r) => r.length === 8));
assert.equal(terrainAt(TUTORIAL_MAP, 0, 0), "wall");
assert.equal(terrainAt(TUTORIAL_MAP, 1, 1), "floor");
assert.equal(terrainAt(TUTORIAL_MAP, 5, 4), "pillar");
assert.equal(terrainAt(TUTORIAL_MAP, 2, 6), "rubble");
assert.equal(isWalkable(TUTORIAL_MAP, 1, 1), true);
assert.equal(isWalkable(TUTORIAL_MAP, 0, 0), false);

const tutorial = generateFloor(TUTORIAL_SEED, 0, { mode: "tutorial", floorCount: 1 });
assert.equal(tutorial.name, "Aether Vault");
assert.deepEqual(tutorial.map, [...TUTORIAL_MAP]);
assert.deepEqual(tutorial.exit, { x: 6, y: 6 });
assert.deepEqual(tutorial.crystal, { x: 6, y: 5 });
assert.equal(tutorial.enemies.length, 3);
assert.equal(tutorial.enemies[0].id, "goblin-1");
assert.equal(tutorial.enemies[2].id, "orc-1");
assert.equal(validateFloorLayout(tutorial).ok, true);
assert.deepEqual(tutorial.map, TUTORIAL_FLOOR.map);

const a = seedFromString("tactical-daily:2099-01-02");
const b = seedFromString("tactical-daily:2099-01-02");
const c = seedFromString("tactical-daily:2099-01-03");
assert.equal(a, b);
assert.notEqual(a, c);
assert.equal(dailySeed(new Date("2099-06-15T12:00:00")), dailySeed(new Date("2099-06-15T23:59:00")));
assert.notEqual(
  dailySeed(new Date("2099-06-15T12:00:00")),
  dailySeed(new Date("2099-06-16T12:00:00")),
);

assert.equal(floorSeed("abc", 0), floorSeed("abc", 0));
assert.notEqual(floorSeed("abc", 0), floorSeed("abc", 1));

const campaignSeed = "check-seed-42";
for (let i = 0; i < FLOOR_COUNT; i++) {
  const floor = generateFloor(campaignSeed, i, { mode: "campaign" });
  const again = generateFloor(campaignSeed, i, { mode: "campaign" });
  assert.deepEqual(floor.map, again.map, `floor ${i} map must be stable`);
  assert.deepEqual(floor.enemies.map((e) => e.id), again.enemies.map((e) => e.id));
  const check = validateFloorLayout(floor);
  assert.equal(check.ok, true, `floor ${i}: ${check.reason}`);
  assert.equal(floor.floor, i + 1);
  assert.equal(floor.isBoss, isBossFloor(i));
  assert.ok(floor.items.some((it) => it.type === "ancient_crystal"));
  assert.ok(floor.hazards.length >= 1);
  if (i === FLOOR_COUNT - 1) {
    assert.ok(floor.enemies.some((e) => e.kind === "boss"), "final floor needs a boss");
  }
}

// Cover tiles appear in deeper procedural floors often enough to exercise the rule.
let sawCover = false;
for (let i = 0; i < FLOOR_COUNT; i++) {
  const floor = generateFloor("cover-probe", i, { mode: "campaign" });
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (terrainAt(floor.map, x, y) === "cover") {
        sawCover = true;
        assert.equal(coverBonus(floor.map, x, y), 0.5);
        assert.equal(isWalkable(floor.map, x, y), true);
      }
    }
  }
}
assert.ok(sawCover, "procedural floors should place cover terrain");

const rewards = rewardChoices(campaignSeed, 0);
assert.equal(rewards.length, 3);
assert.equal(new Set(rewards.map((r) => r.id)).size, 3);
assert.deepEqual(rewardChoices(campaignSeed, 0), rewards);
assert.notDeepEqual(rewardChoices(campaignSeed, 0), rewardChoices(campaignSeed, 1));

const basePlayer = {
  attack: 18,
  defense: 5,
  hp: 40,
  maxHp: 100,
  mana: 10,
  maxMana: 60,
  moveRange: 3,
  attackRange: 3,
  gear: [],
};
const boosted = applyRewardToPlayer(basePlayer, "iron_charm");
assert.equal(boosted.success, true);
assert.equal(boosted.player.attack, 22);
assert.ok(boosted.player.gear.includes("iron_charm"));
assert.equal(applyRewardToPlayer(basePlayer, "nope").success, false);

const ration = applyRewardToPlayer(basePlayer, "field_ration");
assert.equal(ration.player.hp, 100);
assert.equal(ration.player.mana, 60);

assert.ok(REWARD_POOL.length >= 6);

const blank = migrateMeta(null);
assert.deepEqual(blank.bestFloorCampaign, emptyMeta().bestFloorCampaign);

const legacy = migrateMeta({ bestFloorCampaign: 3, clearsCampaign: 1, lastMode: "campaign" });
assert.equal(legacy.bestFloorCampaign, 3);
assert.equal(legacy.clearsCampaign, 1);
assert.equal(legacy.lastMode, "campaign");

const recorded = recordRun(legacy, {
  mode: "campaign",
  floorReached: 6,
  win: true,
  turns: 40,
});
assert.equal(recorded.meta.bestFloorCampaign, 6);
assert.equal(recorded.meta.clearsCampaign, 2);
assert.equal(recorded.meta.bestTurnsCampaign, 40);

const worse = recordRun(recorded.meta, {
  mode: "campaign",
  floorReached: 6,
  win: true,
  turns: 55,
});
assert.equal(worse.meta.bestTurnsCampaign, 40);

const daily = recordRun(emptyMeta(), {
  mode: "daily",
  floorReached: 4,
  win: false,
  turns: 22,
  dateKey: "2099-01-01",
});
assert.equal(daily.meta.bestFloorDaily, 4);
assert.equal(daily.meta.clearsDaily, 0);

assert.equal(resolveRunSeed("tutorial"), TUTORIAL_SEED);
assert.equal(resolveRunSeed("daily"), String(dailySeed()));
assert.equal(resolveRunSeed("campaign", "my-seed"), "my-seed");

assert.ok(scoreRun({ floorsCleared: 6, turns: 30, hpRemaining: 50, enemiesDefeated: 10 }) > 500);
assert.equal(localDateKey(new Date("2020-01-05T15:00:00")).slice(0, 4), "2020");

console.log("check-tactical: ok");
