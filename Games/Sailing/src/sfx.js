/**
 * Thin Vite bridge onto @clubhouse/shared/synthAudio (no React).
 * Result chrome stays the custom finish panel in index.html.
 */
import { playGoal, playMove, playScore, playWin } from '@clubhouse/shared/synthAudio';

export function sfxGateClear(perfect) {
  if (perfect) playScore();
  else playMove();
}

export function sfxFinish(isRecord) {
  if (isRecord) playWin();
  else playGoal();
}
