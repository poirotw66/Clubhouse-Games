import type { ReactElement } from 'react';
import type { HudSnapshot } from '../engine/LionWorld';
import type { Strings } from '../i18n';

interface MobileTacticalBarProps {
  hud: HudSnapshot;
  s: Strings;
  onSpitRibbon: () => void;
  onOpenTactics: () => void;
}

export function MobileTacticalBar({
  hud,
  s,
  onSpitRibbon,
  onOpenTactics,
}: MobileTacticalBarProps): ReactElement {
  const rollDeg = (hud.roll * 180) / Math.PI;
  const isTipping = hud.tipping;
  const isTilted = Math.abs(hud.roll) > 0.22 || Math.abs(hud.pitch) > 0.24;
  const statusClass = isTipping ? 'is-danger' : isTilted ? 'is-tilted' : 'is-stable';

  return (
    <div className="lion-mobile-tactical-bar" aria-label={s.tacticalBar}>
      {/* Mini Gyro status */}
      <div className={`lion-mobile-gyro-pill ${statusClass}`} title={`${s.roll}: ${rollDeg.toFixed(1)}°`}>
        <span className="lion-m-gyro-dot" style={{ transform: `rotate(${-rollDeg}deg)` }} />
        <span className="lion-m-gyro-text">{rollDeg > 0 ? `+${rollDeg.toFixed(0)}°` : `${rollDeg.toFixed(0)}°`}</span>
      </div>

      {/* Spirit Bar Pill */}
      <div className="lion-mobile-spirit-pill">
        <span className="lion-m-spirit-icon">🏮</span>
        <div className="lion-m-spirit-track">
          <div
            className="lion-m-spirit-fill"
            style={{ width: `${Math.min(100, Math.max(0, hud.auspiciousSpirit))}%` }}
          />
        </div>
        <span className="lion-m-spirit-num">{hud.auspiciousSpirit}%</span>
      </div>

      {/* Gold Fever badge or Cadence */}
      {hud.goldFever ? (
        <span className="lion-mobile-fever-badge">🦁 ×1.25</span>
      ) : (
        <span className="lion-mobile-combo-badge">
          {hud.combo > 0 ? `連擊 ×${hud.combo}` : '連擊 —'}
        </span>
      )}

      {/* Quick-tap 吐福彩帶 */}
      <button
        type="button"
        className="lion-mobile-btn lion-m-btn-ribbon"
        onClick={onSpitRibbon}
        aria-label={`${s.actionSpitRibbon} (B)`}
        title={s.actionSpitRibbon}
      >
        <span>🧧</span>
        <span className="lion-m-btn-label">吐福</span>
      </button>

      {/* Quick-tap 錦囊 */}
      <button
        type="button"
        className="lion-mobile-btn lion-m-btn-tactics"
        onClick={onOpenTactics}
        aria-label={s.masterTactics}
        title={s.masterTactics}
      >
        <span>📜</span>
      </button>
    </div>
  );
}
