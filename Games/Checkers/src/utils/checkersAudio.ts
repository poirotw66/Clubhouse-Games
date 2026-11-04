/**
 * Checkers luxury audio engine utilizing the Web Audio API.
 * Provides authentic acoustic hardwood impacts, multi-hop shatter strikes,
 * regal coronation fanfare, and tactical sonar alerts.
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
    audioCtx = new AudioContextCtor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Realistic acoustic hardwood clack.
 * Simulates the deep, warm resonance of a heavy turned-wood draughts piece
 * impacting a solid oak checkerboard.
 */
export function playHardwoodClack(intensity = 1.0, hopCount = 1): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const clampedIntensity = Math.max(0.3, Math.min(2.0, intensity));

  // Primary body resonance: hollow wood thud
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  // Low-mid resonance frequency slightly shifts higher on successive hops
  const baseFreq = 340 + Math.min(hopCount - 1, 4) * 45;
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(baseFreq, now);
  osc1.frequency.exponentialRampToValueAtTime(120, now + 0.07);

  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
  osc2.frequency.exponentialRampToValueAtTime(180, now + 0.05);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(baseFreq * 1.2, now);
  filter.Q.setValueAtTime(2.8, now);

  const vol = 0.14 * clampedIntensity;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.09);
  osc2.stop(now + 0.09);
}

/**
 * Explosive piece shatter / flyover strike impact.
 * Triggered when jumping and knocking an enemy piece out of the board.
 * Pitch ascends with combo count so multi-hops sound increasingly triumphant!
 */
export function playShatterStrike(comboStep = 1): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const step = Math.max(1, Math.min(6, comboStep));

  // Ascending harmonic strike pitch: 360Hz -> 480Hz -> 640Hz -> 850Hz -> 1100Hz
  const strikeFreq = 360 * Math.pow(1.24, step - 1);

  // 1. Transient sharp crack (triangle + fast pitch drop)
  const crackOsc = ctx.createOscillator();
  const crackGain = ctx.createGain();
  crackOsc.type = 'sawtooth';
  crackOsc.frequency.setValueAtTime(strikeFreq * 2.2, now);
  crackOsc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

  const crackFilter = ctx.createBiquadFilter();
  crackFilter.type = 'lowpass';
  crackFilter.frequency.setValueAtTime(2200, now);

  crackGain.gain.setValueAtTime(0, now);
  crackGain.gain.linearRampToValueAtTime(0.12, now + 0.004);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  crackOsc.connect(crackFilter);
  crackFilter.connect(crackGain);
  crackGain.connect(ctx.destination);

  crackOsc.start(now);
  crackOsc.stop(now + 0.13);

  // 2. High-energy combo bell ring (pure tone singing out with the combo)
  const bellOsc = ctx.createOscillator();
  const bellGain = ctx.createGain();
  bellOsc.type = 'triangle';
  bellOsc.frequency.setValueAtTime(strikeFreq, now + 0.02);

  bellGain.gain.setValueAtTime(0, now + 0.02);
  bellGain.gain.linearRampToValueAtTime(0.1, now + 0.03);
  bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28 + step * 0.04);

  bellOsc.connect(bellGain);
  bellGain.connect(ctx.destination);

  bellOsc.start(now + 0.02);
  bellOsc.stop(now + 0.35 + step * 0.04);
}

/**
 * Golden Coronation Fanfare.
 * Triumphant brass & golden cathedral bells chord (C5 - E5 - G5 - C6)
 * celebrating the crowning of a King piece!
 */
export function playCoronationFanfare(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Majestic C-Major 9th chord sequence
  const notes = [
    { freq: 523.25, time: 0.0, dur: 0.7, vol: 0.11 }, // C5
    { freq: 659.25, time: 0.08, dur: 0.7, vol: 0.1 }, // E5
    { freq: 783.99, time: 0.16, dur: 0.75, vol: 0.11 }, // G5
    { freq: 1046.5, time: 0.24, dur: 0.9, vol: 0.14 }, // C6
    { freq: 1318.51, time: 0.32, dur: 1.0, vol: 0.09 }, // E6 golden overtone
  ];

  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(n.freq, now + n.time);

    // Warm vibrato effect on the high royal crown notes
    if (n.freq >= 1000) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(5.5, now + n.time);
      lfoGain.gain.setValueAtTime(6, now + n.time);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now + n.time);
      lfo.stop(now + n.time + n.dur);
    }

    gain.gain.setValueAtTime(0, now + n.time);
    gain.gain.linearRampToValueAtTime(n.vol, now + n.time + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + n.time);
    osc.stop(now + n.time + n.dur + 0.05);
  }
}

/**
 * Tactical Threat Sonar Ping.
 * Emits an ominous low-frequency warning chime when opponent holds a multi-hop lethal line.
 */
export function playThreatSonar(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.35);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.07, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.38);
}

/**
 * Soft turned-wood tap when touching or selecting a piece.
 */
export function playTactileClick(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(750, now);
  osc.frequency.exponentialRampToValueAtTime(320, now + 0.03);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.06, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}
