// Pure combat rules: high/low mind game, wind-up tells, body attrition vs head KO.

export type Height = 'high' | 'low';
export type AttackKind = 'jab' | 'hook' | 'signature';
export type PunchPhase = 'windup' | 'active' | 'recovery';

export interface AttackProfile {
  kind: AttackKind;
  height: Height;
  /** Seconds before the punch is active — readable wind-up. */
  windup: number;
  active: number;
  recovery: number;
  staminaCost: number;
  baseDamage: number;
  score: number;
  /** Head (high) builds stun toward KO. */
  stunBuild: number;
  /** Body (low) drains stamina regen for a while. */
  bodyFatigue: number;
  /** Signature spin: cannot be blocked, only dodged. */
  unblockable?: boolean;
}

export interface ActiveAttack {
  kind: AttackKind;
  height: Height;
  phase: PunchPhase;
  phaseTimer: number;
  profile: AttackProfile;
  /** True once collision already resolved for this swing. */
  resolved: boolean;
  isSuper: boolean;
}

export interface HitContext {
  attack: ActiveAttack;
  attackerPower: number;
  defenderGuarding: boolean;
  defenderGuardHeight: Height | null;
  defenderDodging: boolean;
  defenderParrying: boolean;
  defenderParryHeight: Height | null;
  defenderAttacking: boolean;
}

export type HitOutcome =
  | { type: 'whiff' }
  | { type: 'dodged' }
  | {
      type: 'parry';
      staggerTime: number;
      staminaBonus: number;
      superBonus: number;
    }
  | {
      type: 'hit';
      damage: number;
      score: number;
      stunGain: number;
      bodyFatigue: number;
      blocked: boolean;
      guardCorrect: boolean | null;
      isCounter: boolean;
      isSuper: boolean;
    };

export const CORRECT_GUARD_MUL = 0.2; // 80% reduction
export const WRONG_GUARD_MUL = 0.8; // 20% reduction
export const PARRY_STAGGER = 0.4;
export const STUN_KO_THRESHOLD = 100;
export const BODY_FATIGUE_DECAY = 0.12; // per second toward 0
export const MAX_BODY_FATIGUE = 0.7; // caps regen penalty

const JAB_HIGH: AttackProfile = {
  kind: 'jab',
  height: 'high',
  windup: 0.1,
  active: 0.08,
  recovery: 0.1,
  staminaCost: 10,
  baseDamage: 5,
  score: 10,
  stunBuild: 14,
  bodyFatigue: 0,
};

const JAB_LOW: AttackProfile = {
  kind: 'jab',
  height: 'low',
  windup: 0.11,
  active: 0.08,
  recovery: 0.11,
  staminaCost: 10,
  baseDamage: 5.5,
  score: 10,
  stunBuild: 0,
  bodyFatigue: 0.12,
};

const HOOK_HIGH: AttackProfile = {
  kind: 'hook',
  height: 'high',
  windup: 0.2,
  active: 0.1,
  recovery: 0.18,
  staminaCost: 25,
  baseDamage: 12,
  score: 25,
  stunBuild: 28,
  bodyFatigue: 0,
};

const HOOK_LOW: AttackProfile = {
  kind: 'hook',
  height: 'low',
  windup: 0.22,
  active: 0.1,
  recovery: 0.2,
  staminaCost: 25,
  baseDamage: 13,
  score: 25,
  stunBuild: 0,
  bodyFatigue: 0.22,
};

const SIGNATURE: AttackProfile = {
  kind: 'signature',
  height: 'high',
  windup: 0.3,
  active: 0.12,
  recovery: 0.28,
  staminaCost: 0,
  baseDamage: 22,
  score: 60,
  stunBuild: 40,
  bodyFatigue: 0.08,
  unblockable: true,
};

export function attackProfile(kind: AttackKind, height: Height, isSuper = false): AttackProfile {
  if (kind === 'signature' || isSuper) {
    return {
      ...SIGNATURE,
      height,
      windup: isSuper && kind !== 'signature' ? 0.26 : SIGNATURE.windup,
      baseDamage: isSuper ? SIGNATURE.baseDamage * 1.15 : SIGNATURE.baseDamage,
    };
  }
  if (kind === 'jab') return height === 'high' ? { ...JAB_HIGH } : { ...JAB_LOW };
  return height === 'high' ? { ...HOOK_HIGH } : { ...HOOK_LOW };
}

export function startAttack(
  kind: AttackKind,
  height: Height,
  isSuper = false,
): ActiveAttack {
  const profile = attackProfile(kind, height, isSuper);
  return {
    kind: profile.kind,
    height: profile.height,
    phase: 'windup',
    phaseTimer: profile.windup,
    profile,
    resolved: false,
    isSuper: isSuper || kind === 'signature',
  };
}

export function attackTotalTime(a: ActiveAttack): number {
  const p = a.profile;
  return p.windup + p.active + p.recovery;
}

