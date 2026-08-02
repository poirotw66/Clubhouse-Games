export type Screen = 'menu' | 'playing' | 'paused' | 'gameover';

export interface RunStats {
  score: number;
  distance: number;
  avoids: number;
  maxCombo: number;
  isNewBest: boolean;
}
