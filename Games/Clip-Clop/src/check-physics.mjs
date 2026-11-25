import assert from 'node:assert/strict';
import { CFG, MOD, dailyInfo, makeHorseState, makeLegStates, simHorse, PHYSICS_TIERS, setPhysicsTier } from './physics.js';

const idle = [false, false, false, false, false];
const step = (state, legs, input = idle) => simHorse(state, legs, input, CFG.STEP);

// Four resting hooves support the body without movement or a spontaneous fall.
{
  const state = makeHorseState(), legs = makeLegStates();
  for (let i = 0; i < 1200; i++) assert.equal(step(state, legs).length, 0);
  assert.equal(state.x, 0);
  assert.equal(state.fallPose, null);
  assert.ok(Math.abs(state.y - CFG.bodyY) < 0.01);
}

// Alternating diagonal inputs create forward travel and real footfall events.
function runGait() {
  const state = makeHorseState(), legs = makeLegStates();
  let steps = 0;
  for (let i = 0; i < 1200; i++) {
    const input = Math.floor(i / 70) % 2 ? [true, false, false, true] : [false, true, true, false];
    steps += step(state, legs, input).filter(event => event.type === 'step').length;
  }
  assert.ok(state.x > 2, `Expected forward travel, got ${state.x}`);
  assert.ok(state.topSpeed > 0);
  assert.equal(state.steps, steps);
  assert.equal(state.fallPose, null);
  return state;
}
assert.deepEqual(runGait(), runGait(), 'Fixed inputs must produce deterministic physics');

// An overbalanced horse falls once; recovery waits for landing and resets pose.
{
  const state = makeHorseState(), legs = makeLegStates();
  state.roll = CFG.FALL_ROLL + 0.05;
  assert.ok(step(state, legs).some(event => event.type === 'fall'));
  assert.ok(state.fallPose);
  assert.ok(!step(state, legs, [false, false, false, false, true]).some(event => event.type === 'getup'));
  for (let i = 0; i < 1000 && !state.fallPose.landed; i++) step(state, legs);
  assert.ok(state.fallPose.landed);
  assert.ok(step(state, legs, [false, false, false, false, true]).some(event => event.type === 'getup'));
  const events = [];
  for (let i = 0; i < 100; i++) events.push(...step(state, legs));
  assert.equal(events.filter(event => event.type === 'up').length, 1);
  assert.equal(state.fallPose, null);
  assert.equal(state.roll, 0);
  assert.ok(Math.abs(state.y - CFG.bodyY) < 0.01);
  assert.ok(legs.every(leg => leg.lift === 0 && leg.th === 0));
}

// Daily modifiers remain reproducible and bounded across a full month.
assert.deepEqual(dailyInfo('2026-10-30'), dailyInfo('2026-10-30'));
assert.notDeepEqual(dailyInfo('2026-10-30'), dailyInfo('2026-10-29'));
for (let day = 1; day <= 31; day++) {
  const info = dailyInfo(`2026-10-${String(day).padStart(2, '0')}`);
  assert.ok(info.drag >= 0.7 && info.drag < 1.2);
  assert.ok(info.fric >= 0.85 && info.fric < 1.15);
  assert.ok(Math.abs(info.slope) <= 0.28);
  assert.ok(['day', 'dusk', 'rain'].includes(info.weather));
}
assert.deepEqual(MOD, { drag: 1, fric: 1, slope: 0, aeroActive: false });

// Physics tiers & diagonal trot balance test (BAL2 = 30 vs BAL2 = 6)
{
  assert.equal(PHYSICS_TIERS.arcade.bal2, 30);
  assert.equal(PHYSICS_TIERS.classic.bal2, 6);

  setPhysicsTier('classic');
  assert.equal(CFG.BAL2, 6);
  assert.equal(CFG.tier, 'classic');

  // Measure two-hoof diagonal trot stability under BAL2 = 6 (Classic)
  const stateClassic = makeHorseState(), legsClassic = makeLegStates();
  for (let i = 0; i < 140; i++) {
    simHorse(stateClassic, legsClassic, [true, false, false, true, false], CFG.STEP);
  }
  const rollClassic = Math.abs(stateClassic.roll);

  setPhysicsTier('arcade');
  assert.equal(CFG.BAL2, 30);
  assert.equal(CFG.tier, 'arcade');

  // Measure two-hoof diagonal trot stability under BAL2 = 30 (Arcade)
  const stateArcade = makeHorseState(), legsArcade = makeLegStates();
  for (let i = 0; i < 140; i++) {
    simHorse(stateArcade, legsArcade, [true, false, false, true, false], CFG.STEP);
  }
  const rollArcade = Math.abs(stateArcade.roll);

  // Arcade BAL2=30 restores balance tightly, whereas Classic BAL2=6 allows large roll tilt
  assert.ok(rollArcade < rollClassic * 0.45, `Expected rollArcade (${rollArcade}) < 0.45 * rollClassic (${rollClassic})`);
  assert.ok(rollArcade < 0.2, `Arcade roll should stay well bounded, got ${rollArcade}`);
}

// Aerodynamic drag reduction with MOD.aeroActive
{
  const stateA = makeHorseState(), legsA = makeLegStates();
  stateA.vx = 8.0;
  MOD.aeroActive = false;
  simHorse(stateA, legsA, idle, CFG.STEP);

  const stateB = makeHorseState(), legsB = makeLegStates();
  stateB.vx = 8.0;
  MOD.aeroActive = true;
  simHorse(stateB, legsB, idle, CFG.STEP);

  assert.ok(stateB.vx > stateA.vx, `Aero active should experience less drag: ${stateB.vx} vs ${stateA.vx}`);
  MOD.aeroActive = false;
}

console.log('check-physics: ok (rest, gait, falls, recovery, daily modifiers, tiers BAL2 30 vs 6, aero drag)');
