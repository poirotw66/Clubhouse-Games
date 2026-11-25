/**
 * Direct production verification for Cyber Neon Rush lane physics,
 * track path math, difficulty tuning, and combo/fever mechanics.
 *
 * Imports directly from production TypeScript modules.
 */
import assert from 'node:assert/strict';
import {
  COMBO_DECAY_SEC,
  FEVER_COMBO,
  HITSTOP_DURATION,
  INPUT_BUFFER_DURATION,
  LANE_DAMPING,
  LANE_SPRING,
  LANE_WIDTH,
  NEAR_MISS_WINDOW,
  PERFECT_MISS_WINDOW,
  RUSH_DIFFICULTIES,
  RUSH_TUNING,
  clampLane,
  laneToX,
} from './constants.ts';
import {
  createLaneBody,
  laneBodyRoll,
  stepLaneBody,
} from './lanePhysics.ts';
import {
  trackCurvature,
  trackHeading,
  trackOffset,
  trackSlope,
} from './trackPath.ts';
import {
  breakCombo,
  comboMultiplier,
  createScoreState,
  isFever,
  registerNearMiss,
  tickScoreTimers,
} from './scoreSystem.ts';

// ── 1) Constants & Lane Mapping Verification ─────────────────────────────────
assert.equal(LANE_WIDTH, 2.4, 'LANE_WIDTH must be 2.4');
assert.equal(LANE_SPRING, 160, 'LANE_SPRING must be 160 for responsive arcade lane snap');
assert.equal(LANE_DAMPING, 18, 'LANE_DAMPING must be 18');
assert.ok(NEAR_MISS_WINDOW >= 1.9 && NEAR_MISS_WINDOW <= 2.1, `tightened near-miss window expected ~2.0, got ${NEAR_MISS_WINDOW}`);
assert.ok(NEAR_MISS_WINDOW < LANE_WIDTH, 'NEAR_MISS_WINDOW must be smaller than LANE_WIDTH to eliminate passive adjacent-lane farming');
assert.ok(PERFECT_MISS_WINDOW >= 1.0 && PERFECT_MISS_WINDOW <= 1.2, `tightened perfect-miss window expected ~1.1, got ${PERFECT_MISS_WINDOW}`);
assert.ok(COMBO_DECAY_SEC >= 3.6, `combo decay buffer should be at least 3.6s, got ${COMBO_DECAY_SEC}`);
assert.ok(HITSTOP_DURATION >= 0.08 && HITSTOP_DURATION <= 0.10, `hitstop duration expected ~0.09s, got ${HITSTOP_DURATION}`);
assert.ok(INPUT_BUFFER_DURATION >= 0.09 && INPUT_BUFFER_DURATION <= 0.12, `input buffer duration expected ~100ms, got ${INPUT_BUFFER_DURATION}`);

assert.equal(laneToX(1), 0, 'center lane (lane 1) must be at X=0');
assert.ok(laneToX(0) > 0, 'lane 0 (left) must be +X for +Z chase camera screen-left');
assert.ok(laneToX(2) < 0, 'lane 2 (right) must be -X for +Z chase camera screen-right');
assert.equal(clampLane(-1), 0, 'clampLane(-1) should clamp to 0');
assert.equal(clampLane(1), 1, 'clampLane(1) should stay 1');
assert.equal(clampLane(5), 2, 'clampLane(5) should clamp to 2');

// ── 2) Difficulty Curve Monotonicity ─────────────────────────────────────────
assert.deepEqual(RUSH_DIFFICULTIES, ['chill', 'normal', 'rush']);
assert.ok(
  RUSH_TUNING.chill.speedMul < RUSH_TUNING.normal.speedMul &&
    RUSH_TUNING.normal.speedMul < RUSH_TUNING.rush.speedMul,
  'speed multiplier must strictly scale across chill < normal < rush',
);
assert.ok(
  RUSH_TUNING.chill.gapMul > RUSH_TUNING.normal.gapMul &&
    RUSH_TUNING.normal.gapMul > RUSH_TUNING.rush.gapMul,
  'obstacle gap must be more generous in chill and tighter in rush',
);

