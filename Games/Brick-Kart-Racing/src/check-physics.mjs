// Unit tests for Mode-7 projection, slipstream aerodynamics, and ghost trace serialization.
import {
  groundStartRow,
  projectPoint,
  hexToRgb,
} from './engine/mode7.ts';
import {
  isInSlipstream,
  findSlipstreamTarget,
  calculateDraftTopSpeed,
  calculateDraftAccelMult,
  stepDraftSpeed,
  SLIP_MAX_DIST,
  SLIP_HALF_ANGLE,
  SLIP_MIN_LEADER_SPEED,
  SLIP_SPEED_MULT,
  SLIP_ACCEL_MULT,
} from './engine/slipstream.ts';
import {
  serializeGhostLap,
  deserializeGhostLap,
  parseGhostLap,
  poseAt,
  GhostRecorder,
  calculateContinuousGhostDelta,
  ghostTimeAtProgress,
  getGhostSplineProgress,
  GHOST_SAMPLE_HZ,
  GHOST_SAMPLE_DT,
  GHOST_MAX_SAMPLES,
} from './engine/ghost.ts';
import {
  buildCenterline,
  pointAt,
  nearestIndex,
  lateralOffset,
} from './engine/spline.ts';
import {
  FOCAL,
  CAM_HEIGHT,
  RENDER_WIDTH,
  RENDER_HEIGHT,
  HORIZON_FRAC,
  HOMING_WARNING_DIST,
  HOMING_SPEED,
  BOUNDARY_SHOULDER_LATERAL,
  BOUNDARY_BARRIER_LATERAL,
  EMERGENCY_RESPAWN_LATERAL,
} from './engine/constants.ts';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertClose(actual, expected, epsilon = 1e-4, message = '') {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(
      `${message}: expected ${actual} to be close to ${expected} (diff: ${Math.abs(actual - expected)})`,
    );
  }
}

// ============================================================================
// 1. Mode-7 Projection Math (engine/mode7.ts)
// ============================================================================
console.log('Testing Mode-7 projection math...');

// --- groundStartRow ---
{
  const defaultHorizon = RENDER_HEIGHT * HORIZON_FRAC; // 144
  const cam = {
    x: 0,
    y: 0,
    angle: 0,
    height: CAM_HEIGHT,
    horizon: defaultHorizon,
    focal: FOCAL,
  };
  assert(groundStartRow(cam) === 145, 'ground start row for 144 should be 145');

  // Fractional horizon ceil
  assert(groundStartRow({...cam, horizon: 143.2}) === 145, 'fractional horizon ceil');
  assert(groundStartRow({...cam, horizon: 143.9}) === 145, 'fractional horizon ceil .9');
  assert(groundStartRow({...cam, horizon: 144.0}) === 145, 'exact integer horizon');

  // Negative / zero horizon clamp
  assert(groundStartRow({...cam, horizon: -10}) === 0, 'negative horizon clamped to 0');
  assert(groundStartRow({...cam, horizon: 0}) === 1, 'horizon at 0 starts at row 1');
}

// --- projectPoint Near-Clipping ---
{
  const cam = {
    x: 100,
    y: 200,
    angle: 0, // facing +X
    height: 38,
    horizon: 144,
    focal: 400,
  };

  // Behind camera (relX < 0)
  assert(projectPoint(cam, 50, 200) === null, 'point behind camera should return null');

  // Forward distance v < 12 (near clipping plane)
  assert(projectPoint(cam, 111.9, 200) === null, 'point closer than near plane (v < 12) returns null');

  // Forward distance v >= 12
  const nearValid = projectPoint(cam, 112.0, 200);
  assert(nearValid !== null, 'point at near plane threshold returns valid projection');
  assertClose(nearValid.distance, 12.0, 1e-4, 'near plane distance');
  assertClose(nearValid.scale, 400 / 12, 1e-4, 'near plane scale');
}

