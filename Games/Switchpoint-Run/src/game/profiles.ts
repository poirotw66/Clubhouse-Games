/**
 * Unlockable runners (railcarts). Each changes handling / buffer in a way that
 * is meaningful in play — not cosmetic skins. The default profile matches the
 * original constants exactly so balance scripts and challenge seeds stay valid.
 */

export type RunnerId = 'standard' | 'freight' | 'courier' | 'express';

export interface RunnerProfile {
  id: RunnerId;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb. */
  blurb: string;
  /** Rail-bolt cost; 0 = free starter. */
  cost: number;
  /** Multiplier on START_BUFFER at run start. */
  startBufferMul: number;
  /** Multiplier on MAX_BUFFER ceiling. */
  maxBufferMul: number;
  /** Multiplier on playerBasePace (and thus surplus over the train). */
  speedMul: number;
  /** Multiplier on HIT_STUN_DURATION (lower = snaps back faster). */
  hitStunMul: number;
  /** Multiplier on LANE_CHANGE_COOLDOWN (lower = snappier lane changes). */
  laneCooldownMul: number;
  /** Multiplier on SUPPLY_BUFFER_GAIN. */
  supplyMul: number;
}

export const DEFAULT_RUNNER_ID: RunnerId = 'standard';

export const RUNNERS: readonly RunnerProfile[] = [
  {
    id: 'standard',
    name: '標準扳道車',
    blurb: '均衡起步。熟悉預覽與緩衝節奏。',
    cost: 0,
    startBufferMul: 1,
    maxBufferMul: 1,
    speedMul: 1,
    hitStunMul: 1,
    laneCooldownMul: 1,
    supplyMul: 1,
  },
  {
    id: 'freight',
    name: '重載貨卡',
    blurb: '緩衝更大、撞擊懲罰更重——容錯高但失手代價大。',
    cost: 180,
    startBufferMul: 1.22,
    maxBufferMul: 1.18,
    speedMul: 0.96,
    hitStunMul: 1.25,
    laneCooldownMul: 1.15,
    supplyMul: 1.1,
  },
  {
    id: 'courier',
    name: '快速信使',
    blurb: '換股道更靈活、撞擊恢復更快，但起步緩衝較薄。',
    cost: 260,
    startBufferMul: 0.82,
    maxBufferMul: 0.9,
    speedMul: 1.04,
    hitStunMul: 0.72,
    laneCooldownMul: 0.7,
    supplyMul: 0.9,
  },
  {
    id: 'express',
    name: '特急試驗車',
    blurb: '明顯更快，補給也更香——但緩衝上限更緊，容錯低。',
    cost: 420,
    startBufferMul: 0.88,
    maxBufferMul: 0.78,
    speedMul: 1.08,
    hitStunMul: 1.05,
    laneCooldownMul: 0.85,
    supplyMul: 1.2,
  },
];

export function runnerById(id: string): RunnerProfile | undefined {
  return RUNNERS.find((r) => r.id === id);
}

export function isRunnerId(value: unknown): value is RunnerId {
  return typeof value === 'string' && RUNNERS.some((r) => r.id === value);
}
