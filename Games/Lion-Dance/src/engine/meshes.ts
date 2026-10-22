import * as THREE from 'three';
import { BODY_HEIGHT, BODY_LENGTH, BODY_WIDTH, LEG_ATTACH, LEG_IDS, TRACK_LENGTH, type LegId } from './constants';

const CREAM = 0xf3e6c8;
const RED = 0xc4281c;
const GOLD = 0xe8b84a;
const DARK_RED = 0x8b1a12;
const WOOD = 0x6b3e26;
const STONE = 0xd4c4a8;
const GREEN = 0x2f6b3a;
const FLOWER_PINK = 0xf2a0b8;
const FLOWER_YELLOW = 0xffe066;

function mat(color: number, opts?: { rough?: number; metal?: number }): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts?.rough ?? 0.72,
    metalness: opts?.metal ?? 0.05,
  });
}

export interface LionMeshes {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legs: Record<LegId, THREE.Group>;
  flower: THREE.Group;
}

export function buildLion(): LionMeshes {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Torso cloth
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(BODY_LENGTH, 0.55, BODY_WIDTH),
    mat(RED, { rough: 0.65 }),
  );
  torso.position.y = 0.05;
  torso.castShadow = true;
  body.add(torso);

  // Gold trim ridges
  for (const z of [-BODY_WIDTH * 0.42, BODY_WIDTH * 0.42]) {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(BODY_LENGTH * 0.95, 0.08, 0.06), mat(GOLD, { metal: 0.35 }));
    trim.position.set(0, 0.28, z);
    body.add(trim);
  }

  // Spine pompoms
  for (let i = 0; i < 5; i++) {
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(GOLD, { metal: 0.2 }));
    pom.position.set(-0.7 + i * 0.35, 0.38, 0);
    body.add(pom);
  }

  // Head
  const head = new THREE.Group();
  head.position.set(BODY_LENGTH * 0.55, 0.15, 0);
  body.add(head);

  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), mat(RED));
  skull.castShadow = true;
  head.add(skull);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.5), mat(DARK_RED));
  snout.position.set(0.4, -0.05, 0);
  head.add(snout);

  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.42), mat(0xf5f0e6));
  jaw.position.set(0.42, -0.22, 0);
  head.add(jaw);

  // Eyes
  for (const z of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(0xf8f4e8));
    eye.position.set(0.28, 0.12, z);
    head.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), mat(0x1a1208));
    pupil.position.set(0.34, 0.12, z);
    head.add(pupil);
  }

  // Horn / forehead mirror
  const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.18, 6), mat(GOLD, { metal: 0.5 }));
  mirror.position.set(0.05, 0.35, 0);
  head.add(mirror);

  // Mane flaps
  for (const z of [-0.4, 0.4]) {
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.12), mat(GOLD));
    flap.position.set(-0.1, 0.05, z);
    head.add(flap);
  }

  // Flower drummer on head
  const flower = buildFlower();
  flower.position.set(-0.05, 0.48, 0);
  head.add(flower);

  // Drum
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), mat(RED));
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0.22, 0.42, 0.18);
  head.add(drum);
  const drumTop = new THREE.Mesh(new THREE.CircleGeometry(0.115, 12), mat(0xf5e6c8));
  drumTop.rotation.y = Math.PI / 2;
  drumTop.position.set(0.275, 0.42, 0.18);
  head.add(drumTop);

  const legs = {} as Record<LegId, THREE.Group>;
  for (const id of LEG_IDS) {
    const leg = buildLeg(id);
    const a = LEG_ATTACH[id];
    leg.position.set(a.x, -0.15, a.z);
    body.add(leg);
    legs[id] = leg;
  }

  root.position.y = BODY_HEIGHT;
  return { root, body, head, legs, flower };
}

function buildLeg(id: LegId): THREE.Group {
  const g = new THREE.Group();
  g.name = id;
  const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.35, 4, 8), mat(RED));
  thigh.position.y = -0.25;
  g.add(thigh);
  const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 8), mat(DARK_RED));
  shin.position.y = -0.65;
  shin.name = 'shin';
  g.add(shin);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.18), mat(GOLD, { metal: 0.25 }));
  foot.position.set(0.06, -0.92, 0);
  foot.name = 'foot';
  g.add(foot);
  // Pants cuff
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 10), mat(GOLD));
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -0.48;
  g.add(cuff);
  return g;
}

function buildFlower(): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(FLOWER_PINK));
  g.add(head);
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(FLOWER_PINK));
    const a = (i / 5) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.12, 0.02, Math.sin(a) * 0.12);
    g.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(FLOWER_YELLOW));
  center.position.y = 0.08;
  g.add(center);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.12, 4, 8), mat(GREEN));
  body.position.y = -0.14;
  g.add(body);
  // Stick arms holding drumsticks
  for (const z of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.1, 3, 6), mat(FLOWER_PINK));
    arm.position.set(0.1, -0.08, z * 0.1);
    arm.rotation.z = -0.8;
    g.add(arm);
  }
  return g;
}

