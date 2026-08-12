import {CHARACTERS} from '../data/characters';
import type {TrackDef} from '../data/tracks';
import {
  BRICK_UNIT,
  CAM_DISTANCE,
  CAM_HEIGHT,
  CAM_LAG,
  FOCAL,
  FOG_END,
  FOG_START,
  HORIZON_FRAC,
  RENDER_HEIGHT,
  RENDER_WIDTH,
} from './constants';
import {groundStartRow, hexToRgb, projectPoint, renderGround, type Camera} from './mode7';
import {driftLevel, type RaceState, type Racer} from './race';
import {frameFor, getSprites} from './sprites';
import type {SpriteSheet} from './brickModel';
import {getTrackSkyImage} from './trackAssets';

const HILL_STRIP_WIDTH = Math.round(FOCAL * Math.PI * 2);
const HILL_STRIP_HEIGHT = 150;
const SKY_PLATE_W = 512;
const SKY_PLATE_H = 256;

interface Backdrop {
  sky: HTMLCanvasElement;
  hills: HTMLCanvasElement;
  fog: [number, number, number];
}

const backdrops = new Map<string, Backdrop>();

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBackdrop(def: TrackDef): Backdrop {
  const th = def.theme;

  const sky = document.createElement('canvas');
  sky.width = SKY_PLATE_W;
  sky.height = SKY_PLATE_H;
  const sctx = sky.getContext('2d')!;
  const grad = sctx.createLinearGradient(0, 0, 0, SKY_PLATE_H);
  grad.addColorStop(0, th.skyTop);
  grad.addColorStop(1, th.skyBottom);
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, SKY_PLATE_W, SKY_PLATE_H);

  const skyPhoto = getTrackSkyImage(def.id);
  if (skyPhoto.complete && skyPhoto.naturalWidth > 0) {
    sctx.save();
    sctx.globalAlpha = 0.88;
    sctx.drawImage(skyPhoto, 0, 0, SKY_PLATE_W, SKY_PLATE_H);
    sctx.restore();
  }

  const hills = document.createElement('canvas');
  hills.width = HILL_STRIP_WIDTH;
  hills.height = HILL_STRIP_HEIGHT;
  const hctx = hills.getContext('2d')!;
  const rand = mulberry32(def.id.length * 7717 + 3);

  // Two layers of blocky brick shapes read as hills or a skyline. Every shape
  // is also drawn one strip-width to the left so the strip tiles seamlessly
  // when it wraps around a full 360° of camera rotation.
  const box = (x: number, y: number, w: number, h: number) => {
    hctx.fillRect(x, y, w, h);
    if (x + w > HILL_STRIP_WIDTH) hctx.fillRect(x - HILL_STRIP_WIDTH, y, w, h);
  };

  for (const layer of [0, 1]) {
    hctx.fillStyle = layer === 0 ? th.hillsFar : th.hills;
    const base = HILL_STRIP_HEIGHT;
    let x = 0;
    while (x < HILL_STRIP_WIDTH) {
      const w = 60 + rand() * 150;
      const h = (layer === 0 ? 30 : 50) + rand() * (layer === 0 ? 45 : 80);
      box(x, base - h, w, h);
      // Stack a smaller brick on top for a stepped silhouette.
      if (rand() < 0.55) {
        const w2 = w * (0.4 + rand() * 0.35);
        const h2 = 14 + rand() * 34;
        box(x + (w - w2) / 2, base - h - h2, w2, h2);
      }
      x += w * (layer === 0 ? 0.8 : 0.95);
    }
  }

  const bd: Backdrop = {sky, hills, fog: hexToRgb(th.fog)};
  backdrops.set(def.id, bd);
  return bd;
}

function getBackdrop(def: TrackDef): Backdrop {
  return backdrops.get(def.id) ?? buildBackdrop(def);
}

/** Drop sky caches after track art preload so photo skies bake in. */
export function clearBackdrops(): void {
  backdrops.clear();
}

