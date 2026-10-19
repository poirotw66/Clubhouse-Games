import {
  BEST_DISTANCE_KEY,
  BEST_SCORE_KEY,
  BESTS_KEY,
  BOOST_SCORE,
  COMBO_DECAY_SEC,
  DISTANCE_SCORE_PER_M,
  FEVER_COMBO,
  NEAR_MISS_SCORE,
  PERFECT_MISS_SCORE,
  POWERUP_SCORE,
  RUSH_DIFFICULTIES,
  type RushDifficulty,
} from './constants';
import { nearMissScoreMul, type UpgradeLevels } from './progress';
import type { PowerupKind } from './meshes';

export type ToastKind =
  | 'near'
  | 'perfect'
  | 'boost'
  | 'fever'
  | 'shield'
  | 'magnet'
  | 'multiplier'
  | 'slowmo'
  | 'dash'
  | 'jump'
  | null;

export type ActivePowerHud = {
  shield: boolean;
  magnet: number;
  multiplier: number;
  slowmo: number;
};

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
  powerups: number;
  dashCd: number;
  dashReady: boolean;
  jumpAir: boolean;
  shake: number;
  powers: ActivePowerHud;
  scoreMulActive: number;
}

export interface RunResult {
  score: number;
  distance: number;
  avoids: number;
  perfects: number;
  maxCombo: number;
  pickups: number;
  powerups: number;
  dashes: number;
  reachedFever: boolean;
  creditsEarned: number;
  isNewBest: boolean;
}

export type ModeBest = { score: number; distance: number };

export type BestsMap = Record<RushDifficulty, ModeBest>;

export type ScoreState = {
  score: number;
  distance: number;
  combo: number;
  maxCombo: number;
  avoids: number;
  perfects: number;
  pickups: number;
  powerups: number;
  dashes: number;
  reachedFever: boolean;
  nearMissFlash: number;
  comboTimer: number;
  toast: ToastKind;
  toastTimer: number;
  feverLatched: boolean;
  bestScore: number;
  bestDistance: number;
  difficulty: RushDifficulty;
  nearMissMul: number;
  scorePowerMul: number;
};

function emptyBests(): BestsMap {
  return {
    chill: { score: 0, distance: 0 },
    normal: { score: 0, distance: 0 },
    rush: { score: 0, distance: 0 },
  };
}

