/**
 * Named-opponent unlock ladder — beat one to unlock the next.
 * Each opponent wears a distinct capture / discard personality.
 */

import { isFrontierUnlocked } from '@clubhouse/shared/opponentLadder';
import type {
  DifficultyId,
  NamedOpponent,
  NamedOpponentId,
  PersonalityId,
  PlayStyle,
  SeatPersonalityMap,
} from './types';

export const NAMED_OPPONENTS: readonly NamedOpponent[] = [
  {
    id: 'ming',
    name: '菜鳥阿明',
    tagline: '浪子入門',
    blurb: '常丟紅牌、撿牌不挑；適合熱身。',
    style: 'feeder',
    personality: 'feeder',
    difficulty: 'easy',
  },
  {
    id: 'mei',
    name: '浪子小美',
    tagline: '愛丟紅牌',
    blurb: '普通難度的浪子：丟牌口味明顯，工具牌不挑。',
    style: 'feeder',
    personality: 'feeder',
    difficulty: 'normal',
  },
  {
    id: 'cai',
    name: '守財奴阿財',
    tagline: '絕少白送',
    blurb: '優先用黑牌當工具，紅牌能留就留。',
    style: 'miser',
    personality: 'miser',
    difficulty: 'normal',
  },
  {
    id: 'zhen',
    name: '追A手阿珍',
    tagline: '專搶大分',
    blurb: '困難座位＋特別盯 A 與 9，搶二十分紅心。',
    style: 'aceChaser',
    personality: 'aceChaser',
    difficulty: 'hard',
  },
  {
    id: 'king',
    name: '紅點魔王',
    tagline: '全能壓場',
    blurb: '困難座位、三種個性輪替的最終試煉。',
    style: 'chaos',
    personality: 'aceChaser',
    difficulty: 'hard',
  },
] as const;

export function opponentCount(): number {
  return NAMED_OPPONENTS.length;
}

export function opponentByIndex(index: number): NamedOpponent | undefined {
  if (index < 0 || index >= NAMED_OPPONENTS.length) return undefined;
  return NAMED_OPPONENTS[index];
}

export function opponentById(id: string): NamedOpponent | undefined {
  return NAMED_OPPONENTS.find((op) => op.id === id);
}

export function opponentIndexOf(id: NamedOpponentId): number {
  return NAMED_OPPONENTS.findIndex((op) => op.id === id);
}

/** Frontier: indices < clearedCount are cleared; index === clearedCount is playable. */
export function isOpponentUnlocked(index: number, clearedCount: number): boolean {
  return isFrontierUnlocked(index, clearedCount, NAMED_OPPONENTS.length);
}

export function ladderDifficulty(opponent: NamedOpponent): DifficultyId {
  return opponent.difficulty;
}

/**
 * Seat colouring for a ladder duel: the named foe sits 對家甲 (1).
 * Extra seats (3／4 人) wear supporting styles so the table still feels distinct.
 */
export function ladderSeatPersonalities(opponent: NamedOpponent): SeatPersonalityMap {
  const lead = opponent.personality;
  if (opponent.style === 'chaos') {
    return { 1: 'aceChaser', 2: 'miser', 3: 'feeder' };
  }
  if (opponent.style === 'feeder') {
    return { 1: lead, 2: 'miser', 3: 'aceChaser' };
  }
  if (opponent.style === 'miser') {
    return { 1: lead, 2: 'feeder', 3: 'aceChaser' };
  }
  return { 1: lead, 2: 'feeder', 3: 'miser' };
}

export const PLAY_STYLE_LABEL: Record<PlayStyle, string> = {
  feeder: '浪子',
  miser: '守財奴',
  aceChaser: '追A手',
  chaos: '全能',
};

export type { PersonalityId };
