// Racing marks: striped cylindrical buoys that bob on the Gerstner surface.
// Colours follow the generated orange/white buoy reference.

import { createMesh } from './gl.js';
import { SOLID_ATTRIBUTES } from './solid.js';
import { mat4 } from './math.js';
import { sampleWater } from './shaderChunks.js';

const ORANGE = [0.95, 0.42, 0.12];
const WHITE = [0.96, 0.96, 0.94];
const POLE = [0.75, 0.78, 0.8];

function buildBuoyMesh(gl, program, stripeCount = 6) {
  const data = [];
  const indices = [];
  let vcount = 0;

  const push = (p, n, uv, c) => {
    data.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], c[0], c[1], c[2]);
    return vcount++;
  };

  const segs = 16;
  const radius = 0.55;
  const height = 2.4;
  const bands = stripeCount;

  for (let b = 0; b < bands; b++) {
    const y0 = (b / bands) * height;
    const y1 = ((b + 1) / bands) * height;
    const color = b % 2 === 0 ? ORANGE : WHITE;
    const base = vcount;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = Math.cos(a) * radius;
      const z = Math.sin(a) * radius;
      const n = [Math.cos(a), 0, Math.sin(a)];
      push([x, y0, z], n, [i / segs, b / bands], color);
      push([x, y1, z], n, [i / segs, (b + 1) / bands], color);
    }
    for (let i = 0; i < segs; i++) {
      const a = base + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  // Cap.
  const capCenter = push([0, height, 0], [0, 1, 0], [0.5, 0.5], ORANGE);
  const capRing = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    capRing.push(push(
      [Math.cos(a) * radius, height, Math.sin(a) * radius],
      [0, 1, 0],
      [0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5],
      ORANGE
    ));
  }
  for (let i = 0; i < segs; i++) {
    indices.push(capCenter, capRing[i], capRing[(i + 1) % segs]);
  }

  // Flag pole + pennant so the next mark is readable from far away.
  const poleR = 0.04;
  const poleH = 1.6;
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

  // Triangular pennant in the buoy's accent colour (set per-instance via tint).
  const flagY = height + poleH - 0.1;
  const f0 = push([0, flagY, 0], [0, 0, 1], [0, 0], WHITE);
  const f1 = push([0, flagY - 0.55, 0], [0, 0, 1], [0, 1], WHITE);
  const f2 = push([0.95, flagY - 0.28, 0], [0, 0, 1], [1, 0.5], WHITE);
  indices.push(f0, f1, f2);

  return createMesh(gl, program, new Float32Array(data), new Uint32Array(indices), SOLID_ATTRIBUTES);
}

/**
 * Classic triangular windward course laid out relative to the prevailing wind.
 * Marks are rounded to port (left) in order.
 */
export function createCourse(windFrom = Math.PI) {
  // Wind blows toward -from direction's opposite... see sailing.js vector().
  // Unit "downwind" = direction air is going.
  const downX = -Math.sin(windFrom);
  const downZ = -Math.cos(windFrom);
  // "right" of downwind on the water plane.
  const rightX = downZ;
  const rightZ = -downX;

  const windwardDist = 170;
  const beam = 95;

  // Start slightly downwind of the leeward gate so the first beat is clean.
  const start = {
    x: downX * 40,
    z: downZ * 40,
    heading: Math.atan2(-downX, -downZ), // point upwind
  };

  const marks = [
    {
      id: 1,
      name: '頂標',
      x: -downX * windwardDist,
      z: -downZ * windwardDist,
      tint: [1.0, 0.95, 0.9],
    },
    {
      id: 2,
      name: '橫標',
      x: -downX * 20 + rightX * beam,
      z: -downZ * 20 + rightZ * beam,
      tint: [0.95, 0.95, 1.0],
    },
    {
      id: 3,
      name: '尾標',
      x: downX * 55,
      z: downZ * 55,
      tint: [1.0, 0.92, 0.85],
    },
  ];

  return { start, marks, roundingRadius: 9 };
}

export function createMarks(gl, solid, course) {
  const mesh = buildBuoyMesh(gl, solid.program);
  const models = course.marks.map(() => ({
    model: mat4.create(),
    normal: new Float32Array(9),
  }));

  return {
    update(time, waveAmp) {
      course.marks.forEach((m, i) => {
        const s = sampleWater(m.x, m.z, time, waveAmp);
        m.y = s.y;
        // Bob + slight lean with the local wave slope.
        const pitch = Math.atan(-s.nz) * 0.35;
        const roll = Math.atan(s.nx) * 0.35;
        mat4.compose(models[i].model, [m.x, s.y - 0.35, m.z], 0, pitch, roll, 1);
        mat4.normalMatrix(models[i].normal, models[i].model);
      });
    },

    draw(solidPass) {
      course.marks.forEach((m, i) => {
        solidPass.setTransform(models[i].model, models[i].normal);
        solidPass.setMaterial({ tint: m.tint, roughness: 0.35 });
        mesh.draw();
      });
    },

    /** Index of the next mark the boat should round, or -1 if finished. */
    hitTest(boat, nextIndex) {
      if (nextIndex < 0 || nextIndex >= course.marks.length) return false;
      const m = course.marks[nextIndex];
      const d = Math.hypot(boat.x - m.x, boat.z - m.z);
      return d < course.roundingRadius;
    },
  };
}
