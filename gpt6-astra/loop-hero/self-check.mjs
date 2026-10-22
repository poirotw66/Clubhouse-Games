#!/usr/bin/env node
/**
 * Pure logic checks for Cinder Circuit (Astra · Loop Hero).
 * Imports rules.mjs — keep in sync with index.html behavior.
 */
import assert from "node:assert/strict";
import {
  BASE_CARD_KEYS,
  BOSS_DEFS,
  CRAFT_BUILDINGS,
  DAILY_MODIFIERS,
  DAILY_MODIFIER_IDS,
  ELITE_MODIFIERS,
  EVENT_CARD_DEFS,
  EXPEDITIONS,
  ROUTE_CARD_DEFS,
  ROUTES,
  ROUTE_ORDER,
  applyEliteModifier,
  bossProgressLabel,
  cardPoolForRoute,
  cardsUntilBell,
  craftBuilding,
  currentDailyStreak,
  dailyChallenge,
  dailySeed,
  emptyBuildings,
  emptyCleared,
  emptyDailyPersist,
  emptyResources,
  emptyRouteClears,
  evaluateGoal,
  eventCardPool,
  formatDailyShareText,
  getBossDef,
  getExpedition,
  getRoute,
  isRouteUnlocked,
  mergeDailyAttempt,
  migrateDailyPersist,
  migrateMeta,
  pathStepsAdjacent,
  previousDayKey,
  sealHintText,
  startingBossProgress,
  todayKeyTaipei,
} from "./rules.mjs";

