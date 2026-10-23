/**
 * Camera framing invariants (v4).
 * Desktop: lion height ≈ 35–40% of viewport.
 * Portrait: fully visible; height fill may be lower (side-on length).
 */
import assert from 'node:assert/strict';

const LION_WORLD_HEIGHT = 3.35;
const LION_WORLD_LENGTH = 4.5;
const LION_FILL = 0.37;
const FRAME_MARGIN_NDC = 0.04;

function computeCameraFrame(aspect) {
  let fov = 28;
  if (aspect < 0.7) fov = 48;
  else if (aspect < 0.9) fov = 42;
  else if (aspect < 1.15) fov = 34;
  else if (aspect < 1.45) fov = 30;
  const vFov = (fov * Math.PI) / 180;
  const halfV = Math.tan(vFov / 2);
  const distH = LION_WORLD_HEIGHT / LION_FILL / (2 * halfV);
  const halfH = halfV * Math.max(0.35, aspect);
  const widthFill = aspect < 0.7 ? 0.68 : aspect < 1 ? 0.62 : 0.52;
  const distW = LION_WORLD_LENGTH / widthFill / (2 * halfH);
  const distance = Math.max(distH, distW) * (aspect < 0.7 ? 1.12 : aspect < 1 ? 1.08 : 1.02);
  return { fov, distance };
}

function checkLionFramed(bounds, margin = FRAME_MARGIN_NDC) {
  const reasons = [];
  if (bounds.minX < margin) reasons.push('left');
  if (bounds.maxX > 1 - margin) reasons.push('right');
  if (bounds.minY < margin) reasons.push('top');
  if (bounds.maxY > 1 - margin) reasons.push('bottom');
  if (bounds.heightFrac > 0.62) reasons.push('too tall');
  return { ok: reasons.length === 0, reasons };
}

const desk = computeCameraFrame(16 / 9);
assert.ok(desk.fov <= 32, `desktop FOV too wide ${desk.fov}`);
assert.ok(desk.distance > 12, `desktop camera too close ${desk.distance}`);

const mobile = computeCameraFrame(390 / 844);
assert.ok(mobile.fov >= 40, `portrait FOV too narrow ${mobile.fov}`);

function fillAt(frame) {
  const v = (frame.fov * Math.PI) / 180;
  const visibleH = 2 * frame.distance * Math.tan(v / 2);
  return LION_WORLD_HEIGHT / visibleH;
}

const fill = fillAt(desk);
const fillM = fillAt(mobile);
assert.ok(fill > 0.3 && fill < 0.45, `desktop fill band failed ${fill.toFixed(3)}`);
// Portrait is width-limited for a side-on lion; height fill sits lower by design.
assert.ok(fillM > 0.18 && fillM < 0.4, `mobile fill band failed ${fillM.toFixed(3)}`);

assert.ok(
  checkLionFramed({ minX: 0.1, maxX: 0.7, minY: 0.2, maxY: 0.55, heightFrac: 0.35 }).ok,
);
assert.ok(
  !checkLionFramed({ minX: 0.01, maxX: 0.7, minY: 0.2, maxY: 0.55, heightFrac: 0.35 }).ok,
  'inward margin must reject near-edge AABB',
);
assert.ok(
  !checkLionFramed({ minX: -0.1, maxX: 0.7, minY: 0.2, maxY: 0.55, heightFrac: 0.35 }).ok,
);

console.log(
  `check-framing: ok (desk fov=${desk.fov} d=${desk.distance.toFixed(1)} fill≈${fill.toFixed(2)}, mobile fov=${mobile.fov} d=${mobile.distance.toFixed(1)} fill≈${fillM.toFixed(2)})`,
);
