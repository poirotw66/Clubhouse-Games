import React, { useEffect, useRef } from 'react';
import { FIELD_H, FIELD_W, FRAGMENT_ARM_SEC } from '../game/constants';
import { craftById, DEFAULT_CRAFT_ID } from '../game/crafts';
import { grazeRadius, hitboxRadius } from '../game/engine';
import type { JuiceState } from '../game/juice';
import type { Bullet, Enemy, RunState } from '../game/types';
import {
  abyssPlateSprite,
  bulletChipSprite,
  bulletOrbSprite,
  bulletWallSprite,
  crystalBossSprite,
  isCyanFamily,
  midwaySprite,
  shipSprite,
} from '../render/sprites';

interface Props {
  stateRef: React.MutableRefObject<RunState | null>;
  juiceRef: React.MutableRefObject<JuiceState>;
  paused: boolean;
  /** When true, skip shake / particle motion (prefers-reduced-motion). */
  reduceMotion: boolean;
}

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  speed: number;
  layer: number;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

function buildStars(count: number): Star[] {
  let seed = 0x9e3779b9;
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const layer = i % 3;
    stars.push({
      x: next() * FIELD_W,
      y: next() * FIELD_H,
      r: 0.35 + next() * (layer === 0 ? 1.1 : layer === 1 ? 1.6 : 2.2),
      a: 0.2 + next() * 0.7,
      speed: 8 + next() * 28 + layer * 22,
      layer,
    });
  }
  return stars;
}

