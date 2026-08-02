/**
 * Runnable check for lane spring + track curvature helpers.
 * Fails loudly if the snappy lane response or track math regresses.
 */
import assert from 'node:assert/strict';

const LANE_WIDTH = 2.4;
const LANE_SPRING = 140;
const LANE_DAMPING = 18;

function laneToX(lane) {
  return (lane - 1) * LANE_WIDTH;
}

function stepLaneBody(body, dt) {
  const targetX = laneToX(body.targetLane);
  const ax = (targetX - body.x) * LANE_SPRING - body.vx * LANE_DAMPING;
  body.vx += ax * dt;
  body.x += body.vx * dt;
}

function trackOffset(z) {
  return (
    Math.sin(z * 0.028) * 7.5 +
    Math.sin(z * 0.067 + 1.7) * 3.2 +
    Math.sin(z * 0.013 + 0.4) * 4.0
  );
}

function trackCurvature(z) {
  return (
    -Math.sin(z * 0.028) * 7.5 * 0.028 * 0.028 +
    -Math.sin(z * 0.067 + 1.7) * 3.2 * 0.067 * 0.067 +
    -Math.sin(z * 0.013 + 0.4) * 4.0 * 0.013 * 0.013
  );
}

// Lane switch from center → left should settle within ~0.35s and overshoot little.
const body = { x: laneToX(1), vx: 0, targetLane: 0 };
const dt = 1 / 60;
for (let i = 0; i < 21; i++) stepLaneBody(body, dt);
assert.ok(Math.abs(body.x - laneToX(0)) < 0.15, `lane not snappy enough: x=${body.x}`);

// Track must bend (non-zero offset / curvature somewhere ahead).
let maxAbsOffset = 0;
let maxAbsCurv = 0;
for (let z = 0; z < 400; z += 2) {
  maxAbsOffset = Math.max(maxAbsOffset, Math.abs(trackOffset(z)));
  maxAbsCurv = Math.max(maxAbsCurv, Math.abs(trackCurvature(z)));
}
assert.ok(maxAbsOffset > 5, 'track should weave laterally');
assert.ok(maxAbsCurv > 0.001, 'track should have measurable curvature for camera sway');

console.log('check-physics: ok');
