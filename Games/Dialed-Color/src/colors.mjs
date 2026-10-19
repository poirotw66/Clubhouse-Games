/**
 * Color generation and harmony helpers (HSL).
 * Pure module — used by the game and check script.
 */

import { mulberry32 } from './rng.mjs';

/** @typedef {{ h: number, s: number, l: number }} Color */

/**
 * @param {number} h
 * @param {number} s
 * @param {number} l
 * @returns {Color}
 */
export function clampColor(h, s, l) {
  return {
    h: ((Math.round(h) % 360) + 360) % 360,
    s: Math.max(0, Math.min(100, Math.round(s))),
    l: Math.max(0, Math.min(100, Math.round(l))),
  };
}

export function colorToCss(c) {
  return `hsl(${c.h}, ${c.s}%, ${c.l}%)`;
}

/** Hue-bucket pattern id for color-blind friendly overlays (0–5). */
export function huePatternId(h) {
  return Math.floor((((h % 360) + 360) % 360) / 60);
}

const PATTERN_NAMES = ['斜紋', '點陣', '橫線', '格紋', '菱形', '波紋'];

export function huePatternLabel(h) {
  return PATTERN_NAMES[huePatternId(h)];
}

/**
 * @param {() => number} rand 0–1
 * @param {{ minHueGap?: number, lastHue?: number, sRange?: [number, number], lRange?: [number, number], nearHue?: number, nearHueWindow?: number }} [opts]
 * @returns {Color}
 */
export function generateColor(rand, opts = {}) {
  const minGap = opts.minHueGap ?? 45;
  const sRange = opts.sRange ?? [10, 95];
  const lRange = opts.lRange ?? [15, 90];
  let h;
  if (opts.nearHue != null && opts.nearHueWindow != null) {
    const w = opts.nearHueWindow;
    h = Math.round(opts.nearHue + (rand() * 2 - 1) * w);
  } else {
    h = Math.floor(rand() * 360);
    if (opts.lastHue != null && opts.lastHue >= 0) {
      let guard = 0;
      while (
        guard < 40 &&
        (Math.abs(h - opts.lastHue) < minGap || Math.abs(h - opts.lastHue) > 360 - minGap)
      ) {
        h = Math.floor(rand() * 360);
        guard += 1;
      }
    }
  }
  const s = sRange[0] + rand() * (sRange[1] - sRange[0]);
  const l = lRange[0] + rand() * (lRange[1] - lRange[0]);
  return clampColor(h, s, l);
}

/** Circular mean of two hues (degrees). */
export function meanHue(h1, h2) {
  const a = (h1 * Math.PI) / 180;
  const b = (h2 * Math.PI) / 180;
  const x = Math.cos(a) + Math.cos(b);
  const y = Math.sin(a) + Math.sin(b);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** 50/50 mix in RGB (then back to HSL) — closer to perceptual light mix. */
export function mixColors(a, b) {
  const toRgb = (c) => {
    const h = c.h / 360;
    const s = c.s / 100;
    const l = c.l / 100;
    if (s === 0) {
      const v = Math.round(l * 255);
      return [v, v, v];
    }
    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    ];
  };
  const rgbToHsl = (r, g, b) => {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const l = (max + min) / 2;
    if (max === min) return clampColor(0, 0, l * 100);
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6;
    else if (max === gg) h = ((bb - rr) / d + 2) / 6;
    else h = ((rr - gg) / d + 4) / 6;
    return clampColor(h * 360, s * 100, l * 100);
  };
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return rgbToHsl((r1 + r2) / 2, (g1 + g2) / 2, (b1 + b2) / 2);
}

export function complementaryOf(c) {
  return clampColor(c.h + 180, c.s, c.l);
}

/** @param {Color} c @param {30 | -30 | 40 | -40} offset */
export function analogousOf(c, offset) {
  return clampColor(c.h + offset, c.s, c.l);
}

/**
 * Survival difficulty: shorter flash, tighter near-hue, higher pass bar.
 * @param {number} round 0-based
 */
