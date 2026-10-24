/**
 * Camera framing invariants (v6.2 — mid-band lion, side margins).
 */
import assert from 'node:assert/strict';
import {
  CAM_FOV,
  computeCameraFrame,
  checkLionFramed,
  DIST_MIN,
  DIST_MAX,
  TOP_SAFE_UV,
  CENTER_Y_MIN,
  CENTER_Y_MAX,
} from './framing.ts';

const desk = computeCameraFrame(16 / 9);
assert.equal(desk.fov, CAM_FOV);
assert.ok(desk.distance >= DIST_MIN - 0.01 && desk.distance <= DIST_MAX + 0.01);
assert.ok(desk.aheadFrac > 0.15, 'three-quarter ahead offset');
assert.ok(desk.padFrac <= 0.22, 'desk padFrac must not shove lion into top crop');

const portrait = computeCameraFrame(9 / 16);
assert.equal(portrait.fov, CAM_FOV);
assert.ok(portrait.aheadFrac > desk.aheadFrac, 'portrait more frontal to fit length');
assert.ok(portrait.padFrac <= 0.28, 'portrait padFrac capped');
assert.ok(portrait.distance <= 16.1, 'portrait distance capped');

const ok = checkLionFramed({
  minX: 0.22,
  maxX: 0.78,
  minY: 0.22,
  maxY: 0.68,
  heightFrac: 0.46,
  widthFrac: 0.5,
});
assert.ok(ok.ok, `expected ok, got ${ok.reasons}`);

const croppedTop = checkLionFramed({
  minX: 0.25,
  maxX: 0.75,
  minY: 0.02,
  maxY: 0.45,
  heightFrac: 0.43,
  widthFrac: 0.5,
});
assert.ok(!croppedTop.ok, 'should fail when top < 8%');
assert.ok(croppedTop.reasons.some((r) => r.startsWith('top')));

const highCenter = checkLionFramed({
  minX: 0.25,
  maxX: 0.75,
  minY: 0.1,
  maxY: 0.32,
  heightFrac: 0.22,
  widthFrac: 0.5,
});
assert.ok(!highCenter.ok, 'should fail when centerY above band');

const cropped = checkLionFramed({
  minX: -0.12,
  maxX: 0.5,
  minY: 0.2,
  maxY: 0.5,
  heightFrac: 0.3,
  widthFrac: 0.62,
});
assert.ok(!cropped.ok, 'should fail when AABB spills past side slop');

assert.ok(TOP_SAFE_UV === 0.08);
assert.ok(CENTER_Y_MIN === 0.35 && CENTER_Y_MAX === 0.6);

console.log(
  `check-framing: ok (desk d=${desk.distance.toFixed(2)} pad=${desk.padFrac} portrait d=${portrait.distance.toFixed(2)} pad=${portrait.padFrac})`,
);
