/**
 * Dopamine-rich harmonic audio synthesis for Fever Overdrive and tactile card flips.
 * Uses Web Audio API directly with graceful degradation.
 */

const AudioContextCtor =
  typeof window !== 'undefined'
    ? window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (!AudioContextCtor) return null;
  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

/** Pentatonic chord roots tuned for pleasant ascending dopamine cascades. */
const FEVER_NOTES: readonly number[] = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  1174.66,// D6
  1318.51,// E6
];

/** Plays an ascending sparkling chime chord scaled by combo level. */
export function playFeverChord(combo: number): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const noteCount = Math.min(5, Math.max(2, combo + 1));
  const baseOffset = Math.min(3, Math.max(0, combo - 2));

  for (let i = 0; i < noteCount; i++) {
    const noteIndex = Math.min(FEVER_NOTES.length - 1, baseOffset + i);
    const freq = FEVER_NOTES[noteIndex];
    const delay = i * 0.055;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = combo >= 3 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, now + delay);

    // Subtle pitch vibrato for high combos
    if (combo >= 4) {
      osc.frequency.exponentialRampToValueAtTime(freq * 1.015, now + delay + 0.12);
    }

    const peakVolume = Math.min(0.12, 0.05 + combo * 0.015);
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(peakVolume, now + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + delay);
    osc.stop(now + delay + 0.38);
  }
}

/** Plays a snappy tactile card flip audio with subtle air displacement. */
export function playTactileFlip(fast = false): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  const startFreq = fast ? 380 : 320;
  const endFreq = fast ? 680 : 540;

  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.045);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.05, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.07);
}
