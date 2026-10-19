/**
 * Optional clear goals tracked every win — skill expression beyond "finish once".
 */

export type ChallengeId =
  | 'no-undo'
  | 'moves-120'
  | 'moves-80'
  | 'time-300'
  | 'standard-300'
  | 'vegas-profit';

export interface ChallengeDef {
  id: ChallengeId;
  name: string;
  blurb: string;
  goalLabel: string;
}

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: 'no-undo',
    name: '一氣呵成',
    blurb: '通關全程不使用復原',
    goalLabel: '無悔棋通關',
  },
  {
    id: 'moves-120',
    name: '步步為營',
    blurb: '120 步以內獲勝',
    goalLabel: '≤ 120 步',
  },
  {
    id: 'moves-80',
    name: '行雲流水',
    blurb: '80 步以內獲勝',
    goalLabel: '≤ 80 步',
  },
  {
    id: 'time-300',
    name: '競速五分',
    blurb: '5 分鐘內獲勝',
    goalLabel: '≤ 5:00',
  },
  {
    id: 'standard-300',
    name: '標準高分',
    blurb: '標準計分單局 ≥ 300',
    goalLabel: '標準分 ≥ 300',
  },
  {
    id: 'vegas-profit',
    name: '維加斯獲利',
    blurb: '維加斯單局結束分數 > 0（淨賺）',
    goalLabel: '維加斯 > 0',
  },
];

export type ChallengeContext = {
  won: boolean;
  usedUndo: boolean;
  moves: number;
  elapsedSec: number;
  score: number;
  scoreMode: 'standard' | 'vegas';
};

export function isChallengeCleared(id: ChallengeId, ctx: ChallengeContext): boolean {
  if (!ctx.won) return false;
  switch (id) {
    case 'no-undo':
      return !ctx.usedUndo;
    case 'moves-120':
      return ctx.moves <= 120;
    case 'moves-80':
      return ctx.moves <= 80;
    case 'time-300':
      return ctx.elapsedSec <= 300;
    case 'standard-300':
      return ctx.scoreMode === 'standard' && ctx.score >= 300;
    case 'vegas-profit':
      return ctx.scoreMode === 'vegas' && ctx.score > 0;
    default:
      return false;
  }
}

export function evaluateChallenges(ctx: ChallengeContext): ChallengeId[] {
  return CHALLENGES.filter((c) => isChallengeCleared(c.id, ctx)).map((c) => c.id);
}
