import type { BranchTemplate, Obstacle } from './constants';

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
}
