#!/usr/bin/env node
/**
 * Logic checks for WebMCP Escape Room (multi-room depth-4).
 * Covers fixed seed codes, non-linear archive order, item combine,
 * endings, hints/rating, and persistence validation.
 * Also covers second pack (greenhouse), Taipei daily layouts, and no-hint challenge.
 */
import assert from "node:assert/strict";
import {
  FIXED_SEED,
  STATE_VERSION,
  STORAGE_KEY,
  FACILITY_PACK_ID,
  GREENHOUSE_PACK_ID,
  GREENHOUSE_FIXED_SEED,
  PACKS,
  createPuzzle,
  createFacilityLayout,
  initialState,
  canCombine,
  rateRun,
  recordClear,
  migrateMeta,
  emptyMeta,
  progressSteps,
  seedFromString,
  taipeiDateKey,
  dailySeedFor,
  formatShareText,
  nextDailyStreak,
  previousTaipeiDateKey,
} from "./rules.mjs";
import {
  GameEngine,
  PuzzleEngine,
  InventoryEngine,
  TOOLS,
  validateState,
  solveFullRun,
  solveGreenhouseRun,
} from "./engine.mjs";

assert.equal(FIXED_SEED, "agent-demo");
assert.equal(STATE_VERSION, 3);
assert.equal(STORAGE_KEY, "webmcp-escape-room.v3");
assert.ok(PACKS.facility && PACKS.greenhouse);
assert.equal(PACKS.greenhouse.unlock, "open");

const fixed = createPuzzle(FIXED_SEED);
assert.equal(fixed.safeCode, "0317");
assert.equal(fixed.studyExitCode, "8426");
assert.equal(fixed.clockDisplay, "03:17");
assert.equal(fixed.filingCode, "1957");
assert.equal(fixed.vaultCode, "7391");

const other = createPuzzle("replay-seed-7");
assert.notEqual(other.safeCode, fixed.safeCode);
assert.equal(createPuzzle("replay-seed-7").safeCode, other.safeCode, "seeds are stable");
assert.notEqual(seedFromString("a"), seedFromString("b"));

assert.ok(canCombine("copper_wire", "fuse"));
assert.ok(canCombine("fuse", "copper_wire"));
assert.equal(canCombine("copper_wire", "fuse").product, "patch_cable");
assert.deepEqual(canCombine("cipher_card", "override_token").consumes, ["cipher_card"]);
assert.equal(canCombine("battery", "brass_key"), null);

assert.equal(rateRun({ elapsedMs: 60_000, hintsUsed: 0, endingId: "ghost" }), "S");
assert.ok(
  rateRun({ elapsedMs: 60_000, hintsUsed: 3, endingId: "standard" }) !== "S",
  "hints must hurt rating",
);

{
  const meta = recordClear(emptyMeta(), {
    elapsedMs: 120_000,
    endingId: "standard",
    rating: "A",
  });
  assert.equal(meta.clears, 1);
  assert.equal(meta.bestMs, 120_000);
  const slower = recordClear(meta, {
    elapsedMs: 200_000,
    endingId: "service",
    rating: "B",
  });
  assert.equal(slower.bestMs, 120_000);
  assert.ok(slower.endingsSeen.includes("service"));
  assert.equal(migrateMeta(null).clears, 0);
}

{
  const names = TOOLS.map((t) => t.name);
  for (const required of [
    "room_get_state",
    "code_enter",
    "item_combine",
    "exit_try_escape",
    "room_enter",
    "hint_request",
    "game_get_timer",
    "game_new_run",
    "ending_get_summary",
    "pack_list",
    "daily_get_status",
    "run_get_share_text",
  ]) {
    assert.ok(names.includes(required), `missing tool ${required}`);
  }
  assert.ok(names.length >= 25, `expected expanded tool surface, got ${names.length}`);
}

{
  const engine = new GameEngine(initialState(FIXED_SEED));
  const call = (name, args = {}) => engine.execute(name, args, "System");
  assert.equal(call("object_inspect", { objectId: "clock" }).success, true);
  assert.ok(engine.state.cluesDiscovered.includes("stopped_time"));
  assert.equal(call("code_enter", { objectId: "safe", code: "1111" }).success, false);
  assert.equal(engine.state.objects.safe.locked, true);
  assert.equal(call("code_enter", { objectId: "safe", code: "0317" }).success, true);
  assert.equal(call("item_pickup", { itemId: "brass_key" }).success, true);
  assert.equal(call("item_combine", { itemA: "brass_key", itemB: "brass_key" }).success, false);
  const noCombo = call("item_combine", { itemA: "brass_key", itemB: "safe_note" });
  // safe_note not held yet
  assert.equal(noCombo.success, false);
  call("item_pickup", { itemId: "safe_note" });
  const pair = call("item_combine", { itemA: "brass_key", itemB: "safe_note" });
  assert.equal(pair.success, false);
  assert.equal(pair.errorCode, "NO_COMBINATION");
}

