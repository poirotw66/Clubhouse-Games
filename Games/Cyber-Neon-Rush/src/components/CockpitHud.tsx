import { useMemo, type ReactElement } from 'react';
import type { HudSnapshot } from '../engine/scoreSystem';
import { HoloFloaties } from './HoloFloaties';
import { SpeedWarpCanvas } from './SpeedWarpCanvas';

interface CockpitHudProps {
  hud: HudSnapshot;
  visible: boolean;
}

function formatMult(m: number): string {
  return `×${m.toFixed(2)}`;
}

function getGearLabel(kmh: number, fever: boolean, boosting: boolean): string {
  if (boosting || kmh >= 260) return 'OVERDRIVE';
  if (fever || kmh >= 220) return 'GEAR 5';
  if (kmh >= 170) return 'GEAR 4';
  if (kmh >= 130) return 'GEAR 3';
  if (kmh >= 85) return 'GEAR 2';
  return 'GEAR 1';
}

export function CockpitHud({ hud, visible }: CockpitHudProps): ReactElement | null {
  if (!visible) return null;

  const kmh = Math.round(hud.speed * 3.6);
  const flash = hud.nearMissFlash > 0.05;
  const boosting = hud.boostT > 0.05;
  const powers = hud.powers;
  const gear = getGearLabel(kmh, hud.fever, boosting);

  // Speed arc calculations (range 0 km/h to 300 km/h)
  const speedRatio = Math.max(0, Math.min(1, kmh / 300));
  const dashCdRatio = Math.max(0, Math.min(1, 1 - hud.dashCd / 3.0));

  // Determine LED gauge color
  const arcColor = useMemo(() => {
    if (hud.fever) return '#f472b6'; // Neon magenta
    if (boosting || kmh >= 240) return '#facc15'; // Overdrive yellow
    if (kmh >= 180) return '#a3e635'; // Neon lime
    return '#22d3ee'; // Cyber cyan
  }, [hud.fever, boosting, kmh]);

  return (
    <>
      {/* Hyper-drive speed warp canvas */}
      <SpeedWarpCanvas
        speed={hud.speed}
        boosting={boosting}
        dashing={hud.dashCd > 2.5}
        fever={hud.fever}
        active={visible}
      />

      {/* Floating Holographic Floaties */}
      <HoloFloaties hud={hud} />

      {/* Main Cockpit HUD overlay */}
      <div
        className={`scoreboard ${hud.fever ? 'fever' : ''} ${flash ? 'near-flash' : ''}`}
        aria-live="polite"
        aria-label="動態計分板與賽博儀表板"
      >
        {/* Top telemetry readouts */}
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
              <span
                style={{
                  color: hud.fever || hud.scoreMulActive > 1 ? '#f472b6' : 'var(--neon-lime)',
                }}
              >
                {formatMult(hud.multiplier)}
              </span>
            </div>
          </div>
          <div className={`score-cell ${boosting ? 'flash' : ''}`}>
            <div className="score-label">
              {boosting ? '硝基推進' : hud.dashReady ? '衝刺就緒' : '衝刺冷卻'}
            </div>
            <div className="score-value">
              {boosting ? (
                <span style={{ color: '#facc15' }}>BURST</span>
              ) : hud.dashReady ? (
                'OK'
              ) : (
                `${hud.dashCd.toFixed(1)}s`
              )}
            </div>
          </div>
        </div>

        {/* Tactical active powerup modules */}
        {(powers.shield || powers.magnet > 0 || powers.multiplier > 0 || powers.slowmo > 0) && (
          <div className="power-chips" aria-label="作用中道具">
            {powers.shield && <span className="power-chip chip-shield">護盾 🛡️</span>}
            {powers.magnet > 0 && (
              <span className="power-chip chip-magnet">磁鐵 🧲 {powers.magnet.toFixed(1)}s</span>
            )}
            {powers.multiplier > 0 && (
              <span className="power-chip chip-mult">雙倍 ⚡ {powers.multiplier.toFixed(1)}s</span>
            )}
            {powers.slowmo > 0 && (
              <span className="power-chip chip-slow">慢動作 ⏳ {powers.slowmo.toFixed(1)}s</span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Cockpit Instrument Console */}
      <div className="cockpit-console" aria-hidden="true">
        {/* Left: Nitro Reactor Pod */}
        <div className="console-pod nitro-pod">
          <div className="pod-header">
            <span className="pod-tag font-display">NITRO CAPACITOR</span>
            <span className={`nitro-state font-display ${hud.dashReady ? 'is-ready' : ''}`}>
              {boosting ? 'BURST' : hud.dashReady ? 'READY' : 'CHARGING'}
            </span>
          </div>
          <div className="nitro-meter-track">
            <div
              className={`nitro-meter-bar ${hud.dashReady ? 'is-full' : ''}`}
              style={{ width: `${hud.dashReady ? 100 : dashCdRatio * 100}%` }}
            />
          </div>
          <span className="nitro-hint hidden md:inline font-display">
            {hud.dashReady ? '↓ / SHIFT 衝刺突破' : `充能中 ${hud.dashCd.toFixed(1)}s`}
          </span>
        </div>

        {/* Center: Digital Curved Speedometer & Tachometer */}
        <div className="speedometer-cluster">
          <svg
            className="tachometer-arc"
            viewBox="0 0 160 85"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Background track arc */}
            <path
              d="M 18 78 A 64 64 0 0 1 142 78"
              stroke="rgba(34, 211, 238, 0.2)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            {/* Dynamic filled arc */}
            <path
              d="M 18 78 A 64 64 0 0 1 142 78"
              stroke={arcColor}
              strokeWidth="7"
              strokeDasharray="195"
              strokeDashoffset={195 * (1 - speedRatio)}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 6px ${arcColor})`,
                transition: 'stroke-dashoffset 80ms linear, stroke 180ms ease',
              }}
            />
          </svg>

          {/* Central digital speed readout */}
          <div className="speedometer-center">
            <span className="speed-gear font-display">{gear}</span>
            <div className="speed-digits-row">
              <span className="speed-number font-display" style={{ color: arcColor }}>
                {kmh}
              </span>
              <span className="speed-unit font-display">KM/H</span>
            </div>
          </div>
        </div>

        {/* Right: Desktop Keybind Deck */}
        <div className="console-pod key-deck hidden md:flex">
          <div className="pod-header">
            <span className="pod-tag font-display">CONTROLS</span>
            <span className="key-ready-tag font-display">ONLINE</span>
          </div>
          <div className="key-badges">
            <span className="key-badge">
              <kbd>←</kbd> <kbd>→</kbd> 切道
            </span>
            <span className="key-badge">
              <kbd>SPACE</kbd> 跳躍
            </span>
            <span className={`key-badge ${hud.dashReady ? 'key-ready' : ''}`}>
              <kbd>SHIFT</kbd> 衝刺
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
