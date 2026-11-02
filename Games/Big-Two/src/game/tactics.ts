import { LOWEST_CARD_ID, cardLabel, isDeuce, rankLabel, sortCards } from './cards';
import { personalityForSeat, turnsToEmpty } from './cpu';
import { unseenBy } from './memory';
import { TYPE_LABEL } from './plays';
import { HUMAN, SEATS } from './types';
import type {
  Card,
  CardId,
  GameState,
  Play,
  Rank,
  Seat,
  Suit,
} from './types';

export interface DeuceTracker {
  suit: Suit;
  rank: Rank;
  id: CardId;
  status: 'inHand' | 'played' | 'unseen';
  playedBy?: Seat;
}

export type ThreatLevel = 'low' | 'medium' | 'high';

export interface MonsterThreat {
  hasQuadsRisk: boolean;
  quadsRanks: Rank[];
  hasStraightFlushRisk: boolean;
  threatLevel: ThreatLevel;
  summary: string;
}

export type DangerLevel = 'safe' | 'moderate' | 'high' | 'critical';

export interface OpponentRead {
  seat: Seat;
  name: string;
  personalityName: string;
  personalityBlurb: string;
  count: number;
  dangerLevel: DangerLevel;
  isNextSeat: boolean;
  passInferences: string[];
  deucesPlayed: number;
}

export interface TacticalRadar {
  deuces: DeuceTracker[];
  spadesTwoStatus: DeuceTracker;
  unseenDeuceCount: number;
  lowestCardStatus: {
    status: 'inHand' | 'played' | 'unseen';
    playedBy?: Seat;
  };
  monsterThreat: MonsterThreat;
  opponents: OpponentRead[];
  criticalSeats: Seat[];
  isNextSeatCritical: boolean;
  humanTurns: number;
  strategyLabel: string;
  masterTip: string;
}

const DEUCE_SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

/** Find the active play in the current trick before a given log index. */
export function activePlayBefore(log: GameState['log'], index: number): Play | null {
  for (let i = index - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry.play !== null) return entry.play;
  }
  return null;
}

/** Gather what each opponent passed against during the game. */
export function inferPasses(state: GameState): Map<Seat, string[]> {
  const map = new Map<Seat, string[]>();
  for (let s = 1; s < SEATS; s++) {
    map.set(s, []);
  }

  for (let i = 0; i < state.log.length; i++) {
    const entry = state.log[i];
    if (entry.play === null && entry.seat !== HUMAN) {
      const target = activePlayBefore(state.log, i);
      if (!target) continue;

      let desc = '';
      if (target.cards.length === 1) {
        desc = `單張 ${rankLabel(target.cards[0].rank)}`;
      } else if (target.cards.length === 2) {
        desc = `對子 ${rankLabel(target.cards[0].rank)}`;
      } else if (target.cards.length === 5) {
        desc = TYPE_LABEL[target.type];
      }

      if (desc) {
        const list = map.get(entry.seat) ?? [];
        if (!list.includes(desc)) {
          list.push(desc);
          map.set(entry.seat, list);
        }
      }
    }
  }

  return map;
}

/** Count how many deuces a seat has played so far. */
export function deucesPlayedBySeat(state: GameState): Map<Seat, number> {
  const map = new Map<Seat, number>();
  for (let s = 0; s < SEATS; s++) map.set(s, 0);

  for (const entry of state.log) {
    if (!entry.play) continue;
    for (const card of entry.play.cards) {
      if (isDeuce(card)) {
        map.set(entry.seat, (map.get(entry.seat) ?? 0) + 1);
      }
    }
  }
  return map;
}

