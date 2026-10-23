/**
 * Procedural 醒獅 + temple street (v4).
 * Organic spheres/capsules, toon outlines, jointed legs, bright pastel scene.
 */

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

const RED = 0xe23a2e;
const DARK_RED = 0xb02820;
const GOLD = 0xf0c14b;
const CREAM = 0xfff6e4;
const WOOD = 0xc4a574;
const GREEN = 0x7cbc6e;
const HILL_A = 0xb8e0a8;
const HILL_B = 0x9fd48c;
const STREET = 0xf3e6c8;
const SKY_TOP = 0xb8e4f8;
const SKY_BOT = 0xfff0d4;
const BOOT = 0x2c2118;
const OUTLINE = 0x3a2010;

const matCache = new Map<string, THREE.MeshStandardMaterial>();
const basicCache = new Map<string, THREE.MeshBasicMaterial>();

function mat(
  color: number,
  opts?: { rough?: number; metal?: number; emissive?: number; eInt?: number },
): THREE.MeshStandardMaterial {
  const rough = opts?.rough ?? 0.55;
  const metal = opts?.metal ?? 0.06;
  const emissive = opts?.emissive ?? 0;
  const eInt = opts?.eInt ?? 0;
  const key = `s|${color}|${rough}|${metal}|${emissive}|${eInt}`;
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

function basic(color: number, opacity = 1): THREE.MeshBasicMaterial {
  const key = `b|${color}|${opacity}`;
  let m = basicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    basicCache.set(key, m);
  }
  return m;
}

function addOutline(parent: THREE.Object3D, mesh: THREE.Mesh, scale = 1.07): void {
  const o = new THREE.Mesh(mesh.geometry, basic(OUTLINE));
  o.scale.setScalar(scale);
  o.renderOrder = -1;
  ;(o.material as THREE.MeshBasicMaterial).side = THREE.BackSide;
  parent.add(o);
}

export interface LegMeshes {
  root: THREE.Group;
  thigh: THREE.Object3D;
  shin: THREE.Object3D;
  foot: THREE.Object3D;
  knee: THREE.Object3D;
}

export interface LionMeshes {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  headHomeY: number;
  legs: Record<LegId, LegMeshes>;
  flower: THREE.Group;
  flowerHome: THREE.Vector3;
  shadow: THREE.Mesh;
  leftEye: THREE.Object3D;
  rightEye: THREE.Object3D;
  leftEar: THREE.Object3D;
  rightEar: THREE.Object3D;
  tail: THREE.Object3D;
  jaw: THREE.Object3D;
  mouthSmile: THREE.Object3D;
  mouthO: THREE.Object3D;
  dust: THREE.Points | null;
}