export function attackElapsed(a: ActiveAttack): number {
  const p = a.profile;
  if (a.phase === 'windup') return p.windup - a.phaseTimer;
  if (a.phase === 'active') return p.windup + (p.active - a.phaseTimer);
  return p.windup + p.active + (p.recovery - a.phaseTimer);
}

/** Advance punch phases; returns null when the swing is fully done. */
export function tickAttack(attack: ActiveAttack, dt: number): ActiveAttack | null {
  let next: ActiveAttack = { ...attack, phaseTimer: attack.phaseTimer - dt };
  while (next.phaseTimer <= 0) {
    if (next.phase === 'windup') {
      next = { ...next, phase: 'active', phaseTimer: next.profile.active + next.phaseTimer };
    } else if (next.phase === 'active') {
      next = { ...next, phase: 'recovery', phaseTimer: next.profile.recovery + next.phaseTimer };
    } else {
      return null;
    }
  }
  return next;
}

export function isAttackingAction(action: string): boolean {
  return action === 'JAB' || action === 'HOOK' || action === 'SIGNATURE';
}

export function resolveHit(ctx: HitContext): HitOutcome {
  const { attack } = ctx;
  if (attack.phase !== 'active' || attack.resolved) return { type: 'whiff' };

  if (ctx.defenderDodging) return { type: 'dodged' };

  if (
    ctx.defenderParrying
    && ctx.defenderParryHeight === attack.height
    && !attack.profile.unblockable
  ) {
    return {
      type: 'parry',
      staggerTime: PARRY_STAGGER,
      staminaBonus: 20,
      superBonus: 15,
    };
  }

  let damage = attack.profile.baseDamage * ctx.attackerPower;
  let score = attack.profile.score;
  let stunGain = attack.profile.stunBuild;
  let bodyFatigue = attack.profile.bodyFatigue;

  if (attack.isSuper) {
    damage *= 1.35;
    score *= 2;
    stunGain *= 1.2;
  }

  const isCounter = ctx.defenderAttacking;
  if (isCounter) {
    damage *= 1.5;
    score *= 1.5;
    stunGain *= 1.25;
  }

  let blocked = false;
  let guardCorrect: boolean | null = null;

  if (ctx.defenderGuarding && !attack.profile.unblockable) {
    blocked = true;
    guardCorrect = ctx.defenderGuardHeight === attack.height;
    const mul = guardCorrect ? CORRECT_GUARD_MUL : WRONG_GUARD_MUL;
    damage *= mul;
    score = guardCorrect ? 0 : Math.floor(score * 0.35);
    stunGain *= guardCorrect ? 0.15 : 0.55;
    bodyFatigue *= guardCorrect ? 0.2 : 0.7;
  }

  return {
    type: 'hit',
    damage,
    score: Math.floor(score),
    stunGain,
    bodyFatigue,
    blocked,
    guardCorrect,
    isCounter,
    isSuper: attack.isSuper,
  };
}

export function effectiveStaminaRegen(base: number, bodyFatigue: number): number {
  const fatigue = Math.min(MAX_BODY_FATIGUE, Math.max(0, bodyFatigue));
  return base * (1 - fatigue);
}

export function tickBodyFatigue(bodyFatigue: number, dt: number): number {
  return Math.max(0, bodyFatigue - BODY_FATIGUE_DECAY * dt);
}

export function applyStun(current: number, gain: number, max = STUN_KO_THRESHOLD): number {
  return Math.min(max, Math.max(0, current + gain));
}

/** Stun decays slowly when not being hit in the head. */
export function tickStun(stun: number, dt: number, underPressure: boolean): number {
  if (underPressure) return stun;
  return Math.max(0, stun - dt * 8);
}

export function isStunKo(stun: number): boolean {
  return stun >= STUN_KO_THRESHOLD;
}

// ── Player habit memory (last N attack heights) ─────────────────────────────

export const HABIT_WINDOW = 10;

export interface HabitMemory {
  recentHeights: Height[];
}

export function emptyHabit(): HabitMemory {
  return { recentHeights: [] };
}

export function recordPlayerHeight(mem: HabitMemory, height: Height): HabitMemory {
  const recentHeights = [...mem.recentHeights, height].slice(-HABIT_WINDOW);
  return { recentHeights };
}

export function playerHighRatio(mem: HabitMemory): number {
  if (mem.recentHeights.length === 0) return 0.5;
  const highs = mem.recentHeights.filter((h) => h === 'high').length;
  return highs / mem.recentHeights.length;
}

export function preferredGuardHeight(mem: HabitMemory, habitBias: number): Height {
  // habitBias 0 = ignore player, 1 = fully mirror player's favored height.
  const ratio = playerHighRatio(mem);
  const blended = 0.5 + (ratio - 0.5) * habitBias;
  return blended >= 0.5 ? 'high' : 'low';
}
