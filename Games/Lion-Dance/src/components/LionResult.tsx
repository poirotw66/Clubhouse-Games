import type { ReactElement } from 'react';
import type { ResultStat } from '@clubhouse/shared/ResultOverlay';

interface LionResultProps {
  title: string;
  subtitle?: string;
  badge?: string;
  stats?: ResultStat[];
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  variant?: 'win' | 'lose';
}

/** Red / gold / cream result card — replaces the shared dark modal for this game. */
export function LionResult({
  title,
  subtitle,
  badge,
  stats = [],
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  variant = 'lose',
}: LionResultProps): ReactElement {
  return (
    <div className="lion-result" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`lion-result-card ${variant === 'win' ? 'is-win' : 'is-lose'}`}>
        {badge && <p className="lion-result-badge">{badge}</p>}
        <h2 className="lion-result-title">{title}</h2>
        {subtitle && <p className="lion-result-sub">{subtitle}</p>}
        {stats.length > 0 && (
          <dl className="lion-result-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="lion-result-stat">
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <button type="button" className="lion-cta" onClick={onPrimary}>
          {primaryLabel}
        </button>
        {onSecondary && secondaryLabel && (
          <button type="button" className="lion-cta-ghost" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
