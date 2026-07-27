// Ocean surface: a radially-warped grid that follows the boat, displaced by the
// shared Gerstner sum. Dense near the camera, coarse out to the horizon.

import { createProgram, createMesh, loadTexture } from './gl.js';
import { WAVE_GLSL, SKY_GLSL, TONEMAP_GLSL, packWaves } from './shaderChunks.js';

const RADIUS = 900;
const GRID = 208;
export const WAKE_POINTS = 32;

const VERT = /* glsl */ `#version 300 es
in vec2 aLocal;

uniform mat4 uViewProj;
uniform vec2 uCenter;

${WAVE_GLSL}

out vec3 vWorld;
out vec3 vNormal;
out float vCrest;

void main() {
  vec2 p = aLocal + uCenter;
  vec3 normal;
  float crest;
  vec3 pos = gerstner(p, normal, crest);
  vWorld = pos;
  vNormal = normal;
  vCrest = crest;
  gl_Position = uViewProj * vec4(pos, 1.0);
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 vWorld;
in vec3 vNormal;
in float vCrest;
out vec4 fragColor;

uniform vec3 uCameraPos;
uniform sampler2D uRipples;
uniform vec3 uWake[${WAKE_POINTS}];
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform float uWindStrength;
uniform float uTime;

${SKY_GLSL}
${TONEMAP_GLSL}

// Tangent-space perturbation from the ripple height map.
vec3 rippleNormal(vec2 p, float scale, vec2 drift, float strength) {
  vec2 uv = p / scale + drift;
  float e = 1.5 / 1024.0;
  float hx = texture(uRipples, uv + vec2(e, 0.0)).r - texture(uRipples, uv - vec2(e, 0.0)).r;
  float hz = texture(uRipples, uv + vec2(0.0, e)).r - texture(uRipples, uv - vec2(0.0, e)).r;
  return vec3(-hx * strength, 0.0, -hz * strength);
}

void main() {
  vec3 viewVec = uCameraPos - vWorld;
  float dist = length(viewVec);
  vec3 V = viewVec / dist;

  // Fine detail fades out with distance to stop the normals aliasing.
  float detailFade = exp(-dist * 0.011);
  vec3 N = normalize(vNormal);
  if (detailFade > 0.004) {
    vec3 d1 = rippleNormal(vWorld.xz, 9.0, vec2(uTime * 0.010, uTime * 0.014), 2.6);
    vec3 d2 = rippleNormal(vWorld.xz, 3.1, vec2(uTime * -0.021, uTime * 0.017), 1.5);
    N = normalize(N + (d1 + d2) * detailFade * (0.5 + 0.5 * uWindStrength));
  }

  vec3 sun = normalize(uSunDir);
  vec3 R = reflect(-V, N);
  R.y = abs(R.y);                       // never sample straight into the sea
  vec3 reflection = skyColor(R);

  // Fresnel (Schlick) drives the reflection/transmission blend.
  float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);

  // Subsurface: wave crests glow where light passes through the water.
  float lift = clamp(vCrest * 0.85, 0.0, 1.0);
  vec3 body = mix(uDeepColor, uShallowColor, lift);
  body += uShallowColor * pow(max(dot(V, -sun), 0.0), 3.0) * lift * 0.5;

  vec3 color = mix(body, reflection, fres);

  // Sun glitter.
  vec3 H = normalize(sun + V);
  color += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, H), 0.0), 220.0) * 2.2;

  // Foam on the steepest crests.
  float foam = smoothstep(0.55, 0.95, vCrest) * (0.35 + 0.65 * uWindStrength);

  // Wake: gaussian blobs along the boat's recent track.
  float nearBoat = distance(vWorld.xz, uWake[0].xy);
  if (nearBoat < 110.0) {
    float wake = 0.0;
    for (int i = 0; i < ${WAKE_POINTS}; i++) {
      vec3 w = uWake[i];
      if (w.z <= 0.001) continue;
      float d = distance(vWorld.xz, w.xy);
      float radius = 1.1 + float(i) * 0.26;
      wake = max(wake, w.z * exp(-(d * d) / (radius * radius)));
    }
    float texFoam = texture(uRipples, vWorld.xz / 2.6 + vec2(uTime * 0.02)).r;
    foam = max(foam, smoothstep(0.12, 0.75, wake * (0.65 + 0.7 * texFoam)));
  }

  color = mix(color, vec3(0.94, 0.97, 1.0), clamp(foam, 0.0, 1.0));

  // Blend into the horizon haze so sea and sky meet seamlessly.
  float fog = 1.0 - exp(-dist * 0.0034);
  fog = max(fog, smoothstep(${(RADIUS * 0.72).toFixed(1)}, ${RADIUS.toFixed(1)}, dist));
  color = mix(color, uHorizonColor, fog);

  fragColor = vec4(tonemap(color), 1.0);
}
`;

