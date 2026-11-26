import {
  playCapture,
  playCard,
  playError,
  playGoal,
  playImpact,
  playLose,
  playMove,
  playPaddleHit,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';

let ctx: AudioContext | null = null;
let engineGain: GainNode | null = null;
let engineOsc: OscillatorNode | null = null;
let engineSub: OscillatorNode | null = null;
let screechGain: GainNode | null = null;
let screechFilter: BiquadFilterNode | null = null;
let screechNoise: AudioBufferSourceNode | null = null;
let screechOsc: OscillatorNode | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean): void {
  muted = value;
  if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  if (screechGain && ctx) screechGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}

export function isMuted(): boolean {
  return muted;
}

export function startEngine(): void {
  const c = ac();
  if (!c || engineOsc) return;

  engineGain = c.createGain();
  engineGain.gain.value = 0;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  engineGain.connect(filter);
  filter.connect(c.destination);

  engineOsc = c.createOscillator();
  engineOsc.type = 'sawtooth';
  engineOsc.frequency.value = 70;

  engineSub = c.createOscillator();
  engineSub.type = 'square';
  engineSub.frequency.value = 35;

  const subGain = c.createGain();
  subGain.gain.value = 0.35;
  engineSub.connect(subGain);
  subGain.connect(engineGain);
  engineOsc.connect(engineGain);

  engineOsc.start();
  engineSub.start();
}

export function stopEngine(): void {
  if (engineOsc) {
    try {
      engineOsc.stop();
      engineSub?.stop();
    } catch {
      /* already stopped */
    }
  }
  engineOsc = null;
  engineSub = null;
  engineGain = null;
  stopDriftScreech();
}

function createScreechBuffer(c: AudioContext): AudioBuffer {
  const sampleRate = c.sampleRate || 44100;
  const length = Math.floor(sampleRate * 0.8);
  const buffer = c.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    const pink = b0 + b1 + b2 + white * 0.5362;
    data[i] = pink * 0.14;
  }
  return buffer;
}

export function startDriftScreech(): void {
  const c = ac();
  if (!c || screechGain) return;

  screechGain = c.createGain();
  screechGain.gain.setValueAtTime(0, c.currentTime);

  screechFilter = c.createBiquadFilter();
  screechFilter.type = 'bandpass';
  screechFilter.frequency.setValueAtTime(1600, c.currentTime);
  screechFilter.Q.setValueAtTime(3.2, c.currentTime);

  screechNoise = c.createBufferSource();
  screechNoise.buffer = createScreechBuffer(c);
  screechNoise.loop = true;

  screechOsc = c.createOscillator();
  screechOsc.type = 'sawtooth';
  screechOsc.frequency.setValueAtTime(740, c.currentTime);

  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.22, c.currentTime);

  screechNoise.connect(screechFilter);
  screechOsc.connect(oscGain);
  oscGain.connect(screechFilter);
  screechFilter.connect(screechGain);
  screechGain.connect(c.destination);

  try {
    screechNoise.start();
    screechOsc.start();
  } catch {
    /* ignore */
  }
}

export function stopDriftScreech(): void {
  if (screechGain && ctx) {
    screechGain.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
  }
  if (screechNoise) {
    try {
      screechNoise.stop();
      screechOsc?.stop();
    } catch {
      /* already stopped */
    }
  }
  screechNoise = null;
  screechOsc = null;
  screechFilter = null;
  screechGain = null;
}

/** Updates asphalt tire screech friction audio while charging a drift. */
export function updateDriftScreech(active: boolean, charge = 0): void {
  const c = ac();
  if (!c) return;
  if (!active || muted) {
    if (screechGain) {
      screechGain.gain.setTargetAtTime(0, c.currentTime, 0.04);
    }
    return;
  }
  if (!screechGain) {
    startDriftScreech();
  }
  if (screechGain && screechFilter && screechOsc) {
    const t = c.currentTime;
    // Screech intensity scales with charge
    const targetGain = 0.06 + Math.min(charge, 3.0) * 0.025;
    screechGain.gain.setTargetAtTime(targetGain, t, 0.05);

    // Filter frequency rises as centrifugal tension escalates (1600Hz -> 2600Hz)
    const targetFreq = 1600 + Math.min(charge / 3.0, 1.0) * 1000;
    screechFilter.frequency.setTargetAtTime(targetFreq, t, 0.06);

    // Subtle oscillator pitch ramp (740Hz -> 920Hz)
    const targetPitch = 740 + Math.min(charge / 3.0, 1.0) * 180;
    screechOsc.frequency.setTargetAtTime(targetPitch, t, 0.06);
  }
}

/** `throttle` is 0..1 of top speed; `boost` raises the pitch further. */
export function updateEngine(throttle: number, boost: boolean): void {
  if (!ctx || !engineGain || !engineOsc || !engineSub) return;
  const t = ctx.currentTime;
  const target = muted ? 0 : 0.05 + throttle * 0.05;
  engineGain.gain.setTargetAtTime(target, t, 0.08);
  const base = 62 + throttle * 130 + (boost ? 55 : 0);
  engineOsc.frequency.setTargetAtTime(base, t, 0.06);
  engineSub.frequency.setTargetAtTime(base / 2, t, 0.06);
}

