/**
 * Procedural 醒獅 + quiet street (v5 art).
 * Clean silhouette, limited palette, cute toon look — gameplay/physics unchanged.
 */

import * as THREE from 'three';
import {
  BODY_HEIGHT,
  BODY_LENGTH,
  BODY_WIDTH,
  LEG_ATTACH_MESH,
  LEG_COLOR,
  LEG_IDS,
  LION_SCALE,
  TRACK_LENGTH,
  type LegId,
} from './constants';

/** Festive palette — bright 朱紅 / 金黃 / 奶油；描邊用柔和朱紅，避免深咖拱影 */
const RED = 0xe8452f;
const RED_LIT = 0xf0503a;
const RED_SHADE = 0xd43828;
const GOLD = 0xf6c543;
const CREAM = 0xfff6e8;
const BLUSH = 0xf5a0b0;
const BOOT = 0x4a2820;
const OUTLINE = 0xb83228;
const SKY_TOP = 0xeef4f0;
const SKY_BOT = 0xfff2e6;
const HILL = 0xd0e2cc;
const HILL_FAR = 0xdfead8;
const GROUND = 0xf3e8d6;
const PATH = 0xecdcc4;
const WOOD = 0xd2b48c;
const INK = 0x2a1810;

const matCache = new Map<string, THREE.MeshStandardMaterial>();
const basicCache = new Map<string, THREE.MeshBasicMaterial>();

