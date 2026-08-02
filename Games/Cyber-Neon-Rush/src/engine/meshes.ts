import * as THREE from 'three';
import { ROAD_HALF_WIDTH, TRACK_SEGMENT_LENGTH } from './constants';
import { trackOffset, trackHeading } from './trackPath';

const NEON_CYAN = 0x22d3ee;
const NEON_MAGENTA = 0xf472b6;
const NEON_LIME = 0xa3e635;
const STRIPE = 0x67e8f9;
const LANE_STRIPE = 1.2;

export function createCarMesh(): THREE.Group {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.48, 2.6),
    new THREE.MeshStandardMaterial({
      color: 0x155e75,
      metalness: 0.55,
      roughness: 0.3,
      emissive: NEON_CYAN,
      emissiveIntensity: 0.55,
    }),
  );
  body.position.y = 0.5;
  g.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.42, 1.2),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.35,
      roughness: 0.12,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
    }),
  );
  cabin.position.set(0, 0.88, -0.05);
  g.add(cabin);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.08, 2.5),
    new THREE.MeshStandardMaterial({
      color: NEON_MAGENTA,
      emissive: NEON_MAGENTA,
      emissiveIntensity: 2.0,
    }),
  );
  stripe.position.set(0, 0.76, 0);
  g.add(stripe);

  for (const x of [-0.62, 0.62]) {
    for (const z of [-0.8, 0.8]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.24, 12),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 }),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.3, z);
      g.add(wheel);
    }
  }

  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 2.5,
  });
  for (const x of [-0.42, 0.42]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.1), lightMat);
    light.position.set(x, 0.52, 1.32);
    g.add(light);
  }

  const trail = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.1, 0.7),
    new THREE.MeshStandardMaterial({
      color: NEON_MAGENTA,
      emissive: NEON_MAGENTA,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.8,
    }),
  );
  trail.position.set(0, 0.38, -1.45);
  g.add(trail);

  return g;
}

export type ObstacleKind = 'barrier' | 'cone' | 'drone';

export function createObstacleMesh(kind: ObstacleKind): THREE.Group {
  const g = new THREE.Group();
  g.userData.kind = kind;

  if (kind === 'barrier') {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 1.1, 0.7),
      new THREE.MeshStandardMaterial({
        color: 0x831843,
        metalness: 0.45,
        roughness: 0.35,
        emissive: NEON_MAGENTA,
        emissiveIntensity: 0.9,
      }),
    );
    block.position.y = 0.55;
    g.add(block);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.12, 0.12),
      new THREE.MeshStandardMaterial({
        color: NEON_LIME,
        emissive: NEON_LIME,
        emissiveIntensity: 1.8,
      }),
    );
    bar.position.y = 1.2;
    g.add(bar);
  } else if (kind === 'cone') {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.1, 10),
      new THREE.MeshStandardMaterial({
        color: 0xea580c,
        emissive: 0xfb923c,
        emissiveIntensity: 1.1,
      }),
    );
    cone.position.y = 0.55;
    g.add(cone);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.06, 8, 16),
      new THREE.MeshStandardMaterial({
        color: NEON_CYAN,
        emissive: NEON_CYAN,
        emissiveIntensity: 1.6,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
  } else {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.28, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.75,
        roughness: 0.2,
        emissive: NEON_CYAN,
        emissiveIntensity: 0.75,
      }),
    );
    body.position.y = 1.6;
    g.add(body);
    const rotor = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.05, 8, 20),
      new THREE.MeshStandardMaterial({
        color: NEON_LIME,
        emissive: NEON_LIME,
        emissiveIntensity: 1.5,
      }),
    );
    rotor.rotation.x = Math.PI / 2;
    rotor.position.y = 1.6;
    g.add(rotor);
    g.userData.spin = rotor;
  }

  return g;
}

/** One road chunk: ribbon + stripes + rails, tagged with userData.maxZ for safe culling. */
export function createRoadChunk(fromZ: number, toZ: number): THREE.Group {
  const group = new THREE.Group();
  group.userData.maxZ = toZ;
  group.userData.minZ = fromZ;

  group.add(createTrackRibbon(fromZ, toZ));
  group.add(createLaneStripes(fromZ, toZ));

  for (const side of [-1, 1] as const) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.4, Math.max(0.5, toZ - fromZ)),
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x22d3ee,
        emissiveIntensity: 1.15,
      }),
    );
    const mid = (fromZ + toZ) / 2;
    const ox = trackOffset(mid);
    const heading = trackHeading(mid);
    const lx = Math.cos(heading);
    rail.position.set(ox + lx * side * 3.85, 0.22, mid);
    rail.rotation.y = -heading;
    group.add(rail);
  }

  return group;
}

function createTrackRibbon(fromZ: number, toZ: number): THREE.Mesh {
  const steps = Math.max(2, Math.ceil((toZ - fromZ) / (TRACK_SEGMENT_LENGTH * 0.35)));
  const half = ROAD_HALF_WIDTH + 0.35;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const z = fromZ + (toZ - fromZ) * t;
    const ox = trackOffset(z);
    const heading = trackHeading(z);
    const lx = Math.cos(heading);
    const lz = Math.sin(heading);
    const y = 0.02;
    positions.push(ox - lx * half, y, z - lz * half);
    positions.push(ox + lx * half, y, z + lz * half);

    // Visible asphalt with cyan edge tint
    const edge = i % 2 === 0 ? 0.12 : 0.18;
    colors.push(0.08 + edge, 0.14 + edge, 0.28 + edge);
    colors.push(0.08 + edge, 0.14 + edge, 0.28 + edge);
  }

  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.25,
      roughness: 0.65,
      emissive: new THREE.Color(0x082f49),
      emissiveIntensity: 0.55,
      side: THREE.DoubleSide,
    }),
  );
}

function createLaneStripes(fromZ: number, toZ: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: STRIPE,
    emissive: STRIPE,
    emissiveIntensity: 1.35,
  });
  const step = 3.2;
  for (let z = fromZ; z < toZ; z += step) {
    const ox = trackOffset(z);
    const heading = trackHeading(z);
    const lx = Math.cos(heading);
    const lz = Math.sin(heading);
    for (const laneEdge of [-LANE_STRIPE, LANE_STRIPE]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.5), mat);
      stripe.position.set(ox + lx * laneEdge, 0.06, z + lz * laneEdge * 0.02);
      stripe.rotation.y = -heading;
      group.add(stripe);
    }
  }
  return group;
}

export function createCityBlocks(seedZ: number): THREE.Group {
  const group = new THREE.Group();
  group.userData.maxZ = seedZ + 80;
  const rng = mulberry32(Math.floor(seedZ * 17) + 91);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = seedZ + i * 15 + rng() * 5;
      const h = 8 + rng() * 24;
      const w = 3.5 + rng() * 4;
      const d = 3.5 + rng() * 5;
      const hue = rng() > 0.5 ? NEON_CYAN : NEON_MAGENTA;
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          metalness: 0.55,
          roughness: 0.45,
          emissive: hue,
          emissiveIntensity: 0.2 + rng() * 0.4,
        }),
      );
      const ox = trackOffset(z);
      // Keep skyline clear of the driveable lanes.
      building.position.set(ox + side * (18 + rng() * 12), h / 2, z);
      group.add(building);
    }
  }
  return group;
}

function mulberry32(a: number): () => number {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
