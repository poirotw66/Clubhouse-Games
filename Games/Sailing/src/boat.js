// Procedural sloop, modelled from the generated concept reference:
// white hull with a navy sheer stripe, teak deck, fin keel, spade rudder,
// masthead rig with a cambered mainsail and jib.

import { createMesh, loadTexture } from './gl.js';
import { SOLID_ATTRIBUTES } from './solid.js';
import { mat4, vec3, clamp } from './math.js';

export const DIMS = {
  sternZ: -3.6,
  bowZ: 4.4,
  maxHalfBeam: 1.34,
  mastZ: 0.7,
  mastHeight: 8.4,
  boomY: 1.18,
  boomLength: 3.5,
  jibFoot: 3.1,
  deckY: 0.58,
};

// ---------------------------------------------------------------- mesh builder

class Builder {
  constructor() {
    this.data = [];
    this.indices = [];
    this.vertexCount = 0;
  }

  vertex(p, n, uv, c) {
    this.data.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], c[0], c[1], c[2]);
    return this.vertexCount++;
  }

  tri(a, b, c) {
    this.indices.push(a, b, c);
  }

  /**
   * Evaluate a parametric surface on a (cols+1)x(rows+1) grid and triangulate
   * it. Normals come from central differences on the evaluated points, so any
   * shape works without hand-derived derivatives.
   */
  grid(cols, rows, evaluate, { closedU = false, uv, color } = {}) {
    const pts = [];
    for (let j = 0; j <= rows; j++) {
      const row = [];
      for (let i = 0; i <= cols; i++) {
        row.push(evaluate(i / cols, j / rows, i, j));
      }
      pts.push(row);
    }

    const base = this.vertexCount;
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        const v = j / rows;
        const p = pts[j][i];

        const iPrev = i > 0 ? i - 1 : closedU ? cols - 1 : i;
        const iNext = i < cols ? i + 1 : closedU ? 1 : i;
        const jPrev = Math.max(j - 1, 0);
        const jNext = Math.min(j + 1, rows);

        const du = vec3.sub(vec3.create(), pts[j][iNext], pts[j][iPrev]);
        const dv = vec3.sub(vec3.create(), pts[jNext][i], pts[jPrev][i]);
        let n = vec3.cross(vec3.create(), dv, du);
        if (vec3.length(n) < 1e-9) n = vec3.set(vec3.create(), 0, 1, 0);
        vec3.normalize(n, n);

        this.vertex(p, n, uv ? uv(u, v, p) : [u, v], color ? color(u, v, p) : [1, 1, 1]);
      }
    }

    const stride = cols + 1;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = base + j * stride + i;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        this.tri(a, c, b);
        this.tri(b, c, d);
      }
    }
  }

  /** Tapered cylinder between two points. */
  tube(from, to, r0, r1, color, segments = 10) {
    const axis = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), to, from));
    const ref = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const side = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), ref, axis));
    const up = vec3.cross(vec3.create(), axis, side);

    this.grid(segments, 1, (u, v) => {
      const a = u * Math.PI * 2;
      const r = v === 0 ? r0 : r1;
      const origin = v === 0 ? from : to;
      return [
        origin[0] + (side[0] * Math.cos(a) + up[0] * Math.sin(a)) * r,
        origin[1] + (side[1] * Math.cos(a) + up[1] * Math.sin(a)) * r,
        origin[2] + (side[2] * Math.cos(a) + up[2] * Math.sin(a)) * r,
      ];
    }, { closedU: true, color: () => color });
  }

  /** Axis-aligned box, optionally tapered towards +Y. */
  box(min, max, color, topScale = 1) {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const corner = (sx, sz, top) => {
      const s = top ? topScale : 1;
      return [
        cx + (sx > 0 ? x1 - cx : x0 - cx) * s,
        top ? y1 : y0,
        cz + (sz > 0 ? z1 - cz : z0 - cz) * s,
      ];
    };
    // Sides as a closed loop, then a top cap.
    const loop = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    this.grid(4, 1, (u, v) => {
      const idx = Math.min(Math.floor(u * 4 + 0.5), 4) % 4;
      const [sx, sz] = loop[idx];
      return corner(sx, sz, v > 0.5);
    }, { closedU: true, color: () => color });

    this.grid(1, 1, (u, v) => {
      const sx = u > 0.5 ? 1 : -1;
      const sz = v > 0.5 ? 1 : -1;
      return corner(sx, sz, true);
    }, { color: () => color });
  }

  build(gl, program) {
    return createMesh(
      gl,
      program,
      new Float32Array(this.data),
      new Uint32Array(this.indices),
      SOLID_ATTRIBUTES
    );
  }
}

