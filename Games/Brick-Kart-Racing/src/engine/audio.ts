import {
  playCapture,
  playCard,
  playError,
  playGoal,
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

/** Maps simulation events onto sounds. */
export function playEvent(event: string): void {
  if (muted) return;
  switch (event) {
    case 'go':
      beep(880, 0.35);
      break;
    case 'boost':
    case 'mini-turbo-1':
    case 'mini-turbo-2':
    case 'mini-turbo-3':
      whoosh(0.4, 260, 1100);
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
    case 'lap':
      playGoal();
      break;
    case 'respawn':
      beep(180, 0.2, 'triangle');
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
  if (win) playWin();
  else playLose();
}
