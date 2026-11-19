/**
 * Headless checks for clockwork gear torque transmission and rotational velocity propagation:
 *  - Gear ratios, angular velocity propagation, and alternating rotation signs
 *  - Torque transmission with mechanical advantage and frictional decay
 *  - Power conservation and mechanical efficiency across multi-mesh gear trains
 *  - Planar gear network adjacency and mechanical jam (odd-cycle deadlock) detection
 *  - Dynamic torque-boost scaling for clockwork fortifications
 *
 * Run: node --experimental-strip-types src/check-torque.mjs
 */
import assert from 'node:assert/strict';
import {
  buildPlanarGearNetwork,
  calculateTowerTorqueBoost,
  computeGearRatio,
  computeMechanicalPower,
  createGearSpec,
  DEFAULT_MESH_EFFICIENCY,
  propagateTorque,
  propagateVelocity,
  RATED_ANGULAR_VELOCITY,
  solvePlanarGearNetwork,
} from './game/torque.ts';

// ── 1) Fundamental gear ratio and angular velocity propagation ─────────────
{
  // 12-tooth driver to 24-tooth driven gear: ratio = 2.0
  const ratio = computeGearRatio(12, 24);
  assert.equal(ratio, 2.0, `gear ratio 24/12 should be 2.0, got ${ratio}`);

  // Angular velocity must halve and reverse sign (clockwise -> counter-clockwise)
  const inputVel = 10.0;
  const outputVel = propagateVelocity(inputVel, [ratio]);
  assert.equal(outputVel, -5.0, `output velocity should be -5.0 rad/s, got ${outputVel}`);

  // Invalid teeth count should throw
  assert.throws(() => computeGearRatio(0, 10));
  assert.throws(() => computeGearRatio(12, -4));
  assert.throws(() => propagateVelocity(10, [0]));
}

// ── 2) Multi-gear train and idler gear properties ──────────────────────────
{
  // Three-gear train: Driver (12T) -> Idler (16T) -> Driven (24T)
  const r1 = computeGearRatio(12, 16); // 1.333...
  const r2 = computeGearRatio(16, 24); // 1.5
  const ratios = [r1, r2];

  const inputVel = 12.0;
  const finalVel = propagateVelocity(inputVel, ratios);

  // Idler reverses direction twice: driver (+), idler (-), driven (+)
  assert.ok(finalVel > 0, 'driven gear must rotate in the same direction as driver with one idler');
  // Overall ratio must equal driven / driver = 24 / 12 = 2.0 regardless of idler tooth count
  assert.ok(
    Math.abs(finalVel - inputVel / 2.0) < 1e-9,
    `final velocity should be exactly inputVel/2.0 = 6.0, got ${finalVel}`,
  );

  // Four-gear train: alternating sign turns negative again
  const r3 = computeGearRatio(24, 32);
  const fourGearVel = propagateVelocity(inputVel, [r1, r2, r3]);
  assert.ok(fourGearVel < 0, 'even number of meshes (3 meshes, 4 gears) must reverse final sign');
  const expectedFour = -inputVel * (12 / 32);
  assert.ok(
    Math.abs(fourGearVel - expectedFour) < 1e-9,
    `four-gear velocity mismatch: expected ${expectedFour}, got ${fourGearVel}`,
  );
}

