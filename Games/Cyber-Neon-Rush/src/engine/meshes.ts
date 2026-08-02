import * as THREE from 'three';
import { ROAD_HALF_WIDTH, TRACK_SEGMENT_LENGTH } from './constants';
import { trackOffset, trackHeading } from './trackPath';

const NEON_CYAN = 0x22d3ee;
const NEON_MAGENTA = 0xf472b6;
const NEON_LIME = 0xa3e635;
const ROAD = 0x0b1224;
const STRIPE = 0x67e8f9;

export function createCarMesh(): THREE.Group {
  const g = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.42, 2.4),
    new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.75,
      roughness: 0.28,
      emissive: NEON_CYAN,
      emissiveIntensity: 0.18,
    }),
  );
  body.position.y = 0.45;
  g.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.38, 1.1),
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      metalness: 0.4,
      roughness: 0.15,
      emissive: 0x0284c7,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.92,
    }),
  );
  cabin.position.set(0, 0.78, -0.1);
  g.add(cabin);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.06, 2.35),
    new THREE.MeshStandardMaterial({
      color: NEON_MAGENTA,
      emissive: NEON_MAGENTA,
      emissiveIntensity: 1.4,
    }),
  );
  stripe.position.set(0, 0.68, 0);
  g.add(stripe);

  for (const x of [-0.55, 0.55]) {
    for (const z of [-0.75, 0.75]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.22, 12),
        new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9 }),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.28, z);
      g.add(wheel);
    }
  }

  const lightGeo = new THREE.BoxGeometry(0.28, 0.12, 0.08);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 2.2,
  });
  for (const x of [-0.4, 0.4]) {
    const light = new THREE.Mesh(lightGeo, lightMat);
    light.position.set(x, 0.48, 1.22);
    g.add(light);
  }

  const trail = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.5),
    new THREE.MeshStandardMaterial({
      color: NEON_MAGENTA,
      emissive: NEON_MAGENTA,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.7,
    }),
  );
  trail.position.set(0, 0.35, -1.35);
  g.add(trail);

  g.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      (obj as THREE.Mesh).castShadow = true;
      (obj as THREE.Mesh).receiveShadow = true;
    }
  });
  return g;
}

export type ObstacleKind = 'barrier' | 'cone' | 'drone';

export function createObstacleMesh(kind: ObstacleKind): THREE.Group {
  const g = new THREE.Group();
  g.userData.kind = kind;

  if (kind === 'barrier') {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x831843,
      metalness: 0.5,
      roughness: 0.35,
      emissive: NEON_MAGENTA,
      emissiveIntensity: 0.7,
    });
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.7), mat);
    block.position.y = 0.55;
    g.add(block);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.12, 0.12),
      new THREE.MeshStandardMaterial({
        color: NEON_LIME,
        emissive: NEON_LIME,
        emissiveIntensity: 1.6,
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
        emissiveIntensity: 0.9,
      }),
    );
    cone.position.y = 0.55;
    g.add(cone);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.06, 8, 16),
      new THREE.MeshStandardMaterial({
        color: NEON_CYAN,
        emissive: NEON_CYAN,
        emissiveIntensity: 1.5,
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
        metalness: 0.8,
        roughness: 0.2,
        emissive: NEON_CYAN,
        emissiveIntensity: 0.6,
      }),
    );
    body.position.y = 1.6;
    g.add(body);
    const rotor = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.05, 8, 20),
      new THREE.MeshStandardMaterial({
        color: NEON_LIME,
        emissive: NEON_LIME,
        emissiveIntensity: 1.4,
      }),
    );
    rotor.rotation.x = Math.PI / 2;
    rotor.position.y = 1.6;
    g.add(rotor);
    g.userData.spin = rotor;
  }

  g.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) (obj as THREE.Mesh).castShadow = true;
  });
  return g;
}

export function createTrackRibbon(fromZ: number, toZ: number): THREE.Mesh {
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
    const nx = -Math.sin(heading);
    const nz = Math.cos(heading);
    // Lateral basis (perpendicular in XZ).
    const lx = Math.cos(heading);
    const lz = Math.sin(heading);

    const y = 0.02;
    // left / right edge
    positions.push(ox - lx * half, y, z - lz * half);
    positions.push(ox + lx * half, y, z + lz * half);

    const glow = 0.15 + 0.1 * Math.sin(z * 0.2);
    const c = new THREE.Color(ROAD);
    c.offsetHSL(0, 0, glow * 0.05);
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b);

    void nx;
    void nz;
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

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.35,
    roughness: 0.55,
    emissive: new THREE.Color(0x020617),
    emissiveIntensity: 0.4,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

const LANE_STRIPE = 1.2;

export function createLaneStripes(fromZ: number, toZ: number): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: STRIPE,
    emissive: STRIPE,
    emissiveIntensity: 1.2,
  });
  const step = 3.2;
  for (let z = fromZ; z < toZ; z += step) {
    const ox = trackOffset(z);
    const heading = trackHeading(z);
    const lx = Math.cos(heading);
    const lz = Math.sin(heading);
    for (const laneEdge of [-LANE_STRIPE, LANE_STRIPE]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 1.4), mat);
      stripe.position.set(ox + lx * laneEdge, 0.05, z + lz * laneEdge * 0.02);
      stripe.rotation.y = -heading;
      group.add(stripe);
    }
  }
  return group;
}

export function createCityBlocks(seedZ: number): THREE.Group {
  const group = new THREE.Group();
  const rng = mulberry32(Math.floor(seedZ * 17) + 91);
  for (let side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = seedZ + i * 14 + rng() * 6;
      const h = 6 + rng() * 22;
      const w = 3 + rng() * 4;
      const d = 3 + rng() * 5;
      const hue = rng() > 0.5 ? NEON_CYAN : NEON_MAGENTA;
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          metalness: 0.6,
          roughness: 0.4,
          emissive: hue,
          emissiveIntensity: 0.15 + rng() * 0.35,
        }),
      );
      const ox = trackOffset(z);
      building.position.set(ox + side * (12 + rng() * 10), h / 2, z);
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
