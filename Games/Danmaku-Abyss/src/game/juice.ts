/**
 * Presentation juice driven by RunState diffs — never mutates the simulation.
 * Shake / hit-stop / particles / flash respect prefers-reduced-motion at the call site.
 */
import type { RunState } from './types';

export interface FxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: number;
  r: number;
}

export interface JuiceState {
  shake: number;
  hitStop: number;
  /** Full-field white flash (0..1); drawn as a canvas overlay. */
  flash: number;
  particles: FxParticle[];
  /** Graze count at last juice pulse — used to detect streaks. */
  lastGrazePulse: number;
  /** Last graze count for per-graze sparks (finer than streak pulses). */
  lastGrazeCount: number;
  /** Boss hp snapshot for "big hit" detection. */
  lastBossHp: number;
  lastBossId: number;
}

export function emptyJuice(): JuiceState {
  return {
    shake: 0,
    hitStop: 0,
    flash: 0,
    particles: [],
    lastGrazePulse: 0,
    lastGrazeCount: 0,
    lastBossHp: 0,
    lastBossId: -1,
  };
}

function burst(
  juice: JuiceState,
  x: number,
  y: number,
  hue: number,
  count: number,
  speed = 90,
): void {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + (i % 3) * 0.2;
    const sp = speed * (0.55 + (i % 5) * 0.09);
    juice.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.38 + (i % 4) * 0.06,
      maxLife: 0.52,
      hue,
      r: 2.4 + (i % 4),
    });
  }
}

export interface JuiceAudioHooks {
  impact: (strength: number) => void;
  combo: (step: number) => void;
  capture: () => void;
}

/**
 * Compare consecutive snapshots and queue shake / hit-stop / particles / flash.
 * Call only when motion is allowed; audio hooks are optional no-ops when muted.
 */
