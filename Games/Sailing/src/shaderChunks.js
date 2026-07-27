// GLSL fragments shared between passes, plus the CPU-side twin of the wave
// function. The ocean surface must agree exactly between GPU (rendering) and
// CPU (buoyancy), so both are generated from the same WAVES table below.

export const WAVE_COUNT = 4;

/**
 * dir is a unit vector on the XZ plane, length in world units, steepness in
 * [0,1] (higher = sharper crests). Kept well under the sum that would pinch
 * the surface into loops.
 */
export const WAVES = [
  { dir: [0.98, 0.2], length: 44.0, amplitude: 0.58, steepness: 0.62, speed: 0.62 },
  { dir: [0.79, -0.61], length: 27.0, amplitude: 0.34, steepness: 0.58, speed: 0.72 },
  { dir: [0.5, 0.87], length: 14.5, amplitude: 0.17, steepness: 0.5, speed: 0.85 },
  { dir: [-0.31, 0.95], length: 7.6, amplitude: 0.075, steepness: 0.45, speed: 1.0 },
];

/** Packed for upload: vec4(dirX, dirZ, amplitude, wavelength) + vec2(steepness, speed). */
export function packWaves() {
  const a = new Float32Array(WAVE_COUNT * 4);
  const b = new Float32Array(WAVE_COUNT * 2);
  WAVES.forEach((w, i) => {
    const len = Math.hypot(w.dir[0], w.dir[1]) || 1;
    a[i * 4] = w.dir[0] / len;
    a[i * 4 + 1] = w.dir[1] / len;
    a[i * 4 + 2] = w.amplitude;
    a[i * 4 + 3] = w.length;
    b[i * 2] = w.steepness;
    b[i * 2 + 1] = w.speed;
  });
  return { waveA: a, waveB: b };
}

/**
 * CPU twin of gerstner() below. Returns displaced position and normal at a
 * reference point, used for floating the boat and buoys on the surface.
 * `amp` scales the whole sea state (calm .. rough).
 */
export function sampleWater(x, z, time, amp = 1) {
  let px = x, py = 0, pz = z;
  let bx = 1, by = 0, bz = 0; // dP/dx
  let tx = 0, ty = 0, tz = 1; // dP/dz

  for (const w of WAVES) {
    const len = Math.hypot(w.dir[0], w.dir[1]) || 1;
    const dx = w.dir[0] / len;
    const dz = w.dir[1] / len;
    const k = (Math.PI * 2) / w.length;
    const c = Math.sqrt(9.81 / k) * w.speed;
    const A = w.amplitude * amp;
    const phase = k * (dx * x + dz * z) - c * k * time;
    const s = Math.sin(phase);
    const cs = Math.cos(phase);
    const Q = w.steepness / (k * A * WAVE_COUNT || 1);
    const QA = Q * A;

    px += QA * dx * cs;
    pz += QA * dz * cs;
    py += A * s;

    bx -= Q * A * k * dx * dx * s;
    by += dx * A * k * cs;
    bz -= Q * A * k * dx * dz * s;

    tx -= Q * A * k * dx * dz * s;
    ty += dz * A * k * cs;
    tz -= Q * A * k * dz * dz * s;
  }

  // n = normalize(cross(T, B))
  const nx = ty * bz - tz * by;
  const ny = tz * bx - tx * bz;
  const nz = tx * by - ty * bx;
  const nl = Math.hypot(nx, ny, nz) || 1;

  return {
    x: px, y: py, z: pz,
    nx: nx / nl, ny: ny / nl, nz: nz / nl,
  };
}

/** Height only — cheaper, for buoys and spray. */
export function waterHeight(x, z, time, amp = 1) {
  let y = 0;
  for (const w of WAVES) {
    const len = Math.hypot(w.dir[0], w.dir[1]) || 1;
    const k = (Math.PI * 2) / w.length;
    const c = Math.sqrt(9.81 / k) * w.speed;
    const phase = k * ((w.dir[0] / len) * x + (w.dir[1] / len) * z) - c * k * time;
    y += w.amplitude * amp * Math.sin(phase);
  }
  return y;
}