export function buildLion(): LionMeshes {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 28),
    basic(0x000000, 0.16),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  // Soft draped body — high, compact belly so trousers show a clear gap under it
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 14), mat(RED, { rough: 0.48 }));
  torso.scale.set(1.65, 0.7, 0.82);
  torso.position.set(0, 0.7, 0);
  body.add(torso);
  addOutline(body, torso, 1.05);

  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.58, 16, 12), mat(RED, { rough: 0.48 }));
  chest.scale.set(1.0, 0.8, 0.85);
  chest.position.set(0.95, 0.72, 0);
  body.add(chest);

  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.56, 16, 12), mat(DARK_RED, { rough: 0.52 }));
  rump.scale.set(0.95, 0.75, 0.85);
  rump.position.set(-0.95, 0.68, 0);
  body.add(rump);

  // Gold trim ribbons (along flanks, above the legs)
  for (const z of [-0.42, 0.42]) {
    const ribbon = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.05, BODY_LENGTH * 0.65, 3, 8),
      mat(GOLD, { metal: 0.45, emissive: GOLD, eInt: 0.1 }),
    );
    ribbon.rotation.z = Math.PI / 2;
    ribbon.position.set(0, 0.85, z);
    body.add(ribbon);
  }

  // Spine pompoms
  for (let i = 0; i < 5; i++) {
    const pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8),
      mat(i % 2 === 0 ? GOLD : 0xffe8a8, { metal: 0.35, emissive: GOLD, eInt: 0.08 }),
    );
    pom.position.set(-0.9 + i * 0.45, 1.0, 0);
    body.add(pom);
  }

  // Curly tail
  const tail = new THREE.Group();
  tail.position.set(-BODY_LENGTH * 0.52, 0.35, 0);
  let prev: THREE.Object3D = tail;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(0.2 - i * 0.015, 10, 8),
      mat(i === 4 ? GOLD : RED, { rough: 0.5 }),
    );
    seg.position.set(-0.22 - i * 0.02, Math.sin(i * 0.9) * 0.12, Math.cos(i) * 0.04);
    prev.add(seg);
    prev = seg;
  }
  body.add(tail);

  // ── Head: kawaii 醒獅, face on camera (+Z), snout toward travel (+X) ─
  const headHomeY = 0.95;
  const head = new THREE.Group();
  head.position.set(BODY_LENGTH * 0.48, headHomeY, 0.12);
  head.rotation.y = 0.32;
  body.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(1.02, 24, 20), mat(RED, { rough: 0.42 }));
  head.add(skull);
  addOutline(head, skull, 1.04);

  // Soft fluffy mane — rounded tufts (red / orange / gold), denser ring
  const maneColors = [RED, 0xf97316, GOLD, 0xe23a2e, 0xffb347];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    if (Math.cos(a) > 0.78) continue; // leave face clear
    const tuft = new THREE.Mesh(
      new THREE.SphereGeometry(0.22 + (i % 3) * 0.04, 10, 8),
      mat(maneColors[i % maneColors.length]!, { rough: 0.55 }),
    );
    tuft.scale.set(0.9, 1.2, 0.9);
    tuft.position.set(Math.sin(a) * 1.0, Math.sin(a * 2) * 0.1 + 0.2, Math.cos(a) * 1.0);
    head.add(tuft);
  }
  for (let i = 0; i < 6; i++) {
    const tuft = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 8),
      mat(i % 2 === 0 ? GOLD : 0xf97316, { rough: 0.5 }),
    );
    tuft.position.set(-0.2 + i * 0.12, 1.0, 0.4 - Math.abs(i - 2.5) * 0.06);
    head.add(tuft);
  }

  // Gold forehead ornament
  const browPlate = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 12),
    mat(GOLD, { metal: 0.55, emissive: GOLD, eInt: 0.3 }),
  );
  browPlate.scale.set(1.2, 0.4, 0.85);
  browPlate.position.set(0.1, 0.72, 0.7);
  head.add(browPlate);
  const browGem = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 8),
    mat(0xff6b6b, { metal: 0.35, emissive: 0xff6b6b, eInt: 0.3 }),
  );
  browGem.position.set(0.12, 0.74, 0.88);
  head.add(browGem);

  // Short rounded ears
  const leftEar = new THREE.Group();
  leftEar.position.set(-0.2, 0.85, -0.55);
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(RED));
  earL.scale.set(0.55, 1.05, 0.5);
  leftEar.add(earL);
  const earLin = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(0xffb7c5));
  earLin.scale.set(0.5, 0.95, 0.35);
  earLin.position.set(0.03, 0.02, -0.02);
  leftEar.add(earLin);
  head.add(leftEar);

  const rightEar = new THREE.Group();
  rightEar.position.set(-0.15, 0.88, 0.55);
  const earR = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(RED));
  earR.scale.set(0.55, 1.05, 0.5);
  rightEar.add(earR);
  const earRin = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), mat(0xffb7c5));
  earRin.scale.set(0.5, 0.95, 0.35);
  earRin.position.set(0.03, 0.02, 0.02);
  rightEar.add(earRin);
  head.add(rightEar);

  // Kawaii eyes — tall glossy dark ovals, flush, set low & wide
  function makeEye(x: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, -0.02, 0.99);
    const oval = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 12),
      mat(0x1a1208, { rough: 0.16, metal: 0.12 }),
    );
    oval.scale.set(0.68, 1.25, 0.38);
    g.add(oval);
    const lid = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.04, 6, 14, Math.PI * 0.95),
      mat(0x3a2010, { rough: 0.5 }),
    );
    lid.rotation.x = Math.PI / 2;
    lid.rotation.z = Math.PI;
    lid.position.set(0, 0.15, 0.05);
    lid.scale.set(0.85, 1, 0.7);
    g.add(lid);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), basic(0xffffff));
    h1.position.set(0.045, 0.07, 0.1);
    g.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 5), basic(0xffffff));
    h2.position.set(-0.05, -0.05, 0.09);
    g.add(h2);
    return g;
  }
  const leftEye = makeEye(-0.42);
  const rightEye = makeEye(0.42);
  head.add(leftEye);
  head.add(rightEye);

  // Rosy blush cheeks
  for (const x of [-0.58, 0.58]) {
    const blush = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 8),
      mat(0xff8fab, { rough: 0.6, emissive: 0xff8fab, eInt: 0.28 }),
    );
    blush.scale.set(1.15, 0.65, 0.32);
    blush.position.set(x, -0.22, 0.9);
    head.add(blush);
  }

  // Small round nose + tiny friendly smile
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(0x2a1810));
  nose.position.set(0.12, -0.18, 1.06);
  head.add(nose);

  const jaw = new THREE.Group();
  jaw.position.set(0.1, -0.42, 0.96);
  head.add(jaw);

  const mouthSmile = new THREE.Group();
  // Curved smile via short torus arc
  const smileArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.035, 6, 16, Math.PI * 0.9),
    mat(0x2a1810, { rough: 0.55 }),
  );
  smileArc.rotation.x = Math.PI / 2;
  smileArc.rotation.z = Math.PI;
  smileArc.scale.set(1.15, 1, 0.7);
  mouthSmile.add(smileArc);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xff6b8a, { rough: 0.4 }));
  tongue.scale.set(1.1, 0.55, 0.7);
  tongue.position.set(0.02, -0.06, 0.04);
  mouthSmile.add(tongue);
  jaw.add(mouthSmile);

  // Surprised 'O' mouth (hidden until fall)
  const mouthO = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 10),
    mat(0x2a1810, { rough: 0.55 }),
  );
  mouthO.scale.set(0.85, 1.05, 0.55);
  mouthO.position.set(0.02, -0.02, 0.02);
  mouthO.visible = false;
  jaw.add(mouthO);

  // Soft snout hint toward travel (keeps profile readable, doesn't hide face)
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), mat(DARK_RED, { rough: 0.5 }));
  snout.scale.set(1.1, 0.75, 0.85);
  snout.position.set(0.85, -0.05, 0.2);
  head.add(snout);

  // 花花 + drum on top / behind — face unobstructed
  const flower = buildFlower();
  const flowerHome = new THREE.Vector3(-0.4, 1.15, 0.1);
  flower.position.copy(flowerHome);
  flower.scale.setScalar(1.1);
  head.add(flower);

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.18, 16), mat(RED));
  drum.rotation.z = Math.PI / 2;
  drum.position.set(-0.45, 1.05, -0.4);
  head.add(drum);
  const drumSkin = new THREE.Mesh(new THREE.CircleGeometry(0.195, 16), mat(CREAM));
  drumSkin.rotation.y = Math.PI / 2;
  drumSkin.position.set(-0.35, 1.05, -0.4);
  head.add(drumSkin);

  // Slender jointed legs — clear of the belly
  const legs = {} as Record<LegId, LegMeshes>;
  for (const id of LEG_IDS) {
    const leg = buildLeg(id);
    const a = LEG_ATTACH[id];
    leg.root.position.set(a.x, -0.4, a.z);
    leg.root.renderOrder = 5;
    leg.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.renderOrder = 5;
    });
    body.add(leg.root);
    legs[id] = leg;
  }

  // Dust puff (hidden until fall)
  let dust: THREE.Points | null = null;
  {
    const n = 48;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.2;
      pos[i * 3 + 1] = Math.random() * 0.1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xe8d4a8,
        size: 0.18,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    dust.visible = false;
    root.add(dust);
  }

  // Invisible core AABB for camera framing checks (excludes fluffy mane / outlines)
  const frameCore = new THREE.Mesh(
    new THREE.BoxGeometry(BODY_LENGTH + 2.2, BODY_HEIGHT + 0.55, BODY_WIDTH + 0.7),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  frameCore.name = 'frameCore';
  frameCore.position.set(0.15, -0.35, 0);
  root.add(frameCore);

  root.position.y = BODY_HEIGHT;
  return {
    root,
    body,
    head,
    headHomeY,
    legs,
    flower,
    flowerHome,
    shadow,
    leftEye,
    rightEye,
    leftEar,
    rightEar,
    tail,
    jaw,
    mouthSmile,
    mouthO,
    dust,
  };
}

