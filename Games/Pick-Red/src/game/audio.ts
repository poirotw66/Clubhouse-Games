/**
 * Dedicated native Web Audio Synthesizer for Pick-Red (撿紅點).
 *
 * Implements tactile acoustic feedback:
 * 1. Card snap & slide physics.
 * 2. Match-10 collision strike impact (tactile wooden clack + sub-bass punch).
 * 3. Crimson pentatonic chime cascade for scoring red points.
 * 4. Low-frequency danger heartbeat sonar for Red Ace and Big Five presence.
 * 5. Harmonic resonance ping for matching opportunities.
 */

const AudioContextCtor =
  typeof window !== 'undefined'
    ? window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;

let audioContext: AudioContext | null = null;
let lastSonarTime = 0;

function getContext(): AudioContext | null {
  if (!AudioContextCtor) return null;
  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
  return audioContext;
}

/**
 * Plays a filtered noise card slide or snap.
 */
export function playCardSlide(): void {
  const ctx = getContext();
  if (!ctx) return;

  try {
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.08);
    filter.Q.value = 3;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  } catch {
    // Ignore audio context errors gracefully
  }
}

/**
 * Plays tactile wooden / ivory collision snap.
 */
export function playTactileSnap(volume = 0.12): void {
  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // High snap click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(2200, now);
    clickOsc.frequency.exponentialRampToValueAtTime(320, now + 0.035);

    clickGain.gain.setValueAtTime(volume, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.04);

    // Low wooden body thump
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(120, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(55, now + 0.06);

    bodyGain.gain.setValueAtTime(volume * 0.9, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.07);
  } catch {
    // Graceful fallback
  }
}

/**
 * Traditional Taiwanese pentatonic chime frequencies (Gong, Shang, Jiao, Zhi, Yu).
 * C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A5 = 880.00, C6 = 1046.50
 */
const PENTATONIC_SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

/**
 * Plays a resonant crimson bell chime tailored to the points scored.
 */
export function playCrimsonChime(points: number): void {
  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    let notes: number[];

    if (points >= 30) {
      // 30+ points (e.g. Red 9 + Red A, or Black A variant): Grand arpeggio
      notes = [523.25, 659.25, 783.99, 1046.5];
    } else if (points >= 20) {
      // 20 points (Red Ace capture): Majestic chord
      notes = [523.25, 783.99, 1046.5];
    } else if (points >= 10) {
      // 10 points (Red 9, 10, J, Q, K): Crisp triad
      notes = [587.33, 783.99, 880.0];
    } else if (points > 0) {
      // 2-8 points: Dual chime
      notes = [659.25, 880.0];
    } else {
      // 0 points (tool-card capture): Single subtle tone
      notes = [523.25];
    }

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const delay = index * 0.045;
      const start = now + delay;
      const duration = points >= 20 ? 0.38 : 0.22;

      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.09, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration + 0.05);
    });
  } catch {
    // Graceful fallback
  }
}

/**
 * Full Match-10 collision strike audio orchestration:
 * - Pre-impact magnetic rush
 * - Tactile snap impact
 * - Harmonic crimson scoring chime
 */
export function playMatch10Collision(points: number, isAce = false, combo = 0): void {
  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Sub-bass impact slam
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(42, now + 0.12);

    const subVol = isAce ? 0.18 : 0.12;
    subGain.gain.setValueAtTime(subVol, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.15);

    // Tactile wood snap
    playTactileSnap(isAce ? 0.16 : 0.11);

    // Delayed crimson chime
    setTimeout(() => {
      playCrimsonChime(points);
    }, 60);

    // If combo >= 2, add extra ascending chime
    if (combo >= 2) {
      setTimeout(() => {
        const comboFreq = PENTATONIC_SCALE[Math.min(PENTATONIC_SCALE.length - 1, combo + 1)];
        playToneDirect(comboFreq, 'triangle', 0.2, 0.08);
      }, 140);
    }
  } catch {
    // Graceful fallback
  }
}

/**
 * Low-frequency heartbeat sonar pulse when high-value prize (Red Ace / Red Five)
 * is exposed on the open table. Throttled to avoid overwhelming.
 */
export function playDangerSonar(): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = Date.now();
  if (now - lastSonarTime < 2400) return;
  lastSonarTime = now;

  try {
    const audioTime = ctx.currentTime;

    // Sub heartbeat beat 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(62, audioTime);
    osc1.frequency.exponentialRampToValueAtTime(44, audioTime + 0.12);

    gain1.gain.setValueAtTime(0.12, audioTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.14);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(audioTime);
    osc1.stop(audioTime + 0.15);

    // Sub heartbeat beat 2 (lub-dub)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const beat2Time = audioTime + 0.11;
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(56, beat2Time);
    osc2.frequency.exponentialRampToValueAtTime(40, beat2Time + 0.14);

    gain2.gain.setValueAtTime(0.09, beat2Time);
    gain2.gain.exponentialRampToValueAtTime(0.001, beat2Time + 0.15);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(beat2Time);
    osc2.stop(beat2Time + 0.16);

    // Crystal high ping
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(1567.98, audioTime); // G6

    pingGain.gain.setValueAtTime(0.03, audioTime);
    pingGain.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.28);

    ping.connect(pingGain);
    pingGain.connect(ctx.destination);
    ping.start(audioTime);
    ping.stop(audioTime + 0.3);
  } catch {
    // Graceful fallback
  }
}

/**
 * Harmonic resonance ping when the player's hand card aligns with a table card.
 */
export function playResonancePing(): void {
  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.12);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    // Graceful fallback
  }
}

function playToneDirect(
  freq: number,
  type: OscillatorType,
  duration: number,
  vol: number,
): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    // Graceful fallback
  }
}
