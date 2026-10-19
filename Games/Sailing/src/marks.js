// Checkpoint / buoy-rounding course geometry and WebGL mark props.

import { createMesh } from './gl.js';
import { SOLID_ATTRIBUTES } from './solid.js';
import { mat4 } from './math.js';
import { sampleWater } from './shaderChunks.js';
import { createCourse as buildCourse } from './courses.js';

const ORANGE = [0.95, 0.42, 0.12];
const WHITE = [0.96, 0.96, 0.94];
const POLE = [0.75, 0.78, 0.8];
const NEXT = [0.15, 1.0, 0.72];
const NEXT_HOT = [0.85, 1.0, 0.35];
const DONE = [0.55, 0.6, 0.65];
const BEAM = [0.2, 1.0, 0.85];

function buildBuoyMesh(gl, program, stripeCount = 6) {
  const data = [];
  const indices = [];
  let vcount = 0;

  const push = (p, n, uv, c) => {
    data.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], c[0], c[1], c[2]);
    return vcount++;
  };

  const segs = 14;
  const radius = 0.5;
  const height = 2.6;

  for (let b = 0; b < stripeCount; b++) {
    const y0 = (b / stripeCount) * height;
    const y1 = ((b + 1) / stripeCount) * height;
    const color = b % 2 === 0 ? ORANGE : WHITE;
    const base = vcount;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      const n = [Math.cos(a), 0, Math.sin(a)];
      push([x, y0, z], n, [i / segs, b / stripeCount], color);
      push([x, y1, z], n, [i / segs, (b + 1) / stripeCount], color);
    }
    for (let i = 0; i < segs; i++) {
      const a = base + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const capCenter = push([0, height, 0], [0, 1, 0], [0.5, 0.5], ORANGE);
  const capRing = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    capRing.push(push(
      [Math.cos(a) * radius, height, Math.sin(a) * radius],
      [0, 1, 0],
      [0.5, 0.5],
      ORANGE
    ));
  }
  for (let i = 0; i < segs; i++) {
    indices.push(capCenter, capRing[i], capRing[(i + 1) % segs]);
  }

  const poleR = 0.04;
  const poleH = 1.8;
  const poleBase = vcount;
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.cos(a) * poleR;
    const z = Math.sin(a) * poleR;
    push([x, height, z], [Math.cos(a), 0, Math.sin(a)], [0, 0], POLE);
    push([x, height + poleH, z], [Math.cos(a), 0, Math.sin(a)], [0, 1], POLE);
  }
  for (let i = 0; i < 8; i++) {
    const a = poleBase + i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const flagY = height + poleH - 0.1;
  indices.push(
    push([0, flagY + 0.15, 0], [0, 0, 1], [0, 0], [0.15, 1.0, 0.55]),
    push([0, flagY - 0.85, 0], [0, 0, 1], [0, 1], [0.15, 1.0, 0.55]),
    push([1.55, flagY - 0.35, 0], [0, 0, 1], [1, 0.5], [1.0, 0.95, 0.2])
  );

  return createMesh(gl, program, new Float32Array(data), new Uint32Array(indices), SOLID_ATTRIBUTES);
}

function buildGateBeamMesh(gl, program) {
  const data = [];
  const indices = [];
  let v = 0;
  const push = (p, n, c) => {
    data.push(p[0], p[1], p[2], n[0], n[1], n[2], 0, 0, c[0], c[1], c[2]);
    return v++;
  };
  const y0 = 1.2;
  const y1 = 2.4;
  const z = 0.08;
  const a = push([-1, y0, z], [0, 0, 1], BEAM);
  const b = push([1, y0, z], [0, 0, 1], BEAM);
  const c = push([1, y1, z], [0, 0, 1], BEAM);
  const d = push([-1, y1, z], [0, 0, 1], BEAM);
  indices.push(a, b, c, a, c, d);
  const e = push([-1, y0, -z], [0, 0, -1], BEAM);
  const f = push([1, y0, -z], [0, 0, -1], BEAM);
  const g = push([1, y1, -z], [0, 0, -1], BEAM);
  const h = push([-1, y1, -z], [0, 0, -1], BEAM);
  indices.push(e, g, f, e, h, g);
  return createMesh(gl, program, new Float32Array(data), new Uint32Array(indices), SOLID_ATTRIBUTES);
}

/** @deprecated use createCourse(id) from courses.js — kept for check imports */
export function createCourse(courseId = 'harbor') {
  return buildCourse(courseId);
}

export function gateAxes(gate) {
  const fx = Math.sin(gate.facing);
  const fz = Math.cos(gate.facing);
  return { fx, fz, rx: fz, rz: -fx };
}

