/**
 * Vendored Web Audio helpers (from shared/synthAudio.ts) for static Astra HTML.
 * Soft tones — keep volumes low for mindful puzzle feel.
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

/** Soft tap for placing a piece. */
export function playMove() {
  playTone(440, 'sine', 0.06, 0, 0.07);
  playTone(550, 'triangle', 0.05, 0.03, 0.05);
}

/** Disc flip / reverse. */
export function playFlip() {
  playTone(240, 'triangle', 0.07, 0, 0.05);
  playTone(360, 'sine', 0.08, 0.04, 0.06);
  playTone(520, 'triangle', 0.06, 0.09, 0.04);
}

export function playError() {
  playTone(180, 'square', 0.15, 0, 0.05);
}

export function playWin() {
  playTone(523.25, 'triangle', 0.35, 0, 0.1);
  playTone(659.25, 'triangle', 0.35, 0.1, 0.09);
  playTone(783.99, 'triangle', 0.35, 0.2, 0.08);
  playTone(1046.5, 'triangle', 0.55, 0.3, 0.07);
}

export function playSelect() {
  playTone(520, 'triangle', 0.05, 0, 0.06);
}

export function playStar(step = 1) {
  const n = Math.max(1, Math.min(3, Math.floor(step)));
  const base = 523.25 * Math.pow(2, (n - 1) / 12);
  playTone(base, 'triangle', 0.12, 0.05 * (n - 1), 0.08);
}
