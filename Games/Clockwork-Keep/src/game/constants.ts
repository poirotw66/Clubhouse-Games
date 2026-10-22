/**
 * Pure constants for Clockwork Keep. No DOM, no randomness — everything here
 * (and everywhere under src/game/) must be safe to import from a headless
 * Node check script via `node --experimental-strip-types`.
 */

export const GRID_W = 12;
export const GRID_H = 8;

/** Default single-cell entrance / exit, at the vertical mid-point of each edge. */
export const ENTRANCE = { x: 0, y: 4 } as const;
export const EXIT = { x: GRID_W - 1, y: 4 } as const;

export interface PortalCell {
  x: number;
  y: number;
}

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

/**
 * The three settings sit on the part of the HP curve that actually responds.
 *
 * enemyHpMult is a narrow lever, and the old values 0.8 / 1.0 / 1.3 had two of
 * the three outside its working range entirely. Sweeping it against lives lost
 * (the game is fully deterministic, so each of these is an exact value rather
 * than an estimate):
 *
 *   0.80  0.90  1.00  1.05 | 1.10 | 1.15  1.20 | 1.25  1.30  1.40
 *      0     0     0     0 |    5 |   12    13 |   12    12    11
 *
 * Nothing at all below 1.05, everything between 1.05 and 1.20, and a genuine
 * plateau above it that even reverses slightly by 1.40. So relaxed at 0.8 and
 * standard at 1.0 were the SAME experience — both flawless clears — and only
 * harsh did anything, from the far side of the plateau.
 *
 * After bloater/shellbug entered the wave table, the old 1.0 / 1.1 / 1.2 band
 * collapsed again (extra kill gold funded perfect mid-game clears). Retuned on
 * the classic four-tower spend-all pilot to land near 0 / 5 / 13 lives lost.
 * check-economy.mjs holds the three apart.
 */
export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  relaxed: { startingGold: 260, startingLives: 24, enemyHpMult: 1.0 },
  standard: { startingGold: 200, startingLives: 20, enemyHpMult: 1.12 },
  harsh: { startingGold: 150, startingLives: 14, enemyHpMult: 1.15 },
};

export type MapId = 'open' | 'corridor' | 'fork' | 'islands' | 'dual' | 'gauntlet';

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
  /**
   * 分岔：前段兩廊再匯合，逼玩家決定火力壓在上廊、下廊或匯合點。
   * Entrance (0,4) and exit (11,4) stay open; rocks force a Y-split.
   */
  fork: [
    { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 },
    { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 7 },
    { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 },
    { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 5 }, { x: 7, y: 6 },
    { x: 9, y: 3 }, { x: 9, y: 4 }, { x: 9, y: 5 },
  ],
  /**
   * 群島：散布岩塊，迷宮自由度高但長廊被打斷，考驗補位與對空覆蓋。
   */
  islands: [
    { x: 2, y: 1 }, { x: 2, y: 6 },
    { x: 3, y: 3 }, { x: 3, y: 4 },
    { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 6 },
    { x: 6, y: 4 }, { x: 6, y: 5 },
    { x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 6 },
    { x: 10, y: 1 }, { x: 10, y: 5 }, { x: 10, y: 6 },
  ],
  /**
   * 雙口：上下兩個入口匯向同一出口。中段岩牆切開雙廊，逼玩家同時覆蓋兩路
   * （或把火力壓在匯合點）。
   */
  dual: [
    { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 },
    { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 },
    { x: 6, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 5 }, { x: 6, y: 6 },
    { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 },
    { x: 9, y: 1 }, { x: 9, y: 6 },
  ],
  /**
   * 隘道：密集岩障形成可拉長的曲折廊道，擺位空間緊、錯一格就封路風險高。
   */
  gauntlet: [
    { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 5 }, { x: 1, y: 6 },
    { x: 2, y: 3 }, { x: 2, y: 4 },
    { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 6 }, { x: 3, y: 7 },
    { x: 4, y: 3 }, { x: 4, y: 4 }, { x: 4, y: 5 },
    { x: 5, y: 1 }, { x: 5, y: 2 },
    { x: 6, y: 4 }, { x: 6, y: 5 }, { x: 6, y: 6 },
    { x: 7, y: 0 }, { x: 7, y: 1 }, { x: 7, y: 2 },
    { x: 8, y: 4 }, { x: 8, y: 5 },
    { x: 9, y: 1 }, { x: 9, y: 2 }, { x: 9, y: 3 }, { x: 9, y: 6 },
    { x: 10, y: 5 }, { x: 10, y: 6 },
  ],
};