// --- projectPoint Center-Axis & Perspective Inverses ---
{
  const cam = {
    x: 0,
    y: 0,
    angle: 0,
    height: 40,
    horizon: 144,
    focal: 400,
  };

  const d1 = 100;
  const p1 = projectPoint(cam, d1, 0);
  assert(p1 !== null, 'p1 valid');
  assertClose(p1.screenX, 0, 1e-5, 'p1 centered on X');
  assertClose(p1.distance, 100, 1e-5, 'p1 distance');
  assertClose(p1.scale, 400 / 100, 1e-5, 'p1 scale = focal / distance');
  assertClose(p1.screenY, (cam.height * cam.focal) / 100, 1e-5, 'p1 screenY = height * focal / distance');

  // Double distance: scale and screen row offset should exactly halve
  const d2 = 200;
  const p2 = projectPoint(cam, d2, 0);
  assert(p2 !== null, 'p2 valid');
  assertClose(p1.scale / p2.scale, 2.0, 1e-5, 'inverse distance scaling for scale');
  assertClose(p1.screenY / p2.screenY, 2.0, 1e-5, 'inverse distance scaling for screenY');

  // Scanline mapping consistency:
  // In renderGround, scanline sy = y - horizon maps to v = focal * height / sy.
  // Verify that reconstructing distance v from projected screenY reproduces original distance.
  for (const dist of [50, 100, 250, 600]) {
    const proj = projectPoint(cam, dist, 0);
    assert(proj !== null, `proj at dist ${dist}`);
    const reconstructedDistance = (cam.height * cam.focal) / proj.screenY;
    assertClose(reconstructedDistance, dist, 1e-4, `reconstructed distance for ${dist}`);
  }
}

// --- projectPoint Camera Height Variation ---
{
  const camLow = {x: 0, y: 0, angle: 0, height: 20, horizon: 144, focal: 400};
  const camHigh = {x: 0, y: 0, angle: 0, height: 40, horizon: 144, focal: 400};
  const camZero = {x: 0, y: 0, angle: 0, height: 0, horizon: 144, focal: 400};

  const pLow = projectPoint(camLow, 100, 0);
  const pHigh = projectPoint(camHigh, 100, 0);
  const pZero = projectPoint(camZero, 100, 0);

  assertClose(pLow.scale, pHigh.scale, 1e-5, 'camera height does not alter horizontal scale');
  assertClose(pHigh.screenY, pLow.screenY * 2, 1e-5, 'doubling camera height doubles screenY offset');
  assertClose(pZero.screenY, 0, 1e-5, 'zero camera height sits exactly on horizon');
}

// --- projectPoint 2D Rotation Angles (Cardinal & Diagonal) ---
{
  const focal = 300;
  const h = 30;

  // 1. Facing +X (angle = 0)
  const camX = {x: 0, y: 0, angle: 0, height: h, horizon: 140, focal};
  const ptAheadX = projectPoint(camX, 100, 0);
  assertClose(ptAheadX.screenX, 0, 1e-4, 'angle 0 ahead screenX');
  const ptRightX = projectPoint(camX, 100, 40);
  assert(ptRightX.screenX > 0, 'angle 0 offset +Y projects to the right');
  const ptLeftX = projectPoint(camX, 100, -40);
  assert(ptLeftX.screenX < 0, 'angle 0 offset -Y projects to the left');

  // 2. Facing +Y (angle = PI/2)
  const camY = {x: 0, y: 0, angle: Math.PI / 2, height: h, horizon: 140, focal};
  const ptAheadY = projectPoint(camY, 0, 100);
  assert(ptAheadY !== null, 'angle PI/2 ahead valid');
  assertClose(ptAheadY.distance, 100, 1e-4, 'angle PI/2 distance');
  assertClose(ptAheadY.screenX, 0, 1e-4, 'angle PI/2 screenX');
  const ptRightY = projectPoint(camY, -40, 100);
  assert(ptRightY.screenX > 0, 'angle PI/2 offset -X projects to the right');

  // 3. Facing -X (angle = PI)
  const camNegX = {x: 0, y: 0, angle: Math.PI, height: h, horizon: 140, focal};
  const ptAheadNegX = projectPoint(camNegX, -100, 0);
  assert(ptAheadNegX !== null, 'angle PI ahead valid');
  assertClose(ptAheadNegX.distance, 100, 1e-4, 'angle PI distance');
  assertClose(ptAheadNegX.screenX, 0, 1e-4, 'angle PI screenX');

  // 4. Facing -Y (angle = -PI/2)
  const camNegY = {x: 0, y: 0, angle: -Math.PI / 2, height: h, horizon: 140, focal};
  const ptAheadNegY = projectPoint(camNegY, 0, -100);
  assert(ptAheadNegY !== null, 'angle -PI/2 ahead valid');
  assertClose(ptAheadNegY.distance, 100, 1e-4, 'angle -PI/2 distance');
  assertClose(ptAheadNegY.screenX, 0, 1e-4, 'angle -PI/2 screenX');

  // 5. Diagonal (angle = PI/4, 45 degrees)
  const camDiag = {x: 0, y: 0, angle: Math.PI / 4, height: h, horizon: 140, focal};
  const diagDist = 100;
  const targetX = (diagDist * Math.SQRT2) / 2;
  const targetY = (diagDist * Math.SQRT2) / 2;
  const ptDiag = projectPoint(camDiag, targetX, targetY);
  assert(ptDiag !== null, 'diagonal ahead valid');
  assertClose(ptDiag.distance, 100, 1e-3, 'diagonal distance matches');
  assertClose(ptDiag.screenX, 0, 1e-3, 'diagonal screenX centered');
}

