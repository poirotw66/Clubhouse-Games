import React, { useEffect, useRef } from 'react';
import {
  celebrateResultOverlay,
  countUpStat,
  formatCountedValue,
  parseStatValue,
} from './resultOverlayFx.ts';

export interface ResultStat {
  label: string;
  value: string | number;
}

interface ResultOverlayProps {
  title: string;
  subtitle?: string;
  badge?: string;
  stats?: ResultStat[];
  primaryLabel?: string;
  onPrimary: () => void;
  /** Optional second action (e.g. 回選單). Shown only when `onSecondary` is set. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  variant?: 'win' | 'lose' | 'neutral';
}

const VARIANT_TITLE: Record<NonNullable<ResultOverlayProps['variant']>, string> = {
  win: 'result-overlay__title--win',
  lose: 'result-overlay__title--lose',
  neutral: 'result-overlay__title--neutral',
};

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 w-full min-h-[44px] px-6 py-3 rounded-xl font-semibold transition-colors touch-manipulation';

function StatValue({ value }: { value: string | number }): React.ReactElement {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = countUpStat(el, value);
    return () => handle.cancel();
  }, [value]);

  const parsed = parseStatValue(value);
  const initial =
    parsed.kind === 'number' ? formatCountedValue(parsed, 0) : String(value);

  return (
    <dd
      ref={(node) => {
        ref.current = node;
      }}
      className="font-semibold text-white tabular-nums result-overlay__stat-value"
    >
      {initial}
    </dd>
  );
}

export function ResultOverlay({
  title,
  subtitle,
  badge,
  stats = [],
  primaryLabel = '再玩一局',
  onPrimary,
  secondaryLabel = '回選單',
  onSecondary,
  variant = 'neutral',
}: ResultOverlayProps): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    celebrateResultOverlay({ variant, cardEl: cardRef.current });
  }, [variant, title]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center result-overlay__backdrop p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-result-overlay="1"
      data-variant={variant}
    >
      <div
        ref={cardRef}
        className={`result-overlay__card w-full max-w-sm p-6 sm:p-8 text-center result-overlay__card--${variant}`}
      >
        <div className="result-overlay__sheen" aria-hidden="true" />
        {badge && (
          <p className="mb-2 text-sm font-semibold tracking-wide text-amber-300 uppercase result-overlay__badge">
            {badge}
          </p>
        )}
        <h2 className={`text-2xl sm:text-3xl font-bold mb-2 result-overlay__title ${VARIANT_TITLE[variant]}`}>
          {title}
        </h2>
        {subtitle && <p className="text-slate-300 text-sm mb-4">{subtitle}</p>}
        {stats.length > 0 && (
          <dl className="mb-6 grid gap-2 text-sm">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex justify-between rounded-lg result-overlay__stat px-3 py-2"
              >
                <dt className="text-slate-400">{stat.label}</dt>
                <StatValue value={stat.value} />
              </div>
            ))}
          </dl>
        )}
        <div className={`flex flex-col gap-2 ${stats.length === 0 ? 'mt-4' : ''}`}>
          <button
            type="button"
            onClick={onPrimary}
            className={`${BTN_BASE} result-overlay__primary bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700`}
          >
            {primaryLabel}
          </button>
          {onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className={`${BTN_BASE} result-overlay__secondary bg-slate-700/80 hover:bg-slate-600 active:bg-slate-700 border border-white/10 text-slate-100`}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
      <style>{RESULT_OVERLAY_CSS}</style>
    </div>
  );
}

const RESULT_OVERLAY_CSS = `
.result-overlay__backdrop {
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(45, 212, 191, 0.16), transparent 55%),
    radial-gradient(90% 70% at 100% 100%, rgba(244, 114, 182, 0.12), transparent 50%),
    rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
.result-overlay__card {
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid rgba(165, 243, 252, 0.18);
  background: linear-gradient(165deg, rgba(10, 16, 32, 0.96), rgba(6, 8, 15, 0.98));
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(45, 212, 191, 0.08),
    0 0 40px rgba(45, 212, 191, 0.12);
  animation: result-overlay-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
.result-overlay__card--win {
  border-color: rgba(45, 212, 191, 0.45);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(45, 212, 191, 0.2),
    0 0 48px rgba(45, 212, 191, 0.28),
    0 0 72px rgba(244, 114, 182, 0.12);
}
.result-overlay__card--lose {
  border-color: rgba(251, 113, 133, 0.4);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.65),
    0 0 40px rgba(251, 113, 133, 0.2);
}
.result-overlay__sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 30%,
    rgba(165, 243, 252, 0.14) 48%,
    rgba(244, 114, 182, 0.1) 54%,
    transparent 72%
  );
  transform: translate3d(-60%, 0, 0);
  animation: result-overlay-sheen 1.1s ease-out 0.15s both;
}
.result-overlay__title--win { color: #5eead4; text-shadow: 0 0 24px rgba(45, 212, 191, 0.45); }
.result-overlay__title--lose { color: #fda4af; text-shadow: 0 0 20px rgba(251, 113, 133, 0.35); }
.result-overlay__title--neutral { color: #e8eef9; text-shadow: 0 0 18px rgba(103, 232, 249, 0.25); }
.result-overlay__stat {
  background: rgba(10, 16, 32, 0.85);
  border: 1px solid rgba(165, 243, 252, 0.1);
}
.result-overlay__stat-value {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
.result-overlay__primary {
  box-shadow: 0 0 18px rgba(16, 185, 129, 0.28);
}
.result-overlay__secondary:hover,
.result-overlay__secondary:focus-visible {
  border-color: rgba(165, 243, 252, 0.28);
}
@keyframes result-overlay-in {
  from { opacity: 0; transform: translate3d(0, 14px, 0) scale(0.96); }
  to { opacity: 1; transform: none; }
}
@keyframes result-overlay-sheen {
  from { transform: translate3d(-60%, 0, 0); opacity: 0; }
  30% { opacity: 1; }
  to { transform: translate3d(60%, 0, 0); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .result-overlay__card,
  .result-overlay__sheen { animation: none !important; }
  .result-overlay__card { opacity: 1; transform: none; }
}
html[data-juice-fx="off"] .result-overlay__sheen { animation: none; opacity: 0; }
html[data-juice-fx="off"] .result-overlay__card { animation: none; }
`;
