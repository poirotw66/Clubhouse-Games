import { playCard, playMove, playScore } from '@clubhouse/shared/synthAudio';

/** Chip stack / bet chip — reuse score chime (repo has no dedicated coin tone). */
export function playChip(): void {
  playScore();
}

export function playDealCard(): void {
  playCard();
}

export function playBetClear(): void {
  playMove();
}