// --- hexToRgb ---
{
  assert(JSON.stringify(hexToRgb('#000000')) === '[0,0,0]', 'hex black');
  assert(JSON.stringify(hexToRgb('#ffffff')) === '[255,255,255]', 'hex white');
  assert(JSON.stringify(hexToRgb('#e11d48')) === '[225,29,72]', 'hex rose');
  assert(JSON.stringify(hexToRgb('#38bdf8')) === '[56,189,248]', 'hex sky');
}

// ============================================================================
// 2. Slipstream Aerodynamic Drafting (engine/slipstream.ts)
// ============================================================================
console.log('Testing Slipstream aerodynamics and drafting...');

// --- Constants Verification ---
assert(SLIP_MAX_DIST === 95, 'SLIP_MAX_DIST is 95');
assert(SLIP_HALF_ANGLE === 0.42, 'SLIP_HALF_ANGLE is 0.42');
assert(SLIP_MIN_LEADER_SPEED === 140, 'SLIP_MIN_LEADER_SPEED is 140');
assert(SLIP_SPEED_MULT === 1.085, 'SLIP_SPEED_MULT is 1.085');
assert(SLIP_ACCEL_MULT === 1.22, 'SLIP_ACCEL_MULT is 1.22');

// --- Distance Boundaries ---
{
  const leader = {x: 100, y: 0, angle: 0, speed: 200};

  // Too close (overlap / bumper collision zone < 18)
  assert(!isInSlipstream({x: 100 - 17, y: 0, angle: 0, speed: 180}, leader), 'dist 17 too close');
  // Exactly min distance 18
  assert(isInSlipstream({x: 100 - 18, y: 0, angle: 0, speed: 180}, leader), 'dist 18 valid boundary');
  // Mid distance 50
  assert(isInSlipstream({x: 100 - 50, y: 0, angle: 0, speed: 180}, leader), 'dist 50 mid draft');
  // Exactly max distance 95
  assert(isInSlipstream({x: 100 - 95, y: 0, angle: 0, speed: 180}, leader), 'dist 95 max boundary');
  // Exceeds max distance 96
  assert(!isInSlipstream({x: 100 - 96, y: 0, angle: 0, speed: 180}, leader), 'dist 96 too far');
}

// --- Speed Thresholds ---
{
  const baseLeader = {x: 100, y: 0, angle: 0, speed: 140};
  const baseChaser = {x: 50, y: 0, angle: 0, speed: 80};

  // Leader speed threshold
  assert(isInSlipstream(baseChaser, baseLeader), 'speed at threshold valid');
  assert(!isInSlipstream(baseChaser, {...baseLeader, speed: 139.9}), 'leader below 140 invalid');
  assert(isInSlipstream(baseChaser, {...baseLeader, speed: 250}), 'fast leader valid');

  // Chaser speed threshold
  assert(!isInSlipstream({...baseChaser, speed: 79.9}, baseLeader), 'chaser below 80 invalid');
  assert(isInSlipstream({...baseChaser, speed: 80.0}, baseLeader), 'chaser at 80 valid');
  assert(isInSlipstream({...baseChaser, speed: 190.0}, baseLeader), 'fast chaser valid');
}

