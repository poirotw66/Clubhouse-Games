#!/usr/bin/env node
/**
 * Pure goal-evaluation checks for Cinder Circuit expeditions.
 * Mirrors evaluateGoal() in index.html — keep in sync when changing tiers.
 */
import assert from "node:assert/strict";

const EXPEDITIONS = {
  ember: { goalKind: "circuits", goalTarget: 3 },
  wick: { goalKind: "boss", goalTarget: 1 },
  ash: { goalKind: "boss_by_circuit", goalTarget: 5 },
};

function evaluateGoal(exp, outcome, loop) {
  if (exp.goalKind === "circuits") {
    if (outcome === "victory") return "met";
    if (outcome === "death") return "failed";
    if (loop >= exp.goalTarget) return "met";
    return "abandoned";
  }
  if (exp.goalKind === "boss_by_circuit") {
    if (outcome === "victory") return loop <= exp.goalTarget ? "met" : "late";
    if (outcome === "death") return "failed";
    return "abandoned";
  }
  if (outcome === "victory") return "met";
  if (outcome === "death") return "failed";
  return "abandoned";
}

const cases = [
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

let failed = 0;
for (const [id, outcome, loop, expected] of cases) {
  const got = evaluateGoal(EXPEDITIONS[id], outcome, loop);
  try {
    assert.equal(got, expected, `${id} ${outcome} @${loop}`);
  } catch (err) {
    console.error(err.message);
    failed += 1;
  }
}

if (failed) {
  console.error(`self-check failed: ${failed} case(s)`);
  process.exit(1);
}
console.log(`loop-hero expedition goals OK (${cases.length} cases)`);
