/**
 * Shared presentation helpers for ResultOverlay (React + DOM twins).
 * Presentation only — never mutates scores or match rules.
 */

import {
  fxMultiplier,
  haptic,
  particles,
  prefersReducedMotion,
  pulse,
  type ParticlePreset,
} from './juice.ts';

export type ResultOverlayVariant = 'win' | 'lose' | 'neutral';
export type ResultOverlayEmphasis = 'standard' | 'record';

export interface ParsedStatValue {
  kind: 'number' | 'text';
  text: string;
  value: number;
  prefix: string;
  suffix: string;
  decimals: number;
}

const NUMBER_RE = /^(\D*?)(-?\d+(?:\.\d+)?)(\D*)$/;
const RECORD_RE = /紀錄|破紀錄|新高|record|high\s*score|best/i;

/** Pull a countable number out of a stat value when the shape is simple enough. */
export function parseStatValue(raw: string | number): ParsedStatValue {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const decimals = Number.isInteger(raw) ? 0 : Math.min(2, (String(raw).split('.')[1] ?? '').length);
    return {
      kind: 'number',
      text: String(raw),
      value: raw,
      prefix: '',
      suffix: '',
      decimals,
    };
  }
  const text = String(raw);
  const match = NUMBER_RE.exec(text.trim());
  if (!match) {
    return { kind: 'text', text, value: 0, prefix: '', suffix: '', decimals: 0 };
  }
  const num = Number(match[2]);
  if (!Number.isFinite(num)) {
    return { kind: 'text', text, value: 0, prefix: '', suffix: '', decimals: 0 };
  }
  const decimals = match[2].includes('.')
    ? Math.min(2, (match[2].split('.')[1] ?? '').length)
    : 0;
  return {
    kind: 'number',
    text,
    value: num,
    prefix: match[1] ?? '',
    suffix: match[3] ?? '',
    decimals,
  };
}

export function formatCountedValue(parsed: ParsedStatValue, current: number): string {
  if (parsed.kind !== 'number') return parsed.text;
  const fixed = parsed.decimals > 0 ? current.toFixed(parsed.decimals) : String(Math.round(current));
  return `${parsed.prefix}${fixed}${parsed.suffix}`;
}

export interface CountUpHandle {
  cancel: () => void;
}

/**
 * Ease-out count-up into `el`. No-ops when FX are off / reduced motion / non-numeric.
 */
export function countUpStat(
  el: HTMLElement,
  raw: string | number,
  opts: { durationMs?: number } = {},
): CountUpHandle {
  const parsed = parseStatValue(raw);
  if (parsed.kind !== 'number' || fxMultiplier() <= 0 || prefersReducedMotion()) {
    el.textContent = String(raw);
    return { cancel() {} };
  }

  const duration = Math.max(420, Math.min(1400, opts.durationMs ?? 900 * fxMultiplier()));
  const start = performance.now();
  const from = 0;
  const to = parsed.value;
  let raf = 0;
  let cancelled = false;

  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    const current = from + (to - from) * eased;
    el.textContent = formatCountedValue(parsed, current);
    if (t < 1) raf = requestAnimationFrame(tick);
    else el.textContent = formatCountedValue(parsed, to);
  };
  raf = requestAnimationFrame(tick);

  return {
    cancel() {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      el.textContent = String(raw);
    },
  };
}

export function resolveEmphasis(
  opts: {
    emphasis?: ResultOverlayEmphasis;
    badge?: string;
    title?: string;
  } = {},
): ResultOverlayEmphasis {
  if (opts.emphasis === 'record' || opts.emphasis === 'standard') return opts.emphasis;
  const hay = `${opts.badge ?? ''} ${opts.title ?? ''}`;
  return RECORD_RE.test(hay) ? 'record' : 'standard';
}

