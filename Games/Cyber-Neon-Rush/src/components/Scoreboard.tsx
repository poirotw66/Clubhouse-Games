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
  shield: '護盾',
  magnet: '磁鐵',
  multiplier: '分數加倍',
  slowmo: '慢動作',
  dash: '衝刺',
  jump: '跳躍',
};

export function Scoreboard({ hud, visible }: ScoreboardProps): ReactElement | null {
  if (!visible) return null;
  const flash = hud.nearMissFlash > 0.05;
  const boosting = hud.boostT > 0.05;
  const powers = hud.powers;
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
            <span style={{ color: hud.fever || hud.scoreMulActive > 1 ? '#f472b6' : 'var(--neon-lime)' }}>
              {formatMult(hud.multiplier)}
            </span>
          </div>
        </div>
        <div className={`score-cell ${boosting ? 'flash' : ''}`}>
          <div className="score-label">{boosting ? '硝基' : hud.dashReady ? '衝刺就緒' : '衝刺冷卻'}</div>
          <div className="score-value">
            {boosting
              ? Math.round(hud.speed * 3.6)
              : hud.dashReady
                ? 'OK'
                : `${hud.dashCd.toFixed(1)}s`}
          </div>
        </div>
      </div>
      {(powers.shield || powers.magnet > 0 || powers.multiplier > 0 || powers.slowmo > 0) && (
        <div className="power-chips" aria-label="作用中道具">
          {powers.shield && <span className="power-chip chip-shield">護盾</span>}
          {powers.magnet > 0 && (
            <span className="power-chip chip-magnet">磁鐵 {powers.magnet.toFixed(1)}s</span>
          )}
          {powers.multiplier > 0 && (
            <span className="power-chip chip-mult">×2 {powers.multiplier.toFixed(1)}s</span>
          )}
          {powers.slowmo > 0 && (
            <span className="power-chip chip-slow">慢動作 {powers.slowmo.toFixed(1)}s</span>
          )}
        </div>
      )}
      {hud.toast && (
        <div className={`score-toast toast-${hud.toast}`} aria-hidden="true">
          {TOAST_LABEL[hud.toast]}
        </div>
      )}
    </div>
  );
}
