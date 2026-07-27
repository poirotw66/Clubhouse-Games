export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Vec {
  x: number;
  y: number;
}

export type FruitType = 'normal' | 'golden' | 'cursed';

export interface Fruit {
  pos: Vec;
  type: FruitType;
}

export type EnemyType = 'wisp' | 'stalker' | 'spitter';

export interface Enemy {
  id: number;
  type: EnemyType;
  pos: Vec;
  prev: Vec;
  offset: number;
}

export interface Projectile {
  id: number;
  pos: Vec;
  prev: Vec;
  dir: Dir;
}

/** Floor trap that extends and retracts on a fixed tick cycle. */
export interface Spike {
  pos: Vec;
  offset: number;
}

export interface Boss {
  pos: Vec;
  hp: number;
  maxHp: number;
  hitFlashUntil: number;
}

export type EffectKind = 'ring' | 'burst' | 'slash';

export interface Effect {
  kind: EffectKind;
  pos: Vec;
  born: number;
  life: number;
  color: string;
  radius: number;
}

export type GameEventType =
  | 'eat'
  | 'golden'
  | 'cursed'
  | 'hurt'
  | 'kill'
  | 'dash'
  | 'bossHit'
  | 'bossDown'
  | 'exit'
  | 'floor'
  | 'die'
  | 'win';

export interface GameEvent {
  type: GameEventType;
  text?: string;
}

export type Phase = 'playing' | 'relic' | 'dead' | 'won';

export interface GameState {
  seed: number;
  rng: () => number;
  phase: Phase;
  endless: boolean;

  floor: number;
  layout: string;
  tiles: Uint8Array;
  spikes: Spike[];

  snake: Vec[];
  prevSnake: Vec[];
  dir: Dir;
  pendingDirs: Dir[];
  growth: number;

  fruits: Fruit[];
  eaten: number;
  quota: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  boss: Boss | null;
  exit: Vec | null;

  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  coins: number;
  score: number;
  kills: number;

  relics: RelicId[];
  relicChoices: RelicId[];
  pendingPicks: number;

  moveInterval: number;
  time: number;
  tick: number;
  invulnUntil: number;
  dashReadyAt: number;
  dashUntil: number;
  ghostUsed: boolean;
  echoCount: number;
  dashCount: number;

  effects: Effect[];
  events: GameEvent[];
  nextId: number;
}

export type RelicId =
  | 'shed'
  | 'swift'
  | 'torpor'
  | 'magnet'
  | 'gluttony'
  | 'ascetic'
  | 'core'
  | 'alchemy'
  | 'ghost'
  | 'heart'
  | 'thorn'
  | 'hourglass'
  | 'echo'
  | 'fang'
  | 'warp'
  | 'blood'
  | 'bag'
  | 'mend';