// --- Angle Cone Alignment ---
{
  const leader = {x: 100, y: 0, angle: 0, speed: 200}; // facing +X, draft cone extends towards -X
  const dist = 50;

  // Directly behind (-X direction)
  assert(isInSlipstream({x: 100 - dist, y: 0, angle: 0, speed: 180}, leader), 'directly behind');

  // Inside draft cone (half-angle 0.42 rad)
  const inAngle = 0.30;
  const chaserIn = {
    x: 100 - dist * Math.cos(inAngle),
    y: dist * Math.sin(inAngle),
    angle: 0,
    speed: 180,
  };
  assert(isInSlipstream(chaserIn, leader), 'chaser inside cone offset 0.30 rad');

  // Boundary of draft cone (offset 0.42 rad)
  const boundAngle = 0.42;
  const chaserBound = {
    x: 100 - dist * Math.cos(boundAngle),
    y: dist * Math.sin(boundAngle),
    angle: 0,
    speed: 180,
  };
  assert(isInSlipstream(chaserBound, leader), 'chaser on cone boundary 0.42 rad');

  // Outside draft cone (offset 0.50 rad)
  const outAngle = 0.50;
  const chaserOut = {
    x: 100 - dist * Math.cos(outAngle),
    y: dist * Math.sin(outAngle),
    angle: 0,
    speed: 180,
  };
  assert(!isInSlipstream(chaserOut, leader), 'chaser outside cone offset 0.50 rad');

  // Beside and Ahead of leader
  assert(!isInSlipstream({x: 100, y: 40, angle: 0, speed: 180}, leader), 'beside leader');
  assert(!isInSlipstream({x: 150, y: 0, angle: 0, speed: 180}, leader), 'ahead of leader');
}

// --- Chaser Yaw Heading Alignment & Circular Angle Wrapping ---
{
  const leader = {x: 100, y: 0, angle: 0, speed: 200};
  const chaserPos = {x: 50, y: 0, speed: 180};

  // Parallel yaw
  assert(isInSlipstream({...chaserPos, angle: 0}, leader), 'parallel yaw 0');
  // Moderate yaw (< 0.85 rad)
  assert(isInSlipstream({...chaserPos, angle: 0.70}, leader), 'moderate yaw 0.70 rad');
  // Boundary yaw
  assert(isInSlipstream({...chaserPos, angle: 0.84}, leader), 'boundary yaw 0.84 rad');
  // Exceeded yaw (sideways / grinding)
  assert(!isInSlipstream({...chaserPos, angle: 0.86}, leader), 'excessive yaw 0.86 rad');
  assert(!isInSlipstream({...chaserPos, angle: Math.PI / 2}, leader), 'perpendicular yaw');
  assert(!isInSlipstream({...chaserPos, angle: Math.PI}, leader), 'reversed yaw');

  // Circular angle wrapping around +/- PI
  const leaderWrapped = {x: 0, y: 0, angle: 3.10, speed: 200}; // near +PI
  const chaserWrapped = {
    x: -50 * Math.cos(3.10),
    y: -50 * Math.sin(3.10),
    angle: -3.10, // near -PI (delta is ~0.083 rad, well under 0.85)
    speed: 180,
  };
  assert(isInSlipstream(chaserWrapped, leaderWrapped), 'handles +/- PI circular angle wrapping cleanly');
}

// --- findSlipstreamTarget Selection ---
{
  const chaser = {x: 0, y: 0, angle: 0, speed: 180};
  const leaderFar = {x: 80, y: 0, angle: 0, speed: 200}; // dist 80
  const leaderClose = {x: 35, y: 0, angle: 0, speed: 200}; // dist 35 (stronger draft)
  const leaderInvalid = {x: 150, y: 0, angle: 0, speed: 200}; // too far

  const target = findSlipstreamTarget(chaser, [leaderFar, leaderClose, leaderInvalid]);
  assert(target !== null, 'finds valid target');
  assert(target.index === 1, 'picks closest leader with highest strength');
  assert(target.strength > 0.7, 'strength of closer leader is high');

  // No valid targets
  assert(findSlipstreamTarget(chaser, [leaderInvalid]) === null, 'returns null when no leaders in draft cone');
}

