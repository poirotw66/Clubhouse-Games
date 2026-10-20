import type { BranchTemplate, Obstacle } from './constants';
import type { ModifierId } from './modifiers';
import type { RunnerId } from './profiles';
import type { ThemeId } from './themes';

/** Optional per-run loadout. Defaults match the original balance constants. */
export interface RunConfig {
  runnerId: RunnerId;
  themeId: ThemeId;
  /** Free/daily only — challenge runs always pass []. */
  modifierIds: ModifierId[];
}

export const DEFAULT_RUN_CONFIG: RunConfig = {
  runnerId: 'standard',
  themeId: 'tunnel',
  modifierIds: [],
};

/** A branch template placed at a concrete junction: absolute distances instead
 * of offsets, and a lane assignment for this junction only. */
export interface PlacedBranch {
  templateId: string;
  name: string;
  lane: number;
  speedMult: number;
  reward: BranchTemplate['reward'];
  rewardAbsDistance: number;
  length: number;
  /** Absolute distances, derived from the template's offsets at placement time. */
  obstacles: Array<Obstacle & { absDistance: number; resolved: boolean }>;
  density: number;
}

export interface Junction {
  id: number;
  /** Absolute distance at which the branch lock happens. */
  lockDistance: number;
  branches: PlacedBranch[];
}

/** The branch currently being run, with per-run mutable progress on it. */
export interface ActiveBranch extends PlacedBranch {
  startDistance: number;
  endDistance: number;
  rewardCollected: boolean;
  hitCount: number;
}

export type Phase = 'playing' | 'caught' | 'ended';

export interface PlayerInput {
  /** -1/0/1, edge-triggered: only nonzero on the tick the key was freshly pressed. */
  laneStep: -1 | 0 | 1;
  /** Edge-triggered jump/slide presses. */
  jump: boolean;
  slide: boolean;
}

export interface RunState {
  seed: number;
  seedCode: string;
  tick: number;
  phase: Phase;
  elapsed: number;

  distance: number;
  buffer: number;
  playerSpeed: number;

  lane: number;
  jumpTimer: number;
  slideTimer: number;
  laneChangeCooldown: number;
  hitStunTimer: number;

  /** null while in the plain approach stretch before a junction is locked in. */
  activeBranch: ActiveBranch | null;
  /** Always defined once the run starts: the next junction, generated in full
   * (obstacles included) so its preview is complete rather than partial. */
  pendingJunction: Junction;
  nextJunctionId: number;

  noHitStreak: number;
  maxNoHitStreak: number;
  routeScore: number;
  scoreMult: number;
  branchesCleared: number;
  hitsTotal: number;
  /** Template ids this run has ever been offered, for the pool-reach measurement. */
  offeredTemplateIds: string[];

  /** Loadout baked in at createRun — affects pace/buffer/supply/density bias. */
  config: RunConfig;
  /** Effective MAX_BUFFER for this run after runner/modifier multipliers. */
  maxBuffer: number;
  /** Effective hit-stun duration for this run. */
  hitStunDuration: number;
  /** Effective lane-change cooldown for this run. */
  laneCooldown: number;
  /** Effective supply gain for this run. */
  supplyGain: number;
  /** Player pace multiplier from the selected runner. */
  speedMul: number;
  /** Train pace multiplier from the selected theme. */
  trainPaceMul: number;
  /** Extra density bias from theme + modifiers (used at junction placement). */
  densityBias: number;
  /** Score-reward step multiplier from modifiers. */
  scoreRewardMul: number;
  /** When true, supply pickups grant nothing. */
  suppressSupply: boolean;
}
