import React from 'react';

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
  win: 'text-emerald-300',
  lose: 'text-red-300',
  neutral: 'text-slate-100',
};

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 w-full min-h-[44px] px-6 py-3 rounded-xl font-semibold transition-colors touch-manipulation';

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
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 p-6 sm:p-8 shadow-2xl text-center">
        {badge && (
          <p className="mb-2 text-sm font-semibold tracking-wide text-amber-300 uppercase">
            {badge}
          </p>
        )}
        <h2 className={`text-2xl sm:text-3xl font-bold mb-2 ${VARIANT_TITLE[variant]}`}>
          {title}
        </h2>
        {subtitle && <p className="text-slate-300 text-sm mb-4">{subtitle}</p>}
        {stats.length > 0 && (
          <dl className="mb-6 grid gap-2 text-sm">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex justify-between rounded-lg bg-slate-800/80 px-3 py-2 border border-white/5"
              >
                <dt className="text-slate-400">{stat.label}</dt>
                <dd className="font-mono font-semibold text-white tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className={`flex flex-col gap-2 ${stats.length === 0 ? 'mt-4' : ''}`}>
          <button
            type="button"
            onClick={onPrimary}
            className={`${BTN_BASE} bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700`}
          >
            {primaryLabel}
          </button>
          {onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className={`${BTN_BASE} bg-slate-700/80 hover:bg-slate-600 active:bg-slate-700 border border-white/10 text-slate-100`}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
