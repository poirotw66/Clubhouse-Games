/**
 * Clockwork Keep gear torque transmission and rotational velocity propagation.
 *
 * Implements mechanical gear train kinetics:
 * - Gear ratios and angular velocity propagation with alternating rotation signs
 * - Torque transmission with mechanical advantage and frictional decay
 * - Planar gear network adjacency with mechanical jam (odd cycle) detection
 * - Power conservation and rotational boost calculation for clockwork towers
 */

export interface GearSpec {
  teeth: number;
  module: number;
  pitchRadius: number;
  efficiency: number;
  inertia: number;
}

export interface PlanarGearNode {
  id: string;
  x: number;
  y: number;
  teeth: number;
  module?: number;
  pitchRadius?: number;
  efficiency?: number;
  isDriver?: boolean;
  driveVelocity?: number; // rad/s (positive = clockwise, negative = counter-clockwise)
  driveTorque?: number; // N*m
}

export interface PlanarGearNetwork {
  nodes: Map<string, PlanarGearNode>;
  adjacency: Map<string, string[]>;
}

export interface GearNetworkSolution {
  velocities: Map<string, number>;
  torques: Map<string, number>;
  powers: Map<string, number>;
  efficiencyDecay: Map<string, number>;
  hasMechanicalJam: boolean;
  jammedGears: string[];
}

export const DEFAULT_GEAR_MODULE = 1.0;
export const DEFAULT_MESH_EFFICIENCY = 0.95; // 5% frictional dissipation per mesh
export const RATED_ANGULAR_VELOCITY = 10.0; // rad/s baseline for 100% mechanical boost

/**
 * Creates a standard gear specification from tooth count and metric module.
 */
export function createGearSpec(
  teeth: number,
  gearModule: number = DEFAULT_GEAR_MODULE,
  efficiency: number = DEFAULT_MESH_EFFICIENCY,
): GearSpec {
  const pitchRadius = (teeth * gearModule) / 2;
  const inertia = 0.5 * teeth * Math.pow(pitchRadius, 2) * 0.001;
  return {
    teeth,
    module: gearModule,
    pitchRadius,
    efficiency,
    inertia,
  };
}

/**
 * Computes gear ratio GR = N_driven / N_driver.
 */
export function computeGearRatio(driverTeeth: number, drivenTeeth: number): number {
  if (driverTeeth <= 0 || drivenTeeth <= 0) {
    throw new Error('Gear teeth count must be strictly positive');
  }
  return drivenTeeth / driverTeeth;
}

/**
 * Propagates angular velocity through a serial gear chain.
 * Each mesh reverses rotational direction and scales inversely with the gear ratio:
 *   omega_out = omega_in * product(-1 / GR_i)
 */
export function propagateVelocity(inputVelocity: number, gearRatios: number[]): number {
  let velocity = inputVelocity;
  for (const ratio of gearRatios) {
    if (ratio <= 0) {
      throw new Error('Gear ratio must be strictly positive');
    }
    velocity = -velocity / ratio;
  }
  return velocity;
}

/**
 * Propagates torque through a serial gear chain taking efficiency losses into account:
 *   tau_out = tau_in * product(GR_i * efficiency_i)
 */
export function propagateTorque(
  inputTorque: number,
  gearRatios: number[],
  efficiencies: number[] = [],
): { outputTorque: number; cumulativeEfficiency: number } {
  let torque = inputTorque;
  let cumulativeEfficiency = 1.0;

  for (let i = 0; i < gearRatios.length; i++) {
    const ratio = gearRatios[i];
    const efficiency = efficiencies[i] ?? DEFAULT_MESH_EFFICIENCY;
    if (ratio <= 0) {
      throw new Error('Gear ratio must be strictly positive');
    }
    cumulativeEfficiency *= efficiency;
    torque = torque * ratio * efficiency;
  }

  return { outputTorque: torque, cumulativeEfficiency };
}

/**
 * Computes mechanical power P = tau * |omega|.
 */
export function computeMechanicalPower(torque: number, angularVelocity: number): number {
  return Math.abs(torque * angularVelocity);
}

/**
 * Builds an adjacency network of planar gears meshing based on pitch radius distance.
 */