function mat(
  color: number,
  opts?: { rough?: number; metal?: number; emissive?: number; eInt?: number },
): THREE.MeshStandardMaterial {
  const rough = opts?.rough ?? 0.62;
  const metal = opts?.metal ?? 0.04;
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

/** Thin festive outline — never dark-brown (that read as a trunk behind the lion). */
function addOutline(parent: THREE.Object3D, mesh: THREE.Mesh, scale = 1.03): void {
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
  // Mesh is authored in design units, then uniformly scaled to world metres.
  // Physics BODY_HEIGHT is shorter than design×scale — keep mesh proportions on design 2.9.
  const DL = BODY_LENGTH / LION_SCALE;
  const DH = 2.9;
  const DW = BODY_WIDTH / LION_SCALE;

  // Soft pale ground blob (never a dark arch)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), basic(0x8b5a40, 0.08));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  shadow.scale.set(1.55, 1, 0.5);
  root.add(shadow);

  // ── Body: bright toon layers (lit top / mid / shade skirt) ───────────
  const cloth = new THREE.Group();
  body.add(cloth);

  // Flattened in Z so the far flank doesn't form a dark second silhouette
  const blanket = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.95, DL * 0.68, 8, 28),
    mat(RED_LIT, { rough: 0.42, emissive: RED_LIT, eInt: 0.22 }),
  );
  blanket.rotation.z = Math.PI / 2;
  blanket.scale.set(1, 1, 0.72);
  blanket.position.set(0, 0.85, 0.12);
  cloth.add(blanket);

  // Lit ridge along the top (clear toon highlight band)
  const litBand = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, DL * 0.55, 4, 12),
    mat(0xff6a4a, { rough: 0.4, emissive: 0xff6a4a, eInt: 0.35 }),
  );
  litBand.rotation.z = Math.PI / 2;
  litBand.position.set(0, 1.28, 0.28);
  cloth.add(litBand);

  // Front / rear performer peaks
  const frontHumpHomeY = 1.28;
  const frontHump = new THREE.Group();
  frontHump.position.set(DL * 0.22, frontHumpHomeY, 0);
  cloth.add(frontHump);
  const fh = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 22, 18),
    mat(RED_LIT, { rough: 0.45, emissive: RED_LIT, eInt: 0.2 }),
  );
  fh.scale.set(1.15, 1.22, 0.85);
  frontHump.add(fh);

  const rearHumpHomeY = 1.18;
  const rearHump = new THREE.Group();
  rearHump.position.set(-DL * 0.22, rearHumpHomeY, 0);
  cloth.add(rearHump);
  const rh = new THREE.Mesh(
    new THREE.SphereGeometry(0.82, 22, 18),
    mat(RED_LIT, { rough: 0.48, emissive: RED_LIT, eInt: 0.18 }),
  );
  rh.scale.set(1.1, 1.18, 0.82);
  rearHump.add(rh);

  const mid = new THREE.Mesh(
    new THREE.SphereGeometry(0.75, 18, 14),
    mat(RED, { rough: 0.48, emissive: RED_LIT, eInt: 0.14 }),
  );
  mid.scale.set(2.2, 0.8, 0.75);
  mid.position.set(0, 1.02, 0.1);
  cloth.add(mid);

  // Camera-facing skirt only (no far-side volume = no dark arch)
  const hem = new THREE.Group();
  hem.position.set(0, 0.0, 0);
  cloth.add(hem);
  const skirt = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.5, DL * 0.64, 8, 28),
    mat(RED, { rough: 0.5, emissive: RED, eInt: 0.14 }),
  );
  skirt.rotation.z = Math.PI / 2;
  skirt.scale.set(1.0, 1.1, 0.4);
  skirt.position.set(0, -0.06, 0.55);
  hem.add(skirt);
  // Bright gold hem roll
  const hemTrim = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.085, DL * 0.72, 3, 8),
    mat(GOLD, { metal: 0.45, emissive: GOLD, eInt: 0.38 }),
  );
  hemTrim.rotation.z = Math.PI / 2;
  hemTrim.position.set(0, -0.55, 0.72);
  hem.add(hemTrim);

  for (const x of [-DL * 0.15, DL * 0.15]) {
    const motif = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 8),
      mat(GOLD, { metal: 0.35, emissive: GOLD, eInt: 0.22 }),
    );
    motif.scale.set(1.6, 0.35, 1.2);
    motif.position.set(x, 0.75, 0.88);
    cloth.add(motif);
  }

  const tail = new THREE.Group();
  tail.position.set(-DL * 0.52, 0.75, 0);
  cloth.add(tail);
  const tailMesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.18, 1.35, 4, 12),
    mat(RED, { rough: 0.5, emissive: RED, eInt: 0.06 }),
  );
  tailMesh.rotation.z = Math.PI / 2 + 0.25;
  tailMesh.position.set(-0.7, 0.15, 0);
  tailMesh.scale.set(1, 1, 0.85);
  tail.add(tailMesh);
  const pom = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 14, 12),
    mat(GOLD, { rough: 0.45, emissive: GOLD, eInt: 0.25 }),
  );
  pom.position.set(-1.45, 0.35, 0);
  tail.add(pom);

  // ── Head: large rounded cute 醒獅 (~60% of body height) ──────────────
  const headHomeY = 1.45;
  const head = new THREE.Group();
  head.position.set(DL * 0.46, headHomeY, 0.2);
  head.rotation.y = 0.2;
  body.add(head);

  // Big rounded skull
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(1.45, 28, 22),
    mat(RED_LIT, { rough: 0.45, emissive: RED_LIT, eInt: 0.1 }),
  );
  skull.scale.set(1.02, 0.96, 1.0);
  head.add(skull);
  addOutline(head, skull, 1.03);

  // Soft forehead
  const brow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), mat(RED, { rough: 0.5 }));
  brow.scale.set(1.15, 0.65, 0.9);
  brow.position.set(0.12, 0.95, 0.85);
  head.add(brow);

  // One small gold horn only
  const horn = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.42, 8),
    mat(GOLD, { metal: 0.45, emissive: GOLD, eInt: 0.22 }),
  );
  horn.position.set(0.08, 1.55, 0.4);
  head.add(horn);

  // 6 large mane puffs behind / sides — never on the face
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * 0.55 + (i / 5) * Math.PI * 0.9; // back half only
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 14, 12),
      mat(i % 2 === 0 ? GOLD : CREAM, { rough: 0.55 }),
    );
    puff.position.set(Math.sin(a) * 1.25, Math.sin((i - 2.5) * 0.35) * 0.35 + 0.2, Math.cos(a) * 1.15);
    head.add(puff);
  }

  // Small round ears
  function makeEar(side: 1 | -1): THREE.Group {
    const g = new THREE.Group();
    g.position.set(-0.05, 1.05, side * 1.3);
    const outer = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), mat(RED, { rough: 0.55 }));
    outer.scale.set(0.5, 0.95, 0.65);
    g.add(outer);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat(BLUSH, { rough: 0.6 }));
    inner.scale.set(0.4, 0.8, 0.45);
    inner.position.set(0.05, 0.02, side * 0.02);
    g.add(inner);
    return g;
  }
  const leftEar = makeEar(-1);
  const rightEar = makeEar(1);
  head.add(leftEar);
  head.add(rightEar);

  // Big round wide-open eyes
  function makeEye(x: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(x, 0.15, 1.38);
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), mat(CREAM, { rough: 0.4 }));
    white.scale.set(1.0, 1.05, 0.42);
    g.add(white);
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 16, 12),
      mat(INK, { rough: 0.18, metal: 0.08 }),
    );
    pupil.scale.set(0.95, 1.0, 0.5);
    pupil.position.set(0, 0, 0.1);
    g.add(pupil);
    const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), basic(0xffffff));
    h1.position.set(0.07, 0.09, 0.18);
    g.add(h1);
    const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), basic(0xffffff));
    h2.position.set(-0.07, -0.06, 0.16);
    g.add(h2);
    return g;
  }
  const leftEye = makeEye(-0.55);
  const rightEye = makeEye(0.55);
  head.add(leftEye);
  head.add(rightEye);

  // Tiny blush
  for (const x of [-0.85, 0.85]) {
    const blush = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      mat(BLUSH, { rough: 0.65, emissive: BLUSH, eInt: 0.22 }),
    );
    blush.scale.set(1.2, 0.55, 0.28);
    blush.position.set(x, -0.25, 1.2);
    head.add(blush);
  }

  // Round nose + simple smile
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(INK, { rough: 0.5 }));
  nose.position.set(0.14, -0.15, 1.45);
  head.add(nose);

  const jaw = new THREE.Group();
  jaw.position.set(0.12, -0.55, 1.2);
  head.add(jaw);

  const mouthSmile = new THREE.Group();
  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.038, 6, 18, Math.PI * 0.85),
    mat(INK, { rough: 0.55 }),
  );
  smile.rotation.x = Math.PI / 2;
  smile.rotation.z = Math.PI;
  smile.scale.set(1.1, 1, 0.65);
  mouthSmile.add(smile);
  jaw.add(mouthSmile);

  const mouthO = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), mat(INK, { rough: 0.55 }));
  mouthO.scale.set(0.9, 1.05, 0.5);
  mouthO.visible = false;
  jaw.add(mouthO);

  // Soft snout toward travel
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), mat(RED_SHADE, { rough: 0.55 }));
  snout.scale.set(1.15, 0.7, 0.85);
  snout.position.set(1.05, -0.05, 0.22);
  head.add(snout);

  // 花花 + tiny drum tucked far behind — face clear
  const flower = buildFlower();
  const flowerHome = new THREE.Vector3(-0.85, 1.2, -0.25);
  flower.position.copy(flowerHome);
  flower.scale.setScalar(0.85);
  head.add(flower);

  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12), mat(RED_SHADE));
  drum.rotation.z = Math.PI / 2;
  drum.position.set(-0.8, 0.9, -0.65);
  head.add(drum);
  const drumSkin = new THREE.Mesh(new THREE.CircleGeometry(0.135, 12), mat(CREAM));
  drumSkin.rotation.y = Math.PI / 2;
  drumSkin.position.set(-0.73, 0.9, -0.65);
  head.add(drumSkin);

  // Lantern-pants legs (chunky, vermillion + gold stripes; color only at ankle)
  const legs = {} as Record<LegId, LegMeshes>;
  for (const id of LEG_IDS) {
    const leg = buildLeg(id);
    const a = LEG_ATTACH_MESH[id];
    leg.root.position.set(a.x, -0.28, a.z);
    leg.root.renderOrder = 5;
    leg.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.renderOrder = 5;
    });
    body.add(leg.root);
    legs[id] = leg;
  }

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

  const frameCore = new THREE.Mesh(
    new THREE.BoxGeometry(DL + 1.6, DH * 0.85, DW + 0.55),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  frameCore.name = 'frameCore';
  frameCore.position.set(0.15, 0.15, 0);
  root.add(frameCore);

  root.scale.setScalar(LION_SCALE);
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

function taper(rTop: number, rBot: number, len: number, segs = 12): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(rTop, rBot, len, segs);
}

