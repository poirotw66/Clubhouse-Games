// Boxing-specific synth tones — same Web Audio approach as @clubhouse/shared/synthAudio.

type ToneType = OscillatorType;

const AudioContextCtor =
  typeof window !== 'undefined'
    ? window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (!AudioContextCtor) return null;
  if (!audioContext) audioContext = new AudioContextCtor();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

function playTone(
  frequency: number,
  type: ToneType,
  duration: number,
  delay = 0,
  volume = 0.08,
): void {
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

/** Glove whoosh during wind-up. */
export function playWhoosh(): void {
  playTone(180, 'triangle', 0.1, 0, 0.04);
  playTone(260, 'sine', 0.08, 0.03, 0.03);
}

/** Impact — strength 0–1 scales pitch punch and volume. */
export function playImpact(strength = 0.5): void {
  const s = Math.max(0, Math.min(1, strength));
  const base = 140 + s * 120;
  playTone(base, 'square', 0.07 + s * 0.05, 0, 0.05 + s * 0.06);
  playTone(base * 1.6, 'triangle', 0.09 + s * 0.04, 0.02, 0.04 + s * 0.04);
  if (s > 0.65) playTone(90, 'sawtooth', 0.12, 0.01, 0.04);
}

export function playBlock(): void {
  playTone(300, 'triangle', 0.05, 0, 0.05);
  playTone(220, 'square', 0.04, 0.02, 0.03);
}

export function playWrongBlock(): void {
  playTone(160, 'sawtooth', 0.08, 0, 0.05);
  playTone(120, 'square', 0.1, 0.04, 0.04);
}

export function playDodge(): void {
  playTone(520, 'sine', 0.05, 0, 0.04);
  playTone(700, 'triangle', 0.06, 0.03, 0.03);
}

export function playStunWarn(): void {
  playTone(440, 'square', 0.06, 0, 0.05);
  playTone(330, 'square', 0.08, 0.06, 0.04);
}
