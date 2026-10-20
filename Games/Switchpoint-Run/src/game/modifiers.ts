/**
 * Optional run modifiers. Each is a toggleable rule twist with gameplay weight.
 * Modifiers are unlocked by milestones (distance / daily / currency), then
 * equipped from the garage before a free or daily run. Challenge seeds never
 * apply modifiers — their fixed seeds must stay comparable.
 */

export type ModifierId = 'glass-buffer' | 'dense-preview' | 'score-fever' | 'no-supply';

export interface RunModifier {
  id: ModifierId;
  name: string;
  blurb: string;
  /** Milestone unlock: free-play best distance required (0 = always available once meta exists). */
  unlockBestDistance: number;
  /** Extra rail bolts spent to enable for one run (0 = free once unlocked). */
  equipCost: number;
  /** Multiplier on MAX_BUFFER (and starting buffer). */
  maxBufferMul: number;
  /** Extra density bias stacked on the theme bias. */
  densityBias: number;
  /** Multiplier on scoreMult growth from score rewards. */
  scoreRewardMul: number;
  /** When true, supply rewards give nothing (score/distance only). */
  suppressSupply: boolean;
  /** Bonus rail bolts awarded at run end when this modifier was active. */
  boltBonus: number;
}

export const MODIFIERS: readonly RunModifier[] = [
  {
    id: 'glass-buffer',
    name: '玻璃緩衝',
    blurb: '緩衝上限砍半——每一次失誤都更致命。',
    unlockBestDistance: 4000,
    equipCost: 0,
    maxBufferMul: 0.55,
    densityBias: 0,
    scoreRewardMul: 1.35,
    suppressSupply: false,
    boltBonus: 12,
  },
  {
    id: 'dense-preview',
    name: '密岔預覽',
    blurb: '岔口偏好更高密度支線——預覽資訊更關鍵。',
    unlockBestDistance: 6000,
    equipCost: 0,
    maxBufferMul: 1,
    densityBias: 2,
    scoreRewardMul: 1.15,
    suppressSupply: false,
    boltBonus: 10,
  },
  {
    id: 'score-fever',
    name: '評分狂熱',
    blurb: '倍率獎勵更香，但補給無效——純靠路線評價。',
    unlockBestDistance: 8000,
    equipCost: 15,
    maxBufferMul: 0.9,
    densityBias: 0,
    scoreRewardMul: 1.6,
    suppressSupply: true,
    boltBonus: 18,
  },
  {
    id: 'no-supply',
    name: '無補給班次',
    blurb: '補給支線變成空轉——緩衝只能靠加速拉開。',
    unlockBestDistance: 10000,
    equipCost: 10,
    maxBufferMul: 1,
    densityBias: 0,
    scoreRewardMul: 1.25,
    suppressSupply: true,
    boltBonus: 14,
  },
];

export function modifierById(id: string): RunModifier | undefined {
  return MODIFIERS.find((m) => m.id === id);
}

export function isModifierId(value: unknown): value is ModifierId {
  return typeof value === 'string' && MODIFIERS.some((m) => m.id === value);
}
