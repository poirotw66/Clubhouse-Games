/**
 * Procedural Web Audio synthesizer for Baseball-Life.
 * Provides authentic tactile audio: bat crack, mitt catch, biometric heartbeat,
 * draft gavel, camera flashes, and stadium crowd swells without external assets.
 */

const AUDIO_STORAGE_KEY = 'clubhouse:baseball-life:sound-muted';

const AudioContextCtor =
  typeof window !== 'undefined'
    ? window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;

let audioContext: AudioContext | null = null;
let isMutedState = false;

// Initialize mute state from localStorage
if (typeof window !== 'undefined') {
  try {
    isMutedState = window.localStorage.getItem(AUDIO_STORAGE_KEY) === 'true';
  } catch {
    isMutedState = false;
  }
}

export function isAudioMuted(): boolean {
  return isMutedState;
}

export function setAudioMuted(muted: boolean): void {
  isMutedState = muted;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(AUDIO_STORAGE_KEY, String(muted));
    } catch {
      // Storage unavailable
    }
  }
}

export function toggleAudioMuted(): boolean {
  const next = !isMutedState;
  setAudioMuted(next);
  return next;
}

function getContext(): AudioContext | null {
  if (isMutedState || !AudioContextCtor) return null;
  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

/**
 * Visceral dual-pulse heart beat ("lub-dub").
 * Frequency and intensity dynamically scale with BPM.
 */
export function playHeartbeat(bpm: number = 100): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const interval = 60 / Math.max(60, Math.min(180, bpm));
  const secondBeatDelay = Math.min(0.24, interval * 0.32);

  // First beat: Lub (slightly lower, deeper)
  triggerHeartThud(ctx, now, 68, 0.16, 0.14);
  // Second beat: Dub (slightly sharper, punchier)
  triggerHeartThud(ctx, now + secondBeatDelay, 82, 0.14, 0.12);
}

function triggerHeartThud(
  ctx: AudioContext,
  time: number,
  baseFreq: number,
  duration: number,
  vol: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq * 1.4, time);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, time + duration);

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(vol, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(time);
  osc.stop(time + duration + 0.02);
}

/**
 * Explosive sweet-spot wooden bat crack ("鏘！/ 啪！").
 */
export function playBatCrack(quality: 'sweet' | 'solid' | 'bunt' = 'sweet'): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = quality === 'sweet' ? 0.22 : quality === 'solid' ? 0.15 : 0.08;

  // 1. High transient sharp crack (bandpass noise burst)
  const bufferSize = Math.floor(ctx.sampleRate * 0.06);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = quality === 'sweet' ? 2400 : 1600;
  filter.Q.value = 3.5;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 1.5, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);

  // 2. Resonant maple/ash wood body tone
  const woodOsc = ctx.createOscillator();
  const woodGain = ctx.createGain();
  woodOsc.type = 'triangle';
  woodOsc.frequency.setValueAtTime(quality === 'sweet' ? 880 : 620, now);
  woodOsc.frequency.exponentialRampToValueAtTime(260, now + 0.14);

  woodGain.gain.setValueAtTime(vol, now);
  woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  woodOsc.connect(woodGain);
  woodGain.connect(ctx.destination);

  woodOsc.start(now);
  woodOsc.stop(now + 0.15);
}

/**
 * Tight leather catcher's mitt pop ("碰！").
 */
export function playMittCatch(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.09);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.1);
}

/**
 * Stadium crowd cheer surge.
 */
export function playStadiumRoar(duration = 0.8): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(350, now);
  filter.frequency.linearRampToValueAtTime(1100, now + duration * 0.35);
  filter.frequency.exponentialRampToValueAtTime(250, now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.12, now + duration * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration + 0.02);
}

export const playCrowdCheer = playStadiumRoar;

/**
 * Draft gavel strike on wooden podium for draft announcements.
 */
export function playDraftGavel(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Sharp strike
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(95, now + 0.18);

  gain.gain.setValueAtTime(0.24, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);

  // Table echo
  const echoOsc = ctx.createOscillator();
  const echoGain = ctx.createGain();
  echoOsc.type = 'sine';
  echoOsc.frequency.setValueAtTime(160, now + 0.02);
  echoOsc.frequency.exponentialRampToValueAtTime(60, now + 0.26);

  echoGain.gain.setValueAtTime(0.001, now);
  echoGain.gain.linearRampToValueAtTime(0.14, now + 0.03);
  echoGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

  echoOsc.connect(echoGain);
  echoGain.connect(ctx.destination);
  echoOsc.start(now + 0.02);
  echoOsc.stop(now + 0.28);
}

/**
 * Camera flash motor drive clicks ("喀擦！喀擦！") for draft pick or milestones.
 */
export function playCameraShutter(): void {
  const ctx = getContext();
  if (!ctx) return;

  const times = [0, 0.11, 0.22];
  times.forEach((t) => {
    const clickTime = ctx.currentTime + t;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1600, clickTime);
    osc.frequency.exponentialRampToValueAtTime(300, clickTime + 0.04);

    gain.gain.setValueAtTime(0.08, clickTime);
    gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(clickTime);
    osc.stop(clickTime + 0.05);
  });
}

/**
 * Ethereal celestial shimmer for pouring Destiny (天命).
 */
export function playDestinySurge(): void {
  const ctx = getContext();
  if (!ctx) return;

  const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
  notes.forEach((freq, idx) => {
    const start = ctx.currentTime + idx * 0.04;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.07, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });
}
