// Sky pass: a single fullscreen triangle with the view ray reconstructed from
// the inverse view-projection, so there is no dome mesh to tessellate.

import { createProgram, createMesh, loadTexture } from './gl.js';
import { SKY_GLSL, TONEMAP_GLSL } from './shaderChunks.js';

const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vClip;
void main() {
  vClip = aPos;
  gl_Position = vec4(aPos, 1.0, 1.0);
}
`;

const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vClip;
out vec4 fragColor;

uniform mat4 uInvViewProj;
uniform vec3 uCameraPos;

${SKY_GLSL}
${TONEMAP_GLSL}

void main() {
  vec4 far = uInvViewProj * vec4(vClip, 1.0, 1.0);
  vec3 dir = normalize(far.xyz / far.w - uCameraPos);
  fragColor = vec4(tonemap(skyColor(dir)), 1.0);
}
`;

export function createSky(gl) {
  const program = createProgram(gl, VERT, FRAG, 'sky');
  const mesh = createMesh(
    gl,
    program,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    null,
    [{ name: 'aPos', size: 2 }]
  );
  const texture = loadTexture(gl, './textures/sky.png', {
    repeat: false,
    fallback: [120, 170, 220],
  });

  return {
    texture,
    draw(camera, env) {
      gl.depthMask(false);
      gl.disable(gl.DEPTH_TEST);
      program.use();
      program.set('uInvViewProj', camera.invViewProj);
      program.set('uCameraPos', camera.position);
      program.set('uSunDir', env.sunDir);
      program.set('uHorizonColor', env.horizonColor);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      program.setInt('uSkyTex', 0);
      mesh.draw();
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
    },
  };
}