export function createCamera(player: Racer): Camera {
  return {
    x: player.x - Math.cos(player.angle) * CAM_DISTANCE,
    y: player.y - Math.sin(player.angle) * CAM_DISTANCE,
    angle: player.angle,
    height: CAM_HEIGHT,
    horizon: RENDER_HEIGHT * HORIZON_FRAC,
    focal: FOCAL,
  };
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function updateCamera(cam: Camera, player: Racer, dt: number): void {
  const lag = Math.min(1, dt * CAM_LAG);
  cam.angle += wrapAngle(player.angle - cam.angle) * lag;

  // Pull back and drop slightly while boosting to sell the speed.
  const boosting = player.boostTime > 0 ? 1 : 0;
  const dist = CAM_DISTANCE + boosting * 16;
  const targetX = player.x - Math.cos(cam.angle) * dist;
  const targetY = player.y - Math.sin(cam.angle) * dist;
  cam.x += (targetX - cam.x) * Math.min(1, dt * 14);
  cam.y += (targetY - cam.y) * Math.min(1, dt * 14);

  const shake = player.spinTime > 0 ? Math.sin(performance.now() * 0.04) * 5 : 0;
  cam.height = CAM_HEIGHT - boosting * 4;
  cam.horizon = RENDER_HEIGHT * HORIZON_FRAC + shake + boosting * 3;
  cam.focal = FOCAL * (1 - boosting * 0.06);
}

interface Billboard {
  distance: number;
  paint: () => void;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  ground: ImageData;
}

export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  canvas.width = RENDER_WIDTH;
  canvas.height = RENDER_HEIGHT;
  const ctx = canvas.getContext('2d', {alpha: false})!;
  ctx.imageSmoothingEnabled = false;
  return {ctx, ground: ctx.createImageData(RENDER_WIDTH, RENDER_HEIGHT)};
}

function fogAlpha(distance: number): number {
  if (distance <= FOG_START) return 1;
  const t = Math.min(1, (distance - FOG_START) / (FOG_END - FOG_START));
  return 1 - t;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  frame: HTMLCanvasElement,
  screenX: number,
  screenY: number,
  worldScale: number,
  lift = 0,
): void {
  const ppu = sheet.scale / BRICK_UNIT;
  const s = worldScale / ppu;
  ctx.drawImage(
    frame,
    screenX - sheet.anchorX * s,
    screenY - sheet.anchorY * s - lift * worldScale,
    sheet.size * s,
    sheet.size * s,
  );
}