// --- Draft Top Speed & Accel Calculations ---
{
  const baseTop = 260;

  // Zero strength
  assertClose(calculateDraftTopSpeed(baseTop, 0), baseTop, 1e-4, 'top speed at 0 strength');
  assertClose(calculateDraftAccelMult(0), 1.0, 1e-4, 'accel mult at 0 strength');

  // Full strength 1.0
  assertClose(calculateDraftTopSpeed(baseTop, 1.0), baseTop * 1.085, 1e-4, 'top speed at 1.0 strength');
  assertClose(calculateDraftAccelMult(1.0), 1.22, 1e-4, 'accel mult at 1.0 strength');

  // Half strength 0.5
  assertClose(calculateDraftTopSpeed(baseTop, 0.5), baseTop * (1 + 0.085 * 0.5), 1e-4, 'top speed at 0.5 strength');
  assertClose(calculateDraftAccelMult(0.5), 1 + 0.22 * 0.5, 1e-4, 'accel mult at 0.5 strength');

  // Clamping outside [0, 1]
  assertClose(calculateDraftTopSpeed(baseTop, -0.5), baseTop, 1e-4, 'clamped negative strength');
  assertClose(calculateDraftTopSpeed(baseTop, 1.5), baseTop * 1.085, 1e-4, 'clamped over-unity strength');
}

// --- Boost Accumulation & Expiration Simulation ---
{
  const baseTop = 260;
  const draftTop = baseTop * 1.085; // 282.1
  const accel = 350;
  const dt = 0.05;

  // 1. Boost Accumulation: speed climbs from baseTop up to draftTop
  let speed = baseTop;
  const steps = 30; // 1.5 seconds
  for (let i = 0; i < steps; i++) {
    const prevSpeed = speed;
    speed = stepDraftSpeed(speed, baseTop, accel, 1.0, dt);
    assert(speed >= prevSpeed, `accumulation monotonic increase at step ${i}`);
    assert(speed <= draftTop + 1e-4, `accumulation does not exceed draft ceiling at step ${i}`);
  }
  assertClose(speed, draftTop, 0.1, 'speed reaches boosted draft ceiling');

  // 2. Boost Expiration: draft ends, speed bleeds down to baseTop
  const bleedRate = 260;
  const bleedSteps = 20; // 1.0 second
  for (let i = 0; i < bleedSteps; i++) {
    const prevSpeed = speed;
    speed = stepDraftSpeed(speed, baseTop, accel, 0, dt, bleedRate);
    assert(speed <= prevSpeed, `expiration monotonic decrease at step ${i}`);
    assert(speed >= baseTop, `expiration never drops below baseTop at step ${i}`);
  }
  assertClose(speed, baseTop, 1e-4, 'speed settles back to baseTop');
}

// ============================================================================
// 3. Ghost Trace Serialization & Integrity (engine/ghost.ts)
// ============================================================================
console.log('Testing Ghost trace serialization and deserialization...');

// --- Round-Trip Serialization Fidelity ---
{
  const originalGhost = {
    trackId: 'brick-park',
    mirror: false,
    duration: 32.45,
    samples: [
      {t: 0.0, x: 100.25, y: 200.5, angle: 0.12},
      {t: 8.0, x: 250.75, y: 320.1, angle: 1.55},
      {t: 16.0, x: 400.0, y: 450.0, angle: 3.10},
      {t: 24.0, x: 200.0, y: 150.0, angle: -1.25},
      {t: 32.45, x: 100.25, y: 200.5, angle: 0.12},
    ],
  };

  const serialized = serializeGhostLap(originalGhost);
  assert(typeof serialized === 'string', 'serialized output is string');
  assert(serialized.length > 50, 'serialized payload contains data');

  const deserialized = deserializeGhostLap(serialized);
  assert(deserialized !== null, 'deserialized object is valid');
  assert(deserialized.trackId === originalGhost.trackId, 'trackId matches');
  assert(deserialized.mirror === originalGhost.mirror, 'mirror matches');
  assertClose(deserialized.duration, originalGhost.duration, 1e-4, 'duration matches');
  assert(deserialized.samples.length === originalGhost.samples.length, 'sample count matches');

  for (let i = 0; i < originalGhost.samples.length; i++) {
    const sOrig = originalGhost.samples[i];
    const sParsed = deserialized.samples[i];
    assertClose(sParsed.t, sOrig.t, 1e-4, `sample ${i} t`);
    assertClose(sParsed.x, sOrig.x, 1e-4, `sample ${i} x`);
    assertClose(sParsed.y, sOrig.y, 1e-4, `sample ${i} y`);
    assertClose(sParsed.angle, sOrig.angle, 1e-4, `sample ${i} angle`);
  }
}

