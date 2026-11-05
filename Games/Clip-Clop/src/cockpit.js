/**
 * Dual-wing Royal Derby Equestrian Cockpit (皇家德比雙翼賽馬座艙)
 * Manages telemetry, vitals, mini-radar steeplechase map,
 * rhythm perfect bar, keyboard matrix HUD, and master jockey tips.
 */
export class CockpitManager {
  constructor(options = {}) {
    this.tr = options.tr || (k => k);
    this.stamina = 100;
    this.maxStamina = 100;
    this.heartRate = 84;
    this.cadenceRpm = 0;
    this.aeroActive = false;
    this.trimRoll = 0;
    this.mobileOpen = false;

    // DOM references
    this.uiRoot = null;
    this.leftWing = null;
    this.rightWing = null;
    this.keyboardMatrix = null;
    this.mobileBar = null;
    this.mobileDock = null;

    // Sub-elements cache
    this.elRpmValue = null;
    this.elRpmNeedle = null;
    this.elRpmGait = null;
    this.elHrValue = null;
    this.elHrHeart = null;
    this.elStaminaFill = null;
    this.elStaminaText = null;
    this.elSpeedValue = null;
    this.elSpeedBar = null;
    this.elRhythmBar = null;
    this.elRhythmMarker = null;
    this.elRhythmLabel = null;

    this.elRadarSvg = null;
    this.elRadarPlayer = null;
    this.elRadarRival = null;
    this.elRadarGhost = null;
    this.elDeltaValue = null;
    this.elDeltaBadge = null;
    this.elWindText = null;
    this.elGripText = null;
    this.elCdText = null;
    this.elJockeyTip = null;
    this.elNextHurdleHint = null;
    this.elMobSpeed = null;
    this.elMobRpm = null;
    this.elMobStamina = null;
    this.elMobHurdle = null;
    this.elTouchReset = null;
    this.elTouchResetIcon = null;
    this.elTouchResetText = null;
    this.elMobHurdleWrap = null;
    this.elBackdrop = null;
    this.matrixKeyEls = {};
    this.matrixKeyStates = {};

    // Dirty-check tracking to minimize DOM reflows
    this._lastRpm = -1;
    this._lastNeedleAngle = null;
    this._lastGaitCls = '';
    this._lastHr = -1;
    this._lastHrAnim = -1;
    this._lastStaminaPct = -1;
    this._lastSpeedStr = '';
    this._lastSpeedBarPct = -1;
    this._lastRhythmMarkerLeft = '';
    this._lastRhythmLabelText = '';
    this._lastRhythmGrade = null;
    this._lastRhythmDistLabel = '';
    this._rhythmHurdleMode = false;
    this._lastPlayerPx10 = -1;
    this._lastRivalPx10 = -1;
    this._lastGhostPx10 = -1;
    this._rivalVisible = false;
    this._ghostVisible = false;
    this._lastHurdleHintText = '';
    this._lastDeltaStr = '';
    this._lastWindStr = '';
    this._lastGripStr = '';
    this._lastCdStr = '';
    this._lastMobSpeedStr = '';
    this._lastMobRpm = -1;
    this._lastMobStaminaStr = '';
    this._lastMobHurdleStr = '';
    this._lastTouchResetAlert = null;

    this.tipCooldown = 0;
    this.currentTipKey = '';
    this.lastStepCount = 0;
    this.stepTimestamps = [];
  }

  mount(container) {
    this.uiRoot = container;
    this.buildMarkup();
    this.bindEvents();
  }

