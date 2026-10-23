import { RANK_THRESHOLDS } from './constants';

export type RankId = 'legend' | 'king' | 'awakened' | 'cub' | 'retry';

export interface RankInfo {
  id: RankId;
  zh: string;
  en: string;
}

const RANKS: Record<RankId, RankInfo> = {
  legend: { id: 'legend', zh: '廟會傳奇', en: 'Temple Fair Legend' },
  king: { id: 'king', zh: '獅王', en: 'Lion King' },
  awakened: { id: 'awakened', zh: '醒獅', en: 'Awakened Lion' },
  cub: { id: 'cub', zh: '小獅仔', en: 'Little Cub' },
  retry: { id: 'retry', zh: '再試一次', en: 'Try Again' },
};

/** Map a successful finish time to a rank title. */
export function rankForFinishTime(seconds: number): RankInfo {
  if (seconds < RANK_THRESHOLDS.legend) return RANKS.legend;
  if (seconds < RANK_THRESHOLDS.king) return RANKS.king;
  if (seconds < RANK_THRESHOLDS.awakened) return RANKS.awakened;
  return RANKS.cub;
}

export function retryRank(): RankInfo {
  return RANKS.retry;
}

export function allRanks(): RankInfo[] {
  return Object.values(RANKS);
}
