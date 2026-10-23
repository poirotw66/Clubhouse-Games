import type { ReactElement } from 'react';
import type { HudSnapshot } from '../engine/LionWorld';
import { formatDistance, formatTime, type Strings } from '../i18n';
import type { Lang } from '../engine/storage';

interface HudProps {
  hud: HudSnapshot;
  s: Strings;
  lang: Lang;
}

export function Hud({ hud, s, lang }: HudProps): ReactElement {
  return (
    <header className="lion-hud" aria-live="polite">
      <div className="lion-hud-card lion-hud-left">
        <span className="lion-stat-label">{s.distanceToGoal}</span>
        <span className="lion-stat-value">{formatDistance(hud.distanceToGoal, lang)}</span>
      </div>
      <div className="lion-hud-card lion-hud-right">
        <div className="lion-hud-stack">
          <span className="lion-stat-label">{s.time}</span>
          <span className={`lion-stat-value ${hud.timeLeft < 15 ? 'is-urgent' : ''}`}>
            {formatTime(hud.timeLeft)}
          </span>
        </div>
        <div className="lion-hud-stack lion-hud-falls">
          <span className="lion-stat-label">{s.falls}</span>
          <span className="lion-stat-value">{hud.fallCount}</span>
        </div>
      </div>

      <div className="lion-beat-chip" aria-hidden="true">
        <div
          className={`lion-beat-pulse ${hud.beatPulse > 0.55 ? 'is-hot' : ''}`}
          style={{ transform: `scale(${0.85 + hud.beatPulse * 0.35})` }}
        />
        <span className="lion-combo">
          {s.combo} {hud.combo > 0 ? `×${hud.combo}` : '—'}
        </span>
        <span className="lion-onbeat">
          {s.onBeat} {Math.round(hud.onBeatRatio * 100)}%
        </span>
      </div>

      {hud.perfectFlash > 0.2 && (
        <p className="lion-perfect" aria-live="assertive">
          {s.perfect}
        </p>
      )}
      {hud.finished && <p className="lion-banner is-win">{s.finishHint}</p>}
    </header>
  );
}
