/**
 * Shared presentation "juice" for Clubhouse Games: haptics, particles, shake,
 * and small motion helpers. Never mutates game rules or scores.
 *
 * Settings persist under `clubhouse:juice`. Unsupported environments (no
 * Vibration API, SSR, prefers-reduced-motion) quietly no-op where appropriate.
 */

import {
  playCombo,
  playError,
  playImpact,
  playMove,
  playWin,
} from './synthAudio.ts';

export const JUICE_STORAGE_KEY = 'clubhouse:juice';

export type JuiceFxLevel = 'off' | 'low' | 'full';

export interface JuiceSettings {
  /** When false, navigator.vibrate is never called. */
  haptics: boolean;
  /** Particle / shake intensity tier. */
  fx: JuiceFxLevel;
}

export type HapticPreset =
  | 'tap'
  | 'place'
  | 'success'
  | 'combo'
  | 'impact'
  | 'error'
  | 'win';

export type ParticlePreset = 'burst' | 'confetti' | 'sparkle' | 'dust';

export interface Point {
  x: number;
  y: number;
}

export interface ParticleOptions {
  x?: number;
  y?: number;
  el?: Element | null;
  color?: string;
  colors?: string[];
  count?: number;
  strength?: number;
}

export interface HitOptions {
  x?: number;
  y?: number;
  el?: Element | null;
  shakeEl?: Element | null;
  strength?: number;
  /** Optional SFX; defaults to impact scaled by strength. */
  audio?: 'impact' | 'combo' | 'move' | 'win' | 'error' | 'none';
  particles?: ParticlePreset | false;
  haptic?: HapticPreset | false;
  shake?: number | false;
}

const DEFAULT_SETTINGS: JuiceSettings = {
  haptics: true,
  fx: 'full',
};

const HAPTIC_PATTERNS: Record<HapticPreset, number | number[]> = {
  tap: 8,
  place: 12,
  success: [10, 40, 18],
  combo: [8, 30, 8, 30, 16],
  impact: [18, 40, 28],
  error: [40, 30, 40],
  win: [12, 40, 12, 40, 12, 60, 30],
};

const HAPTIC_MIN_INTERVAL_MS = 55;
const PARTICLE_HARD_CAP = 180;
const PARTICLE_SPAWN_CAP = 48;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  kind: 'circle' | 'rect';
  rotation: number;
  spin: number;
};

let cachedSettings: JuiceSettings | null = null;
let lastHapticAt = 0;
let overlayCanvas: HTMLCanvasElement | null = null;
let overlayCtx: CanvasRenderingContext2D | null = null;
let particlesList: Particle[] = [];
let rafId = 0;
let lastFrameAt = 0;
let pageVisible = true;
let visibilityBound = false;
let reducedMotionQuery: MediaQueryList | null = null;

const settingsListeners = new Set<(s: JuiceSettings) => void>();

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function prefersReducedMotion(): boolean {
  if (!isBrowser() || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function parseJuiceSettings(raw: unknown): JuiceSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const obj = raw as Record<string, unknown>;
  const haptics = typeof obj.haptics === 'boolean' ? obj.haptics : DEFAULT_SETTINGS.haptics;
  const fx =
    obj.fx === 'off' || obj.fx === 'low' || obj.fx === 'full' ? obj.fx : DEFAULT_SETTINGS.fx;
  return { haptics, fx };
}

export function loadJuiceSettings(): JuiceSettings {
  if (cachedSettings) return cachedSettings;
  if (!isBrowser()) {
    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
  }
  try {
    const raw = window.localStorage.getItem(JUICE_STORAGE_KEY);
    cachedSettings = raw ? parseJuiceSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    cachedSettings = { ...DEFAULT_SETTINGS };
  }
  return cachedSettings;
}

export function saveJuiceSettings(next: Partial<JuiceSettings>): JuiceSettings {
  const merged = { ...loadJuiceSettings(), ...next };
  cachedSettings = merged;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(JUICE_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* quota / private mode */
    }
  }
  for (const listener of settingsListeners) listener(merged);
  return merged;
}

