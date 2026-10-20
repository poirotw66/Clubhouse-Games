#!/usr/bin/env node
/**
 * Logic checks for Rubik's Cube Academy
 * (patterns, curriculum, progress, practice bank, coach, scramble, timer gate).
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
  "js/practice-bank.js",
  "js/solver-beginner.js",
]);

const {
  RubiksCube,
  CubePatterns,
  CubeCurriculum,
  CubeProgress,
  CubePracticeBank,
  BeginnerCoach,
} = root;

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
  RubiksCube.parseAlgorithm("R U R' U R U2 R'").forEach((m) => engine.applyPermutation(m));
  const stage = BeginnerCoach.diagnose(engine.getFaces());
  assert.ok(
    stage === "yellow-orient" ||
      stage === "yellow-cross" ||
      stage === "permute-corners" ||
      stage === "permute-edges" ||
      stage === "second-layer" ||
      stage === "white-corners" ||
      stage === "white-cross",
    `diagnose got ${stage}`,
  );
  const hint = BeginnerCoach.suggestNext(engine);
  assert.ok(hint.algorithm || hint.moves?.length >= 0, "hint has content");
}

{
  let progress = CubeProgress.emptyProgress();
  progress = CubeProgress.markComplete(progress, "basics-pieces");
  assert.ok(progress.completed["basics-pieces"], "mark complete");
  const loaded = CubeProgress.loadProgress();
  assert.ok(loaded.completed["basics-pieces"], "progress persists");
}

/* -------- Timer gate: only solved times count -------- */
{
  assert.equal(CubeProgress.canRecordSolve(false, 1234), false, "unsolved rejected");
  assert.equal(CubeProgress.canRecordSolve(true, 10), false, "too short rejected");
  assert.equal(CubeProgress.canRecordSolve(true, 1234), true, "solved accepted");

  let times = CubeProgress.emptyTimes();
  const before = times.runs.length;
  times = CubeProgress.recordTime(times, 5000, "R U R'", { solved: false });
  assert.equal(times.runs.length, before, "unsolved recordTime is no-op");

  times = CubeProgress.recordTime(times, 5000, "R U R'", { solved: true });
  assert.equal(times.runs.length, before + 1, "solved recordTime appends");
  assert.equal(times.runs.at(-1).solved, true, "run tagged solved");
  assert.equal(times.bestMs, 5000, "pb set");

  times = CubeProgress.recordTime(times, 4000, "U", { solved: true });
  assert.equal(times.bestMs, 4000, "pb improves");
  assert.equal(CubeProgress.isPersonalBest(CubeProgress.emptyTimes(), 1000), true, "first is pb");
}

{
  let times = CubeProgress.emptyTimes();
  for (let i = 0; i < 5; i++) {
    times = CubeProgress.recordTime(times, 10000 + i * 100, "R U", { solved: true });
  }
  const ao5 = CubeProgress.averageOf(times.runs, 5);
  assert.ok(ao5 != null && ao5 > 0, "ao5");
  assert.equal(CubeProgress.formatMs(1234).includes("."), true, "format");
}

/* -------- Storage key prefixes -------- */
{
  assert.ok(CubeProgress.KEY.startsWith("rubiks-cube-academy:"), "progress key prefix");
  assert.ok(CubeProgress.TIMES_KEY.startsWith("rubiks-cube-academy:"), "times key prefix");
  assert.ok(CubeProgress.PRACTICE_KEY.startsWith("rubiks-cube-academy:"), "practice key prefix");
  assert.ok(CubeProgress.DAILY_KEY.startsWith("rubiks-cube-academy:"), "daily key prefix");
  assert.ok(CubeProgress.SFX_KEY.startsWith("rubiks-cube-academy:"), "sfx key prefix");
}

/* -------- Practice proficiency -------- */
{
  let practice = CubeProgress.emptyPractice();
  practice = CubeProgress.recordPracticeAttempt(practice, "white-cross");
  practice = CubeProgress.recordPracticeSolve(practice, "white-cross", 8000);
  assert.equal(practice.byStage["white-cross"].attempts, 1, "attempt");
  assert.equal(practice.byStage["white-cross"].solves, 1, "solve");
  assert.equal(practice.byStage["white-cross"].bestMs, 8000, "best");
  // Untimed solve must not poison best/average with 0
  practice = CubeProgress.recordPracticeSolve(practice, "white-cross", 0);
  assert.equal(practice.byStage["white-cross"].solves, 2, "untimed solve counts");
  assert.equal(practice.byStage["white-cross"].bestMs, 8000, "untimed keeps best");
  assert.equal(practice.byStage["white-cross"].totalSolveMs, 8000, "untimed skips total");
  const reloaded = CubeProgress.loadPractice();
  assert.equal(reloaded.byStage["white-cross"].solves, 2, "practice persists");
}