/** Tapered cylinder helper — avoids fat uniform-capsule “pillar” look. */
function taper(rTop: number, rBot: number, len: number, segs = 12): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(rTop, rBot, len, segs);
}

function buildLeg(id: LegId): LegMeshes {
  const root = new THREE.Group();
  root.name = id;
  const color = LEG_COLOR[id];

  const thigh = new THREE.Group();
  thigh.position.y = 0;
  root.add(thigh);

  // Slender ruffled trousers on thigh only (≈40% thinner than fat-pillar pass)
  const thighMesh = new THREE.Mesh(
    taper(0.155, 0.115, 1.05, 14),
    mat(color, { rough: 0.5, emissive: color, eInt: 0.14 }),
  );
  thighMesh.position.y = -0.6;
  thigh.add(thighMesh);
  // Soft fabric folds (subtle — avoid “stacked white rings” look)
  for (const y of [-0.4, -0.75]) {
    const ruffle = new THREE.Mesh(
      taper(0.165, 0.15, 0.04, 12),
      mat(color, { rough: 0.55, emissive: color, eInt: 0.05 }),
    );
    ruffle.position.y = y;
    thigh.add(ruffle);
  }
  const hipPuff = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(color, { rough: 0.5 }));
  hipPuff.scale.set(1.15, 0.65, 1.15);
  hipPuff.position.set(0.02, -0.06, 0);
  thigh.add(hipPuff);

  // Small round knee (reads as the joint)
  const knee = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 10),
    mat(0xffe8c8, { rough: 0.45, emissive: 0xffe8c8, eInt: 0.1 }),
  );
  knee.position.y = -1.2;
  thigh.add(knee);

  const shin = new THREE.Group();
  shin.position.y = -1.22;
  thigh.add(shin);

  // Clean tapered shin — soft fabric beige (NOT dark pole brown)
  const shinMesh = new THREE.Mesh(
    taper(0.1, 0.075, 0.85, 12),
    mat(0xe8d4b0, { rough: 0.55 }),
  );
  shinMesh.position.y = -0.45;
  shin.add(shinMesh);

  // Coloured anklet band
  const anklet = new THREE.Mesh(
    taper(0.11, 0.11, 0.09, 12),
    mat(color, { metal: 0.2, emissive: color, eInt: 0.6 }),
  );
  anklet.position.y = -0.88;
  shin.add(anklet);

  const foot = new THREE.Group();
  foot.position.y = -0.98;
  shin.add(foot);

  // Smaller neat dark boot + slight toe
  const boot = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.14, 0.22),
    mat(BOOT, { rough: 0.65 }),
  );
  boot.position.set(0.07, -0.02, 0);
  foot.add(boot);
  const toe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), mat(BOOT, { rough: 0.65 }));
  toe.scale.set(1.35, 0.6, 0.95);
  toe.position.set(0.24, -0.01, 0);
  foot.add(toe);

  return { root, thigh, shin, foot, knee };
}