/**
 * Entrances per map. Most maps keep the classic single mid-left portal;
 * `dual` uses two left-edge portals that must both stay path-connected.
 */
export const MAP_ENTRANCES: Record<MapId, readonly PortalCell[]> = {
  open: [ENTRANCE],
  corridor: [ENTRANCE],
  fork: [ENTRANCE],
  islands: [ENTRANCE],
  dual: [
    { x: 0, y: 1 },
    { x: 0, y: 6 },
  ],
  gauntlet: [ENTRANCE],
};

/** Mission clears required before a map appears in free-play setup. */
export const MAP_UNLOCK_CLEARS: Record<MapId, number> = {
  open: 0,
  corridor: 0,
  fork: 1,
  islands: 2,
  dual: 3,
  gauntlet: 4,
};

export type TowerType = 'crossbow' | 'grinder' | 'frost' | 'coil' | 'hammer' | 'mortar';

/** Exclusive capstone after shared base levels (L0 buy → L1 shared → choose A or B). */
export type BranchId = 'a' | 'b';

export interface TowerLevelStats {
  damage: number;
  range: number;
  /** Attacks per second (0 for the pure-control frost tower). */
  fireRate: number;
  cost: number;
  /** Optional combat overrides when this tier differs from TowerDef defaults. */
  splashRadius?: number;
  chainTargets?: number;
  slowPercent?: number;
  slowDurationSec?: number;
  targetsAir?: boolean;
  /** Flat armor pierce applied before armor reduction (crossbow 穿甲釘). */
  armorPierce?: number;
}

export interface TowerBranchDef {
  id: BranchId;
  name: string;
  /** One-line Traditional Chinese tradeoff. */
  blurb: string;
  stats: TowerLevelStats;
}

export interface TowerDef {
  type: TowerType;
  name: string;
  targetsAir: boolean;
  splashRadius: number; // 0 = single target
  chainTargets: number; // 1 = no chain
  slowPercent: number; // 0 = no slow
  slowDurationSec: number;
  /** Shared base: [purchase L0, shared upgrade L1]. Capstone is `branches`. */
  levels: [TowerLevelStats, TowerLevelStats];
  branches: [TowerBranchDef, TowerBranchDef];
}

/**
 * Branch B unlocks after this many mission clears (A is always available).
 * Keeps early runs simple while rewarding pack progress.
 */
