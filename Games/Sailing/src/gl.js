// Thin WebGL2 helpers: shader compilation, mesh upload, texture loading.

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WEBGL2_UNSUPPORTED');
  return gl;
}

function compile(gl, type, source, label) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed (${label}):\n${log}`);
  }
  return shader;
}

/**
 * Build a program and eagerly cache every active uniform location.
 * Returns { program, uniforms, use(), set(name, value) }.
 */
export function createProgram(gl, vertexSource, fragmentSource, label = 'program') {
  const vs = compile(gl, gl.VERTEX_SHADER, vertexSource, `${label}.vert`);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource, `${label}.frag`);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed (${label}):\n${log}`);
  }

  // Cache loc + GLSL type so packed arrays (e.g. vec4[4] = 16 floats) are not
  // mistaken for mat4 by length heuristics.
  const uniforms = new Map();
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms.set(name, {
      loc: gl.getUniformLocation(program, name),
      type: info.type,
      size: info.size,
    });
  }

  return {
    program,
    uniforms,
    use() {
      gl.useProgram(program);
      return this;
    },
    /** Type-dispatched uniform setter; unknown names are ignored. */
    set(name, value) {
      const u = uniforms.get(name);
      if (!u || u.loc === null) return this;
      const { loc, type } = u;
      switch (type) {
        case gl.FLOAT:
          if (typeof value === 'number') gl.uniform1f(loc, value);
          else gl.uniform1fv(loc, value);
          break;
        case gl.FLOAT_VEC2:
          gl.uniform2fv(loc, value);
          break;
        case gl.FLOAT_VEC3:
          gl.uniform3fv(loc, value);
          break;
        case gl.FLOAT_VEC4:
          gl.uniform4fv(loc, value);
          break;
        case gl.FLOAT_MAT3:
          gl.uniformMatrix3fv(loc, false, value);
          break;
        case gl.FLOAT_MAT4:
          gl.uniformMatrix4fv(loc, false, value);
          break;
        case gl.INT:
        case gl.SAMPLER_2D:
        case gl.BOOL:
          if (typeof value === 'boolean') gl.uniform1i(loc, value ? 1 : 0);
          else if (typeof value === 'number') gl.uniform1i(loc, value);
          else gl.uniform1iv(loc, value);
          break;
        default:
          console.warn(`[sailing] unsupported uniform type for ${name}: ${type}`);
      }
      return this;
    },
    setInt(name, value) {
      const u = uniforms.get(name);
      if (u?.loc) gl.uniform1i(u.loc, value);
      return this;
    },
  };
}

/**
 * Upload an interleaved mesh.
 * attributes: [{ name, size }] laid out in order; data is a flat Float32Array.
 */
export function createMesh(gl, program, data, indices, attributes) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  const stride = attributes.reduce((sum, a) => sum + a.size, 0) * 4;
  let offset = 0;
  for (const attr of attributes) {
    const loc = gl.getAttribLocation(program.program, attr.name);
    if (loc >= 0) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, attr.size, gl.FLOAT, false, stride, offset);
    }
    offset += attr.size * 4;
  }

  let ibo = null;
  let count = data.length / (stride / 4);
  if (indices) {
    ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    count = indices.length;
  }

  gl.bindVertexArray(null);

  return {
    vao,
    count,
    indexed: !!indices,
    type: indices instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT,
    draw(mode = gl.TRIANGLES) {
      gl.bindVertexArray(vao);
      if (this.indexed) gl.drawElements(mode, this.count, this.type, 0);
      else gl.drawArrays(mode, 0, this.count);
    },
    dispose() {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(vbo);
      if (ibo) gl.deleteBuffer(ibo);
    },
  };
}

/** 1x1 placeholder so draws are valid before the real image decodes. */
function placeholder(gl, rgb) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([rgb[0], rgb[1], rgb[2], 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

/**
 * Load a texture, returning immediately with a solid-colour placeholder that is
 * replaced in-place once the image decodes. Never rejects: a failed image just
 * keeps the placeholder so the game still runs.
 */
export function loadTexture(gl, url, { repeat = true, fallback = [128, 128, 128], anisotropy = true } = {}) {
  const tex = placeholder(gl, fallback);
  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (anisotropy) {
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) {
        const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
      }
    }
  };
  image.onerror = () => {
    console.warn(`[sailing] texture failed to load: ${url} — using flat colour`);
  };
  image.src = url;
  return tex;
}

export function bindTextures(gl, program, entries) {
  entries.forEach(([name, tex], unit) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    program.setInt(name, unit);
  });
}

/** Size the drawing buffer to the display, capping DPR for fill-rate. */
export function resize(gl, canvas, maxDpr = 2) {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);
  return canvas.width / canvas.height;
}
