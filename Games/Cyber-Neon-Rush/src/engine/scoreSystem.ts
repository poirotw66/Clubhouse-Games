import {
  BEST_DISTANCE_KEY,
  BEST_SCORE_KEY,
  DISTANCE_SCORE_PER_M,
  NEAR_MISS_SCORE,
} from './constants';

export interface HudSnapshot {
  score: number;
  distance: number;
  combo: number;
  multiplier: number;
  speed: number;
  nearMissFlash: number;
  bestScore: number;
  bestDistance: number;
}

export interface RunResult {
  score: number;
  distance: number;
  avoids: number;
  maxCombo: number;
  isNewBest: boolean;
}

export function createScoreState(): {
  score: number;
  distance: number;
  combo: number;
  maxCombo: number;
  avoids: number;
  nearMissFlash: number;
  bestScore: number;
  bestDistance: number;
} {
  return {
    score: 0,
    distance: 0,
    combo: 0,
    maxCombo: 0,
    avoids: 0,
    nearMissFlash: 0,
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

export function addDistanceScore(
  state: ReturnType<typeof createScoreState>,
  deltaMeters: number,
): void {
  state.distance += deltaMeters;
  const mult = comboMultiplier(state.combo);
  state.score += deltaMeters * DISTANCE_SCORE_PER_M * mult;
}

export function registerNearMiss(state: ReturnType<typeof createScoreState>): void {
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.avoids += 1;
  state.nearMissFlash = 1;
  state.score += NEAR_MISS_SCORE * comboMultiplier(state.combo);
}

export function breakCombo(state: ReturnType<typeof createScoreState>): void {
  state.combo = 0;
}

export function comboMultiplier(combo: number): number {
  return 1 + Math.min(combo, 12) * 0.15;
}

export function toHud(
  state: ReturnType<typeof createScoreState>,
  speed: number,
): HudSnapshot {
  return {
    score: Math.floor(state.score),
    distance: Math.floor(state.distance),
    combo: state.combo,
    multiplier: comboMultiplier(state.combo),
    speed,
    nearMissFlash: state.nearMissFlash,
    bestScore: state.bestScore,
    bestDistance: state.bestDistance,
  };
}

export function finalizeRun(
  state: ReturnType<typeof createScoreState>,
): RunResult {
  const isNewBest = persistBests(state.score, state.distance);
  return {
    score: Math.floor(state.score),
    distance: Math.floor(state.distance),
    avoids: state.avoids,
    maxCombo: state.maxCombo,
    isNewBest,
  };
}