export const BRANCH_B_UNLOCK_CLEARS = 2;

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
    ],
    branches: [
      {
        id: 'a',
        name: '穿甲釘',
        blurb: '單發略低＋穿甲——剋鐵皮／首領',
        // Calibrated so spend-all + branch A still costs 0/5/12 lives on
        // relaxed/standard/harsh (same band as pre-branch L3). Pierce trades
        // raw DPS for armored targets; B is the opposite trash-clear profile.
        stats: { damage: 18, range: 3.15, fireRate: 2.35, cost: 55, armorPierce: 3 },
      },
      {
        id: 'b',
        name: '連射弦',
        blurb: '射速拉滿、無穿甲——清雜兵',
        stats: { damage: 14, range: 3.3, fireRate: 3.2, cost: 55 },
      },
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
    ],
    branches: [
      {
        id: 'a',
        name: '廣域齒',
        blurb: '濺射略大、傷害略降——打群',
        stats: { damage: 22, range: 1.95, fireRate: 1.2, cost: 70, splashRadius: 1.45 },
      },
      {
        id: 'b',
        name: '重碾輪',
        blurb: '高傷害、濺射縮小——打硬目標',
        stats: { damage: 32, range: 1.85, fireRate: 1.15, cost: 70, splashRadius: 0.9 },
      },
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
    ],
    branches: [
      {
        id: 'a',
        name: '深凍',
        blurb: '減速更強、範圍較窄——鎖單路',
        stats: {
          damage: 0,
          range: 1.85,
          fireRate: 1.75,
          cost: 50,
          slowPercent: 0.42,
          slowDurationSec: 1.35,
          splashRadius: 1.35,
        },
      },
      {
        id: 'b',
        name: '寒霧',
        blurb: '範圍更廣、減速較弱——罩多路',
        stats: {
          damage: 0,
          range: 2.25,
          fireRate: 1.85,
          cost: 50,
          slowPercent: 0.28,
          slowDurationSec: 1.1,
          splashRadius: 2.05,
        },
      },
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
    ],
    branches: [
      {
        id: 'a',
        name: '對空弧',
        blurb: '連鎖更多、單發略低——清紙鳶群',
        stats: { damage: 24, range: 2.95, fireRate: 1.1, cost: 110, chainTargets: 4, targetsAir: true },
      },
      {
        id: 'b',
        name: '聚能雷',
        blurb: '高單發、連鎖較少——打首領',
        stats: { damage: 36, range: 2.85, fireRate: 1.0, cost: 110, chainTargets: 2, targetsAir: true },
      },
    ],
  },
  /**
   * 彈簧錘：短程高單發、極低射速。專剋鐵皮／腫脹／首領；對疾走鼠與紙鳶偏弱。
   * 與弩台形成「射速清雜 vs 重擊破甲」取捨。
   */
  hammer: {
    type: 'hammer',
    name: '彈簧錘',
    targetsAir: false,
    splashRadius: 0,
    chainTargets: 1,
    slowPercent: 0,
    slowDurationSec: 0,
    levels: [
      { damage: 28, range: 1.7, fireRate: 0.55, cost: 65, armorPierce: 2 },
      { damage: 40, range: 1.85, fireRate: 0.6, cost: 55, armorPierce: 3 },
    ],
    branches: [
      {
        id: 'a',
        name: '碎甲錘',
        blurb: '高穿甲、單發略低——剋鐵殼／首領',
        stats: { damage: 48, range: 2.0, fireRate: 0.65, cost: 80, armorPierce: 8 },
      },
      {
        id: 'b',
        name: '震盪錘',
        blurb: '更高單發＋小濺射——清腫脹團',
        stats: { damage: 62, range: 1.95, fireRate: 0.55, cost: 80, armorPierce: 2, splashRadius: 0.85 },
      },
    ],
  },
  /**
   * 發條迫擊砲：長射程濺射、可對空、射速慢。專剋腫脹團與鐵殼甲蟲；近身漏怪時偏弱。
   */
  mortar: {
    type: 'mortar',
    name: '發條迫擊砲',
    targetsAir: true,
    splashRadius: 1.35,
    chainTargets: 1,
    slowPercent: 0,
    slowDurationSec: 0,
    levels: [
      { damage: 14, range: 3.6, fireRate: 0.65, cost: 80, targetsAir: true },
      { damage: 20, range: 3.85, fireRate: 0.7, cost: 65, targetsAir: true },
    ],
    branches: [
      {
        id: 'a',
        name: '散彈砲',
        blurb: '濺射更大、單發略低——打群',
        stats: {
          damage: 26,
          range: 4.05,
          fireRate: 0.75,
          cost: 95,
          splashRadius: 1.85,
          targetsAir: true,
        },
      },
      {
        id: 'b',
        name: '穿空彈',
        blurb: '濺射縮小＋穿甲——剋鐵殼甲蟲',
        stats: {
          damage: 34,
          range: 4.2,
          fireRate: 0.7,
          cost: 95,
          splashRadius: 1.05,
          armorPierce: 5,
          targetsAir: true,
        },
      },
    ],
  },
};

/** Chain lightning hops to the next-nearest unhit target within this radius. */
export const CHAIN_RADIUS = 2.5;

/** Slow effective speed can never drop below this fraction of base speed. */
export const MIN_SPEED_FACTOR = 0.4;

export type EnemyType =
  | 'grunt'
  | 'runner'
  | 'ironclad'
  | 'kite'
  | 'gearbug'
  | 'bloater'
  | 'shellbug'
  | 'boss';

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
  /** Compact armored pest — forces pierce or splash earlier than ironclad packs. */
  gearbug: { type: 'gearbug', name: '齒輪蟲', hp: 40, speed: 1.9, armor: 4, flying: false, killReward: 7, lifeCost: 1 },
  /** High-HP sponge with no armor — rewards splash / mortar over pierce DPS. */
  bloater: { type: 'bloater', name: '腫脹兵', hp: 120, speed: 0.85, armor: 0, flying: false, killReward: 8, lifeCost: 1 },
  /** Flying + flat armor — ground-only or non-pierce air towers struggle. */
  shellbug: { type: 'shellbug', name: '鐵殼甲蟲', hp: 40, speed: 1.55, armor: 5, flying: true, killReward: 7, lifeCost: 1 },
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