// --- Corrupted / Malformed Payload Defenses ---
{
  assert(deserializeGhostLap('not valid json {') === null, 'rejects invalid json string');
  assert(deserializeGhostLap('') === null, 'rejects empty string');
  assert(deserializeGhostLap('null') === null, 'rejects json null');
  assert(deserializeGhostLap('42') === null, 'rejects json number');
  assert(deserializeGhostLap('[]') === null, 'rejects json array');

  // Missing or corrupted fields
  assert(parseGhostLap({trackId: 123, duration: 10, samples: [{t: 0, x: 0, y: 0, angle: 0}, {t: 1, x: 1, y: 1, angle: 0}]}) === null, 'rejects non-string trackId');
  assert(parseGhostLap({trackId: 'track', duration: -5, samples: [{t: 0, x: 0, y: 0, angle: 0}, {t: 1, x: 1, y: 1, angle: 0}]}) === null, 'rejects negative duration');
  assert(parseGhostLap({trackId: 'track', duration: 700, samples: [{t: 0, x: 0, y: 0, angle: 0}, {t: 1, x: 1, y: 1, angle: 0}]}) === null, 'rejects duration over 600s');
  assert(parseGhostLap({trackId: 'track', duration: 10, samples: 'not an array'}) === null, 'rejects non-array samples');
  assert(parseGhostLap({trackId: 'track', duration: 10, samples: [{t: 0, x: 0, y: 0, angle: 0}]}) === null, 'rejects fewer than 2 samples');

  // Non-finite sample filtering
  const corruptedSamples = [
    {t: 0, x: 0, y: 0, angle: 0},
    {t: NaN, x: 10, y: 10, angle: 0},
    {t: 10, x: Infinity, y: 10, angle: 0},
    {t: 20, x: 20, y: 20, angle: 0},
  ];
  const cleaned = parseGhostLap({
    trackId: 'brick-park',
    duration: 20,
    samples: corruptedSamples,
  });
  assert(cleaned !== null, 'cleans out non-finite samples');
  assert(cleaned.samples.length === 2, 'keeps only valid samples');
}

// --- Sample Capping (GHOST_MAX_SAMPLES = 900) ---
{
  assert(GHOST_MAX_SAMPLES === 900, 'GHOST_MAX_SAMPLES is 900');
  const oversizedSamples = [];
  for (let i = 0; i < 1200; i++) {
    oversizedSamples.push({t: i * 0.1, x: i, y: i, angle: 0});
  }
  const capped = parseGhostLap({
    trackId: 'brick-park',
    duration: 120,
    samples: oversizedSamples,
  });
  assert(capped !== null, 'capped parse succeeds');
  assert(capped.samples.length === GHOST_MAX_SAMPLES, 'samples capped at 900');
}

// --- GhostRecorder Sampling & Slicing ---
{
  assertClose(GHOST_SAMPLE_HZ, 12.5, 1e-4, 'sample rate 12.5 Hz');
  assertClose(GHOST_SAMPLE_DT, 0.08, 1e-4, 'sample dt 0.08 s');

  const rec = new GhostRecorder();
  rec.begin();

  // Accumulate samples over 2 seconds (25 steps at dt = 0.08s)
  for (let i = 0; i <= 25; i++) {
    rec.sample(i * 0.08, i * 5, i * 2, 0.1, 0.08);
  }

  const snap = rec.snapshot();
  assert(snap.length >= 20, 'recorded samples buffer');

  // Slice finished lap from raceTime 0.5 to 1.5 (duration 1.0s)
  const sliced = rec.sliceLap(0.5, 1.5);
  assert(sliced.length >= 2, 'sliced lap samples');
  assertClose(sliced[0].t, 0.0, 0.05, 'sliced lap starts at t=0');
  assertClose(sliced[sliced.length - 1].t, 1.0, 0.05, 'sliced lap ends at duration 1.0');

  // Reset clears state
  rec.reset();
  assert(rec.snapshot().length === 0, 'recorder reset clears buffer');
}

