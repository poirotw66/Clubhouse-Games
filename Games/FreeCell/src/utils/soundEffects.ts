/**
 * Native Web Audio Physical Sound Engine for FreeCell.
 * Synthesizes physical card glides, tactile snaps, supermove cascades,
 * and crystalline foundation bell chime arpeggios with zero external dependencies.
 */

let audioContext: AudioContext | null = null;
let soundEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) {
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

/**
 * Realistic tactile card glide across velvet felt using bandpass-filtered noise.
 */
export function playCardGlide(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.08);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.07);
    filter.Q.value = 3.0;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.08);
  } catch {
    /* ignore audio synthesis error */
  }
}

/**
 * Tactile percussive card snap upon placement with high transient click and body resonance.
 */
export function playCardSnap(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. High tactile transient click
    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();
    oscClick.type = 'triangle';
    oscClick.frequency.setValueAtTime(1800, now);
    oscClick.frequency.exponentialRampToValueAtTime(220, now + 0.025);

    gainClick.gain.setValueAtTime(0.12, now);
    gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);

    oscClick.start(now);
    oscClick.stop(now + 0.03);

    // 2. Felt/wood body thud
    const oscBody = ctx.createOscillator();
    const gainBody = ctx.createGain();
    oscBody.type = 'sine';
    oscBody.frequency.setValueAtTime(140, now);
    oscBody.frequency.exponentialRampToValueAtTime(55, now + 0.045);

    gainBody.gain.setValueAtTime(0.08, now);
    gainBody.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    oscBody.connect(gainBody);
    gainBody.connect(ctx.destination);

    oscBody.start(now);
    oscBody.stop(now + 0.05);
  } catch {
    /* ignore */
  }
}

/**
 * Supermove cascading glissando multi-tone wave sweep that ripples according to card count.
 */
export function playSupermoveWave(cardCount: number): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const count = Math.min(Math.max(cardCount, 2), 8);
  const now = ctx.currentTime;
  const baseFreq = 392; // G4

  for (let i = 0; i < count; i++) {
    const delay = i * 0.038;
    const freq = baseFreq * Math.pow(1.12, i);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + delay);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.08, now + delay + 0.1);

    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.09, now + delay + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + delay);
    osc.stop(now + delay + 0.13);
  }
}

// Pentatonic crystal bell frequencies based on rank (1 = Ace through 13 = King)
const BELL_SCALE = [
  523.25, // A  (C5)
  587.33, // 2  (D5)
  659.25, // 3  (E5)
  783.99, // 4  (G5)
  880.00, // 5  (A5)
  1046.50, // 6 (C6)
  1174.66, // 7 (D6)
  1318.51, // 8 (E6)
  1567.98, // 9 (G6)
  1760.00, // 10 (A6)
  2093.00, // J  (C7)
  2349.32, // Q  (D7)
  2637.02, // K  (E7)
];

/**
 * Crystalline bell chime arpeggiator with harmonic overtones, tuned to card rank.
 */
export function playFoundationBell(rank: number): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const clampedRank = Math.min(Math.max(rank, 1), 13);
    const fundamental = BELL_SCALE[clampedRank - 1] ?? 523.25;
    const now = ctx.currentTime;

    // Fundamental chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(fundamental, now);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.008);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Minor third bell harmonic (2.76x fundamental)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(fundamental * 2.76, now);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.045, now + 0.005);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.25);

    // High shimmer harmonic (5.4x)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'triangle';
    osc3.frequency.setValueAtTime(fundamental * 5.4, now);

    gain3.gain.setValueAtTime(0, now);
    gain3.gain.linearRampToValueAtTime(0.02, now + 0.004);
    gain3.gain.exponentialRampToValueAtTime(0.0005, now + 0.15);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now);
    osc3.stop(now + 0.18);
  } catch {
    /* ignore */
  }
}

/**
 * Sonar ping pulse tone when safe cards are detected or radar button is clicked.
 */
export function playRadarPulse(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1174.66, now); // D6
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  } catch {
    /* ignore */
  }
}

/**
 * Subtle caution thud for illegal moves or tight-space warnings.
 */
export function playCautionThud(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  } catch {
    /* ignore */
  }
}

/**
 * Reverse tape flutter rewind for undo moves.
 */
export function playUndoSound(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.09);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch {
    /* ignore */
  }
}

/**
 * Triumphant sparkling arpeggio fanfare when completing the game.
 */
export function playVictoryFanfare(): void {
  if (!soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0];
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const delay = idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(0.12, now + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    });
  } catch {
    /* ignore */
  }
}
