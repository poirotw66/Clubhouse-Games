/**
 * Pure constants for Clockwork Keep. No DOM, no randomness — everything here
 * (and everywhere under src/game/) must be safe to import from a headless
 * Node check script via `node --experimental-strip-types`.
 */

export const GRID_W = 12;
export const GRID_H = 8;

/** Fixed single-cell entrance / exit, at the vertical mid-point of each edge. */
export const ENTRANCE = { x: 0, y: 4 } as const;
export const EXIT = { x: GRID_W - 1, y: 4 } as const;

/**
 * Neighbor expansion order used by every BFS/flow-field pass. Fixing this
 * order is what makes "equal-length paths resolve the same way every time"
 * (spec: 路徑長度相同時取固定的方向優先序) — BFS visits neighbors in this
 * order and only records the first (shortest) parent, so ties always resolve
 * to the same path deterministically.
 */
export const DIRECTIONS = [
  { dx: 1, dy: 0 }, // right (toward the exit) — first priority
  { dx: 0, dy: -1 }, // up
  { dx: 0, dy: 1 }, // down
  { dx: -1, dy: 0 }, // left
] as const;

export const FIXED_DT = 1 / 60;

export type Difficulty = 'relaxed' | 'standard' | 'harsh';

export interface DifficultyConfig {
  startingGold: number;
  startingLives: number;
  enemyHpMult: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  relaxed: { startingGold: 260, startingLives: 26, enemyHpMult: 0.8 },
  standard: { startingGold: 200, startingLives: 20, enemyHpMult: 1.0 },
  harsh: { startingGold: 150, startingLives: 14, enemyHpMult: 1.3 },
};

export type MapId = 'open' | 'corridor';

/** Fixed rock cells per map — impassable and unplaceable, used to shape the board. */
export const MAP_ROCKS: Record<MapId, Array<{ x: number; y: number }>> = {
  open: [],
  corridor: [
    // A skeleton of fixed rock blocks the player must route around; leaves
    // enough open cells to still reach a long legal path.
    { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 },
    { x: 3, y: 5 }, { x: 3, y: 6 },
    { x: 6, y: 2 }, { x: 6, y: 3 }, { x: 6, y: 4 }, { x: 6, y: 5 },
    { x: 9, y: 1 }, { x: 9, y: 2 },
    { x: 9, y: 5 }, { x: 9, y: 6 },
  ],
};

export type TowerType = 'crossbow' | 'grinder' | 'frost' | 'coil';

export interface TowerLevelStats {
  damage: number;
  range: number;
  /** Attacks per second (0 for the pure-control frost tower). */
  fireRate: number;
  cost: number;
}

export interface TowerDef {
  type: TowerType;
  name: string;
  targetsAir: boolean;
  splashRadius: number; // 0 = single target
  chainTargets: number; // 1 = no chain
  slowPercent: number; // 0 = no slow
  slowDurationSec: number;
  levels: [TowerLevelStats, TowerLevelStats, TowerLevelStats];
}

export const TOWER_DEFS: Record<TowerType, TowerDef> = {
  crossbow: {
    type: 'crossbow',
    name: '發條弩台',
    targetsAir: false,
    splashRadius: 0,
    chainTargets: 1,
    slowPercent: 0,
    slowDurationSec: 0,
    levels: [
      { damage: 8, range: 2.6, fireRate: 2.2, cost: 40 },
      { damage: 13, range: 2.9, fireRate: 2.4, cost: 35 },
      { damage: 20, range: 3.2, fireRate: 2.6, cost: 55 },
    ],
  },
  grinder: {
    type: 'grinder',
    name: '齒輪磨盤',
    targetsAir: false,
    splashRadius: 1.2,
    chainTargets: 1,
    slowPercent: 0,
    slowDurationSec: 0,
    levels: [
      { damage: 10, range: 1.6, fireRate: 1.0, cost: 55 },
      { damage: 16, range: 1.7, fireRate: 1.1, cost: 45 },
      { damage: 25, range: 1.9, fireRate: 1.25, cost: 70 },
    ],
  },
  frost: {
    type: 'frost',
    name: '冰霜噴罐',
    targetsAir: false,
    splashRadius: 1.5,
    chainTargets: 1,
    slowPercent: 0.35,
    slowDurationSec: 1.2,
    levels: [
      { damage: 0, range: 1.5, fireRate: 1.5, cost: 45 },
      { damage: 0, range: 1.7, fireRate: 1.6, cost: 35 },
      { damage: 0, range: 2.0, fireRate: 1.8, cost: 50 },
    ],
  },
  coil: {
    type: 'coil',
    name: '電磁線圈',
    targetsAir: true,
    splashRadius: 0,
    chainTargets: 3,
    slowPercent: 0,
    slowDurationSec: 0,
    levels: [
      { damage: 12, range: 2.4, fireRate: 0.9, cost: 90 },
      { damage: 18, range: 2.6, fireRate: 1.0, cost: 70 },
      { damage: 27, range: 2.9, fireRate: 1.1, cost: 110 },
    ],
  },
};

