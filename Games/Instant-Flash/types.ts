import type { ReactionRank } from './ranks.ts';
import type { ParrySide } from './patterns.ts';

export type PlayMode = 'practice' | 'challenge' | 'duel' | 'daily' | 'versus';

export const GameState = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  GAMEOVER: 'GAMEOVER',
} as const;
export type GameState = (typeof GameState)[keyof typeof GameState];

export const PlayerStance = {
  IDLE: 'IDLE',
  SHEATHED: 'SHEATHED', // Holding the button
  SLASHING: 'SLASHING', // Released button
  RECOVERING: 'RECOVERING', // Post-slash animation
  HIT: 'HIT', // Took damage
} as const;
export type PlayerStance = (typeof PlayerStance)[keyof typeof PlayerStance];

export const EnemyState = {
  IDLE: 'IDLE',
  WARNING: 'WARNING', // Red eye flash / projectile flight
  ATTACKING: 'ATTACKING', // The dash/hit frame
  COOLDOWN: 'COOLDOWN',
  DEAD: 'DEAD',
} as const;
export type EnemyState = (typeof EnemyState)[keyof typeof EnemyState];

export const ProjectileType = {
  SHURIKEN: 'SHURIKEN', // Standard speed
  KUNAI: 'KUNAI', // Very fast
  BOMB: 'BOMB', // Slow, varying trajectory
  SICKLE: 'SICKLE', // Medium, spinning wide
} as const;
export type ProjectileType = (typeof ProjectileType)[keyof typeof ProjectileType];

export const CounterResult = {
  NONE: 'NONE',
  PERFECT: 'PERFECT',
  GOOD: 'GOOD',
  EARLY: 'EARLY', // Released too early
  LATE: 'LATE', // Released too late (hit)
  MISS: 'MISS', // Didn't release at all
  FEINT: 'FEINT', // Slashed a fake-out
  WRONG_SIDE: 'WRONG_SIDE', // Correct timing, wrong parry side
} as const;
export type CounterResult = (typeof CounterResult)[keyof typeof CounterResult];

export interface ReactionRecord {
  id: number;
  timing: number; // ms deviation from perfect frame (0)
  result: CounterResult;
  side?: ParrySide;
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  perfects: number;
  goods: number;
  misses: number;
  earlies: number;
  feints: number;
  wrongSides: number;
  history: ReactionRecord[];
  /** Mean |timing| over Perfect/Good, or null if none. */
  avgReactionMs: number | null;
  /** Best (lowest abs) successful reaction this run. */
  bestReactionMs: number | null;
  rank: ReactionRank | null;
  /** Duel / daily: whether the player won. */
  duelWon: boolean | null;
  enemyHpLeft: number | null;
  /** Versus: points. */
  versusP1: number;
  versusP2: number;
  versusWinner: 1 | 2 | null;
}

export function emptyStats(): GameStats {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    goods: 0,
    misses: 0,
    earlies: 0,
    feints: 0,
    wrongSides: 0,
    history: [],
    avgReactionMs: null,
    bestReactionMs: null,
    rank: null,
    duelWon: null,
    enemyHpLeft: null,
    versusP1: 0,
    versusP2: 0,
    versusWinner: null,
  };
}