// ── 3) Torque transmission, mechanical advantage, and frictional decay ──────
{
  const inputTorque = 20.0; // N*m
  const inputVel = 10.0; // rad/s
  const idealRatios = [2.0]; // 1:2 speed reduction -> 2x torque multiplier

  // Ideal lossless transmission (100% efficiency)
  const ideal = propagateTorque(inputTorque, idealRatios, [1.0]);
  assert.equal(ideal.outputTorque, 40.0, 'ideal 2:1 reduction should double output torque');
  assert.equal(ideal.cumulativeEfficiency, 1.0);

  const idealVel = propagateVelocity(inputVel, idealRatios);
  const pIn = computeMechanicalPower(inputTorque, inputVel);
  const pOut = computeMechanicalPower(ideal.outputTorque, idealVel);
  assert.ok(
    Math.abs(pIn - pOut) < 1e-9,
    `mechanical power must be conserved under ideal transmission: P_in=${pIn}, P_out=${pOut}`,
  );

  // Real clockwork transmission with 5% frictional dissipation per mesh (eta = 0.95)
  const real = propagateTorque(inputTorque, [2.0], [0.95]);
  assert.equal(real.outputTorque, 40.0 * 0.95, `output torque with 95% efficiency should be 38.0, got ${real.outputTorque}`);
  assert.equal(real.cumulativeEfficiency, 0.95);

  const realPower = computeMechanicalPower(real.outputTorque, idealVel);
  assert.ok(
    Math.abs(realPower - pIn * 0.95) < 1e-9,
    `dissipated mechanical power should equal 95% of input: expected ${pIn * 0.95}, got ${realPower}`,
  );

  // Five-stage reduction chain cumulative decay: eta^5
  const fiveMeshRatios = [1.2, 1.2, 1.2, 1.2, 1.2];
  const efficiencies = [0.94, 0.94, 0.94, 0.94, 0.94];
  const multiStage = propagateTorque(inputTorque, fiveMeshRatios, efficiencies);
  const expectedEfficiency = Math.pow(0.94, 5);
  assert.ok(
    Math.abs(multiStage.cumulativeEfficiency - expectedEfficiency) < 1e-9,
    `cumulative decay across 5 stages: expected ${expectedEfficiency}, got ${multiStage.cumulativeEfficiency}`,
  );
  assert.ok(
    multiStage.cumulativeEfficiency < 0.75,
    'transmission decay over long gear chains must naturally attenuate transmitted torque',
  );
}

// ── 4) Planar gear network: linear and branching gear trains ────────────────
{
  // Layout three gears along a line:
  // Driver G1 at (0, 0) with pitch radius 2.0 (teeth 4, module 1)
  // Driven G2 at (4.0, 0) with pitch radius 2.0 (teeth 4) -> distance = 4.0 (meshes)
  // Driven G3 at (7.0, 0) with pitch radius 1.0 (teeth 2) -> distance = 3.0 (meshes with G2)
  const g1 = { id: 'g1', x: 0, y: 0, teeth: 20, pitchRadius: 2.0, isDriver: true, driveVelocity: 15.0, driveTorque: 30.0 };
  const g2 = { id: 'g2', x: 4.0, y: 0, teeth: 20, pitchRadius: 2.0 };
  const g3 = { id: 'g3', x: 7.0, y: 0, teeth: 10, pitchRadius: 1.0 };

  const network = buildPlanarGearNetwork([g1, g2, g3]);
  assert.deepEqual(network.adjacency.get('g1'), ['g2']);
  assert.deepEqual(network.adjacency.get('g2')?.sort(), ['g1', 'g3']);
  assert.deepEqual(network.adjacency.get('g3'), ['g2']);

  const solution = solvePlanarGearNetwork(network, 'g1');
  assert.equal(solution.hasMechanicalJam, false, 'linear gear train must never jam');
  assert.equal(solution.velocities.get('g1'), 15.0);
  assert.equal(solution.velocities.get('g2'), -15.0, 'g2 should rotate counter-clockwise at equal magnitude');
  assert.equal(solution.velocities.get('g3'), 30.0, 'g3 has half the teeth of g2, rotating clockwise at 2x speed (30 rad/s)');

  // Verify decay along the network
  const decayG1 = solution.efficiencyDecay.get('g1');
  const decayG2 = solution.efficiencyDecay.get('g2');
  const decayG3 = solution.efficiencyDecay.get('g3');
  assert.equal(decayG1, 1.0);
  assert.equal(decayG2, DEFAULT_MESH_EFFICIENCY);
  assert.ok(
    Math.abs((decayG3 ?? 0) - Math.pow(DEFAULT_MESH_EFFICIENCY, 2)) < 1e-9,
    'decay at g3 must compound across both meshes',
  );
}

