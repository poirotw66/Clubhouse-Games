import type { Difficulty, EnemyType, MapId, TowerType } from './constants.ts';

export interface Cell {
  x: number;
  y: number;
}

/** true = blocked (rock or placed tower), false = walkable. */
export type OccupancyGrid = boolean[][];

export interface Tower {
  id: number;
  type: TowerType;
  x: number;
  y: number;
  level: 0 | 1 | 2; // index into TOWER_DEFS[type].levels
  investedGold: number; // purchase cost + all upgrade costs so far, for sell refund
  /** Seconds until the next attack (or, for frost, the next slow pulse). */
  cooldown: number;
}

export interface SlowEffect {
  percent: number;
  remaining: number; // seconds
}

export interface Enemy {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  armor: number;
  baseSpeed: number;
  flying: boolean;
  killReward: number;
  lifeCost: number;
  /** Ground movement: departure cell for the current leg + direction + 0..1 progress to the next cell. */
  cellX: number;
  cellY: number;
  dirX: number;
  dirY: number;
  progress: number; // 0..1 toward the next cell (ground only)
  /** Flyers: 0..1 along the straight entrance->exit segment, ignoring the maze entirely. */
  flightProgress: number;
  slowEffects: SlowEffect[];
  distanceToExit: number; // in cells; used for targeting priority, smaller = closer
  /** Cached continuous world position (cell units), refreshed every step for rendering + range checks. */
  worldX: number;
  worldY: number;
  reachedExit: boolean;
  dead: boolean;
  spawnOrder: number; // deterministic tie-breaker
}

export interface WaveSpawnEntry {
  type: EnemyType;
  delaySec: number; // seconds after wave start
  /**
   * The endless HP scaling of the wave this entry belongs to, captured when the
   * entry is built. Pinning it here rather than reading it off the live wave
   * number is what keeps overlapping waves coherent: when the player stacks
   * wave N+1 on top of wave N, the leftovers of wave N must still spawn at wave
   * N's strength.
   */
  hpMult: number;
}

export type GamePhase = 'prep' | 'wave' | 'won' | 'lost';

export interface ReversibleAction {
  kind: 'place' | 'upgrade';
  towerId: number;
  /** Gold spent by this action, refunded in full on undo. */
  cost: number;
  /** For 'place': the tower to remove entirely on undo. For 'upgrade': the level to restore. */
  priorLevel: 0 | 1 | 2 | null;
  x: number;
  y: number;
  type: TowerType;
}

export interface GameState {
  difficulty: Difficulty;
  mapId: MapId;
  endless: boolean;

  /**
   * Active mission id when started from the title mission pack; null for free play.
   * Constraints below are copied from the mission so the engine stays pure.
   */
  missionId: string | null;
  /** Towers the player may place; null means all four types. */
  allowedTowers: TowerType[] | null;
  /** When false, sell is refused (一鏡到底). */
  allowSell: boolean;
  /**
   * Clearing this wave ends the run as a win. Null means free-play endless
   * (never auto-win) or free-play challenge (TOTAL_WAVES via engine default).
   */
  winAtWave: number | null;

  gridW: number;
  gridH: number;
  rocks: Cell[];

  towers: Tower[];
  nextTowerId: number;

  enemies: Enemy[];
  nextEnemyId: number;
  nextSpawnOrder: number;

  gold: number;
  lives: number;
  /** Sum of kill rewards already scaled by each wave's score multiplier. */
  killScore: number;
  /** Derived total: killScore + lives*coefficient + unspent gold*coefficient. Recomputed every step. */
  score: number;

  wave: number; // 0 before first wave starts
  phase: GamePhase;
  prepTimer: number; // seconds remaining before auto-start, only meaningful in 'prep'
  pendingSpawns: WaveSpawnEntry[]; // remaining spawns for the in-progress wave
  waveElapsed: number; // seconds since the current wave's spawns began
  waveScoreMult: number; // score multiplier for the wave in progress (bumped by early call)

  lastReversible: ReversibleAction | null;

  elapsedTime: number; // total sim time, for best-time record
  kills: number;
}