/* -------- Scramble generator -------- */
{
  assert.equal(typeof RubiksCube.createScramble, "function", "createScramble exported");
  for (const len of [11, 20, 25]) {
    const seq = RubiksCube.createScramble(len);
    assert.equal(seq.length, len, `scramble length ${len}`);
    let prevFace = "";
    for (const move of seq) {
      assert.ok(/^[UDLRFB](?:2|')?$/.test(move), `legal move ${move}`);
      assert.notEqual(move[0], prevFace, "no consecutive same face");
      prevFace = move[0];
    }
    const engine = new RubiksCube.CubeEngine(3);
    seq.forEach((m) => engine.applyPermutation(m));
    assert.equal(engine.isSolved(), false, `scramble ${len} not solved`);
  }

  const text = CubePracticeBank.generateScramble(20);
  assert.equal(text.split(/\s+/).length, 20, "generateScramble text");
}

/* -------- Daily seeded scramble (deterministic across callers) -------- */
{
  assert.equal(typeof RubiksCube.createDailyScramble, "function", "createDailyScramble");
  assert.equal(typeof RubiksCube.hashString, "function", "hashString");
  const a = RubiksCube.createDailyScramble("2026-10-20", 20);
  const b = RubiksCube.createDailyScramble("2026-10-20", 20);
  const c = RubiksCube.createDailyScramble("2026-10-21", 20);
  assert.equal(a.join(" "), b.join(" "), "same date → same scramble");
  assert.notEqual(a.join(" "), c.join(" "), "different date → different scramble");
  assert.equal(a.length, 20, "daily length");

  let daily = CubeProgress.emptyDaily();
  const dateKey = "2026-10-20";
  const scramble = a.join(" ");
  ({ daily } = CubeProgress.ensureDailyEntry(daily, dateKey, scramble));
  assert.equal(daily.byDate[dateKey].scramble, scramble, "daily entry scramble");

  daily = CubeProgress.recordDailySolve(daily, dateKey, 12345, scramble);
  assert.equal(daily.byDate[dateKey].bestMs, 12345, "daily best");
  assert.equal(daily.streak, 1, "streak starts at 1");
  assert.equal(daily.lastSolvedDate, dateKey, "last solved date");

  daily = CubeProgress.recordDailySolve(daily, dateKey, 15000, scramble);
  assert.equal(daily.byDate[dateKey].bestMs, 12345, "worse time keeps best");
  assert.equal(daily.streak, 1, "same-day streak unchanged");

  daily = CubeProgress.recordDailySolve(daily, "2026-10-21", 11000, "U");
  assert.equal(daily.streak, 2, "consecutive day increments streak");

  daily = CubeProgress.recordDailySolve(daily, "2026-10-23", 10000, "R");
  assert.equal(daily.streak, 1, "gap resets streak");

  const share = CubeProgress.formatShareText(daily, "2026-10-23");
  assert.ok(share.includes("2026-10-23"), "share has date");
  assert.ok(share.includes("連續天數"), "share has streak label");
}

/* -------- Record-break detection -------- */
{
  let times = CubeProgress.emptyTimes();
  const prev = { runs: [...times.runs], bestMs: times.bestMs, updatedAt: 0 };
  times = CubeProgress.recordTime(times, 5000, "R", { solved: true });
  const br = CubeProgress.detectRecordBreaks(prev, times, 5000);
  assert.equal(br.isPb, true, "first solve is PB");
}

/* -------- Practice bank: every curated case validates -------- */
{
  assert.equal(CubePracticeBank.CORE_STAGE_ORDER.length, 7, "seven core stages");
  assert.ok(CubePracticeBank.STAGE_ORDER.length >= 9, "includes 2-look stages");
  assert.ok(CubePracticeBank.STAGE_ORDER.includes("oll-2look"), "oll-2look");
  assert.ok(CubePracticeBank.STAGE_ORDER.includes("pll-2look"), "pll-2look");
  for (const stageId of CubePracticeBank.STAGE_ORDER) {
    const cases = CubePracticeBank.casesFor(stageId);
    assert.ok(cases.length >= 6, `${stageId} has cases`);
    for (const c of cases) {
      const result = CubePracticeBank.validateCase(c);
      assert.equal(result.ok, true, `${c.id} valid (${result.reason || "ok"})`);
    }
    // Deterministic pick
    let i = 0;
    const rng = () => {
      const values = [0.01, 0.2, 0.4, 0.6, 0.8, 0.99];
      return values[i++ % values.length];
    };
    const picked = CubePracticeBank.pickCase(stageId, rng);
    assert.equal(picked.stageId, stageId, "pick stage");
    const pickedOk = CubePracticeBank.validateCase(picked);
    assert.equal(pickedOk.ok, true, `picked ${picked.id} valid (${pickedOk.reason || "ok"})`);
  }
}

/* -------- SFX module adds new helpers without removing old exports -------- */
{
  const sfxPath = path.join(__dirname, "../shared/sfx.mjs");
  const src = fs.readFileSync(sfxPath, "utf8");
  for (const name of [
    "playMove",
    "playWin",
    "playGoal",
    "playCubeTurn",
    "playInspectTick",
    "playTimerStart",
    "playTimerStop",
    "playSolveComplete",
  ]) {
    assert.ok(src.includes(`export function ${name}`), `sfx exports ${name}`);
  }
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
