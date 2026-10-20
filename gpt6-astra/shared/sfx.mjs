/**
 * Vendored from shared/synthAudio.ts for static Astra HTML games (no Vite).
 * Keep API surface aligned so Clubhouse games and Astra demos share the same cues.
 */

const AudioContextCtor =
  typeof globalThis !== 'undefined'
    ? globalThis.AudioContext || globalThis.webkitAudioContext
    : undefined;

let audioContext = null;

function getContext() {
  if (!AudioContextCtor) return null;
  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
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

export function playMove() {
  playTone(440, 'sine', 0.06, 0, 0.07);
  playTone(550, 'triangle', 0.05, 0.03, 0.05);
}

export function playCapture() {
  playTone(280, 'square', 0.08, 0, 0.07);
  playTone(420, 'triangle', 0.1, 0.06, 0.06);
}

export function playImpact(strength = 0.5) {
  const s = Math.max(0, Math.min(1, strength));
  playTone(180 + 80 * s, 'square', 0.06 + 0.04 * s, 0, 0.05 + 0.04 * s);
  playTone(320 + 120 * s, 'triangle', 0.1, 0.03, 0.04 + 0.03 * s);
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
