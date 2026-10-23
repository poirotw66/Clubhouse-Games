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
  cloth: THREE.Group;
  frontHump: THREE.Object3D;
  rearHump: THREE.Object3D;
  frontHumpHomeY: number;
  rearHumpHomeY: number;
  hem: THREE.Group;
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
    new THREE.CircleGeometry(2.4, 32),
    basic(0x000000, 0.16),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  shadow.scale.set(1.55, 1, 0.7);
  root.add(shadow);

  // ── Long draped cloth body (performers' blanket) — 2 humps ───────────
  const cloth = new THREE.Group();
  body.add(cloth);

  // Long belly / blanket mass (red, elongated)
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.95, 22, 16), mat(RED, { rough: 0.48 }));
  belly.scale.set(BODY_LENGTH * 0.48, 0.72, 0.78);
  belly.position.set(0, 0.55, 0);
  cloth.add(belly);
  addOutline(cloth, belly, 1.04);

  // Front performer hump (tall, rounded)
  const frontHumpHomeY = 1.05;
  const frontHump = new THREE.Group();
  frontHump.position.set(BODY_LENGTH * 0.28, frontHumpHomeY, 0);
  cloth.add(frontHump);
  const fhMain = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 14), mat(RED, { rough: 0.45 }));
  fhMain.scale.set(1.05, 1.15, 0.95);
  frontHump.add(fhMain);
  addOutline(frontHump, fhMain, 1.05);
  const fhCap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), mat(DARK_RED, { rough: 0.5 }));
  fhCap.scale.set(1.1, 0.7, 1);
  fhCap.position.set(0.1, 0.45, 0);
  frontHump.add(fhCap);

  // Rear performer hump
  const rearHumpHomeY = 0.98;
  const rearHump = new THREE.Group();
  rearHump.position.set(-BODY_LENGTH * 0.28, rearHumpHomeY, 0);
  cloth.add(rearHump);
  const rhMain = new THREE.Mesh(new THREE.SphereGeometry(0.68, 18, 14), mat(RED, { rough: 0.48 }));
  rhMain.scale.set(1.0, 1.1, 0.95);
  rearHump.add(rhMain);
  addOutline(rearHump, rhMain, 1.05);
  const rhCap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), mat(DARK_RED, { rough: 0.52 }));
  rhCap.scale.set(1.05, 0.65, 1);
  rhCap.position.set(-0.08, 0.4, 0);
  rearHump.add(rhCap);

  // Soft saddle dip between humps
  const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 12), mat(DARK_RED, { rough: 0.55 }));
  saddle.scale.set(1.6, 0.55, 0.9);
  saddle.position.set(0, 0.85, 0);
  cloth.add(saddle);

  // Gold trim bands along flanks + spine
  for (const z of [-0.55, 0.55]) {
    const ribbon = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.055, BODY_LENGTH * 0.72, 3, 8),
      mat(GOLD, { metal: 0.5, emissive: GOLD, eInt: 0.12 }),
    );
    ribbon.rotation.z = Math.PI / 2;
    ribbon.position.set(0, 0.72, z);
    cloth.add(ribbon);
  }
  const spineTrim = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.04, BODY_LENGTH * 0.55, 3, 8),
    mat(GOLD, { metal: 0.45, emissive: GOLD, eInt: 0.1 }),
  );
  spineTrim.rotation.z = Math.PI / 2;
  spineTrim.position.set(0, 1.15, 0);
  cloth.add(spineTrim);

  // Gold/yellow scale · cloud · spiral-dot patterns (reused materials)
  const patternCols = [GOLD, 0xffe066, 0xf0c14b, 0xffd98a];
  for (let i = 0; i < 28; i++) {
    const t = i / 27;
    const x = -BODY_LENGTH * 0.42 + t * BODY_LENGTH * 0.84;
    const side = i % 2 === 0 ? 1 : -1;
    const kind = i % 3;
    if (kind === 0) {
      // Scale disc
      const scale = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 6),
        mat(patternCols[i % patternCols.length]!, { metal: 0.35, emissive: GOLD, eInt: 0.06 }),
      );
      scale.scale.set(1.2, 0.35, 1);
      scale.position.set(x, 0.55 + (i % 4) * 0.08, side * (0.62 + (i % 3) * 0.05));
      cloth.add(scale);
    } else if (kind === 1) {
      // Cloud puff cluster
      for (let k = 0; k < 3; k++) {
        const puff = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 8, 6),
          mat(0xffe8a8, { rough: 0.5, emissive: GOLD, eInt: 0.05 }),
        );
        puff.position.set(
          x + (k - 1) * 0.08,
          0.7 + Math.abs(k - 1) * 0.04,
          side * 0.5,
        );
        cloth.add(puff);
      }
    } else {
      // Spiral / coin dots
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 6),
        mat(GOLD, { metal: 0.55, emissive: GOLD, eInt: 0.15 }),
      );
      dot.position.set(x, 0.95, side * 0.35);
      cloth.add(dot);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.09, 0.018, 4, 10),
        mat(0xffe066, { metal: 0.4 }),
      );
      ring.position.copy(dot.position);
      ring.rotation.y = Math.PI / 2;
      cloth.add(ring);
    }
  }

  // Wavy / scalloped hem + fringe (hides hips, leaves thighs visible)
  const hem = new THREE.Group();
  hem.position.set(0, 0.12, 0);
  cloth.add(hem);
  const hemN = 18;
  for (let i = 0; i < hemN; i++) {
    const t = i / (hemN - 1);
    const x = -BODY_LENGTH * 0.46 + t * BODY_LENGTH * 0.92;
    const wave = Math.sin(t * Math.PI * 5) * 0.08;
    for (const z of [-0.7, 0.7]) {
      const scallop = new THREE.Mesh(
        new THREE.SphereGeometry(0.2 + (i % 3) * 0.02, 10, 8),
        mat(i % 2 === 0 ? RED : DARK_RED, { rough: 0.55 }),
      );
      scallop.scale.set(0.85, 1.15, 0.7);
      scallop.position.set(x, wave - 0.15, z * (0.95 + Math.abs(wave) * 0.2));
      hem.add(scallop);
      // Gold hem trim bead
      const bead = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 6, 5),
        mat(GOLD, { metal: 0.5, emissive: GOLD, eInt: 0.1 }),
      );
      bead.position.set(x, wave - 0.32, z * 0.98);
      hem.add(bead);
      // Fringe strand
      const fringe = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.025, 0.22 + (i % 4) * 0.04, 3, 5),
        mat(i % 3 === 0 ? GOLD : 0xffe8a8, { rough: 0.45 }),
      );
      fringe.position.set(x, wave - 0.48, z * 0.95);
      hem.add(fringe);
    }
  }
  // Center-front / center-rear hem flaps (read as hanging cloth)
  for (const x of [-BODY_LENGTH * 0.4, 0, BODY_LENGTH * 0.4]) {
    const flap = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      mat(RED, { rough: 0.52 }),
    );
    flap.scale.set(1.4, 1.1, 0.55);
    flap.position.set(x, -0.22, 0);
    hem.add(flap);
  }

  // Fluffy pom-pom tail (~17% of total length)
  const tail = new THREE.Group();
  tail.position.set(-BODY_LENGTH * 0.52, 0.55, 0);
  cloth.add(tail);
  let prev: THREE.Object3D = tail;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(
      new THREE.SphereGeometry(0.28 - i * 0.02, 12, 10),
      mat(i >= 4 ? GOLD : i % 2 === 0 ? RED : DARK_RED, { rough: 0.5 }),
    );
    seg.position.set(-0.28 - i * 0.02, 0.08 + Math.sin(i * 0.7) * 0.1, Math.cos(i) * 0.03);
    prev.add(seg);
    prev = seg;
  }
  // Fluffy tip burst
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const fluff = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      mat(i % 2 === 0 ? GOLD : 0xffe8a8, { rough: 0.45, emissive: GOLD, eInt: 0.08 }),
    );
    fluff.position.set(-0.15 + Math.cos(a) * 0.12, Math.sin(a) * 0.12, Math.sin(a * 2) * 0.08);
    prev.add(fluff);
  }

  // ── Head: classic 醒獅 silhouette + cute kawaii face ─────────────────
  // Proportions: head ≈ 28% of total length (r≈1.2 → ~2.4 dia on ~8.6 total)
  const headHomeY = 1.15;
  const head = new THREE.Group();
  head.position.set(BODY_LENGTH * 0.48, headHomeY, 0.1);
  head.rotation.y = 0.28;
  body.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(1.15, 26, 22), mat(RED, { rough: 0.42 }));
  head.add(skull);
  addOutline(head, skull, 1.04);

  // Big forehead dome
  const forehead = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 14), mat(RED, { rough: 0.42 }));
  forehead.scale.set(1.15, 0.85, 1.05);
  forehead.position.set(0.15, 0.85, 0.55);
  head.add(forehead);
  addOutline(head, forehead, 1.05);

  // Single gold horn / ornament on top
  const hornBase = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 8),
    mat(GOLD, { metal: 0.55, emissive: GOLD, eInt: 0.25 }),
  );
  hornBase.position.set(0.05, 1.35, 0.25);
  head.add(hornBase);
  const horn = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.45, 8),
    mat(GOLD, { metal: 0.6, emissive: GOLD, eInt: 0.35 }),
  );
  horn.position.set(0.05, 1.62, 0.25);
  head.add(horn);
  const hornTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 6),
    mat(0xffe066, { metal: 0.5, emissive: GOLD, eInt: 0.3 }),
  );
  hornTip.position.set(0.05, 1.85, 0.25);
  head.add(hornTip);

  // Soft fluffy mane — leave face clear
  const maneColors = [RED, 0xf97316, GOLD, 0xe23a2e, 0xffb347];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    if (Math.cos(a) > 0.72) continue;
    const tuft = new THREE.Mesh(
      new THREE.SphereGeometry(0.24 + (i % 3) * 0.04, 10, 8),
      mat(maneColors[i % maneColors.length]!, { rough: 0.55 }),
    );
    tuft.scale.set(0.9, 1.25, 0.9);
    tuft.position.set(Math.sin(a) * 1.12, Math.sin(a * 2) * 0.12 + 0.25, Math.cos(a) * 1.12);
    head.add(tuft);
  }

  // Gold brow plate + gem
  const browPlate = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 14, 12),
    mat(GOLD, { metal: 0.55, emissive: GOLD, eInt: 0.3 }),
  );
  browPlate.scale.set(1.25, 0.42, 0.9);
  browPlate.position.set(0.12, 0.78, 0.85);
  head.add(browPlate);
  const browGem = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 8),
    mat(0xff6b6b, { metal: 0.35, emissive: 0xff6b6b, eInt: 0.3 }),
  );
  browGem.position.set(0.14, 0.8, 1.05);
  head.add(browGem);

  // Big floppy decorated ears
  function makeEar(side: 1 | -1): THREE.Group {
    const g = new THREE.Group();
    g.position.set(-0.15, 0.95, side * 0.95);
    g.rotation.z = side * -0.35;
    g.rotation.x = side * 0.15;
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), mat(RED, { rough: 0.5 }));
    outer.scale.set(0.45, 1.35, 0.85);
    g.add(outer);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat(0xffb7c5, { rough: 0.55 }));
    inner.scale.set(0.4, 1.15, 0.55);
    inner.position.set(0.06, 0.02, side * 0.04);
    g.add(inner);
    // Gold ear trim
    const trim = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.035, 4, 12, Math.PI * 1.2),
      mat(GOLD, { metal: 0.5, emissive: GOLD, eInt: 0.15 }),
    );
    trim.rotation.y = Math.PI / 2;
    trim.position.set(0.02, 0.05, 0);
    g.add(trim);
    const pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 6),
      mat(GOLD, { metal: 0.4, emissive: GOLD, eInt: 0.12 }),
    );
    pom.position.set(0, -0.45, 0);
    g.add(pom);
    return g;
  }
  const leftEar = makeEar(-1);
  const rightEar = makeEar(1);
  head.add(leftEar);
  head.add(rightEar);

  // Kawaii eyes — tall glossy dark ovals, flush, set low & wide
  function makeEye(x: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0.02, 1.12);
    const oval = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12),
      mat(0x1a1208, { rough: 0.16, metal: 0.12 }),
    );
    oval.scale.set(0.68, 1.28, 0.38);
    g.add(oval);
    const lid = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.04, 6, 14, Math.PI * 0.95),
      mat(0x3a2010, { rough: 0.5 }),
    );
    lid.rotation.x = Math.PI / 2;
    lid.rotation.z = Math.PI;
    lid.position.set(0, 0.16, 0.05);
    lid.scale.set(0.85, 1, 0.7);
    g.add(lid);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), basic(0xffffff));
    h1.position.set(0.05, 0.08, 0.1);
    g.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), basic(0xffffff));
    h2.position.set(-0.055, -0.055, 0.09);
    g.add(h2);
    return g;
  }
  const leftEye = makeEye(-0.48);
  const rightEye = makeEye(0.48);
  head.add(leftEye);
  head.add(rightEye);

  // Rosy blush cheeks
  for (const x of [-0.68, 0.68]) {
    const blush = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 8),
      mat(0xff8fab, { rough: 0.6, emissive: 0xff8fab, eInt: 0.28 }),
    );
    blush.scale.set(1.15, 0.65, 0.32);
    blush.position.set(x, -0.2, 1.0);
    head.add(blush);
  }

  // Small round nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat(0x2a1810));
  nose.position.set(0.15, -0.15, 1.2);
  head.add(nose);

  // Hinged jaw + wide beard / jaw fringe (white + gold fur)
  const jaw = new THREE.Group();
  jaw.position.set(0.12, -0.55, 0.95);
  head.add(jaw);

  const jawPlate = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 14, 12),
    mat(RED, { rough: 0.48 }),
  );
  jawPlate.scale.set(1.15, 0.55, 0.85);
  jawPlate.position.set(0.05, -0.05, 0.1);
  jaw.add(jawPlate);

  const mouthSmile = new THREE.Group();
  const smileArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.038, 6, 16, Math.PI * 0.9),
    mat(0x2a1810, { rough: 0.55 }),
  );
  smileArc.rotation.x = Math.PI / 2;
  smileArc.rotation.z = Math.PI;
  smileArc.scale.set(1.15, 1, 0.7);
  mouthSmile.add(smileArc);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xff6b8a, { rough: 0.4 }));
  tongue.scale.set(1.1, 0.55, 0.7);
  tongue.position.set(0.02, -0.08, 0.05);
  mouthSmile.add(tongue);
  jaw.add(mouthSmile);

  const mouthO = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 12, 10),
    mat(0x2a1810, { rough: 0.55 }),
  );
  mouthO.scale.set(0.85, 1.05, 0.55);
  mouthO.position.set(0.02, -0.02, 0.05);
  mouthO.visible = false;
  jaw.add(mouthO);

  // Beard / jaw fringe fan
  for (let i = 0; i < 14; i++) {
    const a = -0.9 + (i / 13) * 1.8;
    const strand = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + (i % 3) * 0.02, 8, 6),
      mat(i % 3 === 0 ? GOLD : 0xfff6e4, { rough: 0.55 }),
    );
    strand.scale.set(0.7, 1.4, 0.6);
    strand.position.set(
      Math.sin(a) * 0.15 + 0.05,
      -0.28 - Math.cos(a * 0.5) * 0.12,
      0.25 + Math.cos(a) * 0.35,
    );
    jaw.add(strand);
  }

  // Soft snout toward travel
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), mat(DARK_RED, { rough: 0.5 }));
  snout.scale.set(1.15, 0.75, 0.9);
  snout.position.set(0.95, -0.02, 0.25);
  head.add(snout);

  // 花花 + drum on head back/top — face clear
  const flower = buildFlower();
  const flowerHome = new THREE.Vector3(-0.55, 1.25, 0.05);
  flower.position.copy(flowerHome);
  flower.scale.setScalar(1.15);
  head.add(flower);

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 16), mat(RED));
  drum.rotation.z = Math.PI / 2;
  drum.position.set(-0.55, 1.1, -0.45);
  head.add(drum);
  const drumSkin = new THREE.Mesh(new THREE.CircleGeometry(0.215, 16), mat(CREAM));
  drumSkin.rotation.y = Math.PI / 2;
  drumSkin.position.set(-0.44, 1.1, -0.45);
  head.add(drumSkin);
  for (const dz of [-0.12, 0.12]) {
    const stick = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.025, 0.28, 3, 6),
      mat(WOOD),
    );
    stick.position.set(-0.5, 1.28, -0.45 + dz);
    stick.rotation.z = 0.5;
    head.add(stick);
  }

  // Slender jointed legs under the humps (hips partly hidden by hem)
  const legs = {} as Record<LegId, LegMeshes>;
  for (const id of LEG_IDS) {
    const leg = buildLeg(id);
    const a = LEG_ATTACH[id];
    leg.root.position.set(a.x, -0.35, a.z);
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

  // Invisible core AABB for camera framing (nose→tail, feet→horn)
  const frameCore = new THREE.Mesh(
    new THREE.BoxGeometry(BODY_LENGTH + 3.6, BODY_HEIGHT + 0.7, BODY_WIDTH + 0.85),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  frameCore.name = 'frameCore';
  frameCore.position.set(0.1, -0.3, 0);
  root.add(frameCore);

  root.position.y = BODY_HEIGHT;
  return {
    root,
    body,
    cloth,
    frontHump,
    rearHump,
    frontHumpHomeY,
    rearHumpHomeY,
    hem,
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
      leg.root.position.y = -0.05 + Math.abs(Math.sin(phase * 0.8)) * 0.3;
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
    leg.root.position.y = -0.35 + L * 0.55;
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
