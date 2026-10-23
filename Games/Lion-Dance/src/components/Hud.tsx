import type { ReactElement } from 'react';
import type { HudSnapshot } from '../engine/LionWorld';
import { TRACK_LENGTH } from '../engine/constants';
import { formatDistance, formatTime, type Strings } from '../i18n';
import type { Lang } from '../engine/storage';

interface HudProps {
  hud: HudSnapshot;
  s: Strings;
  lang: Lang;
  best: number | null;
}

export function Hud({ hud, s, lang, best }: HudProps): ReactElement {
  const progress = Math.min(1, hud.distance / TRACK_LENGTH);
  return (
    <header className="lion-hud" aria-live="polite">
      <div className="lion-hud-row">
        <div className="lion-stat">
          <span className="lion-stat-label">{s.distance}</span>
          <span className="lion-stat-value">{formatDistance(hud.distance, lang)}</span>
        </div>
        <div className="lion-stat lion-stat-center">
          <span className="lion-stat-label">{s.time}</span>
          <span className={`lion-stat-value ${hud.timeLeft < 15 ? 'is-urgent' : ''}`}>
            {formatTime(hud.timeLeft)}
          </span>
        </div>
        <div className="lion-stat lion-stat-end">
          <span className="lion-stat-label">{s.best}</span>
          <span className="lion-stat-value">{best != null ? formatTime(best) : '—'}</span>
        </div>
      </div>
      <div
        className="lion-track"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="lion-track-fill" style={{ width: `${progress * 100}%` }} />
        <span className="lion-track-mark" style={{ left: '100%' }} aria-hidden="true">
          青
        </span>
      </div>
      <div className="lion-beat-row">
        <div
          className={`lion-beat-pulse ${hud.beatPulse > 0.55 ? 'is-hot' : ''}`}
          style={{ transform: `scale(${0.85 + hud.beatPulse * 0.35})` }}
          aria-hidden="true"
        />
        <span className="lion-combo">
          {s.combo} {hud.combo > 0 ? `×${hud.combo}` : '—'}
        </span>
        {hud.speedBonus > 0 && (
          <span className="lion-speed-bonus">+{Math.round(hud.speedBonus * 100)}%</span>
        )}
      </div>
      {hud.perfectFlash > 0.2 && (
        <p className="lion-perfect" aria-live="assertive">
          {s.perfect}
        </p>
      )}
      {hud.fallen && !hud.finished && <p className="lion-banner is-fall">{s.fallHint}</p>}
      {hud.finished && <p className="lion-banner is-win">{s.finishHint}</p>}
    </header>
  );
}