function buildFlower(): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), mat(0xf2a0b8));
  g.add(head);
  for (let i = 0; i < 6; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), mat(0xf2a0b8));
    const a = (i / 6) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.15, 0.04, Math.sin(a) * 0.15);
    g.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), mat(0xffe066));
  center.position.y = 0.12;
  g.add(center);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.14, 4, 8), mat(GREEN));
  body.position.y = -0.18;
  g.add(body);
  const stick = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.22, 3, 6), mat(WOOD));
  stick.position.set(0.18, 0.02, 0.12);
  stick.rotation.z = -0.7;
  g.add(stick);
  return g;
}

/**
 * FK pose — slender performer legs that scissor in the side-view plane.
 * Rotations are around Z (XY / track plane) so knee bend is visible from +Z camera.
 * Lift: thigh ~45° forward, shin folds ~70°; plant: nearly straight.
 */
export function applyLegPose(
  legs: Record<LegId, LegMeshes>,
  lift: Record<LegId, number>,
  swing: Record<LegId, number>,
  flailT = 0,
  fallen = false,
): void {
  const DEG = Math.PI / 180;
  for (const id of LEG_IDS) {
    const leg = legs[id];
    const L = Math.min(1, lift[id] ?? 0);
    const S = swing[id] ?? 0;
    if (fallen && flailT > 0) {
      const phase = flailT * (3.6 + LEG_ATTACH[id].x * 0.4) + LEG_ATTACH[id].z * 7;
      const kick = 0.55 + 0.7 * Math.abs(Math.sin(phase));
      leg.root.position.y = -0.1 + Math.abs(Math.sin(phase * 0.8)) * 0.3;
      // Flail in-plane + a little out-of-plane for volume
      leg.thigh.rotation.z = Math.sin(phase) * 0.9;
      leg.thigh.rotation.x = Math.cos(phase * 0.85) * 0.35;
      leg.thigh.rotation.y = Math.sin(phase * 0.6) * 0.25;
      leg.shin.rotation.z = -kick * 1.2;
      leg.shin.rotation.x = 0;
      leg.foot.rotation.z = kick * 0.35;
      continue;
    }
    // Clear depth rotations — bend must read in the side view
    leg.thigh.rotation.x = 0;
    leg.thigh.rotation.y = 0;
    leg.shin.rotation.x = 0;
    // Thigh swings forward along +X (~45° at full lift) + gait scissor
    leg.thigh.rotation.z = S * 0.45 + L * 45 * DEG;
    // Shin folds the OPPOSITE way so the foot drops into a dog-leg (not up)
    leg.shin.rotation.z = -(12 * DEG + L * 70 * DEG);
    leg.foot.rotation.z = L * 15 * DEG;
    leg.foot.rotation.x = 0;
    leg.root.position.y = -0.4 + L * 0.55;
  }
}

