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
  return localStorage.getItem(SOUND_STORAGE_KEY) !== 'false';
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
}

function gated(play: () => void): void {
  if (!getSoundEnabled()) return;
  play();
}

/** Thin wrappers over shared synthAudio, respecting MLS mute preference. */
export const sounds = {
  pop: () => gated(playMove),
  /** Ordinary same-colour merge pour. */
  pour: () => gated(playCard),
  /** Mixing reaction — brighter / distinct from plain merge. */
  mix: () =>
    gated(() => {
      playPaddleHit();
      playCapture();
    }),
  score: () => gated(playScore),
  win: () => gated(playWin),
  error: () => gated(playError),
  magic: () => gated(playGoal),
};
