/**
 * Cached offscreen sprites for the danmaku field.
 *
 * Glow is baked into the sprite pixels so the hot path never calls
 * shadowBlur / createRadialGradient per bullet. Keys are coarse hue / radius
 * buckets so a dense curtain shares a handful of bitmaps.
 */

export type SpriteCanvas = HTMLCanvasElement;

const cache = new Map<string, SpriteCanvas>();

function canvas(w: number, h: number): SpriteCanvas {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

function bucketHue(hue: number): number {
  return Math.round(((hue % 360) + 360) % 360 / 12) * 12;
}

function bucketR(r: number): number {
  return Math.max(2, Math.round(r * 2) / 2);
}

/** Soft neon orb: outer bloom + body + hot white core. */
export function bulletOrbSprite(hue: number, r: number): SpriteCanvas {
  const h = bucketHue(hue);
  const br = bucketR(r);
  const key = `orb:${h}:${br}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const pad = br * 2.4;
  const size = (br + pad) * 2;
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const glow = ctx.createRadialGradient(cx, cy, br * 0.2, cx, cy, br + pad);
  glow.addColorStop(0, `hsla(${h}, 100%, 78%, 0.55)`);
  glow.addColorStop(0.35, `hsla(${h}, 95%, 62%, 0.28)`);
  glow.addColorStop(0.7, `hsla(${h}, 90%, 55%, 0.1)`);
  glow.addColorStop(1, `hsla(${h}, 90%, 50%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, br + pad, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(cx - br * 0.2, cy - br * 0.25, 0, cx, cy, br);
  body.addColorStop(0, `hsla(${h}, 100%, 94%, 1)`);
  body.addColorStop(0.45, `hsla(${h}, 95%, 72%, 1)`);
  body.addColorStop(1, `hsla(${h}, 90%, 48%, 0.95)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, br, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx - br * 0.18, cy - br * 0.22, Math.max(1.1, br * 0.38), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();

  cache.set(key, c);
  return c;
}

/** Square / chip bullet used for cyan curtain lanes on the cover. */
export function bulletChipSprite(hue: number, r: number): SpriteCanvas {
  const h = bucketHue(hue);
  const br = bucketR(r);
  const key = `chip:${h}:${br}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const pad = br * 1.8;
  const size = (br + pad) * 2;
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const half = br * 0.95;

  const glow = ctx.createRadialGradient(cx, cy, br * 0.3, cx, cy, br + pad);
  glow.addColorStop(0, `hsla(${h}, 100%, 75%, 0.4)`);
  glow.addColorStop(1, `hsla(${h}, 90%, 50%, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, br + pad, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  const g = ctx.createLinearGradient(-half, -half, half, half);
  g.addColorStop(0, `hsla(${h}, 100%, 92%, 1)`);
  g.addColorStop(0.5, `hsla(${h}, 95%, 68%, 1)`);
  g.addColorStop(1, `hsla(${h}, 85%, 42%, 1)`);
  ctx.fillStyle = g;
  ctx.fillRect(-half, -half, half * 2, half * 2);
  ctx.strokeStyle = `hsla(${h}, 100%, 96%, 0.9)`;
  ctx.lineWidth = 1.1;
  ctx.strokeRect(-half, -half, half * 2, half * 2);
  ctx.restore();

  cache.set(key, c);
  return c;
}

/** Wall segment: elongated neon brick with soft halo. */
export function bulletWallSprite(hue: number, r: number): SpriteCanvas {
  const h = bucketHue(hue);
  const br = bucketR(r);
  const key = `wall:${h}:${br}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const w = br * 2.4;
  const hh = br * 1.7;
  const pad = br * 1.6;
  const c = canvas(w + pad * 2, hh + pad * 2);
  const ctx = c.getContext('2d')!;
  const cx = c.width / 2;
  const cy = c.height / 2;

  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(w, hh) * 0.85 + pad);
  glow.addColorStop(0, `hsla(${h}, 100%, 80%, 0.45)`);
  glow.addColorStop(1, `hsla(${h}, 90%, 50%, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, c.width, c.height);

  const rad = Math.min(w, hh) * 0.35;
  roundRect(ctx, cx - w / 2, cy - hh / 2, w, hh, rad);
  const body = ctx.createLinearGradient(cx, cy - hh / 2, cx, cy + hh / 2);
  body.addColorStop(0, `hsla(${h}, 100%, 92%, 1)`);
  body.addColorStop(0.5, `hsla(${h}, 95%, 72%, 1)`);
  body.addColorStop(1, `hsla(${h}, 90%, 55%, 1)`);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = `hsla(${h}, 100%, 98%, 0.95)`;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  cache.set(key, c);
  return c;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Whether a hue reads as "cyan curtain" territory for chip sprites. */
export function isCyanFamily(hue: number): boolean {
  const h = ((hue % 360) + 360) % 360;
  return h >= 155 && h <= 210;
}

/**
 * Faceted magenta-crystal boss body baked once per stage accent.
 * Drawn centred; caller scales/rotates.
 */
export function crystalBossSprite(stage: number): SpriteCanvas {
  const st = Math.max(1, Math.min(5, stage | 0));
  const key = `boss:${st}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const accents: Array<{ core: string; mid: string; tip: string; glow: string }> = [
    { core: '#fce7f3', mid: '#f472b6', tip: '#9d174d', glow: 'rgba(244,114,182,0.55)' },
    { core: '#ecfeff', mid: '#22d3ee', tip: '#0e7490', glow: 'rgba(34,211,238,0.5)' },
    { core: '#f8fafc', mid: '#a5b4fc', tip: '#4338ca', glow: 'rgba(165,180,252,0.5)' },
    { core: '#fff7ed', mid: '#fb923c', tip: '#c2410c', glow: 'rgba(251,146,60,0.5)' },
    { core: '#fae8ff', mid: '#e879f9', tip: '#6b21a8', glow: 'rgba(232,121,249,0.55)' },
  ];
  const pal = accents[st - 1];
  const size = 128;
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const aura = ctx.createRadialGradient(cx, cy, 8, cx, cy, 60);
  aura.addColorStop(0, pal.glow);
  aura.addColorStop(0.55, pal.glow.replace(/[\d.]+\)$/, '0.18)'));
  aura.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, 60, 0, Math.PI * 2);
  ctx.fill();

  // Outer spike ring.
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
    const a2 = a + Math.PI / 8;
    const tipR = 54;
    const baseR = 28;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * tipR, cy + Math.sin(a) * tipR);
    ctx.lineTo(cx + Math.cos(a - 0.22) * baseR, cy + Math.sin(a - 0.22) * baseR);
    ctx.lineTo(cx + Math.cos(a + 0.22) * baseR, cy + Math.sin(a + 0.22) * baseR);
    ctx.closePath();
    const spike = ctx.createLinearGradient(
      cx,
      cy,
      cx + Math.cos(a) * tipR,
      cy + Math.sin(a) * tipR,
    );
    spike.addColorStop(0, pal.mid);
    spike.addColorStop(1, pal.tip);
    ctx.fillStyle = spike;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    void a2;
  }

  // Inner diamond facets.
  const facets: Array<[number, number, number, number, number, number]> = [
    [0, -34, 22, 0, 0, 8],
    [0, -34, -22, 0, 0, 8],
    [22, 0, 0, 34, 0, 8],
    [-22, 0, 0, 34, 0, 8],
    [-22, 0, 0, -34, 0, 8],
    [22, 0, 0, -34, 0, 8],
  ];
  for (let i = 0; i < facets.length; i++) {
    const [x1, y1, x2, y2, x3, y3] = facets[i];
    ctx.beginPath();
    ctx.moveTo(cx + x1, cy + y1);
    ctx.lineTo(cx + x2, cy + y2);
    ctx.lineTo(cx + x3, cy + y3);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? pal.core : pal.mid;
    ctx.globalAlpha = i % 2 === 0 ? 0.95 : 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  // Bright nucleus.
  const core = ctx.createRadialGradient(cx - 4, cy - 6, 1, cx, cy, 16);
  core.addColorStop(0, '#ffffff');
  core.addColorStop(0.4, pal.core);
  core.addColorStop(1, pal.mid);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();

  cache.set(key, c);
  return c;
}

/** Midway enemy silhouettes — distinct neon drones, keyed by visual kind. */
export function midwaySprite(kind: number, hue: number): SpriteCanvas {
  const k = ((kind % 5) + 5) % 5;
  const h = bucketHue(hue);
  const key = `mid:${k}:${h}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 64;
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28);
  aura.addColorStop(0, `hsla(${h}, 100%, 70%, 0.45)`);
  aura.addColorStop(1, `hsla(${h}, 90%, 50%, 0)`);
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  if (k === 0) {
    // Crystal shard.
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(10, -2);
    ctx.lineTo(4, 16);
    ctx.lineTo(-4, 16);
    ctx.lineTo(-10, -2);
    ctx.closePath();
  } else if (k === 1) {
    // Hex ring drone.
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const x = Math.cos(a) * 16;
      const y = Math.sin(a) * 16;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  } else if (k === 2) {
    // Winged diamond.
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.moveTo(-18, 0);
    ctx.quadraticCurveTo(-10, -8, -8, 0);
    ctx.quadraticCurveTo(-10, 8, -18, 0);
    ctx.moveTo(18, 0);
    ctx.quadraticCurveTo(10, -8, 8, 0);
    ctx.quadraticCurveTo(10, 8, 18, 0);
  } else if (k === 3) {
    // Spinning blade.
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI * 2 * i) / 4;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a - 0.25) * 8, Math.sin(a - 0.25) * 8);
      ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
      ctx.lineTo(Math.cos(a + 0.25) * 8, Math.sin(a + 0.25) * 8);
    }
    ctx.closePath();
  } else {
    // Tri-prong.
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
      ctx.lineTo(Math.cos(a + 0.4) * 7, Math.sin(a + 0.4) * 7);
    }
    ctx.closePath();
  }

  const fill = ctx.createRadialGradient(-4, -6, 1, 0, 0, 18);
  fill.addColorStop(0, `hsla(${h}, 100%, 92%, 1)`);
  fill.addColorStop(0.55, `hsla(${h}, 85%, 58%, 1)`);
  fill.addColorStop(1, `hsla(${h}, 80%, 32%, 1)`);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.restore();

  cache.set(key, c);
  return c;
}

/** Detailed glowing player craft — one sprite per craft id. */
export function shipSprite(craftId: string, hullHue: number, beamHue: number): SpriteCanvas {
  const key = `ship:${craftId}:${bucketHue(hullHue)}:${bucketHue(beamHue)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = 96;
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2 + 4;

  // Engine glow under the hull.
  const thruster = ctx.createRadialGradient(cx, cy + 22, 1, cx, cy + 18, 22);
  thruster.addColorStop(0, `hsla(${beamHue}, 100%, 75%, 0.7)`);
  thruster.addColorStop(1, `hsla(${beamHue}, 90%, 50%, 0)`);
  ctx.fillStyle = thruster;
  ctx.beginPath();
  ctx.arc(cx, cy + 18, 22, 0, Math.PI * 2);
  ctx.fill();

  // Soft ship aura.
  const aura = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34);
  aura.addColorStop(0, `hsla(${hullHue}, 100%, 80%, 0.35)`);
  aura.addColorStop(1, `hsla(${hullHue}, 90%, 50%, 0)`);
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);

  // Wing energy fins.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 4, 2);
    ctx.lineTo(side * 22, 14);
    ctx.lineTo(side * 10, 8);
    ctx.lineTo(side * 6, 16);
    ctx.closePath();
    const wing = ctx.createLinearGradient(0, 0, side * 22, 14);
    wing.addColorStop(0, `hsla(${hullHue}, 90%, 85%, 0.95)`);
    wing.addColorStop(1, `hsla(${beamHue}, 95%, 55%, 0.85)`);
    ctx.fillStyle = wing;
    ctx.fill();
  }

  // Main hull silhouette varies by craft.
  ctx.beginPath();
  if (craftId === 'cannon') {
    ctx.moveTo(0, -22);
    ctx.lineTo(-16, 16);
    ctx.lineTo(-5, 6);
    ctx.lineTo(0, 14);
    ctx.lineTo(5, 6);
    ctx.lineTo(16, 16);
  } else if (craftId === 'stitch') {
    ctx.moveTo(0, -26);
    ctx.lineTo(-10, 14);
    ctx.lineTo(-3, 6);
    ctx.lineTo(0, 12);
    ctx.lineTo(3, 6);
    ctx.lineTo(10, 14);
  } else {
    ctx.moveTo(0, -24);
    ctx.lineTo(-13, 15);
    ctx.lineTo(-4, 7);
    ctx.lineTo(0, 13);
    ctx.lineTo(4, 7);
    ctx.lineTo(13, 15);
  }
  ctx.closePath();
  const hull = ctx.createLinearGradient(0, -24, 0, 16);
  hull.addColorStop(0, `hsl(${hullHue}, 90%, 96%)`);
  hull.addColorStop(0.4, `hsl(${hullHue}, 80%, 68%)`);
  hull.addColorStop(1, `hsl(${hullHue}, 75%, 38%)`);
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Cockpit jewel.
  ctx.beginPath();
  ctx.ellipse(0, -4, craftId === 'cannon' ? 5 : 4, craftId === 'stitch' ? 7 : 5.5, 0, 0, Math.PI * 2);
  const cock = ctx.createRadialGradient(-1, -6, 0.5, 0, -4, 6);
  cock.addColorStop(0, '#ffffff');
  cock.addColorStop(0.45, `hsla(${(hullHue + 90) % 360}, 90%, 70%, 1)`);
  cock.addColorStop(1, `hsla(${beamHue}, 80%, 40%, 0.9)`);
  ctx.fillStyle = cock;
  ctx.fill();

  // Nose edge light.
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(-3, -14);
  ctx.lineTo(3, -14);
  ctx.closePath();
  ctx.fillStyle = `hsla(${beamHue}, 100%, 85%, 0.9)`;
  ctx.fill();

  ctx.restore();
  cache.set(key, c);
  return c;
}