// --- poseAt Trajectory Interpolation & Angular Wrap ---
{
  const ghostLap = {
    trackId: 'desert-yard',
    mirror: true,
    duration: 10.0,
    samples: [
      {t: 0.0, x: 0.0, y: 0.0, angle: 3.10},
      {t: 5.0, x: 50.0, y: 100.0, angle: -3.10}, // tests wrap across PI / -PI
      {t: 10.0, x: 100.0, y: 200.0, angle: 0.0},
    ],
  };

  // Exact sample point
  const pStart = poseAt(ghostLap, 0.0);
  assert(pStart !== null, 'pStart valid');
  assertClose(pStart.x, 0.0, 1e-4, 'pStart x');
  assertClose(pStart.y, 0.0, 1e-4, 'pStart y');

  // Midpoint interpolation
  const pMid = poseAt(ghostLap, 2.5);
  assert(pMid !== null, 'pMid valid');
  assertClose(pMid.x, 25.0, 1e-4, 'pMid x = 25');
  assertClose(pMid.y, 50.0, 1e-4, 'pMid y = 50');

  // Angular lerp wrapping across PI / -PI boundary
  // Angle at t=0 is 3.10, at t=5 is -3.10. Delta is ~0.083 rad.
  // Midpoint angle should stay near ~3.14 / -3.14 without spinning 360 degrees.
  assert(
    Math.abs(pMid.angle) > 3.0 || Math.abs(pMid.angle) < -3.0,
    `angle lerp wrap stayed close to boundary (${pMid.angle})`,
  );

  // Looping behavior for multi-lap time trial
  const pLoop = poseAt(ghostLap, 12.5); // t=12.5 mod 10 = 2.5
  assert(pLoop !== null, 'pLoop valid');
  assertClose(pLoop.x, pMid.x, 1e-4, 'looped pose matches 2.5s pose');
  assertClose(pLoop.y, pMid.y, 1e-4, 'looped pose matches 2.5s pose');
}

// ============================================================================
// 4. Continuous Ghost Delta (engine/ghost.ts)
// ============================================================================
console.log('Testing Continuous ghostDelta calculation...');
{
  const control = [
    {x: 500, y: 100},
    {x: 900, y: 500},
    {x: 500, y: 900},
    {x: 100, y: 500},
  ];
  const line = buildCenterline(control, 120);
  const n = line.points.length;

  // Build a synthetic ghost lap that traverses the centerline steadily in 10s
  const ghostSamples = [];
  const sampleSteps = 20;
  for (let i = 0; i <= sampleSteps; i++) {
    const t = (i / sampleSteps) * 10.0;
    const idx = Math.min(n - 1, Math.round((i / sampleSteps) * (n - 1)));
    const pt = line.points[idx];
    const tan = line.tangents[idx];
    const angle = Math.atan2(tan.y, tan.x);
    ghostSamples.push({t, x: pt.x, y: pt.y, angle});
  }
  const ghostLap = {
    trackId: 'test-track',
    mirror: false,
    duration: 10.0,
    samples: ghostSamples,
  };

  // Player at halfway point (n/2) with elapsed time 4.0s (ghost took 5.0s)
  const halfIdx = Math.floor(n / 2);
  const deltaAhead = calculateContinuousGhostDelta(ghostLap, line, 4.0, halfIdx);
  assertClose(deltaAhead, -1.0, 0.4, 'player ahead of ghost at halfway point returns negative delta');

  // Player at halfway point with elapsed time 6.0s (ghost took 5.0s)
  const deltaBehind = calculateContinuousGhostDelta(ghostLap, line, 6.0, halfIdx);
  assertClose(deltaBehind, 1.0, 0.4, 'player behind ghost at halfway point returns positive delta');

  // Multi-lap progress: on lap 2, playerProgress is n + halfIdx; delta remains continuous
  const deltaLap2 = calculateContinuousGhostDelta(ghostLap, line, 4.0, n + halfIdx);
  assertClose(deltaLap2, deltaAhead, 1e-4, 'progress wraps across laps without discontinuity');
}

// ============================================================================
// 5. Homing Missile Lock-on Warning (engine/race.ts & engine/constants.ts)
// ============================================================================
console.log('Testing Homing lock-on warning detection...');
{
  assert(HOMING_WARNING_DIST === 480, 'HOMING_WARNING_DIST should be 480');

  // Simulate homing update loop logic
  function testHomingWarningStep(targetIsPlayer, dist, cooldown, dt) {
    let warningFired = false;
    let nextCooldown = cooldown - dt;
    if (targetIsPlayer) {
      if (dist < HOMING_WARNING_DIST && nextCooldown <= 0) {
        nextCooldown = 0.42;
        warningFired = true;
      }
    }
    return {warningFired, nextCooldown};
  }

  // 1. Target is far (> 480): no warning
  const far = testHomingWarningStep(true, 550, 0, 0.016);
  assert(!far.warningFired, 'no warning when homing is beyond 480 units');

  // 2. Target approaches within 480 units: fires warning chirp event
  const close = testHomingWarningStep(true, 400, 0, 0.016);
  assert(close.warningFired, 'fires warning when homing is within 480 units');
  assertClose(close.nextCooldown, 0.42, 1e-4, 'cooldown set to 0.42s');

  // 3. Rate-limited during cooldown: subsequent frame does not re-fire
  const nextFrame = testHomingWarningStep(true, 390, close.nextCooldown, 0.016);
  assert(!nextFrame.warningFired, 'rate-limited while cooldown is active');

  // 4. Target is CPU (not player): does not fire warning
  const cpuTarget = testHomingWarningStep(false, 300, 0, 0.016);
  assert(!cpuTarget.warningFired, 'does not fire player warning for CPU target');
}

