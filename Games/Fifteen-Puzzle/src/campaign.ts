/**
 * Challenge ladder: sequential stages with move or time limits.
 * Progress shape matches MLS / Coin-Cascade pack pattern.
 */

import type { BoardSize, ScrambleTier, VisualStyle } from './fifteenLogic.ts';
import { hashString } from './rng.ts';
import {
  EMPTY_CAMPAIGN,
  loadCampaignProgress,
  saveCampaignProgress,
  type CampaignProgress,
} from './storage.ts';

export type StageLimit =
  | { kind: 'moves'; /** Multiplier on solved optimal length (ceil). */ slack: number }
  | { kind: 'time'; seconds: number };

export type CampaignStage = {
  id: string;
  name: string;
  blurb: string;
  size: BoardSize;
  tier: ScrambleTier;
  style: VisualStyle;
  seedCode: string;
  limit: StageLimit;
};

export const CAMPAIGN_STAGES: readonly CampaignStage[] = [
  {
    id: 'warmup-3',
    name: '熱身 3×3',
    blurb: '小盤入門・步數寬鬆',
    size: 3,
    tier: 'easy',
    style: 'number',
    seedCode: 'fp-camp-1',
    limit: { kind: 'moves', slack: 1.6 },
  },
  {
    id: 'focus-3',
    name: '專注 3×3',
    blurb: '普通打亂・60 秒內還原',
    size: 3,
    tier: 'normal',
    style: 'number',
    seedCode: 'fp-camp-2',
    limit: { kind: 'time', seconds: 60 },
  },
  {
    id: 'picture-4',
    name: '拼圖初見',
    blurb: '4×4 圖片模式・認識畫面',
    size: 4,
    tier: 'easy',
    style: 'picture',
    seedCode: 'fp-camp-3',
    limit: { kind: 'moves', slack: 1.5 },
  },
  {
    id: 'classic-4',
    name: '經典推盤',
    blurb: '4×4 普通・步數挑戰',
    size: 4,
    tier: 'normal',
    style: 'number',
    seedCode: 'fp-camp-4',
    limit: { kind: 'moves', slack: 1.4 },
  },
  {
    id: 'sprint-4',
    name: '限時衝刺',
    blurb: '4×4 困難・75 秒',
    size: 4,
    tier: 'hard',
    style: 'number',
    seedCode: 'fp-camp-5',
    limit: { kind: 'time', seconds: 75 },
  },
  {
    id: 'wide-5',
    name: '開闊 5×5',
    blurb: '更大盤面・步數達標即可',
    size: 5,
    tier: 'easy',
    style: 'number',
    seedCode: 'fp-camp-6',
    limit: { kind: 'moves', slack: 1.5 },
  },
  {
    id: 'mosaic-5',
    name: '馬賽克',
    blurb: '5×5 圖片・90 秒',
    size: 5,
    tier: 'normal',
    style: 'picture',
    seedCode: 'fp-camp-7',
    limit: { kind: 'time', seconds: 90 },
  },
  {
    id: 'grand-6',
    name: '終章 6×6',
    blurb: '最大盤・步數壓力',
    size: 6,
    tier: 'easy',
    style: 'picture',
    seedCode: 'fp-camp-8',
    limit: { kind: 'moves', slack: 1.45 },
  },
];

export function stageSeed(stage: CampaignStage): number {
  return hashString(stage.seedCode);
}

export function isStageUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= CAMPAIGN_STAGES.length) return false;
  return index <= clearedCount;
}

export function continueStageIndex(clearedCount: number): number {
  if (clearedCount <= 0) return 0;
  if (clearedCount >= CAMPAIGN_STAGES.length) return CAMPAIGN_STAGES.length - 1;
  return clearedCount;
}

/** Move budget = ceil(optimal * slack), at least optimal + 2. */
export function moveLimitFor(optimal: number, slack: number): number {
  const base = Math.ceil(optimal * slack);
  return Math.max(optimal + 2, base);
}

export function applyStageClear(
  progress: CampaignProgress,
  stageIndex: number,
  moves: number,
  elapsedSec: number,
): CampaignProgress {
  const stage = CAMPAIGN_STAGES[stageIndex];
  if (!stage || !Number.isFinite(moves) || moves < 0) return progress;

  const bestMoves = { ...progress.bestMoves };
  const bestTimeSec = { ...progress.bestTimeSec };
  const prevM = bestMoves[stage.id];
  const prevT = bestTimeSec[stage.id];
  bestMoves[stage.id] = prevM == null ? moves : Math.min(prevM, moves);
  bestTimeSec[stage.id] = prevT == null ? elapsedSec : Math.min(prevT, elapsedSec);

  let clearedCount = progress.clearedCount;
  if (stageIndex === clearedCount && clearedCount < CAMPAIGN_STAGES.length) {
    clearedCount = stageIndex + 1;
  }
  return { clearedCount, bestMoves, bestTimeSec };
}

export function clearStageAndPersist(
  stageIndex: number,
  moves: number,
  elapsedSec: number,
): CampaignProgress {
  const next = applyStageClear(loadCampaignProgress(), stageIndex, moves, elapsedSec);
  saveCampaignProgress(next);
  return next;
}

export { EMPTY_CAMPAIGN, loadCampaignProgress, saveCampaignProgress };
export type { CampaignProgress };
