/**
 * Dedicated Reversi Web Audio Synthesizer
 * Provides tactile drop impacts, domino cascade ascending arpeggios,
 * and golden fortress harmonic chimes.
 */

const AudioContextCtor =
  typeof window !== 'undefined'
    ? window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (!AudioContextCtor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContextCtor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  delay = 0,
  volume = 0.08,
): void {
  const ctx = getContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    osc.connect(gain);
    gain.connect(ctx.destination);

    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + duration);

    osc.start(start);
    osc.stop(start + duration + 0.04);
  } catch {
    // Audio playback error safety fallback
  }
}

/**
 * Tactile Drop Impact: realistic physical piece landing sound.
 * Combines low-end wood/felt thump with a crisp ceramic contact click.
 */
export function playTactileDrop(isCorner = false): void {
  // Low thump
  playTone(isCorner ? 95 : 120, 'sine', 0.09, 0, isCorner ? 0.12 : 0.07);
  // High ceramic click
  playTone(isCorner ? 980 : 840, 'triangle', 0.04, 0.002, 0.06);
}

// Pentatonic intervals for cascading wave flip notes
const PENTATONIC_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

/**
 * Cascade Wave Note: each flipped disc in a domino cascade triggers an
 * ascending pitch along the musical scale, creating a satisfying wave feel.
 */
export function playCascadeNote(stepIndex: number, _totalSteps = 1): void {
  const clampedIndex = Math.min(stepIndex, PENTATONIC_SCALE.length - 1);
  const semitones = PENTATONIC_SCALE[clampedIndex];
  // Base frequency: C4 (261.63 Hz)
  const freq = 261.63 * Math.pow(2, semitones / 12);
  const vol = Math.min(0.09, 0.05 + stepIndex * 0.005);
  playTone(freq, 'triangle', 0.14, 0, vol);
  playTone(freq * 1.5, 'sine', 0.08, 0.01, vol * 0.5);
}

/**
 * Golden Fortress Chime: resonant polyphonic shimmer when a corner is claimed.
 */
export function playGoldenFortressChime(): void {
  const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  chord.forEach((freq, idx) => {
    playTone(freq, 'triangle', 0.45, idx * 0.045, 0.08);
    playTone(freq * 2, 'sine', 0.35, idx * 0.045 + 0.02, 0.03);
  });
}

/**
 * High combo fanfare (4+ flips in a single turn).
 */
export function playCascadeComboFanfare(comboCount: number): void {
  const baseFreq = comboCount >= 7 ? 659.25 : 523.25;
  playTone(baseFreq, 'triangle', 0.18, 0, 0.08);
  playTone(baseFreq * 1.25, 'triangle', 0.18, 0.07, 0.08);
  playTone(baseFreq * 1.5, 'triangle', 0.28, 0.14, 0.09);
}
