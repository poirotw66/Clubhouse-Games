import React, { useEffect, useRef } from 'react';
import { FIELD_H, FIELD_W, FRAGMENT_ARM_SEC } from '../game/constants';
import { craftById, DEFAULT_CRAFT_ID } from '../game/crafts';
import { grazeRadius, hitboxRadius } from '../game/engine';
import type { JuiceState } from '../game/juice';
import type { Bullet, Enemy, RunState } from '../game/types';

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
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

function buildStars(count: number): Star[] {
  // Deterministic starfield so the abyss looks the same every run start.
  let seed = 0x9e3779b9;
  const next = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: next() * FIELD_W,
      y: next() * FIELD_H,
      r: 0.4 + next() * 1.6,
      a: 0.25 + next() * 0.65,
      speed: 12 + next() * 48,
    });
  }
  return stars;
}

function drawAbyss(ctx: CanvasRenderingContext2D, elapsed: number, stars: Star[]): void {
  const bg = ctx.createLinearGradient(0, 0, 0, FIELD_H);
  bg.addColorStop(0, '#040510');
  bg.addColorStop(0.35, '#0c0a24');
  bg.addColorStop(0.7, '#141036');
  bg.addColorStop(1, '#1c1248');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  const pulse = 0.5 + 0.5 * Math.sin(elapsed * 0.7);
  const nebula = ctx.createRadialGradient(
    FIELD_W * 0.28,
    FIELD_H * 0.18,
    8,
    FIELD_W * 0.28,
    FIELD_H * 0.18,
    240,
  );
  nebula.addColorStop(0, `rgba(232, 121, 249, ${0.2 + pulse * 0.08})`);
  nebula.addColorStop(1, 'rgba(232, 121, 249, 0)');
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  const nebula2 = ctx.createRadialGradient(
    FIELD_W * 0.78,
    FIELD_H * 0.58,
    6,
    FIELD_W * 0.78,
    FIELD_H * 0.58,
    230,
  );
  nebula2.addColorStop(0, `rgba(45, 212, 191, ${0.14 + (1 - pulse) * 0.06})`);
  nebula2.addColorStop(1, 'rgba(45, 212, 191, 0)');
  ctx.fillStyle = nebula2;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  const veil = ctx.createRadialGradient(
    FIELD_W * 0.5,
    FIELD_H * 0.92,
    20,
    FIELD_W * 0.5,
    FIELD_H * 0.92,
    280,
  );
  veil.addColorStop(0, 'rgba(251, 113, 133, 0.12)');
  veil.addColorStop(1, 'rgba(251, 113, 133, 0)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  for (const star of stars) {
    const y = (star.y + elapsed * star.speed) % FIELD_H;
    const twinkle = 0.75 + 0.25 * Math.sin(elapsed * 3 + star.x);
    ctx.beginPath();
    ctx.arc(star.x, y, star.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(226, 232, 240, ${star.a * twinkle})`;
    ctx.fill();
  }

  const left = ctx.createLinearGradient(0, 0, 32, 0);
  left.addColorStop(0, 'rgba(2, 4, 16, 0.72)');
  left.addColorStop(1, 'rgba(2, 4, 16, 0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, 32, FIELD_H);
  const right = ctx.createLinearGradient(FIELD_W, 0, FIELD_W - 32, 0);
  right.addColorStop(0, 'rgba(2, 4, 16, 0.72)');
  right.addColorStop(1, 'rgba(2, 4, 16, 0)');
  ctx.fillStyle = right;
  ctx.fillRect(FIELD_W - 32, 0, 32, FIELD_H);

  // Soft field rim so the canvas reads as a framed abyss against HUD chrome.
  ctx.strokeStyle = 'rgba(125, 211, 252, 0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, FIELD_W - 2, FIELD_H - 2);
}

function drawFragment(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, armed: boolean): void {
  const pulse = 0.85 + Math.sin(age * 8) * 0.15;
  const size = (armed ? 6 : 4) * pulse;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(age * 2.2);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.7, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.7, 0);
  ctx.closePath();
  ctx.fillStyle = armed ? '#fde68a' : 'rgba(253, 230, 138, 0.45)';
  ctx.fill();
  if (armed) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, t: number): void {
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.isBoss) {
    const spin = t * 0.6;
    ctx.rotate(spin * 0.08);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -e.r * 0.2);
      ctx.quadraticCurveTo(side * e.r * 1.55, -e.r * 0.4, side * e.r * 1.2, e.r * 0.55);
      ctx.quadraticCurveTo(side * e.r * 0.55, e.r * 0.15, 0, e.r * 0.35);
      ctx.closePath();
      ctx.fillStyle = 'rgba(244, 114, 182, 0.55)';
      ctx.fill();
    }
    const core = ctx.createRadialGradient(0, 0, 2, 0, 0, e.r);
    core.addColorStop(0, '#fce7f3');
    core.addColorStop(0.45, '#f472b6');
    core.addColorStop(1, 'rgba(190, 24, 93, 0.9)');
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    const sides = e.r > 18 ? 6 : 4;
    ctx.rotate(t * 0.9 + e.id);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (Math.PI * 2 * i) / sides - Math.PI / 2;
      const r = e.r * (i % 2 === 0 ? 1 : 0.72);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const fill = ctx.createRadialGradient(0, 0, 1, 0, 0, e.r);
    fill.addColorStop(0, '#e2e8f0');
    fill.addColorStop(0.55, '#94a3b8');
    fill.addColorStop(1, '#475569');
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  ctx.restore();
}

function drawBossHud(ctx: CanvasRenderingContext2D, e: Enemy): void {
  const w = 220;
  const x0 = FIELD_W / 2 - w / 2;
  const frac = Math.max(0, e.hp / e.maxHp);
  ctx.fillStyle = 'rgba(15, 10, 30, 0.65)';
  ctx.fillRect(x0 - 4, 10, w + 8, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(x0, 14, w, 5);
  const bar = ctx.createLinearGradient(x0, 0, x0 + w, 0);
  bar.addColorStop(0, '#f9a8d4');
  bar.addColorStop(1, '#e879f9');
  ctx.fillStyle = bar;
  ctx.fillRect(x0, 14, w * frac, 5);
  for (const phase of e.card?.phases ?? []) {
    const px = x0 + w * phase.belowHpFrac;
    const passed = frac <= phase.belowHpFrac;
    ctx.fillStyle = passed ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
    ctx.fillRect(px - 0.75, 11, 1.5, 11);
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, bullets: Bullet[]): void {
  const buckets = new Map<number, Bullet[]>();
  for (const b of bullets) {
    const key = Math.round(b.hue / 30) * 30 + (b.isWall ? 1000 : 0);
    const list = buckets.get(key);
    if (list) list.push(b);
    else buckets.set(key, [b]);
  }

  for (const [key, list] of buckets) {
    const isWall = key >= 1000;
    const hue = key - (isWall ? 1000 : 0);

    if (!isWall) {
      // Soft bloom halo — premium field density without changing hit sizes.
      ctx.beginPath();
      for (const b of list) {
        const r = b.r * 2.15;
        ctx.moveTo(b.x + r, b.y);
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = `hsla(${hue}, 100%, 62%, 0.16)`;
      ctx.fill();

      ctx.beginPath();
      for (const b of list) {
        const r = b.r * 1.55;
        ctx.moveTo(b.x + r, b.y);
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = `hsla(${hue}, 95%, 68%, 0.28)`;
      ctx.fill();
    }

    ctx.beginPath();
    for (const b of list) {
      if (isWall) {
        ctx.rect(b.x - b.r, b.y - b.r * 0.72, b.r * 2, b.r * 1.44);
      } else {
        ctx.moveTo(b.x + b.r, b.y);
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = isWall ? `hsla(${hue}, 95%, 82%, 0.98)` : `hsla(${hue}, 92%, 74%, 0.96)`;
    ctx.fill();
    ctx.lineWidth = isWall ? 2.2 : 1.35;
    ctx.strokeStyle = `hsla(${hue}, 100%, ${isWall ? 97 : 94}%, ${isWall ? 1 : 0.9})`;
    ctx.stroke();

    if (!isWall) {
      ctx.beginPath();
      for (const b of list) {
        const r = Math.max(1.2, b.r * 0.42);
        ctx.moveTo(b.x + r, b.y);
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      }
      ctx.fillStyle = `hsla(${hue}, 100%, 94%, 0.98)`;
      ctx.fill();
    }
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, juice: JuiceState): void {
  for (const p of juice.particles) {
    const t = Math.max(0, p.life / p.maxLife);
    const glow = p.r * t * 2.2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 95%, 68%, ${0.28 * t})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${p.hue}, 95%, 78%, ${0.92 * t})`;
    ctx.fill();
  }
}

function drawShip(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  focus: boolean,
  powerTier: number,
  trail: TrailPoint[],
  craftId: string,
): void {
  const craft = craftById(craftId || DEFAULT_CRAFT_ID);
  const hullHue = craft.hullHue;
  const beamHue = craft.beamHue;

  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const t = p.life;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + (1 - t) * 4, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${beamHue}, 85%, 70%, ${0.35 * t})`;
    ctx.fill();
  }

  // Cosmetic muzzle beams — width/colour follow craft identity.
  const beams = Math.max(1, Math.min(7, 1 + powerTier + Math.max(0, craft.shotWidthBonus)));
  const spreadStep = craft.id === 'cannon' ? 10 : craft.id === 'stitch' ? 5 : 7;
  for (let i = 0; i < beams; i++) {
    const spread = (i - (beams - 1) / 2) * spreadStep;
    const grad = ctx.createLinearGradient(px + spread, py - 12, px + spread * 0.3, 0);
    grad.addColorStop(0, `hsla(${beamHue}, 90%, 80%, 0.55)`);
    grad.addColorStop(1, `hsla(${beamHue}, 90%, 80%, 0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = focus ? (craft.id === 'cannon' ? 2.2 : 1.2) : craft.id === 'cannon' ? 2.8 : 1.8;
    ctx.beginPath();
    ctx.moveTo(px + spread, py - 12);
    ctx.lineTo(px + spread * 0.25, 8);
    ctx.stroke();
  }

  const flicker = 0.7 + Math.sin(performance.now() / 40) * 0.3;
  ctx.beginPath();
  ctx.moveTo(px - 4, py + 8);
  ctx.lineTo(px, py + 8 + 10 * flicker);
  ctx.lineTo(px + 4, py + 8);
  ctx.closePath();
  ctx.fillStyle = `hsla(${beamHue}, 90%, 60%, ${0.55 * flicker})`;
  ctx.fill();

  // Hull silhouette varies slightly by craft.
  ctx.beginPath();
  if (craft.id === 'cannon') {
    ctx.moveTo(px, py - 12);
    ctx.lineTo(px - 14, py + 11);
    ctx.lineTo(px - 4, py + 4);
    ctx.lineTo(px, py + 10);
    ctx.lineTo(px + 4, py + 4);
    ctx.lineTo(px + 14, py + 11);
  } else if (craft.id === 'stitch') {
    ctx.moveTo(px, py - 16);
    ctx.lineTo(px - 8, py + 9);
    ctx.lineTo(px - 2, py + 4);
    ctx.lineTo(px, py + 8);
    ctx.lineTo(px + 2, py + 4);
    ctx.lineTo(px + 8, py + 9);
  } else {
    ctx.moveTo(px, py - 14);
    ctx.lineTo(px - 11, py + 10);
    ctx.lineTo(px - 3, py + 5);
    ctx.lineTo(px, py + 9);
    ctx.lineTo(px + 3, py + 5);
    ctx.lineTo(px + 11, py + 10);
  }
  ctx.closePath();
  const hull = ctx.createLinearGradient(px, py - 14, px, py + 10);
  hull.addColorStop(0, `hsl(${hullHue}, 80%, 92%)`);
  hull.addColorStop(0.45, `hsl(${hullHue}, 75%, 65%)`);
  hull.addColorStop(1, `hsl(${hullHue}, 70%, 40%)`);
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(px, py - 2, craft.id === 'cannon' ? 3.8 : 3.2, craft.id === 'stitch' ? 5.2 : 4.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = `hsla(${(hullHue + 80) % 360}, 70%, 70%, 0.85)`;
  ctx.fill();
}

/**
 * Draws the field every animation frame straight from the simulation snapshot.
 * Juice (shake / particles) is presentation-only and never feeds back into step().
 */
export function GameCanvas({ stateRef, juiceRef, paused, reduceMotion }: Props): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = buildStars(72);
    const trail: TrailPoint[] = [];
    let trailClock = 0;

    const draw = (): void => {
      rafRef.current = requestAnimationFrame(draw);
      const s = stateRef.current;
      if (!s) return;
      const juice = juiceRef.current;

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
      const ox = shakeAmt ? (Math.sin(performance.now() / 18) * shakeAmt) : 0;
      const oy = shakeAmt ? (Math.cos(performance.now() / 14) * shakeAmt * 0.7) : 0;
      ctx.translate((cssW - FIELD_W * scale) / 2 + ox, (cssH - FIELD_H * scale) / 2 + oy);
      ctx.scale(scale, scale);

      drawAbyss(ctx, s.elapsed, stars);

      for (const f of s.fragments) {
        drawFragment(ctx, f.x, f.y, f.age, f.age >= FRAGMENT_ARM_SEC);
      }

      for (const e of s.enemies) {
        drawEnemy(ctx, e, s.elapsed);
        if (e.isBoss) drawBossHud(ctx, e);
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
        drawShip(ctx, s.px, s.py, s.focus, s.powerTier, trail, s.craftId);
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
        ctx.strokeStyle = 'rgba(165,243,252,0.55)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(s.px, s.py, hitboxRadius(s), 0, Math.PI * 2);
      ctx.fillStyle = s.focus ? '#f472b6' : 'rgba(244,114,182,0.6)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 0.9;
      ctx.stroke();

      ctx.restore();

      // Full-field flash after bomb / capture / boss kill (gated by reduceMotion).
      if (!reduceMotion && juice.flash > 0) {
        const flash = Math.min(0.62, juice.flash * 0.62);
        ctx.fillStyle = `rgba(236, 254, 255, ${flash * 0.55})`;
        ctx.fillRect(0, 0, cssW, cssH);
        ctx.fillStyle = `rgba(244, 114, 182, ${flash * 0.22})`;
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
