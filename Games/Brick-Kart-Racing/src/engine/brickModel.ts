/**
 * A very small painter's-algorithm renderer for axis-aligned brick stacks.
 *
 * Models are built from boxes in a right-handed frame: +X is the model's right,
 * -Y is the direction it faces, +Z is up. The camera sits at +Y looking toward
 * -Y, tilted down by ELEVATION, which matches how the Mode-7 camera sees the
 * ground. Sprites are pre-rendered once per yaw step and then billboarded.
 */

export interface Brick {
  /** Box centre. */
  x: number;
  y: number;
  z: number;
  /** Box size along X, Y, Z. */
  w: number;
  d: number;
  h: number;
  color: string;
  /** Stud grid on the top face: [columns along X, rows along Y]. */
  studs?: [number, number];
}

const ELEVATION = (18 * Math.PI) / 180;
const COS_E = Math.cos(ELEVATION);
const SIN_E = Math.sin(ELEVATION);

/** Light fixed in camera space so the shading stays readable at every yaw. */
const LIGHT = normalize(-0.45, -0.4, 0.8);

function normalize(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

interface Projected {
  x: number;
  y: number;
  depth: number;
}

function project(x: number, y: number, z: number, cy: number, sy: number): Projected {
  const rx = x * cy - y * sy;
  const ry = x * sy + y * cy;
  return {
    x: rx,
    y: -z * COS_E + ry * SIN_E,
    depth: ry * COS_E + z * SIN_E,
  };
}

interface Drawable {
  depth: number;
  paint: (ctx: CanvasRenderingContext2D) => void;
}

/** Face definition: the four corner sign triplets plus the outward normal. */
const FACES: {corners: [number, number, number][]; n: [number, number, number]}[] = [
  {corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], n: [0, 0, 1]},
  {corners: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]], n: [0, 0, -1]},
  {corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], n: [0, -1, 0]},
  {corners: [[1, 1, -1], [-1, 1, -1], [-1, 1, 1], [1, 1, 1]], n: [0, 1, 0]},
  {corners: [[-1, 1, -1], [-1, -1, -1], [-1, -1, 1], [-1, 1, 1]], n: [-1, 0, 0]},
  {corners: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], n: [1, 0, 0]},
];

function collect(bricks: Brick[], yaw: number, scale: number): Drawable[] {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const out: Drawable[] = [];

  for (const b of bricks) {
    const hw = b.w / 2;
    const hd = b.d / 2;
    const hh = b.h / 2;

    for (const face of FACES) {
      // Rotate the normal with the model; the light lives in camera space.
      const nx = face.n[0] * cy - face.n[1] * sy;
      const ny = face.n[0] * sy + face.n[1] * cy;
      const nz = face.n[2];
      const camY = ny * COS_E + nz * SIN_E;
      // Back-face cull: the camera looks from +Y in the projected frame.
      if (camY <= 0.001) continue;

      const lambert = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const brightness = 0.62 + 0.5 * lambert;
      const fill = shade(b.color, brightness);

      const pts: Projected[] = [];
      let depth = 0;
      for (const c of face.corners) {
        const p = project(b.x + c[0] * hw, b.y + c[1] * hd, b.z + c[2] * hh, cy, sy);
        pts.push(p);
        depth += p.depth;
      }
      depth /= 4;

      out.push({
        depth,
        paint: (ctx) => {
          ctx.beginPath();
          ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
          for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x * scale, pts[i].y * scale);
          ctx.closePath();
          ctx.fillStyle = fill;
          ctx.fill();
          ctx.strokeStyle = shade(b.color, brightness * 0.78);
          ctx.lineWidth = Math.max(0.6, scale * 0.045);
          ctx.stroke();
        },
      });
    }

    if (!b.studs) continue;
    const [cols, rows] = b.studs;
    const studR = Math.min(b.w / cols, b.d / rows) * 0.28;
    const studH = 0.18;
    const topZ = b.z + hh;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const sx = b.x - hw + (b.w / cols) * (i + 0.5);
        const sy2 = b.y - hd + (b.d / rows) * (j + 0.5);
        const base = project(sx, sy2, topZ, cy, sy);
        const top = project(sx, sy2, topZ + studH, cy, sy);
        const rx = studR * scale;
        const ry = studR * SIN_E * scale;
        const bx = base.x * scale;
        const by = base.y * scale;
        const tx = top.x * scale;
        const ty = top.y * scale;
        out.push({
          depth: top.depth + 0.01,
          paint: (ctx) => {
            ctx.fillStyle = shade(b.color, 0.78);
            ctx.beginPath();
            ctx.moveTo(bx - rx, by);
            ctx.lineTo(bx + rx, by);
            ctx.lineTo(tx + rx, ty);
            ctx.lineTo(tx - rx, ty);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2);
            ctx.fillStyle = shade(b.color, 1.18);
            ctx.fill();
          },
        });
      }
    }
  }

  out.sort((a, b) => a.depth - b.depth);
  return out;
}

export interface SpriteSheet {
  frames: HTMLCanvasElement[];
  /** Pixel inside each frame that sits on the ground at the model origin. */
  anchorX: number;
  anchorY: number;
  /** Sprite pixels per model unit. */
  scale: number;
  size: number;
}

export function renderSheet(
  bricks: Brick[],
  opts: {size: number; scale: number; anchorY: number; angles: number; yawOffset?: number},
): SpriteSheet {
  const frames: HTMLCanvasElement[] = [];
  const anchorX = opts.size / 2;
  for (let a = 0; a < opts.angles; a++) {
    const canvas = document.createElement('canvas');
    canvas.width = opts.size;
    canvas.height = opts.size;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(anchorX, opts.anchorY);
    ctx.lineJoin = 'round';
    const yaw = (opts.yawOffset ?? 0) + (a / opts.angles) * Math.PI * 2;
    for (const d of collect(bricks, yaw, opts.scale)) d.paint(ctx);
    frames.push(canvas);
  }
  return {frames, anchorX, anchorY: opts.anchorY, scale: opts.scale, size: opts.size};
}
