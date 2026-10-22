/**
 * Named-opponent unlock ladder — beat one to unlock the next.
 * Each opponent wears a distinct memory / discard style.
 */

import type {
  DifficultyId,
  MemoryStyle,
  NamedOpponent,
  NamedOpponentId,
  PersonalityId,
  SeatPersonalityMap,
} from './types';

export const NAMED_OPPONENTS: readonly NamedOpponent[] = [
  {
    id: 'ming',
    name: '菜鳥阿明',
    tagline: '愛拆牌',
    blurb: '能出就出，常把大牌拆進五張。適合熱身。',
    style: 'split',
    personality: 'rusher',
    difficulty: 'easy',
  },
  {
    id: 'mei',
    name: '拆牌阿美',
    tagline: '節奏優先',
    blurb: '專攻最少輪數出完；會主動拆對子湊順子。',
    style: 'split',
    personality: 'rusher',
    difficulty: 'normal',
  },
  {
    id: 'qiang',
    name: '囤貨阿強',
    tagline: '愛留大牌',
    blurb: '死守 2 與大獎，專搶領出權；非必要不甩控場牌。',
    style: 'hoard',
    personality: 'controller',
    difficulty: 'normal',
  },
  {
    id: 'zhen',
    name: '記牌阿珍',
    tagline: '會記牌',
    blurb: '盯已出牌與剩餘大獎，專壓快出完的人。',
    style: 'count',
    personality: 'counter',
    difficulty: 'hard',
  },
  {
    id: 'king',
    name: '牌桌魔王',
    tagline: '壓場＋翻盤',
    blurb: '記牌、留控場、盯尾聲全開的最終試煉。',
    style: 'chaos',
    personality: 'counter',
    difficulty: 'hard',
  },
] as const;

const STYLE_TO_PERSONALITY: Record<MemoryStyle, PersonalityId> = {
  split: 'rusher',
  hoard: 'controller',
  count: 'counter',
  pressure: 'counter',
  chaos: 'controller',
};

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
  return index <= clearedCount;
}

export function stylePersonality(style: MemoryStyle): PersonalityId {
  return STYLE_TO_PERSONALITY[style];
}

/**
 * Seat colouring for a ladder duel: the named foe sits 下家 (1);
 * 對家／上家 wear supporting styles so the table still feels like three people.
 */
export function ladderSeatPersonalities(opponent: NamedOpponent): SeatPersonalityMap {
  const lead = opponent.personality;
  if (opponent.style === 'split') {
    return { 1: lead, 2: 'controller', 3: 'counter' };
  }
  if (opponent.style === 'hoard') {
    return { 1: lead, 2: 'rusher', 3: 'counter' };
  }
  if (opponent.style === 'count' || opponent.style === 'pressure') {
    return { 1: lead, 2: 'rusher', 3: 'controller' };
  }
  // chaos: rotate the three classic seats so the boss reads as all of them.
  return { 1: 'counter', 2: 'controller', 3: 'rusher' };
}

export function ladderDifficulty(opponent: NamedOpponent): DifficultyId {
  return opponent.difficulty;
}

export const MEMORY_STYLE_LABEL: Record<MemoryStyle, string> = {
  split: '愛拆牌',
  hoard: '愛留大牌',
  count: '會記牌',
  pressure: '壓場',
  chaos: '全能',
};