{
  const a = solveFullRun(FIXED_SEED, { archiveOrder: "file-first", ending: "standard" });
  assert.equal(a.state.escaped, true);
  assert.equal(a.state.endingId, "standard");
  assert.equal(a.state.roomsVisited.includes("vault"), true);
  const progress = PuzzleEngine.progress(a.state);
  assert.equal(progress.completed, progress.total);

  const b = solveFullRun(FIXED_SEED, { archiveOrder: "fuse-first", ending: "standard" });
  assert.equal(b.state.escaped, true);

  const c = solveFullRun(FIXED_SEED, { ending: "service" });
  assert.equal(c.state.endingId, "service");

  const d = solveFullRun(FIXED_SEED, { ending: "ghost" });
  assert.equal(d.state.endingId, "ghost");
  assert.equal((d.state.hintsUsedIds || []).length, 0);
  assert.ok(d.state.inventory.includes("master_tag"));
}

{
  const engine = new GameEngine(initialState(FIXED_SEED));
  const hint = engine.execute("hint_request", {}, "System");
  assert.equal(hint.success, true);
  assert.equal(engine.state.hintsUsedIds.length, 1);
  const status = engine.execute("hint_get_status", {}, "System");
  assert.equal(status.data.hintsUsed, 1);
  assert.equal(status.data.affectsRating, true);
}

{
  const random = solveFullRun("depth4-check-seed", { ending: "standard" });
  assert.equal(random.state.escaped, true);
  assert.notEqual(random.state.puzzle.safeCode, "0317");
}

{
  const engine = solveFullRun(FIXED_SEED, { ending: "standard" });
  const saved = validateState(JSON.parse(JSON.stringify(engine.state)));
  assert.equal(saved.escaped, true);
  assert.equal(saved.version, STATE_VERSION);
  let rejected = false;
  try {
    validateState({ version: 1, objects: {}, items: {} });
  } catch {
    rejected = true;
  }
  assert.ok(rejected, "v1 saves must be rejected");
}

{
  const steps = progressSteps(initialState(FIXED_SEED));
  assert.ok(steps.length >= 10, "depth-4 should expose a longer milestone chain");
}

{
  const engine = new GameEngine(initialState(FIXED_SEED));
  engine.execute("object_inspect", { objectId: "clock" }, "System");
  engine.execute("code_enter", { objectId: "safe", code: "0317" }, "System");
  engine.execute("item_pickup", { itemId: "brass_key" }, "System");
  assert.equal(engine.execute("game_undo", {}, "System").success, true);
  assert.equal(engine.state.inventory.includes("brass_key"), false);
  assert.ok(InventoryEngine.available(engine.state, "brass_key") || engine.state.objects.safe.open);
}

/* ---- Depth features: greenhouse pack, daily layout, no-hint ---- */
{
  const dateKey = taipeiDateKey(Date.parse("2026-10-22T04:00:00+08:00"));
  assert.equal(dateKey, "2026-10-22");
  assert.equal(previousTaipeiDateKey("2026-10-22"), "2026-10-21");
  const seed = dailySeedFor(dateKey, FACILITY_PACK_ID);
  assert.equal(seed, "daily-2026-10-22-facility");
  const layoutA = createFacilityLayout(seed);
  const layoutB = createFacilityLayout(seed);
  assert.deepEqual(layoutA, layoutB, "daily layout stable");
  assert.ok(layoutA.archiveOrder);
  const classic = createFacilityLayout(FIXED_SEED);
  assert.equal(classic.wireSource, "desk_drawer");
  assert.equal(classic.archiveOrder, "free");
}

{
  const a = createPuzzle("daily-layout-probe-a", FACILITY_PACK_ID);
  const b = createPuzzle("daily-layout-probe-b", FACILITY_PACK_ID);
  assert.ok(a.layout && b.layout);
  // Different seeds should usually differ in codes and/or layout; at least codes differ.
  assert.notEqual(a.safeCode + a.vaultCode, b.safeCode + b.vaultCode);
}

{
  const g = createPuzzle(GREENHOUSE_FIXED_SEED, GREENHOUSE_PACK_ID);
  assert.equal(g.caseCode, "6200");
  assert.equal(g.irrigationCode, "3719");
  assert.equal(g.rooftopCode, "5842");
  assert.ok(canCombine("nutrient_vial", "catalyst_crystal", GREENHOUSE_PACK_ID));
  assert.equal(canCombine("copper_wire", "fuse", GREENHOUSE_PACK_ID), null);
}

