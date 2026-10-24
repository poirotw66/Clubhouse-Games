/**
 * Camera framing invariants (v6 three-quarter FOV 38).
 */
import assert from 'node:assert/strict';
import { CAM_FOV, computeCameraFrame, checkLionFramed, DIST_MIN, DIST_MAX } from './framing.ts';

const desk = computeCameraFrame(16 / 9);
assert.equal(desk.fov, CAM_FOV);
assert.ok(desk.distance >= DIST_MIN - 0.01 && desk.distance <= DIST_MAX + 0.01);
assert.ok(desk.aheadFrac > 0.2, 'three-quarter ahead offset');

const portrait = computeCameraFrame(9 / 16);
assert.equal(portrait.fov, CAM_FOV);
assert.ok(portrait.distance >= desk.distance - 0.5, 'portrait pulls back or equal');

const ok = checkLionFramed({
  minX: 0.2,
  maxX: 0.8,
  minY: 0.25,
  maxY: 0.7,
  heightFrac: 0.45,
  widthFrac: 0.6,
});
assert.ok(ok.ok);

const cropped = checkLionFramed({
  minX: 0.01,
  maxX: 0.5,
  minY: 0.2,
  maxY: 0.5,
  heightFrac: 0.3,
  widthFrac: 0.49,
});
assert.ok(!cropped.ok);

console.log(
  `check-framing: ok (desk d=${desk.distance.toFixed(2)} portrait d=${portrait.distance.toFixed(2)})`,
);
