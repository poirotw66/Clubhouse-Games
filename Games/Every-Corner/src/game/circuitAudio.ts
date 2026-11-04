/**
 * Web Audio synthesizer for Every-Corner: Cyber Circuit Overdrive.
 * Generates dynamic pitch-scaled arpeggios, energy discharge glides,
 * dead-end isolation alarms, and full-grid overdrive celebration fanfares.
 */

const AudioContextCtor =
  typeof window !== 'undefined'
    ? window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;

let audioCtx: AudioContext | null = null;
let isMuted = false;
let lastAlarmTime = 0;

const STORAGE_KEY_MUTED = 'clubhouse:every-corner:audio-muted';

// Initialize mute state from localStorage
if (typeof window !== 'undefined') {
  try {
    isMuted = window.localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
  } catch {
    isMuted = false;
  }
}

export function isAudioMuted(): boolean {
  return isMuted;
}

export function setAudioMuted(muted: boolean): void {
  isMuted = muted;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY_MUTED, String(muted));
    } catch {
      // Ignore storage errors
    }
  }
}

function getContext(): AudioContext | null {
  if (isMuted || !AudioContextCtor) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextCtor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

// Cyberpunk scale (A Minor Pentatonic across 2 octaves)
const CYBER_SCALE = [
  220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5,
];

/**
 * Play progressive cyber arpeggio when drawing a path step.
 * Pitch ascends with path progress; sparkles if reaching a checkpoint.
 */
export function playCircuitExtend(step: number, isCheckpoint = false): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const noteIdx = Math.max(0, step - 1) % CYBER_SCALE.length;
  const baseFreq = CYBER_SCALE[noteIdx];

  // Primary tone
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = isCheckpoint ? 'sine' : 'triangle';
  osc1.frequency.setValueAtTime(baseFreq, now);

  gain1.gain.setValueAtTime(0, now);
  gain1.gain.linearRampToValueAtTime(isCheckpoint ? 0.12 : 0.08, now + 0.01);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + (isCheckpoint ? 0.28 : 0.09));

  osc1.connect(gain1);
  gain1.connect(ctx.destination);

  osc1.start(now);
  osc1.stop(now + (isCheckpoint ? 0.3 : 0.1));

  // If energized a checkpoint node, add a sparkling harmonic chime
  if (isCheckpoint) {
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 1.5, now); // Fifth
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + 0.18); // Octave sweep

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.09, now + 0.015);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now);
    osc2.stop(now + 0.28);
  }
}

/**
 * Downward energy discharge glide when stepping back or rewinding.
 */
export function playCircuitRetract(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(480, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.07);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.07, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.09);
}

/**
 * Dissonant warning pulse when a move traps unvisited cells (Dead-End Isolation).
 * Debounced to avoid annoying repeated alarms within 350ms.
 */
export function playOverloadAlarm(): void {
  const nowMs = Date.now();
  if (nowMs - lastAlarmTime < 350) return;
  lastAlarmTime = nowMs;

  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Dissonant minor-second pair (165Hz & 175Hz) with a low sub-buzz
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const gain = ctx.createGain();

  oscA.type = 'sawtooth';
  oscB.type = 'sawtooth';
  oscA.frequency.setValueAtTime(165, now);
  oscB.frequency.setValueAtTime(175, now);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  oscA.connect(gain);
  oscB.connect(gain);
  gain.connect(ctx.destination);

  oscA.start(now);
  oscB.start(now);
  oscA.stop(now + 0.23);
  oscB.stop(now + 0.23);
}

/**
 * Healing stabilization chime when 1-click safe rollback rescues the circuit.
 */
export function playSafeRollback(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const chords = [392.0, 523.25, 659.25]; // C major / calming resolution

  chords.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const delay = idx * 0.03;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + delay);

    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.07, now + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + delay);
    osc.stop(now + delay + 0.26);
  });
}

/**
 * Grand Full Grid Discharge Overdrive celebration fanfare!
 * Plays sub-bass pulse + cascading laser arpeggio + resonant chord burst.
 */
export function playFullGridDischarge(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Sub-bass overload thump
  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(110, now);
  subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.45);

  subGain.gain.setValueAtTime(0, now);
  subGain.gain.linearRampToValueAtTime(0.18, now + 0.02);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  subOsc.connect(subGain);
  subGain.connect(ctx.destination);
  subOsc.start(now);
  subOsc.stop(now + 0.52);

  // 2. Cascading arpeggio sequence
  const fanfareNotes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
  fanfareNotes.forEach((freq, idx) => {
    const delay = 0.06 + idx * 0.055;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + delay);

    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.08, now + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + delay);
    osc.stop(now + delay + 0.38);
  });
}