export function starCountFor(
  variant: ResultOverlayVariant,
  emphasis: ResultOverlayEmphasis,
): number {
  if (emphasis === 'record') return 5;
  if (variant === 'win') return 5;
  if (variant === 'lose') return 1;
  return 3;
}

export function variantParticlePreset(variant: ResultOverlayVariant): ParticlePreset | null {
  if (variant === 'win') return 'confetti';
  if (variant === 'lose') return 'dust';
  return 'sparkle';
}

const WIN_COLORS = ['#2dd4bf', '#67e8f9', '#f472b6', '#fbbf24', '#fb7185', '#a5f3fc', '#ffffff'];
const LOSE_COLORS = ['#fb7185', '#f43f5e', '#94a3b8', '#64748b', '#fda4af'];
const NEUTRAL_COLORS = ['#67e8f9', '#a5f3fc', '#2dd4bf', '#e2e8f0'];
const RECORD_COLORS = ['#fbbf24', '#f59e0b', '#fde68a', '#ffffff', '#fb7185', '#2dd4bf'];

/** One-shot layered celebration when a result overlay opens. */
export function celebrateResultOverlay(opts: {
  variant: ResultOverlayVariant;
  emphasis?: ResultOverlayEmphasis;
  cardEl?: Element | null;
}): void {
  const mult = fxMultiplier();
  if (mult <= 0) return;

  const emphasis = opts.emphasis ?? 'standard';
  const isRecord = emphasis === 'record';
  const strength =
    (isRecord ? 1.35 : opts.variant === 'win' ? 1.15 : opts.variant === 'lose' ? 0.6 : 0.8) *
    Math.max(0.4, mult);

  const colors =
    isRecord
      ? RECORD_COLORS
      : opts.variant === 'win'
        ? WIN_COLORS
        : opts.variant === 'lose'
          ? LOSE_COLORS
          : NEUTRAL_COLORS;

  const primary = isRecord ? 'confetti' : variantParticlePreset(opts.variant);
  if (primary) {
    particles(primary, {
      el: opts.cardEl ?? null,
      strength,
      count: isRecord || opts.variant === 'win' ? 40 : opts.variant === 'lose' ? 14 : 20,
      colors,
    });
  }

  if (opts.variant === 'win' || isRecord) {
    window.setTimeout(() => {
      particles('sparkle', {
        el: opts.cardEl ?? null,
        strength: strength * 0.9,
        count: 28,
        colors,
      });
    }, 160);
    window.setTimeout(() => {
      particles('confetti', {
        x: typeof window !== 'undefined' ? window.innerWidth * 0.25 : undefined,
        y: typeof window !== 'undefined' ? window.innerHeight * 0.28 : undefined,
        strength: strength * 0.85,
        count: 32,
        colors,
      });
      particles('confetti', {
        x: typeof window !== 'undefined' ? window.innerWidth * 0.75 : undefined,
        y: typeof window !== 'undefined' ? window.innerHeight * 0.28 : undefined,
        strength: strength * 0.85,
        count: 32,
        colors,
      });
    }, 320);
    window.setTimeout(() => {
      particles('burst', {
        el: opts.cardEl ?? null,
        strength: strength * 1.1,
        count: 24,
        colors,
      });
    }, 520);
  } else if (opts.variant === 'lose') {
    window.setTimeout(() => {
      particles('dust', {
        el: opts.cardEl ?? null,
        strength: 0.7,
        count: 16,
        colors: LOSE_COLORS,
      });
    }, 200);
  }

  if (isRecord) haptic('win', 1.2);
  else if (opts.variant === 'win') haptic('win', 1);
  else if (opts.variant === 'lose') haptic('error', 0.75);
  else haptic('success', 0.6);

  if (opts.cardEl) pulse(opts.cardEl, isRecord ? 1.08 : opts.variant === 'win' ? 1.06 : 1.03);
}

/** Split a title into per-character spans for kinetic entrance (keeps spaces). */
export function splitTitleChars(title: string): string[] {
  return Array.from(title);
}
