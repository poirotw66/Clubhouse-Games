/**
 * Takoyaki: grill with slots. Each ball cooks; flip at the right time = perfect (score).
 * Too early = raw, too late = burnt. Time limit, score to beat.
 */

export const GRILL_COLS = 4;
export const GRILL_ROWS = 3;
export const SLOT_COUNT = GRILL_COLS * GRILL_ROWS;
export const GAME_DURATION = 60;
export const PERFECT_LOW = 0.7;
export const PERFECT_HIGH = 0.88;
export const COOK_SPEED_MIN = 0.35;
export const COOK_SPEED_MAX = 0.6;
export const SPAWN_INTERVAL = 1.8;
export const RESULT_DISPLAY_TIME = 0.8;
export const PERFECT_POINTS = 15;
export const COMBO_BONUS = 5;

export type SlotState =
  | { type: 'empty' }
  | { type: 'cooking'; progress: number; speed: number }
  | { type: 'result'; result: 'perfect' | 'raw' | 'burnt'; timer: number };

export type GamePhase = 'menu' | 'playing' | 'gameOver';

export interface TakoyakiState {
  phase: GamePhase;
  timeLeft: number;
  score: number;
  combo: number;
  slots: SlotState[];
  spawnTimer: number;
}

export function createInitialState(): TakoyakiState {
  return {
    phase: 'menu',
    timeLeft: GAME_DURATION,
    score: 0,
    combo: 0,
    slots: Array.from({ length: SLOT_COUNT }, () => ({ type: 'empty' })),
    spawnTimer: 0,
  };
}

function getEmptyIndices(slots: SlotState[]): number[] {
  return slots
    .map((s, i) => (s.type === 'empty' ? i : -1))
    .filter((i) => i >= 0);
}

export function startGame(state: TakoyakiState): TakoyakiState {
  return {
    ...createInitialState(),
    phase: 'playing',
    timeLeft: GAME_DURATION,
    score: 0,
    combo: 0,
    slots: Array.from({ length: SLOT_COUNT }, () => ({ type: 'empty' })),
    spawnTimer: SPAWN_INTERVAL * 0.5,
  };
}

export function update(state: TakoyakiState, dt: number): TakoyakiState {
  if (state.phase !== 'playing') return state;

  let next = { ...state };
  next.timeLeft = Math.max(0, next.timeLeft - dt);
  if (next.timeLeft <= 0) {
    next.phase = 'gameOver';
    return next;
  }

  next.slots = next.slots.map((slot) => {
    if (slot.type === 'result') {
      const timer = slot.timer - dt;
      if (timer <= 0) return { type: 'empty' as const };
      return { ...slot, timer };
    }
    if (slot.type === 'cooking') {
      let progress = slot.progress + slot.speed * dt;
      if (progress >= 1) {
        return { type: 'result' as const, result: 'burnt' as const, timer: RESULT_DISPLAY_TIME };
      }
      return { ...slot, progress };
    }
    return slot;
  });

  next.spawnTimer -= dt;
  if (next.spawnTimer <= 0) {
    next.spawnTimer = SPAWN_INTERVAL;
    const empty = getEmptyIndices(next.slots);
    if (empty.length > 0) {
      const idx = empty[Math.floor(Math.random() * empty.length)];
      const speed = COOK_SPEED_MIN + Math.random() * (COOK_SPEED_MAX - COOK_SPEED_MIN);
      const newSlots = [...next.slots];
      newSlots[idx] = { type: 'cooking', progress: 0, speed };
      next.slots = newSlots;
    }
  }

  return next;
}

export function flipSlot(state: TakoyakiState, index: number): TakoyakiState {
  if (state.phase !== 'playing') return state;
  const slot = state.slots[index];
  if (slot.type !== 'cooking') return state;

  const { progress } = slot;
  let result: 'perfect' | 'raw' | 'burnt';
  if (progress >= PERFECT_LOW && progress <= PERFECT_HIGH) {
    result = 'perfect';
  } else if (progress < PERFECT_LOW) {
    result = 'raw';
  } else {
    result = 'burnt';
  }

  let score = state.score;
  let combo = result === 'perfect' ? state.combo + 1 : 0;
  if (result === 'perfect') {
    score += PERFECT_POINTS + (state.combo > 0 ? COMBO_BONUS * state.combo : 0);
  }

  const newSlots = [...state.slots];
  newSlots[index] = { type: 'result', result, timer: RESULT_DISPLAY_TIME };

  return {
    ...state,
    score,
    combo,
    slots: newSlots,
  };
}

export function getProgressPercent(slot: SlotState): number | null {
  if (slot.type !== 'cooking') return null;
  return Math.min(100, Math.round(slot.progress * 100));
}

export function isInPerfectZone(progress: number): boolean {
  return progress >= PERFECT_LOW && progress <= PERFECT_HIGH;
}
