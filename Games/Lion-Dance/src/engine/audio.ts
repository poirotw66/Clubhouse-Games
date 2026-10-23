/**
 * Temple-fair SFX on top of shared synth helpers.
 * Respects a mute flag remembered via setMuted().
 */

import { playGoal, playImpact, playLose, playWin } from '@clubhouse/shared/synthAudio';

type ToneType = OscillatorType;

const AudioContextCtor =
  typeof window !== 'undefined'
    ? window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(next: boolean): void {
  muted = next;
}

export function isMuted(): boolean {
  return muted;
}

function getCtx(): AudioContext | null {
  if (muted || !AudioContextCtor) return null;
  if (!ctx) ctx = new AudioContextCtor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  frequency: number,
  type: ToneType,
  duration: number,
  delay = 0,
  volume = 0.08,
): void {
  const context = getCtx();
  if (!context) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  osc.connect(gain);
  gain.connect(context.destination);
  const start = context.currentTime + delay;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function noiseBurst(duration: number, delay = 0, volume = 0.05, bandHz = 800): void {
  const context = getCtx();
  if (!context) return;
  const len = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, len, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = context.createBufferSource();
  src.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = bandHz;
  filter.Q.value = 0.8;
  const gain = context.createGain();
  src.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  const start = context.currentTime + delay;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  src.start(start);
  src.stop(start + duration + 0.02);
}

/** Metronome drum from 花花 — steady tempo pulse. */
export function playMetronomeDrum(): void {
  tone(95, 'sine', 0.14, 0, 0.1);
  tone(58, 'triangle', 0.18, 0.01, 0.07);
  noiseBurst(0.05, 0, 0.03, 160);
}

export function playDrum(): void {
  tone(90, 'sine', 0.18, 0, 0.11);
  tone(55, 'triangle', 0.22, 0.01, 0.08);
  noiseBurst(0.06, 0, 0.035, 180);
  if (!muted) playImpact(0.45);
}

export function playDrumTap(): void {
  tone(140, 'sine', 0.07, 0, 0.05);
  tone(200, 'triangle', 0.05, 0.02, 0.03);
}

export function playPerfect(): void {
  tone(660, 'triangle', 0.08, 0, 0.07);
  tone(990, 'sine', 0.1, 0.04, 0.05);
}

export function playGong(): void {
  tone(220, 'sine', 0.9, 0, 0.07);
  tone(330, 'sine', 0.7, 0.02, 0.05);
  tone(440, 'triangle', 0.5, 0.04, 0.035);
}

export function playCymbal(): void {
  noiseBurst(0.35, 0, 0.06, 4200);
  noiseBurst(0.2, 0.02, 0.04, 6500);
  tone(900, 'square', 0.08, 0, 0.02);
}

export function playFirecrackers(): void {
  for (let i = 0; i < 12; i++) {
    const d = i * 0.045;
    noiseBurst(0.05 + Math.random() * 0.05, d, 0.05, 1000 + Math.random() * 3500);
    tone(500 + Math.random() * 900, 'square', 0.04, d, 0.028);
  }
  if (!muted) playGoal();
}

export function playFall(): void {
  if (!muted) playLose();
  tone(160, 'sawtooth', 0.3, 0, 0.05);
  noiseBurst(0.25, 0.05, 0.05, 400);
  tone(120, 'triangle', 0.2, 0.15, 0.04);
}

export function playFinishFanfare(): void {
  playGong();
  playCymbal();
  window.setTimeout(() => playFirecrackers(), 220);
  window.setTimeout(() => playFirecrackers(), 480);
  window.setTimeout(() => {
    if (!muted) playWin();
  }, 550);
}

export function unlockAudio(): void {
  if (muted) return;
  getCtx();
}
