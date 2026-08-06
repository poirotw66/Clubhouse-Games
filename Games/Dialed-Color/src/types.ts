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
  bestScore: number;
  bestAverage: number;
  bestAscentLevel: number;
}
