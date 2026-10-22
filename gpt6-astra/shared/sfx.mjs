/**
 * Vendored Web Audio helpers for Astra static HTML games.
 * Mirrors shared/synthAudio.ts (no TypeScript / bundler required).
 */

const AudioContextCtor =
  typeof globalThis !== 'undefined'
    ? globalThis.AudioContext || globalThis.webkitAudioContext
    : undefined;

let audioContext = null;

function getContext() {
  if (!AudioContextCtor) return null;
  if (!audioContext) audioContext = new AudioContextCtor();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

function playTone(frequency, type, duration, delay = 0, volume = 0.08) {
  const context = getContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  oscillator.connect(gain);
  gain.connect(context.destination);
  const start = context.currentTime + delay;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

export function playScore() {
  playTone(660, 'sine', 0.08, 0, 0.09);
  playTone(880, 'triangle', 0.12, 0.05, 0.07);
}

export function playGoal() {
  playTone(523.25, 'triangle', 0.12, 0, 0.1);
  playTone(659.25, 'triangle', 0.12, 0.08, 0.09);
  playTone(783.99, 'triangle', 0.2, 0.16, 0.08);
}

export function playWin() {
  playTone(523.25, 'triangle', 0.35, 0, 0.1);
  playTone(659.25, 'triangle', 0.35, 0.1, 0.09);
  playTone(783.99, 'triangle', 0.35, 0.2, 0.08);
  playTone(1046.5, 'triangle', 0.55, 0.3, 0.07);
}

export function playLose() {
  playTone(220, 'sawtooth', 0.25, 0, 0.06);
  playTone(165, 'sawtooth', 0.35, 0.12, 0.05);
}

export function playError() {
  playTone(180, 'square', 0.15, 0, 0.05);
}

export function playPaddleHit() {
  playTone(320, 'triangle', 0.06, 0, 0.06);
  playTone(480, 'sine', 0.04, 0.02, 0.04);
}

/** Soft tap for placing a piece / general move. */
export function playMove() {
  playTone(440, 'sine', 0.06, 0, 0.07);
  playTone(550, 'triangle', 0.05, 0.03, 0.05);
}

/** Disc flip / reverse (Fill the Void). */
export function playFlip() {
  playTone(240, 'triangle', 0.07, 0, 0.05);
  playTone(360, 'sine', 0.08, 0.04, 0.06);
  playTone(520, 'triangle', 0.06, 0.09, 0.04);
}

export function playSelect() {
  playTone(520, 'triangle', 0.05, 0, 0.06);
}

export function playStar(step = 1) {
  const n = Math.max(1, Math.min(3, Math.floor(step)));
  const base = 523.25 * Math.pow(2, (n - 1) / 12);
  playTone(base, 'triangle', 0.12, 0.05 * (n - 1), 0.08);
}

export function playCapture() {
  playTone(280, 'square', 0.08, 0, 0.07);
  playTone(420, 'triangle', 0.1, 0.06, 0.06);
}

export function playCombo(step = 1) {
  const n = Math.max(1, Math.min(8, Math.floor(step)));
  const base = 440 * Math.pow(2, (n - 1) / 12);
  playTone(base, 'triangle', 0.09, 0, 0.09);
  playTone(base * 1.5, 'sine', 0.12, 0.04, 0.06);
}

export function playImpact(strength = 0.5) {
  const s = Math.max(0, Math.min(1, strength));
  playTone(180 + 80 * s, 'square', 0.06 + 0.04 * s, 0, 0.05 + 0.04 * s);
  playTone(320 + 120 * s, 'triangle', 0.1, 0.03, 0.04 + 0.03 * s);
}

/** Gunshot click — short noise burst via stacked tones. */
export function playShoot(rateBias = 0) {
  const f = 180 + rateBias * 40;
  playTone(f, 'square', 0.04, 0, 0.05);
  playTone(f * 2.2, 'triangle', 0.05, 0.01, 0.04);
}

/** Distinct headshot sting. */
export function playHeadshot() {
  playTone(780, 'triangle', 0.07, 0, 0.09);
  playTone(1170, 'sine', 0.1, 0.04, 0.07);
  playTone(1560, 'triangle', 0.08, 0.08, 0.05);
}

/** Player took damage. */
export function playHurt() {
  playTone(140, 'sawtooth', 0.12, 0, 0.07);
  playTone(90, 'square', 0.18, 0.05, 0.05);
}

/** Mag reload click. */
export function playReload() {
  playTone(320, 'triangle', 0.06, 0, 0.05);
  playTone(240, 'sine', 0.1, 0.08, 0.06);
  playTone(400, 'triangle', 0.06, 0.18, 0.05);
}

/** New wave sting. */
export function playWave() {
  playTone(392, 'triangle', 0.1, 0, 0.08);
  playTone(523.25, 'triangle', 0.14, 0.08, 0.07);
}

/** Windward helpers — thin wrappers so the game stays readable. */
export function sfxGateClear() {
  playScore();
}

export function sfxCollision() {
  playImpact(0.7);
}

export function sfxFinish(isRecord) {
  if (isRecord) playWin();
  else playGoal();
}

export function sfxFail() {
  playLose();
}

export function sfxUnlock() {
  playWin();
}

export function sfxSelect() {
  playMove();
}

/** ---- Mute + Archer helpers (additive only; do not alter existing tones) ---- */

export const SFX_MUTE_STORAGE_KEY = 'astra-sfx-muted';

let sfxMutedCache = null;

function readMutedFromStorage() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(SFX_MUTE_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function writeMutedToStorage(muted) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SFX_MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch (_) {
    /* ignore quota / private mode */
  }
}

/** Whether shared Astra SFX should stay silent. */
export function isSfxMuted() {
  if (sfxMutedCache === null) sfxMutedCache = readMutedFromStorage();
  return !!sfxMutedCache;
}

/** Persist mute preference (remembered across sessions). */
export function setSfxMuted(muted) {
  sfxMutedCache = !!muted;
  writeMutedToStorage(sfxMutedCache);
  return sfxMutedCache;
}

/** Toggle mute and return the new muted state. */
export function toggleSfxMuted() {
  return setSfxMuted(!isSfxMuted());
}

function ifAudible(fn) {
  if (isSfxMuted()) return;
  fn();
}

/** Stillshot — auto-fire volley. */
export function playArcherShoot() {
  ifAudible(() => playShoot(0));
}

/** Stillshot — arrow hit an enemy. */
export function playArcherHit(critical = false) {
  ifAudible(() => {
    if (critical) playHeadshot();
    else playImpact(0.45);
  });
}

/** Stillshot — picked a level-up ability. */
export function playArcherUpgrade() {
  ifAudible(() => {
    playTone(523.25, 'triangle', 0.1, 0, 0.08);
    playTone(659.25, 'sine', 0.12, 0.06, 0.07);
    playTone(783.99, 'triangle', 0.16, 0.12, 0.06);
  });
}

/** Stillshot — player died. */
export function playArcherDeath() {
  ifAudible(() => playLose());
}

/** Stillshot — room cleared or run victory (`victory` uses the louder arpeggio). */
export function playArcherClear(victory = false) {
  ifAudible(() => {
    if (victory) playWin();
    else playGoal();
  });
}

/** Soft industrial build / place click (Mini Factory). */
export function playBuild() {
  playTone(300, 'triangle', 0.07, 0, 0.06);
  playTone(420, 'sine', 0.08, 0.04, 0.05);
}

/** Research unlock chime — distinct from full win fanfare. */
export function playResearch() {
  playTone(392, 'triangle', 0.1, 0, 0.07);
  playTone(523.25, 'sine', 0.12, 0.08, 0.07);
  playTone(659.25, 'triangle', 0.16, 0.16, 0.06);
}

/** Soft descent / next-floor chime (tactical dungeon). */
export function playDescend() {
  playTone(392, 'triangle', 0.1, 0, 0.07);
  playTone(494, 'sine', 0.12, 0.07, 0.06);
  playTone(587, 'triangle', 0.16, 0.14, 0.05);
}

/** Reward pick confirm. */
export function playReward() {
  playTone(523.25, 'triangle', 0.08, 0, 0.08);
  playTone(659.25, 'sine', 0.1, 0.05, 0.07);
  playTone(784, 'triangle', 0.14, 0.1, 0.06);
}

/** Escape-room: lock opens / door clears. */
export function sfxEscapeUnlock() {
  playTone(392, 'triangle', 0.08, 0, 0.07);
  playTone(523.25, 'triangle', 0.1, 0.06, 0.08);
  playTone(659.25, 'sine', 0.14, 0.12, 0.06);
}

/** Escape-room: item combine craft. */
export function sfxEscapeCombine() {
  playTone(300, 'square', 0.05, 0, 0.05);
  playTone(450, 'triangle', 0.08, 0.05, 0.06);
  playTone(600, 'sine', 0.1, 0.1, 0.05);
}

/** Escape-room: hint used (soft warning ping). */
export function sfxEscapeHint() {
  playTone(480, 'sine', 0.07, 0, 0.05);
  playTone(360, 'triangle', 0.1, 0.06, 0.04);
}

/** Escape-room: room transition. */
export function sfxEscapeRoomEnter() {
  playTone(220, 'triangle', 0.08, 0, 0.05);
  playTone(330, 'sine', 0.1, 0.07, 0.06);
  playTone(440, 'triangle', 0.12, 0.14, 0.05);
}

/** Escape-room: no-hint / daily badge sting (new only — do not alter prior sfx). */
export function sfxEscapeBadge() {
  playTone(520, 'sine', 0.07, 0, 0.05);
  playTone(780, 'triangle', 0.12, 0.06, 0.06);
}

/** Rubik's Cube Academy — soft face-turn click (thin wrapper over playMove). */
export function playCubeTurn() {
  playMove();
}

/** Inspection countdown tick (1 Hz feel). */
export function playInspectTick(secondsLeft = 1) {
  const n = Math.max(0, Math.min(15, Math.floor(Number(secondsLeft) || 0)));
  const pitch = n <= 3 ? 720 : 480;
  playTone(pitch, 'triangle', 0.05, 0, 0.05);
  if (n <= 3) playTone(pitch * 1.25, 'sine', 0.04, 0.03, 0.04);
}

/** Timer / stopwatch start sting. */
export function playTimerStart() {
  playTone(392, 'triangle', 0.08, 0, 0.07);
  playTone(523.25, 'sine', 0.1, 0.05, 0.06);
}

/** Timer stop (pause) click — not a full solve celebration. */
export function playTimerStop() {
  playTone(330, 'triangle', 0.07, 0, 0.06);
  playTone(220, 'sine', 0.1, 0.04, 0.05);
}

/** Successful cube solve. `isRecord` uses the louder win arpeggio. */
export function playSolveComplete(isRecord = false) {
  if (isRecord) playWin();
  else playGoal();
}

/** Cinder Circuit — memory card placed on the road. */
export function playCardPlace() {
  playTone(290, 'triangle', 0.12, 0, 0.07);
  playTone(580, 'sine', 0.16, 0.06, 0.05);
}

/** Cinder Circuit — keeper awakens / bell toll. */
export function playBellAwaken() {
  playTone(155, 'sine', 0.35, 0, 0.08);
  playTone(110, 'triangle', 0.45, 0.12, 0.07);
  playTone(75, 'sine', 0.55, 0.28, 0.05);
}

/** Cinder Circuit — camp craft / building rank-up. */
export function playCraft() {
  playTone(340, 'triangle', 0.08, 0, 0.06);
  playTone(480, 'sine', 0.1, 0.05, 0.06);
  playTone(620, 'triangle', 0.14, 0.12, 0.05);
}

/** Cinder Circuit — elite modifier reveal. */
export function playEliteMod() {
  playTone(200, 'sawtooth', 0.08, 0, 0.05);
  playTone(360, 'triangle', 0.12, 0.06, 0.06);
}

/** Cinder Circuit — event card drawn. */
export function playEventCard() {
  playTone(440, 'sine', 0.08, 0, 0.06);
  playTone(660, 'triangle', 0.12, 0.07, 0.07);
  playTone(880, 'sine', 0.1, 0.14, 0.04);
}

/** Endless Train — chop a tree (hit or fell). Add-only; do not alter helpers above. */
export function playChop() {
  playTone(210, 'triangle', 0.07, 0, 0.06);
  playTone(140, 'square', 0.09, 0.03, 0.045);
  playTone(95, 'sawtooth', 0.06, 0.07, 0.03);
}

/** Endless Train — mine rock. */
export function playMine() {
  playTone(160, 'square', 0.05, 0, 0.055);
  playTone(280, 'triangle', 0.08, 0.03, 0.05);
  playTone(420, 'sine', 0.05, 0.07, 0.035);
}

/** Endless Train — lay a rail segment / finish a bridge. */
export function playLayRail() {
  playTone(380, 'triangle', 0.06, 0, 0.07);
  playTone(520, 'sine', 0.08, 0.04, 0.055);
  playTone(640, 'triangle', 0.07, 0.09, 0.04);
}

/** Endless Train — runway critically low / missing track ahead. */
export function playRailAlert() {
  playTone(520, 'square', 0.1, 0, 0.055);
  playTone(390, 'square', 0.12, 0.1, 0.05);
  playTone(520, 'square', 0.1, 0.22, 0.045);
}

/** Endless Train — eliminated / derailed / boiler failure (出局). */
export function playEliminate() {
  playTone(200, 'sawtooth', 0.18, 0, 0.07);
  playTone(150, 'square', 0.22, 0.1, 0.055);
  playTone(90, 'sawtooth', 0.35, 0.22, 0.05);
}

/** Soft industrial build / place click (Mini Factory). */

