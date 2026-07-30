export type GameState = 'landing' | 'showing' | 'guessing' | 'results';
export type GameMode = 'single' | 'challenge';

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
