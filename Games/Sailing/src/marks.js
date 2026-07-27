// Fixed checkpoint course: each gate is a pair of buoys you must sail through
// in order. Timing is wall-clock from GO until the finish gate.

import { createMesh } from './gl.js';
import { SOLID_ATTRIBUTES } from './solid.js';
import { mat4 } from './math.js';
import { sampleWater } from './shaderChunks.js';

const ORANGE = [0.95, 0.42, 0.12];
const WHITE = [0.96, 0.96, 0.94];
const POLE = [0.75, 0.78, 0.8];
const NEXT = [0.35, 0.95, 0.75];
const DONE = [0.55, 0.6, 0.65];

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
    push([0, flagY, 0], [0, 0, 1], [0, 0], WHITE),
    push([0, flagY - 0.55, 0], [0, 0, 1], [0, 1], WHITE),
    push([1.05, flagY - 0.28, 0], [0, 0, 1], [1, 0.5], WHITE)
  );

  return createMesh(gl, program, new Float32Array(data), new Uint32Array(indices), SOLID_ATTRIBUTES);
}

/**
 * Fixed world-space course (does not drift with wind shifts).
 * Each gate: center (x,z), facing = direction you should sail *through* the gate,
 * halfWidth = lateral half-span of the gate line.
 */
export function createCourse() {
  // Closed loop: start gate → windward → reach → leeward → finish (= start).
  const gates = [
    { id: 0, name: '起航門', x: 0, z: 55, facing: Math.PI, halfWidth: 14, isStart: true },
    { id: 1, name: '檢查點 1', x: -95, z: -30, facing: -Math.PI * 0.65, halfWidth: 13 },
    { id: 2, name: '檢查點 2', x: -20, z: -175, facing: -Math.PI * 0.15, halfWidth: 14 },
    { id: 3, name: '檢查點 3', x: 115, z: -55, facing: Math.PI * 0.55, halfWidth: 13 },
    { id: 4, name: '終點門', x: 0, z: 55, facing: 0, halfWidth: 14, isFinish: true },
  ];

  // Rolling start just before the start gate, already on a reach.
  const start = {
    x: 28,
    z: 78,
    heading: Math.PI + 0.55,
  };

  return { start, gates };
}

function gateAxes(gate) {
  const fx = Math.sin(gate.facing);
  const fz = Math.cos(gate.facing);
  // Right of facing on XZ.
  return { fx, fz, rx: fz, rz: -fx };
}

function gatePosts(gate) {
  const { rx, rz } = gateAxes(gate);
  return {
    left: { x: gate.x - rx * gate.halfWidth, z: gate.z - rz * gate.halfWidth },
    right: { x: gate.x + rx * gate.halfWidth, z: gate.z + rz * gate.halfWidth },
  };
}

/** Signed distance along gate facing; lateral offset across the gate. */
function gateLocal(boat, gate) {
  const { fx, fz, rx, rz } = gateAxes(gate);
  const dx = boat.x - gate.x;
  const dz = boat.z - gate.z;
  return {
    along: dx * fx + dz * fz,
    across: dx * rx + dz * rz,
  };
}

export function createMarks(gl, solid, course) {
  const mesh = buildBuoyMesh(gl, solid.program);
  const posts = [];
  for (const gate of course.gates) {
    // Finish reuses the start posts visually — skip duplicate draw for id 4.
    if (gate.isFinish) continue;
    const p = gatePosts(gate);
    posts.push({ gateId: gate.id, x: p.left.x, z: p.left.z });
    posts.push({ gateId: gate.id, x: p.right.x, z: p.right.z });
  }

  const models = posts.map(() => ({
    model: mat4.create(),
    normal: new Float32Array(9),
  }));

  let nextIndex = 0;
  // Track which side of the *current* gate the boat was on last frame.
  let prevAlong = null;

  return {
    get nextIndex() {
      return nextIndex;
    },
    get nextGate() {
      return course.gates[nextIndex] || null;
    },
    get posts() {
      return posts;
    },
    get gates() {
      return course.gates;
    },

    reset(boat) {
      nextIndex = 0;
      const g = course.gates[0];
      prevAlong = gateLocal(boat, g).along;
    },

    /**
     * Returns { cleared: gate, index } when the boat crosses the next gate
     * in the forward direction within the posts; otherwise null.
     */
    tryClear(boat) {
      if (nextIndex >= course.gates.length) return null;
      const gate = course.gates[nextIndex];
      // Finish gate shares geometry with start; use finish facing.
      const local = gateLocal(boat, gate);
      if (prevAlong === null) {
        prevAlong = local.along;
        return null;
      }

      const within = Math.abs(local.across) <= gate.halfWidth * 1.05;
      // Cross from behind (negative along) to ahead (positive along).
      const crossed = prevAlong < 0.4 && local.along >= 0.4 && within;
      prevAlong = local.along;

      if (!crossed) return null;

      const cleared = gate;
      const index = nextIndex;
      nextIndex += 1;
      if (nextIndex < course.gates.length) {
        prevAlong = gateLocal(boat, course.gates[nextIndex]).along;
      }
      return { cleared, index };
    },

    update(time, waveAmp) {
      posts.forEach((p, i) => {
        const s = sampleWater(p.x, p.z, time, waveAmp);
        const pitch = Math.atan(-s.nz) * 0.35;
        const roll = Math.atan(s.nx) * 0.35;
        mat4.compose(models[i].model, [p.x, s.y - 0.35, p.z], 0, pitch, roll, 1);
        mat4.normalMatrix(models[i].normal, models[i].model);
      });
    },

    draw(solidPass) {
      const next = course.gates[nextIndex];
      posts.forEach((p, i) => {
        let tint = [1, 1, 1];
        const isNext =
          p.gateId === nextIndex ||
          (next?.isFinish && p.gateId === 0);
        const isDone =
          p.gateId < nextIndex && !(next?.isFinish && p.gateId === 0);
        if (isNext) tint = NEXT;
        else if (isDone) tint = DONE;
        solidPass.setTransform(models[i].model, models[i].normal);
        solidPass.setMaterial({ tint, roughness: 0.35 });
        mesh.draw();
      });
    },

    /** Bearing from boat to next gate center, relative to boat heading (−PI..PI). */
    bearingToNext(boat) {
      const g = this.nextGate;
      if (!g) return 0;
      const abs = Math.atan2(g.x - boat.x, g.z - boat.z);
      let d = abs - boat.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },

    distanceToNext(boat) {
      const g = this.nextGate;
      if (!g) return 0;
      return Math.hypot(g.x - boat.x, g.z - boat.z);
    },
  };
}

export { gatePosts, gateLocal };
