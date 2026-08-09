/**
 * Gold and scoring math. All pure functions of their inputs — no reads from
 * GameState here, so check-economy.mjs can exercise them directly.
 */
import {
  EARLY_CALL_BONUS_PER_SEC,
  SCORE_PER_LIFE,
  SCORE_PER_UNSPENT_GOLD,
  SELL_REFUND_RATE,
  TOWER_DEFS,
  WAVE_CLEAR_BONUS_BASE,
  WAVE_CLEAR_BONUS_PER_WAVE,
  type TowerType,
} from './constants.ts';

/** Gold reward for finishing a wave; scales gently with wave number. */
export function waveClearBonus(waveNumber: number): number {
  return WAVE_CLEAR_BONUS_BASE + WAVE_CLEAR_BONUS_PER_WAVE * waveNumber;
}

/** Bonus for calling the next wave before the prep timer runs out, floored to an integer. */
export function earlyCallBonus(remainingSec: number): number {
  return Math.floor(Math.max(0, remainingSec) * EARLY_CALL_BONUS_PER_SEC);
}

/** Sell refund: 70% of everything invested in the tower (purchase + upgrades), floored. */
export function sellRefund(investedGold: number): number {
  return Math.floor(investedGold * SELL_REFUND_RATE);
}

/** Cost to purchase a fresh level-1 tower of this type. */
export function purchaseCost(type: TowerType): number {
  return TOWER_DEFS[type].levels[0].cost;
}

/**
 * Cost to upgrade a tower currently at `currentLevel` (0-indexed, so 0 = just
 * bought) up one level. Levels are 0,1,2 (spec: 3 levels, 2 upgrades); there
 * is nothing beyond level 2.
 */
export function upgradeCost(type: TowerType, currentLevel: 0 | 1 | 2): number | null {
  const nextLevel = currentLevel + 1;
  if (nextLevel > 2) return null;
  return TOWER_DEFS[type].levels[nextLevel].cost;
}

/** Cumulative gold invested to reach `level` from scratch (purchase + every upgrade up to it). */
export function cumulativeCost(type: TowerType, level: 0 | 1 | 2): number {
  let total = purchaseCost(type);
  for (let l = 0; l < level; l++) {
    total += TOWER_DEFS[type].levels[l + 1].cost;
  }
  return total;
}

export interface ScoreInputs {
  killScore: number;
  lives: number;
  unspentGold: number;
}

/** Final/displayed score: kill score (already wave-multiplier-scaled) + end-state bonuses. */
export function calculateScore({ killScore, lives, unspentGold }: ScoreInputs): number {
  return killScore + lives * SCORE_PER_LIFE + unspentGold * SCORE_PER_UNSPENT_GOLD;
}
