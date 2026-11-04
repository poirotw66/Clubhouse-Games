/**
 * High-fidelity Web Audio synthesis & haptic feedback for mechanical slide puzzle.
 * Produces physical wooden/brass sliding friction, gear latch locking snaps,
 * and combo chimes without external audio asset dependencies.
 */

const AudioContextCtor =
  typeof window !== 'undefined'
    ? window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;

let audioCtx: AudioContext | null = null;
let soundEnabled = true;
let hapticsEnabled = true;

const SOUND_PREF_KEY = 'clubhouse:fifteen:sound_enabled';
const HAPTIC_PREF_KEY = 'clubhouse:fifteen:haptic_enabled';

// Load stored preferences if available
if (typeof window !== 'undefined') {
  try {
    const s = localStorage.getItem(SOUND_PREF_KEY);
    if (s !== null) soundEnabled = s === 'true';
    const h = localStorage.getItem(HAPTIC_PREF_KEY);
    if (h !== null) hapticsEnabled = h === 'true';
  } catch {
    /* ignore storage access issues */
  }
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SOUND_PREF_KEY, String(enabled));
    } catch {
      /* ignore */
    }
  }
}

export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(HAPTIC_PREF_KEY, String(enabled));
    } catch {
      /* ignore */
    }
  }
}

function getContext(): AudioContext | null {
  if (!soundEnabled || !AudioContextCtor) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextCtor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Physical wood & brass sliding sound.
 * Plays a quick filtered noise-like friction transient followed by a warm resonance.
 * When `movedCount > 1`, chains rapid mini-clicks representing train domino momentum.
 */
export function playMechanicalSlide(movedCount = 1): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const count = Math.min(4, Math.max(1, movedCount));

  for (let i = 0; i < count; i++) {
    const offset = i * 0.035;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Warm wooden slide resonance with slight pitch glide
    osc.type = 'triangle';
    const startFreq = 220 + (count - i) * 30;
    osc.frequency.setValueAtTime(startFreq, now + offset);
    osc.frequency.exponentialRampToValueAtTime(140, now + offset + 0.05);

    // Friction envelope
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.08, now + offset + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + offset);
    osc.stop(now + offset + 0.07);
  }

  triggerHaptic(count > 1 ? [10, 20, 15] : 10);
}

/**
 * Mechanical gear latch lock sound.
 * Distinctive dual-tone snap: high metallic tick + resonant hollow body tap.
 * Triggered when a tile snaps into its solved home coordinate.
 */
export function playGearLatchLock(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. High brass/steel click transient
  const metallicOsc = ctx.createOscillator();
  const metallicGain = ctx.createGain();
  metallicOsc.type = 'sine';
  metallicOsc.frequency.setValueAtTime(1860, now);
  metallicOsc.frequency.exponentialRampToValueAtTime(840, now + 0.035);

  metallicGain.gain.setValueAtTime(0.12, now);
  metallicGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  metallicOsc.connect(metallicGain);
  metallicGain.connect(ctx.destination);
  metallicOsc.start(now);
  metallicOsc.stop(now + 0.045);

  // 2. Resonant chamber thud (solid wood/metal lock latch)
  const bodyOsc = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  bodyOsc.type = 'triangle';
  bodyOsc.frequency.setValueAtTime(320, now + 0.01);
  bodyOsc.frequency.exponentialRampToValueAtTime(110, now + 0.09);

  bodyGain.gain.setValueAtTime(0, now + 0.01);
  bodyGain.gain.linearRampToValueAtTime(0.1, now + 0.015);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  bodyOsc.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  bodyOsc.start(now + 0.01);
  bodyOsc.stop(now + 0.1);

  triggerHaptic([15, 25, 20]);
}

/**
 * Speed combo chime: pentatonic tone ascending with combo count.
 */
export function playSpeedCombo(comboStep: number): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
  const idx = Math.min(PENTATONIC.length - 1, Math.max(0, comboStep - 1));
  const freq = PENTATONIC[idx];

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.09, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.15);
}

/**
 * Haptic micro-feedback using Web Vibration API.
 */
export function triggerHaptic(pattern: number | number[]): void {
  if (!hapticsEnabled || typeof window === 'undefined') return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore unsupported vibration */
  }
}
