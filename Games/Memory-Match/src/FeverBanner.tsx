import { memo } from 'react';

export interface FeverBannerProps {
  combo: number;
  multiplier: number;
  label: string;
}

export const FeverBanner = memo(function FeverBanner({
  combo,
  multiplier,
  label,
}: FeverBannerProps) {
  if (combo < 2) return null;

  const isHyperdrive = combo >= 5;

  return (
    <div
      className={`mm-fever-banner ${isHyperdrive ? 'is-hyperdrive' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="mm-fever-banner__glow" aria-hidden />
      <div className="mm-fever-banner__content">
        <span className="mm-fever-icon animate-bounce" aria-hidden>
          {isHyperdrive ? '⚡' : '🔥'}
        </span>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-amber-200">
            {isHyperdrive ? '神經極限超頻 HYPERDRIVE' : '狂熱連鎖 FEVER OVERDRIVE'}
          </span>
          <span className="text-sm sm:text-base font-extrabold text-white">
            {label}
          </span>
        </div>
        <div className="mm-fever-badge">
          <span className="text-xs text-rose-200">得分</span>
          <span className="text-lg sm:text-xl font-black font-mono leading-none text-white">
            ×{multiplier}
          </span>
        </div>
      </div>
    </div>
  );
});