/** Stage-tinted nebula plate (static); parallax layers scroll separately. */
export function abyssPlateSprite(stage: number): SpriteCanvas {
  const st = Math.max(1, Math.min(5, stage | 0));
  const key = `abyss:${st}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const W = 400;
  const H = 600;
  const c = canvas(W, H);
  const ctx = c.getContext('2d')!;

  const palettes = [
    { deep: '#040510', mid: '#12082a', edge: '#1a0a3a', a: '232,121,249', b: '45,212,191', c: '251,113,133' },
    { deep: '#030814', mid: '#071a2e', edge: '#0a2740', a: '34,211,238', b: '125,211,252', c: '244,114,182' },
    { deep: '#05060f', mid: '#0c1030', edge: '#161848', a: '165,180,252', b: '226,232,240', c: '192,132,252' },
    { deep: '#0a0408', mid: '#1a0a12', edge: '#2a1010', a: '251,146,60', b: '248,113,113', c: '253,186,116' },
    { deep: '#05020c', mid: '#14041e', edge: '#220830', a: '232,121,249', b: '168,85,247', c: '244,114,182' },
  ];
  const p = palettes[st - 1];

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, p.deep);
  bg.addColorStop(0.4, p.mid);
  bg.addColorStop(1, p.edge);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Swirling cavern walls (cover-like textured abyss).
  for (let i = 0; i < 5; i++) {
    const x = (i % 2 === 0 ? 0.15 : 0.85) * W;
    const y = 80 + i * 100;
    const g = ctx.createRadialGradient(x, y, 10, x, y, 160 + i * 20);
    g.addColorStop(0, `rgba(${p.a}, ${0.14 - i * 0.015})`);
    g.addColorStop(1, `rgba(${p.a}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  const n2 = ctx.createRadialGradient(W * 0.7, H * 0.55, 8, W * 0.7, H * 0.55, 220);
  n2.addColorStop(0, `rgba(${p.b}, 0.16)`);
  n2.addColorStop(1, `rgba(${p.b}, 0)`);
  ctx.fillStyle = n2;
  ctx.fillRect(0, 0, W, H);

  const veil = ctx.createRadialGradient(W * 0.5, H * 0.95, 20, W * 0.5, H * 0.95, 280);
  veil.addColorStop(0, `rgba(${p.c}, 0.14)`);
  veil.addColorStop(1, `rgba(${p.c}, 0)`);
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  // Faint depth grid.
  ctx.strokeStyle = 'rgba(125,211,252,0.04)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  cache.set(key, c);
  return c;
}

export function clearSpriteCache(): void {
  cache.clear();
}
