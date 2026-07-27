// Minimal column-major mat4 / vec3 helpers (gl-matrix conventions, no dependency).

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed difference between two angles, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Frame-rate independent exponential smoothing factor. */
export function damp(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

export const vec3 = {
  create: () => new Float32Array(3),
  set: (o, x, y, z) => {
    o[0] = x;
    o[1] = y;
    o[2] = z;
    return o;
  },
  copy: (o, a) => {
    o[0] = a[0];
    o[1] = a[1];
    o[2] = a[2];
    return o;
  },
  add: (o, a, b) => {
    o[0] = a[0] + b[0];
    o[1] = a[1] + b[1];
    o[2] = a[2] + b[2];
    return o;
  },
  sub: (o, a, b) => {
    o[0] = a[0] - b[0];
    o[1] = a[1] - b[1];
    o[2] = a[2] - b[2];
    return o;
  },
  scale: (o, a, s) => {
    o[0] = a[0] * s;
    o[1] = a[1] * s;
    o[2] = a[2] * s;
    return o;
  },
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (o, a, b) => {
    const ax = a[0], ay = a[1], az = a[2];
    const bx = b[0], by = b[1], bz = b[2];
    o[0] = ay * bz - az * by;
    o[1] = az * bx - ax * bz;
    o[2] = ax * by - ay * bx;
    return o;
  },
  length: (a) => Math.hypot(a[0], a[1], a[2]),
  normalize: (o, a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    o[0] = a[0] / l;
    o[1] = a[1] / l;
    o[2] = a[2] / l;
    return o;
  },
  lerp: (o, a, b, t) => {
    o[0] = a[0] + (b[0] - a[0]) * t;
    o[1] = a[1] + (b[1] - a[1]) * t;
    o[2] = a[2] + (b[2] - a[2]) * t;
    return o;
  },
};

export const mat4 = {
  create() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },

  identity(o) {
    o.fill(0);
    o[0] = o[5] = o[10] = o[15] = 1;
    return o;
  },

  copy(o, a) {
    o.set(a);
    return o;
  },

  /** o = a * b (apply b first, then a). */
  multiply(o, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  },

  perspective(o, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    o.fill(0);
    o[0] = f / aspect;
    o[5] = f;
    o[11] = -1;
    o[10] = (far + near) / (near - far);
    o[14] = (2 * far * near) / (near - far);
    return o;
  },

  lookAt(o, eye, center, up) {
    const z = vec3.normalize(vec3.create(), vec3.sub(vec3.create(), eye, center));
    const x = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), up, z));
    const y = vec3.cross(vec3.create(), z, x);
    o[0] = x[0]; o[1] = y[0]; o[2] = z[0]; o[3] = 0;
    o[4] = x[1]; o[5] = y[1]; o[6] = z[1]; o[7] = 0;
    o[8] = x[2]; o[9] = y[2]; o[10] = z[2]; o[11] = 0;
    o[12] = -vec3.dot(x, eye);
    o[13] = -vec3.dot(y, eye);
    o[14] = -vec3.dot(z, eye);
    o[15] = 1;
    return o;
  },

  fromTranslation(o, v) {
    mat4.identity(o);
    o[12] = v[0];
    o[13] = v[1];
    o[14] = v[2];
    return o;
  },

  fromScaling(o, v) {
    o.fill(0);
    o[0] = v[0];
    o[5] = v[1];
    o[10] = v[2];
    o[15] = 1;
    return o;
  },

  fromRotationY(o, r) {
    const s = Math.sin(r), c = Math.cos(r);
    mat4.identity(o);
    o[0] = c; o[2] = -s;
    o[8] = s; o[10] = c;
    return o;
  },

  fromRotationX(o, r) {
    const s = Math.sin(r), c = Math.cos(r);
    mat4.identity(o);
    o[5] = c; o[6] = s;
    o[9] = -s; o[10] = c;
    return o;
  },

  fromRotationZ(o, r) {
    const s = Math.sin(r), c = Math.cos(r);
    mat4.identity(o);
    o[0] = c; o[1] = s;
    o[4] = -s; o[5] = c;
    return o;
  },

  /** Rigid transform: translate(pos) * rotY(yaw) * rotZ(roll) * rotX(pitch) * scale(s). */
  compose(o, pos, yaw, pitch, roll, scale = 1) {
    const t = mat4.fromTranslation(mat4.create(), pos);
    const ry = mat4.fromRotationY(mat4.create(), yaw);
    const rz = mat4.fromRotationZ(mat4.create(), roll);
    const rx = mat4.fromRotationX(mat4.create(), pitch);
    const tmp = mat4.create();
    mat4.multiply(tmp, t, ry);
    mat4.multiply(o, tmp, rz);
    mat4.multiply(tmp, o, rx);
    if (scale !== 1) {
      const s = mat4.fromScaling(mat4.create(), [scale, scale, scale]);
      mat4.multiply(o, tmp, s);
    } else {
      mat4.copy(o, tmp);
    }
    return o;
  },

  invert(o, a) {
    const b00 = a[0] * a[5] - a[1] * a[4];
    const b01 = a[0] * a[6] - a[2] * a[4];
    const b02 = a[0] * a[7] - a[3] * a[4];
    const b03 = a[1] * a[6] - a[2] * a[5];
    const b04 = a[1] * a[7] - a[3] * a[5];
    const b05 = a[2] * a[7] - a[3] * a[6];
    const b06 = a[8] * a[13] - a[9] * a[12];
    const b07 = a[8] * a[14] - a[10] * a[12];
    const b08 = a[8] * a[15] - a[11] * a[12];
    const b09 = a[9] * a[14] - a[10] * a[13];
    const b10 = a[9] * a[15] - a[11] * a[13];
    const b11 = a[10] * a[15] - a[11] * a[14];
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det;
    o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
    o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det;
    o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det;
    o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
    o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det;
    o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det;
    o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
    o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det;
    o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det;
    o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
    o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det;
    o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
    return o;
  },

  transpose(o, a) {
    const t = [a[0], a[4], a[8], a[12], a[1], a[5], a[9], a[13],
               a[2], a[6], a[10], a[14], a[3], a[7], a[11], a[15]];
    o.set(t);
    return o;
  },

  /** Upper-left 3x3 inverse-transpose, written as a mat3 (9 floats). */
  normalMatrix(o, a) {
    const inv = mat4.invert(mat4.create(), a);
    if (!inv) {
      o.set([1, 0, 0, 0, 1, 0, 0, 0, 1]);
      return o;
    }
    mat4.transpose(inv, inv);
    o[0] = inv[0]; o[1] = inv[1]; o[2] = inv[2];
    o[3] = inv[4]; o[4] = inv[5]; o[5] = inv[6];
    o[6] = inv[8]; o[7] = inv[9]; o[8] = inv[10];
    return o;
  },
};