export function gatePosts(gate) {
  const { rx, rz } = gateAxes(gate);
  return {
    left: { x: gate.x - rx * gate.halfWidth, z: gate.z - rz * gate.halfWidth },
    right: { x: gate.x + rx * gate.halfWidth, z: gate.z + rz * gate.halfWidth },
  };
}

export function gateLocal(boat, gate) {
  const { fx, fz, rx, rz } = gateAxes(gate);
  const dx = boat.x - gate.x;
  const dz = boat.z - gate.z;
  return {
    along: dx * fx + dz * fz,
    across: dx * rx + dz * rz,
  };
}

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function markKind(gate) {
  return gate.kind === 'round' ? 'round' : 'gate';
}

/**
 * Pure progress tracker for one boat on a course (player or CPU).
 * @param {import('./courses.js').CourseMark[]} gates
 */
export function createMarkTracker(gates) {
  let nextIndex = 0;
  let prevAlong = null;
  let roundAngle = null;
  let wound = 0;
  let touched = false;

  function resetRoundState(boat, gate) {
    roundAngle = Math.atan2(boat.x - gate.x, boat.z - gate.z);
    wound = 0;
    touched = false;
  }

  return {
    get nextIndex() {
      return nextIndex;
    },
    set nextIndex(v) {
      nextIndex = v;
    },
    get nextGate() {
      return gates[nextIndex] || null;
    },
    get gates() {
      return gates;
    },

    reset(boat) {
      nextIndex = 0;
      const g = gates[0];
      if (!g) {
        prevAlong = null;
        return;
      }
      if (markKind(g) === 'round') {
        prevAlong = null;
        resetRoundState(boat, g);
      } else {
        prevAlong = gateLocal(boat, g).along;
        roundAngle = null;
        wound = 0;
        touched = false;
      }
    },

    /**
     * @returns {{ cleared: object, index: number, accuracy: number, perfect: boolean }|null}
     */
    tryClear(boat) {
      if (nextIndex >= gates.length) return null;
      const gate = gates[nextIndex];

      if (markKind(gate) === 'round') {
        return tryClearRound(boat, gate);
      }
      return tryClearGate(boat, gate);
    },
  };

  function tryClearGate(boat, gate) {
    const local = gateLocal(boat, gate);
    if (prevAlong === null) {
      prevAlong = local.along;
      return null;
    }
    const half = gate.halfWidth ?? 16;
    const within = Math.abs(local.across) <= half * 1.05;
    const crossed = prevAlong < 0.4 && local.along >= 0.4 && within;
    const accuracy = half > 0 ? Math.abs(local.across) / half : 1;
    prevAlong = local.along;
    if (!crossed) return null;

    const cleared = gate;
    const index = nextIndex;
    const perfect = accuracy < 0.38;
    nextIndex += 1;
    armNext(boat);
    return { cleared, index, accuracy, perfect };
  }

  function tryClearRound(boat, gate) {
    const radius = gate.radius ?? 10;
    const dist = Math.hypot(boat.x - gate.x, boat.z - gate.z);
    const angle = Math.atan2(boat.x - gate.x, boat.z - gate.z);
    if (roundAngle === null) resetRoundState(boat, gate);

    const near = dist < radius * 2.8;
    if (near) {
      const delta = wrapAngle(angle - roundAngle);
      wound += delta;
      if (dist < radius) touched = true;
    } else if (dist > radius * 4.5) {
      // Abandoned the mark — reset winding so a distant loop can't cheat.
      wound = 0;
      touched = false;
    }
    roundAngle = angle;

    const leaveTo = gate.leaveTo === 'starboard' ? 'starboard' : 'port';
    // Port rounding = leave mark to port = boat travels counterclockwise (angle↑).
    const need = leaveTo === 'port' ? 1 : -1;
    const enough = wound * need > 1.85;
    if (!(touched && enough)) return null;

    const cleared = gate;
    const index = nextIndex;
    // Tighter radius = better accuracy for perfect bonus.
    const accuracy = Math.min(1, dist / radius);
    const perfect = accuracy < 0.55;
    nextIndex += 1;
    armNext(boat);
    return { cleared, index, accuracy, perfect };
  }

  function armNext(boat) {
    if (nextIndex >= gates.length) return;
    const g = gates[nextIndex];
    if (markKind(g) === 'round') {
      prevAlong = null;
      resetRoundState(boat, g);
    } else {
      prevAlong = gateLocal(boat, g).along;
      roundAngle = null;
      wound = 0;
      touched = false;
    }
  }
}

function buildPosts(course) {
  const posts = [];
  for (const gate of course.gates) {
    if (gate.isFinish && markKind(gate) === 'gate') continue;
    if (markKind(gate) === 'round') {
      posts.push({ gateId: gate.id, x: gate.x, z: gate.z, solo: true });
      continue;
    }
    const p = gatePosts(gate);
    posts.push({ gateId: gate.id, x: p.left.x, z: p.left.z, solo: false });
    posts.push({ gateId: gate.id, x: p.right.x, z: p.right.z, solo: false });
  }
  return posts;
}

