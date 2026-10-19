/**
 * Presentation juice driven by RunState diffs — never mutates the simulation.
 * Shake / hit-stop / particles respect prefers-reduced-motion at the call site.
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
  particles: FxParticle[];
  /** Graze count at last juice pulse — used to detect streaks. */
  lastGrazePulse: number;
  /** Boss hp snapshot for "big hit" detection. */
  lastBossHp: number;
  lastBossId: number;
}

export function emptyJuice(): JuiceState {
  return {
    shake: 0,
    hitStop: 0,
    particles: [],
    lastGrazePulse: 0,
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
      life: 0.35 + (i % 4) * 0.05,
      maxLife: 0.45,
      hue,
      r: 2 + (i % 3),
    });
  }
}

export interface JuiceAudioHooks {
  impact: (strength: number) => void;
  combo: (step: number) => void;
  capture: () => void;
}

/**
 * Compare consecutive snapshots and queue shake / hit-stop / particles.
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
    const boss = next.enemies.find((e) => e.isBoss);
    juice.lastBossHp = boss?.hp ?? 0;
    juice.lastBossId = boss?.id ?? -1;
    return;
  }

  // Hit (lost a life).
  if (next.lives < prev.lives) {
    juice.shake = Math.max(juice.shake, 1.15);
    juice.hitStop = Math.max(juice.hitStop, 0.07);
    burst(juice, next.px, next.py, 350, 14, 140);
    audio.impact(0.85);
  }

  // Bomb spent.
  if (next.bombs < prev.bombs) {
    juice.shake = Math.max(juice.shake, 0.95);
    burst(juice, next.px, next.py, 45, 18, 160);
    audio.impact(0.7);
  }

  // Spell capture or timeout banner.
  if (next.lastCardResult && next.lastCardResult !== prev.lastCardResult) {
    if (next.lastCardResult === 'captured') {
      juice.shake = Math.max(juice.shake, 0.55);
      juice.hitStop = Math.max(juice.hitStop, 0.05);
      const boss = next.enemies.find((e) => e.isBoss) ?? prev.enemies.find((e) => e.isBoss);
      burst(juice, boss?.x ?? FIELD_CX, boss?.y ?? 120, 300, 16, 120);
      audio.capture();
    }
  }

  // Boss fully defeated (left the field).
  const prevBoss = prev.enemies.find((e) => e.isBoss);
  const nextBoss = next.enemies.find((e) => e.isBoss);
  if (prevBoss && !nextBoss && next.bossSpawned) {
    juice.shake = Math.max(juice.shake, 1.35);
    juice.hitStop = Math.max(juice.hitStop, 0.1);
    burst(juice, prevBoss.x, prevBoss.y, 320, 22, 180);
    audio.impact(1);
  }

  // Big hit on boss HP.
  if (nextBoss && nextBoss.id === juice.lastBossId) {
    const drop = juice.lastBossHp - nextBoss.hp;
    if (drop >= 180) {
      juice.hitStop = Math.max(juice.hitStop, 0.04);
      burst(juice, nextBoss.x, nextBoss.y, 200, 8, 70);
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

  // Graze streak pulses (every 8 grazes after the last pulse).
  const gained = next.grazeCount - juice.lastGrazePulse;
  if (gained >= 8) {
    juice.lastGrazePulse = next.grazeCount;
    juice.hitStop = Math.max(juice.hitStop, 0.028);
    burst(juice, next.px, next.py, 280, 6, 50);
    audio.combo(Math.min(8, Math.floor(next.grazeMult)));
  }
}

const FIELD_CX = 200;

/** Advance presentation timers; does not touch the simulation clock. */
export function tickJuice(juice: JuiceState, dt: number): void {
  if (juice.shake > 0) juice.shake = Math.max(0, juice.shake - dt * 4.2);
  if (juice.hitStop > 0) juice.hitStop = Math.max(0, juice.hitStop - dt);
  const kept: FxParticle[] = [];
  for (const p of juice.particles) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 40 * dt;
    kept.push(p);
  }
  juice.particles = kept.length > 80 ? kept.slice(-80) : kept;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
