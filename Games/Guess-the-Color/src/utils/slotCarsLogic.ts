import { shuffleArray } from '@clubhouse/shared/shuffle';

export const PANEL_WIDTH = 480;
export const PANEL_HEIGHT = 360;

export type GamePhase = 'menu' | 'showing' | 'answering' | 'results';

export interface GuessColorState {
  phase: GamePhase;
  round: number;
  maxRounds: number;
  score: number;
  streak: number;
  timeLeft: number;
  showDuration: number;
  answerDuration: number;
  targetIndex: number;
  highlightIndex: number | null;
  choiceColors: string[];
  lastCorrect: boolean | null;
}

export interface GuessColorInput {
  selectIndex: number | null;
  deltaTime: number;
}

export const COLORS = [
  '#ef4444',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#0ea5e9',
  '#6366f1',
];

const EXTRA_DECOYS = [
  '#f97316',
  '#fb923c',
  '#a3e635',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#78716c',
];

const SIMILAR_DECOYS: Record<string, string> = {
  '#ef4444': '#f97316',
  '#f59e0b': '#fb923c',
  '#eab308': '#a3e635',
  '#22c55e': '#84cc16',
  '#0ea5e9': '#06b6d4',
  '#6366f1': '#8b5cf6',
};

const BASE_SCORE = 100;
const STREAK_BONUS = 30;
const MAX_ROUNDS = 10;

export function getRoundDifficulty(round: number): {
  showTime: number;
  answerTime: number;
  choiceCount: number;
} {
  const progress = (round - 1) / Math.max(1, MAX_ROUNDS - 1);
  return {
    showTime: 0.8 - progress * 0.35,
    answerTime: 3.0 - progress * 1.2,
    choiceCount: round <= 3 ? 6 : round <= 7 ? 8 : 9,
  };
}

function buildChoices(
  targetColor: string,
  choiceCount: number
): { colors: string[]; targetIndex: number } {
  const similar = SIMILAR_DECOYS[targetColor];
  const pool = shuffleArray([
    ...COLORS.filter((color) => color !== targetColor),
    ...EXTRA_DECOYS.filter((color) => color !== targetColor && color !== similar),
  ]);

  const picks: string[] = [targetColor];
  if (similar && choiceCount > 6) {
    picks.push(similar);
  }
  for (const color of pool) {
    if (picks.length >= choiceCount) break;
    if (!picks.includes(color)) picks.push(color);
  }

  const colors = shuffleArray(picks.slice(0, choiceCount));
  return { colors, targetIndex: colors.indexOf(targetColor) };
}

export function createInitialState(): GuessColorState {
  return {
    phase: 'menu',
    round: 0,
    maxRounds: MAX_ROUNDS,
    score: 0,
    streak: 0,
    timeLeft: 3.0,
    showDuration: 0.8,
    answerDuration: 3.0,
    targetIndex: 0,
    highlightIndex: null,
    choiceColors: [...COLORS],
    lastCorrect: null,
  };
}

export function startGame(): GuessColorState {
  const next = createInitialState();
  return startNextRound(next);
}

export function startNextRound(state: GuessColorState): GuessColorState {
  const nextRound = state.round + 1;
  if (nextRound > state.maxRounds) {
    return { ...state, phase: 'results', timeLeft: 0 };
  }

  const { showTime, answerTime, choiceCount } = getRoundDifficulty(nextRound);
  const targetColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  const { colors, targetIndex } = buildChoices(targetColor, choiceCount);

  return {
    ...state,
    phase: 'showing',
    round: nextRound,
    timeLeft: answerTime,
    showDuration: showTime,
    answerDuration: answerTime,
    targetIndex,
    highlightIndex: targetIndex,
    choiceColors: colors,
    lastCorrect: null,
  };
}

export function updateState(state: GuessColorState, dt: number): GuessColorState {
  if (state.phase === 'menu' || state.phase === 'results') {
    return state;
  }

  const next = { ...state, timeLeft: Math.max(0, state.timeLeft - dt) };

  if (
    state.phase === 'showing' &&
    next.timeLeft <= state.answerDuration - state.showDuration
  ) {
    next.phase = 'answering';
    next.highlightIndex = null;
  }

  if (next.phase === 'answering' && next.timeLeft <= 0) {
    return handleTimeout(next);
  }

  return next;
}

function handleTimeout(state: GuessColorState): GuessColorState {
  const base: GuessColorState = {
    ...state,
    streak: 0,
    lastCorrect: false,
  };
  if (state.round >= state.maxRounds) {
    return { ...base, phase: 'results', timeLeft: 0 };
  }
  return startNextRound(base);
}

export function submitAnswer(
  state: GuessColorState,
  selectedIndex: number
): GuessColorState {
  if (state.phase !== 'answering') {
    return state;
  }

  const isCorrect = selectedIndex === state.targetIndex;
  const newStreak = isCorrect ? state.streak + 1 : 0;
  const gained = isCorrect ? BASE_SCORE + newStreak * STREAK_BONUS : 0;
  const base: GuessColorState = {
    ...state,
    score: state.score + gained,
    streak: newStreak,
    lastCorrect: isCorrect,
  };

  if (state.round >= state.maxRounds) {
    return { ...base, phase: 'results', timeLeft: 0 };
  }

  return startNextRound(base);
}
