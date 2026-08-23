/**
 * Local layered synth for Coin Cascade. Reuses shared/synthAudio's tone
 * primitives are not enough here — a metallic coin impact needs a short
 * noise burst plus a couple of detuned tones layered together, and the
 * layering itself has to scale with how many coins land in the same tick
 * (the whole point of "依同時落幣數疊加層次" in the spec) — so this module
 * owns its own AudioContext the way Brick-Kart-Racing's engine/audio.ts does.
 */

let ctx: AudioContext | null = null;
let muted = false;
let noiseBuffer: AudioBuffer | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setMuted(value: boolean): void {
  muted = value;
}

export function isMuted(): boolean {
  return muted;
}

function getNoiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer;
  const len = Math.floor(c.sampleRate * 0.12);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  // A short deterministic-enough (per-buffer, not per-play) noise burst is
  // plenty for a metallic click; it does not need to vary per play, and it
  // never touches the simulation, so it has no bearing on replay determinism.
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

function metalClink(c: AudioContext, when: number, freq: number, gainScale: number): void {
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.1 * gainScale, when + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.16);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(when);
  osc.stop(when + 0.2);

  // A quick pitch drop sells "metal", not just a tone.
  osc.frequency.setValueAtTime(freq, when);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.72, when + 0.1);

  const noise = c.createBufferSource();
  noise.buffer = getNoiseBuffer(c);
  const noiseFilter = c.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 2200;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.05 * gainScale, when);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(c.destination);
  noise.start(when);
  noise.stop(when + 0.06);
}

/**
 * One or more coins landed in the front tray in the same tick. `count` scales
 * both the layering (more simultaneous voices, each quieter so it never
 * clips) and a slight upward pitch drift per layer, so five coins landing at
 * once reads as a bigger event than one, not just a louder one.
 */
export function playCoinFall(count: number): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const n = Math.max(1, Math.min(8, count));
  const gainScale = 1 / Math.sqrt(n);
  const baseFreqs = [1380, 1560, 1720, 1240, 1900, 1480, 1650, 1330];
  for (let i = 0; i < n; i++) {
    metalClink(c, c.currentTime + i * 0.014, baseFreqs[i % baseFreqs.length], gainScale);
  }
}

export function playDrop(): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.08);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.06, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.1);
}

export function playCascade(size: number): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
  const n = Math.min(notes.length, Math.max(1, size - 2));
  for (let i = 0; i < n; i++) {
    const when = c.currentTime + i * 0.07;
    const osc = c.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = notes[i];
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.09, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(when);
    osc.stop(when + 0.24);
  }
}

export function playJackpot(): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  for (let i = 0; i < 10; i++) {
    const when = c.currentTime + i * 0.045;
    metalClink(c, when, 1500 + Math.sin(i) * 300, 0.65);
  }
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.5);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(0.08, c.currentTime + 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.65);
}

export function playShake(): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const noise = c.createBufferSource();
  noise.buffer = getNoiseBuffer(c);
  noise.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 500;
  filter.Q.value = 0.6;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.1, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  noise.start();
  noise.stop(c.currentTime + 0.32);
}

export function playReject(): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 160;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.04, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + 0.11);
}

/** Short sparkle when a timing or edge bonus lands. */
export function playBonus(): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  const when = c.currentTime;
  for (const [i, freq] of [880, 1174.66].entries()) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, when + i * 0.04);
    gain.gain.linearRampToValueAtTime(0.07, when + i * 0.04 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, when + i * 0.04 + 0.14);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(when + i * 0.04);
    osc.stop(when + i * 0.04 + 0.16);
  }
}