function readLegacy(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function loadBests(): BestsMap {
  const bests = emptyBests();
  try {
    const raw = localStorage.getItem(BESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<RushDifficulty, Partial<ModeBest>>>;
      for (const d of RUSH_DIFFICULTIES) {
        const row = parsed[d];
        if (!row) continue;
        bests[d] = {
          score: Number(row.score) || 0,
          distance: Number(row.distance) || 0,
        };
      }
      return bests;
    }
  } catch {
    /* fall through to legacy */
  }
  bests.normal = {
    score: readLegacy(BEST_SCORE_KEY),
    distance: readLegacy(BEST_DISTANCE_KEY),
  };
  return bests;
}

export function createScoreState(
  difficulty: RushDifficulty = 'normal',
  upgrades?: UpgradeLevels,
): ScoreState {
  const bests = loadBests();
  return {
    score: 0,
    distance: 0,
    combo: 0,
    maxCombo: 0,
    avoids: 0,
    perfects: 0,
    pickups: 0,
    powerups: 0,
    dashes: 0,
    reachedFever: false,
    nearMissFlash: 0,
    comboTimer: COMBO_DECAY_SEC,
    toast: null,
    toastTimer: 0,
    feverLatched: false,
    bestScore: bests[difficulty].score,
    bestDistance: bests[difficulty].distance,
    difficulty,
    nearMissMul: nearMissScoreMul(upgrades?.nearMissBonus ?? 0),
    scorePowerMul: 1,
  };
}

export function persistBests(
  score: number,
  distance: number,
  difficulty: RushDifficulty,
): boolean {
  let isNewBest = false;
  try {
    const bests = loadBests();
    const prev = bests[difficulty];
    if (score > prev.score) {
      bests[difficulty] = {
        score: Math.floor(score),
        distance: Math.max(prev.distance, Math.floor(distance)),
      };
      isNewBest = true;
    } else if (distance > prev.distance) {
      bests[difficulty] = { ...prev, distance: Math.floor(distance) };
    }
    localStorage.setItem(BESTS_KEY, JSON.stringify(bests));
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
  if (isFever(state.combo)) {
    state.reachedFever = true;
    if (!state.feverLatched) {
      state.feverLatched = true;
      setToast(state, 'fever');
    }
  }
}

function setToast(state: ScoreState, toast: ToastKind): void {
  state.toast = toast;
  state.toastTimer =
    toast === 'fever' ? 1.25 : toast === 'perfect' ? 1.05 : toast === 'dash' ? 0.7 : 0.9;
}

export function addDistanceScore(state: ScoreState, deltaMeters: number): void {
  state.distance += deltaMeters;
  state.score +=
    deltaMeters * DISTANCE_SCORE_PER_M * comboMultiplier(state.combo) * state.scorePowerMul;
}

export function registerNearMiss(state: ScoreState, perfect: boolean): void {
  bumpCombo(state);
  state.avoids += 1;
  if (perfect) state.perfects += 1;
  state.nearMissFlash = 1;
  const payout = (perfect ? PERFECT_MISS_SCORE : NEAR_MISS_SCORE) * state.nearMissMul;
  state.score += payout * comboMultiplier(state.combo) * state.scorePowerMul;
  setToast(state, perfect ? 'perfect' : 'near');
}

export function registerBoostPickup(state: ScoreState): void {
  bumpCombo(state);
  state.pickups += 1;
  state.nearMissFlash = 1;
  state.score += BOOST_SCORE * comboMultiplier(state.combo) * state.scorePowerMul;
  setToast(state, 'boost');
}

export function registerPowerupPickup(state: ScoreState, kind: PowerupKind): void {
  bumpCombo(state);
  state.powerups += 1;
  state.nearMissFlash = 1;
  state.score += POWERUP_SCORE * comboMultiplier(state.combo) * state.scorePowerMul;
  setToast(state, kind);
}

export function registerDash(state: ScoreState): void {
  state.dashes += 1;
  setToast(state, 'dash');
}

export function breakCombo(state: ScoreState): void {
  state.combo = 0;
  state.feverLatched = false;
  state.comboTimer = COMBO_DECAY_SEC;
}

/** Tick combo decay + toast timers. */
export function tickScoreTimers(state: ScoreState, dt: number): void {
  if (state.toastTimer > 0) {
    state.toastTimer = Math.max(0, state.toastTimer - dt);
    if (state.toastTimer <= 0) state.toast = null;
  }
  if (state.nearMissFlash > 0) {
    state.nearMissFlash = Math.max(0, state.nearMissFlash - dt * 1.15);
  }
  if (state.combo <= 0) return;
  state.comboTimer -= dt;
  if (state.comboTimer <= 0) {
    state.combo = Math.max(0, state.combo - 1);
    state.comboTimer = COMBO_DECAY_SEC * 0.55;
    if (!isFever(state.combo)) state.feverLatched = false;
  }
}

export function toHud(
  state: ScoreState,
  speed: number,
  boostT: number,
  extras: {
    dashCd: number;
    dashReady: boolean;
    jumpAir: boolean;
    shake: number;
    powers: ActivePowerHud;
  },
): HudSnapshot {
  return {
    score: Math.floor(state.score),
    distance: Math.floor(state.distance),
    combo: state.combo,
    multiplier: comboMultiplier(state.combo) * state.scorePowerMul,
    speed,
    nearMissFlash: state.nearMissFlash,
    bestScore: state.bestScore,
    bestDistance: state.bestDistance,
    fever: isFever(state.combo),
    boostT,
    toast: state.toast,
    pickups: state.pickups,
    powerups: state.powerups,
    dashCd: extras.dashCd,
    dashReady: extras.dashReady,
    jumpAir: extras.jumpAir,
    shake: extras.shake,
    powers: extras.powers,
    scoreMulActive: state.scorePowerMul,
  };
}

export function finalizeRun(
  state: ScoreState,
  creditsEarned: number,
): RunResult {
  const isNewBest = persistBests(state.score, state.distance, state.difficulty);
  return {
    score: Math.floor(state.score),
    distance: Math.floor(state.distance),
    avoids: state.avoids,
    perfects: state.perfects,
    maxCombo: state.maxCombo,
    pickups: state.pickups,
    powerups: state.powerups,
    dashes: state.dashes,
    reachedFever: state.reachedFever,
    creditsEarned,
    isNewBest,
  };
}