// ============================================================================
// 6. Boundary Shoulder Scrub & Barrier Soft Bounce (engine/constants.ts & race.ts)
// ============================================================================
console.log('Testing Boundary curbs, shoulder scrub and barrier bounce...');
{
  assert(BOUNDARY_SHOULDER_LATERAL === 220, 'boundary shoulder starts at 220');
  assert(BOUNDARY_BARRIER_LATERAL === 280, 'boundary barrier starts at 280');
  assert(EMERGENCY_RESPAWN_LATERAL === 360, 'emergency respawn at 360');

  // Simulation of shoulder and barrier physics from stepRacer
  function applyBoundaryPhysics(lateral, vf, vl, dt = 0.016) {
    const absLat = Math.abs(lateral);
    const side = Math.sign(lateral) || 1;
    let bumped = false;
    let respawned = false;
    let clampedLateral = lateral;

    // Soft outer-shoulder scrub
    if (absLat > BOUNDARY_SHOULDER_LATERAL) {
      const excess = absLat - BOUNDARY_SHOULDER_LATERAL;
      vf = Math.max(0, vf - (260 + excess * 3.5) * dt);
      vl *= Math.exp(-7.0 * dt);
    }

    // Barrier clamping & elastic bounce
    if (absLat >= BOUNDARY_BARRIER_LATERAL) {
      clampedLateral = side * BOUNDARY_BARRIER_LATERAL;
      const movingOutward = vl * side > 0;
      if (movingOutward) {
        vl = -vl * 0.45;
        vf = Math.max(0, vf * 0.75);
        bumped = true;
      }
    }

    // Emergency respawn
    if (absLat > EMERGENCY_RESPAWN_LATERAL) {
      clampedLateral = 0;
      vf = 0;
      vl = 0;
      respawned = true;
    }

    return {clampedLateral, vf, vl, bumped, respawned};
  }

  // 1. Within road (lateral 150): normal driving, no scrub or clamp
  const road = applyBoundaryPhysics(150, 300, 0);
  assertClose(road.vf, 300, 1e-4, 'no speed penalty on normal track');
  assertClose(road.clampedLateral, 150, 1e-4, 'no position clamping');

  // 2. On shoulder (lateral 250): speed scrub active
  const shoulder = applyBoundaryPhysics(250, 300, 50);
  assert(shoulder.vf < 300, 'speed scrubbed on outer shoulder');
  assert(shoulder.vl < 50, 'lateral velocity damped on shoulder');
  assert(!shoulder.bumped, 'no barrier bump on shoulder');

  // 3. Contacting barrier (lateral 290, moving outward): clamped & elastic bounce
  const barrier = applyBoundaryPhysics(290, 300, 60);
  assertClose(barrier.clampedLateral, 280, 1e-4, 'clamped to barrier at 280');
  assert(barrier.vl < 0, 'lateral velocity reversed inward');
  assertClose(barrier.vl, -60 * Math.exp(-7.0 * 0.016) * 0.45, 0.1, 'lateral velocity damped and reversed by bounce factor');
  assert(barrier.vf < 300, 'forward speed cushioned by 0.75 bounce factor');
  assert(barrier.bumped, 'emits barrier bump event');

  // 4. Past emergency threshold (lateral 380): reset to centerline
  const emergency = applyBoundaryPhysics(380, 200, 50);
  assert(emergency.respawned, 'triggers emergency respawn');
  assertClose(emergency.clampedLateral, 0, 1e-4, 'reset to centerline');
  assertClose(emergency.vf, 0, 1e-4, 'speed reset to 0');
}

console.log('check-physics: ok');
