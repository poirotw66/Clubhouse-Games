#!/usr/bin/env node
/**
 * Logic checks for Rubik's Cube Academy (patterns, curriculum, progress, coach).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadScripts(files) {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    document: {
      readyState: "complete",
      getElementById: () => null,
      createElement: () => ({
        style: {},
        dataset: {},
        classList: { add() {}, remove() {}, toggle() {} },
        append() {},
        replaceChildren() {},
        addEventListener() {},
        setAttribute() {},
      }),
      createDocumentFragment: () => ({ append() {} }),
      querySelectorAll: () => [],
    },
    window: {},
    globalThis: {},
    performance: { now: Date.now },
    localStorage: (() => {
      const map = new Map();
      return {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: (k) => map.delete(k),
      };
    })(),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  for (const file of files) {
    const code = fs.readFileSync(path.join(__dirname, file), "utf8");
    vm.runInNewContext(code, sandbox, { filename: file });
  }
  return sandbox;
}

const root = loadScripts([
  "js/cube-core.js",
  "js/patterns.js",
  "js/curriculum.js",
  "js/progress.js",
  "js/solver-beginner.js",
]);

const { RubiksCube, CubePatterns, CubeCurriculum, CubeProgress, BeginnerCoach } = root;

assert.ok(RubiksCube?.CubeEngine, "CubeEngine exported");
assert.equal(CubeCurriculum.LESSONS.length >= 12, true, "curriculum length");
assert.ok(CubeCurriculum.lessonById("white-cross"), "white-cross lesson");
assert.ok(CubeCurriculum.CHEAT_SHEET.length >= 5, "cheat sheet");

{
  const engine = new RubiksCube.CubeEngine(3);
  assert.equal(CubePatterns.isSolved(engine.getFaces()), true, "solved start");
  assert.equal(CubePatterns.hasWhiteCross(engine.getFaces()), true, "solved has cross");
  assert.equal(CubePatterns.hasWhiteLayer(engine.getFaces()), true, "solved has white layer");
  assert.equal(CubePatterns.hasSecondLayer(engine.getFaces()), true, "solved has second");
  assert.equal(CubePatterns.hasYellowFace(engine.getFaces()), true, "solved yellow");
}

{
  const engine = new RubiksCube.CubeEngine(3);
  engine.applyPermutation("R");
  assert.equal(CubePatterns.hasWhiteCross(engine.getFaces()), false, "R breaks cross");
  assert.equal(CubePatterns.checkStage("white-cross", engine.getFaces()).complete, false);
}

{
  const engine = new RubiksCube.CubeEngine(3);
  // Break only yellow face orientation-ish with Sune inverse path
  RubiksCube.parseAlgorithm("R U R' U R U2 R'").forEach((m) => engine.applyPermutation(m));
  const stage = BeginnerCoach.diagnose(engine.getFaces());
  assert.ok(stage === "yellow-orient" || stage === "yellow-cross" || stage === "permute-corners" || stage === "permute-edges" || stage === "second-layer" || stage === "white-corners" || stage === "white-cross", `diagnose got ${stage}`);
  const hint = BeginnerCoach.suggestNext(engine);
  assert.ok(hint.algorithm || hint.moves?.length >= 0, "hint has content");
}

{
  let progress = CubeProgress.emptyProgress();
  progress = CubeProgress.markComplete(progress, "basics-pieces");
  assert.ok(progress.completed["basics-pieces"], "mark complete");
  const loaded = CubeProgress.loadProgress();
  // localStorage in sandbox should persist within same root
  assert.ok(loaded.completed["basics-pieces"], "progress persists");
}

{
  let times = CubeProgress.emptyTimes();
  for (let i = 0; i < 5; i++) times = CubeProgress.recordTime(times, 10000 + i * 100, "R U");
  const ao5 = CubeProgress.averageOf(times.runs, 5);
  assert.ok(ao5 != null && ao5 > 0, "ao5");
  assert.equal(CubeProgress.formatMs(1234).includes("."), true, "format");
}

{
  // Existing tools still present
  const names = RubiksCube.TOOL_DEFINITIONS.map((t) => t.name);
  for (const n of [
    "cube_get_state",
    "cube_move",
    "cube_execute_algorithm",
    "cube_scramble",
    "cube_reset",
    "cube_undo",
    "cube_check_solved",
    "cube_get_available_moves",
    "cube_set_size",
  ]) {
    assert.ok(names.includes(n), `tool ${n}`);
  }

  // Tutor tool names are registered by academy-app at runtime; assert schema helpers exist.
  assert.equal(typeof RubiksCube.objectSchema, "function", "objectSchema");
  const sample = RubiksCube.objectSchema({ lessonId: { type: "string" } }, ["lessonId"]);
  assert.ok(sample.required.includes("lessonId"), "required lessonId");
}

{
  const mask = CubePatterns.highlightForStage("white-cross");
  assert.ok(mask.length >= 4, "white-cross highlight slots");
  assert.ok(mask.every((s) => s.face && Number.isInteger(s.index)), "highlight shape");
}

{
  const engine = new RubiksCube.CubeEngine(3);
  RubiksCube.parseAlgorithm("F R U R' U' F'").forEach((m) => engine.applyPermutation(m));
  const plan = BeginnerCoach.buildSolvePlan(engine, 24);
  assert.ok(plan.steps.length >= 1, "solve plan steps");
}

console.log("check-academy: ok");
