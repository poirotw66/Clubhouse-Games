import {FOG_END, FOG_START} from './constants';
import type {TrackAssets} from './trackAssets';

export interface Camera {
  x: number;
  y: number;
  angle: number;
  height: number;
  /** Screen row of the horizon line. */
  horizon: number;
  focal: number;
}

/** First screen row that `renderGround` fills; rows above it belong to the sky. */
export function groundStartRow(cam: Camera): number {
  return Math.max(0, Math.ceil(cam.horizon) + 1);
}

/**
 * Per-scanline affine texture mapping — the classic Mode-7 trick.
 *
 * A pinhole camera at height h looking along the ground plane maps screen row
 * offset `sy` (below the horizon) to forward distance `focal * h / sy`, and one
 * screen pixel of width to `h / sy` world units. So each row is a straight line
 * across the texture that can be walked with a constant step.
 */
export function renderGround(
  img: ImageData,
  assets: TrackAssets,
  cam: Camera,
  fog: [number, number, number],
): void {
  const W = img.width;
  const H = img.height;
  const out = img.data;
  const src = assets.pixels;
  const TW = assets.width;
  const TH = assets.height;

  const cos = Math.cos(cam.angle);
  const sin = Math.sin(cam.angle);
  const rightX = -sin;
  const rightY = cos;
  const halfW = W / 2;
  const [fogR, fogG, fogB] = fog;

  for (let y = groundStartRow(cam); y < H; y++) {
    const sy = y - cam.horizon;
    const scale = cam.height / sy;
    const v = cam.focal * scale;
    let o = y * W * 4;

    if (v >= FOG_END) {
      for (let x = 0; x < W; x++) {
        out[o++] = fogR;
        out[o++] = fogG;
        out[o++] = fogB;
        out[o++] = 255;
      }
      continue;
    }

    // 0..256 fixed-point fog weight so the inner loop stays integer-only.
    const fogT =
      v <= FOG_START ? 0 : (((v - FOG_START) / (FOG_END - FOG_START)) * 256) | 0;
    const inv = 256 - fogT;

    let wx = cam.x + cos * v + rightX * -halfW * scale;
    let wy = cam.y + sin * v + rightY * -halfW * scale;
    const dx = rightX * scale;
    const dy = rightY * scale;

    for (let x = 0; x < W; x++) {
      const tx = wx | 0;
      const ty = wy | 0;
      let r: number;
      let g: number;
      let b: number;
      if (tx < 0 || ty < 0 || tx >= TW || ty >= TH) {
        r = fogR;
        g = fogG;
        b = fogB;
      } else {
        const si = (ty * TW + tx) << 2;
        r = src[si];
        g = src[si + 1];
        b = src[si + 2];
      }
      out[o++] = (r * inv + fogR * fogT) >> 8;
      out[o++] = (g * inv + fogG * fogT) >> 8;
      out[o++] = (b * inv + fogB * fogT) >> 8;
      out[o++] = 255;
      wx += dx;
      wy += dy;
    }
  }
}

export interface Projection {
  screenX: number;
  /** Screen row where the object's ground contact point sits. */
  screenY: number;
  /** Forward distance from the camera. */
  distance: number;
  /** Screen pixels per world unit at that distance. */
  scale: number;
}

/** Projects a world-space ground position into screen space. */
export function projectPoint(cam: Camera, x: number, y: number): Projection | null {
  const cos = Math.cos(cam.angle);
  const sin = Math.sin(cam.angle);
  const relX = x - cam.x;
  const relY = y - cam.y;
  const v = relX * cos + relY * sin;
  if (v < 12) return null;
  const u = relX * -sin + relY * cos;
  const scale = cam.focal / v;
  return {
    screenX: u * scale,
    screenY: (cam.height * cam.focal) / v,
    distance: v,
    scale,
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