{
  const elev = solveGreenhouseRun(GREENHOUSE_FIXED_SEED, { ending: "elevator" });
  assert.equal(elev.state.escaped, true);
  assert.equal(elev.state.endingId, "elevator");
  assert.ok(elev.state.roomsVisited.includes("lab"));
  assert.ok(elev.state.roomsVisited.includes("nursery"));
  assert.ok(elev.state.roomsVisited.includes("rooftop"));

  const ladder = solveGreenhouseRun(GREENHOUSE_FIXED_SEED, { ending: "ladder" });
  assert.equal(ladder.state.endingId, "ladder");

  const bloom = solveGreenhouseRun(GREENHOUSE_FIXED_SEED, { ending: "bloom" });
  assert.equal(bloom.state.endingId, "bloom");
  assert.equal((bloom.state.hintsUsedIds || []).length, 0);
  assert.ok(bloom.state.inventory.includes("specimen_tag"));

  const nurseryFirst = solveGreenhouseRun(GREENHOUSE_FIXED_SEED, {
    ending: "elevator",
    branchOrder: "nursery-first",
  });
  assert.equal(nurseryFirst.state.escaped, true);
}

{
  const dailySeed = dailySeedFor("2026-03-15", FACILITY_PACK_ID);
  const solved = solveFullRun(dailySeed, {
    ending: "standard",
    isDaily: true,
    dateKey: "2026-03-15",
  });
  assert.equal(solved.state.escaped, true);
  assert.ok(solved.state.puzzle.layout);
}

{
  const engine = new GameEngine(
    initialState(FIXED_SEED, { packId: FACILITY_PACK_ID, noHintsChallenge: true }),
  );
  const blocked = engine.execute("hint_request", {}, "System");
  assert.equal(blocked.success, false);
  assert.match(blocked.error, /No-hint challenge/i);

  const cleared = solveFullRun(FIXED_SEED, { ending: "standard", noHintsChallenge: true });
  assert.equal(cleared.state.noHintsChallenge, true);
  assert.equal((cleared.state.hintsUsedIds || []).length, 0);
  const summary = cleared.execute("ending_get_summary", {}, "System");
  assert.equal(summary.data.noHintClear, true);
  assert.ok(summary.data.badges.some((b) => b.id === "no_hint_challenge"));
  assert.ok(summary.data.shareText.includes("No-Hint"));
}

{
  const meta = recordClear(emptyMeta(), {
    elapsedMs: 90_000,
    endingId: "elevator",
    rating: "A",
    packId: GREENHOUSE_PACK_ID,
    hintsUsed: 0,
    isDaily: true,
    dateKey: "2026-10-22",
  });
  assert.ok(meta.packsCleared.includes(GREENHOUSE_PACK_ID));
  assert.equal(meta.dailyStreak, 1);
  assert.equal(meta.dailyBestByDate["2026-10-22"].ms, 90_000);
  const streak2 = nextDailyStreak(meta, "2026-10-23");
  assert.equal(streak2.dailyStreak, 2);
  const share = formatShareText({
    dateKey: "2026-10-22",
    packId: FACILITY_PACK_ID,
    packTitle: "Quiet Facility",
    elapsedLabel: "01:30",
    streak: 2,
    noHints: true,
    endingTitle: "Clean exit",
    rating: "S",
    isDaily: true,
  });
  assert.match(share, /Daily 2026-10-22/);
  assert.match(share, /streak 2/);
  assert.match(share, /No-Hint/);
}

{
  const engine = new GameEngine(initialState(FIXED_SEED));
  const packs = engine.execute("pack_list", {}, "System");
  assert.equal(packs.success, true);
  assert.equal(packs.data.unlockPolicy, "open");
  assert.equal(packs.data.packs.length, 2);
  const daily = engine.execute("daily_get_status", { packId: "greenhouse" }, "System");
  assert.equal(daily.success, true);
  assert.equal(daily.data.timeZone, "Asia/Taipei");
  assert.ok(daily.data.seed.startsWith("daily-"));
}

{
  const engine = new GameEngine(initialState(FIXED_SEED));
  const started = engine.execute(
    "game_new_run",
    { packId: "greenhouse", daily: "true", noHintsChallenge: "true" },
    "System",
  );
  assert.equal(started.success, true);
  assert.equal(started.data.packId, GREENHOUSE_PACK_ID);
  assert.equal(started.data.isDaily, true);
  assert.equal(started.data.noHintsChallenge, true);
  assert.equal(engine.state.packId, GREENHOUSE_PACK_ID);
  assert.equal(engine.state.currentRoom, "atrium");
}

{
  const gh = solveGreenhouseRun(GREENHOUSE_FIXED_SEED, { ending: "elevator" });
  const saved = validateState(JSON.parse(JSON.stringify(gh.state)));
  assert.equal(saved.packId, GREENHOUSE_PACK_ID);
  assert.equal(saved.escaped, true);
}

console.log(
  `check-escape-room: ${TOOLS.length} tools, facility+greenhouse, daily layouts, no-hint — OK`,
);
