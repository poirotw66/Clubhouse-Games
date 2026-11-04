/**
 * Native Web Audio acoustic physics synthesis for dominoes.
 * Simulates high-density bone / ceramic tile clatter, wooden table impact,
 * boneyard shuffle cascade, and pentatonic All-Fives bell chimes.
 */

const AUDIO_MUTE_KEY = 'clubhouse-dominoes-audio-mute';
const AUDIO_VOL_KEY = 'clubhouse-dominoes-audio-volume';

let audioCtx: AudioContext | null = null;
let isMuted: boolean = false;
let globalVolume: number = 0.85;

// Initialize preferences from localStorage if available
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    const savedMute = localStorage.getItem(AUDIO_MUTE_KEY);
    if (savedMute !== null) isMuted = savedMute === 'true';
    const savedVol = localStorage.getItem(AUDIO_VOL_KEY);
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        globalVolume = parsed;
      }
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function isAcousticsMuted(): boolean {
  return isMuted;
}

export function setAcousticsMuted(muted: boolean): void {
  isMuted = muted;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(AUDIO_MUTE_KEY, String(muted));
    } catch {
      // Ignore
    }
  }
}

export function getAcousticsVolume(): number {
  return globalVolume;
}

export function setAcousticsVolume(vol: number): void {
  globalVolume = Math.max(0, Math.min(1, vol));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(AUDIO_VOL_KEY, String(globalVolume));
    } catch {
      // Ignore
    }
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;

  if (!audioCtx) {
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Synthesizes a physical bone / ceramic tile impact.
 * Features dual resonant bandpass modes (2800 Hz / 1750 Hz) and a micro-rebound bounce.
 */
export function playBoneClatter(opts?: {
  intensity?: number;
  pitchShift?: number;
}): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const intensity = opts?.intensity ?? 1;
  const pitchMult = opts?.pitchShift ?? 1;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(globalVolume * intensity * 0.75, now);
  masterGain.connect(ctx.destination);

  // Function to create a single bone contact click
  const createBoneClick = (time: number, gainScale: number, freqMult = 1) => {
    // 1. Noise burst with high-Q ceramic bandpass
    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const bandpass1 = ctx.createBiquadFilter();
    bandpass1.type = 'bandpass';
    bandpass1.frequency.setValueAtTime(2900 * pitchMult * freqMult, time);
    bandpass1.Q.setValueAtTime(8, time);

    const bandpass2 = ctx.createBiquadFilter();
    bandpass2.type = 'bandpass';
    bandpass2.frequency.setValueAtTime(1750 * pitchMult * freqMult, time);
    bandpass2.Q.setValueAtTime(6, time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(gainScale * 0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

    whiteNoise.connect(bandpass1);
    bandpass1.connect(noiseGain);
    whiteNoise.connect(bandpass2);
    bandpass2.connect(noiseGain);
    noiseGain.connect(masterGain);

    whiteNoise.start(time);
    whiteNoise.stop(time + 0.04);

    // 2. High-frequency bone resonance ping
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3200 * pitchMult * freqMult, time);
    osc.frequency.exponentialRampToValueAtTime(2400 * pitchMult * freqMult, time + 0.03);

    oscGain.gain.setValueAtTime(gainScale * 0.45, time);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    osc.start(time);
    osc.stop(time + 0.035);
  };

  // Primary contact
  createBoneClick(now, 1.0, 1.0);
  // Realistic micro-rebound jitter (18-24ms later)
  const jitter = 0.018 + Math.random() * 0.008;
  createBoneClick(now + jitter, 0.42, 1.06);
}

/**
 * Heavy table slam when setting a double or closing a winning round.
 * Combines a resonant oak table sub-bass thump with a crisp bone snap.
 */
export function playTableSlam(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(globalVolume * 0.9, now);
  masterGain.connect(ctx.destination);

  // 1. Table wooden sub-bass resonance
  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(125, now);
  subOsc.frequency.exponentialRampToValueAtTime(50, now + 0.22);

  subGain.gain.setValueAtTime(0.85, now);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

  subOsc.connect(subGain);
  subGain.connect(masterGain);

  subOsc.start(now);
  subOsc.stop(now + 0.25);

  // 2. Bone clatter snap with high intensity
  playBoneClatter({ intensity: 1.3, pitchShift: 0.95 });
}

/**
 * Cascading boneyard shuffle sound.
 * Plays a rapid staggered flurry of micro-clatters simulating bone tiles tumbling on felt.
 */
export function playBoneyardShuffle(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const count = 7;
  for (let i = 0; i < count; i++) {
    const delay = i * (0.04 + Math.random() * 0.02);
    const pitch = 0.85 + Math.random() * 0.35;
    const vol = 0.35 + Math.random() * 0.45;
    setTimeout(() => {
      playBoneClatter({ intensity: vol, pitchShift: pitch });
    }, Math.floor(delay * 1000));
  }
}

/**
 * Pentatonic bell chime arpeggio for All-Fives scoring.
 * Scales dynamically with the score (5 pts, 10 pts, 15 pts, 20 pts, 25+ pts).
 */
export function playAllFivesArpeggio(score: number): void {
  if (isMuted || score <= 0) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(globalVolume * 0.8, now);
  masterGain.connect(ctx.destination);

  // Musical notes frequencies (Pentatonic Scale): C5, D5, E5, G5, A5, C6, E6
  const scale = [
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.0,  // A5
    1046.5, // C6
    1318.51,// E6
  ];

  let notes: number[];
  if (score <= 5) {
    notes = [scale[0], scale[3]]; // C5 + G5 harmonic pair
  } else if (score <= 10) {
    notes = [scale[0], scale[2], scale[3]]; // C5 -> E5 -> G5
  } else if (score <= 15) {
    notes = [scale[0], scale[2], scale[3], scale[5]]; // C5 -> E5 -> G5 -> C6
  } else if (score <= 20) {
    notes = [scale[0], scale[1], scale[2], scale[3], scale[5]]; // Grand 5-note
  } else {
    notes = [scale[0], scale[2], scale[3], scale[5], scale[6]]; // Full victory cascade
  }

  notes.forEach((freq, idx) => {
    const time = now + idx * 0.075;

    // Acoustic chime additive synthesis (fundamental + non-harmonic chime partials)
    const partials = [
      { mult: 1.0, gain: 0.5 },
      { mult: 2.76, gain: 0.22 },
      { mult: 5.4, gain: 0.12 },
    ];

    partials.forEach(({ mult, gain }) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * mult, time);

      oscGain.gain.setValueAtTime(gain * 0.65, time);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.45);

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start(time);
      osc.stop(time + 0.48);
    });
  });
}

/**
 * Soft tile pickup / UI tap sound.
 */
export function playTileTap(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(3600, now);
  osc.frequency.exponentialRampToValueAtTime(1800, now + 0.015);

  gain.gain.setValueAtTime(globalVolume * 0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.02);
}

/**
 * Pulling / drawing a tile from the boneyard.
 */
export function playBoneDraw(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Short sliding scratch
  const bufferSize = Math.floor(ctx.sampleRate * 0.06);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1400, now);
  filter.frequency.linearRampToValueAtTime(2600, now + 0.05);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(globalVolume * 0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.065);

  // Gentle settling clack
  setTimeout(() => {
    playBoneClatter({ intensity: 0.55, pitchShift: 1.15 });
  }, 45);
}
