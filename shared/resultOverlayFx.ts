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

export interface ParsedStatValue {
  kind: 'number' | 'text';
  /** Raw display string when kind === 'text'. */
  text: string;
  /** Absolute numeric magnitude when kind === 'number'. */
  value: number;
  prefix: string;
  suffix: string;
  decimals: number;
}

const NUMBER_RE = /^(\D*?)(-?\d+(?:\.\d+)?)(\D*)$/;

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

  const duration = Math.max(280, Math.min(1200, opts.durationMs ?? 700 * fxMultiplier()));
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

export function variantParticlePreset(variant: ResultOverlayVariant): ParticlePreset | null {
  if (variant === 'win') return 'confetti';
  if (variant === 'lose') return 'dust';
  return 'sparkle';
}

/** One-shot celebration when a result overlay opens. */
export function celebrateResultOverlay(opts: {
  variant: ResultOverlayVariant;
  cardEl?: Element | null;
}): void {
  const mult = fxMultiplier();
  if (mult <= 0) return;

  const preset = variantParticlePreset(opts.variant);
  if (preset) {
    const strength = opts.variant === 'win' ? 1 : opts.variant === 'lose' ? 0.55 : 0.7;
    particles(preset, {
      el: opts.cardEl ?? null,
      strength: strength * Math.max(0.35, mult),
      count: opts.variant === 'win' ? 32 : opts.variant === 'lose' ? 12 : 16,
      colors:
        opts.variant === 'win'
          ? ['#2dd4bf', '#67e8f9', '#f472b6', '#fbbf24', '#fb7185', '#a5f3fc']
          : opts.variant === 'lose'
            ? ['#94a3b8', '#64748b', '#fb7185']
            : ['#67e8f9', '#a5f3fc', '#2dd4bf'],
    });
  }

  if (opts.variant === 'win') haptic('win', 0.9);
  else if (opts.variant === 'lose') haptic('error', 0.7);
  else haptic('success', 0.55);

  if (opts.cardEl) pulse(opts.cardEl, opts.variant === 'win' ? 1.04 : 1.02);
}
