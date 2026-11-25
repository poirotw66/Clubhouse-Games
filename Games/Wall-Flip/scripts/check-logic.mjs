import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import './flight-coach.test.mjs';
import './stunt-club.test.mjs';
import './vehicle-garage.test.mjs';
import './vehicle-mesh.test.mjs';
import './leaderboard.test.mjs';

function block(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `Game source block missing: ${from}`);
  return source.slice(start, end);
}

// Evaluate the production simulation without copying formulas or booting WebGL.
const three = vm.runInNewContext(
  fs.readFileSync(new URL('../simulation.js', import.meta.url), 'utf8')
  + '\nWallFlipSimulation;',
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

// Bidirectional rolling accumulation preserves rolls and accumulates rotation without subtraction.
{
  const bidi = createSim();
  for (let i = 0; i < 450; i++) bidi.step(BASE.STEP, { drive: true, suck: false, left: false, right: false });
  assert.equal(bidi.state.mode, 'air');
  for (let i = 0; i < 180; i++) bidi.step(BASE.STEP, { drive: false, suck: false, left: false, right: true });
  const rightSpin = bidi.state.spinRight;
  assert.ok(rightSpin > Math.PI, 'Right roll accumulated at least one half-turn');
  for (let i = 0; i < 320; i++) bidi.step(BASE.STEP, { drive: false, suck: false, left: true, right: false });
  assert.ok(bidi.state.spinLeft > Math.PI, 'Left roll accumulated at least one half-turn');
  assert.ok(bidi.state.spinTotal > rightSpin, 'Total spin strictly accumulated across direction changes');
  assert.equal(bidi.state.hasSwitchedDir, true, 'Dual-direction reversal stunt correctly detected');
}

// Landing score boundaries preserve the 50-point roll and bounded quality bonuses.
assert.equal(scoreOf({ rolls: 0, fall: 0, tilt: 0 }).total, 50);
assert.equal(scoreOf({ rolls: 2, fall: 0, tilt: 0 }).total, 150);
assert.equal(scoreOf({ rolls: 2, fall: BASE.LAND_SPEED, tilt: BASE.LAND_TILT }).total, 100);
assert.equal(scoreOf({ rolls: 0, fall: 100, tilt: 100 }).total, 0);

// Aerial stunt flags and comboMult cleanly boost scoreOf total without breaking base scoring.
{
  const plain = scoreOf({ rolls: 1, fall: 0, tilt: 0 });
  assert.equal(plain.stunt, 0);
  assert.equal(plain.total, 100);

  const skimmed = scoreOf({ rolls: 1, fall: 0, tilt: 0, hasSkimmed: true, comboMult: 1.9 });
  assert.equal(skimmed.stunt, Math.round(25 * 1.9));
  assert.equal(skimmed.total, 100 + Math.round(25 * 1.9));

  const allStunts = scoreOf({
    rolls: 1, fall: 0, tilt: 0,
    hasSkimmed: true, hasInverted: true, hasSwitchedDir: true, comboMult: 2.6,
  });
  assert.equal(allStunts.stunt, Math.round((25 + 20 + 20) * 2.6));
  assert.equal(allStunts.total, 100 + allStunts.stunt);
}

// Simulation stepAir detects skim/invert/switch stunts, updates comboMult, and carries them to state.land.
{
  const sim = createSim();
  Object.assign(sim.state, {
    mode: 'air', x: -50, y: 12, z: 0,
    vx: -20, vy: 0, vz: 0,
    roll: Math.PI, roll0: 0, pitch: 0, yaw: 0, rw: 0,
    air: 80, clear: true,
  });
  for (let i = 0; i < Math.ceil(0.4 / BASE.STEP); i++) sim.step(BASE.STEP, idle);
  assert.equal(sim.state.hasInverted, true, '3D sim stepAir detects sustained inverted flight');

  Object.assign(sim.state, { y: 1.8, vx: -20, vy: 0, roll: 0, rw: 0, spinRight: Math.PI, spinLeft: Math.PI });
  for (let i = 0; i < Math.ceil(0.15 / BASE.STEP); i++) sim.step(BASE.STEP, idle);
  assert.equal(sim.state.hasSkimmed, true, '3D sim stepAir detects low-altitude deck skim');
  assert.equal(sim.state.hasSwitchedDir, true, '3D sim stepAir detects dual-direction switch');
  assert.ok(sim.state.comboMult >= 2.2, `Expected comboMult >= 2.2, got ${sim.state.comboMult}`);

  Object.assign(sim.state, { x: -80, y: 0.65, vx: -10, vy: -1.0, roll: 0, pitch: 0, rw: 0 });
  sim.step(BASE.STEP, idle);
  assert.equal(sim.state.mode, 'landed');
  const scored = scoreOf(sim.state.land);
  assert.ok(scored.stunt > 0, 'Aerial stunts yield non-zero stunt bonus in scoreOf');
  assert.equal(scored.total, Math.round(scored.roll + scored.soft + scored.level + scored.stunt));
}

// Landing fall decoupling: gentle vertical descent with residual spin preserves soft landing score.
{
  const sim = createSim();
  Object.assign(sim.state, {
    mode: 'air',
    x: 10, y: 0.65, z: 0,
    vx: 0, vy: -1.5, vz: 0,
    roll: 0, pitch: 0, yaw: 0, rw: 1.8,
    air: 80, clear: true,
  });
  sim.step(BASE.STEP, idle);
  assert.equal(sim.state.mode, 'landed');
  assert.ok(sim.state.land.fall < 2.5, `Fall velocity was ${sim.state.land.fall}, expected < 2.5`);
  const score = scoreOf(sim.state.land);
  assert.ok(score.soft >= 17, `Soft score was ${score.soft}, expected >= 17`);
}
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

// 2D index.html stepAir wires hasSkimmed, hasInverted, hasSwitchedDir, and comboMult into stats.total identically to simulation.js.
{
  const garageSrc = fs.readFileSync(new URL('../vehicle-garage.js', import.meta.url), 'utf8');
  const garageCtx = {};
  vm.runInNewContext(garageSrc, garageCtx);
  const code = block(twoSource, '// ---------- utils ----------', '// ---------- bilingual strings')
    + block(twoSource, '// ---------- tuning:', '// ---------- state ----------')
    + block(twoSource, '// ---------- state ----------', 'let best = 0, rankOn')
    + block(twoSource, 'function toAir(kind)', '// ---------- achievements / share')
    + block(twoSource, 'const RANKS =', 'const launchHost =')
    + block(twoSource, '// ---------- physics: attached', '// ---------- physics: landed rollout');
  const noop = () => {};
  const ctx2d = {
    localStorage: { getItem: () => null },
    window: { WallFlipGarage: garageCtx.WallFlipGarage },
    botOn: true, skids: [], shakeT: 0, shakeA: 0,
    t: () => '', say: noop, sayOnce: noop, pop: noop, tireSmoke: noop, dust: noop, smoke: noop, fire: noop,
    confetti: noop, vib: noop, sfx: { land: noop, crash: noop, peel: noop, stuntWhoosh: noop },
  };
  const api2d = vm.runInNewContext(
    code + '\n({ buildCourse, car, stats, stepAir, STEP });',
    ctx2d,
    { timeout: 1000 },
  );
  api2d.buildCourse(0);
  Object.assign(api2d.car, {
    mode: 'air', x: -50, y: 12, vx: -20, vy: 0,
    phi: Math.PI, phiL: 0, rw: 0, air: 80, clear: true,
    spinTotal: Math.PI * 2, spinRight: Math.PI, spinLeft: Math.PI,
    rollsAccum: 1, stuntRolls: 1,
  });
  for (let i = 0; i < Math.ceil(0.4 / api2d.STEP); i++) api2d.stepAir(api2d.STEP);
  assert.equal(api2d.car.hasInverted, true, '2D stepAir detects inverted flight');
  assert.equal(api2d.car.hasSwitchedDir, true, '2D stepAir detects direction switch');

  Object.assign(api2d.car, { y: 1.8, vx: -20, vy: 0, phi: 0, rw: 0 });
  for (let i = 0; i < Math.ceil(0.15 / api2d.STEP); i++) api2d.stepAir(api2d.STEP);
  assert.equal(api2d.car.hasSkimmed, true, '2D stepAir detects deck skim');

  Object.assign(api2d.car, { x: -80, y: 0.65, vx: -10, vy: -1.0, phi: 0, rw: 0 });
  api2d.stepAir(api2d.STEP);
  assert.equal(api2d.car.mode, 'landed');
  assert.equal(api2d.stats.win, true);
  assert.equal(api2d.stats.hasSkimmed, true);
  assert.equal(api2d.stats.hasInverted, true);
  assert.equal(api2d.stats.hasSwitchedDir, true);
  assert.equal(api2d.stats.comboMult, api2d.car.comboMult);
  const expected = scoreOf({
    rolls: api2d.stats.rolls,
    fall: api2d.stats.fall / 3.6,
    tilt: api2d.stats.tilt * Math.PI / 180,
    hasSkimmed: true,
    hasInverted: true,
    hasSwitchedDir: true,
    comboMult: api2d.car.comboMult,
  });
  assert.equal(api2d.stats.stuntPts, expected.stunt);
  assert.equal(api2d.stats.total, expected.total);
}

console.log('check-logic: ok (2D courses, 3D simulation, resources and landing scores)');

// Escape must close the display-switch dialog even when its button has focus.
for (const name of ['index.html', 'index-3d.html']) {
  const source = fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
  let listener;
  let closed = false;
  let prevented = false;
  vm.runInNewContext(block(source, "\naddEventListener('keydown', e => {", "\naddEventListener('keyup'"), {
    addEventListener: (_type, callback) => { listener = callback; },
    domTyping: () => true,
    viewConfirmEl: { classList: { contains: () => true } },
    closeViewConfirm: () => { closed = true; },
  });
  listener({ code: 'Escape', preventDefault: () => { prevented = true; } });
  assert.ok(closed && prevented, `${name}: focused dialog closes with Escape`);
}
