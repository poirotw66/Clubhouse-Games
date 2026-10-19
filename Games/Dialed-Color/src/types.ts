export type GameState =
  | 'landing'
  | 'showing'
  | 'guessing'
  | 'feedback'
  | 'results'
  | 'stats';

export type GameMode =
  | 'single'
  | 'challenge'
  | 'ascent'
  | 'daily'
  | 'mix'
  | 'complement'
  | 'analogous'
  | 'blitz'
  | 'survival';

export interface Color {
  h: number;
  s: number;
  l: number;
}

export interface BestRecords {
  bestScoreByMs: Record<string, number>;
  bestAverageByMs: Record<string, number>;
  bestAscentLevel: number;
  bestByMode: Record<string, number>;
  bestSurvival: number;
  bestBlitz: number;
}

export interface GameStats {
  gamesPlayed: number;
  totalAverageSum: number;
  modePlays: Record<string, number>;
  modeAverageSum: Record<string, number>;
  history: { mode: string; average: number; at: string }[];
}

export interface DailyRecord {
  date: string;
  average: number;
  scores: number[];
}

export interface Prefs {
  colorBlind: boolean;
}

export type ShowMs = 1000 | 2000 | 3000;

export const MODE_LABELS: Record<GameMode, string> = {
  single: '單色挑戰',
  challenge: '五色連續',
  ascent: '闖關模式',
  daily: '每日挑戰',
  mix: '混色調配',
  complement: '互補色',
  analogous: '類似色',
  blitz: '限時閃擊',
  survival: '無盡生存',
};
