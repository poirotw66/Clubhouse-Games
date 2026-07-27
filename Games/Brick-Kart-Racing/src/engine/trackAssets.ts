import {TRACKS, trackControlPoints, type PropKind, type TrackDef} from '../data/tracks';
import {
  CURB_WIDTH,
  ROAD_WIDTH,
  STUD_PX,
  SURFACE_BOOST,
  SURFACE_GRASS,
  SURFACE_ROAD,
  WORLD_SIZE,
} from './constants';
import {buildCenterline, pointAt, type Centerline, type Vec2} from './spline';

/** Surface lookups do not need full texture precision. */
const MASK_SCALE = 2;
const CENTERLINE_SAMPLES = 720;

export interface Prop {
  x: number;
  y: number;
  kind: PropKind;
  /** Per-instance size jitter. */
  scale: number;
}

export interface ItemBrickSpot {
  x: number;
  y: number;
}

export interface TrackAssets {
  def: TrackDef;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  /** One byte per (MASK_SCALE-downsampled) texel: SURFACE_* code. */
  surface: Uint8Array;
  maskWidth: number;
  maskHeight: number;
  centerline: Centerline;
  props: Prop[];
  itemSpots: ItemBrickSpot[];
  /** Start grid slots; slot 0 is the back row, where the player is placed. */
  grid: {x: number; y: number; angle: number}[];
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tracePath(ctx: CanvasRenderingContext2D, pts: Vec2[], step = 1): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = step; i < pts.length; i += step) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** A repeating stud tile that reads as a LEGO baseplate over any base colour. */
function studPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  const tile = makeCanvas(STUD_PX, STUD_PX);
  const t = tile.getContext('2d')!;
  const c = STUD_PX / 2;
  const r = STUD_PX * 0.3;

  t.strokeStyle = 'rgba(0,0,0,0.08)';
  t.lineWidth = 1;
  t.strokeRect(0.5, 0.5, STUD_PX - 1, STUD_PX - 1);

  t.beginPath();
  t.arc(c, c, r, 0, Math.PI * 2);
  t.fillStyle = 'rgba(255,255,255,0.09)';
  t.fill();

  t.lineWidth = STUD_PX * 0.13;
  t.beginPath();
  t.arc(c, c, r, Math.PI * 0.75, Math.PI * 1.75);
  t.strokeStyle = 'rgba(255,255,255,0.3)';
  t.stroke();

  t.beginPath();
  t.arc(c, c, r, Math.PI * -0.25, Math.PI * 0.75);
  t.strokeStyle = 'rgba(0,0,0,0.2)';
  t.stroke();

  return ctx.createPattern(tile, 'repeat')!;
}

function drawBoostPad(ctx: CanvasRenderingContext2D, line: Centerline, idx: number): void {
  const n = line.points.length;
  const p = line.points[idx % n];
  const tan = line.tangents[idx % n];
  const angle = Math.atan2(tan.y, tan.x);
  const len = 150;
  const wide = ROAD_WIDTH - 26;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.fillStyle = '#f2c027';
  ctx.fillRect(-len / 2, -wide / 2, len, wide);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const ox = -len / 2 + 18 + i * 42;
    ctx.beginPath();
    ctx.moveTo(ox, -wide / 2 + 10);
    ctx.lineTo(ox + 26, 0);
    ctx.lineTo(ox, wide / 2 - 10);
    ctx.lineTo(ox + 10, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawStartLine(ctx: CanvasRenderingContext2D, line: Centerline): void {
  const p = line.points[0];
  const tan = line.tangents[0];
  const angle = Math.atan2(tan.y, tan.x);
  const depth = 40;
  const cell = 20;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  const half = ROAD_WIDTH / 2;
  for (let row = 0; row * cell < depth; row++) {
    for (let col = 0; col * cell < ROAD_WIDTH; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#f5f6f8' : '#23262d';
      ctx.fillRect(-depth / 2 + row * cell, -half + col * cell, cell, cell);
    }
  }
  ctx.restore();
}

function buildTexture(def: TrackDef, line: Centerline): HTMLCanvasElement {
  const canvas = makeCanvas(WORLD_SIZE, WORLD_SIZE);
  const ctx = canvas.getContext('2d')!;
  const th = def.theme;
  const rand = mulberry32(def.id.length * 9173 + 17);

  ctx.fillStyle = th.ground;
  ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

  // Loose patches so the ground is not a flat slab of colour.
  ctx.fillStyle = th.groundAlt;
  for (let i = 0; i < 160; i++) {
    const x = rand() * WORLD_SIZE;
    const y = rand() * WORLD_SIZE;
    const w = 60 + rand() * 220;
    const h = 60 + rand() * 220;
    ctx.fillRect(Math.round(x / STUD_PX) * STUD_PX, Math.round(y / STUD_PX) * STUD_PX, w, h);
  }

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Curb band, then the alternating stripe, then the road on top.
  tracePath(ctx, line.points, 2);
  ctx.lineWidth = ROAD_WIDTH + CURB_WIDTH * 2;
  ctx.strokeStyle = th.curbA;
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([44, 44]);
  ctx.strokeStyle = th.curbB;
  ctx.stroke();
  ctx.restore();

  tracePath(ctx, line.points, 2);
  ctx.lineWidth = ROAD_WIDTH;
  ctx.strokeStyle = th.road;
  ctx.stroke();

  // Worn racing line down the middle of the road.
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = ROAD_WIDTH * 0.52;
  ctx.strokeStyle = th.roadAlt;
  ctx.stroke();
  ctx.restore();

  const n = line.points.length;
  for (const frac of def.boostPads) drawBoostPad(ctx, line, Math.floor(frac * n) % n);
  drawStartLine(ctx, line);

  // Baseplate studs over everything so road and ground share the brick look.
  ctx.fillStyle = studPattern(ctx);
  ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

  return canvas;
}

function buildSurfaceMask(def: TrackDef, line: Centerline): Uint8Array {
  const w = WORLD_SIZE / MASK_SCALE;
  const canvas = makeCanvas(w, w);
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, w);
  ctx.scale(1 / MASK_SCALE, 1 / MASK_SCALE);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Red channel marks road, green channel marks boost pads.
  tracePath(ctx, line.points, 2);
  ctx.lineWidth = ROAD_WIDTH;
  ctx.strokeStyle = '#ff0000';
  ctx.stroke();

  const n = line.points.length;
  ctx.fillStyle = '#00ff00';
  for (const frac of def.boostPads) {
    const idx = Math.floor(frac * n) % n;
    const p = line.points[idx];
    const tan = line.tangents[idx];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(tan.y, tan.x));
    ctx.fillRect(-75, -(ROAD_WIDTH - 26) / 2, 150, ROAD_WIDTH - 26);
    ctx.restore();
  }

  const data = ctx.getImageData(0, 0, w, w).data;
  const surface = new Uint8Array(w * w);
  for (let i = 0, p = 0; i < surface.length; i++, p += 4) {
    if (data[p + 1] > 128) surface[i] = SURFACE_BOOST;
    else if (data[p] > 128) surface[i] = SURFACE_ROAD;
    else surface[i] = SURFACE_GRASS;
  }
  return surface;
}

