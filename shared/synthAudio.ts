type ToneType = OscillatorType;

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

function playTone(
  frequency: number,
  type: ToneType,
  duration: number,
  delay = 0,
  volume = 0.08
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

export function playScore(): void {
  playTone(660, 'sine', 0.08, 0, 0.09);
  playTone(880, 'triangle', 0.12, 0.05, 0.07);
}

export function playGoal(): void {
  playTone(523.25, 'triangle', 0.12, 0, 0.1);
  playTone(659.25, 'triangle', 0.12, 0.08, 0.09);
  playTone(783.99, 'triangle', 0.2, 0.16, 0.08);
}

export function playWin(): void {
  playTone(523.25, 'triangle', 0.35, 0, 0.1);
  playTone(659.25, 'triangle', 0.35, 0.1, 0.09);
  playTone(783.99, 'triangle', 0.35, 0.2, 0.08);
  playTone(1046.5, 'triangle', 0.55, 0.3, 0.07);
}

export function playLose(): void {
  playTone(220, 'sawtooth', 0.25, 0, 0.06);
  playTone(165, 'sawtooth', 0.35, 0.12, 0.05);
}

export function playError(): void {
  playTone(180, 'square', 0.15, 0, 0.05);
}

export function playPaddleHit(): void {
  playTone(320, 'triangle', 0.06, 0, 0.06);
  playTone(480, 'sine', 0.04, 0.02, 0.04);
}

/** Soft tap for placing a piece or tile on the board. */
export function playMove(): void {
  playTone(440, 'sine', 0.06, 0, 0.07);
  playTone(550, 'triangle', 0.05, 0.03, 0.05);
}

/** Card slap / play from hand. */
export function playCard(): void {
  playTone(520, 'triangle', 0.05, 0, 0.08);
  playTone(780, 'sine', 0.07, 0.04, 0.06);
}

/** Jump capture in checkers or similar. */
export function playCapture(): void {
  playTone(280, 'square', 0.08, 0, 0.07);
  playTone(420, 'triangle', 0.1, 0.06, 0.06);
}