function drawLightShafts(ctx: CanvasRenderingContext2D, elapsed: number, stage: number): void {
  const hues = [300, 190, 220, 25, 280];
  const hue = hues[Math.max(0, Math.min(4, stage - 1))];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(elapsed * 0.35 + i * 1.7) * 40;
    const x = FIELD_W * (0.2 + i * 0.28) + sway;
    const grad = ctx.createLinearGradient(x, 0, x + 30, FIELD_H);
    grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.07)`);
    grad.addColorStop(0.5, `hsla(${hue}, 90%, 60%, 0.03)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x - 18 - i * 4, 0);
    ctx.lineTo(x + 22 + i * 6, 0);
    ctx.lineTo(x + 48 + i * 10, FIELD_H);
    ctx.lineTo(x - 36 - i * 8, FIELD_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawAbyss(ctx: CanvasRenderingContext2D, elapsed: number, stars: Star[], stage: number): void {
  const plate = abyssPlateSprite(stage);
  ctx.drawImage(plate, 0, 0, FIELD_W, FIELD_H);

  // Parallax star layers.
  for (const star of stars) {
    const y = (star.y + elapsed * star.speed) % FIELD_H;
    const twinkle = 0.7 + 0.3 * Math.sin(elapsed * (2.2 + star.layer) + star.x);
    ctx.beginPath();
    ctx.arc(star.x, y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(226, 232, 240, ${star.a * twinkle})`;
    ctx.fill();
  }

  drawLightShafts(ctx, elapsed, stage);

  // Side vignette for depth.
  const left = ctx.createLinearGradient(0, 0, 36, 0);
  left.addColorStop(0, 'rgba(2, 4, 16, 0.78)');
  left.addColorStop(1, 'rgba(2, 4, 16, 0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, 36, FIELD_H);
  const right = ctx.createLinearGradient(FIELD_W, 0, FIELD_W - 36, 0);
  right.addColorStop(0, 'rgba(2, 4, 16, 0.78)');
  right.addColorStop(1, 'rgba(2, 4, 16, 0)');
  ctx.fillStyle = right;
  ctx.fillRect(FIELD_W - 36, 0, 36, FIELD_H);

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, FIELD_W - 2, FIELD_H - 2);
}

function drawFragment(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, armed: boolean): void {
  const pulse = 0.85 + Math.sin(age * 8) * 0.15;
  const size = (armed ? 7 : 4.5) * pulse;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(age * 2.2);
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = armed ? 'rgba(253, 230, 138, 0.35)' : 'rgba(253, 230, 138, 0.12)';
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.7, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.7, 0);
  ctx.closePath();
  ctx.fillStyle = armed ? '#fde68a' : 'rgba(253, 230, 138, 0.45)';
  ctx.fill();
  if (armed) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

function enemyHue(e: Enemy, stage: number): number {
  if (e.isBoss) return [310, 190, 230, 25, 290][Math.max(0, Math.min(4, stage - 1))];
  const hues = [200, 310, 25, 170, 280];
  return hues[e.id % hues.length];
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, t: number, stage: number): void {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.isBoss) {
    const spin = t * 0.45;
    const pulse = 1 + Math.sin(t * 2.4) * 0.045;
    const sprite = crystalBossSprite(stage);
    // Visual presence matches the cover crystal; collision radius stays e.r.
    const scale = ((e.r * 4.6) / 128) * pulse;
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 2.8, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${enemyHue(e, stage)}, 100%, 65%, 0.22)`;
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(spin);
    ctx.drawImage(sprite, -64 * scale, -64 * scale, 128 * scale, 128 * scale);

    // Orbiting shard accents.
    ctx.rotate(-spin);
    for (let i = 0; i < 6; i++) {
      const a = t * 1.15 + (Math.PI * 2 * i) / 6;
      const ox = Math.cos(a) * (e.r * 2.15);
      const oy = Math.sin(a) * (e.r * 1.15);
      ctx.beginPath();
      ctx.moveTo(ox, oy - 6);
      ctx.lineTo(ox + 5, oy);
      ctx.lineTo(ox, oy + 6);
      ctx.lineTo(ox - 5, oy);
      ctx.closePath();
      ctx.fillStyle = `hsla(${enemyHue(e, stage)}, 95%, 78%, 0.9)`;
      ctx.fill();
    }
  } else {
    const sprite = midwaySprite(e.id, enemyHue(e, stage));
    const scale = (e.r * 3.1) / 64;
    ctx.rotate(t * 0.9 + e.id * 0.7);
    ctx.drawImage(sprite, -32 * scale, -32 * scale, 64 * scale, 64 * scale);
  }

  ctx.restore();
}

function drawBossHud(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const w = 220;
  const x0 = FIELD_W / 2 - w / 2;
  const frac = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = 'rgba(15, 10, 30, 0.72)';
  ctx.fillRect(x0 - 4, 10, w + 8, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x0, 15, w, 6);
  const bar = ctx.createLinearGradient(x0, 0, x0 + w, 0);
  bar.addColorStop(0, '#f9a8d4');
  bar.addColorStop(0.5, '#e879f9');
  bar.addColorStop(1, '#22d3ee');
  ctx.fillStyle = bar;
  ctx.fillRect(x0, 15, w * frac, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x0, 15, w * frac, 2);
  for (const phase of e.card?.phases ?? []) {
    const px = x0 + w * phase.belowHpFrac;
    const passed = frac <= phase.belowHpFrac;
    ctx.fillStyle = passed ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)';
    ctx.fillRect(px - 0.75, 11, 1.5, 13);
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, bullets: Bullet[]): void {
  // Draw additive bloom underlay in one pass, then solid sprites — glow is
  // pre-baked so we never touch shadowBlur on the hot path.
  for (const b of bullets) {
    if (b.isWall) {
      const spr = bulletWallSprite(b.hue, b.r);
      ctx.drawImage(spr, b.x - spr.width / 2, b.y - spr.height / 2);
      continue;
    }
    const spr = isCyanFamily(b.hue) ? bulletChipSprite(b.hue, b.r) : bulletOrbSprite(b.hue, b.r);
    ctx.drawImage(spr, b.x - spr.width / 2, b.y - spr.height / 2);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, juice: JuiceState): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of juice.particles) {
    const t = Math.max(0, p.life / p.maxLife);
    const glow = p.r * t * 2.6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 95%, 68%, ${0.35 * t})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 100%, 85%, ${0.95 * t})`;
    ctx.fill();
  }
  ctx.restore();
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  focus: boolean,
  powerTier: number,
  trail: TrailPoint[],
  craftId: string,
  elapsed: number,
): void {
  const craft = craftById(craftId || DEFAULT_CRAFT_ID);
  const hullHue = craft.hullHue;
  const beamHue = craft.beamHue;

  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const t = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2 + (1 - t) * 5, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${beamHue}, 90%, 72%, ${0.4 * t})`;
    ctx.fill();
  }

  // Cosmetic muzzle beams — width/colour follow craft identity.
  const beams = Math.max(1, Math.min(7, 1 + powerTier + Math.max(0, craft.shotWidthBonus)));
  const spreadStep = craft.id === 'cannon' ? 10 : craft.id === 'stitch' ? 5 : 7;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < beams; i++) {
    const spread = (i - (beams - 1) / 2) * spreadStep;
    const grad = ctx.createLinearGradient(px + spread, py - 14, px + spread * 0.25, 0);
    grad.addColorStop(0, `hsla(${beamHue}, 95%, 78%, 0.7)`);
    grad.addColorStop(0.35, `hsla(${beamHue}, 90%, 70%, 0.28)`);
    grad.addColorStop(1, `hsla(${beamHue}, 90%, 70%, 0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = focus ? (craft.id === 'cannon' ? 2.4 : 1.35) : craft.id === 'cannon' ? 3.1 : 2.0;
    ctx.beginPath();
    ctx.moveTo(px + spread, py - 14);
    ctx.lineTo(px + spread * 0.22, 6);
    ctx.stroke();
  }
  ctx.restore();

  const flicker = 0.65 + Math.sin(elapsed * 28) * 0.35;
  ctx.beginPath();
  ctx.moveTo(px - 5, py + 10);
  ctx.lineTo(px, py + 10 + 14 * flicker);
  ctx.lineTo(px + 5, py + 10);
  ctx.closePath();
  ctx.fillStyle = `hsla(${beamHue}, 95%, 65%, ${0.65 * flicker})`;
  ctx.fill();

  // Soft aura under the craft so it reads as a neon body, not a tiny triangle.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.beginPath();
  ctx.arc(px, py, 22, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${hullHue}, 100%, 70%, 0.2)`;
  ctx.fill();
  ctx.restore();

  const spr = shipSprite(craft.id, hullHue, beamHue);
  const scale = 1.05;
  ctx.drawImage(spr, px - (spr.width * scale) / 2, py - (spr.height * scale) / 2 - 2, spr.width * scale, spr.height * scale);
}

/** Cheap screen-wide bloom: downsample bright field, blow it back up. */
function applyFieldBloom(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  down: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  strength: number,
): void {
  if (strength <= 0.01) return;
  const bw = Math.max(1, Math.floor(cssW / 4));
  const bh = Math.max(1, Math.floor(cssH / 4));
  if (down.width !== bw || down.height !== bh) {
    down.width = bw;
    down.height = bh;
  }
  const tctx = down.getContext('2d');
  if (!tctx) return;
  tctx.drawImage(src, 0, 0, bw, bh);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(0.42, strength);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(down, 0, 0, cssW, cssH);
  ctx.restore();
}

/**
 * Draws the field every animation frame straight from the simulation snapshot.
 * Juice (shake / particles) is presentation-only and never feeds back into step().
 */
export function GameCanvas({ stateRef, juiceRef, paused, reduceMotion }: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const bloomBufRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = buildStars(96);
    const trail: TrailPoint[] = [];
    let trailClock = 0;
    let frame = 0;
    let bloomScratch: HTMLCanvasElement | null = null;
    const bloomDown = document.createElement('canvas');

    const draw = (): void => {
      rafRef.current = requestAnimationFrame(draw);
      const s = stateRef.current;
      if (!s) return;
      const juice = juiceRef.current;
      frame += 1;

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr);
        canvas.height = Math.floor(cssH * dpr);
      }
      const scale = Math.min(cssW / FIELD_W, cssH / FIELD_H);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);

      ctx.save();
      const shakeAmt = reduceMotion ? 0 : juice.shake * 10;
      const ox = shakeAmt ? Math.sin(performance.now() / 18) * shakeAmt : 0;
      const oy = shakeAmt ? Math.cos(performance.now() / 14) * shakeAmt * 0.7 : 0;
      ctx.translate((cssW - FIELD_W * scale) / 2 + ox, (cssH - FIELD_H * scale) / 2 + oy);
      ctx.scale(scale, scale);

      drawAbyss(ctx, s.elapsed, stars, s.stage);

      for (const f of s.fragments) {
        drawFragment(ctx, f.x, f.y, f.age, f.age >= FRAGMENT_ARM_SEC);
      }

      for (const e of s.enemies) {
        drawEnemy(ctx, e, s.elapsed, s.stage);
        if (e.isBoss) drawBossHud(ctx, e);
      }

      // Soft dynamic light under the densest bullet cluster (boss / curtains).
      if (s.bullets.length > 40) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        let ax = 0;
        let ay = 0;
        const sample = Math.min(48, s.bullets.length);
        for (let i = 0; i < sample; i++) {
          const b = s.bullets[(i * 17) % s.bullets.length];
          ax += b.x;
          ay += b.y;
        }
        ax /= sample;
        ay /= sample;
        const light = ctx.createRadialGradient(ax, ay, 10, ax, ay, 160);
        light.addColorStop(0, 'rgba(244,114,182,0.08)');
        light.addColorStop(0.5, 'rgba(34,211,238,0.04)');
        light.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, FIELD_W, FIELD_H);
        ctx.restore();
      }

      drawBullets(ctx, s.bullets);

      if (!reduceMotion) drawParticles(ctx, juice);

      trailClock += 1;
      if (trailClock % 2 === 0) {
        trail.push({ x: s.px, y: s.py + 10, life: 1 });
      }
      for (const p of trail) p.life -= 0.045;
      while (trail.length > 0 && trail[0].life <= 0) trail.shift();

      const blinking = s.invuln > 0 && Math.floor(s.invuln * 12) % 2 === 0;
      if (!blinking) {
        drawShip(ctx, s.px, s.py, s.focus, s.powerTier, trail, s.craftId, s.elapsed);
      }

      if (s.focus) {
        const gr = grazeRadius(s);
        ctx.beginPath();
        ctx.arc(s.px, s.py, gr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(125,211,252,0.22)';
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s.px, s.py, gr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(165,243,252,0.6)';
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
      // Hitbox always readable — small pink core when focusing (fairness cue).
      ctx.beginPath();
      ctx.arc(s.px, s.py, hitboxRadius(s), 0, Math.PI * 2);
      ctx.fillStyle = s.focus ? '#f472b6' : 'rgba(244,114,182,0.65)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();

      // Screen-wide bloom every other frame (still reads continuous; cheaper on mobile).
      if (!reduceMotion && (s.bullets.length > 28 || juice.flash > 0.05) && frame % 2 === 0) {
        if (!bloomScratch || bloomScratch.width !== canvas.width || bloomScratch.height !== canvas.height) {
          bloomScratch = document.createElement('canvas');
          bloomScratch.width = canvas.width;
          bloomScratch.height = canvas.height;
          bloomBufRef.current = bloomScratch;
        }
        const bctx = bloomScratch.getContext('2d');
        if (bctx) {
          bctx.setTransform(1, 0, 0, 1, 0, 0);
          bctx.clearRect(0, 0, bloomScratch.width, bloomScratch.height);
          bctx.drawImage(canvas, 0, 0);
          const strength = 0.16 + Math.min(0.2, s.bullets.length / 1000) + juice.flash * 0.25;
          applyFieldBloom(ctx, bloomScratch, bloomDown, cssW, cssH, strength);
        }
      }

      if (!reduceMotion && juice.flash > 0) {
        const flash = Math.min(0.7, juice.flash * 0.7);
        ctx.fillStyle = `rgba(236, 254, 255, ${flash * 0.5})`;
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.fillStyle = `rgba(244, 114, 182, ${flash * 0.28})`;
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.fillStyle = `rgba(34, 211, 238, ${flash * 0.12})`;
        ctx.fillRect(0, 0, cssW, cssH);
      }

      if (paused) {
        ctx.fillStyle = 'rgba(4,6,20,0.62)';
        ctx.fillRect(0, 0, cssW, cssH);
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [stateRef, juiceRef, paused, reduceMotion]);

  return <canvas ref={canvasRef} className="w-full h-full block touch-none" aria-label="彈幕戰場" />;
}
