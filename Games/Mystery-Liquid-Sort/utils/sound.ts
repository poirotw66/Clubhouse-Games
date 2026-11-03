import {
  playCapture,
  playCard,
  playError,
  playGoal,
  playMove,
  playPaddleHit,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';

const SOUND_STORAGE_KEY = 'mls_sound_enabled';

export function getSoundEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    /* private mode */
  }
}

function gated(play: () => void): void {
  if (!getSoundEnabled()) return;
  try {
    play();
  } catch {
    /* audio failure should not crash gameplay */
  }
}

const AudioContextCtor =
  typeof window !== 'undefined'
    ? window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    : undefined;

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (!AudioContextCtor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContextCtor();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Procedural bubbling liquid pour effect (frequency dropped micro-bubbles).
 */
function playBubblingPour(): void {
  const ctx = getContext();
  if (!ctx) {
    playCard();
    return;
  }

  const bubbles = [
    { start: 680, end: 420, dur: 0.08, delay: 0 },
    { start: 820, end: 490, dur: 0.09, delay: 0.06 },
    { start: 580, end: 360, dur: 0.1, delay: 0.13 },
  ];

  bubbles.forEach(({ start, end, dur, delay }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + delay;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(start, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(100, end), t0 + dur);

    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.09, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  });
}

/**
 * Sublimation gold chime when a test tube reaches 100% single color purity and seals.
 */
function playSublimationChime(): void {
  const ctx = getContext();
  if (!ctx) {
    playScore();
    playMove();
    return;
  }

  // Harmonic pentatonic crystalline chime
  const notes = [1046.5, 1318.5, 1567.9, 2093.0];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t0 = ctx.currentTime + idx * 0.07;
    const dur = 0.35 + idx * 0.08;

    osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, t0);

    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.08, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
}

/** Thin wrappers over synthAudio & procedural laboratory SFX, respecting MLS mute preference. */
export const sounds = {
  pop: () => gated(playMove),
  /** Liquid bubbling pour sound. */
  pour: () => gated(playBubblingPour),
  /** Mixing reaction — brighter / distinct from plain merge. */
  mix: () =>
    gated(() => {
      playPaddleHit();
      playCapture();
    }),
  /** Single bottle sealed / completed with sublimation gold chime. */
  bottleComplete: () => gated(playSublimationChime),
  score: () => gated(playScore),
  win: () => gated(playWin),
  error: () => gated(playError),
  magic: () => gated(playGoal),
};