/** Chain lightning hops to the next-nearest unhit target within this radius. */
export const CHAIN_RADIUS = 2.5;

/** Slow effective speed can never drop below this fraction of base speed. */
export const MIN_SPEED_FACTOR = 0.4;

export type EnemyType = 'grunt' | 'runner' | 'ironclad' | 'kite' | 'boss';

export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  speed: number; // cells per second
  armor: number; // flat damage reduction per hit
  flying: boolean;
  killReward: number;
  lifeCost: number; // life lost when it reaches the exit
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  grunt: { type: 'grunt', name: '步兵玩偶', hp: 30, speed: 1.4, armor: 0, flying: false, killReward: 4, lifeCost: 1 },
  runner: { type: 'runner', name: '疾走鼠', hp: 16, speed: 2.6, armor: 0, flying: false, killReward: 5, lifeCost: 1 },
  ironclad: { type: 'ironclad', name: '鐵皮兵', hp: 90, speed: 1.0, armor: 6, flying: false, killReward: 9, lifeCost: 1 },
  kite: { type: 'kite', name: '紙鳶', hp: 22, speed: 1.8, armor: 0, flying: true, killReward: 6, lifeCost: 1 },
  boss: { type: 'boss', name: '首領', hp: 600, speed: 0.9, armor: 10, flying: false, killReward: 80, lifeCost: 5 },
};

export const TOTAL_WAVES = 20;

/** A boss shows up on every wave that is a multiple of this. */
export const BOSS_WAVE_INTERVAL = 10;

/**
 * Per-wave HP scaling for endless mode, compounding once past the 20-wave
 * table. It is exactly 1 for waves 1..20, so the challenge mode's balance is
 * untouched and the two modes stay independently tunable.
 *
 * Endless needs *some* compounding curve rather than flat stats: the board is
 * 12x8, so the number of towers — and therefore the player's maximum possible
 * DPS — has a hard ceiling, while enemy counts grow forever. Without this, an
 * air-covered defense that survives wave 25 survives every wave after it, and
 * "endless" measures patience rather than skill.
 */
export const ENDLESS_HP_GROWTH_PER_WAVE = 1.07;

export const PREP_TIME_SEC = 15;

/**
 * Gold paid per still-unresolved enemy when the next wave is called on top of
 * the one already running.
 *
 * This replaces a per-remaining-second bonus for calling early during prep,
 * which was measured as 56% of a run's entire income while costing the player
 * nothing whatsoever: no income accrues during prep and towers can be built
 * mid-wave anyway, so prep time had no opportunity cost and pressing the button
 * the instant it appeared was strictly dominant on every wave of every run.
 *
 * A button that is always correct is not a decision. Paying for *overlap*
 * instead is what the spec's "主動壓縮時間換取資源" actually describes: the
 * bonus scales with how dangerous the board is when you call, and the danger
 * is real, because both waves are now walking at you at once.
 */
export const OVERLAP_CALL_BONUS_PER_ENEMY = 8;

/** Score multiplier bump applied while waves are stacked on top of each other. */
export const OVERLAP_CALL_SCORE_MULT_BONUS = 0.5;

export const SELL_REFUND_RATE = 0.7;

export const WAVE_CLEAR_BONUS_BASE = 20;
export const WAVE_CLEAR_BONUS_PER_WAVE = 4;

export const SCORE_PER_LIFE = 15;
export const SCORE_PER_UNSPENT_GOLD = 1;

export const BEST_WAVE_KEY_PREFIX = 'clockwork-keep:best-wave:';
export const BEST_SCORE_KEY_PREFIX = 'clockwork-keep:best-score:';
export const BEST_TIME_KEY_PREFIX = 'clockwork-keep:best-time:';