export function buildPlanarGearNetwork(
  gears: PlanarGearNode[],
  tolerance: number = 0.05,
): PlanarGearNetwork {
  const nodes = new Map<string, PlanarGearNode>();
  const adjacency = new Map<string, string[]>();

  for (const gear of gears) {
    const mod = gear.module ?? DEFAULT_GEAR_MODULE;
    const pitchRadius = gear.pitchRadius ?? (gear.teeth * mod) / 2;
    nodes.set(gear.id, {
      ...gear,
      module: mod,
      pitchRadius,
      efficiency: gear.efficiency ?? DEFAULT_MESH_EFFICIENCY,
    });
    adjacency.set(gear.id, []);
  }

  const gearList = Array.from(nodes.values());
  for (let i = 0; i < gearList.length; i++) {
    for (let j = i + 1; j < gearList.length; j++) {
      const g1 = gearList[i];
      const g2 = gearList[j];
      const dist = Math.hypot(g1.x - g2.x, g1.y - g2.y);
      const expectedDist = (g1.pitchRadius ?? 0) + (g2.pitchRadius ?? 0);
      if (Math.abs(dist - expectedDist) <= tolerance) {
        adjacency.get(g1.id)?.push(g2.id);
        adjacency.get(g2.id)?.push(g1.id);
      }
    }
  }

  return { nodes, adjacency };
}

/**
 * Solves velocity and torque distribution across a planar gear network driven by a primary driver gear.
 * Identifies mechanical jams (e.g. odd-length cycles in gear meshes that lock the mechanism).
 */
export function solvePlanarGearNetwork(
  network: PlanarGearNetwork,
  driverId: string,
): GearNetworkSolution {
  const velocities = new Map<string, number>();
  const torques = new Map<string, number>();
  const powers = new Map<string, number>();
  const efficiencyDecay = new Map<string, number>();
  const jammedGears: string[] = [];

  const driver = network.nodes.get(driverId);
  if (!driver) {
    return {
      velocities,
      torques,
      powers,
      efficiencyDecay,
      hasMechanicalJam: false,
      jammedGears,
    };
  }

  const initialVelocity = driver.driveVelocity ?? 10.0;
  const initialTorque = driver.driveTorque ?? 20.0;

  velocities.set(driverId, initialVelocity);
  torques.set(driverId, initialTorque);
  powers.set(driverId, computeMechanicalPower(initialTorque, initialVelocity));
  efficiencyDecay.set(driverId, 1.0);

  const queue: string[] = [driverId];
  const visited = new Set<string>([driverId]);
  let hasMechanicalJam = false;

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = network.nodes.get(currentId)!;
    const currentVel = velocities.get(currentId)!;
    const currentTorque = torques.get(currentId)!;
    const currentDecay = efficiencyDecay.get(currentId)!;
    const neighbors = network.adjacency.get(currentId) ?? [];

    for (const neighborId of neighbors) {
      const neighborNode = network.nodes.get(neighborId)!;
      const ratio = computeGearRatio(currentNode.teeth, neighborNode.teeth);
      const expectedVel = -currentVel / ratio;
      const meshEfficiency = neighborNode.efficiency ?? DEFAULT_MESH_EFFICIENCY;
      const expectedTorque = currentTorque * ratio * meshEfficiency;
      const expectedDecay = currentDecay * meshEfficiency;

      if (visited.has(neighborId)) {
        // Already visited: verify rotational velocity consistency.
        const existingVel = velocities.get(neighborId)!;
        if (Math.sign(existingVel) !== Math.sign(expectedVel) || Math.abs(existingVel - expectedVel) > 1e-4) {
          hasMechanicalJam = true;
          if (!jammedGears.includes(currentId)) jammedGears.push(currentId);
          if (!jammedGears.includes(neighborId)) jammedGears.push(neighborId);
        }
      } else {
        visited.add(neighborId);
        velocities.set(neighborId, expectedVel);
        torques.set(neighborId, expectedTorque);
        powers.set(neighborId, computeMechanicalPower(expectedTorque, expectedVel));
        efficiencyDecay.set(neighborId, expectedDecay);
        queue.push(neighborId);
      }
    }
  }

  return {
    velocities,
    torques,
    powers,
    efficiencyDecay,
    hasMechanicalJam,
    jammedGears,
  };
}

/**
 * Computes combat fire rate multiplier based on transferred clockwork rotational speed.
 * Yields up to +25% fire-rate boost at rated velocity without exceeding safe mechanical limits.
 */
export function calculateTowerTorqueBoost(
  outputVelocity: number,
  ratedVelocity: number = RATED_ANGULAR_VELOCITY,
): number {
  if (ratedVelocity <= 0) return 1.0;
  const speedRatio = Math.min(1.5, Math.abs(outputVelocity) / ratedVelocity);
  return 1.0 + speedRatio * 0.25;
}
