/**
 * Named CPU roster — play styles differ beyond memory retain/capacity.
 */

import type { CpuDifficulty } from './memoryLogic.ts';

export type OpponentId = 'scatter' | 'explorer' | 'cautious' | 'hoarder' | 'scholar';

/** How the CPU chooses flips once memory recall is resolved. */
export type CpuPlayStyle =
  | 'balanced'
  | 'adventurous'
  | 'conservative'
  | 'stall'
  | 'perfect';

export interface OpponentDef {
  id: OpponentId;
  name: string;
  tagline: string;
  blurb: string;
  difficulty: CpuDifficulty;
  style: CpuPlayStyle;
  /** Chance to skip a known match and explore instead (adventurous). */
  skipKnownChance: number;
  /** Prefer unknown cards when exploring (0–1). */
  exploreBias: number;
  /** When behind, stall with known non-matches (style stall / hard). */
  stallWhenBehind: boolean;
}

export const OPPONENTS: readonly OpponentDef[] = [
  {
    id: 'scatter',
    name: '健忘鼠',
    tagline: '亂翻・記性差',
    blurb: '幾乎不記得看過的牌，常亂翻新牌。',
    difficulty: 'easy',
    style: 'adventurous',
    skipKnownChance: 0.45,
    exploreBias: 0.95,
    stallWhenBehind: false,
  },
  {
    id: 'explorer',
    name: '探險狐',
    tagline: '冒險型・愛開新牌',
    blurb: '記得一些，但仍優先翻未知牌找資訊。',
    difficulty: 'normal',
    style: 'adventurous',
    skipKnownChance: 0.28,
    exploreBias: 0.9,
    stallWhenBehind: false,
  },
  {
    id: 'cautious',
    name: '保守鴞',
    tagline: '保守型・只翻已知',
    blurb: '有已知配對就翻；否則寧可翻已看過的牌。',
    difficulty: 'normal',
    style: 'conservative',
    skipKnownChance: 0,
    exploreBias: 0.15,
    stallWhenBehind: false,
  },
  {
    id: 'hoarder',
    name: '藏招鷹',
    tagline: '落後時藏資訊',
    blurb: '記性不錯；明顯落後時會故意翻已知非配對。',
    difficulty: 'hard',
    style: 'stall',
    skipKnownChance: 0.05,
    exploreBias: 0.55,
    stallWhenBehind: true,
  },
  {
    id: 'scholar',
    name: '博學鸛',
    tagline: '高記性・絕不浪費',
    blurb: '記得最多，已知配對從不放過。',
    difficulty: 'hard',
    style: 'perfect',
    skipKnownChance: 0,
    exploreBias: 0.5,
    stallWhenBehind: false,
  },
] as const;

export function opponentById(id: OpponentId): OpponentDef {
  const found = OPPONENTS.find((o) => o.id === id);
  return found ?? OPPONENTS[0];
}

export function isOpponentUnlocked(index: number, unlockedIndex: number): boolean {
  if (index < 0 || index >= OPPONENTS.length) return false;
  return index <= unlockedIndex;
}