/** Catmull-Rom through uniformly spaced control values. */
function curve(values, t) {
  const n = values.length - 1;
  const x = clamp(t, 0, 1) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const f = x - i;
  const p0 = values[Math.max(i - 1, 0)];
  const p1 = values[i];
  const p2 = values[i + 1];
  const p3 = values[Math.min(i + 2, n)];
  return 0.5 * (2 * p1 + (-p0 + p2) * f
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f
    + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
}

// Hull lines, bow-to-stern control points.
const HALF_BEAM = [0.74, 0.93, 1.0, 1.0, 0.87, 0.55, 0.06];
const SHEER_Y = [0.62, 0.58, 0.57, 0.60, 0.68, 0.82, 0.98];
const DEPTH = [0.80, 0.98, 1.04, 1.02, 0.92, 0.76, 0.55];
const SECTION_N = [1.05, 1.2, 1.35, 1.5, 1.85, 2.3, 2.8];

const stationZ = (t) => DIMS.sternZ + (DIMS.bowZ - DIMS.sternZ) * t;
const halfBeam = (t) => curve(HALF_BEAM, t) * DIMS.maxHalfBeam;
const sheerY = (t) => curve(SHEER_Y, t);
const hullDepth = (t) => curve(DEPTH, t);

const WHITE = [0.94, 0.95, 0.96];
const NAVY = [0.07, 0.13, 0.31];
const BOOT = [0.78, 0.83, 0.88];
const GREY = [0.68, 0.70, 0.73];
const DARK = [0.13, 0.15, 0.18];

function buildHull(builder) {
  builder.grid(26, 30, (u, v) => {
    const t = v;
    const phi = (u - 0.5) * Math.PI;
    const hb = halfBeam(t);
    const sy = sheerY(t);
    const d = hullDepth(t);
    const n = curve(SECTION_N, t);
    return [
      hb * Math.sin(phi),
      sy - d * Math.pow(Math.max(Math.cos(phi), 0), n),
      stationZ(t),
    ];
  }, {
    closedU: false,
    color: (u, v, p) => {
      const sy = sheerY(v);
      const below = sy - p[1];
      if (below < 0.1) return NAVY;        // sheer stripe under the deck edge
      if (p[1] < -0.16) return BOOT;       // boot top / antifouling
      return WHITE;
    },
  });

  // Transom.
  builder.grid(10, 1, (u, v) => {
    const phi = (u - 0.5) * Math.PI;
    const hb = halfBeam(0) * (v > 0.5 ? 1 : 0.999);
    const sy = sheerY(0);
    const d = hullDepth(0);
    const n = curve(SECTION_N, 0);
    const edge = [hb * Math.sin(phi), sy - d * Math.pow(Math.max(Math.cos(phi), 0), n), DIMS.sternZ];
    if (v > 0.5) return edge;
    return [edge[0] * 0.35, sy - d * 0.35, DIMS.sternZ + 0.02];
  }, { color: () => WHITE });
}

function buildDeck(builder) {
  builder.grid(12, 30, (u, v) => {
    const t = v;
    const s = u * 2 - 1;
    const hb = halfBeam(t) * 0.995;
    return [
      hb * s,
      sheerY(t) + 0.05 * (1 - s * s),
      stationZ(t),
    ];
  }, {
    uv: (u, v, p) => [p[2] * 0.28, p[0] * 0.5],
    color: () => [1, 1, 1],
  });
}

function buildFittings(builder) {
  const deck = sheerY(0.45) + 0.05;

  // Cabin trunk with a dark window band.
  builder.box([-0.66, deck - 0.02, -0.5], [0.66, deck + 0.44, 2.0], WHITE, 0.82);
  builder.box([-0.69, deck + 0.16, -0.35], [0.69, deck + 0.30, 1.55], DARK, 1.0);

  // Cockpit well.
  builder.box([-0.62, deck - 0.30, -3.0], [0.62, deck - 0.04, -0.7], [0.86, 0.87, 0.88], 1.0);

  // Mast, boom, spreaders.
  const mastBase = [0, deck - 0.05, DIMS.mastZ];
  const mastTop = [0, deck + DIMS.mastHeight, DIMS.mastZ];
  builder.tube(mastBase, mastTop, 0.085, 0.055, GREY, 12);

  // Standing rigging: forestay to the stem, shrouds to the chainplates.
  const stay = [0, DIMS.deckY + 0.16, DIMS.bowZ - 0.15];
  builder.tube(mastTop, stay, 0.018, 0.018, DARK, 5);
  builder.tube(mastTop, [-halfBeam(0.5) * 0.92, deck, DIMS.mastZ - 0.1], 0.016, 0.016, DARK, 5);
  builder.tube(mastTop, [halfBeam(0.5) * 0.92, deck, DIMS.mastZ - 0.1], 0.016, 0.016, DARK, 5);

  // Pushpit rail at the stern.
  builder.tube([-0.5, deck, -3.3], [-0.5, deck + 0.55, -3.3], 0.02, 0.02, GREY, 6);
  builder.tube([0.5, deck, -3.3], [0.5, deck + 0.55, -3.3], 0.02, 0.02, GREY, 6);
  builder.tube([-0.5, deck + 0.55, -3.3], [0.5, deck + 0.55, -3.3], 0.02, 0.02, GREY, 6);
}

function buildKeel(builder) {
  // Fin keel with a bulb-ish taper.
  builder.grid(8, 6, (u, v) => {
    const phi = (u - 0.5) * Math.PI * 2;
    const taper = 1 - 0.45 * v;
    const chord = 1.5 * taper;
    const thick = 0.17 * (1 - 0.55 * v);
    const z = 0.72 + Math.cos(phi) * chord * 0.5;
    const x = Math.sin(phi) * thick;
    return [x, -0.32 - v * 1.55, z];
  }, { closedU: true, color: () => BOOT });
}

function buildBoom(builder) {
  // Modelled along -Z from the gooseneck; the draw transform swings it.
  builder.tube([0, 0, 0], [0, 0.16, -DIMS.boomLength], 0.062, 0.05, GREY, 8);
  builder.tube([0, 0.02, -DIMS.boomLength * 0.42], [0, -0.16, -DIMS.boomLength * 0.42],
    0.018, 0.018, DARK, 5);
}

function buildRudder(builder) {
  builder.grid(8, 5, (u, v) => {
    const phi = (u - 0.5) * Math.PI * 2;
    const chord = 0.62 * (1 - 0.3 * v);
    const thick = 0.075 * (1 - 0.4 * v);
    return [
      Math.sin(phi) * thick,
      -v * 1.25,
      Math.cos(phi) * chord * 0.5,
    ];
  }, { closedU: true, color: () => BOOT });

  // Tiller, angled forward into the cockpit.
  builder.tube([0, 0.28, 0], [0, 0.52, -1.5], 0.035, 0.028, [0.45, 0.31, 0.19], 6);
}

// ------------------------------------------------------------------- the sails

const SAIL_COLS = 12;
const SAIL_ROWS = 14;
const SAIL_VERTS = (SAIL_COLS + 1) * (SAIL_ROWS + 1);

/**
 * A sail is a triangle (tack, head, clew) bulged into an aerofoil. Rebuilt on
 * the CPU each frame — only ~200 vertices, and it keeps the trim, camber and
 * luffing shake in one place.
 */
function writeSail(target, offset, tack, head, clew, camber, flutter, time, seed) {
  const plane = vec3.cross(
    vec3.create(),
    vec3.sub(vec3.create(), head, tack),
    vec3.sub(vec3.create(), clew, tack)
  );
  vec3.normalize(plane, plane);

  const pts = [];
  for (let j = 0; j <= SAIL_ROWS; j++) {
    const v = j / SAIL_ROWS;
    const luff = vec3.lerp(vec3.create(), tack, head, v);
    const leech = vec3.lerp(vec3.create(), clew, head, v);
    const row = [];
    for (let i = 0; i <= SAIL_COLS; i++) {
      const u = i / SAIL_COLS;
      const p = vec3.lerp(vec3.create(), luff, leech, u);

      // Draft: deepest around 40% of the chord, flattening towards the head.
      const draft = Math.sin(Math.PI * Math.pow(u, 0.82)) * (1 - v * v * 0.55);
      let bulge = camber * draft;

      // Luffing: the leading edge shakes when the sail loses its aerofoil.
      if (flutter > 0.001) {
        const wave = Math.sin(time * 17 + u * 9 + v * 4 + seed) * Math.sin(time * 6.3 + v * 5 + seed);
        bulge += wave * flutter * (1 - u * 0.55) * (0.25 + 0.75 * v);
      }

      row.push([
        p[0] + plane[0] * bulge,
        p[1] + plane[1] * bulge,
        p[2] + plane[2] * bulge,
      ]);
    }
    pts.push(row);
  }

  let o = offset;
  for (let j = 0; j <= SAIL_ROWS; j++) {
    for (let i = 0; i <= SAIL_COLS; i++) {
      const p = pts[j][i];
      const iPrev = Math.max(i - 1, 0);
      const iNext = Math.min(i + 1, SAIL_COLS);
      const jPrev = Math.max(j - 1, 0);
      const jNext = Math.min(j + 1, SAIL_ROWS);
      const du = vec3.sub(vec3.create(), pts[j][iNext], pts[j][iPrev]);
      const dv = vec3.sub(vec3.create(), pts[jNext][i], pts[jPrev][i]);
      let n = vec3.cross(vec3.create(), dv, du);
      if (vec3.length(n) < 1e-9) n = vec3.copy(vec3.create(), plane);
      vec3.normalize(n, n);

      target[o++] = p[0]; target[o++] = p[1]; target[o++] = p[2];
      target[o++] = n[0]; target[o++] = n[1]; target[o++] = n[2];
      target[o++] = (i / SAIL_COLS) * 1.4;
      target[o++] = (j / SAIL_ROWS) * 1.8;
      target[o++] = 1; target[o++] = 1; target[o++] = 1;
    }
  }
  return o;
}

function sailIndices(base) {
  const out = [];
  const stride = SAIL_COLS + 1;
  for (let j = 0; j < SAIL_ROWS; j++) {
    for (let i = 0; i < SAIL_COLS; i++) {
      const a = base + j * stride + i;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      out.push(a, c, b, b, c, d);
    }
  }
  return out;
}

export function createBoat(gl, solid) {
  const program = solid.program;

  const hullBuilder = new Builder();
  buildHull(hullBuilder);
  buildFittings(hullBuilder);
  const hullMesh = hullBuilder.build(gl, program);

  const deckBuilder = new Builder();
  buildDeck(deckBuilder);
  const deckMesh = deckBuilder.build(gl, program);

  const keelBuilder = new Builder();
  buildKeel(keelBuilder);
  const keelMesh = keelBuilder.build(gl, program);

  const rudderBuilder = new Builder();
  buildRudder(rudderBuilder);
  const rudderMesh = rudderBuilder.build(gl, program);

  const boomBuilder = new Builder();
  buildBoom(boomBuilder);
  const boomMesh = boomBuilder.build(gl, program);

  // Two sails share one dynamic buffer.
  const sailData = new Float32Array(SAIL_VERTS * 2 * 11);
  const sailIdx = new Uint32Array([...sailIndices(0), ...sailIndices(SAIL_VERTS)]);
  const sailVao = gl.createVertexArray();
  gl.bindVertexArray(sailVao);
  const sailVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, sailVbo);
  gl.bufferData(gl.ARRAY_BUFFER, sailData.byteLength, gl.DYNAMIC_DRAW);
  let off = 0;
  for (const attr of SOLID_ATTRIBUTES) {
    const loc = gl.getAttribLocation(program.program, attr.name);
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, attr.size, gl.FLOAT, false, 11 * 4, off);
    }
    off += attr.size * 4;
  }
  const sailIbo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sailIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sailIdx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  const deckTex = loadTexture(gl, './textures/deck.png', { fallback: [176, 132, 82] });
  const sailTex = loadTexture(gl, './textures/sail.png', { fallback: [244, 244, 240] });

  const model = mat4.create();
  const normalMat = new Float32Array(9);
  const rudderModel = mat4.create();
  const rudderNormal = new Float32Array(9);
  const boomModel = mat4.create();
  const boomNormal = new Float32Array(9);

  return {
    deckTexture: deckTex,

    /**
     * state: { position:[x,y,z], heading, pitch, roll, sailAngle, rudderAngle,
     *          side, camber, flutter, jibCamber, jibFlutter, time }
     */
    update(state) {
      const deck = sheerY(0.45) + 0.05;
      const side = state.side;
      const a = state.sailAngle * side;

      // Mainsail: tack at the gooseneck, head at the masthead, clew at the boom end.
      const tack = [0, DIMS.boomY, DIMS.mastZ - 0.08];
      const head = [0, deck + DIMS.mastHeight - 0.12, DIMS.mastZ];
      const clew = [
        Math.sin(a) * DIMS.boomLength,
        DIMS.boomY + 0.16,
        DIMS.mastZ - Math.cos(a) * DIMS.boomLength,
      ];

      // Jib: tack at the stem, head at the masthead, clew sheeted inside the shrouds.
      const jibAngle = state.sailAngle * 0.78 * side;
      const jTack = [0, DIMS.deckY + 0.18, DIMS.bowZ - 0.2];
      const jHead = [0, deck + DIMS.mastHeight - 0.3, DIMS.mastZ + 0.02];
      const jClew = [
        Math.sin(jibAngle) * DIMS.jibFoot * 0.62,
        DIMS.deckY + 0.62,
        jTack[2] - Math.cos(jibAngle) * DIMS.jibFoot * 0.86,
      ];

      let o = writeSail(sailData, 0, tack, head, clew,
        state.camber * side, state.flutter, state.time, 0);
      writeSail(sailData, o, jTack, jHead, jClew,
        state.jibCamber * side, state.jibFlutter, state.time, 2.4);

      gl.bindBuffer(gl.ARRAY_BUFFER, sailVbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, sailData);

      mat4.compose(model, state.position, state.heading, state.pitch, state.roll);
      mat4.normalMatrix(normalMat, model);

      // The rudder swings under the transom, in the hull's frame.
      const local = mat4.create();
      const t = mat4.fromTranslation(mat4.create(), [0, -0.18, DIMS.sternZ + 0.25]);
      const r = mat4.fromRotationY(mat4.create(), state.rudderAngle);
      mat4.multiply(local, t, r);
      mat4.multiply(rudderModel, model, local);
      mat4.normalMatrix(rudderNormal, rudderModel);

      // Boom pivots about the gooseneck with the mainsail.
      const bt = mat4.fromTranslation(mat4.create(), tack);
      const br = mat4.fromRotationY(mat4.create(), a);
      const bl = mat4.create();
      mat4.multiply(bl, bt, br);
      mat4.multiply(boomModel, model, bl);
      mat4.normalMatrix(boomNormal, boomModel);
    },

    draw(solidPass) {
      solidPass.setTransform(model, normalMat);

      solidPass.setMaterial({ tint: [1, 1, 1], roughness: 0.25 });
      hullMesh.draw();

      solidPass.setMaterial({ texture: deckTex, tint: [1, 1, 1], roughness: 0.7, uvScale: 1 });
      deckMesh.draw();

      solidPass.setMaterial({ tint: [1, 1, 1], roughness: 0.35 });
      keelMesh.draw();

      solidPass.setTransform(rudderModel, rudderNormal);
      rudderMesh.draw();

      solidPass.setTransform(boomModel, boomNormal);
      solidPass.setMaterial({ tint: [1, 1, 1], roughness: 0.3 });
      boomMesh.draw();

      // Sails: two-sided, backlit cloth.
      solidPass.setTransform(model, normalMat);
      solidPass.setMaterial({
        texture: sailTex,
        tint: [0.99, 0.99, 0.97],
        roughness: 0.85,
        translucency: 0.9,
      });
      gl.bindVertexArray(sailVao);
      gl.drawElements(gl.TRIANGLES, sailIdx.length, gl.UNSIGNED_INT, 0);
    },
  };
}

export { sheerY, halfBeam };
