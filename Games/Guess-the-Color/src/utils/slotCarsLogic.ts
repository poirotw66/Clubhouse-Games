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
  targetIndex: number;
  highlightIndex: number | null;
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

const ROUND_TIME = 3.0;
const BASE_SCORE = 100;
const STREAK_BONUS = 30;

export function createInitialState(): GuessColorState {
  return {
    phase: 'menu',
    round: 0,
    maxRounds: 10,
    score: 0,
    streak: 0,
    timeLeft: ROUND_TIME,
    targetIndex: 0,
    highlightIndex: null,
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
  const targetIndex = Math.floor(Math.random() * COLORS.length);
  return {
    ...state,
    phase: 'showing',
    round: nextRound,
    timeLeft: ROUND_TIME,
    targetIndex,
    highlightIndex: targetIndex,
    lastCorrect: null,
  };
}

export function updateState(state: GuessColorState, dt: number): GuessColorState {
  if (state.phase === 'menu' || state.phase === 'results') {
    return state;
  }

  let next = { ...state, timeLeft: Math.max(0, state.timeLeft - dt) };

  if (state.phase === 'showing' && state.timeLeft <= ROUND_TIME - 0.8) {
    next.phase = 'answering';
    next.highlightIndex = null;
  }

  if (next.phase === 'answering' && next.timeLeft <= 0) {
    return handleTimeout(next);
  }

  return next;
}

function handleTimeout(state: GuessColorState): GuessColorState {
  return {
    ...state,
    streak: 0,
    lastCorrect: false,
    phase: state.round >= state.maxRounds ? 'results' : 'showing',
    timeLeft: ROUND_TIME,
    highlightIndex: null,
  };
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
