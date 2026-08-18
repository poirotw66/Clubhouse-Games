import type { SpellCard } from './constants';

export interface Vec {
  x: number;
  y: number;
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  /** Current heading in radians; waveforms rewrite this over time. */
  angle: number;
  speed: number;
  r: number;
  hue: number;
  age: number;
  lifetime: number;
  waveform: import('./constants').Waveform;
  /** Radians/sec applied to `angle` for spiral bullets. */
  curl: number;
  /** Whether this bullet has already been counted toward the graze multiplier. */
  grazed: boolean;
  /**
   * Part of a field-spanning wall. Drawn differently on purpose: a row that
   * denies the whole screen except one gap has to be readable at a glance as a
   * different kind of threat from a spray, or the pattern reads as unfair
   * rather than as a rule you can play around.
   */
  isWall?: boolean;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  r: number;
  /** Boss enemies host spell cards; midway enemies just run one emitter set. */
  isBoss: boolean;
  card: SpellCard | null;
  cardIndex: number;
  cardElapsed: number;
  /** Per-emitter accumulated time, so each emitter keeps its own volley cadence. */
  emitterClocks: number[];
  emitterAngles: number[];
  /** Target position for the simple entry glide; null once it has arrived. */
  entryTo: Vec | null;
  entryFrom: Vec | null;
  entryT: number;
  score: number;
}

export interface PowerFragment {
  id: number;
  x: number;
  y: number;
  vy: number;
  age: number;
}

export type Phase = 'playing' | 'upgrade' | 'won' | 'lost';

export interface PlayerInput {
  /** -1..1 each; the engine normalises diagonals. */
  dx: number;
  dy: number;
  focus: boolean;
  bomb: boolean;
}

export interface RunState {
  seed: number;
  seedCode: string;
  tick: number;
  phase: Phase;

  stage: number;
  /** Continuous difficulty scalar. Everything about the danmaku scales off this. */
  intensity: number;

  px: number;
  py: number;
  lives: number;
  bombs: number;
  powerTier: number;
  invuln: number;
  focus: boolean;

  bullets: Bullet[];
  enemies: Enemy[];
  fragments: PowerFragment[];
  nextId: number;

  grazeCount: number;
  grazeMult: number;
  score: number;
  captures: number;

  /** Upgrade ids taken this run, in order. */
  upgrades: string[];
  /** The three ids currently on offer, when phase is 'upgrade'. */
  offered: string[];

  /** Seconds of midway remaining before the stage boss arrives. */
  midwayLeft: number;
  bossSpawned: boolean;
  elapsed: number;
  /** Set when a spell card ends, for the banner; cleared after it is shown. */
  lastCardResult: 'captured' | 'timeout' | null;
}
