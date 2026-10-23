import React, { useEffect, useMemo, useRef } from 'react';
import { resultOverlayChromeCss } from './resultOverlayChrome.ts';
import {
  celebrateResultOverlay,
  countUpStat,
  formatCountedValue,
  parseStatValue,
  resolveEmphasis,
  splitTitleChars,
  starCountFor,
  type ResultOverlayEmphasis,
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
  /** Optional; auto-detected from badge/title when omitted (紀錄 / 破紀錄 …). */
  emphasis?: ResultOverlayEmphasis;
}

const BTN_BASE =
  'result-overlay__btn inline-flex items-center justify-center gap-2 w-full min-h-[52px] px-6 py-3 rounded-xl font-bold touch-manipulation';

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
      className="result-overlay__stat-value font-extrabold text-white tabular-nums"
    >
      {initial}
    </dd>
  );
}

function Billboard({ title }: { title: string }): React.ReactElement {
  const chars = useMemo(() => splitTitleChars(title), [title]);
  return (
    <h2 className="result-overlay__billboard" aria-label={title}>
      {chars.map((ch, index) => (
        <span
          key={`${index}-${ch}`}
          className="result-overlay__char"
          style={{ animationDelay: `${60 + index * 55}ms` }}
        >
          {ch === ' ' ? '\u00a0' : ch}
        </span>
      ))}
    </h2>
  );
}

function Stars({ lit }: { lit: number }): React.ReactElement {
  return (
    <div className="result-overlay__stars" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`result-overlay__star ${i < lit ? 'is-lit' : ''}`}
          style={{ animationDelay: `${260 + i * 140}ms` }}
        >
          ★
        </span>
      ))}
    </div>
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
  emphasis: emphasisProp,
}: ResultOverlayProps): React.ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const emphasis = resolveEmphasis({ emphasis: emphasisProp, badge, title });
  const litStars = starCountFor(variant, emphasis);

  useEffect(() => {
    celebrateResultOverlay({ variant, emphasis, cardEl: cardRef.current });
  }, [variant, emphasis, title]);

  return (
    <div
      className={`result-overlay result-overlay--${variant}${
        emphasis === 'record' ? ' result-overlay--record' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-result-overlay="1"
      data-variant={variant}
      data-emphasis={emphasis}
    >
      <div className="result-overlay__aurora" aria-hidden="true" />
      <div className="result-overlay__rays" aria-hidden="true" />
      <div className="result-overlay__sparks" aria-hidden="true" />
      <div className="result-overlay__shockwave" aria-hidden="true" />
      <div className="result-overlay__shockwave-2" aria-hidden="true" />
      <div className="result-overlay__scanlines" aria-hidden="true" />
      <div className="result-overlay__vignette" aria-hidden="true" />

      <div className="result-overlay__stage">
        <div className="result-overlay__bloom" aria-hidden="true" />
        {badge && <p className="result-overlay__kicker">{badge}</p>}
        <Billboard title={title} />
        {subtitle && <p className="result-overlay__subtitle">{subtitle}</p>}

        <div
          ref={cardRef}
          className={`result-overlay__card result-overlay__card--${variant}${
            emphasis === 'record' ? ' result-overlay__card--record' : ''
          }`}
        >
          <div className="result-overlay__sheen" aria-hidden="true" />
          <div className="result-overlay__metal" aria-hidden="true" />
          <Stars lit={litStars} />

          {stats.length > 0 && (
            <dl className="result-overlay__stats">
              {stats.map((stat) => (
                <div key={stat.label} className="result-overlay__stat">
                  <dt>{stat.label}</dt>
                  <StatValue value={stat.value} />
                </div>
              ))}
            </dl>
          )}

          <div className={`result-overlay__actions ${stats.length === 0 ? 'is-tight' : ''}`}>
            <button type="button" onClick={onPrimary} className={`${BTN_BASE} result-overlay__primary`}>
              <span className="result-overlay__btn-shine" aria-hidden="true" />
              {primaryLabel}
            </button>
            {onSecondary && (
              <button
                type="button"
                onClick={onSecondary}
                className={`${BTN_BASE} result-overlay__secondary`}
              >
                {secondaryLabel}
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{resultOverlayChromeCss('result-overlay')}</style>
    </div>
  );
}