export function createMarks(gl, solid, course) {
  const mesh = buildBuoyMesh(gl, solid.program);
  const beamMesh = buildGateBeamMesh(gl, solid.program);
  let active = course;
  let tracker = createMarkTracker(active.gates);
  let posts = buildPosts(active);

  let models = posts.map(() => ({
    model: mat4.create(),
    normal: new Float32Array(9),
  }));
  const beamModel = mat4.create();
  const beamNormal = new Float32Array(9);
  let animTime = 0;

  return {
    get nextIndex() {
      return tracker.nextIndex;
    },
    get nextGate() {
      return tracker.nextGate;
    },
    get posts() {
      return posts;
    },
    get gates() {
      return active.gates;
    },
    get course() {
      return active;
    },
    get tracker() {
      return tracker;
    },

    setCourse(nextCourse) {
      active = nextCourse;
      tracker = createMarkTracker(active.gates);
      posts = buildPosts(active);
      models = posts.map(() => ({
        model: mat4.create(),
        normal: new Float32Array(9),
      }));
    },

    reset(boat) {
      tracker.reset(boat);
    },

    tryClear(boat) {
      return tracker.tryClear(boat);
    },

    /** Fresh tracker for a rival sharing this course geometry. */
    createTracker() {
      return createMarkTracker(active.gates);
    },

    update(time, waveAmp) {
      animTime = time;
      posts.forEach((p, i) => {
        const s = sampleWater(p.x, p.z, time, waveAmp);
        const pitch = Math.atan(-s.nz) * 0.35;
        const roll = Math.atan(s.nx) * 0.35;
        const next = tracker.nextGate;
        const isNext =
          p.gateId === tracker.nextIndex ||
          (next?.isFinish && p.gateId === 0);
        const scale = isNext ? (p.solo ? 2.1 : 1.75) : p.solo ? 1.35 : 1;
        mat4.compose(models[i].model, [p.x, s.y - 0.35, p.z], 0, pitch, roll, scale);
        mat4.normalMatrix(models[i].normal, models[i].model);
      });

      const gate = tracker.nextGate;
      if (gate && markKind(gate) === 'gate') {
        const vis = gate.isFinish ? active.gates[0] : gate;
        const s = sampleWater(vis.x, vis.z, time, waveAmp);
        const t = mat4.fromTranslation(mat4.create(), [vis.x, s.y, vis.z]);
        const ry = mat4.fromRotationY(mat4.create(), vis.facing);
        const sc = mat4.fromScaling(mat4.create(), [vis.halfWidth, 1.35, 1]);
        const tmp = mat4.create();
        mat4.multiply(tmp, t, ry);
        mat4.multiply(beamModel, tmp, sc);
        mat4.normalMatrix(beamNormal, beamModel);
      }
    },

    draw(solidPass) {
      const next = tracker.nextGate;
      const pulse = 0.55 + 0.45 * Math.sin(animTime * 7);

      posts.forEach((p, i) => {
        let tint = [1, 1, 1];
        let roughness = 0.35;
        const isNext =
          p.gateId === tracker.nextIndex ||
          (next?.isFinish && p.gateId === 0);
        const isDone =
          p.gateId < tracker.nextIndex && !(next?.isFinish && p.gateId === 0);
        if (isNext) {
          tint = [
            NEXT[0] + (NEXT_HOT[0] - NEXT[0]) * pulse,
            NEXT[1],
            NEXT[2] + (NEXT_HOT[2] - NEXT[2]) * (1 - pulse),
          ];
          roughness = 0.12;
        } else if (isDone) {
          tint = DONE;
        }
        solidPass.setTransform(models[i].model, models[i].normal);
        solidPass.setMaterial({
          tint,
          roughness,
          translucency: isNext ? 0.45 * pulse : 0,
        });
        mesh.draw();
      });

      if (next && markKind(next) === 'gate') {
        solidPass.setTransform(beamModel, beamNormal);
        solidPass.setMaterial({
          tint: [0.25 + 0.75 * pulse, 1, 0.55 + 0.45 * pulse],
          roughness: 0.08,
          translucency: 0.7,
        });
        beamMesh.draw();
      }
    },

    bearingToNext(boat) {
      const g = tracker.nextGate;
      if (!g) return 0;
      const abs = Math.atan2(g.x - boat.x, g.z - boat.z);
      let d = abs - boat.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },

    distanceToNext(boat) {
      const g = tracker.nextGate;
      if (!g) return 0;
      return Math.hypot(g.x - boat.x, g.z - boat.z);
    },
  };
}

export { markKind };
