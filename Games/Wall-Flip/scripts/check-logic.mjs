import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function block(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `Game source block missing: ${from}`);
  return source.slice(start, end);
}

// Evaluate the actual inline pure simulation, without copying its formulas or booting WebGL.
const threeSource = fs.readFileSync(new URL('../index-3d.html', import.meta.url), 'utf8');
const three = vm.runInNewContext(
  block(threeSource, '// ---------- utils ----------', '// ============================================================\n// 3D night scene')
  + '\n({ BASE, createSim, trackAt, scoreOf, rollsCount, tsin, tcos, atan2p });',
  {}, { timeout: 1000 },
);
const { BASE, createSim, trackAt, scoreOf, rollsCount, tsin, tcos, atan2p } = three;
const idle = { drive: false, suck: false, left: false, right: false };

// The untouched approach stays parked; accelerating on the flat increases speed.
{
  const parked = createSim();
  for (let i = 0; i < 240; i++) parked.step(BASE.STEP, idle);
  assert.equal(parked.state.u, -BASE.RUNUP);
  assert.equal(parked.state.mode, 'road');
  const driven = createSim();
  for (let i = 0; i < 120; i++) driven.step(BASE.STEP, { ...idle, drive: true });
  assert.ok(driven.state.v > 0);
  assert.ok(driven.state.u > -BASE.RUNUP && driven.state.u < 0);
  assert.equal(driven.state.mode, 'road');
}

// Holding suction/jets cannot spend below zero; fixed substeps stay deterministic.
function simulate() {
  const sim = createSim();
  for (let i = 0; i < 5000; i++) {
    sim.step(BASE.STEP, { drive: true, suck: true, left: false, right: true });
    assert.ok(sim.state.air >= 0 && sim.state.air <= 100);
    for (const key of ['x', 'y', 'v', 'vx', 'vy', 'roll', 'pitch']) assert.ok(Number.isFinite(sim.state[key]), key);
  }
  return JSON.stringify(sim.state);
}
assert.equal(simulate(), simulate());

// Landing score boundaries preserve the 50-point roll and bounded quality bonuses.
assert.equal(scoreOf({ rolls: 0, fall: 0, tilt: 0 }).total, 50);
assert.equal(scoreOf({ rolls: 2, fall: 0, tilt: 0 }).total, 150);
assert.equal(scoreOf({ rolls: 2, fall: BASE.LAND_SPEED, tilt: BASE.LAND_TILT }).total, 100);
assert.equal(scoreOf({ rolls: 0, fall: 100, tilt: 100 }).total, 0);
assert.equal(rollsCount(Math.PI, Math.PI), 0);
assert.equal(rollsCount(Math.PI * 3, Math.PI), 1);
for (const angle of [-Math.PI, -1, 0, 1, Math.PI]) {
  assert.ok(Math.abs(tsin(angle) - Math.sin(angle)) < 1e-10);
  assert.ok(Math.abs(tcos(angle) - Math.cos(angle)) < 1e-10);
}
assert.ok(Math.abs(atan2p(1, -1) - Math.atan2(1, -1)) < 1e-10);
assert.equal(trackAt(-10).y, 0);

// Both 2D courses must remain continuous and longer than their arc alone.
const twoSource = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const two = vm.runInNewContext(
  block(twoSource, '// ---------- utils ----------', '// ---------- bilingual strings')
  + block(twoSource, '// ---------- tuning:', '// ---------- state ----------')
  + '\n({ buildCourse, trackAt, rollsCount, COURSES, length: () => T_LEN });',
  { localStorage: { getItem: () => null } }, { timeout: 1000 },
);
for (let i = 0; i < two.COURSES.length; i++) {
  two.buildCourse(i);
  assert.equal(two.trackAt(-5).x, -5);
  assert.equal(two.trackAt(0).y, 0);
  const end = two.trackAt(two.length());
  const before = two.trackAt(two.length() - 0.001);
  assert.ok(Math.hypot(end.x - before.x, end.y - before.y) < 0.002);
  assert.ok(two.length() > two.COURSES[i].arcDeg * Math.PI / 180 * two.COURSES[i].arcR);
}
assert.equal(two.rollsCount(0, 0), 0);
assert.equal(two.rollsCount(Math.PI * 2, 0), 1);
console.log('check-logic: ok (2D courses, 3D simulation, resources and landing scores)');
