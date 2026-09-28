// Timing Windows (in milliseconds)
// The "Impact Frame" is 0. 
// Negative means early release, Positive means late.
// But for this game logic: Warning happens -> Delay -> Impact.
// Player must release closest to Impact.

export const WARNING_DURATION_MIN = 1000;
export const WARNING_DURATION_MAX = 2200;

// Projectile Flight Durations (Speed)
export const DURATION_SHURIKEN = 550; // Standard
export const DURATION_KUNAI = 380;    // FAST! Requires instant reaction
export const DURATION_BOMB = 850;     // Slow... baits early release
export const DURATION_SICKLE = 600;   // Medium

// Windows calculated as absolute difference from Impact Time
export const WINDOW_PERFECT = 120; 
export const WINDOW_GOOD = 300;    

// Gameplay
export const MAX_HP = 100;
export const DAMAGE_PLAYER_HIT = 25; 
export const DAMAGE_PLAYER_BLOCK = 5; 
export const HEAL_PERFECT = 15; 

export const SCORE_PERFECT = 1000;
export const SCORE_GOOD = 300;

// Visuals
export const HIT_STOP_DURATION = 150; 
export const SHAKE_DURATION = 300;

// Colors
export const COLOR_PERFECT = '#3b82f6'; // blue-500
export const COLOR_GOOD = '#eab308'; // yellow-500
export const COLOR_FAIL = '#ef4444'; // red-500
export const COLOR_NEUTRAL = '#94a3b8'; // slate-400

/** Practice intensity floor added into the dynamic tier ramp. */
export type PracticeIntensity = 0 | 2 | 4;

export const INTENSITY_LABELS: Record<PracticeIntensity, string> = {
  0: '輕鬆',
  2: '標準',
  4: '高壓',
};

/** Named practice drills that change projectile mix (and default intensity). */
export type PracticeScenario = 'mixed' | 'kunai' | 'bomb' | 'chaos';

export const SCENARIO_IDS: readonly PracticeScenario[] = [
  'mixed',
  'kunai',
  'bomb',
  'chaos',
] as const;

export const SCENARIO_LABELS: Record<PracticeScenario, string> = {
  mixed: '標準亂舞',
  kunai: '飛刀特訓',
  bomb: '炸彈誘餌',
  chaos: '亂舞高壓',
};

export const SCENARIO_BLURBS: Record<PracticeScenario, string> = {
  mixed: '四種暗器均衡出現',
  kunai: '飛刀為主，練極速放開',
  bomb: '慢彈偏多，忍耐勿早砍',
  chaos: '快刀＋鐮刀混打，預設高壓',
};

/** Cumulative weight tables — must sum to 1. Challenge mode uses `mixed`. */
export const SCENARIO_WEIGHTS: Record<
  PracticeScenario,
  ReadonlyArray<{ type: 'SHURIKEN' | 'KUNAI' | 'BOMB' | 'SICKLE'; weight: number }>
> = {
  mixed: [
    { type: 'SHURIKEN', weight: 0.4 },
    { type: 'KUNAI', weight: 0.25 },
    { type: 'BOMB', weight: 0.2 },
    { type: 'SICKLE', weight: 0.15 },
  ],
  kunai: [
    { type: 'KUNAI', weight: 0.55 },
    { type: 'SHURIKEN', weight: 0.25 },
    { type: 'SICKLE', weight: 0.15 },
    { type: 'BOMB', weight: 0.05 },
  ],
  bomb: [
    { type: 'BOMB', weight: 0.5 },
    { type: 'SHURIKEN', weight: 0.25 },
    { type: 'SICKLE', weight: 0.15 },
    { type: 'KUNAI', weight: 0.1 },
  ],
  chaos: [
    { type: 'KUNAI', weight: 0.35 },
    { type: 'SICKLE', weight: 0.3 },
    { type: 'BOMB', weight: 0.2 },
    { type: 'SHURIKEN', weight: 0.15 },
  ],
};

export const SCENARIO_DEFAULT_INTENSITY: Record<PracticeScenario, PracticeIntensity> = {
  mixed: 2,
  kunai: 2,
  bomb: 0,
  chaos: 4,
};

export function pickProjectileType(
  scenario: PracticeScenario,
  rand: () => number = Math.random,
): 'SHURIKEN' | 'KUNAI' | 'BOMB' | 'SICKLE' {
  const table = SCENARIO_WEIGHTS[scenario];
  const roll = rand();
  let acc = 0;
  for (const row of table) {
    acc += row.weight;
    if (roll < acc) return row.type;
  }
  return table[table.length - 1].type;
}

/** Difficulty ramps with score and combo — windows tighten, attacks speed up. */
export function getDifficultyTier(
  score: number,
  combo: number,
  baseTier: number = 0,
): number {
  return Math.min(6, baseTier + Math.floor(score / 4000) + Math.floor(combo / 8));
}

export function getTimingWindows(
  score: number,
  combo: number,
  baseTier: number = 0,
): {
  perfect: number;
  good: number;
} {
  const tier = getDifficultyTier(score, combo, baseTier);
  return {
    perfect: Math.max(55, WINDOW_PERFECT - tier * 10),
    good: Math.max(160, WINDOW_GOOD - tier * 18),
  };
}

export function getAttackDelayRange(
  score: number,
  baseTier: number = 0,
): { min: number; max: number } {
  const tier = Math.min(5, baseTier + Math.floor(score / 6000));
  const cut = tier * 140;
  return {
    min: Math.max(550, WARNING_DURATION_MIN - cut),
    max: Math.max(1100, WARNING_DURATION_MAX - cut),
  };
}

export function getProjectileDurationScale(
  score: number,
  baseTier: number = 0,
): number {
  const tier = Math.min(4, baseTier + Math.floor(score / 8000));
  return Math.max(0.72, 1 - tier * 0.07);
}
