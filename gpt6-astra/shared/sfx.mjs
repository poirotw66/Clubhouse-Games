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