function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(x, y, radius, radius * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function renderFrame(rc: RenderContext, state: RaceState, cam: Camera): void {
  const {ctx, ground} = rc;
  const bd = getBackdrop(state.assets.def);
  const W = RENDER_WIDTH;
  const H = RENDER_HEIGHT;
  const horizonRow = Math.max(0, Math.min(H, Math.round(cam.horizon)));

  // --- Sky and backdrop -----------------------------------------------------
  ctx.drawImage(bd.sky, 0, 0, bd.sky.width, bd.sky.height, 0, 0, W, horizonRow + 2);

  let offset = -((cam.angle / (Math.PI * 2)) * HILL_STRIP_WIDTH) % HILL_STRIP_WIDTH;
  if (offset > 0) offset -= HILL_STRIP_WIDTH;
  const hillTop = horizonRow - HILL_STRIP_HEIGHT + 4;
  for (let x = offset; x < W; x += HILL_STRIP_WIDTH) {
    ctx.drawImage(bd.hills, x, hillTop);
  }

  // --- Ground ---------------------------------------------------------------
  // The blit must start on the same row renderGround fills, or the seam row
  // stays as untouched transparent-black pixels.
  const groundRow = groundStartRow(cam);
  renderGround(ground, state.assets, cam, bd.fog);
  if (groundRow < H) {
    ctx.putImageData(ground, 0, 0, 0, groundRow, W, H - groundRow);
  }

  // --- Billboards -----------------------------------------------------------
  const sprites = getSprites(CHARACTERS);
  const halfW = W / 2;
  const items: Billboard[] = [];

  const push = (
    x: number,
    y: number,
    paint: (sx: number, sy: number, scale: number, alpha: number) => void,
  ) => {
    const p = projectPoint(cam, x, y);
    if (!p || p.distance > FOG_END) return;
    const sx = halfW + p.screenX;
    if (sx < -160 || sx > W + 160) return;
    const sy = cam.horizon + p.screenY;
    const alpha = fogAlpha(p.distance);
    items.push({distance: p.distance, paint: () => paint(sx, sy, p.scale, alpha)});
  };

  for (const prop of state.assets.props) {
    const sheet = sprites.props.get(prop.kind)!;
    push(prop.x, prop.y, (sx, sy, scale, alpha) => {
      ctx.globalAlpha = alpha;
      drawShadow(ctx, sx, sy, 14 * scale * prop.scale, alpha * 0.25);
      drawSprite(ctx, sheet, sheet.frames[0], sx, sy, scale * prop.scale);
      ctx.globalAlpha = 1;
    });
  }

  const spin = state.time * 2.2;
  state.assets.itemSpots.forEach((spot, i) => {
    if (!state.itemsEnabled) return;
    if (state.itemRespawn[i] > 0) return;
    const bob = Math.sin(state.time * 3 + i) * 5;
    push(spot.x, spot.y, (sx, sy, scale, alpha) => {
      ctx.globalAlpha = alpha;
      drawShadow(ctx, sx, sy, 11 * scale, alpha * 0.3);
      const sheet = sprites.itemBrick;
      drawSprite(ctx, sheet, frameFor(sheet, spin + i), sx, sy, scale, 10 + bob);
      ctx.globalAlpha = 1;
    });
  });

  for (const oil of state.oils) {
    push(oil.x, oil.y, (sx, sy, scale, alpha) => {
      ctx.globalAlpha = alpha * Math.min(1, oil.life);
      const sheet = sprites.oil;
      drawSprite(ctx, sheet, sheet.frames[0], sx, sy, scale);
      ctx.globalAlpha = 1;
    });
  }

  for (const h of state.homings) {
    push(h.x, h.y, (sx, sy, scale, alpha) => {
      ctx.globalAlpha = alpha;
      drawShadow(ctx, sx, sy, 9 * scale, alpha * 0.3);
      const sheet = sprites.homing;
      drawSprite(ctx, sheet, frameFor(sheet, h.angle - cam.angle), sx, sy, scale, 8);
      ctx.globalAlpha = 1;
    });
  }

  for (const p of state.particles) {
    const t = p.life / p.maxLife;
    push(p.x, p.y, (sx, sy, scale, alpha) => {
      const size = p.size * scale * t;
      if (size < 0.6) return;
      ctx.globalAlpha = alpha * t;
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - size / 2, sy - p.z * scale - size / 2, size, size);
      ctx.globalAlpha = 1;
    });
  }

  for (const r of state.racers) {
    const sheet = sprites.karts.get(r.charId)!;
    const yaw = r.angle + r.bodyYaw - cam.angle;
    push(r.x, r.y, (sx, sy, scale, alpha) => {
      ctx.globalAlpha = alpha;
      drawShadow(ctx, sx, sy, 17 * scale, alpha * 0.3);

      if (r.invulnTime > 0 && r.spinTime <= 0 && Math.floor(state.time * 18) % 2 === 0) {
        ctx.globalAlpha = alpha * 0.45;
      }
      const spinYaw = r.spinTime > 0 ? yaw : yaw;
      drawSprite(ctx, sheet, frameFor(sheet, spinYaw), sx, sy, scale);
      ctx.globalAlpha = alpha;

      if (r.shields > 0) {
        const shieldSheet = sprites.shield;
        for (let i = 0; i < r.shields; i++) {
          const a = r.shieldAngle + (i / r.shields) * Math.PI * 2;
          const ox = Math.cos(a) * 30;
          const oy = Math.sin(a) * 30 * 0.4;
          drawSprite(
            ctx,
            shieldSheet,
            shieldSheet.frames[0],
            sx + ox * scale,
            sy + oy * scale,
            scale,
            14,
          );
        }
      }

      // Mini-turbo spark colour badge under the drifting kart.
      const level = r.drifting ? driftLevel(r.driftCharge) : 0;
      if (level > 0) {
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = ['#dcdcdc', '#4fc3ff', '#ff9a2e', '#c56bff'][level];
        const w = 26 * scale;
        ctx.fillRect(sx - w / 2, sy - 2, w, Math.max(1.5, 3 * scale));
      }
      ctx.globalAlpha = 1;
    });
  }

  items.sort((a, b) => b.distance - a.distance);
  for (const it of items) it.paint();

  // --- Boost speed lines ----------------------------------------------------
  const player = state.racers[state.playerIndex];
  if (player.boostTime > 0) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    const t = performance.now() * 0.02;
    for (let i = 0; i < 14; i++) {
      const a = ((i / 14) * Math.PI * 2 + t) % (Math.PI * 2);
      const r0 = 150 + ((t * 40 + i * 37) % 120);
      const r1 = r0 + 70;
      const cx = W / 2;
      const cy = cam.horizon + 40;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/** Small overhead map drawn into the HUD canvas. */
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  state: RaceState,
  size: number,
): void {
  const line = state.assets.centerline;
  ctx.clearRect(0, 0, size, size);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of line.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = 10;
  const scale = Math.min((size - pad * 2) / (maxX - minX), (size - pad * 2) / (maxY - minY));
  const ox = pad + ((size - pad * 2) - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = pad + ((size - pad * 2) - (maxY - minY) * scale) / 2 - minY * scale;

  ctx.beginPath();
  for (let i = 0; i < line.points.length; i += 4) {
    const p = line.points[i];
    const x = ox + p.x * scale;
    const y = oy + p.y * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,24,36,0.85)';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  const start = line.points[0];
  ctx.fillStyle = '#f5f6f8';
  ctx.fillRect(ox + start.x * scale - 3, oy + start.y * scale - 3, 6, 6);

  for (const r of state.racers) {
    const c = CHARACTERS.find((ch) => ch.id === r.charId)!;
    ctx.beginPath();
    ctx.arc(ox + r.x * scale, oy + r.y * scale, r.isPlayer ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = c.body;
    ctx.fill();
    if (r.isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}
