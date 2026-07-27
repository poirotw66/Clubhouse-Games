// Lit, optionally textured geometry. Ambient comes from the same sky function
// the ocean reflects, so boat and buoys sit in the same light as the scene.

import { createProgram } from './gl.js';
import { SKY_GLSL, TONEMAP_GLSL } from './shaderChunks.js';

const VERT = /* glsl */ `#version 300 es
in vec3 aPos;
in vec3 aNormal;
in vec2 aUV;
in vec3 aColor;

uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uNormalMat;

out vec3 vWorld;
out vec3 vNormal;
out vec2 vUV;
out vec3 vColor;

void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorld = world.xyz;
  vNormal = uNormalMat * aNormal;
  vUV = aUV;
  vColor = aColor;
  gl_Position = uViewProj * world;
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 vWorld;
in vec3 vNormal;
in vec2 vUV;
in vec3 vColor;
out vec4 fragColor;

uniform vec3 uCameraPos;
uniform sampler2D uTexture;
uniform float uUseTexture;
uniform vec3 uTint;
uniform float uRoughness;
uniform float uTranslucency;   // >0 lets light bleed through (sailcloth)
uniform float uUVScale;

${SKY_GLSL}
${TONEMAP_GLSL}

void main() {
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;

  vec3 viewVec = uCameraPos - vWorld;
  float dist = length(viewVec);
  vec3 V = viewVec / dist;
  vec3 sun = normalize(uSunDir);

  vec3 albedo = vColor * uTint;
  if (uUseTexture > 0.5) {
    albedo *= texture(uTexture, vUV * uUVScale).rgb;
  }

  // Hemispheric ambient sampled from the sky itself.
  vec3 ambient = skyColor(normalize(N + vec3(0.0, 0.6, 0.0))) * 0.38;
  ambient += uHorizonColor * 0.12;

  float ndl = max(dot(N, sun), 0.0);
  vec3 diffuse = vec3(1.06, 1.0, 0.92) * ndl;

  vec3 H = normalize(sun + V);
  float shininess = mix(180.0, 8.0, clamp(uRoughness, 0.0, 1.0));
  float spec = pow(max(dot(N, H), 0.0), shininess) * (1.0 - uRoughness) * 0.7;

  vec3 color = albedo * (ambient + diffuse) + vec3(spec);

  // Backlit sailcloth: sun coming through the far side of the cloth.
  if (uTranslucency > 0.0) {
    float through = max(dot(-N, sun), 0.0);
    color += albedo * through * uTranslucency * 0.75;
  }

  float fog = 1.0 - exp(-dist * 0.0034);
  color = mix(color, uHorizonColor, fog);

  fragColor = vec4(tonemap(color), 1.0);
}
`;

export const SOLID_ATTRIBUTES = [
  { name: 'aPos', size: 3 },
  { name: 'aNormal', size: 3 },
  { name: 'aUV', size: 2 },
  { name: 'aColor', size: 3 },
];

export function createSolidProgram(gl) {
  const program = createProgram(gl, VERT, FRAG, 'solid');

  return {
    program,
    begin(camera, env) {
      program.use();
      program.set('uViewProj', camera.viewProj);
      program.set('uCameraPos', camera.position);
      program.set('uSunDir', env.sunDir);
      program.set('uHorizonColor', env.horizonColor);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, env.skyTexture);
      program.setInt('uSkyTex', 1);
      return this;
    },
    /** material: { texture, tint, roughness, translucency, uvScale } */
    setMaterial(material = {}) {
      const {
        texture = null,
        tint = [1, 1, 1],
        roughness = 0.6,
        translucency = 0,
        uvScale = 1,
      } = material;
      program.set('uTint', tint);
      program.set('uRoughness', roughness);
      program.set('uTranslucency', translucency);
      program.set('uUVScale', uvScale);
      program.set('uUseTexture', texture ? 1 : 0);
      if (texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        program.setInt('uTexture', 0);
      }
      return this;
    },
    setTransform(model, normalMat) {
      program.set('uModel', model);
      program.set('uNormalMat', normalMat);
      return this;
    },
  };
}
