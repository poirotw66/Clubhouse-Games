import type { ReactElement } from 'react';
import type { HudSnapshot } from '../engine/LionWorld';
import type { Lang } from '../engine/storage';
import type { Strings } from '../i18n';

interface PavilionCockpitProps {
  hud: HudSnapshot;
  s: Strings;
  lang: Lang;
  onSpitRibbon: () => void;
  onTrimLeft: () => void;
  onTrimRight: () => void;
  onLeap: () => void;
  onOpenTactics: () => void;
}

export function PavilionCockpit({
  hud,
  s,
  lang: _lang,
  onSpitRibbon,
  onTrimLeft,
  onTrimRight,
  onLeap,
  onOpenTactics,
}: PavilionCockpitProps): ReactElement {
  const rollDeg = (hud.roll * 180) / Math.PI;
  const pitchDeg = (hud.pitch * 180) / Math.PI;

  const bubbleX = 48 + Math.max(-28, Math.min(28, hud.roll * 55));
  const bubbleY = 48 - Math.max(-28, Math.min(28, hud.pitch * 55));

  const isTipping = hud.tipping;
  const isTilted = Math.abs(hud.roll) > 0.22 || Math.abs(hud.pitch) > 0.24;

  const statusClass = isTipping ? 'is-danger' : isTilted ? 'is-tilted' : 'is-stable';
  const statusLabel = isTipping ? s.danger : isTilted ? s.tilted : s.stable;

  const leftPct = Math.round(hud.leftLoad * 100);
  const rightPct = Math.round(hud.rightLoad * 100);

  const greensPct = Math.min(100, Math.round((hud.distance / 50) * 100));
  const fortuneScore = Math.round(
    hud.distance * 12 + hud.combo * 20 + (hud.goldFever ? 120 : 0) + hud.auspiciousSpirit * 5,
  );

  return (
    <>
      {/* ── Left Wing: 醒獅步態與高樁平衡陀螺儀 ────────────────────── */}
      <aside className="lion-cockpit-wing lion-cockpit-left" aria-label={s.stiltGyro}>
        <div className="lion-wing-card lion-gyro-card">
          <header className="lion-wing-header">
            <span className="lion-wing-eyebrow">Stilt Horizon Gyro</span>
            <h3 className="lion-wing-title">{s.gyroBalance}</h3>
            <span className={`lion-gyro-status-chip ${statusClass}`}>{statusLabel}</span>
          </header>

          <div className="lion-gyro-visual-wrap">
            <svg
              className="lion-gyro-dial"
              viewBox="0 0 96 96"
              width="96"
              height="96"
              aria-hidden="true"
            >
              <defs>
                <clipPath id="gyroClip">
                  <circle cx="48" cy="48" r="44" />
                </clipPath>
              </defs>

              <circle cx="48" cy="48" r="45" className="lion-gyro-ring" />
              <circle cx="48" cy="48" r="28" className="lion-gyro-safe-ring" />

              <g clipPath="url(#gyroClip)">
                <line
                  x1="-20"
                  y1="48"
                  x2="116"
                  y2="48"
                  className="lion-gyro-horizon"
                  transform={`rotate(${-rollDeg} 48 48) translate(0, ${-hud.pitch * 30})`}
                />
                <circle cx={bubbleX} cy={bubbleY} r="7" className="lion-gyro-bubble" />
              </g>

              {/* Crosshair reticle */}
              <line x1="48" y1="8" x2="48" y2="24" className="lion-gyro-crosshair" />
              <line x1="48" y1="72" x2="48" y2="88" className="lion-gyro-crosshair" />
              <line x1="8" y1="48" x2="24" y2="48" className="lion-gyro-crosshair" />
              <line x1="72" y1="48" x2="88" y2="48" className="lion-gyro-crosshair" />
            </svg>

            <div className="lion-gyro-readouts">
              <div className="lion-readout-item">
                <span className="lion-readout-k">{s.roll}</span>
                <span className="lion-readout-v">{rollDeg > 0 ? `+${rollDeg.toFixed(1)}°` : `${rollDeg.toFixed(1)}°`}</span>
              </div>
              <div className="lion-readout-item">
                <span className="lion-readout-k">{s.pitch}</span>
                <span className="lion-readout-v">{pitchDeg > 0 ? `+${pitchDeg.toFixed(1)}°` : `${pitchDeg.toFixed(1)}°`}</span>
              </div>
              <div className="lion-readout-item">
                <span className="lion-readout-k">{s.stiltHeight}</span>
                <span className="lion-readout-v">{hud.stiltHeight.toFixed(2)}m</span>
              </div>
              <div className="lion-readout-item">
                <span className="lion-readout-k">{s.airTime}</span>
                <span className={`lion-readout-v ${hud.airTime > 0 ? 'is-air' : ''}`}>
                  {hud.airTime.toFixed(2)}s
                </span>
              </div>
            </div>
          </div>

          <div className="lion-foot-balance-wrap">
            <div className="lion-foot-balance-labels">
              <span>{s.leftFoot} {leftPct}%</span>
              <span>{rightPct}% {s.rightFoot}</span>
            </div>
            <div className="lion-foot-balance-track">
              <div
                className="lion-foot-balance-fill is-left"
                style={{ width: `${Math.min(100, Math.max(0, leftPct))}%` }}
              />
              <div
                className="lion-foot-balance-fill is-right"
                style={{ width: `${Math.min(100, Math.max(0, rightPct))}%` }}
              />
            </div>
          </div>

          {/* Cadence streak / Gold Fever Mode */}
          <div className={`lion-fever-banner ${hud.goldFever ? 'is-fever-active' : ''}`}>
            {hud.goldFever ? (
              <div className="lion-fever-content">
                <span className="lion-fever-badge">🦁 {s.goldFever} ×1.25</span>
                <div className="lion-fever-bar">
                  <div
                    className="lion-fever-progress"
                    style={{ width: `${Math.min(100, (hud.goldFeverTimer / 4.5) * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="lion-cadence-content">
                <span className="lion-cadence-label">{s.cadenceRadar}</span>
                <span className="lion-cadence-streak">
                  {s.combo} {hud.combo > 0 ? `×${hud.combo}` : '—'}
                  <small className="lion-cadence-hint">（連擊4步開狂熱）</small>
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Right Wing: 祥獅獻瑞喜氣值與彩頭戰績檔案 ────────────────── */}
      <aside className="lion-cockpit-wing lion-cockpit-right" aria-label={s.auspiciousSpirit}>
        <div className="lion-wing-card lion-spirit-card">
          <header className="lion-wing-header">
            <span className="lion-wing-eyebrow">Auspicious Spirit Archive</span>
            <div className="lion-spirit-title-row">
              <h3 className="lion-wing-title">{s.auspiciousSpirit}</h3>
              <span className="lion-spirit-num">{hud.auspiciousSpirit}%</span>
            </div>
          </header>

          <div className="lion-spirit-meter">
            <div
              className="lion-spirit-fill"
              style={{ width: `${Math.min(100, Math.max(0, hud.auspiciousSpirit))}%` }}
            />
            <div className="lion-spirit-milestones" aria-hidden="true">
              <span className={`lion-milestone-pip ${hud.auspiciousSpirit >= 25 ? 'is-reached' : ''}`} title="25%">25</span>
              <span className={`lion-milestone-pip ${hud.auspiciousSpirit >= 50 ? 'is-reached' : ''}`} title="50%">50</span>
              <span className={`lion-milestone-pip ${hud.auspiciousSpirit >= 75 ? 'is-reached' : ''}`} title="75%">75</span>
              <span className={`lion-milestone-pip ${hud.auspiciousSpirit >= 100 ? 'is-reached' : ''}`} title="100%">100</span>
            </div>
          </div>

          <div className="lion-fortune-stats">
            <div className="lion-fortune-stat">
              <span className="lion-stat-k">{s.greensProgress}</span>
              <span className="lion-stat-v">{greensPct}%</span>
            </div>
            <div className="lion-fortune-stat">
              <span className="lion-stat-k">{s.strideRhythm}</span>
              <span className="lion-stat-v">{Math.round(hud.onBeatRatio * 100)}%</span>
            </div>
            <div className="lion-fortune-stat">
              <span className="lion-stat-k">{s.fortuneScore}</span>
              <span className="lion-stat-v">+{fortuneScore}</span>
            </div>
          </div>

          {/* Interactive Tactical Hot-Action Panel */}
          <div className="lion-tactical-actions">
            <button
              type="button"
              className="lion-action-btn lion-btn-ribbon"
              onClick={onSpitRibbon}
              title={`${s.actionSpitRibbon} (B)`}
              aria-label={`${s.actionSpitRibbon} (B)`}
            >
              <span className="lion-btn-icon">🧧</span>
              <span className="lion-btn-text">{s.actionSpitRibbon}</span>
              <kbd className="lion-btn-kbd">B</kbd>
            </button>

            <div className="lion-trim-row">
              <button
                type="button"
                className="lion-action-btn lion-btn-trim"
                onClick={onTrimLeft}
                title={`${s.actionTrimLeft} (←)`}
                aria-label={`${s.actionTrimLeft} (←)`}
              >
                ◀ {s.actionTrimLeft}
              </button>
              <button
                type="button"
                className="lion-action-btn lion-btn-trim"
                onClick={onTrimRight}
                title={`${s.actionTrimRight} (→)`}
                aria-label={`${s.actionTrimRight} (→)`}
              >
                {s.actionTrimRight} ▶
              </button>
            </div>

            <button
              type="button"
              className="lion-action-btn lion-btn-leap"
              onClick={onLeap}
              title={`${s.actionLeap} (Space)`}
              aria-label={`${s.actionLeap} (Space)`}
            >
              <span className="lion-btn-icon">躍</span>
              <span className="lion-btn-text">{s.actionLeap}</span>
              <kbd className="lion-btn-kbd">Space</kbd>
            </button>
          </div>

          {/* Master Tactics Mini Banner */}
          <button
            type="button"
            className="lion-tactics-trigger"
            onClick={onOpenTactics}
            title={s.masterTactics}
          >
            <span className="lion-tactics-trigger-icon">📜</span>
            <span className="lion-tactics-trigger-title">{s.masterTactics}</span>
            <span className="lion-tactics-trigger-arrow">›</span>
          </button>
        </div>
      </aside>

      {/* Floating Auspicious Calligraphy Banner */}
      {hud.fortuneTitle && (
        <div className="lion-blessing-toast" aria-live="polite">
          <span className="lion-blessing-symbol">✦</span>
          <span className="lion-blessing-text">{hud.fortuneTitle}</span>
          <span className="lion-blessing-symbol">✦</span>
        </div>
      )}
    </>
  );
}