export function observeJuice(
  juice: JuiceState,
  prev: RunState | null,
  next: RunState,
  audio: JuiceAudioHooks,
): void {
  if (!prev) {
    juice.lastGrazePulse = next.grazeCount;
    juice.lastGrazeCount = next.grazeCount;
    const boss = next.enemies.find((e) => e.isBoss);
    juice.lastBossHp = boss?.hp ?? 0;
    juice.lastBossId = boss?.id ?? -1;
    return;
  }

  // Hit (lost a life).
  if (next.lives < prev.lives) {
    juice.shake = Math.max(juice.shake, 1.15);
    juice.hitStop = Math.max(juice.hitStop, 0.07);
    juice.flash = Math.max(juice.flash, 0.55);
    burst(juice, next.px, next.py, 350, 18, 155);
    audio.impact(0.85);
  }

  // Bomb spent — cancel sparks scale with how many bullets vanished.
  if (next.bombs < prev.bombs) {
    juice.shake = Math.max(juice.shake, 0.95);
    juice.flash = Math.max(juice.flash, 0.7);
    const cleared = Math.max(0, prev.bullets.length - next.bullets.length);
    burst(juice, next.px, next.py, 45, 22, 175);
    if (cleared > 0) {
      const samples = Math.min(12, Math.max(4, Math.floor(cleared / 8)));
      for (let i = 0; i < samples; i++) {
        const b = prev.bullets[(i * 7) % prev.bullets.length];
        if (b) burst(juice, b.x, b.y, 50, 3, 70);
      }
    }
    audio.impact(0.7);
  }

  // Craft special cast (cooldown jumped up from ready).
  if (next.specialCd > prev.specialCd && next.specialLeft > prev.specialLeft) {
    juice.shake = Math.max(juice.shake, 0.4);
    juice.flash = Math.max(juice.flash, 0.35);
    burst(juice, next.px, next.py, 190, 14, 125);
    audio.impact(0.35);
  }

  // Spell capture or timeout banner.
  if (next.lastCardResult && next.lastCardResult !== prev.lastCardResult) {
    if (next.lastCardResult === 'captured') {
      juice.shake = Math.max(juice.shake, 0.7);
      juice.hitStop = Math.max(juice.hitStop, 0.06);
      juice.flash = Math.max(juice.flash, 0.75);
      const boss = next.enemies.find((e) => e.isBoss) ?? prev.enemies.find((e) => e.isBoss);
      const bx = boss?.x ?? FIELD_CX;
      const by = boss?.y ?? 120;
      burst(juice, bx, by, 300, 28, 160);
      burst(juice, bx, by, 45, 16, 110);
      burst(juice, bx, by, 190, 12, 90);
      audio.capture();
    }
  }

  // Boss fully defeated (left the field) — screen-wide crystal shatter.
  const prevBoss = prev.enemies.find((e) => e.isBoss);
  const nextBoss = next.enemies.find((e) => e.isBoss);
  if (prevBoss && !nextBoss && next.bossSpawned) {
    juice.shake = Math.max(juice.shake, 1.55);
    juice.hitStop = Math.max(juice.hitStop, 0.12);
    juice.flash = Math.max(juice.flash, 0.95);
    burst(juice, prevBoss.x, prevBoss.y, 320, 36, 220);
    burst(juice, prevBoss.x, prevBoss.y, 190, 22, 160);
    burst(juice, prevBoss.x, prevBoss.y, 40, 18, 130);
    audio.impact(1);
  }

  // Midway / non-boss destroy sparks.
  if (prev.enemies.length > next.enemies.length) {
    const nextIds = new Set(next.enemies.map((e) => e.id));
    for (const e of prev.enemies) {
      if (e.isBoss || nextIds.has(e.id)) continue;
      burst(juice, e.x, e.y, 200, 11, 115);
      burst(juice, e.x, e.y, 40, 5, 70);
    }
  }

  // Big hit on boss HP — hit sparks.
  if (nextBoss && nextBoss.id === juice.lastBossId) {
    const drop = juice.lastBossHp - nextBoss.hp;
    if (drop >= 180) {
      juice.hitStop = Math.max(juice.hitStop, 0.045);
      burst(juice, nextBoss.x, nextBoss.y, 300, 12, 95);
      burst(juice, nextBoss.x, nextBoss.y, 45, 6, 60);
      audio.impact(0.4);
    }
    juice.lastBossHp = nextBoss.hp;
  } else if (nextBoss) {
    juice.lastBossId = nextBoss.id;
    juice.lastBossHp = nextBoss.hp;
  } else {
    juice.lastBossId = -1;
    juice.lastBossHp = 0;
  }

  // Per-graze micro sparks + brief cyan flash ring cue.
  const grazeDelta = next.grazeCount - juice.lastGrazeCount;
  if (grazeDelta > 0) {
    const sparks = Math.min(4, grazeDelta);
    for (let i = 0; i < sparks; i++) {
      juice.particles.push({
        x: next.px + (i - 1.5) * 5,
        y: next.py - 6,
        vx: (i - 1.5) * 22,
        vy: -48 - i * 10,
        life: 0.2,
        maxLife: 0.26,
        hue: 185 + (i % 2) * 100,
        r: 2.0,
      });
    }
    juice.flash = Math.max(juice.flash, 0.08);
    juice.lastGrazeCount = next.grazeCount;
  }

  // Graze streak pulses (every 8 grazes after the last pulse).
  const gained = next.grazeCount - juice.lastGrazePulse;
  if (gained >= 8) {
    juice.lastGrazePulse = next.grazeCount;
    juice.hitStop = Math.max(juice.hitStop, 0.03);
    juice.flash = Math.max(juice.flash, 0.28);
    burst(juice, next.px, next.py, 280, 10, 70);
    burst(juice, next.px, next.py, 190, 6, 50);
    audio.combo(Math.min(8, Math.floor(next.grazeMult)));
  }
}

const FIELD_CX = 200;

/** Advance presentation timers; does not touch the simulation clock. */
export function tickJuice(juice: JuiceState, dt: number): void {
  if (juice.shake > 0) juice.shake = Math.max(0, juice.shake - dt * 4.2);
  if (juice.hitStop > 0) juice.hitStop = Math.max(0, juice.hitStop - dt);
  if (juice.flash > 0) juice.flash = Math.max(0, juice.flash - dt * 5.5);
  const kept: FxParticle[] = [];
  for (const p of juice.particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
    kept.push(p);
  }
  juice.particles = kept.length > 180 ? kept.slice(-180) : kept;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