let failed = 0;
function check(label, fn) {
  try {
    fn();
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${label}: ${err.message}`);
  }
}

/* ── Expedition goals (legacy cases) ── */
const goalCases = [
  ["ember", "retreat", 3, "met"],
  ["ember", "retreat", 2, "abandoned"],
  ["ember", "death", 4, "failed"],
  ["ember", "victory", 2, "met"],
  ["wick", "victory", 4, "met"],
  ["wick", "retreat", 6, "abandoned"],
  ["wick", "death", 3, "failed"],
  ["ash", "victory", 5, "met"],
  ["ash", "victory", 6, "late"],
  ["ash", "retreat", 4, "abandoned"],
  ["ash", "death", 5, "failed"],
];
for (const [id, outcome, loop, expected] of goalCases) {
  check(`goal ${id} ${outcome}@${loop}`, () => {
    assert.equal(evaluateGoal(EXPEDITIONS[id], outcome, loop), expected);
  });
}

/* ── cardsNeeded / seal copy consistency ── */
check("cardsNeeded × bossGain ≈ 100", () => {
  for (const exp of Object.values(EXPEDITIONS)) {
    const product = exp.cardsNeeded * exp.bossGain;
    assert.ok(
      product >= 95 && product <= 110,
      `${exp.id}: ${exp.cardsNeeded}×${exp.bossGain}=${product}`,
    );
  }
});

check("cardsUntilBell at 0% equals cardsNeeded", () => {
  for (const exp of Object.values(EXPEDITIONS)) {
    assert.equal(cardsUntilBell(0, exp.bossGain, exp.cardsNeeded), exp.cardsNeeded);
  }
});

check("cardsUntilBell mid-progress uses remaining gain steps", () => {
  const wick = EXPEDITIONS.wick;
  // 40% done → 60% left / 5 = 12
  assert.equal(cardsUntilBell(40, wick.bossGain, wick.cardsNeeded), 12);
  assert.equal(cardsUntilBell(100, wick.bossGain, wick.cardsNeeded), 0);
});

check("sealHintText mentions remaining placements and cardsNeeded", () => {
  const wick = EXPEDITIONS.wick;
  const tip = sealHintText(wick, 0);
  assert.match(tip, /20 more placement/);
  assert.match(tip, /\+5%/);
  const mid = sealHintText(wick, 50);
  assert.match(mid, /10 more placement/);
  assert.match(sealHintText(wick, 100), /occupies/);
});

check("bossProgressLabel shows cards-to-Bell", () => {
  const label = bossProgressLabel(EXPEDITIONS.ember, 0, false);
  assert.match(label, /25 cards to Bell/);
  assert.match(bossProgressLabel(EXPEDITIONS.wick, 0, true), /Keeper waits/);
});

/* ── Routes & bosses ── */
check("two routes with distinct bosses", () => {
  // Legacy drowned + ashen remain; length grows with glassmere.
  assert.ok(ROUTE_ORDER.length >= 2);
  assert.equal(ROUTES.drowned.bossId, "boss");
  assert.equal(ROUTES.ashen.bossId, "boss_hollow");
  assert.ok(ROUTES.drowned.path.length >= 16);
  assert.ok(ROUTES.ashen.path.length >= 16);
  assert.equal(ROUTES.drowned.path.length, ROUTES.ashen.path.length);
  assert.ok(BOSS_DEFS.boss);
  assert.ok(BOSS_DEFS.boss_hollow);
  assert.notEqual(BOSS_DEFS.boss.name, BOSS_DEFS.boss_hollow.name);
  assert.equal(getBossDef(getRoute("ashen").bossId).name, "The Hollow Peal");
});

check("route paths stay on the 11×9 grid and seal is index 10", () => {
  for (const route of Object.values(ROUTES)) {
    assert.equal(route.path.length, 20, `${route.id} length`);
    for (const [x, y] of route.path) {
      assert.ok(x >= 0 && x < 11 && y >= 0 && y < 9, `${route.id} (${x},${y})`);
    }
    const uniq = new Set(route.path.map(([x, y]) => `${x},${y}`));
    assert.equal(uniq.size, route.path.length, `${route.id} unique tiles`);
    assert.ok(pathStepsAdjacent(route.path), `${route.id} must be a closed adjacent loop`);
  }
});

check("ashen unlock gates", () => {
  const locked = migrateMeta({});
  assert.equal(isRouteUnlocked(locked, "drowned"), true);
  assert.equal(isRouteUnlocked(locked, "ashen"), false);
  const cleared = migrateMeta({ cleared: { wick: 1 } });
  assert.equal(isRouteUnlocked(cleared, "ashen"), true);
  const crafted = migrateMeta({ buildings: { cartographer: 1 } });
  assert.equal(isRouteUnlocked(crafted, "ashen"), true);
});

/* ── Camp craft ── */
check("craftBuilding spends bank and ranks up", () => {
  const meta = {
    bank: { wood: 20, stone: 20, dust: 20, iron: 20 },
    buildings: emptyBuildings(),
    unlockedRoutes: ["drowned"],
  };
  const first = craftBuilding(meta, "archive");
  assert.equal(first.ok, true);
  assert.equal(first.rank, 1);
  assert.equal(first.unlockedCard, "omen");
  assert.equal(first.bank.wood, 8);
  assert.equal(first.buildings.archive, 1);

  const maxed = craftBuilding(
    { bank: first.bank, buildings: first.buildings, unlockedRoutes: first.unlockedRoutes },
    "archive",
  );
  assert.equal(maxed.ok, false);
  assert.equal(maxed.error, "maxed");
});

check("craftBuilding cartographer unlocks ashen", () => {
  const meta = {
    bank: { wood: 20, stone: 20, dust: 20, iron: 0 },
    buildings: emptyBuildings(),
    unlockedRoutes: ["drowned"],
  };
  const result = craftBuilding(meta, "cartographer");
  assert.equal(result.ok, true);
  assert.ok(result.unlockedRoutes.includes("ashen"));
});

check("craftBuilding cannot_afford", () => {
  const result = craftBuilding(
    { bank: emptyResources(), buildings: emptyBuildings(), unlockedRoutes: ["drowned"] },
    "bellfoundry",
  );
  assert.equal(result.ok, false);
  assert.equal(result.error, "cannot_afford");
});

check("craftBuilding unknown", () => {
  const result = craftBuilding(
    { bank: emptyResources(), buildings: emptyBuildings() },
    "nope",
  );
  assert.equal(result.error, "unknown_building");
});

check("veilwright ranks and event pool", () => {
  assert.equal(eventCardPool(emptyBuildings()).length, 0);
  assert.deepEqual(eventCardPool({ archive: 1, veilwright: 1 }), ["omen", "eclipse"]);
  assert.ok(EVENT_CARD_DEFS.omen.event);
  assert.ok(EVENT_CARD_DEFS.eclipse.event);
  assert.equal(CRAFT_BUILDINGS.veilwright.max, 3);
});

check("startingBossProgress from bellfoundry", () => {
  assert.equal(startingBossProgress(emptyBuildings()), 0);
  assert.equal(startingBossProgress({ bellfoundry: 2 }), 10);
  assert.equal(startingBossProgress({ bellfoundry: 9 }), 40);
});

/* ── Elite modifiers ── */
check("elite modifiers apply", () => {
  assert.ok(Object.keys(ELITE_MODIFIERS).length >= 3);
  const base = { hp: 100, maxHp: 100, attack: 10, defense: 2, speed: 1 };
  const plated = applyEliteModifier(base, "plated");
  assert.equal(plated.defense, 6);
  assert.equal(plated.modifierLabel, "Plated");
  const frenzied = applyEliteModifier(base, "frenzied");
  assert.equal(frenzied.speed, 1.25);
  const virulent = applyEliteModifier(base, "virulent");
  assert.equal(virulent.pierce, 0.3);
});

/* ── Meta migration ── */
check("migrateMeta from v2 shape", () => {
  const m = migrateMeta({
    bank: { wood: 3 },
    upgrades: { vitality: 2, dial: 1 },
    expeditionId: "ash",
    cleared: { ember: 2 },
  });
  assert.equal(m.bank.wood, 3);
  assert.equal(m.upgrades.vitality, 2);
  assert.equal(m.upgrades.dial, 1);
  assert.equal(m.expeditionId, "ash");
  assert.equal(m.cleared.ember, 2);
  assert.equal(m.routeId, "drowned");
  assert.deepEqual(m.buildings, emptyBuildings());
  assert.ok(m.unlockedRoutes.includes("drowned"));
});

check("getExpedition / getRoute fallbacks", () => {
  assert.equal(getExpedition("nope").id, "wick");
  assert.equal(getRoute("nope").id, "drowned");
});

check("emptyCleared keys", () => {
  assert.deepEqual(Object.keys(emptyCleared()).sort(), ["ash", "ember", "wick"]);
});

/* ── Glassmere third route (depth deepen) ── */
check("glassmere route has exclusive boss, enemies, and ≥4 cards", () => {
  assert.ok(ROUTE_ORDER.includes("glassmere"));
  assert.equal(ROUTE_ORDER.length, 3);
  const route = ROUTES.glassmere;
  assert.equal(route.bossId, "boss_glass");
  assert.ok(BOSS_DEFS.boss_glass);
  assert.equal(getBossDef(route.bossId).name, "The Stillglass Knell");
  assert.ok(Array.isArray(route.exclusiveEnemies));
  assert.ok(route.exclusiveEnemies.length >= 4);
  assert.ok(Array.isArray(route.exclusiveCards));
  assert.ok(route.exclusiveCards.length >= 4);
  for (const key of route.exclusiveCards) {
    assert.ok(ROUTE_CARD_DEFS[key], `missing card def ${key}`);
    assert.equal(ROUTE_CARD_DEFS[key].routeId, "glassmere");
  }
  assert.equal(ROUTES.drowned.path.length, ROUTES.glassmere.path.length);
  assert.notEqual(BOSS_DEFS.boss_glass.name, BOSS_DEFS.boss.name);
  assert.notEqual(BOSS_DEFS.boss_glass.name, BOSS_DEFS.boss_hollow.name);
});

check("glassmere unlocks only after clearing drowned and ashen", () => {
  const locked = migrateMeta({});
  assert.equal(isRouteUnlocked(locked, "glassmere"), false);
  const one = migrateMeta({ routeClears: { drowned: 1, ashen: 0 } });
  assert.equal(isRouteUnlocked(one, "glassmere"), false);
  const both = migrateMeta({ routeClears: { drowned: 1, ashen: 1 } });
  assert.equal(isRouteUnlocked(both, "glassmere"), true);
  assert.ok(both.unlockedRoutes.includes("glassmere"));
});

check("cardPoolForRoute includes exclusives on glassmere only", () => {
  assert.ok(BASE_CARD_KEYS.length >= 8);
  const drowned = cardPoolForRoute("drowned");
  const glass = cardPoolForRoute("glassmere");
  assert.ok(!drowned.includes("mirror"));
  assert.ok(glass.includes("mirror"));
  assert.ok(glass.includes("reed"));
  assert.ok(glass.includes("tide"));
  assert.ok(glass.includes("shard"));
  assert.ok(cardPoolForRoute("glassmere", { dial: 1 }).includes("dial"));
});

check("emptyRouteClears keys", () => {
  assert.deepEqual(
    Object.keys(emptyRouteClears()).sort(),
    ["ashen", "drowned", "glassmere"],
  );
});

/* ── Daily loop (Asia/Taipei) ── */
check("todayKeyTaipei uses UTC+8 wall clock", () => {
  // 2026-03-15 16:00 UTC → still 2026-03-16 00:00 Taipei
  const lateUtc = new Date(Date.UTC(2026, 2, 15, 16, 0, 0));
  assert.equal(todayKeyTaipei(lateUtc), "2026-03-16");
  const earlyUtc = new Date(Date.UTC(2026, 2, 15, 15, 59, 0));
  assert.equal(todayKeyTaipei(earlyUtc), "2026-03-15");
});

check("dailyChallenge stable for same Taipei date", () => {
  const a = dailyChallenge("2026-10-22");
  const b = dailyChallenge("2026-10-22");
  assert.equal(a.seed, b.seed);
  assert.equal(a.routeId, b.routeId);
  assert.equal(a.modifierId, b.modifierId);
  assert.deepEqual(a.startingDeck, b.startingDeck);
  assert.ok(ROUTE_ORDER.includes(a.routeId));
  assert.ok(DAILY_MODIFIER_IDS.includes(a.modifierId));
  assert.ok(a.startingDeck.length >= 4);
  assert.ok(DAILY_MODIFIERS[a.modifierId]);
  const c = dailyChallenge("2026-10-23");
  assert.notEqual(a.seed, c.seed);
  assert.equal(dailySeed("2026-10-22"), a.seed);
});

check("daily streak and share text", () => {
  let persist = emptyDailyPersist();
  persist = mergeDailyAttempt(persist, "2026-10-20", {
    loop: 4,
    kills: 10,
    goalMet: true,
    routeId: "drowned",
    modifierId: "fogbound",
  });
  assert.equal(persist.streak, 1);
  assert.equal(persist.days["2026-10-20"].bestLoop, 4);
  persist = mergeDailyAttempt(persist, "2026-10-21", {
    loop: 5,
    kills: 12,
    goalMet: true,
    routeId: "ashen",
    modifierId: "thin_wick",
  });
  assert.equal(persist.streak, 2);
  persist = mergeDailyAttempt(persist, "2026-10-21", {
    loop: 6,
    kills: 8,
    goalMet: true,
  });
  assert.equal(persist.streak, 2, "same-day goal does not double streak");
  assert.equal(persist.days["2026-10-21"].bestLoop, 6);
  persist = mergeDailyAttempt(persist, "2026-10-23", {
    loop: 3,
    kills: 4,
    goalMet: true,
  });
  assert.equal(persist.streak, 1, "gap resets streak");
  assert.equal(previousDayKey("2026-10-22"), "2026-10-21");
  assert.equal(currentDailyStreak(persist, "2026-10-23"), 1);
  const share = formatDailyShareText({
    dateKey: "2026-10-23",
    routeName: "Glassmere Rill",
    modifierLabel: "Fogbound Road",
    bestLoop: 3,
    bestKills: 4,
    streak: 1,
    goalMet: true,
  });
  assert.match(share, /每日迴路/);
  assert.match(share, /連續天數/);
  assert.match(share, /Glassmere/);
});

check("migrateDailyPersist sanitizes", () => {
  const m = migrateDailyPersist({
    days: { "2026-01-01": { bestLoop: 2.7, attempts: -1, completed: 1 } },
    streak: "3",
  });
  assert.equal(m.days["2026-01-01"].bestLoop, 2);
  assert.equal(m.days["2026-01-01"].attempts, 0);
  assert.equal(m.streak, 3);
  assert.deepEqual(migrateDailyPersist(null).days, {});
});

if (failed) {
  console.error(`self-check failed: ${failed} case(s)`);
  process.exit(1);
}
console.log(
  `loop-hero self-check OK (${goalCases.length} goals + craft/routes/cardsNeeded/elites + glassmere/daily)`,
);