function whoosh(duration = 0.35, startFreq = 320, endFreq = 900): void {
  const c = ac();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(startFreq, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + duration);
  gain.gain.setValueAtTime(0.14, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

function beep(freq: number, duration = 0.12, type: OscillatorType = 'square'): void {
  const c = ac();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.12, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

/** Plays spark ignition chime when drift charge reaches tier 1, 2, or 3. */
export function playDriftSpark(tier: number): void {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();

  // Tier 1 (blue sparks): 587Hz -> 784Hz (D5 -> G5)
  // Tier 2 (orange sparks): 784Hz -> 1046Hz (G5 -> C6)
  // Tier 3 (purple sparks): 1046Hz -> 1568Hz (C6 -> G6)
  const [fStart, fEnd] =
    tier === 1 ? [587, 784] : tier === 2 ? [784, 1046] : [1046, 1568];

  const duration = tier === 3 ? 0.22 : 0.16;
  osc.type = tier === 3 ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(fStart, t);
  osc.frequency.exponentialRampToValueAtTime(fEnd, t + duration);

  gain.gain.setValueAtTime(0.14, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t);
  osc.stop(t + duration);
}

/** Plays distinct tiered audio for Mini-Turbo 1 (blue), 2 (orange), and 3 (purple). */
export function playMiniTurbo(tier: number): void {
  const c = ac();
  if (!c || muted) return;
  const t = c.currentTime;

  if (tier === 1) {
    // Mini-Turbo 1 (Blue sparks): snappy brisk ascending turbo burst
    const duration = 0.32;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(960, t + duration);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + duration);

    beep(880, 0.14, 'triangle');
  } else if (tier === 2) {
    // Mini-Turbo 2 (Orange sparks): dual-wave throatier resonant boost
    const duration = 0.44;
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const gain = c.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(260, t);
    osc1.frequency.exponentialRampToValueAtTime(1320, t + duration);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(130, t);
    osc2.frequency.exponentialRampToValueAtTime(660, t + duration);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(c.destination);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);

    setTimeout(() => beep(1046, 0.16, 'sine'), 50);
  } else {
    // Mini-Turbo 3 (Purple sparks / boost): Ultra Mini-Turbo supersonic surge
    const duration = 0.58;
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const bass = c.createOscillator();
    const gain = c.createGain();
    const bassGain = c.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(190, t);
    osc1.frequency.exponentialRampToValueAtTime(1880, t + duration);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(380, t);
    osc2.frequency.exponentialRampToValueAtTime(2200, t + duration);

    bass.type = 'sine';
    bass.frequency.setValueAtTime(110, t);
    bass.frequency.exponentialRampToValueAtTime(45, t + 0.25);

    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    bassGain.gain.setValueAtTime(0.25, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(c.destination);

    bass.connect(bassGain);
    bassGain.connect(c.destination);

    osc1.start(t);
    osc2.start(t);
    bass.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
    bass.stop(t + 0.25);

    setTimeout(() => beep(1318, 0.15, 'sine'), 80);
    setTimeout(() => beep(1760, 0.22, 'sine'), 160);
  }
}

export function playHomingChirp(): void {
  if (muted) return;
  beep(1400, 0.05, 'square');
  setTimeout(() => beep(1850, 0.07, 'sine'), 50);
}

/** Maps simulation events onto sounds. */
export function playEvent(event: string): void {
  if (muted) return;
  switch (event) {
    case 'homing-warning':
      playHomingChirp();
      break;
    case 'go':
      beep(880, 0.35);
      break;
    case 'boost':
      whoosh(0.4, 260, 1100);
      break;
    case 'mini-turbo-1':
      playMiniTurbo(1);
      break;
    case 'mini-turbo-2':
      playMiniTurbo(2);
      break;
    case 'mini-turbo-3':
      playMiniTurbo(3);
      break;
    case 'drift-tier-1':
      playDriftSpark(1);
      break;
    case 'drift-tier-2':
      playDriftSpark(2);
      break;
    case 'drift-tier-3':
      playDriftSpark(3);
      break;
    case 'item-get':
      playCard();
      break;
    case 'fire':
      whoosh(0.3, 700, 220);
      break;
    case 'drop':
      playMove();
      break;
    case 'player-hit':
      playError();
      break;
    case 'player-slip':
      whoosh(0.5, 500, 140);
      break;
    case 'shield-up':
      playScore();
      break;
    case 'shield-block':
      playCapture();
      break;
    case 'bump':
      playPaddleHit();
      break;
    case 'heavy-bump':
    case 'wall-collision':
      playImpact(0.85);
      break;
    case 'lap':
      playGoal();
      break;
    case 'respawn':
      beep(180, 0.2, 'triangle');
      break;
    case 'slipstream':
      whoosh(0.22, 180, 520);
      break;
    case 'cup-unlock':
      playScore();
      playGoal();
      break;
    default:
      break;
  }
}

export function playCountdownTick(): void {
  beep(520, 0.16);
}

export function playFinish(win: boolean): void {
  if (muted) return;
  if (win) {
    playWin();
    setTimeout(() => beep(523.25, 0.16, 'triangle'), 100);
    setTimeout(() => beep(659.25, 0.16, 'triangle'), 220);
    setTimeout(() => beep(783.99, 0.3, 'triangle'), 340);
  } else {
    playLose();
  }
}
