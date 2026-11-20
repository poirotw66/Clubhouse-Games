import { playCard, playMove } from '@clubhouse/shared/synthAudio';

/** Suspense pause duration in milliseconds for dealer hole card peek/reveal. */
export const SUSPENSE_PAUSE_MS = 250;

/** Determines how many layered clinks to play based on chip denomination. */
export function getChipStackCount(amount?: number): number {
  if (amount == null || amount < 25) return 1;
  if (amount < 100) return 2;
  if (amount < 500) return 3;
  return 4;
}

let audioCtx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) {
    return noiseBuffer;
  }
  const length = Math.floor(ctx.sampleRate * 0.04); // 40ms noise burst
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuffer = buffer;
  return buffer;
}

/**
 * Synthesizes a weighted casino clay chip clink:
 * - Crisp ceramic attack (1800Hz - 2400Hz, instant attack, quick decay)
 * - Dampened ceramic body resonance (~600Hz, dampened decay)
 * - Subtle bandpassed noise transient
 */
function playClayClink(
  ctx: AudioContext,
  when: number,
  pitchScale = 1.0,
  volume = 0.12,
): void {
  const primaryFreq = (2050 + (Math.random() - 0.5) * 350) * pitchScale; // 1875Hz - 2225Hz
  const resonanceFreq = (600 + (Math.random() - 0.5) * 50) * pitchScale; // 575Hz - 625Hz

  // 1. Crisp ceramic click attack
  const clickOsc = ctx.createOscillator();
  const clickGain = ctx.createGain();
  clickOsc.type = 'triangle';
  clickOsc.frequency.setValueAtTime(primaryFreq, when);
  clickOsc.frequency.exponentialRampToValueAtTime(primaryFreq * 0.75, when + 0.016);

  clickGain.gain.setValueAtTime(0, when);
  clickGain.gain.linearRampToValueAtTime(volume * 0.85, when + 0.001);
  clickGain.gain.exponentialRampToValueAtTime(0.0005, when + 0.022);

  clickOsc.connect(clickGain);
  clickGain.connect(ctx.destination);
  clickOsc.start(when);
  clickOsc.stop(when + 0.026);

  // 2. Dampened body resonance (ceramic/clay heft at ~600Hz)
  const bodyOsc = ctx.createOscillator();
  const bodyGain = ctx.createGain();
  bodyOsc.type = 'sine';
  bodyOsc.frequency.setValueAtTime(resonanceFreq, when);
  bodyOsc.frequency.exponentialRampToValueAtTime(resonanceFreq * 0.9, when + 0.045);

  bodyGain.gain.setValueAtTime(0, when);
  bodyGain.gain.linearRampToValueAtTime(volume * 0.75, when + 0.002);
  bodyGain.gain.exponentialRampToValueAtTime(0.0005, when + 0.05);

  bodyOsc.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  bodyOsc.start(when);
  bodyOsc.stop(when + 0.055);

  // 3. Subtle noise transient (surface texture)
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = getNoiseBuffer(ctx);

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(2100 * pitchScale, when);
  noiseFilter.Q.setValueAtTime(2.2, when);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, when);
  noiseGain.gain.linearRampToValueAtTime(volume * 0.3, when + 0.001);
  noiseGain.gain.exponentialRampToValueAtTime(0.0005, when + 0.015);

  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSource.start(when);
  noiseSource.stop(when + 0.018);
}

/**
 * Chip stack / bet chip.
 * When betting higher chips ($25, $100, $500), layers multiple stacked clinks.
 */
export function playChip(amount?: number): void {
  const ctx = getContext();
  if (!ctx) return;

  const stackCount = getChipStackCount(amount);
  const now = ctx.currentTime;

  for (let i = 0; i < stackCount; i++) {
    const delay = i * 0.026 + (Math.random() - 0.5) * 0.004;
    const pitch = 1.0 + (i * 0.04) + (Math.random() - 0.5) * 0.06;
    const vol = 0.11 - i * 0.015;
    playClayClink(ctx, now + Math.max(0, delay), pitch, Math.max(0.05, vol));
  }
}

/** Card deal audio feedback. */
export function playDealCard(): void {
  playCard();
}

/**
 * Bet clearing / undo — synthesized sweep of clay chips being swept/gathered.
 */
export function playBetClear(): void {
  const ctx = getContext();
  if (!ctx) {
    playMove();
    return;
  }

  const now = ctx.currentTime;
  const count = 3;
  for (let i = 0; i < count; i++) {
    const delay = i * 0.032;
    const pitch = 0.94 - i * 0.07;
    playClayClink(ctx, now + delay, pitch, 0.08);
  }
}

/**
 * Suspense beat audio: low soft heartbeat pulse (lub-dub) during dealer hole card peek/reveal.
 */
export function playSuspenseBeat(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const playThump = (time: number, freq: number, vol: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.8, time + 0.07);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.075);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.08);
  };

  // Lub-dub heartbeat pulse
  playThump(now, 76, 0.09);
  playThump(now + 0.085, 66, 0.06);
}