export const WAVE_GLSL = /* glsl */ `
#define WAVE_COUNT ${WAVE_COUNT}
uniform vec4 uWaveA[WAVE_COUNT];   // dirX, dirZ, amplitude, wavelength
uniform vec2 uWaveB[WAVE_COUNT];   // steepness, speed
uniform float uTime;
uniform float uWaveAmp;

// Sum of Gerstner waves. Returns displaced position; writes surface basis.
vec3 gerstner(vec2 p, out vec3 normal, out float crest) {
  vec3 pos = vec3(p.x, 0.0, p.y);
  vec3 bino = vec3(1.0, 0.0, 0.0);
  vec3 tang = vec3(0.0, 0.0, 1.0);
  crest = 0.0;

  for (int i = 0; i < WAVE_COUNT; i++) {
    vec2 dir = uWaveA[i].xy;
    float amp = uWaveA[i].z * uWaveAmp;
    float wavelength = uWaveA[i].w;
    float steep = uWaveB[i].x;
    float speed = uWaveB[i].y;

    float k = 6.28318530718 / wavelength;
    float c = sqrt(9.81 / k) * speed;
    float phase = k * dot(dir, p) - c * k * uTime;
    float s = sin(phase);
    float cs = cos(phase);
    float Q = steep / max(k * amp * float(WAVE_COUNT), 0.0001);
    float QA = Q * amp;

    pos.x += QA * dir.x * cs;
    pos.z += QA * dir.y * cs;
    pos.y += amp * s;

    bino.x -= Q * amp * k * dir.x * dir.x * s;
    bino.y += dir.x * amp * k * cs;
    bino.z -= Q * amp * k * dir.x * dir.y * s;

    tang.x -= Q * amp * k * dir.x * dir.y * s;
    tang.y += dir.y * amp * k * cs;
    tang.z -= Q * amp * k * dir.y * dir.y * s;

    // Sharp crests contribute foam; weight the short waves less.
    crest += max(s, 0.0) * amp * (1.0 - 0.5 * float(i) / float(WAVE_COUNT));
  }

  normal = normalize(cross(tang, bino));
  return pos;
}
`;

export const SKY_GLSL = /* glsl */ `
uniform sampler2D uSkyTex;
uniform vec3 uSunDir;
uniform vec3 uHorizonColor;

// The panorama has the horizon band near the bottom of the image; map
// elevation 0..90 degrees onto v = HORIZON_V..1 (texture is flipped on upload).
const float HORIZON_V = 0.14;

vec3 skyColor(vec3 dir) {
  vec3 d = normalize(dir);
  float az = atan(d.z, d.x);
  float u = az / 6.28318530718 + 0.5;
  float elev = asin(clamp(d.y, -1.0, 1.0));

  float t = clamp(elev / 1.5707963, 0.0, 1.0);
  // Ease so the horizon haze stays compressed near the skyline.
  t = pow(t, 0.65);
  float v = mix(HORIZON_V, 1.0, t);

  vec3 col = texture(uSkyTex, vec2(u, v)).rgb;

  // Below the horizon (only reached by reflection rays) fade to haze.
  if (d.y < 0.0) {
    col = mix(uHorizonColor, col, exp(d.y * 8.0));
  }

  // Sun disc + broad glow.
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.92, 0.75) * pow(sd, 900.0) * 4.0;
  col += vec3(1.0, 0.85, 0.6) * pow(sd, 18.0) * 0.28;
  return col;
}
`;

/** Cheap ACES-style tonemap + gamma, shared by every pass that writes colour. */
export const TONEMAP_GLSL = /* glsl */ `
vec3 tonemap(vec3 x) {
  x *= 1.02;
  vec3 c = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}
`;