  buildMarkup() {
    // 1. Left Wing: Telemetry & Vitals (左翼：遙測與體徵儀表)
    const leftWing = document.createElement('aside');
    leftWing.id = 'cockpitLeft';
    leftWing.className = 'cockpit-wing cockpit-left hidden';
    leftWing.setAttribute('aria-label', '遙測與體徵儀表');
    leftWing.innerHTML = `
      <div class="cockpit-card">
        <button class="cockpit-close-btn" id="cockpitCloseLeft" aria-label="關閉座艙">✕</button>
        <div class="cockpit-header">
          <span class="royal-crest">⚜</span>
          <span class="cockpit-title" data-i18n="cockpit_left_title">遙測與體徵儀表</span>
          <span class="royal-crest">⚜</span>
        </div>

        <!-- Stride Cadence Tachometer -->
        <div class="cockpit-section cadence-tach">
          <div class="section-label" data-i18n="telemetry_cadence">馬匹步態頻率 (RPM)</div>
          <div class="tach-gauge">
            <svg viewBox="0 0 120 70" class="tach-svg">
              <path d="M 15 60 A 45 45 0 0 1 105 60" class="gauge-track" />
              <path d="M 15 60 A 45 45 0 0 1 50 20" class="gauge-zone walk" />
              <path d="M 50 20 A 45 45 0 0 1 80 17" class="gauge-zone trot" />
              <path d="M 80 17 A 45 45 0 0 1 105 60" class="gauge-zone gallop" />
              <line x1="60" y1="60" x2="60" y2="18" id="rpmNeedle" class="gauge-needle" />
              <circle cx="60" cy="60" r="5" class="gauge-pin" />
            </svg>
            <div class="tach-readout">
              <b id="rpmValue">0</b>
              <small>RPM</small>
            </div>
          </div>
          <div class="cadence-status">
            <span id="rpmGait" class="cockpit-badge gait-idle" data-i18n="gait_idle">靜止</span>
          </div>
        </div>

        <!-- Stamina & Heart Rate -->
        <div class="cockpit-section vitals-sec">
          <div class="vitals-row">
            <div class="hr-display">
              <span id="hrHeart" class="hr-heart">♥</span>
              <b id="hrValue">84</b>
              <small>BPM</small>
            </div>
            <div class="stamina-percent" id="staminaText">100%</div>
          </div>
          <div class="stamina-track">
            <div id="staminaFill" class="stamina-fill" style="width:100%"></div>
          </div>
          <div class="ecg-line-wrap">
            <svg viewBox="0 0 120 18" class="ecg-svg">
              <path d="M 0 9 L 30 9 L 35 3 L 42 15 L 48 4 L 54 11 L 58 9 L 120 9" class="ecg-path" />
            </svg>
          </div>
        </div>

        <!-- Realtime Speedometer -->
        <div class="cockpit-section speed-sec">
          <div class="section-label" data-i18n="hud_speed">即時車速表</div>
          <div class="speed-readout">
            <b id="cockpitSpeed">0.0</b>
            <small>KM/H</small>
          </div>
          <div class="speed-bar-track">
            <div id="cockpitSpeedBar" class="speed-bar-fill" style="width:0%"></div>
          </div>
        </div>

        <!-- Rhythm Perfect Timing Bar -->
        <div class="cockpit-section rhythm-sec">
          <div class="section-label" data-i18n="rhythm_bar_title">最佳跨欄節奏引導條</div>
          <div class="rhythm-timing-bar" id="rhythmBar">
            <div class="rhythm-zone-safe"></div>
            <div class="rhythm-zone-perfect">
              <span class="perfect-hint">PERFECT</span>
            </div>
            <div id="rhythmMarker" class="rhythm-cursor"></div>
          </div>
          <div class="rhythm-status-label" id="rhythmLabel" data-i18n="rhythm_ready">對角交替蓄力中</div>
        </div>
      </div>
    `;

    // 2. Right Wing: Tactical Radar & Race Intel (右翼：戰術雷達與賽事情報)
    const rightWing = document.createElement('aside');
    rightWing.id = 'cockpitRight';
    rightWing.className = 'cockpit-wing cockpit-right hidden';
    rightWing.setAttribute('aria-label', '戰術雷達與賽事情報');
    rightWing.innerHTML = `
      <div class="cockpit-card">
        <button class="cockpit-close-btn" id="cockpitCloseRight" aria-label="關閉座艙">✕</button>
        <div class="cockpit-header">
          <span class="royal-crest">⚜</span>
          <span class="cockpit-title" data-i18n="cockpit_right_title">戰術雷達與賽事情報</span>
          <span class="royal-crest">⚜</span>
        </div>

        <!-- Steeplechase & Elevation Map -->
        <div class="cockpit-section radar-sec">
          <div class="section-label" data-i18n="radar_title">障礙賽道等高線雷達</div>
          <div class="radar-box">
            <svg id="radarSvg" viewBox="0 0 160 56" class="radar-svg">
              <!-- Track profile elevation line -->
              <path id="radarElevation" d="M 10 38 Q 45 32 80 35 T 150 36" class="radar-track-line" />
              <!-- Hurdle pins -->
              <g class="radar-hurdle" transform="translate(52, 28)">
                <line x1="0" y1="0" x2="0" y2="12" class="hurdle-pin" />
                <rect x="-3" y="-3" width="6" height="4" class="hurdle-flag" />
                <text x="-4" y="-5" class="hurdle-text">H1</text>
              </g>
              <g class="radar-hurdle" transform="translate(93, 27)">
                <line x1="0" y1="0" x2="0" y2="12" class="hurdle-pin" />
                <rect x="-3" y="-3" width="6" height="4" class="hurdle-flag" />
                <text x="-4" y="-5" class="hurdle-text">H2</text>
              </g>
              <g class="radar-hurdle" transform="translate(133, 29)">
                <line x1="0" y1="0" x2="0" y2="12" class="hurdle-pin" />
                <rect x="-3" y="-3" width="6" height="4" class="hurdle-flag" />
                <text x="-4" y="-5" class="hurdle-text">H3</text>
              </g>
              <!-- Finish post -->
              <line x1="150" y1="20" x2="150" y2="40" class="radar-finish-line" />
              <text x="144" y="16" class="finish-flag">🏁</text>
              <!-- Moving dots -->
              <circle id="radarGhost" cx="10" cy="38" r="3.2" class="radar-dot ghost-dot hidden" />
              <circle id="radarRival" cx="10" cy="38" r="3.6" class="radar-dot rival-dot hidden" />
              <g id="radarPlayer" transform="translate(10, 38)">
                <circle cx="0" cy="0" r="4.5" class="radar-dot player-dot" />
                <text x="-4" y="-6" class="player-icon">🏇</text>
              </g>
            </svg>
            <div class="radar-legend">
              <span>0m</span>
              <span id="nextHurdleHint" class="radar-next-hint">下一欄：15m</span>
              <span>50m</span>
            </div>
          </div>
        </div>

        <!-- Delta vs Rival -->
        <div class="cockpit-section delta-sec">
          <div class="section-label" data-i18n="delta_title">領先差距秒數 Delta</div>
          <div class="delta-box">
            <span id="deltaBadge" class="delta-badge lead" data-i18n="delta_lead">領先</span>
            <b id="deltaValue">+0.00s</b>
          </div>
        </div>

        <!-- Weather & Aero Telemetry -->
        <div class="cockpit-section weather-sec">
          <div class="section-label" data-i18n="weather_title">天氣與破風遙測儀</div>
          <div class="telemetry-grid">
            <div class="telem-item">
              <span class="telem-label" data-i18n="telem_wind">風向風阻</span>
              <b id="windText">微風 1.0x</b>
            </div>
            <div class="telem-item">
              <span class="telem-label" data-i18n="telem_ground">賽道抓地</span>
              <b id="gripText">抓地良好</b>
            </div>
            <div class="telem-item telem-full">
              <span class="telem-label" data-i18n="telem_aero">破風係數 Cd</span>
              <b id="cdText" class="cd-badge">Cd 1.00x</b>
            </div>
          </div>
        </div>

        <!-- Master Jockey Tips -->
        <div class="cockpit-section tips-sec">
          <div class="section-label" data-i18n="tips_title">騎術大師錦囊</div>
          <div class="jockey-tip-box" id="jockeyTip">
            <span class="tip-icon">💡</span>
            <span class="tip-content" id="jockeyTipText">以 Q+P 與 W+O 對角節奏輪替，維持馬背重心！</span>
          </div>
        </div>
      </div>
    `;

    // 3. Esports Keyboard Matrix HUD (電競全鍵盤矩陣指南)
    const keyboardMatrix = document.createElement('div');
    keyboardMatrix.id = 'cockpitMatrix';
    keyboardMatrix.className = 'cockpit-matrix hidden';
    keyboardMatrix.setAttribute('aria-label', '電競全鍵盤矩陣指南');
    keyboardMatrix.innerHTML = `
      <div class="matrix-card">
        <div class="matrix-key" id="matKeyShift" data-key="ShiftLeft">
          <span class="k-cap">Shift</span>
          <span class="k-desc" data-i18n="mat_shift">壓身破風</span>
        </div>
        <div class="matrix-divider"></div>
        <div class="matrix-key" id="matKeyQ" data-key="KeyQ">
          <span class="k-cap">Q</span>
          <span class="k-desc" data-i18n="legQ">左後</span>
        </div>
        <div class="matrix-key" id="matKeyW" data-key="KeyW">
          <span class="k-cap">W</span>
          <span class="k-desc" data-i18n="legW">右後</span>
        </div>
        <div class="matrix-key center-jump" id="matKeySpace" data-key="Space">
          <span class="k-cap">Space</span>
          <span class="k-desc" data-i18n="mat_jump">節奏跨欄</span>
        </div>
        <div class="matrix-key" id="matKeyO" data-key="KeyO">
          <span class="k-cap">O</span>
          <span class="k-desc" data-i18n="legO">左前</span>
        </div>
        <div class="matrix-key" id="matKeyP" data-key="KeyP">
          <span class="k-cap">P</span>
          <span class="k-desc" data-i18n="legP">右前</span>
        </div>
        <div class="matrix-divider"></div>
        <div class="matrix-arrows">
          <div class="matrix-key small-arrow" id="matKeyLeft" data-key="ArrowLeft">
            <span class="k-cap">←</span>
            <span class="k-desc" data-i18n="mat_trim_l">左傾重心</span>
          </div>
          <div class="matrix-key small-arrow" id="matKeyRight" data-key="ArrowRight">
            <span class="k-cap">→</span>
            <span class="k-desc" data-i18n="mat_trim_r">右傾重心</span>
          </div>
        </div>
        <div class="matrix-key" id="matKeyR" data-key="KeyR">
          <span class="k-cap">R</span>
          <span class="k-desc" data-i18n="mat_reset">起身重整</span>
        </div>
      </div>
    `;

    // 4. Mobile Top Tactical Ticker (行動端頂部緊湊戰術速報條)
    const mobileBar = document.createElement('div');
    mobileBar.id = 'mobileCockpitBar';
    mobileBar.className = 'mobile-cockpit-bar hidden';
    mobileBar.innerHTML = `
      <div class="mob-item"><span class="mob-icon">⚡</span><span class="mob-k">SPD</span><b id="mobSpeed">0.0</b></div>
      <div class="mob-item"><span class="mob-icon">🔄</span><span class="mob-k">RPM</span><b id="mobRpm">0</b></div>
      <div class="mob-item"><span class="mob-icon">💚</span><span class="mob-k">STM</span><b id="mobStamina">100%</b></div>
      <div class="mob-item" id="mobHurdleWrap"><span class="mob-icon">🏇</span><span class="mob-k">NEXT</span><b id="mobHurdle">15m</b></div>
      <button id="mobCockpitToggle" class="mob-cockpit-btn" aria-label="切換座艙儀表">📊 儀表</button>
    `;

    // 5. Mobile Action Touch Dock (行動端延伸操作按鈕：破風、跨欄、起身重整、重心平衡)
    const mobileDock = document.createElement('div');
    mobileDock.id = 'mobileActionDock';
    mobileDock.className = 'mobile-action-dock hidden';
    mobileDock.innerHTML = `
      <button id="touchAero" class="action-pill aero-pill" aria-label="壓身破風">
        <span class="pill-icon">💨</span>
        <span class="pill-text" data-i18n="mob_btn_aero">破風</span>
      </button>
      <button id="touchJump" class="action-pill jump-pill" aria-label="節奏跨欄">
        <span class="pill-icon">🏇</span>
        <span class="pill-text" data-i18n="mob_btn_jump">跨欄</span>
      </button>
      <button id="touchReset" class="action-pill reset-pill" aria-label="起身重整">
        <span class="pill-icon" id="touchResetIcon">🔄</span>
        <span class="pill-text" id="touchResetText" data-i18n="mob_btn_reset">重整 (R)</span>
      </button>
      <div class="trim-group">
        <button id="touchTrimL" class="trim-pill" aria-label="左傾重心">◀</button>
        <button id="touchTrimR" class="trim-pill" aria-label="右傾重心">▶</button>
      </div>
    `;

    // 6. Mobile Backdrop for drawer dismiss
    const backdrop = document.createElement('div');
    backdrop.id = 'cockpitBackdrop';
    backdrop.className = 'cockpit-backdrop hidden';

    this.uiRoot.appendChild(leftWing);
    this.uiRoot.appendChild(rightWing);
    this.uiRoot.appendChild(keyboardMatrix);
    this.uiRoot.appendChild(mobileBar);
    this.uiRoot.appendChild(mobileDock);
    this.uiRoot.appendChild(backdrop);

    this.leftWing = leftWing;
    this.rightWing = rightWing;
    this.keyboardMatrix = keyboardMatrix;
    this.mobileBar = mobileBar;
    this.mobileDock = mobileDock;
    this.elBackdrop = backdrop;

    // Cache elements
    this.elRpmValue = document.getElementById('rpmValue');
    this.elRpmNeedle = document.getElementById('rpmNeedle');
    this.elRpmGait = document.getElementById('rpmGait');
    this.elHrValue = document.getElementById('hrValue');
    this.elHrHeart = document.getElementById('hrHeart');
    this.elStaminaFill = document.getElementById('staminaFill');
    this.elStaminaText = document.getElementById('staminaText');
    this.elSpeedValue = document.getElementById('cockpitSpeed');
    this.elSpeedBar = document.getElementById('cockpitSpeedBar');
    this.elRhythmBar = document.getElementById('rhythmBar');
    this.elRhythmMarker = document.getElementById('rhythmMarker');
    this.elRhythmLabel = document.getElementById('rhythmLabel');

    this.elRadarSvg = document.getElementById('radarSvg');
    this.elRadarPlayer = document.getElementById('radarPlayer');
    this.elRadarRival = document.getElementById('radarRival');
    this.elRadarGhost = document.getElementById('radarGhost');
    this.elDeltaValue = document.getElementById('deltaValue');
    this.elDeltaBadge = document.getElementById('deltaBadge');
    this.elWindText = document.getElementById('windText');
    this.elGripText = document.getElementById('gripText');
    this.elCdText = document.getElementById('cdText');
    this.elJockeyTip = document.getElementById('jockeyTipText');
    this.elNextHurdleHint = document.getElementById('nextHurdleHint');

    this.elMobSpeed = document.getElementById('mobSpeed');
    this.elMobRpm = document.getElementById('mobRpm');
    this.elMobStamina = document.getElementById('mobStamina');
    this.elMobHurdle = document.getElementById('mobHurdle');
    this.elTouchReset = document.getElementById('touchReset');
    this.elTouchResetIcon = document.getElementById('touchResetIcon');
    this.elTouchResetText = document.getElementById('touchResetText');
    this.elMobHurdleWrap = document.getElementById('mobHurdleWrap');
  }

