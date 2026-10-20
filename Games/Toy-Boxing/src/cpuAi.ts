// Style-driven CPU: personality knobs + player habit reading (not just reactChance).

import {
  preferredGuardHeight,
  type HabitMemory,
  type Height,
} from './combat.ts';
import { getOpponent, type OpponentDef, type OpponentId, type OpponentStyle } from './opponents.ts';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

/** Free-play tier blurbs (league opponents carry their own personalities). */
export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: '反應慢，常揮空',
  normal: '會擋會攻，中規中矩',
  hard: '高壓逼近，常撥招反擊',
};

/** Free-play fallback style when not in league mode. */
export interface DifficultyConfig {
  reactChance: number;
  attackChance: number;
  defenseBias: number;
  mistakeChance: number;
  moveSpeed: number;
  thinkMin: number;
  thinkMax: number;
  preferredDist: number;
  parryShare: number;
  highLowBias: number;
  feintRate: number;
  adaptHabit: number;
  guardHabit: number;
  hookBias: number;
  aggression: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: {
    reactChance: 0.18,
    attackChance: 0.3,
    defenseBias: 0.12,
    mistakeChance: 0.5,
    moveSpeed: 0.55,
    thinkMin: 0.45,
    thinkMax: 0.95,
    preferredDist: 120,
    parryShare: 0.04,
    highLowBias: 0,
    feintRate: 0.04,
    adaptHabit: 0.1,
    guardHabit: 0.2,
    hookBias: 0.3,
    aggression: 0.3,
  },
  normal: {
    reactChance: 0.55,
    attackChance: 0.55,
    defenseBias: 0.28,
    mistakeChance: 0.18,
    moveSpeed: 0.8,
    thinkMin: 0.2,
    thinkMax: 0.45,
    preferredDist: 95,
    parryShare: 0.18,
    highLowBias: 0.05,
    feintRate: 0.12,
    adaptHabit: 0.45,
    guardHabit: 0.45,
    hookBias: 0.4,
    aggression: 0.55,
  },
  hard: {
    reactChance: 0.88,
    attackChance: 0.78,
    defenseBias: 0.4,
    mistakeChance: 0.05,
    moveSpeed: 1.02,
    thinkMin: 0.08,
    thinkMax: 0.22,
    preferredDist: 82,
    parryShare: 0.4,
    highLowBias: 0,
    feintRate: 0.2,
    adaptHabit: 0.85,
    guardHabit: 0.65,
    hookBias: 0.45,
    aggression: 0.78,
  },
};

export type CpuActionName =
  | 'IDLE'
  | 'JAB'
  | 'HOOK'
  | 'SIGNATURE'
  | 'BLOCK'
  | 'DODGE'
  | 'PARRY'
  | 'HIT'
  | 'KO'
  | 'STAGGER'
  | 'WINDUP';

export type CpuIntent =
  | { type: 'move'; dir: 1 | -1; speed: number }
  | {
      type: 'act';
      action: 'JAB' | 'HOOK' | 'SIGNATURE' | 'BLOCK' | 'DODGE' | 'PARRY';
      height: Height;
      timer?: number;
      staminaCost: number;
      clearSuper?: boolean;
      feint?: boolean;
    }
  | { type: 'none' };

export interface CpuBrainInput {
  dist: number;
  stamina: number;
  superMeter: number;
  opponentAction: CpuActionName;
  /** Player punch height when attacking / winding up. */
  opponentHeight: Height | null;
  opponentInWindup: boolean;
  lastHitHeight: Height | null;
  habit: HabitMemory;
  difficulty: Difficulty;
  /** League opponent overrides free-play difficulty style. */
  opponentId?: OpponentId | null;
  rng?: () => number;
}

function styleFromDifficulty(d: Difficulty): OpponentStyle {
  const c = DIFFICULTY[d];
  return {
    aggression: c.aggression,
    highLowBias: c.highLowBias,
    feintRate: c.feintRate,
    guardHabit: c.guardHabit,
    adaptHabit: c.adaptHabit,
    hookBias: c.hookBias,
    reactChance: c.reactChance,
    mistakeChance: c.mistakeChance,
    parryShare: c.parryShare,
    moveSpeed: c.moveSpeed,
    thinkMin: c.thinkMin,
    thinkMax: c.thinkMax,
    preferredDist: c.preferredDist,
    defenseBias: c.defenseBias,
  };
}

export function resolveStyle(
  difficulty: Difficulty,
  opponentId?: OpponentId | null,
): OpponentStyle {
  if (opponentId) return getOpponent(opponentId).style;
  return styleFromDifficulty(difficulty);
}

export function nextThinkDelay(style: OpponentStyle, rng: () => number): number {
  return style.thinkMin + rng() * (style.thinkMax - style.thinkMin);
}

function pickAttackHeight(style: OpponentStyle, rng: () => number): Height {
  // Map bias [-1,1] → probability of high.
  const highChance = 0.5 + style.highLowBias * 0.45;
  return rng() < highChance ? 'high' : 'low';
}

