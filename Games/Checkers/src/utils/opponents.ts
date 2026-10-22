/**
 * CPU roster with distinct styles and an unlock ladder.
 */

import { isChainUnlocked } from '@clubhouse/shared/opponentLadder';
import type { BotStyle, Difficulty } from './checkersLogic';

export type OpponentId =
  | 'rookie'
  | 'rusher'
  | 'wall'
  | 'flyer'
  | 'champ';

export type OpponentDef = {
  id: OpponentId;
  name: string;
  tagline: string;
  catchphrase: { intro: string; win: string; lose: string };
  difficulty: Difficulty;
  style: BotStyle;
  /** Must beat this opponent (or none) to unlock. */
  unlockAfter: OpponentId | null;
};

export const OPPONENTS: readonly OpponentDef[] = [
  {
    id: 'rookie',
    name: '菜鳥跳兵',
    tagline: '亂跳・愛衝',
    catchphrase: {
      intro: '我會跳棋喔！',
      win: '耶，跳到了！',
      lose: '欸？棋子呢…',
    },
    difficulty: 'easy',
    style: {
      captureGreed: 0.85,
      crownHunger: 0.3,
      caution: 0.1,
      centerBias: 0.2,
      blunderOverride: 0.5,
      depthOverride: 2,
    },
    unlockAfter: null,
  },
  {
    id: 'rusher',
    name: '衝鋒手',
    tagline: '猛攻升王',
    catchphrase: {
      intro: '別擋路！',
      win: '一路殺到王城！',
      lose: '衝太快了…',
    },
    difficulty: 'normal',
    style: {
      captureGreed: 0.7,
      crownHunger: 0.95,
      caution: 0.15,
      centerBias: 0.4,
      blunderOverride: 0.1,
      depthOverride: 3,
    },
    unlockAfter: 'rookie',
  },
  {
    id: 'wall',
    name: '鐵壁衛',
    tagline: '穩守・少換子',
    catchphrase: {
      intro: '先守住底線。',
      win: '一子未失，穩如山。',
      lose: '防線破了…',
    },
    difficulty: 'normal',
    style: {
      captureGreed: 0.35,
      crownHunger: 0.4,
      caution: 0.95,
      centerBias: 0.55,
      blunderOverride: 0.08,
      depthOverride: 4,
    },
    unlockAfter: 'rusher',
  },
  {
    id: 'flyer',
    name: '飛王師',
    tagline: '愛飛王遠程',
    catchphrase: {
      intro: '看我飛王巡弋。',
      win: '遠距一擊！',
      lose: '飛太遠回不來…',
    },
    difficulty: 'hard',
    style: {
      captureGreed: 0.8,
      crownHunger: 0.85,
      caution: 0.45,
      centerBias: 0.7,
      blunderOverride: 0.02,
      depthOverride: 5,
    },
    unlockAfter: 'wall',
  },
  {
    id: 'champ',
    name: '館主冠軍',
    tagline: '深算・不犯錯',
    catchphrase: {
      intro: '來挑戰館主吧。',
      win: '這就是冠軍的棋。',
      lose: '…你有資格稱王。',
    },
    difficulty: 'hard',
    style: {
      captureGreed: 0.55,
      crownHunger: 0.6,
      caution: 0.7,
      centerBias: 0.75,
      blunderOverride: 0,
      depthOverride: 6,
    },
    unlockAfter: 'flyer',
  },
];

export function getOpponent(id: OpponentId): OpponentDef {
  const found = OPPONENTS.find((o) => o.id === id);
  if (!found) throw new Error(`Unknown opponent: ${id}`);
  return found;
}

export function isOpponentUnlocked(
  id: OpponentId,
  beaten: ReadonlySet<OpponentId> | readonly OpponentId[],
): boolean {
  const opp = getOpponent(id);
  return isChainUnlocked(opp.unlockAfter, beaten);
}