  bindEvents() {
    const toggleBtn = document.getElementById('mobCockpitToggle');
    const closeLeft = document.getElementById('cockpitCloseLeft');
    const closeRight = document.getElementById('cockpitCloseRight');

    const setMobileOpen = (open) => {
      this.mobileOpen = open;
      if (this.leftWing) this.leftWing.classList.toggle('mobile-open', open);
      if (toggleBtn) toggleBtn.classList.toggle('active', open);
      if (this.elBackdrop) this.elBackdrop.classList.toggle('hidden', !open);
    };

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => setMobileOpen(!this.mobileOpen));
    }
    if (closeLeft) closeLeft.addEventListener('click', () => setMobileOpen(false));
    if (closeRight) closeRight.addEventListener('click', () => setMobileOpen(false));
    if (this.elBackdrop) {
      this.elBackdrop.addEventListener('click', () => setMobileOpen(false));
    }

    // Matrix keys interactive touch/pointer support
    if (this.keyboardMatrix) {
      const keys = this.keyboardMatrix.querySelectorAll('.matrix-key');
      keys.forEach((keyEl) => {
        const code = keyEl.dataset.key;
        if (!code) return;
        const onDown = (e) => {
          e.preventDefault();
          if (typeof window !== 'undefined' && window.__handleMatrixKeyDown) {
            window.__handleMatrixKeyDown(code);
          }
        };
        const onUp = (e) => {
          e.preventDefault();
          if (typeof window !== 'undefined' && window.__handleMatrixKeyUp) {
            window.__handleMatrixKeyUp(code);
          }
        };
        keyEl.addEventListener('pointerdown', onDown);
        keyEl.addEventListener('pointerup', onUp);
        keyEl.addEventListener('pointerleave', onUp);
        keyEl.addEventListener('pointercancel', onUp);
        keyEl.addEventListener('contextmenu', (e) => e.preventDefault());
      });
    }
  }

  show() {
    if (this.leftWing) this.leftWing.classList.remove('hidden');
    if (this.rightWing) this.rightWing.classList.remove('hidden');
    if (this.keyboardMatrix) this.keyboardMatrix.classList.remove('hidden');
    if (this.mobileBar) this.mobileBar.classList.remove('hidden');
    if (this.mobileDock) this.mobileDock.classList.remove('hidden');
  }

  hide() {
    this.mobileOpen = false;
    if (this.leftWing) {
      this.leftWing.classList.add('hidden');
      this.leftWing.classList.remove('mobile-open');
    }
    if (this.rightWing) {
      this.rightWing.classList.add('hidden');
      this.rightWing.classList.remove('mobile-open');
    }
    if (this.keyboardMatrix) this.keyboardMatrix.classList.add('hidden');
    if (this.mobileBar) this.mobileBar.classList.add('hidden');
    if (this.mobileDock) this.mobileDock.classList.add('hidden');
    if (this.elBackdrop) this.elBackdrop.classList.add('hidden');
    const toggleBtn = document.getElementById('mobCockpitToggle');
    if (toggleBtn) toggleBtn.classList.remove('active');
  }

  reset() {
    this.stamina = 100;
    this.heartRate = 84;
    this.cadenceRpm = 0;
    this.aeroActive = false;
    this.trimRoll = 0;
    this.stepTimestamps = [];
    this.lastStepCount = 0;
    this.currentTipKey = '';
    this.tipCooldown = 0;

    this._lastRpm = -1;
    this._lastNeedleAngle = null;
    this._lastGaitCls = '';
    this._lastHr = -1;
    this._lastHrAnim = -1;
    this._lastStaminaPct = -1;
    this._lastSpeedStr = '';
    this._lastSpeedBarPct = -1;
    this._lastRhythmMarkerLeft = '';
    this._lastRhythmLabelText = '';
    this._lastRhythmGrade = null;
    this._lastRhythmDistLabel = '';
    this._rhythmHurdleMode = false;
    this._lastPlayerPx10 = -1;
    this._lastRivalPx10 = -1;
    this._lastGhostPx10 = -1;
    this._rivalVisible = false;
    this._ghostVisible = false;
    this._lastHurdleHintText = '';
    this._lastDeltaStr = '';
    this._lastWindStr = '';
    this._lastGripStr = '';
    this._lastCdStr = '';
    this._lastMobSpeedStr = '';
    this._lastMobRpm = -1;
    this._lastMobStaminaStr = '';
    this._lastMobHurdleStr = '';
    this._lastTouchResetAlert = null;
  }

  consumeStamina(amount) {
    this.stamina = Math.max(0, this.stamina - amount);
  }

  restoreStamina(amount) {
    this.stamina = Math.min(this.maxStamina, this.stamina + amount);
  }

  recordStep(time) {
    this.stepTimestamps.push(time);
    if (this.stepTimestamps.length > 8) {
      this.stepTimestamps.shift();
    }
  }

  update(params) {
    const {
      game,
      dt,
      heldKeys = {},
      steeplechase = null,
      aiState = null,
      ghostState = null,
      weatherMod = { drag: 1, fric: 1, slope: 0 }
    } = params;

    // 1. Cadence calculation (RPM)
    const now = game.elapsed || 0;
    while (this.stepTimestamps.length > 0 && now - this.stepTimestamps[0] > 2.5) {
      this.stepTimestamps.shift();
    }
    let rawRpm = 0;
    if (this.stepTimestamps.length >= 2) {
      const span = this.stepTimestamps[this.stepTimestamps.length - 1] - this.stepTimestamps[0];
      if (span > 0.05) {
        rawRpm = ((this.stepTimestamps.length - 1) / span) * 60;
      }
    }
    this.cadenceRpm += (rawRpm - this.cadenceRpm) * Math.min(1, dt * 5);
    const displayRpm = Math.round(this.cadenceRpm);

    // 2. Speedometer
    const speedKmh = Math.max(0, (game.fallPose ? 0 : game.vx) * 3.6);

    // 3. Stamina & Heart Rate dynamics
    if (this.aeroActive && speedKmh > 1) {
      this.consumeStamina(dt * 18);
      this.heartRate += (175 - this.heartRate) * dt * 0.8;
    } else {
      // Natural stamina recharge when not sprinting
      const recharge = (speedKmh > 2 && speedKmh < 8) ? dt * 10 : dt * 5;
      this.restoreStamina(recharge);
      const targetHr = 80 + (speedKmh / 12) * 80;
      this.heartRate += (targetHr - this.heartRate) * dt * 0.6;
    }

    // 4. Update Left Wing DOM with dirty checking
    if (this.elRpmValue && displayRpm !== this._lastRpm) {
      this.elRpmValue.textContent = displayRpm;
      this._lastRpm = displayRpm;
    }
    if (this.elRpmNeedle) {
      const fraction = Math.min(1, displayRpm / 240);
      const angle = Math.round(-60 + fraction * 120);
      if (angle !== this._lastNeedleAngle) {
        this.elRpmNeedle.style.transform = `rotate(${angle}deg)`;
        this.elRpmNeedle.style.transformOrigin = '60px 60px';
        this._lastNeedleAngle = angle;
      }
    }
    if (this.elRpmGait) {
      this.updateGaitBadge(speedKmh, displayRpm);
    }
    const hrRounded = Math.round(this.heartRate);
    if (this.elHrValue && hrRounded !== this._lastHr) {
      this.elHrValue.textContent = hrRounded;
      this._lastHr = hrRounded;
    }
    if (this.elHrHeart && Math.abs(this.heartRate - this._lastHrAnim) > 4) {
      const beatDur = Math.max(0.3, 60 / this.heartRate);
      this.elHrHeart.style.animationDuration = `${beatDur.toFixed(2)}s`;
      this._lastHrAnim = this.heartRate;
    }
    if (this.elStaminaFill) {
      const pct = Math.round(this.stamina);
      if (pct !== this._lastStaminaPct) {
        this.elStaminaFill.style.width = `${pct}%`;
        if (pct > 50) {
          this.elStaminaFill.style.background = 'linear-gradient(90deg, #10b981, #34d399)';
        } else if (pct > 25) {
          this.elStaminaFill.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
        } else {
          this.elStaminaFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
        }
        if (this.elStaminaText) this.elStaminaText.textContent = `${pct}%`;
        this._lastStaminaPct = pct;
      }
    }
    const speedStr = speedKmh.toFixed(1);
    if (this.elSpeedValue && speedStr !== this._lastSpeedStr) {
      this.elSpeedValue.textContent = speedStr;
      this._lastSpeedStr = speedStr;
    }
    if (this.elSpeedBar) {
      const speedPct = Math.round(Math.min(100, (speedKmh / 12.0) * 100));
      if (speedPct !== this._lastSpeedBarPct) {
        this.elSpeedBar.style.width = `${speedPct}%`;
        this._lastSpeedBarPct = speedPct;
      }
    }

    // 5. Rhythm Perfect Bar vs Steeplechase Approach
    let approach = null;
    if (steeplechase) {
      approach = steeplechase.getApproachInfo(game.x);
    }
    this.updateRhythmBar(approach, game);

    // 6. Right Wing: Steeplechase Radar Map
    this.updateRadarMap(game, steeplechase, aiState, ghostState);

    // 7. Rival Delta
    this.updateRivalDelta(game, aiState, ghostState);

    // 8. Weather & Aero Telemetry
    this.updateWeatherTelemetry(weatherMod);

    // 9. Master Jockey Tips
    this.updateMasterJockeyTips(game, speedKmh, approach, dt);

    // 10. Esports Keyboard Matrix Highlighting
    this.updateKeyboardMatrix(heldKeys, game, approach);

    // 11. Mobile Ticker
    this.updateMobileTicker(speedKmh, displayRpm, approach);

    // 12. Dynamic Mobile Reset / Get-up button
    const isFallen = !!(game.fallPose || game.state === 'fallen');
    if (this.elTouchReset && this._lastTouchResetAlert !== isFallen) {
      this.elTouchReset.classList.toggle('fall-alert', isFallen);
      if (this.elTouchResetIcon) {
        this.elTouchResetIcon.textContent = isFallen ? '⚡' : '🔄';
      }
      if (this.elTouchResetText) {
        this.elTouchResetText.textContent = isFallen
          ? (this.tr('mob_btn_getup') || '起身 (R)')
          : (this.tr('mob_btn_reset') || '重整 (R)');
      }
      this._lastTouchResetAlert = isFallen;
    }
  }

  updateGaitBadge(speedKmh, rpm) {
    let text = this.tr('gait_walk');
    let cls = 'gait-walk';
    if (speedKmh >= 9.2) {
      text = this.tr('gait_fever');
      cls = 'gait-fever';
    } else if (speedKmh >= 6.0) {
      text = this.tr('gait_gallop');
      cls = 'gait-gallop';
    } else if (speedKmh >= 2.5) {
      text = this.tr('gait_trot');
      cls = 'gait-trot';
    } else if (speedKmh < 0.2) {
      text = this.tr('gait_idle');
      cls = 'gait-idle';
    }
    if (cls !== this._lastGaitCls) {
      this.elRpmGait.textContent = text;
      this.elRpmGait.className = `cockpit-badge ${cls}`;
      this._lastGaitCls = cls;
    }
  }
  updateRhythmBar(approach, game) {
    if (!this.elRhythmBar || !this.elRhythmMarker) return;

    if (approach && approach.active) {
      if (!this._rhythmHurdleMode) {
        this.elRhythmBar.classList.add('hurdle-mode');
        this._rhythmHurdleMode = true;
      }
      const cursorPct = Math.min(100, Math.max(0, approach.frac * 100));
      const leftStr = `${cursorPct.toFixed(1)}%`;
      if (leftStr !== this._lastRhythmMarkerLeft) {
        this.elRhythmMarker.style.left = leftStr;
        this._lastRhythmMarkerLeft = leftStr;
      }

      if (approach.inPerfectZone) {
        if (this._lastRhythmGrade !== 'perfect') {
          this.elRhythmMarker.className = 'rhythm-cursor perfect-hit';
          if (this.elRhythmLabel) {
            this.elRhythmLabel.textContent = '★ PERFECT! 按 SPACE 起跳！';
            this.elRhythmLabel.style.color = '#f59e0b';
          }
          this._lastRhythmGrade = 'perfect';
        }
      } else if (approach.inGreatZone) {
        if (this._lastRhythmGrade !== 'great') {
          this.elRhythmMarker.className = 'rhythm-cursor great-hit';
          if (this.elRhythmLabel) {
            this.elRhythmLabel.textContent = '起跳視窗！按 SPACE 躍過！';
            this.elRhythmLabel.style.color = '#10b981';
          }
          this._lastRhythmGrade = 'great';
        }
      } else {
        const label = `距障礙 ${approach.dist.toFixed(1)}m — 準備起跳`;
        if (this._lastRhythmGrade !== 'approach' || this._lastRhythmDistLabel !== label) {
          this.elRhythmMarker.className = 'rhythm-cursor';
          if (this.elRhythmLabel) {
            this.elRhythmLabel.textContent = label;
            this.elRhythmLabel.style.color = '#fff6e8';
          }
          this._lastRhythmGrade = 'approach';
          this._lastRhythmDistLabel = label;
        }
      }
    } else {
      if (this._rhythmHurdleMode) {
        this.elRhythmBar.classList.remove('hurdle-mode');
        this._rhythmHurdleMode = false;
        this._lastRhythmGrade = null;
      }
      const isPairA = game.suggestedPair === 'A';
      const targetLeft = isPairA ? '30%' : '70%';
      if (this._lastRhythmMarkerLeft !== targetLeft) {
        this.elRhythmMarker.style.left = targetLeft;
        this.elRhythmMarker.className = 'rhythm-cursor';
        this._lastRhythmMarkerLeft = targetLeft;
      }
      const text = isPairA ? '對角 A 組 (Q+P) 推進' : '對角 B 組 (W+O) 推進';
      if (this.elRhythmLabel && this._lastRhythmLabelText !== text) {
        this.elRhythmLabel.textContent = text;
        this.elRhythmLabel.style.color = '#fff6e8';
        this._lastRhythmLabelText = text;
      }
    }
  }

  updateRadarMap(game, steeplechase, aiState, ghostState) {
    const trackStartX = 10;
    const trackEndX = 150;
    const totalDist = 50.0;
    const mapX = x => trackStartX + Math.min(1, Math.max(0, x / totalDist)) * (trackEndX - trackStartX);

    if (this.elRadarPlayer) {
      const px = Math.round(mapX(game.x) * 10) / 10;
      if (px !== this._lastPlayerPx10) {
        this.elRadarPlayer.setAttribute('transform', `translate(${px}, 35)`);
        this._lastPlayerPx10 = px;
      }
    }

    if (this.elRadarRival) {
      if (aiState && aiState.S) {
        if (!this._rivalVisible) {
          this.elRadarRival.classList.remove('hidden');
          this._rivalVisible = true;
        }
        const rx = Math.round(mapX(aiState.S.x) * 10) / 10;
        if (rx !== this._lastRivalPx10) {
          this.elRadarRival.setAttribute('cx', rx);
          this._lastRivalPx10 = rx;
        }
      } else if (this._rivalVisible) {
        this.elRadarRival.classList.add('hidden');
        this._rivalVisible = false;
      }
    }

    if (this.elRadarGhost) {
      if (ghostState && ghostState.x != null) {
        if (!this._ghostVisible) {
          this.elRadarGhost.classList.remove('hidden');
          this._ghostVisible = true;
        }
        const gx = Math.round(mapX(ghostState.x) * 10) / 10;
        if (gx !== this._lastGhostPx10) {
          this.elRadarGhost.setAttribute('cx', gx);
          this._lastGhostPx10 = gx;
        }
      } else if (this._ghostVisible) {
        this.elRadarGhost.classList.add('hidden');
        this._ghostVisible = false;
      }
    }

    if (this.elNextHurdleHint && steeplechase) {
      const next = steeplechase.getNextHurdle(game.x);
      const text = next
        ? `下一欄：${next.x}m (剩 ${(next.x - game.x).toFixed(1)}m)`
        : '終點直線衝刺！';
      if (text !== this._lastHurdleHintText) {
        this.elNextHurdleHint.textContent = text;
        this._lastHurdleHintText = text;
      }
    }
  }

  updateRivalDelta(game, aiState, ghostState) {
    if (!this.elDeltaValue || !this.elDeltaBadge) return;

    let deltaSec = null;
    let rivalName = '';

    if (aiState && aiState.S) {
      const diffDist = game.x - aiState.S.x;
      const refSpeed = Math.max(1.5, game.vx);
      deltaSec = diffDist / refSpeed;
      rivalName = aiState.level === 'legend' ? '傳奇' : aiState.level === 'race' ? '賽馬' : '小馬';
    } else if (ghostState && ghostState.t != null && game.elapsed > 0) {
      const diffDist = game.x - (ghostState.x || 0);
      const refSpeed = Math.max(1.5, game.vx);
      deltaSec = diffDist / refSpeed;
      rivalName = '幽靈';
    } else {
      const benchmarkX = (game.elapsed / 32.0) * 50.0;
      const diffDist = game.x - benchmarkX;
      deltaSec = diffDist / 1.56;
      rivalName = '標竿';
    }

    if (deltaSec != null) {
      const absVal = Math.abs(deltaSec).toFixed(2);
      const isLead = deltaSec >= 0;
      const key = `${isLead ? '+' : '-'}${absVal}_${rivalName}`;
      if (key !== this._lastDeltaStr) {
        if (isLead) {
          this.elDeltaBadge.textContent = `領先 ${rivalName}`;
          this.elDeltaBadge.className = 'delta-badge lead';
          this.elDeltaValue.textContent = `+${absVal}s`;
          this.elDeltaValue.style.color = '#10b981';
        } else {
          this.elDeltaBadge.textContent = `落後 ${rivalName}`;
          this.elDeltaBadge.className = 'delta-badge lag';
          this.elDeltaValue.textContent = `-${absVal}s`;
          this.elDeltaValue.style.color = '#f59e0b';
        }
        this._lastDeltaStr = key;
      }
    }
  }

  updateWeatherTelemetry(weatherMod) {
    if (this.elWindText) {
      const drag = weatherMod.drag || 1.0;
      let text = '微風 1.0x';
      let color = '#fff6e8';
      if (drag < 0.9) {
        text = `順風 +${Math.round((1 - drag) * 100)}%`;
        color = '#10b981';
      } else if (drag > 1.1) {
        text = `逆風 -${Math.round((drag - 1) * 100)}%`;
        color = '#ef4444';
      }
      if (text !== this._lastWindStr) {
        this.elWindText.textContent = text;
        this.elWindText.style.color = color;
        this._lastWindStr = text;
      }
    }

    if (this.elGripText) {
      const fric = weatherMod.fric || 1.0;
      let text = `抓地 ${Math.round(fric * 100)}%`;
      let color = '#10b981';
      if (fric < 0.95) {
        text = `濕滑 ${Math.round(fric * 100)}%`;
        color = '#f59e0b';
      }
      if (text !== this._lastGripStr) {
        this.elGripText.textContent = text;
        this.elGripText.style.color = color;
        this._lastGripStr = text;
      }
    }

    if (this.elCdText) {
      const text = this.aeroActive ? 'Cd 0.60x ⚡ 壓身' : 'Cd 1.00x 標準';
      const cls = this.aeroActive ? 'cd-badge active' : 'cd-badge';
      if (text !== this._lastCdStr) {
        this.elCdText.textContent = text;
        this.elCdText.className = cls;
        this._lastCdStr = text;
      }
    }
  }

  updateMasterJockeyTips(game, speedKmh, approach, dt) {
    if (!this.elJockeyTip) return;

    this.tipCooldown -= dt;
    if (this.tipCooldown > 0) return;

    let tip = '';

    if (game.fallPose) {
      tip = '馬匹倒地！冷靜等待身體躺平落地後，按 [R] 或 [Space] 迅速起身！';
    } else if (approach && approach.active && approach.dist < 5.0) {
      tip = '前方障礙高欄！注意倒數視窗，按 [Space] 完美起跳騰空！';
    } else if (Math.abs(game.roll) > 0.24) {
      const dir = game.roll > 0 ? '右' : '左';
      const key = game.roll > 0 ? '←' : '→';
      tip = `馬背向${dir}傾斜！按 [${key}] 調整重心防側翻！`;
    } else if (this.stamina < 20) {
      tip = '體力告急！鬆開 Shift 壓身，依循對角步態穩步回充耐力！';
    } else if (speedKmh > 7.0) {
      tip = '直線大道！按住 [Shift] 壓身破風，突破極速爭奪傳奇！';
    } else {
      tip = '以 Q+P 與 W+O 對角節奏輪替踢地，維持最高推進力！';
    }

    if (tip !== this.currentTipKey) {
      this.currentTipKey = tip;
      this.elJockeyTip.textContent = tip;
      this.tipCooldown = 1.2;
    }
  }

  updateKeyboardMatrix(heldKeys, game, approach) {
    if (!this.keyboardMatrix) return;

    const keys = [
      ['matKeyShift', !!heldKeys.ShiftLeft || !!heldKeys.ShiftRight || this.aeroActive, false],
      ['matKeyQ', !!heldKeys.KeyQ, game.suggestedPair === 'A'],
      ['matKeyW', !!heldKeys.KeyW, game.suggestedPair === 'B'],
      ['matKeyO', !!heldKeys.KeyO, game.suggestedPair === 'B'],
      ['matKeyP', !!heldKeys.KeyP, game.suggestedPair === 'A'],
      ['matKeySpace', !!heldKeys.Space, !!(approach && approach.inPerfectZone)],
      ['matKeyLeft', !!heldKeys.ArrowLeft || !!heldKeys.KeyA, false],
      ['matKeyRight', !!heldKeys.ArrowRight || !!heldKeys.KeyD, false],
      ['matKeyR', !!heldKeys.KeyR, !!game.fallPose],
    ];

    for (let i = 0; i < keys.length; i++) {
      const [id, active, suggest] = keys[i];
      const prev = this.matrixKeyStates[id];
      if (!prev || prev.active !== active || prev.suggest !== suggest) {
        const el = this.matrixKeyEls[id] || (this.matrixKeyEls[id] = document.getElementById(id));
        if (el) {
          el.classList.toggle('active', active);
          el.classList.toggle('suggest', suggest);
        }
        this.matrixKeyStates[id] = { active, suggest };
      }
    }
  }

  updateMobileTicker(speedKmh, rpm, approach) {
    if (!this.elMobSpeed) return;
    const speedStr = speedKmh.toFixed(1);
    if (speedStr !== this._lastMobSpeedStr) {
      this.elMobSpeed.textContent = speedStr;
      this._lastMobSpeedStr = speedStr;
    }
    if (rpm !== this._lastMobRpm) {
      this.elMobRpm.textContent = rpm;
      this._lastMobRpm = rpm;
    }
    const stStr = `${Math.round(this.stamina)}%`;
    if (stStr !== this._lastMobStaminaStr) {
      this.elMobStamina.textContent = stStr;
      this._lastMobStaminaStr = stStr;
    }
    const hText = (approach && approach.hurdle)
      ? `${Math.max(0, approach.dist).toFixed(1)}m`
      : '—';
    if (hText !== this._lastMobHurdleStr) {
      this.elMobHurdle.textContent = hText;
      this._lastMobHurdleStr = hText;
    }
    if (this.elMobHurdleWrap) {
      const isClose = !!(approach && approach.hurdle && approach.dist < 6.0);
      this.elMobHurdleWrap.classList.toggle('hurdle-close', isClose);
    }
  }
}
