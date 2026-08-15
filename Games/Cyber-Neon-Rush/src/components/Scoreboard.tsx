import type { ReactElement } from 'react';
import type { HudSnapshot } from '../engine/scoreSystem';

interface ScoreboardProps {
  hud: HudSnapshot;
  visible: boolean;
}

function formatMult(m: number): string {
  return `×${m.toFixed(2)}`;
}

const TOAST_LABEL: Record<Exclude<HudSnapshot['toast'], null>, string> = {
  near: '擦身而過',
  perfect: '完美閃避',
  boost: '硝基',
  fever: '狂熱',
};

export function Scoreboard({ hud, visible }: ScoreboardProps): ReactElement | null {
  if (!visible) return null;
  const flash = hud.nearMissFlash > 0.05;
  const boosting = hud.boostT > 0.05;
  return (
    <div
      className={`scoreboard ${hud.fever ? 'fever' : ''} ${flash ? 'near-flash' : ''}`}
      aria-live="polite"
      aria-label="動態計分板"
    >
      <div className="scoreboard-inner">
        <div className={`score-cell ${flash ? 'flash' : ''}`}>
          <div className="score-label">分數</div>
          <div className="score-value neon-text">{hud.score.toLocaleString('zh-Hant')}</div>
        </div>
        <div className="score-cell">
          <div className="score-label">距離 m</div>
          <div className="score-value">{hud.distance.toLocaleString('zh-Hant')}</div>
        </div>
        <div className={`score-cell ${flash || hud.fever ? 'flash' : ''}`}>
          <div className="score-label">{hud.fever ? '狂熱連擊' : '連擊 / 倍率'}</div>
          <div className="score-value">
            {hud.combo}{' '}
            <span style={{ color: hud.fever ? '#f472b6' : 'var(--neon-lime)' }}>
              {formatMult(hud.multiplier)}
            </span>
          </div>
        </div>
        <div className={`score-cell ${boosting ? 'flash' : ''}`}>
          <div className="score-label">{boosting ? '硝基' : '時速'}</div>
          <div className="score-value">{Math.round(hud.speed * 3.6)}</div>
        </div>
      </div>
      {hud.toast && (
        <div className={`score-toast toast-${hud.toast}`} aria-hidden="true">
          {TOAST_LABEL[hud.toast]}
        </div>
      )}
    </div>
  );
}
