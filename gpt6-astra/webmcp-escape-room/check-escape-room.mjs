#!/usr/bin/env node
/**
 * Logic checks for WebMCP Escape Room (multi-room depth-4).
 * Covers fixed seed codes, non-linear archive order, item combine,
 * endings, hints/rating, and persistence validation.
 */
import assert from "node:assert/strict";
import {
  FIXED_SEED,
  STATE_VERSION,
  STORAGE_KEY,
  createPuzzle,
  initialState,
  canCombine,
  rateRun,
  recordClear,
  migrateMeta,
  emptyMeta,
  progressSteps,
  seedFromString,
} from "./rules.mjs";
import {
  GameEngine,
  PuzzleEngine,
  InventoryEngine,
  TOOLS,
  validateState,
  solveFullRun,
} from "./engine.mjs";

assert.equal(FIXED_SEED, "agent-demo");
assert.equal(STATE_VERSION, 2);
assert.equal(STORAGE_KEY, "webmcp-escape-room.v2");

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

console.log(`check-escape-room: ${TOOLS.length} tools, fixed+random seeds, 3 endings, non-linear archive — OK`);