export function survivalParams(round) {
  const showMs = Math.max(400, 2200 - round * 140);
  const pass = Math.min(820, 580 + round * 18);
  const nearHueWindow = Math.max(18, 90 - round * 6);
  const sRange = /** @type {[number, number]} */ ([
    Math.min(40, 15 + round),
    Math.max(60, 95 - round),
  ]);
  const lRange = /** @type {[number, number]} */ ([
    Math.min(35, 18 + round),
    Math.max(65, 88 - round),
  ]);
  return { showMs, pass, nearHueWindow, sRange, lRange };
}

export const BLITZ_DURATION_MS = 60_000;
export const BLITZ_SHOW_MS = 700;
export const ASCENT_SHOW_MS = [2000, 1500, 1100, 800, 550];
export const ASCENT_PASS = 650;
export const ASCENT_LEVELS = ASCENT_SHOW_MS.length;
export const DAILY_ROUNDS = 5;
export const MIX_SHOW_MS = 2500;
export const HARMONY_SHOW_MS = 2000;

/**
 * Build a list of target colors for a mode.
 * @param {string} mode
 * @param {() => number} rand
 * @param {{ count?: number, lastHue?: number }} [opts]
 * @returns {{ targets: Color[], refs?: Color[], mixPairs?: [Color, Color][], prompts?: string[] }}
 */
export function buildTargets(mode, rand, opts = {}) {
  let lastHue = opts.lastHue ?? -1;

  if (mode === 'single') {
    const c = generateColor(rand, { lastHue });
    return { targets: [c] };
  }

  if (mode === 'challenge' || mode === 'daily') {
    const count = opts.count ?? (mode === 'daily' ? DAILY_ROUNDS : 5);
    const targets = [];
    for (let i = 0; i < count; i += 1) {
      const c = generateColor(rand, { lastHue });
      lastHue = c.h;
      targets.push(c);
    }
    return { targets };
  }

  if (mode === 'ascent') {
    const targets = [];
    for (let i = 0; i < ASCENT_LEVELS; i += 1) {
      const c = generateColor(rand, { lastHue });
      lastHue = c.h;
      targets.push(c);
    }
    return { targets };
  }

  if (mode === 'mix') {
    const a = generateColor(rand, { lastHue, sRange: [35, 95], lRange: [25, 75] });
    const b = generateColor(rand, { lastHue: a.h, minHueGap: 60, sRange: [35, 95], lRange: [25, 75] });
    return { targets: [mixColors(a, b)], mixPairs: [[a, b]], refs: [a, b] };
  }

  if (mode === 'complement') {
    const ref = generateColor(rand, { lastHue, sRange: [40, 95], lRange: [30, 70] });
    return {
      targets: [complementaryOf(ref)],
      refs: [ref],
      prompts: ['調出互補色（色相 +180°）'],
    };
  }

  if (mode === 'analogous') {
    const offset = rand() < 0.5 ? 30 : -30;
    const ref = generateColor(rand, { lastHue, sRange: [40, 95], lRange: [30, 70] });
    return {
      targets: [analogousOf(ref, offset)],
      refs: [ref],
      prompts: [`調出類似色（色相 ${offset > 0 ? '+' : ''}${offset}°）`],
    };
  }

  if (mode === 'blitz') {
    // Pre-generate a pool; blitz consumes until timer ends.
    const targets = [];
    for (let i = 0; i < 40; i += 1) {
      const c = generateColor(rand, { lastHue });
      lastHue = c.h;
      targets.push(c);
    }
    return { targets };
  }

  if (mode === 'survival') {
    const targets = [];
    let anchor = generateColor(rand, {});
    targets.push(anchor);
    for (let i = 1; i < 40; i += 1) {
      const p = survivalParams(i);
      const c = generateColor(rand, {
        nearHue: anchor.h,
        nearHueWindow: p.nearHueWindow,
        sRange: p.sRange,
        lRange: p.lRange,
      });
      targets.push(c);
      anchor = c;
    }
    return { targets };
  }

  const c = generateColor(rand, { lastHue });
  return { targets: [c] };
}

/** Non-seeded random for free play. */
export function looseRand() {
  return Math.random();
}

export function seededRand(seed) {
  return mulberry32(seed);
}
