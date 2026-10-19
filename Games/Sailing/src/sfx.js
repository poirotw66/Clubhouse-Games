/**
 * Thin Vite bridge onto @clubhouse/shared/synthAudio (no React).
 * Finish chrome uses @clubhouse/shared/resultOverlayDom from main.js.
 */
import {
  playCapture,
  playGoal,
  playMove,
  playPaddleHit,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';

export function sfxGateClear(perfect) {
  if (perfect) playScore();
  else playMove();
}

export function sfxFinish(isRecord) {
  if (isRecord) playWin();
  else playGoal();
}

/** Buoy rounding — slightly heavier than a gate beep. */
export function sfxMarkRound(perfect) {
  if (perfect) {
    playScore();
    playCapture();
  } else {
    playMove();
    playPaddleHit();
  }
}

/** Gust onset — air whoosh via paired soft tones. */
export function sfxGust() {
  playPaddleHit();
  playMove();
}

/** Trim snap into the sweet spot. */
export function sfxTrimSweet() {
  playScore();
}

/** Sail luffing / sheet too far. */
export function sfxLuff() {
  playPaddleHit();
}

export function sfxUnlock() {
  playWin();
}

export function sfxCountdown() {
  playMove();
}
