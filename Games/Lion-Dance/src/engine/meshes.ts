import * as THREE from 'three';
import {
  BODY_HEIGHT,
  BODY_LENGTH,
  BODY_WIDTH,
  LEG_ATTACH,
  LEG_COLOR,
  LEG_IDS,
  TRACK_LENGTH,
  type LegId,
} from './constants';

const RED = 0xc4281c;
const DARK_RED = 0x8b1a12;
const GOLD = 0xe8b84a;
const CREAM = 0xfff4d6;
const WOOD = 0x6b3e26;
const GREEN = 0x3d8b4f;
const FLOWER_PINK = 0xf2a0b8;
const FLOWER_YELLOW = 0xffe066;
const SKY_TOP = 0x6ec4f0;
const SKY_BOT = 0xffd9a0;
const HILL = 0x4f9e5c;
const STREET = 0xf0e0b8;

const matCache = new Map<string, THREE.MeshStandardMaterial>();

function mat(
  color: number,
  opts?: { rough?: number; metal?: number; emissive?: number; eInt?: number },
): THREE.MeshStandardMaterial {
  const rough = opts?.rough ?? 0.62;
  const metal = opts?.metal ?? 0.08;
  const emissive = opts?.emissive ?? 0;
  const eInt = opts?.eInt ?? 0;
  const key = `${color}|${rough}|${metal}|${emissive}|${eInt}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: metal,
      emissive,
      emissiveIntensity: eInt,
    });
    matCache.set(key, m);
  }
  return m;
}

function box(w: number, h: number, d: number, color: number, opts?: Parameters<typeof mat>[1]): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
}

export interface LionMeshes {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legs: Record<LegId, THREE.Group>;
  flower: THREE.Group;
  shadow: THREE.Mesh;
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  leftEar: THREE.Object3D;
  rightEar: THREE.Object3D;
  tail: THREE.Object3D;
  jaw: THREE.Object3D;
}

function outline(mesh: THREE.Mesh, scale = 1.08): THREE.Mesh {
  const geo = mesh.geometry;
  const m = new THREE.MeshBasicMaterial({ color: 0x2a1208, side: THREE.BackSide });
  const o = new THREE.Mesh(geo, m);
  o.scale.setScalar(scale);
  o.renderOrder = -1;
  return o;
}

export function buildLion(): LionMeshes {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Soft ground blob shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  // Draping torso — layered volumes so side silhouette is not a single box
  const torso = box(BODY_LENGTH * 0.92, 0.95, BODY_WIDTH * 0.95, RED, { rough: 0.5 });
  torso.position.y = 0.12;
  torso.castShadow = true;
  body.add(torso);
  body.add(outline(torso, 1.04));

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 12), mat(RED, { rough: 0.48 }));
  chest.scale.set(1.15, 0.85, 1.05);
  chest.position.set(0.85, 0.15, 0);
  body.add(chest);

  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.65, 14, 12), mat(DARK_RED, { rough: 0.55 }));
  rump.scale.set(1.05, 0.8, 1);
  rump.position.set(-0.95, 0.05, 0);
  body.add(rump);

  const belly = box(BODY_LENGTH * 0.78, 0.4, BODY_WIDTH * 0.78, DARK_RED, { rough: 0.7 });
  belly.position.y = -0.42;
  body.add(belly);

  // Gold spine scales / pompoms
  for (const z of [-BODY_WIDTH * 0.5, BODY_WIDTH * 0.5]) {
    const trim = box(BODY_LENGTH * 0.85, 0.14, 0.1, GOLD, { metal: 0.5 });
    trim.position.set(0, 0.58, z);
    body.add(trim);
  }
  for (let i = 0; i < 7; i++) {
    const pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      mat(i % 2 === 0 ? GOLD : 0xffe8a0, { metal: 0.4, emissive: GOLD, eInt: 0.08 }),
    );
    pom.position.set(-1.2 + i * 0.4, 0.72, 0);
    body.add(pom);
  }

  // Cloth skirt flaps (hanging fur)
  for (let i = 0; i < 5; i++) {
    const flap = box(0.45, 0.7, 0.14, i % 2 === 0 ? RED : GOLD, { rough: 0.6 });
    flap.position.set(-0.9 + i * 0.45, -0.55, BODY_WIDTH * 0.52);
    flap.rotation.x = 0.35;
    body.add(flap);
    const flapB = flap.clone();
    flapB.position.z = -BODY_WIDTH * 0.52;
    flapB.rotation.x = -0.35;
    body.add(flapB);
  }

  // Tail with fur tassel
  const tail = new THREE.Group();
  tail.position.set(-BODY_LENGTH * 0.55, 0.25, 0);
  const tailBase = box(0.4, 0.28, 0.28, GOLD, { metal: 0.35 });
  tail.add(tailBase);
  const tailMid = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.35, 4, 8), mat(RED));
  tailMid.rotation.z = Math.PI / 2;
  tailMid.position.set(-0.35, 0.05, 0);
  tail.add(tailMid);
  const tailFur = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), mat(RED, { rough: 0.55 }));
  tailFur.position.set(-0.7, 0.05, 0);
  tail.add(tailFur);
  const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(GOLD, { metal: 0.35 }));
  tailTip.position.set(-0.95, 0.08, 0);
  tail.add(tailTip);
  body.add(tail);

  // ── Head (yawed toward camera so face reads in side view) ─────────
  const head = new THREE.Group();
  head.position.set(BODY_LENGTH * 0.48, 0.55, 0.15);
  head.rotation.y = 0.55; // ~31° toward +Z camera
  body.add(head);

  // Big skull
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.72, 16, 14), mat(RED, { rough: 0.45 }));
  skull.scale.set(1.15, 1.05, 1.1);
  skull.castShadow = true;
  head.add(skull);
  head.add(outline(skull, 1.06));

  const brow = box(0.95, 0.28, 0.85, DARK_RED, { rough: 0.5 });
  brow.position.set(0.25, 0.45, 0);
  head.add(brow);

  // Forehead mirror / horn
  const mirror = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.22, 0.38, 8),
    mat(GOLD, { metal: 0.6, emissive: GOLD, eInt: 0.22 }),
  );
  mirror.position.set(0.15, 0.78, 0);
  head.add(mirror);
  const hornBall = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(GOLD, { metal: 0.55 }));
  hornBall.position.set(0.15, 1.0, 0);
  head.add(hornBall);

  // Cascading mane fringe (silhouette from side)
  for (let i = 0; i < 12; i++) {
    const a = -1.1 + (i / 11) * 2.2;
    const fringe = box(0.18, 0.75 + (i % 3) * 0.08, 0.16, i % 2 === 0 ? GOLD : RED, { metal: 0.2 });
    fringe.position.set(-0.55, 0.05 + Math.cos(a) * 0.15, Math.sin(a) * 0.7);
    fringe.rotation.z = 0.45;
    head.add(fringe);
  }
  // Extra mane strips hanging under chin / back of head
  for (let i = 0; i < 5; i++) {
    const strip = box(0.14, 0.9, 0.12, GOLD, { metal: 0.25 });
    strip.position.set(-0.7, -0.35, -0.35 + i * 0.18);
    strip.rotation.z = 0.55;
    head.add(strip);
  }

  // Ears
  const leftEar = new THREE.Group();
  leftEar.position.set(0.05, 0.72, -0.55);
  const earL = box(0.28, 0.42, 0.14, RED);
  earL.rotation.z = 0.35;
  leftEar.add(earL);
  const earLIn = box(0.16, 0.25, 0.08, CREAM);
  earLIn.position.set(0.02, 0.02, -0.02);
  leftEar.add(earLIn);
  head.add(leftEar);

  const rightEar = new THREE.Group();
  rightEar.position.set(0.05, 0.72, 0.55);
  const earR = box(0.28, 0.42, 0.14, RED);
  earR.rotation.z = 0.35;
  rightEar.add(earR);
  const earRIn = box(0.16, 0.25, 0.08, CREAM);
  earRIn.position.set(0.02, 0.02, 0.02);
  rightEar.add(earRIn);
  head.add(rightEar);

  // Big expressive eyes — camera-side eye oversized for readability
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), mat(CREAM, { rough: 0.3 }));
  leftEye.position.set(0.55, 0.28, -0.38);
  head.add(leftEye);
  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(0x1a1208));
  leftPupil.position.set(0.7, 0.28, -0.38);
  head.add(leftPupil);

  const rightEye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), mat(CREAM, { rough: 0.28 }));
  rightEye.position.set(0.5, 0.3, 0.48);
  head.add(rightEye);
  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(0x1a1208));
  rightPupil.position.set(0.68, 0.3, 0.52);
  head.add(rightPupil);
  const eyeShine = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xffffff));
  eyeShine.position.set(0.72, 0.38, 0.55);
  head.add(eyeShine);

  // Wide open mouth / snout
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.85), mat(DARK_RED, { rough: 0.5 }));
  snout.position.set(0.85, -0.05, 0);
  head.add(snout);
  head.add(outline(snout as THREE.Mesh, 1.05));

  const jaw = new THREE.Group();
  jaw.position.set(0.82, -0.38, 0);
  const jawMesh = box(0.65, 0.22, 0.78, CREAM, { rough: 0.65 });
  jaw.add(jawMesh);
  for (const z of [-0.22, -0.08, 0.08, 0.22]) {
    const tooth = box(0.1, 0.18, 0.09, 0xfffaf0);
    tooth.position.set(0.22, 0.16, z);
    jaw.add(tooth);
  }
  head.add(jaw);

  // Upper fangs
  for (const z of [-0.2, 0.2]) {
    const fang = box(0.09, 0.22, 0.09, 0xfffaf0);
    fang.position.set(1.05, -0.12, z);
    head.add(fang);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(0x2a1810));
  nose.position.set(1.18, 0.12, 0);
  head.add(nose);

  // Cheek pompoms (醒獅 classic)
  for (const z of [-0.62, 0.62]) {
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 10),
      mat(GOLD, { metal: 0.35, emissive: GOLD, eInt: 0.12 }),
    );
    cheek.position.set(0.35, -0.12, z);
    head.add(cheek);
  }

  // 花花 + drum on crown
  const flower = buildFlower();
  flower.position.set(-0.1, 0.95, 0.1);
  flower.scale.setScalar(1.15);
  head.add(flower);

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.16, 14), mat(RED));
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0.4, 0.85, 0.35);
  head.add(drum);
  const drumSkin = new THREE.Mesh(new THREE.CircleGeometry(0.175, 14), mat(CREAM));
  drumSkin.rotation.y = Math.PI / 2;
  drumSkin.position.set(0.485, 0.85, 0.35);
  head.add(drumSkin);

  const legs = {} as Record<LegId, THREE.Group>;
  for (const id of LEG_IDS) {
    const leg = buildLeg(id);
    const a = LEG_ATTACH[id];
    leg.position.set(a.x, -0.2, a.z);
    body.add(leg);
    legs[id] = leg;
  }

  root.position.y = BODY_HEIGHT;
  return {
    root,
    body,
    head,
    legs,
    flower,
    shadow,
    leftEye,
    rightEye,
    leftEar,
    rightEar,
    tail,
    jaw,
  };
}

function buildLeg(id: LegId): THREE.Group {
  const g = new THREE.Group();
  g.name = id;
  const color = LEG_COLOR[id];

  const thigh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.2, 0.48, 4, 12),
    mat(RED, { rough: 0.5 }),
  );
  thigh.position.y = -0.38;
  g.add(thigh);
  g.add(outline(thigh, 1.08));

  const shin = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.42, 4, 12),
    mat(DARK_RED, { rough: 0.55 }),
  );
  shin.position.y = -1.0;
  shin.name = 'shin';
  g.add(shin);

  // Thick colour anklet band
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.09, 8, 18),
    mat(color, { metal: 0.25, emissive: color, eInt: 0.35 }),
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = -1.22;
  band.name = 'band';
  g.add(band);

  // Boot / paw
  const foot = box(0.55, 0.22, 0.38, color, { metal: 0.15, emissive: color, eInt: 0.18 });
  foot.position.set(0.12, -1.42, 0);
  foot.name = 'foot';
  g.add(foot);

  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), mat(GOLD, { metal: 0.45 }));
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -0.72;
  g.add(cuff);

  return g;
}

function buildFlower(): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(FLOWER_PINK));
  g.add(head);
  for (let i = 0; i < 6; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(FLOWER_PINK));
    const a = (i / 6) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.16, 0.04, Math.sin(a) * 0.16);
    g.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(FLOWER_YELLOW));
  center.position.y = 0.12;
  g.add(center);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), mat(GREEN));
  body.position.y = -0.2;
  g.add(body);
  // Drumstick arm
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.22, 3, 6), mat(FLOWER_PINK));
  arm.position.set(0.18, -0.08, 0.12);
  arm.rotation.z = -0.9;
  g.add(arm);
  const stick = box(0.28, 0.04, 0.04, WOOD);
  stick.position.set(0.32, 0.02, 0.2);
  stick.rotation.z = -0.5;
  g.add(stick);
  return g;
}

export function buildGhostMarker(): THREE.Group {
  const g = new THREE.Group();
  const pole = box(0.08, 1.6, 0.08, GOLD, { metal: 0.35 });
  pole.position.y = 0.8;
  g.add(pole);
  const flag = box(0.6, 0.32, 0.04, RED);
  flag.position.set(0.32, 1.4, 0);
  g.add(flag);
  g.visible = false;
  return g;
}

export function buildStreet(scene: THREE.Scene, reducedMotion: boolean): {
  lanterns: THREE.Object3D[];
  gate: THREE.Group;
  envelope: THREE.Group;
  confetti: THREE.Points | null;
  sparkBurst: THREE.Points | null;
  hills: THREE.Object3D[];
} {
  // Bright sky (no heavy fog — set on scene separately)
  const skyGeo = new THREE.SphereGeometry(90, 20, 14);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(SKY_TOP) },
      bot: { value: new THREE.Color(SKY_BOT) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 top;
      uniform vec3 bot;
      varying vec3 vPos;
      void main() {
        float t = clamp(vPos.y / 40.0 + 0.35, 0.0, 1.0);
        gl_FragColor = vec4(mix(bot, top, t), 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Layered distant hills (background, -Z from camera side view)
  const hills: THREE.Object3D[] = [];
  for (let layer = 0; layer < 3; layer++) {
    const hill = new THREE.Mesh(
      new THREE.CapsuleGeometry(8 + layer * 3, 4 + layer * 2, 4, 12),
      mat(HILL - layer * 0x101010, { rough: 0.95 }),
    );
    hill.scale.set(3.5 - layer * 0.4, 0.55, 1);
    hill.position.set(TRACK_LENGTH * 0.35 + layer * 8, 1.2 + layer * 0.4, -14 - layer * 5);
    scene.add(hill);
    hills.push(hill);
  }
  // Distant rooftops
  for (let i = 0; i < 6; i++) {
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.8, 1.2, 4),
      mat(i % 2 === 0 ? DARK_RED : GOLD, { metal: 0.15 }),
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(5 + i * 7, 2.8, -16);
    scene.add(roof);
    const wall = box(2.2, 1.6, 1.4, CREAM, { rough: 0.9 });
    wall.position.set(5 + i * 7, 1.6, -16);
    scene.add(wall);
  }

  // Street ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_LENGTH + 40, 18),
    mat(STREET, { rough: 0.92 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(TRACK_LENGTH / 2, 0, -2);
  ground.receiveShadow = true;
  scene.add(ground);

  // Center parade path
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_LENGTH + 6, 3.2),
    mat(0xd4563a, { rough: 0.8 }),
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(TRACK_LENGTH / 2, 0.015, 0);
  scene.add(carpet);

  // Background fence (behind lion, -Z) — never occludes
  for (let x = -2; x <= TRACK_LENGTH + 4; x += 1.4) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.5, 6), mat(0xf5f0e6));
    post.position.set(x, 0.75, -5.5);
    scene.add(post);
  }
  const rail = box(TRACK_LENGTH + 8, 0.08, 0.08, 0xf5f0e6);
  rail.position.set(TRACK_LENGTH / 2, 1.2, -5.5);
  scene.add(rail);
  const rail2 = rail.clone();
  rail2.position.y = 0.55;
  scene.add(rail2);

  // Lantern strings — BACKGROUND only (z <= -6)
  const lanterns: THREE.Object3D[] = [];
  for (let i = 0; i <= TRACK_LENGTH; i += 6) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.6, 6), mat(WOOD));
    pole.position.set(i, 1.8, -7.2);
    scene.add(pole);

    const lantern = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), mat(RED, { rough: 0.45, emissive: RED, eInt: 0.2 }));
    paper.scale.set(1, 1.3, 1);
    lantern.add(paper);
    if (!reducedMotion) {
      const glow = new THREE.PointLight(0xffaa44, 0.45, 5, 2);
      lantern.add(glow);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.1, 8), mat(GOLD, { metal: 0.4 }));
    top.position.y = 0.38;
    lantern.add(top);
    lantern.position.set(i, 3.3, -7.2);
    scene.add(lantern);
    lanterns.push(lantern);

    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 1.3),
      mat(i % 12 === 0 ? GOLD : RED),
    );
    banner.position.set(i + 0.4, 1.7, -6.9);
    scene.add(banner);
  }

  // Sparse low foreground markers (z > 0, short — won't block lion)
  for (let m = 10; m < TRACK_LENGTH; m += 10) {
    const tick = box(0.2, 0.08, 3.4, GOLD);
    tick.position.set(m, 0.04, 0);
    scene.add(tick);
    const plate = box(0.7, 0.4, 0.08, CREAM, { rough: 0.85 });
    plate.position.set(m, 0.55, 2.4);
    scene.add(plate);
    const num = box(0.35, 0.12, 0.09, RED);
    num.position.set(m, 0.55, 2.45);
    scene.add(num);
  }

  // Start line
  const startLine = box(0.2, 0.06, 3.4, RED);
  startLine.position.set(-0.3, 0.04, 0);
  scene.add(startLine);

  // Temple gate at finish
  const gate = new THREE.Group();
  gate.position.set(TRACK_LENGTH + 2.2, 0, 0);

  const pillarL = box(0.55, 5.2, 0.55, RED);
  pillarL.position.set(0, 2.6, -2.6);
  gate.add(pillarL);
  const pillarR = pillarL.clone();
  pillarR.position.z = 2.6;
  gate.add(pillarR);

  const beam = box(0.6, 0.55, 6.2, GOLD, { metal: 0.35 });
  beam.position.set(0, 4.9, 0);
  gate.add(beam);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.4, 4), mat(DARK_RED));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 6.0, 0);
  gate.add(roof);

  const plaque = box(0.18, 0.85, 2.4, GOLD, { metal: 0.45 });
  plaque.position.set(-0.25, 4.0, 0);
  gate.add(plaque);

  // Goal arch ribbons
  for (const z of [-1.8, 1.8]) {
    const ribbon = box(0.12, 2.2, 0.08, GOLD, { metal: 0.3 });
    ribbon.position.set(-0.8, 3.2, z);
    gate.add(ribbon);
  }
  scene.add(gate);

  // Hanging 青 / red envelope — clearly visible
  const envelope = new THREE.Group();
  envelope.position.set(TRACK_LENGTH + 0.3, 4.2, 0);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), mat(0x333333));
  string.position.y = 0.55;
  envelope.add(string);
  const pack = box(0.55, 0.75, 0.12, RED, { emissive: RED, eInt: 0.15 });
  pack.position.y = -0.2;
  envelope.add(pack);
  const seal = box(0.18, 0.18, 0.14, GOLD, { metal: 0.5 });
  seal.position.y = -0.05;
  envelope.add(seal);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(GREEN));
  leaf.scale.set(1, 0.5, 0.4);
  leaf.position.set(0, -0.75, 0);
  envelope.add(leaf);
  scene.add(envelope);

  let confetti: THREE.Points | null = null;
  let sparkBurst: THREE.Points | null = null;
  if (!reducedMotion) {
    const count = 240;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color(RED), new THREE.Color(GOLD), new THREE.Color(CREAM), new THREE.Color(0xff6644)];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = TRACK_LENGTH + (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = 2.5 + Math.random() * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
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
      new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0 }),
    );
    confetti.visible = false;
    scene.add(confetti);

    const sparkN = 100;
    const sparkPos = new Float32Array(sparkN * 3);
    const sparkCol = new Float32Array(sparkN * 3);
    for (let i = 0; i < sparkN; i++) {
      sparkPos[i * 3] = TRACK_LENGTH;
      sparkPos[i * 3 + 1] = 3;
      sparkPos[i * 3 + 2] = 0;
      sparkCol[i * 3] = 1;
      sparkCol[i * 3 + 1] = 0.8;
      sparkCol[i * 3 + 2] = 0.25;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
    sparkBurst = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0 }),
    );
    sparkBurst.visible = false;
    scene.add(sparkBurst);
  }

  return { lanterns, gate, envelope, confetti, sparkBurst, hills };
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
    // High visible lift + forward swing (side view reads as rotation around Z visually via X rot)
    leg.rotation.x = -S * 1.05;
    leg.position.y = -0.2 + L * 0.85;
    const shin = leg.getObjectByName('shin');
    if (shin) shin.rotation.x = L * 0.85;
    const foot = leg.getObjectByName('foot');
    if (foot) foot.rotation.x = -L * 0.35;
  }
}
