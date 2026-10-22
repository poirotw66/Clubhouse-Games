/**
 * Contact juice: screen shake, brief hit-stop, dust/spark particles.
 * Respects prefers-reduced-motion (caller passes prefersReducedMotion).
 */

import type { ContactGrade } from './difficulty.ts';

export interface HitParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  /** 'dust' = dirt brown, 'spark' = bright flash. */
  kind: 'dust' | 'spark';
  hue: number;
}

export interface HitFeelBurst {
  screenShake: number;
  hitStop: number;
  particles: HitParticle[];
}

const GRADE_SHAKE: Record<ContactGrade, number> = {
  perfect: 1.15,
  good: 0.7,
  ok: 0.35,
  weak: 0.12,
};

const GRADE_HIT_STOP: Record<ContactGrade, number> = {
  perfect: 0.085,
  good: 0.055,
  ok: 0.03,
  weak: 0.012,
};

const GRADE_COUNT: Record<ContactGrade, { dust: number; spark: number }> = {
  perfect: { dust: 14, spark: 10 },
  good: { dust: 10, spark: 5 },
  ok: { dust: 6, spark: 2 },
  weak: { dust: 3, spark: 0 },
};

export function prefersReducedMotion(): boolean {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Build a one-shot hit feel burst at contact point.
 * When reduced motion is on: no shake / hit-stop / particles (banner still OK).
 */
export function createHitFeelBurst(
  grade: ContactGrade,
  x: number,
  y: number,
  rng: () => number,
  reducedMotion: boolean,
): HitFeelBurst {
  if (reducedMotion) {
    return { screenShake: 0, hitStop: 0, particles: [] };
  }
  const counts = GRADE_COUNT[grade];
  const particles: HitParticle[] = [];
  for (let i = 0; i < counts.dust; i++) {
    const angle = rng() * Math.PI * 2;
    const speed = 40 + rng() * 120;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 30,
      life: 0.35 + rng() * 0.35,
      maxLife: 0.55,
      size: 2 + rng() * 3.5,
      kind: 'dust',
      hue: 28 + rng() * 18,
    });
  }
  for (let i = 0; i < counts.spark; i++) {
    const angle = -Math.PI / 2 + (rng() - 0.5) * 1.4;
    const speed = 80 + rng() * 180;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.18 + rng() * 0.22,
      maxLife: 0.4,
      size: 1.5 + rng() * 2.5,
      kind: 'spark',
      hue: grade === 'perfect' ? 45 + rng() * 20 : 50 + rng() * 40,
    });
  }
  return {
    screenShake: GRADE_SHAKE[grade],
    hitStop: GRADE_HIT_STOP[grade],
    particles,
  };
}

export function updateHitParticles(particles: HitParticle[], dt: number): HitParticle[] {
  const next: HitParticle[] = [];
  for (const p of particles) {
    const life = p.life - dt;
    if (life <= 0) continue;
    next.push({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vy: p.vy + 280 * dt,
      vx: p.vx * (1 - 1.8 * dt),
      life,
    });
  }
  return next;
}

export function drawHitParticles(
  ctx: CanvasRenderingContext2D,
  particles: HitParticle[],
): void {
  for (const p of particles) {
    const t = Math.max(0, p.life / Math.max(0.01, p.maxLife));
    const alpha = Math.min(1, t);
    if (p.kind === 'spark') {
      ctx.fillStyle = `hsla(${p.hue}, 95%, 65%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + t), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = `hsla(${p.hue}, 45%, 42%, ${alpha * 0.85})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size * 1.2, p.size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