export function buildGhostMarker(): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), mat(GOLD, { metal: 0.3 }));
  pole.position.y = 0.7;
  g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.3), mat(RED));
  flag.position.set(0.28, 1.25, 0);
  g.add(flag);
  g.visible = false;
  return g;
}

export function buildStreet(
  scene: THREE.Scene,
  reducedMotion: boolean,
): {
  lanterns: THREE.Object3D[];
  gate: THREE.Group;
  envelope: THREE.Group;
  confetti: THREE.Points | null;
  sparkBurst: THREE.Points | null;
  hills: THREE.Object3D[];
} {
  // Bright sky
  const skyGeo = new THREE.SphereGeometry(90, 16, 12);
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
        float t = clamp(vPos.y / 45.0 + 0.4, 0.0, 1.0);
        gl_FragColor = vec4(mix(bot, top, t), 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Soft cream/light-green hills
  const hills: THREE.Object3D[] = [];
  for (let layer = 0; layer < 3; layer++) {
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(10 + layer * 2, 16, 10),
      mat(layer === 0 ? HILL_A : HILL_B, { rough: 0.95 }),
    );
    hill.scale.set(2.8 - layer * 0.3, 0.45, 1);
    hill.position.set(TRACK_LENGTH * 0.3 + layer * 10, 0.8 + layer * 0.3, -16 - layer * 4);
    scene.add(hill);
    hills.push(hill);
  }

  // Pastel distant rooftops
  for (let i = 0; i < 5; i++) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.4, 1.2), mat(CREAM, { rough: 0.9 }));
    wall.position.set(8 + i * 8, 1.4, -18);
    scene.add(wall);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 1.0, 4),
      mat(i % 2 === 0 ? 0xe8a090 : 0xe8c878, { rough: 0.7 }),
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.set(8 + i * 8, 2.5, -18);
    scene.add(roof);
  }

  // Light sandy street (no heavy red carpet)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_LENGTH + 40, 20),
    mat(STREET, { rough: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(TRACK_LENGTH / 2, 0, -2);
  scene.add(ground);

  // Thin soft path (lighter than lion red)
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_LENGTH + 6, 3.6),
    mat(0xe8d8b0, { rough: 0.9 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(TRACK_LENGTH / 2, 0.012, 0);
  scene.add(path);

  // Thin red runner edges only
  for (const z of [-1.75, 1.75]) {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_LENGTH + 6, 0.12),
      mat(0xe07060, { rough: 0.8 }),
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(TRACK_LENGTH / 2, 0.018, z);
    scene.add(edge);
  }

  // Background white fence
  const fenceMat = mat(0xfaf6ee, { rough: 0.85 });
  for (let x = -2; x <= TRACK_LENGTH + 4; x += 1.5) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.4, 5), fenceMat);
    post.position.set(x, 0.7, -5.8);
    scene.add(post);
  }
  const railGeo = new THREE.BoxGeometry(TRACK_LENGTH + 8, 0.07, 0.07);
  const rail = new THREE.Mesh(railGeo, fenceMat);
  rail.position.set(TRACK_LENGTH / 2, 1.15, -5.8);
  scene.add(rail);
  const rail2 = rail.clone();
  rail2.position.y = 0.5;
  scene.add(rail2);

  // Sparse high lantern strings (background)
  const lanterns: THREE.Object3D[] = [];
  for (let i = 0; i <= TRACK_LENGTH; i += 8) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.8, 5), mat(WOOD));
    pole.position.set(i, 1.9, -7.5);
    scene.add(pole);
    const lantern = new THREE.Group();
    const paper = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      mat(RED, { rough: 0.45, emissive: RED, eInt: 0.15 }),
    );
    paper.scale.set(1, 1.25, 1);
    lantern.add(paper);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.08, 6), mat(GOLD, { metal: 0.4 }));
    top.position.y = 0.32;
    lantern.add(top);
    lantern.position.set(i, 3.5, -7.5);
    scene.add(lantern);
    lanterns.push(lantern);
  }

  // Distance markers every 10m
  for (let m = 10; m < TRACK_LENGTH; m += 10) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 3.2), mat(GOLD));
    tick.position.set(m, 0.04, 0);
    scene.add(tick);
  }

  // Temple gate (pastel)
  const gate = new THREE.Group();
  gate.position.set(TRACK_LENGTH + 2.2, 0, 0);
  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5.0, 0.5), mat(0xe07060));
  pillarL.position.set(0, 2.5, -2.5);
  gate.add(pillarL);
  const pillarR = pillarL.clone();
  pillarR.position.z = 2.5;
  gate.add(pillarR);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 5.8), mat(GOLD, { metal: 0.3 }));
  beam.position.set(0, 4.7, 0);
  gate.add(beam);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.2, 4), mat(0xd4563a));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 5.7, 0);
  gate.add(roof);
  scene.add(gate);

  // 採青 envelope
  const envelope = new THREE.Group();
  envelope.position.set(TRACK_LENGTH + 0.3, 4.0, 0);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), mat(0x555555));
  string.position.y = 0.5;
  envelope.add(string);
  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.7, 0.1),
    mat(RED, { emissive: RED, eInt: 0.12 }),
  );
  pack.position.y = -0.2;
  envelope.add(pack);
  const seal = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.12), mat(GOLD, { metal: 0.45 }));
  seal.position.y = -0.05;
  envelope.add(seal);
  scene.add(envelope);

  let confetti: THREE.Points | null = null;
  let sparkBurst: THREE.Points | null = null;
  if (!reducedMotion) {
    const count = 160;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [new THREE.Color(RED), new THREE.Color(GOLD), new THREE.Color(CREAM)];
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
      new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0 }),
    );
    confetti.visible = false;
    scene.add(confetti);

    const sparkN = 64;
    const sparkPos = new Float32Array(sparkN * 3);
    const sparkCol = new Float32Array(sparkN * 3);
    for (let i = 0; i < sparkN; i++) {
      sparkPos[i * 3] = TRACK_LENGTH;
      sparkPos[i * 3 + 1] = 3;
      sparkPos[i * 3 + 2] = 0;
      sparkCol[i * 3] = 1;
      sparkCol[i * 3 + 1] = 0.85;
      sparkCol[i * 3 + 2] = 0.3;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
    sparkBurst = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({ size: 0.1, vertexColors: true, transparent: true, opacity: 0 }),
    );
    sparkBurst.visible = false;
    scene.add(sparkBurst);
  }

  return { lanterns, gate, envelope, confetti, sparkBurst, hills };
}

// Keep BODY_WIDTH referenced for lint unused in case attach uses length only
void BODY_WIDTH;
