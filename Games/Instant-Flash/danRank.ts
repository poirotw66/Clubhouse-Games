import type { BestRecord, LadderProgress } from './storage';
import type { GameStats } from './types';

export interface DanRankDef {
  level: number;
  name: string;
  title: string;
  badge: string;
  accent: string;
  glowColor: string;
  requirement: string;
  check: (ctx: {
    highScore: number;
    maxCombo: number;
    clearedCount: number;
    bestReactionMs: number;
    hasSRank: boolean;
  }) => boolean;
}

export const DAN_RANKS: readonly DanRankDef[] = [
  {
    level: 1,
    name: '初段・青竹',
    title: '初窺門徑',
    badge: '1D',
    accent: '#10b981', // emerald-500
    glowColor: 'rgba(16, 185, 129, 0.4)',
    requirement: '拔刀訓練入門，掌握左右出鞘時機',
    check: () => true,
  },
  {
    level: 2,
    name: '二段・白刃',
    title: '凝神出鞘',
    badge: '2D',
    accent: '#38bdf8', // sky-400
    glowColor: 'rgba(56, 189, 248, 0.4)',
    requirement: '擊敗首位對手浪人，或挑戰積分達 2,000 分',
    check: (ctx) => ctx.clearedCount >= 1 || ctx.highScore >= 2000,
  },
  {
    level: 3,
    name: '三段・青嵐',
    title: '身動如風',
    badge: '3D',
    accent: '#06b6d4', // cyan-500
    glowColor: 'rgba(6, 182, 212, 0.4)',
    requirement: '擊敗 2 位對手，或挑戰達 5,000 分且最快反應 ≤ 220ms',
    check: (ctx) =>
      ctx.clearedCount >= 2 || (ctx.highScore >= 5000 && ctx.bestReactionMs <= 220),
  },
  {
    level: 4,
    name: '四段・飛燕',
    title: '雙閃連破',
    badge: '4D',
    accent: '#3b82f6', // blue-500
    glowColor: 'rgba(59, 130, 246, 0.4)',
    requirement: '擊敗 3 位對手，或挑戰達 9,000 分且最快反應 ≤ 180ms',
    check: (ctx) =>
      ctx.clearedCount >= 3 || (ctx.highScore >= 9000 && ctx.bestReactionMs <= 180),
  },
  {
    level: 5,
    name: '五段・雷鳴',
    title: '看破幻影',
    badge: '5D',
    accent: '#eab308', // yellow-500
    glowColor: 'rgba(234, 179, 8, 0.4)',
    requirement: '擊敗 4 位對手，最高連段 ≥ 5 且最快反應 ≤ 140ms',
    check: (ctx) =>
      ctx.clearedCount >= 4 && ctx.maxCombo >= 5 && ctx.bestReactionMs <= 140,
  },
  {
    level: 6,
    name: '六段・紫電',
    title: '刀光化弧',
    badge: '6D',
    accent: '#a855f7', // purple-500
    glowColor: 'rgba(168, 85, 247, 0.4)',
    requirement: '擊敗 5 位對手，最高連段 ≥ 8 且最快反應 ≤ 110ms',
    check: (ctx) =>
      ctx.clearedCount >= 5 && ctx.maxCombo >= 8 && ctx.bestReactionMs <= 110,
  },
  {
    level: 7,
    name: '七段・業火',
    title: '百步絕斬',
    badge: '7D',
    accent: '#f97316', // orange-500
    glowColor: 'rgba(249, 115, 22, 0.4)',
    requirement: '擊敗 6 位對手，最高連段 ≥ 12 且最快反應 ≤ 90ms',
    check: (ctx) =>
      ctx.clearedCount >= 6 && ctx.maxCombo >= 12 && ctx.bestReactionMs <= 90,
  },
  {
    level: 8,
    name: '八段・無雙',
    title: '天人合一',
    badge: '8D',
    accent: '#ef4444', // red-500
    glowColor: 'rgba(239, 68, 68, 0.5)',
    requirement: '擊敗 7 位對手，最高連段 ≥ 16 且最快反應 ≤ 75ms',
    check: (ctx) =>
      ctx.clearedCount >= 7 && ctx.maxCombo >= 16 && ctx.bestReactionMs <= 75,
  },
  {
    level: 9,
    name: '皆傳・神速',
    title: '剎那一閃',
    badge: '皆傳',
    accent: '#fbbf24', // amber-400 gold
    glowColor: 'rgba(251, 191, 36, 0.6)',
    requirement: '全通八位劍豪（擊破宗師）、榮獲 S 評價且最快反應 ≤ 60ms',
    check: (ctx) =>
      ctx.clearedCount >= 8 && ctx.hasSRank && ctx.bestReactionMs <= 60,
  },
] as const;

export interface DanRankStatus {
  currentRank: DanRankDef;
  nextRank: DanRankDef | null;
  allRanks: Array<DanRankDef & { unlocked: boolean }>;
  progressPercent: number;
}

export function computeDanRankStatus(
  best: BestRecord,
  ladder: LadderProgress,
  currentStats?: GameStats | null,
): DanRankStatus {
  const highScore = Math.max(best.highScore, currentStats?.score ?? 0);
  const maxCombo = Math.max(best.maxCombo, currentStats?.maxCombo ?? 0);
  const clearedCount = ladder.clearedCount;

  // Find lowest recorded reaction time across all ladder opponents + current run
  let bestReactionMs = currentStats?.bestReactionMs ?? 999;
  let hasSRank = currentStats?.rank === 'S';

  for (const b of Object.values(ladder.opponentBests)) {
    if (!b) continue;
    if (b.bestReactionMs != null && b.bestReactionMs > 0) {
      bestReactionMs = Math.min(bestReactionMs, b.bestReactionMs);
    }
    if (b.rank === 'S') {
      hasSRank = true;
    }
  }

  const ctx = {
    highScore,
    maxCombo,
    clearedCount,
    bestReactionMs,
    hasSRank,
  };

  const allWithStatus = DAN_RANKS.map((r) => ({
    ...r,
    unlocked: r.check(ctx),
  }));

  // Find the highest unlocked rank
  let currentRank: DanRankDef = DAN_RANKS[0];
  for (let i = allWithStatus.length - 1; i >= 0; i--) {
    if (allWithStatus[i].unlocked) {
      currentRank = allWithStatus[i];
      break;
    }
  }

  const nextRank =
    currentRank.level < DAN_RANKS.length ? DAN_RANKS[currentRank.level] : null;

  // Approximate progress towards next rank (0 - 100%)
  const progressPercent = nextRank
    ? Math.min(
        95,
        Math.max(
          10,
          Math.round(((currentRank.level) / DAN_RANKS.length) * 100),
        ),
      )
    : 100;

  return {
    currentRank,
    nextRank,
    allRanks: allWithStatus,
    progressPercent,
  };
}