/**
 * Grid in [-1,1]^2 warped radially so cells are ~0.5m near the boat and
 * hundreds of metres at the horizon, without changing vertex count.
 */
function buildGrid() {
  const verts = new Float32Array((GRID + 1) * (GRID + 1) * 2);
  const warp = (t) => {
    const s = Math.sign(t);
    const a = Math.abs(t);
    return s * (0.06 * a + 0.94 * a * a * a) * RADIUS;
  };

  let p = 0;
  for (let j = 0; j <= GRID; j++) {
    const v = (j / GRID) * 2 - 1;
    for (let i = 0; i <= GRID; i++) {
      const u = (i / GRID) * 2 - 1;
      verts[p++] = warp(u);
      verts[p++] = warp(v);
    }
  }

  const quads = GRID * GRID;
  const indices = new Uint32Array(quads * 6);
  let q = 0;
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = j * (GRID + 1) + i;
      const b = a + 1;
      const c = a + GRID + 1;
      const d = c + 1;
      indices[q++] = a; indices[q++] = c; indices[q++] = b;
      indices[q++] = b; indices[q++] = c; indices[q++] = d;
    }
  }
  return { verts, indices };
}

export function createOcean(gl) {
  const program = createProgram(gl, VERT, FRAG, 'ocean');
  const { verts, indices } = buildGrid();
  const mesh = createMesh(gl, program, verts, indices, [{ name: 'aLocal', size: 2 }]);
  const ripples = loadTexture(gl, './textures/ripples.png', { fallback: [128, 128, 128] });
  const { waveA, waveB } = packWaves();
  const skyTexture = { value: null };
  const wake = new Float32Array(WAKE_POINTS * 3);

  return {
    /** The sky texture is shared so reflections match the backdrop exactly. */
    useSkyTexture(tex) {
      skyTexture.value = tex;
    },

    /** trail: newest-first list of { x, z, strength }. */
    setWake(trail) {
      wake.fill(0);
      for (let i = 0; i < Math.min(trail.length, WAKE_POINTS); i++) {
        wake[i * 3] = trail[i].x;
        wake[i * 3 + 1] = trail[i].z;
        wake[i * 3 + 2] = trail[i].strength;
      }
    },

    draw(camera, env, center) {
      program.use();
      program.set('uViewProj', camera.viewProj);
      program.set('uCameraPos', camera.position);
      program.set('uCenter', center);
      program.set('uTime', env.time);
      program.set('uWaveAmp', env.waveAmp);
      program.set('uWaveA', waveA);
      program.set('uWaveB', waveB);
      program.set('uSunDir', env.sunDir);
      program.set('uHorizonColor', env.horizonColor);
      program.set('uDeepColor', env.deepColor);
      program.set('uShallowColor', env.shallowColor);
      program.set('uWindStrength', env.windStrength);
      program.set('uWake', wake);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ripples);
      program.setInt('uRipples', 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, skyTexture.value);
      program.setInt('uSkyTex', 1);

      mesh.draw();
    },
  };
}
