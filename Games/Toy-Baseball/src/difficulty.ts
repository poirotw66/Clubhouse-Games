// Match / derby difficulty knobs for Toy Baseball.

export type Difficulty = 'easy' | 'normal' | 'hard';
export type PlayMode = 'match' | 'derby';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
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
    hitRadius: 72,
    cpuAimSkill: 0.35,
    cpuSwingRate: 0.7,
    cpuTakeBall: 0.15,
    cpuAimDir: 0.4,
    cpuPitchDelayMin: 1.35,
    cpuPitchDelayMax: 2.1,
    cpuFastPitchChance: 0.3,
    outMax: 195,
    singleMin: 170,
    doubleMin: 290,
    tripleMin: 430,
    weakQuality: 0.22,
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
    hitRadius: 48,
    cpuAimSkill: 0.88,
    cpuSwingRate: 0.92,
    cpuTakeBall: 0.55,
    cpuAimDir: 0.88,
    cpuPitchDelayMin: 0.75,
    cpuPitchDelayMax: 1.2,
    cpuFastPitchChance: 0.72,
    outMax: 155,
    singleMin: 185,
    doubleMin: 320,
    tripleMin: 470,
    weakQuality: 0.34,
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