// ── 5) Mechanical jam and deadlock detection in closed gear cycles ───────────
{
  // A) Even-length cycle (4 gears in a 2x2 square):
  // Radii = 1.0, centers at (0,0), (2,0), (2,2), (0,2).
  // Distances between adjacent corners = 2.0 (exact mesh).
  // Alternating rotation signs: (+1, -1, +1, -1) -> closes consistently, NO JAM!
  const sq1 = { id: 'sq1', x: 0, y: 0, teeth: 10, pitchRadius: 1.0, isDriver: true, driveVelocity: 10.0 };
  const sq2 = { id: 'sq2', x: 2, y: 0, teeth: 10, pitchRadius: 1.0 };
  const sq3 = { id: 'sq3', x: 2, y: 2, teeth: 10, pitchRadius: 1.0 };
  const sq4 = { id: 'sq4', x: 0, y: 2, teeth: 10, pitchRadius: 1.0 };

  const evenNetwork = buildPlanarGearNetwork([sq1, sq2, sq3, sq4]);
  assert.equal(evenNetwork.adjacency.get('sq1')?.length, 2);
  const evenSol = solvePlanarGearNetwork(evenNetwork, 'sq1');
  assert.equal(evenSol.hasMechanicalJam, false, 'even-cycle 4-gear loop must mesh smoothly without jam');

  // B) Odd-length cycle (3 gears in an equilateral triangle):
  // Side length = 2.0 (pitch radius = 1.0 each).
  // Signs: (+1) -> (-1) -> (+1) -> tries to mesh back into (+1) with opposite direction!
  // Mechanical lock / deadlock!
  const tri1 = { id: 'tri1', x: 0, y: 0, teeth: 10, pitchRadius: 1.0, isDriver: true, driveVelocity: 10.0 };
  const tri2 = { id: 'tri2', x: 2, y: 0, teeth: 10, pitchRadius: 1.0 };
  const tri3 = { id: 'tri3', x: 1, y: Math.sqrt(3), teeth: 10, pitchRadius: 1.0 };

  const oddNetwork = buildPlanarGearNetwork([tri1, tri2, tri3]);
  const oddSol = solvePlanarGearNetwork(oddNetwork, 'tri1');
  assert.equal(oddSol.hasMechanicalJam, true, 'odd-cycle 3-gear triangle must be detected as a mechanical jam');
  assert.ok(oddSol.jammedGears.length > 0, 'jammed gears must be identified in solution');
}

// ── 6) Tower torque boost scaling and overdrive limits ───────────────────────
{
  // Baseline boost at 0 velocity is 1.0x (normal fire rate)
  const zeroBoost = calculateTowerTorqueBoost(0);
  assert.equal(zeroBoost, 1.0, 'zero torque should give 1.0x baseline fire rate');

  // At rated velocity (10 rad/s), boost reaches +25% (1.25x)
  const ratedBoost = calculateTowerTorqueBoost(RATED_ANGULAR_VELOCITY, RATED_ANGULAR_VELOCITY);
  assert.ok(
    Math.abs(ratedBoost - 1.25) < 1e-9,
    `rated velocity should grant exactly 1.25x fire rate, got ${ratedBoost}`,
  );

  // Direction does not matter (absolute rotational velocity)
  const reverseBoost = calculateTowerTorqueBoost(-RATED_ANGULAR_VELOCITY, RATED_ANGULAR_VELOCITY);
  assert.equal(reverseBoost, ratedBoost, 'counter-clockwise rotation must grant identical boost');

  // Over-speed saturation cap (caps at 1.5x speed ratio -> 1.375x max boost)
  const excessiveBoost = calculateTowerTorqueBoost(100.0, RATED_ANGULAR_VELOCITY);
  assert.ok(
    excessiveBoost <= 1.375,
    `torque boost must be capped to prevent runaway clockwork overclocking, got ${excessiveBoost}`,
  );
}

// ── 7) GearSpec inertia and physical parameters ─────────────────────────────
{
  const specSmall = createGearSpec(12, 1.0, 0.96);
  const specLarge = createGearSpec(36, 1.0, 0.96);

  assert.equal(specSmall.pitchRadius, 6.0);
  assert.equal(specLarge.pitchRadius, 18.0);
  assert.ok(specLarge.inertia > specSmall.inertia, 'larger gear must have significantly higher moment of inertia');
  // Inertia scales with mass (teeth) * radius^2 -> 3 * 3^2 = 27x
  const inertiaRatio = specLarge.inertia / specSmall.inertia;
  assert.ok(
    Math.abs(inertiaRatio - 27.0) < 1e-6,
    `moment of inertia ratio should be 27x, got ${inertiaRatio}`,
  );
}

console.log('check-torque: ok');