/**
 * Smooth lantern-pants — continuous tapered cloth (no ball stacks / exposed bone).
 * Thigh overhangs shin so bend never opens a gap; knee = tiny gold buckle only.
 * QWOP color only at ankle.
 */
function buildLeg(id: LegId): LegMeshes {
  const root = new THREE.Group();
  root.name = id;
  const accent = LEG_COLOR[id];

  const thigh = new THREE.Group();
  root.add(thigh);

  // Soft hip puff into body
  const hipCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 14),
    mat(RED_LIT, { rough: 0.45, emissive: RED_LIT, eInt: 0.16 }),
  );
  hipCap.scale.set(1.08, 0.62, 1.08);
  hipCap.position.y = -0.06;
  thigh.add(hipCap);

  // Long lantern thigh — extends past the knee pivot to hide the joint when bent
  const thighMesh = new THREE.Mesh(
    taper(0.5, 0.34, 1.35, 20),
    mat(RED_LIT, { rough: 0.45, emissive: RED_LIT, eInt: 0.16 }),
  );
  thighMesh.position.y = -0.72;
  thigh.add(thighMesh);

  // Soft hem cuff that drapes over the shin (hides the bend seam)
  const thighCuff = new THREE.Mesh(
    taper(0.35, 0.4, 0.38, 18),
    mat(RED_LIT, { rough: 0.45, emissive: RED_LIT, eInt: 0.15 }),
  );
  thighCuff.position.y = -1.28;
  thigh.add(thighCuff);

  // Tiny camera-facing gold buckle (not a full ring / bone)
  const knee = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 10, 8),
    mat(GOLD, { metal: 0.45, emissive: GOLD, eInt: 0.38 }),
  );
  knee.scale.set(0.65, 0.65, 0.5);
  knee.position.set(0.02, -1.18, 0.36);
  thigh.add(knee);

  // Shin pivot tucked inside the cuff
  const shin = new THREE.Group();
  shin.position.y = -1.18;
  thigh.add(shin);

  // Same lit red as thigh so the knee reads as cloth, not a second segment
  const shinMesh = new THREE.Mesh(
    taper(0.38, 0.26, 1.08, 18),
    mat(RED_LIT, { rough: 0.46, emissive: RED_LIT, eInt: 0.14 }),
  );
  shinMesh.position.y = -0.48;
  shin.add(shinMesh);
  const shinCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.38, 12, 10),
    mat(RED_LIT, { rough: 0.46, emissive: RED_LIT, eInt: 0.14 }),
  );
  shinCap.scale.set(1, 0.5, 1);
  shinCap.position.y = 0.08;
  shin.add(shinCap);

  // Q/W/O/P ankle ring
  const anklet = new THREE.Mesh(
    taper(0.29, 0.29, 0.07, 12),
    mat(accent, { metal: 0.12, emissive: accent, eInt: 0.3 }),
  );
  anklet.position.y = -0.92;
  shin.add(anklet);

  const foot = new THREE.Group();
  foot.position.y = -1.05;
  shin.add(foot);

  // Round dark cloth shoe
  const boot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(BOOT, { rough: 0.62 }));
  boot.scale.set(1.5, 0.7, 1.15);
  boot.position.set(0.12, -0.02, 0);
  foot.add(boot);
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 8, 6),
    mat(accent, { metal: 0.1, emissive: accent, eInt: 0.22 }),
  );
  tip.position.set(0.28, 0.0, 0);
  foot.add(tip);

  return { root, thigh, shin, foot, knee };
}

