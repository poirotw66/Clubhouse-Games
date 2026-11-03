/**
 * Web Audio Fever BGM & dynamic arcade arpeggiator synthesizer for Coin Cascade.
 * Synthesizes a driving 132 BPM arcade casino bassline + sparkling 16th-note
 * arpeggio during Fever Overdrive. Completely procedural, zero external assets.
 */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let bgmTimer: number | null = null;
let currentStep = 0;
let isPlaying = false;
let isMuted = false;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setFeverAudioMuted(muted: boolean): void {
  isMuted = muted;
  if (masterGain && ctx) {
    masterGain.gain.setValueAtTime(muted ? 0 : 0.08, ctx.currentTime);
  }
}

// 16th notes in F minor pentatonic scale (Hz)
const ARPEGGIO_NOTES = [
  349.23, // F4
  415.3, // Ab4
  523.25, // C5
  622.25, // Eb5
  698.46, // F5
  523.25, // C5
  415.3, // Ab4
  622.25, // Eb5
  783.99, // G5
  622.25, // Eb5
  523.25, // C5
  415.3, // Ab4
  698.46, // F5
  523.25, // C5
  415.3, // Ab4
  349.23, // F4
];

// Bass roots (F2, Ab2, C2, Bb2)
const BASS_ROOTS = [87.31, 87.31, 103.83, 103.83, 65.41, 65.41, 116.54, 116.54];

function scheduleStep(c: AudioContext, destination: AudioNode, time: number, stepIndex: number): void {
  // Arpeggio voice (sparkling high synth)
  const arpFreq = ARPEGGIO_NOTES[stepIndex % ARPEGGIO_NOTES.length]!;
  const arpOsc = c.createOscillator();
  arpOsc.type = 'triangle';
  arpOsc.frequency.setValueAtTime(arpFreq, time);

  const arpFilter = c.createBiquadFilter();
  arpFilter.type = 'bandpass';
  arpFilter.frequency.setValueAtTime(arpFreq * 1.5, time);
  arpFilter.Q.setValueAtTime(2.0, time);

  const arpGain = c.createGain();
  arpGain.gain.setValueAtTime(0, time);
  arpGain.gain.linearRampToValueAtTime(0.045, time + 0.005);
  arpGain.gain.exponentialRampToValueAtTime(0.0005, time + 0.09);

  arpOsc.connect(arpFilter);
  arpFilter.connect(arpGain);
  arpGain.connect(destination);

  arpOsc.start(time);
  arpOsc.stop(time + 0.1);

  // Bass beat on every quarter note (step % 4 === 0)
  if (stepIndex % 4 === 0) {
    const bassIdx = Math.floor(stepIndex / 4) % BASS_ROOTS.length;
    const bassFreq = BASS_ROOTS[bassIdx]!;

    const bassOsc = c.createOscillator();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(bassFreq, time);
    bassOsc.frequency.exponentialRampToValueAtTime(bassFreq * 0.95, time + 0.2);

    const bassFilter = c.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(450, time);
    bassFilter.frequency.exponentialRampToValueAtTime(160, time + 0.18);

    const bassGain = c.createGain();
    bassGain.gain.setValueAtTime(0.09, time);
    bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    bassOsc.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(destination);

    bassOsc.start(time);
    bassOsc.stop(time + 0.24);
  }
}

/** Starts the procedural Fever Overdrive BGM synthesizer. */
export function startFeverMusic(): void {
  if (isPlaying) return;
  const c = getContext();
  if (!c) return;

  isPlaying = true;
  currentStep = 0;

  masterGain = c.createGain();
  masterGain.gain.setValueAtTime(0, c.currentTime);
  masterGain.gain.linearRampToValueAtTime(isMuted ? 0 : 0.08, c.currentTime + 0.3);
  masterGain.connect(c.destination);

  const stepDuration = 60 / 132 / 4; // ~0.1136 sec per 16th note
  let nextTime = c.currentTime + 0.05;

  bgmTimer = window.setInterval(() => {
    if (!c || !masterGain || !isPlaying) return;
    const currentTime = c.currentTime;

    // Schedule 150ms ahead
    while (nextTime < currentTime + 0.15) {
      scheduleStep(c, masterGain, nextTime, currentStep);
      nextTime += stepDuration;
      currentStep++;
    }
  }, 50);
}

/** Smoothly stops the Fever Overdrive BGM synthesizer. */
export function stopFeverMusic(): void {
  if (!isPlaying) return;
  isPlaying = false;

  if (bgmTimer !== null) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }

  const c = getContext();
  if (c && masterGain) {
    masterGain.gain.setValueAtTime(masterGain.gain.value, c.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.35);
    setTimeout(() => {
      masterGain?.disconnect();
      masterGain = null;
    }, 400);
  }
}

/** Celebratory fanfare and laser siren when Fever mode activates. */
export function playFeverFanfare(): void {
  const c = getContext();
  if (!c || isMuted) return;

  const when = c.currentTime;

  // Dual rising laser sweeps
  for (const [i, freqStart] of [220, 277.18].entries()) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freqStart, when);
    osc.frequency.exponentialRampToValueAtTime(1400, when + 0.45);

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, when);
    filter.frequency.exponentialRampToValueAtTime(2800, when + 0.45);
    filter.Q.value = 3.5;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.1, when + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.48);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);

    osc.start(when + i * 0.02);
    osc.stop(when + 0.5);
  }

  // Sparkling cascade chimes
  const chimes = [587.33, 739.99, 880.0, 1174.66, 1479.98];
  for (const [i, note] of chimes.entries()) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = note;

    const gain = c.createGain();
    const t = when + 0.2 + i * 0.045;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}
