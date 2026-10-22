// Match / derby difficulty knobs for Toy Baseball.

export type Difficulty = 'easy' | 'normal' | 'hard';
export type PlayMode = 'match' | 'derby' | 'season';
export type InningsLength = 3 | 6 | 9;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

/** Short player-facing blurbs so Easy / Normal / Hard read as three different games. */
export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: '打擊窗寬、守備較慢，先練讀球與時機',
  normal: '配球有套路，往空檔打才容易安打',
  hard: '窗口窄、守備緊，對手少失誤、配球刁',
};

export const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  match: '正規賽',
  derby: '全壘打大賽',
  season: '球季模式',
};

export const INNINGS_OPTIONS: InningsLength[] = [3, 6, 9];

export const INNINGS_LABELS: Record<InningsLength, string> = {
  3: '3 局',
  6: '6 局',
  9: '9 局',
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
  /** Fair-ball distance bands (screen units from home) — used with fielding. */
  outMax: number;
  singleMin: number;
  doubleMin: number;
  tripleMin: number;
  /** Weak contact (quality below this) is almost always an out unless very deep. */
  weakQuality: number;
  /** Multiplier on fielder chase speed when the player bats (lower = more gaps). */
  fielderSpeedMul: number;
  /** Defense alignment bias when player bats. */
  defensePullChance: number;
  defenseDeepChance: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: {
    hitRadius: 84,
    cpuAimSkill: 0.28,
    cpuSwingRate: 0.55,
    cpuTakeBall: 0.08,
    cpuAimDir: 0.3,
    cpuPitchDelayMin: 1.45,
    cpuPitchDelayMax: 2.25,
    outMax: 190,
    singleMin: 150,
    doubleMin: 300,
    tripleMin: 480,
    weakQuality: 0.16,
    fielderSpeedMul: 0.82,
    defensePullChance: 0.05,
    defenseDeepChance: 0.05,
  },
  normal: {
    hitRadius: 62,
    cpuAimSkill: 0.62,
    cpuSwingRate: 0.8,
    cpuTakeBall: 0.35,
    cpuAimDir: 0.65,
    cpuPitchDelayMin: 1.05,
    cpuPitchDelayMax: 1.65,
    outMax: 170,
    singleMin: 165,
    doubleMin: 320,
    tripleMin: 500,
    weakQuality: 0.26,
    fielderSpeedMul: 1,
    defensePullChance: 0.2,
    defenseDeepChance: 0.15,
  },
  hard: {
    hitRadius: 44,
    cpuAimSkill: 0.92,
    cpuSwingRate: 0.94,
    cpuTakeBall: 0.62,
    cpuAimDir: 0.92,
    cpuPitchDelayMin: 0.65,
    cpuPitchDelayMax: 1.05,
    outMax: 150,
    singleMin: 185,
    doubleMin: 350,
    tripleMin: 530,
    weakQuality: 0.36,
    fielderSpeedMul: 1.12,
    defensePullChance: 0.35,
    defenseDeepChance: 0.3,
  },
};

export const DERBY_SWINGS = 10;

export type ContactGrade = 'perfect' | 'good' | 'ok' | 'weak';

export function gradeContact(quality: number): ContactGrade {
  if (quality >= 0.85) return 'perfect';
  if (quality >= 0.65) return 'good';
  if (quality >= 0.4) return 'ok';
  return 'weak';
}

export const CONTACT_LABELS: Record<ContactGrade, string> = {
  perfect: '完美擊球！',
  good: '扎實打擊',
  ok: '一般接觸',
  weak: '軟弱接觸',
};

/** CPU swing target Y near the plate, with skill-based error. */
export function cpuSwingTargetY(skill: number, rng: () => number): number {
  const error = (1 - skill) * 90;
  return 448 + (rng() - 0.5) * error;
}

/** Pick defense alignment from difficulty knobs. */
export function pickDefenseAlignment(
  cfg: DifficultyConfig,
  rng: () => number,
): 'normal' | 'pull' | 'deep' {
  const r = rng();
  if (r < cfg.defenseDeepChance) return 'deep';
  if (r < cfg.defenseDeepChance + cfg.defensePullChance) return 'pull';
  return 'normal';
}
