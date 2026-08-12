import { GRID } from '../game/config';
import { isSpikeArmed } from '../game/engine';
import { index } from '../game/level';
import type { Enemy, GameState, Vec } from '../game/types';

const COLORS = {
  backdrop: '#070b16',
  floorA: '#0f172a',
  floorB: '#111c33',
  grid: 'rgba(148, 163, 184, 0.06)',
  wall: '#26324c',
  wallTop: '#3b4a6b',
  head: '#4ade80',
  tail: '#0ea5e9',
  fruit: '#fb7185',
  golden: '#fcd34d',
  cursed: '#a855f7',
  exit: '#38bdf8',
  wisp: '#94a3b8',
  stalker: '#f97316',
  spitter: '#84cc16',
  acid: '#bef264',
  spike: '#ef4444',
  boss: '#f472b6',
};

const spriteCache = new Map<string, HTMLImageElement>();

function loadSprite(path: string): HTMLImageElement {
  let img = spriteCache.get(path);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = `${import.meta.env.BASE_URL}${path}`;
    spriteCache.set(path, img);
  }
  return img;
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  path: string,
  cx: number,
  cy: number,
  size: number,
): boolean {
  const img = loadSprite(path);
  if (!img.complete || img.naturalWidth === 0) return false;
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  return true;
}

// Preload combat art
for (const id of ['wisp', 'stalker', 'spitter', 'boss'] as const) {
  loadSprite(`enemies/${id}.jpg`);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Snap instead of sliding when a move was a dash or a wrap-around. */
function interpolate(prev: Vec | undefined, current: Vec, t: number): Vec {
  if (!prev) return current;
  if (Math.abs(prev.x - current.x) + Math.abs(prev.y - current.y) > 1) return current;
  return { x: lerp(prev.x, current.x, t), y: lerp(prev.y, current.y, t) };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
}

function drawTerrain(ctx: CanvasRenderingContext2D, state: GameState, cell: number): void {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const px = x * cell;
      const py = y * cell;
      if (state.tiles[index(x, y)] === 1) {
        ctx.fillStyle = COLORS.wall;
        roundRect(ctx, px + 0.5, py + 0.5, cell - 1, cell - 1, cell * 0.22);
        ctx.fillStyle = COLORS.wallTop;
        roundRect(ctx, px + 2, py + 2, cell - 4, cell * 0.3, cell * 0.14);
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(px, py, cell, cell);
      }
    }
  }

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < GRID; i++) {
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, GRID * cell);
    ctx.moveTo(0, i * cell);
    ctx.lineTo(GRID * cell, i * cell);
  }
  ctx.stroke();
}