function pickGuardHeight(
  style: OpponentStyle,
  habit: HabitMemory,
  lastHitHeight: Height | null,
  incomingHeight: Height | null,
  rng: () => number,
): Height {
  if (incomingHeight && rng() < style.reactChance) {
    // React to the tell: guard the height being wound up.
    return incomingHeight;
  }
  if (lastHitHeight && rng() < style.guardHabit) {
    return lastHitHeight;
  }
  if (rng() < style.adaptHabit) {
    return preferredGuardHeight(habit, style.adaptHabit);
  }
  return pickAttackHeight(style, rng);
}

const ATTACKING = new Set<CpuActionName>(['JAB', 'HOOK', 'SIGNATURE', 'WINDUP']);

/**
 * Pure decision for one AI tick (when thinkTimer elapsed or emergency react).
 */
export function decideCpuIntent(input: CpuBrainInput): CpuIntent {
  const rng = input.rng ?? Math.random;
  const style = resolveStyle(input.difficulty, input.opponentId);
  const { dist, stamina, superMeter, opponentAction } = input;

  const inStrike = dist < 130;
  const playerAttacking = ATTACKING.has(opponentAction) || input.opponentInWindup;

  // Emergency defense when a punch is coming (especially during readable wind-up).
  if (playerAttacking && inStrike && rng() < style.reactChance) {
    if (rng() < style.mistakeChance) {
      if (stamina >= 10) {
        return {
          type: 'act',
          action: 'JAB',
          height: pickAttackHeight(style, rng),
          staminaCost: 10,
        };
      }
      return { type: 'none' };
    }

    const guardH = pickGuardHeight(
      style,
      input.habit,
      input.lastHitHeight,
      input.opponentHeight,
      rng,
    );
    const roll = rng();
    if (roll < style.parryShare && stamina >= 10) {
      return { type: 'act', action: 'PARRY', height: guardH, staminaCost: 10 };
    }
    if (roll < style.parryShare + 0.32 && stamina >= 15) {
      return { type: 'act', action: 'DODGE', height: guardH, staminaCost: 15 };
    }
    return { type: 'act', action: 'BLOCK', height: guardH, staminaCost: 0 };
  }

  if (dist > style.preferredDist + 25) {
    return { type: 'move', dir: 1, speed: style.moveSpeed };
  }
  if (dist < style.preferredDist - 35 && rng() < 0.55) {
    return { type: 'move', dir: -1, speed: style.moveSpeed * 0.85 };
  }

  if (!inStrike) {
    return { type: 'move', dir: 1, speed: style.moveSpeed };
  }

  if (rng() < style.defenseBias) {
    const h = pickGuardHeight(style, input.habit, input.lastHitHeight, null, rng);
    return { type: 'act', action: 'BLOCK', height: h, staminaCost: 0 };
  }

  if (rng() > style.aggression) {
    return { type: 'none' };
  }

  if (rng() < style.mistakeChance) {
    if (rng() < 0.5 && stamina >= 15) {
      return { type: 'act', action: 'DODGE', height: 'high', staminaCost: 15 };
    }
    return {
      type: 'act',
      action: 'BLOCK',
      height: pickAttackHeight(style, rng),
      staminaCost: 0,
    };
  }

  // Feint: start a jab wind-up intent flagged so App can cancel early into block.
  if (rng() < style.feintRate && stamina >= 10) {
    return {
      type: 'act',
      action: 'JAB',
      height: pickAttackHeight(style, rng),
      staminaCost: 5,
      feint: true,
    };
  }

  if (superMeter >= 100 && rng() < 0.4) {
    return {
      type: 'act',
      action: 'SIGNATURE',
      height: pickAttackHeight(style, rng),
      staminaCost: 0,
      clearSuper: true,
    };
  }

  const height = pickAttackHeight(style, rng);
  // Close range used to force hooks (`dist < 100 || hookBias`), which erased
  // jab-first personalities (needle). Bias alone picks the tool; range only
  // nudges heavy hitters slightly when already hook-leaning.
  const hookChance =
    style.hookBias + (dist < 90 && style.hookBias >= 0.4 ? 0.12 : 0);
  if (stamina >= 25 && rng() < Math.min(0.92, hookChance)) {
    return { type: 'act', action: 'HOOK', height, staminaCost: 25 };
  }
  if (stamina >= 10) {
    return { type: 'act', action: 'JAB', height, staminaCost: 10 };
  }
  return {
    type: 'act',
    action: 'BLOCK',
    height: pickGuardHeight(style, input.habit, input.lastHitHeight, null, rng),
    staminaCost: 0,
  };
}

/** @deprecated kept for older imports — prefer resolveStyle */
export function getOpponentOrNull(id: OpponentId | null | undefined): OpponentDef | null {
  if (!id) return null;
  return getOpponent(id);
}
