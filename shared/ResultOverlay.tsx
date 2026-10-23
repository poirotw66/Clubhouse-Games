import React, { useEffect, useMemo, useRef } from 'react';
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
  'result-overlay__btn inline-flex items-center justify-center gap-2 w-full min-h-[48px] px-6 py-3 rounded-xl font-semibold touch-manipulation';

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
      className="result-overlay__stat-value font-semibold text-white tabular-nums"
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
          style={{ animationDelay: `${80 + index * 45}ms` }}
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
          style={{ animationDelay: `${280 + i * 120}ms` }}
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
      className={`result-overlay__backdrop result-overlay__backdrop--${variant}${
        emphasis === 'record' ? ' result-overlay__backdrop--record' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-result-overlay="1"
      data-variant={variant}
      data-emphasis={emphasis}
    >
      <div className="result-overlay__rays" aria-hidden="true" />
      <div className="result-overlay__shockwave" aria-hidden="true" />
      <div className="result-overlay__vignette" aria-hidden="true" />

      <div className="result-overlay__stage">
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
      <style>{RESULT_OVERLAY_CSS}</style>
    </div>
  );
}

const RESULT_OVERLAY_CSS = `
.result-overlay__backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: hidden;
  background:
    radial-gradient(120% 80% at 50% 10%, rgba(45, 212, 191, 0.22), transparent 55%),
    radial-gradient(90% 70% at 100% 100%, rgba(244, 114, 182, 0.18), transparent 50%),
    rgba(2, 4, 10, 0.82);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
}
.result-overlay__backdrop--lose {
  background:
    radial-gradient(120% 80% at 50% 10%, rgba(244, 63, 94, 0.28), transparent 55%),
    radial-gradient(90% 70% at 0% 100%, rgba(127, 29, 29, 0.35), transparent 50%),
    rgba(8, 2, 6, 0.86);
}
.result-overlay__backdrop--record {
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(251, 191, 36, 0.32), transparent 55%),
    radial-gradient(90% 70% at 100% 100%, rgba(244, 114, 182, 0.2), transparent 50%),
    rgba(8, 6, 2, 0.84);
}
.result-overlay__rays {
  position: absolute;
  inset: -20%;
  background: repeating-conic-gradient(
    from 0deg at 50% 50%,
    rgba(165, 243, 252, 0.0) 0deg 12deg,
    rgba(45, 212, 191, 0.14) 12deg 14deg
  );
  opacity: 0.55;
  animation: result-rays-spin 18s linear infinite;
  mix-blend-mode: screen;
  pointer-events: none;
}
.result-overlay__backdrop--lose .result-overlay__rays {
  background: repeating-conic-gradient(
    from 0deg at 50% 50%,
    rgba(251, 113, 133, 0.0) 0deg 14deg,
    rgba(244, 63, 94, 0.16) 14deg 16deg
  );
}
.result-overlay__backdrop--record .result-overlay__rays {
  background: repeating-conic-gradient(
    from 0deg at 50% 50%,
    rgba(251, 191, 36, 0.0) 0deg 10deg,
    rgba(251, 191, 36, 0.2) 10deg 12deg
  );
}
.result-overlay__shockwave {
  position: absolute;
  left: 50%;
  top: 42%;
  width: 40px;
  height: 40px;
  margin: -20px 0 0 -20px;
  border-radius: 50%;
  border: 2px solid rgba(165, 243, 252, 0.55);
  box-shadow: 0 0 30px rgba(45, 212, 191, 0.45);
  animation: result-shock 900ms cubic-bezier(0.16, 1, 0.3, 1) 180ms both;
  pointer-events: none;
}
.result-overlay__backdrop--lose .result-overlay__shockwave {
  border-color: rgba(251, 113, 133, 0.6);
  box-shadow: 0 0 30px rgba(244, 63, 94, 0.4);
}
.result-overlay__vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.7) 100%);
  pointer-events: none;
}
.result-overlay__stage {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 28rem;
  text-align: center;
}
.result-overlay__kicker {
  margin: 0 0 0.65rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #fde68a;
  text-shadow: 0 0 18px rgba(251, 191, 36, 0.65);
  animation: result-fade-up 480ms ease both;
}
.result-overlay__billboard {
  margin: 0 0 0.75rem;
  font-size: clamp(2rem, 8vw, 3.1rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: 0.02em;
  color: #ecfeff;
  filter: drop-shadow(0 0 18px rgba(45, 212, 191, 0.55));
}
.result-overlay__backdrop--lose .result-overlay__billboard {
  color: #ffe4e6;
  filter: drop-shadow(0 0 18px rgba(244, 63, 94, 0.55));
}
.result-overlay__backdrop--record .result-overlay__billboard {
  color: #fffbeb;
  filter: drop-shadow(0 0 22px rgba(251, 191, 36, 0.7));
}
.result-overlay__char {
  display: inline-block;
  opacity: 0;
  transform: translate3d(0, 18px, 0) scale(0.92);
  animation: result-char-in 520ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  text-shadow:
    0 0 8px rgba(165, 243, 252, 0.9),
    -1px 0 rgba(103, 232, 249, 0.7),
    1px 0 rgba(244, 114, 182, 0.7);
}
.result-overlay__backdrop--lose .result-overlay__char {
  text-shadow:
    0 0 8px rgba(251, 113, 133, 0.9),
    -1px 0 rgba(248, 113, 113, 0.75),
    1px 0 rgba(15, 23, 42, 0.8);
}
.result-overlay__subtitle {
  margin: 0 0 1rem;
  font-size: 0.95rem;
  color: #cbd5e1;
  animation: result-fade-up 560ms ease 120ms both;
}
.result-overlay__card {
  position: relative;
  overflow: hidden;
  margin: 0 auto;
  padding: 1.35rem 1.35rem 1.25rem;
  border-radius: 1.15rem;
  border: 1px solid rgba(165, 243, 252, 0.28);
  background:
    linear-gradient(145deg, rgba(18, 28, 48, 0.92), rgba(6, 10, 20, 0.96));
  box-shadow:
    0 28px 60px -18px rgba(0, 0, 0, 0.75),
    0 0 0 1px rgba(45, 212, 191, 0.12),
    0 0 48px rgba(45, 212, 191, 0.22);
  animation: result-card-in 560ms cubic-bezier(0.16, 1, 0.3, 1) 80ms both;
}
.result-overlay__card--win {
  border-color: rgba(45, 212, 191, 0.55);
  box-shadow:
    0 28px 60px -18px rgba(0, 0, 0, 0.75),
    0 0 0 1px rgba(45, 212, 191, 0.28),
    0 0 56px rgba(45, 212, 191, 0.35),
    0 0 90px rgba(244, 114, 182, 0.16);
}
.result-overlay__card--lose {
  border-color: rgba(251, 113, 133, 0.5);
  box-shadow:
    0 28px 60px -18px rgba(0, 0, 0, 0.75),
    0 0 48px rgba(244, 63, 94, 0.28);
}
.result-overlay__card--record {
  border-color: rgba(251, 191, 36, 0.65);
  box-shadow:
    0 28px 60px -18px rgba(0, 0, 0, 0.75),
    0 0 0 1px rgba(251, 191, 36, 0.35),
    0 0 64px rgba(251, 191, 36, 0.4);
}
.result-overlay__metal {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    125deg,
    rgba(255,255,255,0.14) 0%,
    transparent 28%,
    transparent 58%,
    rgba(165, 243, 252, 0.08) 100%
  );
  opacity: 0.7;
}
.result-overlay__sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    115deg,
    transparent 28%,
    rgba(255, 255, 255, 0.22) 48%,
    rgba(103, 232, 249, 0.16) 54%,
    transparent 72%
  );
  transform: translate3d(-70%, 0, 0);
  animation: result-sheen 1.15s ease-out 0.2s both;
}
.result-overlay__stars {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
  font-size: 1.35rem;
  line-height: 1;
}
.result-overlay__star {
  color: rgba(148, 163, 184, 0.35);
  transform: scale(0.6);
  opacity: 0;
  animation: result-star-in 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
  filter: drop-shadow(0 0 0 transparent);
}
.result-overlay__star.is-lit {
  color: #fbbf24;
  filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.85));
}
.result-overlay__backdrop--lose .result-overlay__star.is-lit {
  color: #fb7185;
  filter: drop-shadow(0 0 10px rgba(251, 113, 133, 0.75));
}
.result-overlay__stats {
  display: grid;
  gap: 0.55rem;
  margin: 0 0 1.15rem;
  font-size: 0.9rem;
}
.result-overlay__stat {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  padding: 0.55rem 0.8rem;
  border-radius: 0.65rem;
  background: rgba(6, 10, 20, 0.72);
  border: 1px solid rgba(165, 243, 252, 0.12);
}
.result-overlay__stat dt {
  color: #94a3b8;
}
.result-overlay__stat-value {
  font-size: 1.05rem;
  letter-spacing: 0.03em;
  text-shadow: 0 0 12px rgba(165, 243, 252, 0.35);
}
.result-overlay__actions {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.result-overlay__actions.is-tight {
  margin-top: 0.35rem;
}
.result-overlay__btn {
  position: relative;
  overflow: hidden;
  border: none;
  cursor: pointer;
  transition: transform 140ms ease, filter 140ms ease, box-shadow 140ms ease;
}
.result-overlay__btn:active {
  transform: scale(0.98);
}
.result-overlay__primary {
  color: #042f2e;
  background: linear-gradient(120deg, #5eead4 0%, #2dd4bf 40%, #f472b6 100%);
  background-size: 180% 100%;
  box-shadow: 0 0 24px rgba(45, 212, 191, 0.45);
  animation: result-cta-flow 3.6s ease-in-out infinite;
}
.result-overlay__backdrop--lose .result-overlay__primary {
  color: #fff;
  background: linear-gradient(120deg, #fb7185 0%, #e11d48 55%, #881337 100%);
  box-shadow: 0 0 24px rgba(244, 63, 94, 0.45);
}
.result-overlay__backdrop--record .result-overlay__primary {
  color: #422006;
  background: linear-gradient(120deg, #fde68a 0%, #fbbf24 45%, #f472b6 100%);
  box-shadow: 0 0 28px rgba(251, 191, 36, 0.5);
}
.result-overlay__btn-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.45) 50%, transparent 60%);
  transform: translate3d(-120%, 0, 0);
  animation: result-btn-shine 2.4s ease-in-out 0.6s infinite;
  pointer-events: none;
}
.result-overlay__secondary {
  color: #e2e8f0;
  background: rgba(30, 41, 59, 0.72);
  border: 1px solid rgba(165, 243, 252, 0.2) !important;
}
.result-overlay__secondary:hover,
.result-overlay__secondary:focus-visible {
  border-color: rgba(165, 243, 252, 0.45) !important;
  background: rgba(51, 65, 85, 0.85);
}
@keyframes result-rays-spin {
  to { transform: rotate(360deg); }
}
@keyframes result-shock {
  from { transform: scale(0.2); opacity: 0.9; }
  to { transform: scale(18); opacity: 0; }
}
@keyframes result-char-in {
  to { opacity: 1; transform: none; }
}
@keyframes result-fade-up {
  from { opacity: 0; transform: translate3d(0, 10px, 0); }
  to { opacity: 1; transform: none; }
}
@keyframes result-card-in {
  from { opacity: 0; transform: translate3d(0, 22px, 0) scale(0.94); }
  to { opacity: 1; transform: none; }
}
@keyframes result-sheen {
  from { transform: translate3d(-70%, 0, 0); opacity: 0; }
  35% { opacity: 1; }
  to { transform: translate3d(70%, 0, 0); opacity: 0; }
}
@keyframes result-star-in {
  to { opacity: 1; transform: scale(1); }
}
@keyframes result-cta-flow {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
@keyframes result-btn-shine {
  0%, 55% { transform: translate3d(-120%, 0, 0); }
  80%, 100% { transform: translate3d(120%, 0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .result-overlay__rays,
  .result-overlay__shockwave,
  .result-overlay__sheen,
  .result-overlay__char,
  .result-overlay__star,
  .result-overlay__card,
  .result-overlay__kicker,
  .result-overlay__subtitle,
  .result-overlay__primary,
  .result-overlay__btn-shine {
    animation: none !important;
  }
  .result-overlay__char,
  .result-overlay__star,
  .result-overlay__card {
    opacity: 1;
    transform: none;
  }
  .result-overlay__rays { opacity: 0.25; }
  .result-overlay__shockwave { display: none; }
}
html[data-juice-fx="off"] .result-overlay__rays,
html[data-juice-fx="off"] .result-overlay__shockwave,
html[data-juice-fx="off"] .result-overlay__sheen,
html[data-juice-fx="off"] .result-overlay__btn-shine {
  animation: none !important;
}
html[data-juice-fx="off"] .result-overlay__shockwave { display: none; }
html[data-juice-fx="off"] .result-overlay__rays { opacity: 0.2; }
`;