function buildProps(def: TrackDef, line: Centerline): Prop[] {
  const rand = mulberry32(def.id.length * 4211 + 91);
  const props: Prop[] = [];
  const n = line.points.length;
  const kinds = def.theme.props;
  let k = 0;
  for (let i = 0; i < n; i += 12) {
    for (const side of [-1, 1] as const) {
      if (rand() < 0.25) continue;
      const lateral = side * (ROAD_WIDTH / 2 + 46 + rand() * 90);
      const p = pointAt(line, i, lateral);
      props.push({x: p.x, y: p.y, kind: kinds[k % kinds.length], scale: 0.85 + rand() * 0.45});
      k++;
    }
  }
  return props;
}

function buildItemSpots(def: TrackDef, line: Centerline): ItemBrickSpot[] {
  const n = line.points.length;
  const spots: ItemBrickSpot[] = [];
  for (const frac of def.itemRows) {
    const idx = Math.floor(frac * n) % n;
    for (const lateral of [-42, 0, 42]) {
      const p = pointAt(line, idx, lateral);
      spots.push({x: p.x, y: p.y});
    }
  }
  return spots;
}

function buildGrid(line: Centerline): TrackAssets['grid'] {
  const n = line.points.length;
  const grid: TrackAssets['grid'] = [];
  // Slots 0 and 1 are the back row. The player takes slot 0 so the chase camera
  // starts behind the whole field instead of inside it, and so the race is a
  // climb from the back — the usual kart-racer opening.
  for (let i = 0; i < 4; i++) {
    const row = i < 2 ? 1 : 0;
    const col = i % 2;
    const idx = (n - 8 - row * 11 + n) % n;
    const p = pointAt(line, idx, col === 0 ? -34 : 34);
    const tan = line.tangents[idx];
    grid.push({x: p.x, y: p.y, angle: Math.atan2(tan.y, tan.x)});
  }
  return grid;
}

const cache = new Map<string, TrackAssets>();

export function getTrackAssets(trackId: string): TrackAssets {
  const cached = cache.get(trackId);
  if (cached) return cached;

  const def = TRACKS.find((t) => t.id === trackId) ?? TRACKS[0];
  const centerline = buildCenterline(trackControlPoints(def), CENTERLINE_SAMPLES);
  const canvas = buildTexture(def, centerline);
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.getImageData(0, 0, WORLD_SIZE, WORLD_SIZE).data;

  const assets: TrackAssets = {
    def,
    width: WORLD_SIZE,
    height: WORLD_SIZE,
    pixels,
    surface: buildSurfaceMask(def, centerline),
    maskWidth: WORLD_SIZE / MASK_SCALE,
    maskHeight: WORLD_SIZE / MASK_SCALE,
    centerline,
    props: buildProps(def, centerline),
    itemSpots: buildItemSpots(def, centerline),
    grid: buildGrid(centerline),
  };
  cache.set(trackId, assets);
  return assets;
}

export function surfaceAt(assets: TrackAssets, x: number, y: number): number {
  const mx = (x / MASK_SCALE) | 0;
  const my = (y / MASK_SCALE) | 0;
  if (mx < 0 || my < 0 || mx >= assets.maskWidth || my >= assets.maskHeight) return SURFACE_GRASS;
  return assets.surface[my * assets.maskWidth + mx];
}