/** Track the status of all four 2s (♠2, ♥2, ♦2, ♣2). */
export function trackDeuces(state: GameState): DeuceTracker[] {
  const playedDeuces = new Map<CardId, Seat>();
  for (const entry of state.log) {
    if (!entry.play) continue;
    for (const card of entry.play.cards) {
      if (isDeuce(card)) {
        playedDeuces.set(card.id, entry.seat);
      }
    }
  }

  const humanHand = state.hands[HUMAN];

  return DEUCE_SUITS.map((suit) => {
    const id = `${suit}-2` as CardId;
    if (humanHand.some((c) => c.id === id)) {
      return { suit, rank: 2, id, status: 'inHand' };
    }
    const playedBy = playedDeuces.get(id);
    if (playedBy !== undefined) {
      return { suit, rank: 2, id, status: 'played', playedBy };
    }
    return { suit, rank: 2, id, status: 'unseen' };
  });
}

/** Check status of lowest card (♣3). */
export function trackLowestCard(state: GameState): {
  status: 'inHand' | 'played' | 'unseen';
  playedBy?: Seat;
} {
  if (state.hands[HUMAN].some((c) => c.id === LOWEST_CARD_ID)) {
    return { status: 'inHand' };
  }
  for (const entry of state.log) {
    if (!entry.play) continue;
    if (entry.play.cards.some((c) => c.id === LOWEST_CARD_ID)) {
      return { status: 'played', playedBy: entry.seat };
    }
  }
  return { status: 'unseen' };
}

/** Evaluate monster threat (quads & straight flushes) among unseen cards. */
export function evaluateMonsterThreat(state: GameState): MonsterThreat {
  const pool = unseenBy(state, HUMAN);
  const byRank = new Map<Rank, number>();
  for (const card of pool) {
    byRank.set(card.rank, (byRank.get(card.rank) ?? 0) + 1);
  }

  const quadsRanks: Rank[] = [];
  for (const [rank, count] of byRank) {
    if (count === 4) quadsRanks.push(rank);
  }

  // Any seat with >= 5 cards could potentially hold a quads or straight flush.
  const maxCpuHand = Math.max(...state.hands.slice(1).map((h) => h.length));
  const hasQuadsRisk = quadsRanks.length > 0 && maxCpuHand >= 5;

  // Straight flush detection in unseen pool.
  const bySuit = new Map<Suit, Set<number>>();
  for (const card of pool) {
    const set = bySuit.get(card.suit) ?? new Set<number>();
    set.add(card.rank);
    bySuit.set(card.suit, set);
  }

  let hasStraightFlushRisk = false;
  if (maxCpuHand >= 5) {
    for (const [, ranks] of bySuit) {
      if (ranks.size < 5) continue;
      // Check 5 consecutive
      const list = [...ranks].sort((a, b) => a - b);
      for (let i = 0; i <= list.length - 5; i++) {
        if (
          list[i + 1] === list[i] + 1 &&
          list[i + 2] === list[i] + 2 &&
          list[i + 3] === list[i] + 3 &&
          list[i + 4] === list[i] + 4
        ) {
          hasStraightFlushRisk = true;
          break;
        }
      }
      if (hasStraightFlushRisk) break;
    }
  }

  let threatLevel: ThreatLevel = 'low';
  let summary = '檯面平穩，無極端怪物牌型威脅';

  if (hasQuadsRisk || hasStraightFlushRisk) {
    threatLevel = 'high';
    summary = hasStraightFlushRisk
      ? '高危戒備！未現身牌中潛藏同花順可能'
      : `高危戒備！未現身牌中潛藏點數 ${quadsRanks.map(rankLabel).join('、')} 鐵支`;
  } else if (byRank.get(2) && (byRank.get(2) ?? 0) >= 2) {
    threatLevel = 'medium';
    summary = '中度警戒：場上仍有複數老二潛伏未現身';
  }

  return {
    hasQuadsRisk,
    quadsRanks,
    hasStraightFlushRisk,
    threatLevel,
    summary,
  };
}

/** Classify danger level based on card count. */
export function dangerLevelForCount(count: number): DangerLevel {
  if (count <= 1) return 'critical';
  if (count <= 3) return 'high';
  if (count <= 7) return 'moderate';
  return 'safe';
}