function drawSpikes(ctx: CanvasRenderingContext2D, state: GameState, cell: number): void {
  for (const spike of state.spikes) {
    const px = spike.pos.x * cell;
    const py = spike.pos.y * cell;
    const armed = isSpikeArmed(state, spike.offset);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
    roundRect(ctx, px + cell * 0.15, py + cell * 0.15, cell * 0.7, cell * 0.7, cell * 0.16);

    if (!armed) continue;
    ctx.fillStyle = COLORS.spike;
    for (let i = 0; i < 3; i++) {
      const bx = px + cell * (0.2 + i * 0.25);
      ctx.beginPath();
      ctx.moveTo(bx, py + cell * 0.78);
      ctx.lineTo(bx + cell * 0.12, py + cell * 0.22);
      ctx.lineTo(bx + cell * 0.24, py + cell * 0.78);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawExit(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cell: number,
  now: number,
): void {
  if (!state.exit) return;
  const cx = (state.exit.x + 0.5) * cell;
  const cy = (state.exit.y + 0.5) * cell;
  const pulse = 0.5 + 0.5 * Math.sin(now / 220);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(now / 600);
  for (let ring = 0; ring < 3; ring++) {
    ctx.strokeStyle = COLORS.exit;
    ctx.globalAlpha = 0.35 + 0.25 * pulse - ring * 0.08;
    ctx.lineWidth = cell * 0.12;
    ctx.beginPath();
    ctx.arc(0, 0, cell * (0.2 + ring * 0.16), ring * 1.2, ring * 1.2 + Math.PI * 1.3);
    ctx.stroke();
  }
  ctx.restore();

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = COLORS.exit;
  ctx.beginPath();
  ctx.arc(cx, cy, cell * 0.16 * (0.8 + pulse * 0.4), 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawFruits(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cell: number,
  now: number,
): void {
  for (const fruit of state.fruits) {
    const cx = (fruit.pos.x + 0.5) * cell;
    const cy = (fruit.pos.y + 0.5) * cell;
    const bob = Math.sin(now / 260 + fruit.pos.x) * cell * 0.05;
    const color =
      fruit.type === 'golden' ? COLORS.golden : fruit.type === 'cursed' ? COLORS.cursed : COLORS.fruit;

    ctx.globalAlpha = 0.28;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, cell * 0.44, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, cell * 0.26, 0, Math.PI * 2);
    ctx.fill();

    if (fruit.type === 'golden') {
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath();
      ctx.arc(cx - cell * 0.08, cy + bob - cell * 0.08, cell * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fruit.type === 'cursed') {
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = cell * 0.06;
      ctx.beginPath();
      ctx.moveTo(cx - cell * 0.12, cy + bob - cell * 0.12);
      ctx.lineTo(cx + cell * 0.12, cy + bob + cell * 0.12);
      ctx.moveTo(cx + cell * 0.12, cy + bob - cell * 0.12);
      ctx.lineTo(cx - cell * 0.12, cy + bob + cell * 0.12);
      ctx.stroke();
    }
  }
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  enemy: Enemy,
  pos: Vec,
  cell: number,
  now: number,
): void {
  const cx = (pos.x + 0.5) * cell;
  const cy = (pos.y + 0.5) * cell;
  const size = cell * 0.85;
  if (drawSprite(ctx, `enemies/${enemy.type}.jpg`, cx, cy, size)) return;

  if (enemy.type === 'wisp') {
    const wobble = Math.sin(now / 200 + enemy.id) * cell * 0.06;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = COLORS.wisp;
    ctx.beginPath();
    ctx.arc(cx, cy + wobble, cell * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy + wobble, cell * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(cx - cell * 0.08, cy + wobble - cell * 0.04, cell * 0.05, 0, Math.PI * 2);
    ctx.arc(cx + cell * 0.08, cy + wobble - cell * 0.04, cell * 0.05, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (enemy.type === 'stalker') {
    ctx.fillStyle = COLORS.stalker;
    ctx.beginPath();
    ctx.moveTo(cx, cy - cell * 0.34);
    ctx.lineTo(cx + cell * 0.32, cy + cell * 0.28);
    ctx.lineTo(cx - cell * 0.32, cy + cell * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff7ed';
    ctx.beginPath();
    ctx.arc(cx, cy + cell * 0.02, cell * 0.08, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.fillStyle = COLORS.spitter;
  roundRect(ctx, cx - cell * 0.32, cy - cell * 0.32, cell * 0.64, cell * 0.64, cell * 0.16);
  ctx.fillStyle = '#1a2e05';
  ctx.beginPath();
  ctx.arc(cx, cy, cell * 0.14 * (1 + 0.2 * Math.sin(now / 150)), 0, Math.PI * 2);
  ctx.fill();
}

function drawBoss(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cell: number,
  now: number,
): void {
  const boss = state.boss;
  if (!boss) return;

  const x = (boss.pos.x - 1) * cell;
  const y = (boss.pos.y - 1) * cell;
  const size = cell * 3;
  const hit = now < boss.hitFlashUntil;
  const pulse = 0.5 + 0.5 * Math.sin(now / 300);
  const cx = x + size / 2;
  const cy = y + size / 2;

  ctx.globalAlpha = 0.25 + pulse * 0.2;
  ctx.fillStyle = COLORS.boss;
  roundRect(ctx, x - cell * 0.2, y - cell * 0.2, size + cell * 0.4, size + cell * 0.4, cell * 0.6);

  ctx.globalAlpha = 1;
  if (!drawSprite(ctx, 'enemies/boss.jpg', cx, cy, size - 4)) {
    ctx.fillStyle = hit ? '#fff1f2' : '#3f1d38';
    roundRect(ctx, x + 2, y + 2, size - 4, size - 4, cell * 0.5);

    ctx.fillStyle = COLORS.boss;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * (0.5 + pulse * 0.12), 0, Math.PI * 2);
    ctx.fill();
  } else if (hit) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff1f2';
    roundRect(ctx, x + 2, y + 2, size - 4, size - 4, cell * 0.5);
    ctx.restore();
  }

  ctx.fillStyle = '#fecdd3';
  for (let i = 0; i < boss.maxHp; i++) {
    const pipX = x + size / 2 - (boss.maxHp * cell * 0.22) / 2 + i * cell * 0.22;
    ctx.globalAlpha = i < boss.hp ? 1 : 0.22;
    ctx.fillRect(pipX, y - cell * 0.45, cell * 0.16, cell * 0.14);
  }
  ctx.globalAlpha = 1;
}

function drawSnake(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cell: number,
  t: number,
  now: number,
): void {
  const invulnerable = now < state.invulnUntil;
  const dashing = now < state.dashUntil;
  const blink = invulnerable && Math.floor(now / 90) % 2 === 0;

  ctx.save();
  ctx.globalAlpha = blink ? 0.45 : 1;

  if (dashing) {
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = cell * 0.9;
  }

  for (let i = state.snake.length - 1; i >= 0; i--) {
    const prev = state.prevSnake[i] ?? state.prevSnake[state.prevSnake.length - 1];
    const pos = interpolate(prev, state.snake[i], t);
    const ratio = state.snake.length > 1 ? i / (state.snake.length - 1) : 0;
    const inset = cell * (0.06 + ratio * 0.14);

    ctx.fillStyle = i === 0 ? COLORS.head : blendColor(COLORS.head, COLORS.tail, ratio);
    roundRect(
      ctx,
      pos.x * cell + inset,
      pos.y * cell + inset,
      cell - inset * 2,
      cell - inset * 2,
      cell * (i === 0 ? 0.34 : 0.28),
    );
  }

  ctx.restore();

  const headPrev = state.prevSnake[0];
  const head = interpolate(headPrev, state.snake[0], t);
  const hx = (head.x + 0.5) * cell;
  const hy = (head.y + 0.5) * cell;
  const facing =
    state.dir === 'left'
      ? { x: -1, y: 0 }
      : state.dir === 'right'
        ? { x: 1, y: 0 }
        : state.dir === 'up'
          ? { x: 0, y: -1 }
          : { x: 0, y: 1 };

  ctx.globalAlpha = blink ? 0.5 : 1;
  ctx.fillStyle = '#052e16';
  const eyeOffset = cell * 0.16;
  const sideX = facing.x === 0 ? eyeOffset : 0;
  const sideY = facing.y === 0 ? eyeOffset : 0;
  ctx.beginPath();
  ctx.arc(hx + facing.x * eyeOffset + sideX, hy + facing.y * eyeOffset + sideY, cell * 0.08, 0, Math.PI * 2);
  ctx.arc(hx + facing.x * eyeOffset - sideX, hy + facing.y * eyeOffset - sideY, cell * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function blendColor(from: string, to: string, t: number): string {
  const parse = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cell: number,
  t: number,
): void {
  ctx.fillStyle = COLORS.acid;
  for (const projectile of state.projectiles) {
    const pos = interpolate(projectile.prev, projectile.pos, t);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc((pos.x + 0.5) * cell, (pos.y + 0.5) * cell, cell * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc((pos.x + 0.5) * cell, (pos.y + 0.5) * cell, cell * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  cell: number,
  now: number,
): void {
  for (const effect of state.effects) {
    const progress = Math.min(1, Math.max(0, (now - effect.born) / effect.life));
    if (progress >= 1) continue;
    const cx = (effect.pos.x + 0.5) * cell;
    const cy = (effect.pos.y + 0.5) * cell;
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = effect.color;
    ctx.fillStyle = effect.color;

    if (effect.kind === 'ring') {
      ctx.lineWidth = cell * 0.12 * (1 - progress);
      ctx.beginPath();
      ctx.arc(cx, cy, cell * effect.radius * progress, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === 'burst') {
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const distance = cell * effect.radius * progress;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(angle) * distance,
          cy + Math.sin(angle) * distance,
          cell * 0.1 * (1 - progress),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else {
      ctx.globalAlpha = (1 - progress) * 0.5;
      roundRect(ctx, cx - cell * 0.45, cy - cell * 0.45, cell * 0.9, cell * 0.9, cell * 0.3);
    }
  }
  ctx.globalAlpha = 1;
}

export function drawArena(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  alpha: number,
  cell: number,
): void {
  const now = state.time + alpha * state.moveInterval;
  const t = state.phase === 'playing' ? alpha : 1;

  ctx.fillStyle = COLORS.backdrop;
  ctx.fillRect(0, 0, GRID * cell, GRID * cell);

  drawTerrain(ctx, state, cell);
  drawSpikes(ctx, state, cell);
  drawExit(ctx, state, cell, now);
  drawFruits(ctx, state, cell, now);
  drawBoss(ctx, state, cell, now);

  for (const enemy of state.enemies) {
    drawEnemy(ctx, enemy, interpolate(enemy.prev, enemy.pos, t), cell, now);
  }

  drawProjectiles(ctx, state, cell, t);
  drawSnake(ctx, state, cell, t, now);
  drawEffects(ctx, state, cell, now);
}

export { COLORS };
