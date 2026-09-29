// Match / derby difficulty knobs for Toy Baseball.

export type Difficulty = 'easy' | 'normal' | 'hard';
export type PlayMode = 'match' | 'derby';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

/** Short player-facing blurbs so Easy / Normal / Hard read as three different games. */
export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: '好球帶寬，對手常揮空',
  normal: '節奏均衡，投打都要準',
  hard: '窗口窄，對手少失誤',
};

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  match: '三局賽',
  derby: '全壘打大賽',
};

export interface DifficultyConfig {
  /** Player contact radius at the plate. */
  hitRadius: number;
  /** CPU aims near this plate Y; error grows as skill falls. */
  cpuAimSkill: number;
  /** Chance CPU actually swings when the ball reaches their target. */
  cpuSwingRate: number;
  /** Chance CPU takes an obvious ball (left/right) without swinging. */
  cpuTakeBall: number;
  /** Chance CPU matches swingDir to pitchLoc. */
  cpuAimDir: number;
  cpuPitchDelayMin: number;
  cpuPitchDelayMax: number;
  cpuFastPitchChance: number;
  /** Fair-ball distance bands (screen units from home). */
  outMax: number;
  singleMin: number;
  doubleMin: number;
  tripleMin: number;
  /** Weak contact (quality below this) is almost always an out unless very deep. */
  weakQuality: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: {
    hitRadius: 80,
    cpuAimSkill: 0.28,
    cpuSwingRate: 0.58,
    cpuTakeBall: 0.1,
    cpuAimDir: 0.32,
    cpuPitchDelayMin: 1.45,
    cpuPitchDelayMax: 2.25,
    cpuFastPitchChance: 0.22,
    outMax: 200,
    singleMin: 165,
    doubleMin: 280,
    tripleMin: 420,
    weakQuality: 0.18,
  },
  normal: {
    hitRadius: 60,
    cpuAimSkill: 0.62,
    cpuSwingRate: 0.82,
    cpuTakeBall: 0.35,
    cpuAimDir: 0.65,
    cpuPitchDelayMin: 1.05,
    cpuPitchDelayMax: 1.65,
    cpuFastPitchChance: 0.5,
    outMax: 175,
    singleMin: 175,
    doubleMin: 300,
    tripleMin: 450,
    weakQuality: 0.28,
  },
  hard: {
    hitRadius: 42,
    cpuAimSkill: 0.92,
    cpuSwingRate: 0.95,
    cpuTakeBall: 0.62,
    cpuAimDir: 0.92,
    cpuPitchDelayMin: 0.65,
    cpuPitchDelayMax: 1.05,
    cpuFastPitchChance: 0.78,
    outMax: 145,
    singleMin: 190,
    doubleMin: 330,
    tripleMin: 480,
    weakQuality: 0.38,
  },
};

export const DERBY_SWINGS = 10;

/** Grade a fair landing using distance + contact quality (not distance alone). */
export function gradeFairLanding(
  dist: number,
  quality: number,
  cfg: DifficultyConfig,
): { result: string; bases: number } {
  // Soft contact plays shorter for fielders; crushed balls play deeper.
  const effective = dist * (0.5 + quality * 0.65);

  if (quality < cfg.weakQuality && effective < cfg.tripleMin) {
    return { result: '軟弱飛球出局 (OUT)', bases: 0 };
  }
  if (effective >= cfg.tripleMin) {
    return { result: '三壘安打 (3B)', bases: 3 };
  }
  if (effective >= cfg.doubleMin) {
    return { result: '二壘安打 (2B)', bases: 2 };
  }
  if (effective >= cfg.singleMin) {
    return { result: '一壘安打 (1B)', bases: 1 };
  }
  if (effective < cfg.outMax || quality < cfg.weakQuality + 0.12) {
    return { result: '接殺出局 (OUT)', bases: 0 };
  }
  return { result: '一壘安打 (1B)', bases: 1 };
}

/** CPU swing target Y near the plate, with skill-based error. */
export function cpuSwingTargetY(skill: number, rng: () => number): number {
  const error = (1 - skill) * 90;
  return 448 + (rng() - 0.5) * error;
}