/** Generate real-time Tactical Radar state. */
export function computeTacticalRadar(
  state: GameState,
  opponentNames: string[] = ['你', '下家', '對家', '上家'],
): TacticalRadar {
  const deuces = trackDeuces(state);
  const spadesTwoStatus = deuces.find((d) => d.suit === 'spades') ?? deuces[0];
  const unseenDeuceCount = deuces.filter((d) => d.status === 'unseen').length;
  const lowestCardStatus = trackLowestCard(state);
  const monsterThreat = evaluateMonsterThreat(state);
  const passMap = inferPasses(state);
  const deucesMap = deucesPlayedBySeat(state);

  const opponents: OpponentRead[] = [1, 2, 3].map((seat) => {
    const person = personalityForSeat(seat, state.seatPersonalities);
    const count = state.hands[seat].length;
    return {
      seat,
      name: opponentNames[seat] ?? `座位 ${seat}`,
      personalityName: person?.name ?? '未知風格',
      personalityBlurb: person?.blurb ?? '',
      count,
      dangerLevel: dangerLevelForCount(count),
      isNextSeat: seat === 1,
      passInferences: passMap.get(seat) ?? [],
      deucesPlayed: deucesMap.get(seat) ?? 0,
    };
  });

  const criticalSeats = opponents
    .filter((op) => op.count === 1)
    .map((op) => op.seat);
  const isNextSeatCritical = state.hands[1]?.length === 1;

  const humanHand = state.hands[HUMAN];
  const humanTurns = turnsToEmpty(humanHand);

  // Strategy Label
  let strategyLabel = '平局攻防';
  if (isNextSeatCritical) {
    strategyLabel = '頂大防守戒備';
  } else if (criticalSeats.length > 0) {
    strategyLabel = '封鎖終結';
  } else if (humanTurns <= 2) {
    strategyLabel = '衝刺清盤';
  } else if (spadesTwoStatus.status === 'inHand') {
    strategyLabel = '黑桃 2 控場';
  } else if (humanTurns <= 4) {
    strategyLabel = '爭奪領出';
  }

  // Adaptive Master Tip
  let masterTip = '穩紮穩打：保留大牌奪回領出權，避免過早拆散對子與順子。';

  if (isNextSeatCritical) {
    masterTip =
      '⚠️【頂大防禦戒備】下家僅剩 1 張牌！領出單張或頂牌時務必出手中最大牌，防止被保送！';
  } else if (criticalSeats.length > 0) {
    masterTip =
      '⚠️【尾聲緊繃】對手手牌已見底（僅剩 1 張）！嚴禁出小單張讓對方輕易順走。';
  } else if (spadesTwoStatus.status === 'inHand' && state.turn === HUMAN) {
    masterTip =
      '👑【黑桃 2 掌控】手握全場至尊黑桃 2！把握絕對控場權，伺機在關鍵時刻一槌定音。';
  } else if (spadesTwoStatus.status === 'played') {
    masterTip =
      '🛡️【黑桃 2 已出】至尊牌已打出，紅心 2 與方塊 2 晉升為場上最高威懾，出牌時留心餘牌！';
  } else if (humanTurns <= 2) {
    masterTip =
      '⚡【終局衝刺】預估僅需 1~2 輪即可出清！優先搶回領出權，確保一波流帶走比賽。';
  } else if (monsterThreat.threatLevel === 'high') {
    masterTip =
      '🚨【怪獸牌警戒】未現身牌池具備鐵支或同花順可能，切勿過早亮出全部底牌！';
  } else if (state.table === null) {
    masterTip =
      '🎯【自由領出】你擁有發牌主動權！先出多張牌型消耗手牌，或從小牌開路試探對手反應。';
  }

  return {
    deuces,
    spadesTwoStatus,
    unseenDeuceCount,
    lowestCardStatus,
    monsterThreat,
    opponents,
    criticalSeats,
    isNextSeatCritical,
    humanTurns,
    strategyLabel,
    masterTip,
  };
}
