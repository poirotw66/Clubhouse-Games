/**
 * Attack event sequencer — feints, doubles, delays, speed-ups, side switches.
 */

import {
  pickProjectileType,
  type PracticeScenario,
} from './constants';
import type { OpponentDef, PatternTrait } from './opponents';

export type ParrySide = 'left' | 'right';

export type ProjectileId = 'SHURIKEN' | 'KUNAI' | 'BOMB' | 'SICKLE';

export interface AttackEvent {
  kind: 'strike' | 'feint';
  side: ParrySide;
  projectile: ProjectileId;
  /** Idle wait before this attack's warning starts (ms). */
  preDelayMs: number;
  /** Multiplier on base projectile flight duration (<1 = faster). */
  durationScale: number;
  /**
   * When set, the next event should fire this many ms after resolve
   * (double-strike chain). Overrides normal preDelay on the next pull.
   */
  chainGapMs?: number;
}

export interface PatternState {
  /** Alternating side memory for sideswitch / boss. */
  lastSide: ParrySide;
  /** Attacks resolved in this duel (for pace ramp). */
  strikeIndex: number;
  /** Pending forced chain gap from previous double. */
  pendingChainGapMs: number | null;
}

export function createPatternState(): PatternState {
  return {
    lastSide: 'left',
    strikeIndex: 0,
    pendingChainGapMs: null,
  };
}

function pickSide(
  trait: PatternTrait,
  state: PatternState,
  rand: () => number,
): ParrySide {
  if (trait === 'sideswitch' || trait === 'boss') {
    if (rand() < 0.72) {
      const next: ParrySide = state.lastSide === 'left' ? 'right' : 'left';
      state.lastSide = next;
      return next;
    }
  }
  const side: ParrySide = rand() < 0.5 ? 'left' : 'right';
  state.lastSide = side;
  return side;
}

function basePreDelay(trait: PatternTrait, rand: () => number): number {
  switch (trait) {
    case 'delay':
      return 1400 + rand() * 1800;
    case 'basic':
      return 700 + rand() * 900;
    case 'feints':
      return 600 + rand() * 1000;
    case 'double':
      return 500 + rand() * 700;
    case 'speedup':
      return 550 + rand() * 800;
    case 'sideswitch':
      return 650 + rand() * 900;
    case 'mixed':
      return 500 + rand() * 1100;
    case 'boss':
      return 400 + rand() * 1600;
    default:
      return 700 + rand() * 900;
  }
}

function durationScaleFor(trait: PatternTrait, rand: () => number, strikeIndex: number): number {
  if (trait === 'speedup') {
    return Math.max(0.55, 0.95 - strikeIndex * 0.04 - rand() * 0.12);
  }
  if (trait === 'boss') {
    return Math.max(0.58, 0.92 - strikeIndex * 0.03 - rand() * 0.1);
  }
  if (trait === 'delay') {
    return 0.95 + rand() * 0.15;
  }
  return 0.85 + rand() * 0.2;
}

function shouldFeint(trait: PatternTrait, rand: () => number): boolean {
  switch (trait) {
    case 'feints':
      return rand() < 0.42;
    case 'boss':
      return rand() < 0.28;
    case 'mixed':
      return rand() < 0.14;
    case 'basic':
      return rand() < 0.04;
    default:
      return rand() < 0.08;
  }
}

function shouldDouble(trait: PatternTrait, rand: () => number): boolean {
  if (trait === 'double') return rand() < 0.55;
  if (trait === 'boss') return rand() < 0.35;
  return false;
}

/**
 * Pull the next attack for an opponent. Mutates `state`.
 * Pass `scenario` override for daily / practice; default uses opponent.scenario.
 */
export function nextAttackEvent(
  opponent: OpponentDef,
  state: PatternState,
  rand: () => number = Math.random,
  scenario?: PracticeScenario,
): AttackEvent {
  const trait = opponent.trait;
  const mix = scenario ?? opponent.scenario;
  const projectile = pickProjectileType(mix, rand);
  const side = pickSide(trait, state, rand);

  let preDelayMs: number;
  if (state.pendingChainGapMs != null) {
    preDelayMs = state.pendingChainGapMs;
    state.pendingChainGapMs = null;
  } else {
    preDelayMs = basePreDelay(trait, rand);
  }

  const feint = shouldFeint(trait, rand);
  const scale = durationScaleFor(trait, rand, state.strikeIndex);

  const event: AttackEvent = {
    kind: feint ? 'feint' : 'strike',
    side,
    projectile,
    preDelayMs,
    durationScale: feint ? Math.min(1, scale + 0.1) : scale,
  };

  if (!feint && shouldDouble(trait, rand)) {
    event.chainGapMs = 180 + rand() * 220;
  }

  state.strikeIndex += 1;
  return event;
}

/** Apply chain gap after an event resolves so the next pull is immediate. */
export function noteEventResolved(state: PatternState, event: AttackEvent): void {
  if (event.chainGapMs != null && event.kind === 'strike') {
    state.pendingChainGapMs = event.chainGapMs;
  }
}

/** Challenge / practice: light feint chance with mixed sides. */
export function nextEndlessEvent(
  scenario: PracticeScenario,
  state: PatternState,
  rand: () => number = Math.random,
  feintChance = 0.1,
): AttackEvent {
  const projectile = pickProjectileType(scenario, rand);
  const side = pickSide('mixed', state, rand);
  let preDelayMs: number;
  if (state.pendingChainGapMs != null) {
    preDelayMs = state.pendingChainGapMs;
    state.pendingChainGapMs = null;
  } else {
    preDelayMs = 600 + rand() * 1200;
  }
  const feint = rand() < feintChance;
  const event: AttackEvent = {
    kind: feint ? 'feint' : 'strike',
    side,
    projectile,
    preDelayMs,
    durationScale: 0.9 + rand() * 0.15,
  };
  state.strikeIndex += 1;
  return event;
}