export function buildStreet(scene: THREE.Scene, reducedMotion: boolean): {
  lanterns: THREE.Object3D[];
  gate: THREE.Group;
  envelope: THREE.Group;
  confetti: THREE.Points | null;
} {
  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_LENGTH + 30, 14),
    mat(STONE, { rough: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(TRACK_LENGTH / 2, 0, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  // Center carpet strip
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_LENGTH + 4, 2.4),
    mat(0xc45c48, { rough: 0.85 }),
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(TRACK_LENGTH / 2, 0.01, 0);
  scene.add(carpet);

  // Side stalls / poles
  const lanterns: THREE.Object3D[] = [];
  for (let i = 0; i <= TRACK_LENGTH; i += 5) {
    for (const side of [-1, 1] as const) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6), mat(WOOD));
      pole.position.set(i, 1.6, side * 4.2);
      scene.add(pole);

      const lantern = new THREE.Group();
      const paper = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(RED, { rough: 0.55 }));
      paper.scale.set(1, 1.25, 1);
      lantern.add(paper);
      const glow = new THREE.PointLight(0xffaa44, reducedMotion ? 0.35 : 0.7, 6, 2);
      glow.position.y = 0;
      lantern.add(glow);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.1, 8), mat(GOLD, { metal: 0.4 }));
      top.position.y = 0.32;
      lantern.add(top);
      lantern.position.set(i, 2.85, side * 4.2);
      scene.add(lantern);
      lanterns.push(lantern);

      // Banner
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.4), mat(i % 10 === 0 ? GOLD : RED));
      banner.position.set(i + 0.5, 1.5, side * 3.9);
      banner.rotation.y = side > 0 ? -0.2 : 0.2;
      scene.add(banner);
    }
  }

  // Start marker
  const startArch = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 5), mat(WOOD));
  startArch.position.set(-1.2, 1.25, 0);
  scene.add(startArch);

  // Temple gate at finish
  const gate = new THREE.Group();
  gate.position.set(TRACK_LENGTH + 1.5, 0, 0);

  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.2, 0.45), mat(RED));
  pillarL.position.set(0, 2.1, -2.2);
  gate.add(pillarL);
  const pillarR = pillarL.clone();
  pillarR.position.z = 2.2;
  gate.add(pillarR);

  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 5.2), mat(GOLD, { metal: 0.3 }));
  beam.position.set(0, 4.0, 0);
  gate.add(beam);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.1, 4), mat(DARK_RED));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 4.9, 0);
  gate.add(roof);

  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 2.2), mat(GOLD, { metal: 0.45 }));
  plaque.position.set(-0.2, 3.3, 0);
  gate.add(plaque);

  scene.add(gate);

  // Hanging 青 / red envelope
  const envelope = new THREE.Group();
  envelope.position.set(TRACK_LENGTH - 0.2, 3.4, 0);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 6), mat(0x333333));
  string.position.y = 0.5;
  envelope.add(string);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.08), mat(RED));
  pack.position.y = -0.15;
  envelope.add(pack);
  const seal = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.09), mat(GOLD, { metal: 0.4 }));
  seal.position.y = -0.05;
  envelope.add(seal);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat(GREEN));
  leaf.scale.set(1, 0.55, 0.4);
  leaf.position.set(0, -0.55, 0);
  envelope.add(leaf);
  scene.add(envelope);

  // Distance ticks
  for (let m = 10; m < TRACK_LENGTH; m += 10) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 2.6), mat(GOLD));
    tick.position.set(m, 0.03, 0);
    scene.add(tick);
  }

  let confetti: THREE.Points | null = null;
  if (!reducedMotion) {
    const count = 180;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(RED),
      new THREE.Color(GOLD),
      new THREE.Color(CREAM),
      new THREE.Color(0xff6644),
    ];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = TRACK_LENGTH + (Math.random() - 0.5) * 4;
      positions[i * 3 + 1] = 2 + Math.random() * 4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      const c = palette[i % palette.length]!;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    confetti = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0 }),
    );
    confetti.visible = false;
    scene.add(confetti);
  }

  // Soft sky backdrop planes (no texture)
  const skyMat = new THREE.MeshBasicMaterial({ color: 0xf7d9a8, side: THREE.BackSide });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 16, 12), skyMat);
  scene.add(sky);

  return { lanterns, gate, envelope, confetti };
}

export function applyLegPose(
  legs: Record<LegId, THREE.Group>,
  lift: Record<LegId, number>,
  swing: Record<LegId, number>,
): void {
  for (const id of LEG_IDS) {
    const leg = legs[id];
    const L = lift[id] ?? 0;
    const S = swing[id] ?? 0;
    leg.rotation.z = 0;
    leg.rotation.x = -S * 0.85 + L * 0.15;
    leg.position.y = -0.15 + L * 0.35;
    const shin = leg.getObjectByName('shin');
    if (shin) shin.rotation.x = L * 0.6;
  }
}