export function subscribeJuiceSettings(
  listener: (settings: JuiceSettings) => void,
): () => void {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

/** Test helper — clears in-memory cache and particle loop state. */
export function __resetJuiceForTests(): void {
  cachedSettings = null;
  lastHapticAt = 0;
  particlesList = [];
  if (rafId && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(rafId);
  }
  rafId = 0;
  lastFrameAt = 0;
  if (overlayCanvas?.parentNode) overlayCanvas.parentNode.removeChild(overlayCanvas);
  overlayCanvas = null;
  overlayCtx = null;
}

export function fxMultiplier(settings: JuiceSettings = loadJuiceSettings()): number {
  if (prefersReducedMotion()) return 0;
  if (settings.fx === 'off') return 0;
  if (settings.fx === 'low') return 0.35;
  return 1;
}

function scalePattern(
  pattern: number | number[],
  strength: number,
): number | number[] {
  const s = Math.max(0.25, Math.min(1.5, strength));
  if (typeof pattern === 'number') return Math.max(1, Math.round(pattern * s));
  return pattern.map((n, i) => (i % 2 === 1 ? n : Math.max(1, Math.round(n * s))));
}

function canVibrate(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  // Chromium logs a console error (caught by Playwright afterEach) when vibrate
  // runs before any user activation — skip quietly instead.
  try {
    const activation = (
      navigator as Navigator & {
        userActivation?: { hasBeenActive?: boolean };
      }
    ).userActivation;
    if (activation && activation.hasBeenActive === false) return false;
  } catch {
    /* ignore */
  }
  return true;
}

export function haptic(preset: HapticPreset, strength = 1): void {
  const settings = loadJuiceSettings();
  if (!settings.haptics) return;
  if (!canVibrate()) return;

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastHapticAt < HAPTIC_MIN_INTERVAL_MS) return;
  lastHapticAt = now;

  try {
    navigator.vibrate(scalePattern(HAPTIC_PATTERNS[preset], strength));
  } catch {
    /* unsupported / blocked */
  }
}

function ensureVisibilityHook(): void {
  if (!isBrowser() || visibilityBound) return;
  visibilityBound = true;
  pageVisible = document.visibilityState !== 'hidden';
  document.addEventListener('visibilitychange', () => {
    pageVisible = document.visibilityState !== 'hidden';
    if (pageVisible && particlesList.length > 0) startLoop();
  });
}

function ensureOverlay(): CanvasRenderingContext2D | null {
  if (!isBrowser() || typeof document.createElement !== 'function') return null;
  ensureVisibilityHook();
  if (overlayCanvas && overlayCtx) {
    resizeOverlay();
    return overlayCtx;
  }
  const canvas = document.createElement('canvas');
  canvas.setAttribute('data-clubhouse-juice', 'particles');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '2147483000',
  } as CSSStyleDeclaration);
  document.body.appendChild(canvas);
  overlayCanvas = canvas;
  overlayCtx = canvas.getContext('2d');
  resizeOverlay();
  if (!reducedMotionQuery && typeof window.matchMedia === 'function') {
    try {
      reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      reducedMotionQuery = null;
    }
  }
  return overlayCtx;
}

