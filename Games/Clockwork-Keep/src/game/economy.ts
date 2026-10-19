/**
 * Gold and scoring math. All pure functions of their inputs — no reads from
 * GameState here, so check-economy.mjs can exercise them directly.
 */
import {
  BRANCH_B_UNLOCK_CLEARS,
  OVERLAP_CALL_BONUS_PER_ENEMY,
  SCORE_PER_LIFE,
  SCORE_PER_UNSPENT_GOLD,
  SELL_REFUND_RATE,
  TOWER_DEFS,
  WAVE_CLEAR_BONUS_BASE,
  WAVE_CLEAR_BONUS_PER_WAVE,
  type BranchId,
  type TowerLevelStats,
  type TowerType,
} from './constants.ts';
import type { Tower } from './types.ts';

/** Gold reward for finishing a wave; scales gently with wave number. */
export function waveClearBonus(waveNumber: number): number {
  return WAVE_CLEAR_BONUS_BASE + WAVE_CLEAR_BONUS_PER_WAVE * waveNumber;
}

/**
 * Bonus for stacking the next wave on top of the one still running. Scales with
 * how much of the current wave is unresolved (alive on the board + not yet
 * spawned), so the payout is proportional to the risk taken.
 */
export function overlapCallBonus(unresolvedEnemies: number): number {
  return Math.floor(Math.max(0, unresolvedEnemies) * OVERLAP_CALL_BONUS_PER_ENEMY);
}

/** Sell refund: 70% of everything invested in the tower (purchase + upgrades), floored. */
export function sellRefund(investedGold: number): number {
  return Math.floor(investedGold * SELL_REFUND_RATE);
}

/** Cost to purchase a fresh level-0 tower of this type. */
export function purchaseCost(type: TowerType): number {
  return TOWER_DEFS[type].levels[0].cost;
}

/**
 * Cost of the shared L0→L1 upgrade. Branch capstones use `branchUpgradeCost`.
 */
export function sharedUpgradeCost(type: TowerType, currentLevel: 0 | 1 | 2): number | null {
  if (currentLevel !== 0) return null;
  return TOWER_DEFS[type].levels[1].cost;
}

/** Cost of the exclusive L1→L2 branch capstone. */
export function branchUpgradeCost(type: TowerType, branch: BranchId): number {
  const def = TOWER_DEFS[type].branches.find((b) => b.id === branch);
  if (!def) throw new Error(`unknown branch ${branch} for ${type}`);
  return def.stats.cost;
}

/**
 * Legacy helper used by bot / balance scripts: L0→L1 shared, L1→L2 defaults to
 * branch A cost (measurable baseline). Prefer `sharedUpgradeCost` /
 * `branchUpgradeCost` at call sites that know the branch.
 */
export function upgradeCost(type: TowerType, currentLevel: 0 | 1 | 2): number | null {
  if (currentLevel === 0) return sharedUpgradeCost(type, 0);
  if (currentLevel === 1) return branchUpgradeCost(type, 'a');
  return null;
}

/** Whether branch B is unlocked given mission clearedCount. */
export function isBranchUnlocked(branch: BranchId, missionClearedCount: number): boolean {
  if (branch === 'a') return true;
  return missionClearedCount >= BRANCH_B_UNLOCK_CLEARS;
}

/** Resolve combat stats for a placed tower. */
export function resolveTowerStats(tower: Pick<Tower, 'type' | 'level' | 'branch'>): TowerLevelStats {
  const def = TOWER_DEFS[tower.type];
  if (tower.level === 0) return def.levels[0];
  if (tower.level === 1) return def.levels[1];
  if (!tower.branch) {
    // Defensive: treat as branch A if data is corrupt rather than crashing combat.
    return def.branches[0].stats;
  }
  const branch = def.branches.find((b) => b.id === tower.branch);
  return branch?.stats ?? def.branches[0].stats;
}

/**
 * Cumulative gold to reach `level` (0–2). For level 2, pass which branch was
 * chosen; defaults to A for balance baselines.
 */
export function cumulativeCost(
  type: TowerType,
  level: 0 | 1 | 2,
  branch: BranchId = 'a',
): number {
  let total = purchaseCost(type);
  if (level >= 1) total += TOWER_DEFS[type].levels[1].cost;
  if (level >= 2) total += branchUpgradeCost(type, branch);
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