function buildFlower(): THREE.Group {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(0xf2a0b8));
  g.add(head);
  for (let i = 0; i < 5; i++) {
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xf2a0b8));
    const a = (i / 5) * Math.PI * 2;
    petal.position.set(Math.cos(a) * 0.12, 0.03, Math.sin(a) * 0.12);
    g.add(petal);
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), mat(GOLD));
  center.position.y = 0.1;
  g.add(center);
  return g;
}

/**
 * FK pose — hip angle from physics (rad, + forward) drives the thigh;
 * lift bends knee/hock. When fallen (side-lie), legs stick out sideways
 * and still respond to player swing/lift.
 */
export function applyLegPose(
  legs: Record<LegId, LegMeshes>,
  lift: Record<LegId, number>,
  swing: Record<LegId, number>,
  flailT = 0,
  fallen = false,
  fallSide = 1,
): void {
  for (const id of LEG_IDS) {
    const leg = legs[id];
    const L = Math.min(1, lift[id] ?? 0);
    const S = swing[id] ?? 0;
    const attach = LEG_ATTACH_MESH[id];
    if (fallen) {
      // Side-lie (~1.45 rad on X): fling legs out in a wide star so they read
      // clearly from the side camera — still driven by swing/lift.
      const along = id.startsWith('F') ? 1.15 : -1.15;
      const sidePush = (id.endsWith('L') ? -1 : 1) * fallSide * 0.9;
      leg.root.position.set(
        attach.x * 0.35 + along * (0.55 + L * 0.35),
        -1.15 - L * 0.7 - Math.abs(S) * 0.25,
        attach.z * 0.4 + sidePush,
      );
      leg.thigh.rotation.set(sidePush * 0.6 + S * 0.35, along * 0.4 + S * 0.5, S * 0.7);
      leg.shin.rotation.set(0.2, 0, -(0.7 + L * 1.1));
      leg.foot.rotation.set(0, 0, 0.35 + L * 0.45);
      void flailT;
      continue;
    }
    leg.root.position.set(attach.x, -0.28 + L * 0.45, attach.z);
    leg.thigh.rotation.x = L * 0.06;
    leg.thigh.rotation.y = 0;
    leg.shin.rotation.x = 0;
    leg.thigh.rotation.z = S;
    leg.shin.rotation.z = -(0.2 + L * 1.05);
    leg.foot.rotation.z = L * 0.22;
    leg.foot.rotation.x = 0;
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
  // Soft pink-cream → pale green sky
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

  // 3 soft color blocks: far hill, near hill, ground
  const hills: THREE.Object3D[] = [];
  const farHill = new THREE.Mesh(
    new THREE.SphereGeometry(18, 16, 10),
    mat(HILL_FAR, { rough: 0.98 }),
  );
  farHill.scale.set(2.6, 0.4, 1);
  farHill.position.set(TRACK_LENGTH * 0.35, 0.5, -22);
  scene.add(farHill);
  hills.push(farHill);

  const nearHill = new THREE.Mesh(new THREE.SphereGeometry(14, 16, 10), mat(HILL, { rough: 0.98 }));
  nearHill.scale.set(2.4, 0.38, 1);
  nearHill.position.set(TRACK_LENGTH * 0.45, 0.3, -14);
  scene.add(nearHill);
  hills.push(nearHill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_LENGTH + 40, 22),
    mat(GROUND, { rough: 0.96 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(TRACK_LENGTH / 2, 0, -2);
  scene.add(ground);

  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(TRACK_LENGTH + 6, 3.8),
    mat(PATH, { rough: 0.94 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(TRACK_LENGTH / 2, 0.012, 0);
  scene.add(path);

  // Very soft path edges (low contrast)
  for (const z of [-1.85, 1.85]) {
    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(TRACK_LENGTH + 6, 0.08),
      mat(0xd4b8a0, { rough: 0.9 }),
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(TRACK_LENGTH / 2, 0.018, z);
    scene.add(edge);
  }

  // Speed-reference fence at z = −2.2 (posts every 2.5 m) — pale so it never eats the silhouette
  const fenceMat = mat(0xf4f0e8, { rough: 0.95 });
  for (let x = 2.5; x <= TRACK_LENGTH; x += 2.5) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.9, 6), fenceMat);
    post.position.set(x, 0.45, -2.2);
    scene.add(post);
  }
  for (const hy of [0.45, 0.82]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(TRACK_LENGTH - 1, 0.035, 0.035),
      fenceMat,
    );
    rail.position.set(TRACK_LENGTH / 2 + 0.5, hy, -2.2);
    scene.add(rail);
  }

  // Pale distant props only (cream trees + soft lanterns) — never dark trunks behind the lion
  const lanterns: THREE.Object3D[] = [];
  for (let i = 20; i <= TRACK_LENGTH; i += 16) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 1.4, 6),
      mat(0xe8d4b8, { rough: 0.9 }),
    );
    trunk.position.set(i, 0.7, -12);
    scene.add(trunk);
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 10),
      mat(0xc8dcc0, { rough: 0.95 }),
    );
    canopy.position.set(i, 1.7, -12);
    scene.add(canopy);
    const lantern = new THREE.Group();
    const paper = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      mat(0xffe0a8, { rough: 0.55, emissive: GOLD, eInt: 0.12 }),
    );
    paper.scale.set(1, 1.15, 1);
    lantern.add(paper);
    lantern.position.set(i + 1.2, 2.2, -11.5);
    scene.add(lantern);
    lanterns.push(lantern);
  }

  // Festival distance boards every 10 m + white track line
  for (let m = 10; m < TRACK_LENGTH; m += 10) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.03, 3.0),
      mat(0xf8f4ec, { rough: 0.85 }),
    );
    line.position.set(m, 0.025, 0);
    scene.add(line);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 1.1, 6),
      mat(RED_SHADE, { rough: 0.7 }),
    );
    post.position.set(m, 0.55, -1.55);
    scene.add(post);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.32, 0.06),
      mat(CREAM, { rough: 0.75 }),
    );
    board.position.set(m, 1.2, -1.55);
    scene.add(board);
    const digit = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.08, 0.04),
      mat(INK, { rough: 0.9 }),
    );
    digit.position.set(m, 1.22, -1.52);
    scene.add(digit);
    const lantern = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 10, 8),
      mat(RED_LIT, { rough: 0.55, emissive: RED, eInt: 0.18 }),
    );
    lantern.position.set(m, 1.55, -1.55);
    scene.add(lantern);
  }

  // Quiet temple gate
  const gate = new THREE.Group();
  gate.position.set(TRACK_LENGTH + 2.2, 0, 0);
  const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 4.6, 0.45), mat(RED_SHADE, { rough: 0.7 }));
  pillarL.position.set(0, 2.3, -2.4);
  gate.add(pillarL);
  const pillarR = pillarL.clone();
  pillarR.position.z = 2.4;
  gate.add(pillarR);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 5.4), mat(GOLD, { metal: 0.25 }));
  beam.position.set(0, 4.4, 0);
  gate.add(beam);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.0, 4), mat(RED, { rough: 0.65 }));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 5.3, 0);
  gate.add(roof);
  scene.add(gate);

  const envelope = new THREE.Group();
  envelope.position.set(TRACK_LENGTH + 0.3, 3.8, 0);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 5), mat(0x777777));
  string.position.y = 0.45;
  envelope.add(string);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.1), mat(RED, { rough: 0.55 }));
  pack.position.y = -0.2;
  envelope.add(pack);
  const seal = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.12), mat(GOLD, { metal: 0.35 }));
  seal.position.y = -0.05;
  envelope.add(seal);
  scene.add(envelope);

  let confetti: THREE.Points | null = null;
  let sparkBurst: THREE.Points | null = null;
  if (!reducedMotion) {
    const count = 120;
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
      new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0 }),
    );
    confetti.visible = false;
    scene.add(confetti);

    const sparkN = 48;
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
      new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0 }),
    );
    sparkBurst.visible = false;
    scene.add(sparkBurst);
  }

  return { lanterns, gate, envelope, confetti, sparkBurst, hills };
}