function resizeOverlay(): void {
  if (!overlayCanvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  overlayCanvas.width = Math.max(1, Math.floor(w * dpr));
  overlayCanvas.height = Math.max(1, Math.floor(h * dpr));
  overlayCanvas.style.width = `${w}px`;
  overlayCanvas.style.height = `${h}px`;
  overlayCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function resolvePoint(opts: {
  x?: number;
  y?: number;
  el?: Element | null;
}): Point | null {
  if (typeof opts.x === 'number' && typeof opts.y === 'number') {
    return { x: opts.x, y: opts.y };
  }
  if (opts.el && isBrowser()) {
    const rect = opts.el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  if (isBrowser()) {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
  return null;
}

function pushParticle(p: Particle): void {
  if (particlesList.length >= PARTICLE_HARD_CAP) particlesList.shift();
  particlesList.push(p);
}

function spawnCount(requested: number, mult: number): number {
  if (mult <= 0) return 0;
  const n = Math.round(requested * mult);
  if (prefersReducedMotion()) return Math.min(2, n);
  return Math.max(0, Math.min(PARTICLE_SPAWN_CAP, n));
}

const DEFAULT_COLORS = ['#fbbf24', '#f87171', '#34d399', '#60a5fa', '#e879f9', '#fafafa'];

export function particles(preset: ParticlePreset, opts: ParticleOptions = {}): void {
  const mult = fxMultiplier();
  if (mult <= 0) return;
  const point = resolvePoint(opts);
  if (!point) return;
  if (!ensureOverlay()) return;

  const strength = Math.max(0.2, Math.min(1.5, opts.strength ?? 1));
  const colors =
    opts.colors && opts.colors.length > 0
      ? opts.colors
      : opts.color
        ? [opts.color]
        : DEFAULT_COLORS;

  let baseCount = 14;
  if (preset === 'confetti') baseCount = 28;
  else if (preset === 'sparkle') baseCount = 12;
  else if (preset === 'dust') baseCount = 10;
  if (typeof opts.count === 'number') baseCount = opts.count;

  const count = spawnCount(baseCount * strength, mult);
  for (let i = 0; i < count; i++) {
    const color = colors[i % colors.length];
    if (preset === 'confetti') {
      const angle = Math.random() * Math.PI * 2;
      const mag = (90 + Math.random() * 160) * strength;
      pushParticle({
        x: point.x + (Math.random() - 0.5) * 24,
        y: point.y + (Math.random() - 0.5) * 12,
        vx: Math.cos(angle) * mag * 0.55,
        vy: Math.sin(angle) * mag * 0.35 - 80 - Math.random() * 60,
        life: 0.7 + Math.random() * 0.55,
        maxLife: 1.2,
        size: 3 + Math.random() * 4,
        color,
        kind: 'rect',
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 10,
      });
    } else if (preset === 'dust') {
      pushParticle({
        x: point.x + (Math.random() - 0.5) * 18,
        y: point.y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 40 * strength,
        vy: -20 - Math.random() * 50 * strength,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
        size: 1.5 + Math.random() * 2.5,
        color: opts.color ?? 'rgba(226,232,240,0.85)',
        kind: 'circle',
        rotation: 0,
        spin: 0,
      });
    } else if (preset === 'sparkle') {
      const angle = (Math.PI * 2 * i) / Math.max(1, count) + Math.random() * 0.3;
      const mag = (40 + Math.random() * 50) * strength;
      pushParticle({
        x: point.x,
        y: point.y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag - 10,
        life: 0.25 + Math.random() * 0.25,
        maxLife: 0.5,
        size: 1.2 + Math.random() * 2,
        color,
        kind: 'circle',
        rotation: 0,
        spin: 0,
      });
    } else {
      const angle = (Math.PI * 2 * i) / Math.max(1, count) + Math.random() * 0.35;
      const mag = (70 + Math.random() * 90) * strength;
      pushParticle({
        x: point.x,
        y: point.y,
        vx: Math.cos(angle) * mag,
        vy: Math.sin(angle) * mag - 20,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        size: 2 + Math.random() * 3,
        color,
        kind: 'circle',
        rotation: 0,
        spin: 0,
      });
    }
  }
  startLoop();
}

function startLoop(): void {
  if (rafId || !isBrowser()) return;
  lastFrameAt = performance.now();
  const tick = (now: number) => {
    rafId = 0;
    if (!pageVisible) {
      if (particlesList.length > 0) {
        /* freeze in place until visible again */
      }
      return;
    }
    const dt = Math.min(0.05, (now - lastFrameAt) / 1000);
    lastFrameAt = now;
    stepParticles(dt);
    drawParticles();
    if (particlesList.length > 0) {
      rafId = requestAnimationFrame(tick);
    } else if (overlayCtx && overlayCanvas) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
  };
  rafId = requestAnimationFrame(tick);
}

function stepParticles(dt: number): void {
  const kept: Particle[] = [];
  for (const p of particlesList) {
    p.life -= dt;
    if (p.life <= 0) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += (p.kind === 'rect' ? 220 : 90) * dt;
    p.vx *= 0.99;
    p.rotation += p.spin * dt;
    kept.push(p);
  }
  particlesList = kept.length > PARTICLE_HARD_CAP ? kept.slice(-PARTICLE_HARD_CAP) : kept;
}

function drawParticles(): void {
  const ctx = overlayCtx;
  if (!ctx || !overlayCanvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  for (const p of particlesList) {
    const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    if (p.kind === 'rect') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillRect(-p.size * 0.5, -p.size * 0.25, p.size, p.size * 0.5);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

export function particleCount(): number {
  return particlesList.length;
}

const shakeTimers = new WeakMap<Element, number>();

export function shake(element: Element | null | undefined, intensity = 1): void {
  if (!element || !isBrowser()) return;
  const mult = fxMultiplier();
  if (mult <= 0) return;

  const el = element as HTMLElement;
  const amp = Math.max(1, Math.min(18, 6 * intensity * mult));
  const prior = shakeTimers.get(element);
  if (prior) window.clearInterval(prior);

  const started = performance.now();
  const duration = 280 + 120 * Math.min(1.5, intensity);
  const original = el.style.transform;

  const id = window.setInterval(() => {
    const t = (performance.now() - started) / duration;
    if (t >= 1) {
      window.clearInterval(id);
      shakeTimers.delete(element);
      el.style.transform = original;
      el.removeAttribute('data-juice-shake');
      return;
    }
    const decay = 1 - t;
    const x = (Math.random() - 0.5) * amp * 2 * decay;
    const y = (Math.random() - 0.5) * amp * 1.4 * decay;
    el.style.transform = `${original} translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`.trim();
    el.setAttribute('data-juice-shake', '1');
  }, 16);
  shakeTimers.set(element, id);
}

export function hitStop(durationMs = 45): Promise<void> {
  const mult = fxMultiplier();
  const ms = mult <= 0 ? 0 : Math.max(0, Math.round(durationMs * mult));
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function pulse(element: Element | null | undefined, scale = 1.06): void {
  if (!element || !isBrowser()) return;
  if (fxMultiplier() <= 0) return;
  const el = element as HTMLElement;
  const from = el.style.transform;
  el.style.transition = 'transform 120ms ease-out';
  el.style.transform = `${from} scale(${scale})`.trim();
  window.setTimeout(() => {
    el.style.transform = from;
    window.setTimeout(() => {
      el.style.transition = '';
    }, 130);
  }, 120);
}

export function pop(element: Element | null | undefined): void {
  pulse(element, 1.12);
}

/**
 * One-shot feedback combining optional audio, haptic, particles, and shake.
 * Does not alter synthAudio function signatures or mute behavior.
 */
export function hit(opts: HitOptions = {}): void {
  const strength = Math.max(0.15, Math.min(1.5, opts.strength ?? 0.6));
  const point = resolvePoint(opts);

  const audio = opts.audio ?? 'impact';
  if (audio === 'impact') playImpact(strength);
  else if (audio === 'combo') playCombo(Math.max(1, Math.round(strength * 4)));
  else if (audio === 'move') playMove();
  else if (audio === 'win') playWin();
  else if (audio === 'error') playError();

  const hapticPreset = opts.haptic === false ? null : opts.haptic ?? 'impact';
  if (hapticPreset) haptic(hapticPreset, strength);

  const particlePreset =
    opts.particles === false ? null : opts.particles ?? (strength >= 0.85 ? 'burst' : 'sparkle');
  if (particlePreset && point) {
    particles(particlePreset, { ...point, strength });
  }

  const shakeAmount = opts.shake === false ? 0 : opts.shake ?? strength * 0.85;
  if (shakeAmount > 0) {
    shake(opts.shakeEl ?? opts.el ?? null, shakeAmount);
  }
}

export const juice = {
  haptic,
  particles,
  shake,
  hitStop,
  pulse,
  pop,
  hit,
  loadSettings: loadJuiceSettings,
  saveSettings: saveJuiceSettings,
  subscribe: subscribeJuiceSettings,
  prefersReducedMotion,
  fxMultiplier,
  storageKey: JUICE_STORAGE_KEY,
};

export default juice;
