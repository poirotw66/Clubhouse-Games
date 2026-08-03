import {
  BEST_DISTANCE_KEY,
  BEST_SCORE_KEY,
  BOOST_SCORE,
  COMBO_DECAY_SEC,
  DISTANCE_SCORE_PER_M,
  FEVER_COMBO,
  NEAR_MISS_SCORE,
  PERFECT_MISS_SCORE,
} from './constants';

export type ToastKind = 'near' | 'perfect' | 'boost' | 'fever' | null;

export interface HudSnapshot {
  score: number;
  distance: number;
  combo: number;
  multiplier: number;
  speed: number;
  nearMissFlash: number;
  bestScore: number;
  bestDistance: number;
  fever: boolean;
  boostT: number;
  toast: ToastKind;
  pickups: number;
}

export interface RunResult {
  score: number;
  distance: number;
  avoids: number;
  maxCombo: number;
  pickups: number;
  isNewBest: boolean;
}

export type ScoreState = {
  score: number;
  distance: number;
  combo: number;
  maxCombo: number;
  avoids: number;
  pickups: number;
  nearMissFlash: number;
  comboTimer: number;
  toast: ToastKind;
  toastTimer: number;
  feverLatched: boolean;
  bestScore: number;
  bestDistance: number;
};

export function createScoreState(): ScoreState {
  return {
    score: 0,
    distance: 0,
    combo: 0,
    maxCombo: 0,
    avoids: 0,
    pickups: 0,
    nearMissFlash: 0,
    comboTimer: COMBO_DECAY_SEC,
    toast: null,
    toastTimer: 0,
    feverLatched: false,
    bestScore: readBest(BEST_SCORE_KEY),
    bestDistance: readBest(BEST_DISTANCE_KEY),
  };
}

function readBest(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function persistBests(score: number, distance: number): boolean {
  let isNewBest = false;
  try {
    const prev = readBest(BEST_SCORE_KEY);
    if (score > prev) {
      localStorage.setItem(BEST_SCORE_KEY, String(Math.floor(score)));
      isNewBest = true;
    }
    const prevDist = readBest(BEST_DISTANCE_KEY);
    if (distance > prevDist) {
      localStorage.setItem(BEST_DISTANCE_KEY, String(Math.floor(distance)));
    }
  } catch {
    /* private mode */
  }
  return isNewBest;
}

export function isFever(combo: number): boolean {
  return combo >= FEVER_COMBO;
}

export function comboMultiplier(combo: number): number {
  const base = 1 + Math.min(combo, 12) * 0.18;
  return isFever(combo) ? base + 0.5 : base;
}

function bumpCombo(state: ScoreState): void {
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.comboTimer = COMBO_DECAY_SEC;
  if (isFever(state.combo) && !state.feverLatched) {
    state.feverLatched = true;
    setToast(state, 'fever');
  }
}

function setToast(state: ScoreState, toast: ToastKind): void {
  state.toast = toast;
  state.toastTimer = 0.85;
}

export function addDistanceScore(state: ScoreState, deltaMeters: number): void {
  state.distance += deltaMeters;
  state.score += deltaMeters * DISTANCE_SCORE_PER_M * comboMultiplier(state.combo);
}

export function registerNearMiss(state: ScoreState, perfect: boolean): void {
  bumpCombo(state);
  state.avoids += 1;
  state.nearMissFlash = 1;
  const payout = perfect ? PERFECT_MISS_SCORE : NEAR_MISS_SCORE;
  state.score += payout * comboMultiplier(state.combo);
  setToast(state, perfect ? 'perfect' : 'near');
}

export function registerBoostPickup(state: ScoreState): void {
  bumpCombo(state);
  state.pickups += 1;
  state.nearMissFlash = 1;
  state.score += BOOST_SCORE * comboMultiplier(state.combo);
  setToast(state, 'boost');
}

export function breakCombo(state: ScoreState): void {
  state.combo = 0;
  state.feverLatched = false;
  state.comboTimer = COMBO_DECAY_SEC;
}

/** Tick combo decay + toast timers. Returns true if fever just dropped. */
export function tickScoreTimers(state: ScoreState, dt: number): void {
  if (state.toastTimer > 0) {
    state.toastTimer = Math.max(0, state.toastTimer - dt);
    if (state.toastTimer <= 0) state.toast = null;
  }
  if (state.nearMissFlash > 0) {
    state.nearMissFlash = Math.max(0, state.nearMissFlash - dt * 1.8);
  }
  if (state.combo <= 0) return;
  state.comboTimer -= dt;
  if (state.comboTimer <= 0) {
    state.combo = Math.max(0, state.combo - 1);
    state.comboTimer = COMBO_DECAY_SEC * 0.55;
    if (!isFever(state.combo)) state.feverLatched = false;
  }
}

export function toHud(state: ScoreState, speed: number, boostT: number): HudSnapshot {
  return {
    score: Math.floor(state.score),
    distance: Math.floor(state.distance),
    combo: state.combo,
    multiplier: comboMultiplier(state.combo),
    speed,
    nearMissFlash: state.nearMissFlash,
    bestScore: state.bestScore,
    bestDistance: state.bestDistance,
    fever: isFever(state.combo),
    boostT,
    toast: state.toast,
    pickups: state.pickups,
  };
}

export function finalizeRun(state: ScoreState): RunResult {
  const isNewBest = persistBests(state.score, state.distance);
  return {
    score: Math.floor(state.score),
    distance: Math.floor(state.distance),
    avoids: state.avoids,
    maxCombo: state.maxCombo,
    pickups: state.pickups,
    isNewBest,
  };
}
