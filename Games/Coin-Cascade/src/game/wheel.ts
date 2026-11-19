/**
 * Lucky Wheel mini-game for Coin Cascade:
 * Handles jackpot cascade triggers, stacked multiplier math,
 * and token reward conversion.
 */
import { streamRng } from './rng';

export type WheelSegmentKind = 'multiplier' | 'tokens' | 'jackpot_boost';

export interface WheelSegment {
  readonly id: string;
  readonly label: string;
  readonly kind: WheelSegmentKind;
  readonly value: number;
  readonly weight: number;
}

/** 8-segment arcade bonus wheel layout. */
export const WHEEL_SEGMENTS: readonly WheelSegment[] = [
  { id: 'mult-2x', label: '2× 雙倍乘數', kind: 'multiplier', value: 2, weight: 30 },
  { id: 'tokens-25', label: '潮幣 +25', kind: 'tokens', value: 25, weight: 25 },
  { id: 'mult-3x', label: '3× 三倍乘數', kind: 'multiplier', value: 3, weight: 20 },
  { id: 'tokens-50', label: '潮幣 +50', kind: 'tokens', value: 50, weight: 15 },
  { id: 'mult-5x', label: '5× 五倍乘數', kind: 'multiplier', value: 5, weight: 10 },
  { id: 'jackpot-boost', label: '彩池大爆發 +30', kind: 'jackpot_boost', value: 30, weight: 8 },
  { id: 'tokens-100', label: '潮幣 +100', kind: 'tokens', value: 100, weight: 5 },
  { id: 'mult-10x', label: '10× 極限乘數', kind: 'multiplier', value: 10, weight: 2 },
];

/** Minimum cascade count required alongside a jackpot burst to trigger a bonus wheel spin. */
export const JACKPOT_CASCADE_TRIGGER_MIN = 3;

export interface WheelTriggerParams {
  readonly jackpotBurst: number;
  readonly cascadeDepth: number;
  readonly feverActive: boolean;
}

/**
 * Determines whether a game event triggers a Lucky Wheel spin:
 * Fires if a jackpot bursts during a cascade of >= 3 coins, or during Fever Overdrive.
 */
export function isWheelSpinTriggered(params: WheelTriggerParams): boolean {
  if (params.jackpotBurst <= 0) return false;
  return params.cascadeDepth >= JACKPOT_CASCADE_TRIGGER_MIN || params.feverActive;
}

export interface WheelSpinResult {
  readonly segment: WheelSegment;
  readonly segmentIndex: number;
  readonly spinAngleDeg: number;
  readonly multiplier: number;
  readonly bonusTokens: number;
  readonly jackpotBoost: number;
}

/**
 * Deterministically spins the wheel given a seed and spin index.
 */
export function spinWheel(seed: number | string, spinIndex = 0): WheelSpinResult {
  const seedNum = typeof seed === 'number' ? seed : Number(seed) || 12345;
  const rng = streamRng(seedNum, `wheel-spin:${spinIndex}`);
  const totalWeight = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let roll = rng() * totalWeight;

  let chosenIndex = 0;
  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    const s = WHEEL_SEGMENTS[i]!;
    if (roll < s.weight) {
      chosenIndex = i;
      break;
    }
    roll -= s.weight;
  }

  const segment = WHEEL_SEGMENTS[chosenIndex]!;
  const segArc = 360 / WHEEL_SEGMENTS.length;
  // Center of the chosen segment plus slight deterministic jitter within segment arc
  const jitter = (rng() - 0.5) * (segArc * 0.7);
  const spinAngleDeg = chosenIndex * segArc + segArc / 2 + jitter + 360 * 4;

  const multiplier = segment.kind === 'multiplier' ? segment.value : 1;
  const bonusTokens = segment.kind === 'tokens' ? segment.value : 0;
  const jackpotBoost = segment.kind === 'jackpot_boost' ? segment.value : 0;

  return {
    segment,
    segmentIndex: chosenIndex,
    spinAngleDeg,
    multiplier,
    bonusTokens,
    jackpotBoost,
  };
}

export interface MultiplierStackParams {
  readonly baseMultiplier?: number;
  readonly feverActive?: boolean;
  readonly tideBonus?: boolean;
  readonly wheelMultiplier?: number;
}

export interface MultiplierStackResult {
  readonly base: number;
  readonly fever: number;
  readonly tide: number;
  readonly wheel: number;
  readonly totalMultiplier: number;
}

/**
 * Calculates compound multiplier stacking:
 * Base (default 1.0) * Fever (2.0 if active) * Tide (1.5 if bonus) * Wheel Multiplier.
 */
export function stackMultipliers(params: MultiplierStackParams = {}): MultiplierStackResult {
  const base = Math.max(1, params.baseMultiplier ?? 1);
  const fever = params.feverActive ? 2.0 : 1.0;
  const tide = params.tideBonus ? 1.5 : 1.0;
  const wheel = Math.max(1, params.wheelMultiplier ?? 1);
  const raw = base * fever * tide * wheel;
  // Round to 2 decimal places to avoid float drift
  const totalMultiplier = Math.round(raw * 100) / 100;

  return {
    base,
    fever,
    tide,
    wheel,
    totalMultiplier,
  };
}

export interface TokenConversionParams {
  readonly baseScore: number;
  readonly cascadeCount: number;
  readonly jackpotBursts: number;
  readonly wheelBonusTokens?: number;
  readonly stackedMultiplier?: number;
}

/**
 * Converts run achievements and wheel mini-game bonuses into total meta token rewards:
 * Multiplies score-derived tokens by the stacked multiplier, then adds flat bonuses.
 */
export function convertRunTokensWithWheel(params: TokenConversionParams): number {
  const multiplier = Math.max(1, params.stackedMultiplier ?? 1);
  const rawScoreTokens = Math.floor(params.baseScore / 12);
  const cascadeTokens = params.cascadeCount * 2;
  const jackpotTokens = params.jackpotBursts * 5;

  const scaledCore = Math.floor((rawScoreTokens + cascadeTokens + jackpotTokens) * multiplier);
  const flatBonus = Math.max(0, params.wheelBonusTokens ?? 0);

  return Math.max(1, scaledCore + flatBonus);
}
