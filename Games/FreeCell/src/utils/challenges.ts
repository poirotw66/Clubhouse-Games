/**
 * Optional clear goals tracked every win — skill beyond "finish once".
 */

export type ChallengeId =
  | 'no-undo'
  | 'no-freecell'
  | 'two-cells'
  | 'moves-60'
  | 'moves-par'
  | 'time-300';

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
    id: 'no-freecell',
    name: '空當禁令',
    blurb: '通關全程不使用暫存格',
    goalLabel: '未用暫存格',
  },
  {
    id: 'two-cells',
    name: '雙格挑戰',
    blurb: '僅開放 2 個暫存格並通關',
    goalLabel: '2 暫存格通關',
  },
  {
    id: 'moves-60',
    name: '步步為營',
    blurb: '60 步以內獲勝',
    goalLabel: '≤ 60 步',
  },
  {
    id: 'moves-par',
    name: '破標準',
    blurb: '步數嚴格少於 solver 標準步數',
    goalLabel: '少於標準步',
  },
  {
    id: 'time-300',
    name: '競速五分',
    blurb: '5 分鐘內獲勝',
    goalLabel: '≤ 5:00',
  },
];

export type ChallengeContext = {
  won: boolean;
  usedUndo: boolean;
  usedFreeCell: boolean;
  freeCellSlots: 2 | 4;
  moves: number;
  parMoves: number | null;
  elapsedSec: number;
};

export function isChallengeCleared(id: ChallengeId, ctx: ChallengeContext): boolean {
  if (!ctx.won) return false;
  switch (id) {
    case 'no-undo':
      return !ctx.usedUndo;
    case 'no-freecell':
      return !ctx.usedFreeCell;
    case 'two-cells':
      return ctx.freeCellSlots === 2;
    case 'moves-60':
      return ctx.moves <= 60;
    case 'moves-par':
      return ctx.parMoves != null && ctx.moves < ctx.parMoves;
    case 'time-300':
      return ctx.elapsedSec <= 300;
    default:
      return false;
  }
}

export function evaluateChallenges(ctx: ChallengeContext): ChallengeId[] {
  return CHALLENGES.filter((c) => isChallengeCleared(c.id, ctx)).map((c) => c.id);
}
