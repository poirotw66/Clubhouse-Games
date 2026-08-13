export type GameState = 'landing' | 'showing' | 'guessing' | 'results';

/** single = 1 color; challenge = 5 colors show-then-guess; ascent = staged progression */
export type GameMode = 'single' | 'challenge' | 'ascent';

export interface Color {
  h: number;
  s: number;
  l: number;
}

export interface Guess {
  target: Color;
  user: Color;
  score: number;
}

export interface GameData {
  targetColors: Color[];
  userGuesses: Color[];
  currentStep: number;
}

export interface BestRecords {
  /** Personal-best single-round score keyed by flash duration ms. */
  bestScoreByMs: Record<string, number>;
  /** Personal-best challenge average keyed by flash duration ms. */
  bestAverageByMs: Record<string, number>;
  bestAscentLevel: number;
}

export type ShowMs = 1000 | 2000 | 3000;