// ── 3) Lane Physics Spring & Damping Response ────────────────────────────────
{
  const body = createLaneBody(1);
  assert.equal(body.x, 0);
  assert.equal(body.vx, 0);
  assert.equal(body.targetLane, 1);

  // Switch from center (1) to left (0). Should settle close to target within ~0.35s (21 frames @ 60fps).
  body.targetLane = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 21; i++) {
    stepLaneBody(body, dt);
  }
  const targetX = laneToX(0);
  assert.ok(
    Math.abs(body.x - targetX) < 0.15,
    `lane not snappy enough: x=${body.x}, target=${targetX}`,
  );

  // Continue stepping to test zero-jitter snapping
  for (let i = 0; i < 30; i++) {
    stepLaneBody(body, dt);
  }
  assert.equal(body.x, targetX, 'lane body must snap exactly to lane center once settled');
  assert.equal(body.vx, 0, 'velocity must reset to 0 after snap');

  // Verify chassis roll opposes lateral motion (lean into turn)
  body.targetLane = 2; // move right (-X)
  stepLaneBody(body, dt);
  assert.ok(body.vx < 0, 'moving right means negative vx');
  assert.ok(laneBodyRoll(body) > 0, 'laneBodyRoll must bank into the steer');
}

// ── 4) Track Curvature & Geometry Math ───────────────────────────────────────
{
  let maxAbsOffset = 0;
  let maxAbsCurv = 0;
  for (let z = 0; z < 400; z += 2) {
    maxAbsOffset = Math.max(maxAbsOffset, Math.abs(trackOffset(z)));
    maxAbsCurv = Math.max(maxAbsCurv, Math.abs(trackCurvature(z)));
    const slope = trackSlope(z);
    const heading = trackHeading(z);
    assert.ok(
      Math.abs(heading - Math.atan(slope)) < 1e-9,
      'trackHeading must equal atan(trackSlope)',
    );
  }
  assert.ok(maxAbsOffset > 5, 'track should weave laterally');
  assert.ok(maxAbsCurv > 0.001, 'track should have measurable curvature for camera sway');
}

// ── 5) Scoring, Combo Scaling & Fever Mode ───────────────────────────────────
{
  assert.equal(comboMultiplier(0), 1, 'combo 0 multiplier should be 1.0');
  assert.ok(comboMultiplier(1) > comboMultiplier(0), 'combo 1 should increase multiplier');
  assert.equal(isFever(4), false, 'combo 4 must not be fever');
  assert.equal(isFever(FEVER_COMBO), true, 'combo 5 must trigger fever');

  // Fever gives an extra +0.5 boost
  const preFever = comboMultiplier(4);
  const feverMult = comboMultiplier(5);
  assert.ok(
    feverMult - preFever > 0.5,
    `fever should grant substantial multiplier bonus: pre=${preFever}, fever=${feverMult}`,
  );

  // Score state lifecycle and combo decay
  const state = createScoreState('normal');
  assert.equal(state.combo, 0);
  assert.equal(state.comboTimer, COMBO_DECAY_SEC);

  // Register near misses up to fever
  for (let i = 0; i < FEVER_COMBO; i++) {
    registerNearMiss(state, false);
  }
  assert.equal(state.combo, FEVER_COMBO);
  assert.equal(state.reachedFever, true);
  assert.equal(state.feverLatched, true);
  assert.equal(state.avoids, FEVER_COMBO);

  // Register perfect near miss
  registerNearMiss(state, true);
  assert.equal(state.perfects, 1);
  assert.equal(state.combo, 6);

  // Decay timer should decrement but hold combo until expiration
  tickScoreTimers(state, 1.0);
  assert.equal(state.combo, 6, 'combo should not drop before timer expires');
  assert.ok(state.comboTimer > 0, 'combo timer should remain positive');

  // Let timer expire to test decay speed
  tickScoreTimers(state, COMBO_DECAY_SEC);
  assert.equal(state.combo, 5, 'combo should decrement by 1 on timer expiration');
  assert.ok(
    state.comboTimer >= COMBO_DECAY_SEC * 0.65,
    `fever decay grace period must sustain fever window, got ${state.comboTimer}`,
  );

  // Test breakCombo resets combo and fever flag
  breakCombo(state);
  assert.equal(state.combo, 0);
  assert.equal(state.feverLatched, false);
}

console.log('check-physics: ok');
