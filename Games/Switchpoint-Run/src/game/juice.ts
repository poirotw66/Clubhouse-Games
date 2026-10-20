/**
 * Presentation-only juice helpers. Pure enough for unit tests; the canvas and
 * App consume the mutable FxState. Never imported by the simulation step.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'spark' | 'ring' | 'streak';
}

export interface FxState {
  /** Screen shake amplitude in field units; decays each frame. */
  shake: number;
  /** Remaining hit-stop seconds (real time); App holds the sim while > 0. */
  hitStop: number;
  /** Flash strength 0..1 for fork lock / pickup. */
  flash: number;
  /** Speed-line intensity 0..1 driven by player speed. */
  speedLines: number;
  /** Combo callout timer (seconds remaining). */
  comboPop: number;
  comboValue: number;
  particles: Particle[];
}

export function createFx(): FxState {
  return {
    shake: 0,
    hitStop: 0,
    flash: 0,
    speedLines: 0,
    comboPop: 0,
    comboValue: 0,
    particles: [],
  };
}

export function prefersReducedMotion(): boolean {
  try {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function pushParticle(fx: FxState, p: Particle, cap = 120): void {
  if (fx.particles.length >= cap) fx.particles.shift();
  fx.particles.push(p);
}

export function burstParticles(
  fx: FxState,
  x: number,
  y: number,
  color: string,
  count: number,
  speed = 80,
): void {
  if (prefersReducedMotion()) {
    fx.flash = Math.max(fx.flash, 0.35);
    return;
  }
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const mag = speed * (0.45 + Math.random() * 0.7);
    pushParticle(fx, {
      x,
      y,
      vx: Math.cos(angle) * mag,
      vy: Math.sin(angle) * mag - 20,
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.55,
      size: 2 + Math.random() * 3,
      color,
      kind: 'spark',
    });
  }
}

export function ringBurst(fx: FxState, x: number, y: number, color: string): void {
  if (prefersReducedMotion()) {
    fx.flash = Math.max(fx.flash, 0.45);
    return;
  }
  pushParticle(fx, {
    x,
    y,
    vx: 0,
    vy: 0,
    life: 0.4,
    maxLife: 0.4,
    size: 8,
    color,
    kind: 'ring',
  });
}

/** Hit: shake + brief hit-stop + red sparks. */
export function triggerHit(fx: FxState, x: number, y: number): void {
  if (prefersReducedMotion()) {
    fx.flash = Math.max(fx.flash, 0.5);
    return;
  }
  fx.shake = Math.max(fx.shake, 7);
  fx.hitStop = Math.max(fx.hitStop, 0.055);
  burstParticles(fx, x, y, '#f87171', 14, 110);
}

/** Successful dodge / near-miss. */
export function triggerNearMiss(fx: FxState, x: number, y: number): void {
  if (prefersReducedMotion()) return;
  fx.shake = Math.max(fx.shake, 2.5);
  burstParticles(fx, x, y, '#fbbf24', 8, 70);
  ringBurst(fx, x, y, 'rgba(251, 191, 36, 0.7)');
}

/** Supply or score pickup. */
export function triggerPickup(fx: FxState, x: number, y: number, kind: 'supply' | 'score'): void {
  const color = kind === 'supply' ? '#34d399' : '#fbbf24';
  if (prefersReducedMotion()) {
    fx.flash = Math.max(fx.flash, 0.4);
    return;
  }
  burstParticles(fx, x, y, color, 16, 90);
  ringBurst(fx, x, y, color);
  fx.flash = Math.max(fx.flash, 0.55);
}

/** Fork lock / switch commit. */
export function triggerSwitch(fx: FxState, x: number, y: number, accent: string): void {
  if (prefersReducedMotion()) {
    fx.flash = Math.max(fx.flash, 0.35);
    return;
  }
  fx.shake = Math.max(fx.shake, 3.5);
  fx.flash = Math.max(fx.flash, 0.65);
  burstParticles(fx, x, y, accent, 12, 100);
  ringBurst(fx, x, y, accent);
}

/** Combo / streak tick. */
export function triggerCombo(fx: FxState, streak: number): void {
  fx.comboValue = streak;
  fx.comboPop = prefersReducedMotion() ? 0.45 : 0.7;
}

/** Advance juice timers; `dt` is real frame time, not sim time. */
export function tickFx(fx: FxState, dt: number, playerSpeed: number, baseSpeed: number): void {
  const reduced = prefersReducedMotion();
  if (fx.hitStop > 0) fx.hitStop = Math.max(0, fx.hitStop - dt);
  if (fx.shake > 0) fx.shake = Math.max(0, fx.shake - dt * (reduced ? 40 : 22));
  if (fx.flash > 0) fx.flash = Math.max(0, fx.flash - dt * 2.8);
  if (fx.comboPop > 0) fx.comboPop = Math.max(0, fx.comboPop - dt);

  const speedNorm = Math.max(0, Math.min(1.4, playerSpeed / Math.max(1, baseSpeed)));
  const targetLines = reduced ? 0 : Math.max(0, speedNorm - 0.85) / 0.55;
  fx.speedLines += (targetLines - fx.speedLines) * Math.min(1, dt * 6);

  for (let i = fx.particles.length - 1; i >= 0; i--) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.kind === 'ring') {
      p.size += dt * 90;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
      p.vx *= 0.98;
    }
    if (p.life <= 0) fx.particles.splice(i, 1);
  }
}

export function shakeOffset(fx: FxState): { x: number; y: number } {
  if (fx.shake <= 0 || prefersReducedMotion()) return { x: 0, y: 0 };
  const a = fx.shake;
  return {
    x: (Math.random() - 0.5) * a * 2,
    y: (Math.random() - 0.5) * a * 1.4,
  };
}
