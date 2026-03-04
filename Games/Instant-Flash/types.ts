export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
}

export enum PlayerStance {
  IDLE = 'IDLE',
  SHEATHED = 'SHEATHED', // Holding the button
  SLASHING = 'SLASHING', // Released button
  RECOVERING = 'RECOVERING', // Post-slash animation
  HIT = 'HIT' // Took damage
}

export enum EnemyState {
  IDLE = 'IDLE',
  WARNING = 'WARNING', // Red eye flash
  ATTACKING = 'ATTACKING', // The dash/hit frame
  COOLDOWN = 'COOLDOWN',
  DEAD = 'DEAD'
}

export enum ProjectileType {
  SHURIKEN = 'SHURIKEN', // Standard speed
  KUNAI = 'KUNAI',       // Very fast
  BOMB = 'BOMB',         // Slow, varying trajectory
  SICKLE = 'SICKLE'      // Medium, spinning wide
}

export enum CounterResult {
  NONE = 'NONE',
  PERFECT = 'PERFECT', // < 150ms deviation
  GOOD = 'GOOD', // < 300ms deviation
  EARLY = 'EARLY', // Released too early
  LATE = 'LATE', // Released too late (hit)
  MISS = 'MISS' // Didn't release at all
}

export interface ReactionRecord {
  id: number;
  timing: number; // ms deviation from perfect frame (0)
  result: CounterResult;
}

export interface GameStats {
  score: number;
  combo: number;
  maxCombo: number;
  perfects: number;
  goods: number;
  misses: number;
  history: ReactionRecord[];
}