// Reactive CPU: reads distance + opponent action, paced by difficulty.
// Ceiling: no frame-perfect combo trees — upgrade path = telegraph reading + feints.

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

/** Short player-facing blurbs so Easy / Normal / Hard read as three different opponents. */
export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: '反應慢，常揮空',
  normal: '會擋會攻，中規中矩',
  hard: '高壓逼近，常撥招反擊',
};

export interface DifficultyConfig {
  /** Chance to react when the player starts an attack in range. */
  reactChance: number;
  /** How aggressively to throw punches when in range (per think tick). */
  attackChance: number;
  /** Prefer block/dodge over swinging when mid-range. */
  defenseBias: number;
  /** Random whiff / wrong action chance. */
  mistakeChance: number;
  moveSpeed: number;
  thinkMin: number;
  thinkMax: number;
  preferredDist: number;
  parryShare: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: {
    reactChance: 0.14,
    attackChance: 0.28,
    defenseBias: 0.08,
    mistakeChance: 0.55,
    moveSpeed: 0.5,
    thinkMin: 0.5,
    thinkMax: 1.05,
    preferredDist: 120,
    parryShare: 0.02,
  },
  normal: {
    reactChance: 0.55,
    attackChance: 0.55,
    defenseBias: 0.28,
    mistakeChance: 0.18,
    moveSpeed: 0.78,
    thinkMin: 0.22,
    thinkMax: 0.48,
    preferredDist: 95,
    parryShare: 0.18,
  },
  hard: {
    reactChance: 0.9,
    attackChance: 0.8,
    defenseBias: 0.48,
    mistakeChance: 0.03,
    moveSpeed: 1.02,
    thinkMin: 0.08,
    thinkMax: 0.22,
    preferredDist: 82,
    parryShare: 0.42,
  },
};

export type CpuActionName =
  | 'IDLE'
  | 'JAB'
  | 'HOOK'
  | 'BLOCK'
  | 'DODGE'
  | 'PARRY'
  | 'HIT'
  | 'KO'
  | 'STAGGER';

export type CpuIntent =
  | { type: 'move'; dir: 1 | -1; speed: number }
  | {
      type: 'act';
      action: 'JAB' | 'HOOK' | 'BLOCK' | 'DODGE' | 'PARRY';
      timer: number;
      staminaCost: number;
      clearSuper?: boolean;
    }
  | { type: 'none' };

const ATTACKING = new Set<CpuActionName>(['JAB', 'HOOK']);

export function nextThinkDelay(cfg: DifficultyConfig, rng: () => number): number {
  return cfg.thinkMin + rng() * (cfg.thinkMax - cfg.thinkMin);
}

/**
 * Pure decision for one AI tick (when thinkTimer elapsed or emergency react).
 */
export function decideCpuIntent(input: {
  dist: number;
  stamina: number;
  superMeter: number;
  opponentAction: CpuActionName;
  difficulty: Difficulty;
  rng?: () => number;
}): CpuIntent {
  const rng = input.rng ?? Math.random;
  const cfg = DIFFICULTY[input.difficulty];
  const { dist, stamina, superMeter, opponentAction } = input;

  const inStrike = dist < 130;
  const playerAttacking = ATTACKING.has(opponentAction);

  // Emergency defense when a punch is coming in.
  if (playerAttacking && inStrike && rng() < cfg.reactChance) {
    if (rng() < cfg.mistakeChance) {
      // Whiff reaction: jab into their punch (punishable).
      if (stamina >= 10) {
        return { type: 'act', action: 'JAB', timer: 0.2, staminaCost: 10 };
      }
      return { type: 'none' };
    }
    const roll = rng();
    if (roll < cfg.parryShare && stamina >= 10) {
      return { type: 'act', action: 'PARRY', timer: 0.2, staminaCost: 10 };
    }
    if (roll < cfg.parryShare + 0.35 && stamina >= 15) {
      return { type: 'act', action: 'DODGE', timer: 0.3, staminaCost: 15 };
    }
    return { type: 'act', action: 'BLOCK', timer: 0.45 + rng() * 0.25, staminaCost: 0 };
  }

  // Close the gap / create space.
  if (dist > cfg.preferredDist + 25) {
    return { type: 'move', dir: 1, speed: cfg.moveSpeed };
  }
  if (dist < cfg.preferredDist - 35 && rng() < 0.55) {
    return { type: 'move', dir: -1, speed: cfg.moveSpeed * 0.85 };
  }

  if (!inStrike) {
    return { type: 'move', dir: 1, speed: cfg.moveSpeed };
  }

  // In range: sometimes keep guard up.
  if (rng() < cfg.defenseBias) {
    return { type: 'act', action: 'BLOCK', timer: 0.35 + rng() * 0.3, staminaCost: 0 };
  }

  if (rng() > cfg.attackChance) {
    return { type: 'none' };
  }

  if (rng() < cfg.mistakeChance) {
    // Mistake: dodge for no reason or empty block.
    if (rng() < 0.5 && stamina >= 15) {
      return { type: 'act', action: 'DODGE', timer: 0.3, staminaCost: 15 };
    }
    return { type: 'act', action: 'BLOCK', timer: 0.4, staminaCost: 0 };
  }

  if (superMeter >= 100 && rng() < 0.45) {
    return { type: 'act', action: 'HOOK', timer: 0.6, staminaCost: 0, clearSuper: true };
  }
  if (stamina >= 25 && (dist < 100 || rng() < 0.4)) {
    return { type: 'act', action: 'HOOK', timer: 0.4, staminaCost: 25 };
  }
  if (stamina >= 10) {
    return { type: 'act', action: 'JAB', timer: 0.2, staminaCost: 10 };
  }
  return { type: 'act', action: 'BLOCK', timer: 0.5, staminaCost: 0 };
}
