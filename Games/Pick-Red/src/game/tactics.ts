import {
  BLACK_ACE_POINTS,
  TOTAL_POINTS,
  capturableBy,
  cardLabel,
  isRed,
  parScore,
  pointsOf,
  rankLabel,
  SUIT_SYMBOL,
} from './cards';
import { personalityForSeat } from './cpu';
import { opponentById } from './opponents';
import { HUMAN } from './types';
import type { Card, GameState, MatchState, PersonalityId, Rank, Seat, Suit } from './types';

export type KeyCardLocation = 'mine' | 'in_hand' | 'on_table' | 'opponent' | 'hidden';

export interface KeyCardInfo {
  id: string;
  suit: Suit;
  rank: Rank;
  label: string;
  points: number;
  location: KeyCardLocation;
  holderSeat: Seat | null;
  matchingRank: Rank;
  category: 'ace' | 'red_five' | 'nine' | 'ten' | 'face';
  categoryLabel: string;
}

export interface ScoreLeverage {
  myScore: number;
  par: number;
  deckTotal: number;
  margin: number;
  tableRedPoints: number;
  myHandRedPoints: number;
  opponentsTotalScore: number;
  maxOpponentScore: number;
  remainingUnknownRedPoints: number;
  status: 'safe_lead' | 'qualified' | 'striking_distance' | 'trailing' | 'unreachable';
  statusLabel: string;
  statusDesc: string;
}

export interface TableProjectionOption {
  handCard: Card;
  targets: Card[];
  bestTarget: Card | null;
  maxPoints: number;
  isToolConversion: boolean;
  canCapture: boolean;
  discardSafety: 'safe' | 'caution' | 'danger';
  discardSafetyLabel: string;
}

export interface OpponentThreatProfile {
  seat: Seat;
  name: string;
  personalityId: PersonalityId | null;
  personalityName: string;
  tagline: string;
  currentScore: number;
  threatLevel: 'high' | 'medium' | 'normal';
  threatDeduction: string;
}

export interface GrandmasterWisdom {
  title: string;
  blurb: string;
  tag: 'tactics' | 'defense' | 'attack' | 'alert';
}

/** Pre-defined key strategic cards that drive Pick-Red matches. */
const KEY_CARD_SPECS: Array<{
  suit: Suit;
  rank: Rank;
  category: KeyCardInfo['category'];
  categoryLabel: string;
  needsBlackAces?: boolean;
}> = [
  { suit: 'hearts', rank: 1, category: 'ace', categoryLabel: '大分王牌' },
  { suit: 'diamonds', rank: 1, category: 'ace', categoryLabel: '大分王牌' },
  { suit: 'spades', rank: 1, category: 'ace', categoryLabel: '黑桃A家規', needsBlackAces: true },
  { suit: 'clubs', rank: 1, category: 'ace', categoryLabel: '梅花A家規', needsBlackAces: true },
  { suit: 'hearts', rank: 5, category: 'red_five', categoryLabel: '過紅五核心' },
  { suit: 'diamonds', rank: 5, category: 'red_five', categoryLabel: '過紅五核心' },
  { suit: 'hearts', rank: 9, category: 'nine', categoryLabel: '吃A金鑰' },
  { suit: 'diamonds', rank: 9, category: 'nine', categoryLabel: '吃A金鑰' },
  { suit: 'hearts', rank: 10, category: 'ten', categoryLabel: '紅十整分' },
  { suit: 'diamonds', rank: 10, category: 'ten', categoryLabel: '紅十整分' },
  { suit: 'hearts', rank: 11, category: 'face', categoryLabel: '紅花牌' },
  { suit: 'diamonds', rank: 11, category: 'face', categoryLabel: '紅花牌' },
  { suit: 'hearts', rank: 12, category: 'face', categoryLabel: '紅花牌' },
  { suit: 'diamonds', rank: 12, category: 'face', categoryLabel: '紅花牌' },
  { suit: 'hearts', rank: 13, category: 'face', categoryLabel: '紅花牌' },
  { suit: 'diamonds', rank: 13, category: 'face', categoryLabel: '紅花牌' },
];

/**
 * Calculates the partner rank that can capture this card under 湊十 rules.
 */
export function getMatchingRank(rank: Rank): Rank {
  if (rank >= 10) return rank;
  return (10 - rank) as Rank;
}

/**
 * Analyses the location of all strategic cards without cheating (only uses public
 * knowledge: captured cards, table cards, and player's own hand).
 */
export function analyzeKeyCardsRadar(state: GameState): KeyCardInfo[] {
  const blackAces = state.rules.blackAces;
  const myHand = state.hands[HUMAN] ?? [];
  const table = state.table;
  const captured = state.captured;

  const activeSpecs = KEY_CARD_SPECS.filter(
    (spec) => !spec.needsBlackAces || blackAces,
  );

  return activeSpecs.map((spec) => {
    const cardId = `${spec.suit}-${spec.rank}`;
    const cardObj: Card = { id: cardId, suit: spec.suit, rank: spec.rank };
    const points = pointsOf(cardObj, blackAces);

    let location: KeyCardLocation = 'hidden';
    let holderSeat: Seat | null = null;

    if (captured[HUMAN]?.some((c) => c.id === cardId)) {
      location = 'mine';
      holderSeat = HUMAN;
    } else if (myHand.some((c) => c.id === cardId)) {
      location = 'in_hand';
      holderSeat = HUMAN;
    } else if (table.some((c) => c.id === cardId)) {
      location = 'on_table';
    } else {
      for (let s = 1; s < captured.length; s++) {
        if (captured[s]?.some((c) => c.id === cardId)) {
          location = 'opponent';
          holderSeat = s;
          break;
        }
      }
    }

    return {
      id: cardId,
      suit: spec.suit,
      rank: spec.rank,
      label: `${SUIT_SYMBOL[spec.suit]}${rankLabel(spec.rank)}`,
      points,
      location,
      holderSeat,
      matchingRank: getMatchingRank(spec.rank),
      category: spec.category,
      categoryLabel: spec.categoryLabel,
    };
  });
}

/**
 * Evaluates real-time score leverage, margin vs standard qualifying score,
 * and current match trajectory.
 */
export function analyzeScoreLeverage(state: GameState): ScoreLeverage {
  const blackAces = state.rules.blackAces;
  const players = state.rules.players;
  const par = parScore(players, blackAces);
  const deckTotal = TOTAL_POINTS + (blackAces ? BLACK_ACE_POINTS : 0);

  const myScore = (state.captured[HUMAN] ?? []).reduce(
    (sum, c) => sum + pointsOf(c, blackAces),
    0,
  );

  const tableRedPoints = state.table.reduce(
    (sum, c) => sum + pointsOf(c, blackAces),
    0,
  );

  const myHandRedPoints = (state.hands[HUMAN] ?? []).reduce(
    (sum, c) => sum + pointsOf(c, blackAces),
    0,
  );

  const opponentScores = (state.captured ?? []).map((pile, seat) =>
    seat === HUMAN ? 0 : pile.reduce((sum, c) => sum + pointsOf(c, blackAces), 0),
  );

  const opponentsTotalScore = opponentScores.reduce((a, b) => a + b, 0);
  const maxOpponentScore = Math.max(0, ...opponentScores.slice(1));

  const knownRedPoints = myScore + opponentsTotalScore + tableRedPoints + myHandRedPoints;
  const remainingUnknownRedPoints = Math.max(0, deckTotal - knownRedPoints);

  const margin = myScore - par;

  let status: ScoreLeverage['status'];
  let statusLabel: string;
  let statusDesc: string;

  if (myScore >= par + 10) {
    status = 'safe_lead';
    statusLabel = '大局已定 · 鎖定勝勢';
    statusDesc = `得分超過標準分 ${margin.toFixed(0)} 分，防守黑牌即可穩保勝利！`;
  } else if (myScore >= par) {
    status = 'qualified';
    statusLabel = '合格達標 · 穩健進取';
    statusDesc = `已達標 ${margin.toFixed(0)} 分，穩紮穩打即可收獲正籌碼。`;
  } else if (myScore + tableRedPoints + remainingUnknownRedPoints < par) {
    status = 'unreachable';
    statusLabel = '殘局逆境 · 緊咬分差';
    statusDesc = `全場剩餘紅點已不足以達標，爭取減少失分收斂籌碼。`;
  } else if (par - myScore <= 15) {
    status = 'striking_distance';
    statusLabel = '勝勢在望 · 衝刺達標';
    statusDesc = `距離合格僅差 ${(par - myScore).toFixed(0)} 分，牌池有足夠紅點可翻盤！`;
  } else {
    status = 'trailing';
    statusLabel = '急起直追 · 伺機大分';
    statusDesc = `距合格尚差 ${(par - myScore).toFixed(0)} 分，緊盯紅 A 與大分牌。`;
  }

  return {
    myScore,
    par,
    deckTotal,
    margin,
    tableRedPoints,
    myHandRedPoints,
    opponentsTotalScore,
    maxOpponentScore,
    remainingUnknownRedPoints,
    status,
    statusLabel,
    statusDesc,
  };
}

/**
 * Projects all capture combinations and discard risks from the player's current hand.
 */
export function projectHandOptions(state: GameState): TableProjectionOption[] {
  const blackAces = state.rules.blackAces;
  const myHand = state.hands[HUMAN] ?? [];
  const table = state.table;

  return myHand.map((handCard) => {
    const targets = capturableBy(handCard, table);
    const canCapture = targets.length > 0;

    let bestTarget: Card | null = null;
    let maxPoints = 0;

    if (canCapture) {
      bestTarget = [...targets].sort(
        (a, b) => pointsOf(b, blackAces) - pointsOf(a, blackAces),
      )[0];
      maxPoints =
        pointsOf(handCard, blackAces) + pointsOf(bestTarget, blackAces);
    }

    const handCardPts = pointsOf(handCard, blackAces);
    const isToolConversion =
      canCapture &&
      handCardPts === 0 &&
      targets.some((t) => pointsOf(t, blackAces) > 0);

    let discardSafety: TableProjectionOption['discardSafety'] = 'safe';
    let discardSafetyLabel = '安全黑牌';

    if (!canCapture) {
      if (handCardPts === 0) {
        discardSafety = 'safe';
        discardSafetyLabel = '無分安全墊牌';
      } else if (handCardPts >= 10) {
        discardSafety = 'danger';
        discardSafetyLabel = `高危送分牌（${handCardPts} 分）`;
      } else {
        discardSafety = 'caution';
        discardSafetyLabel = `帶分風險牌（${handCardPts} 分）`;
      }
    }

    return {
      handCard,
      targets,
      bestTarget,
      maxPoints,
      isToolConversion,
      canCapture,
      discardSafety,
      discardSafetyLabel,
    };
  });
}

/**
 * Constructs threat dossier and tactical deduction for each CPU opponent.
 */
export function analyzeOpponentThreats(
  state: GameState,
  match: MatchState | null,
  seatNames: string[],
): OpponentThreatProfile[] {
  const blackAces = state.rules.blackAces;
  const profiles: OpponentThreatProfile[] = [];

  for (let seat = 1; seat < state.hands.length; seat++) {
    const name = seatNames[seat] ?? `對家${seat}`;
    const person = personalityForSeat(seat, state.seatPersonalities);
    const currentScore = (state.captured[seat] ?? []).reduce(
      (sum, c) => sum + pointsOf(c, blackAces),
      0,
    );

    let tagline = person?.blurb ?? '牌風謹慎';
    if (match?.config.ladderOpponentId && seat === 1) {
      const opp = opponentById(match.config.ladderOpponentId);
      if (opp) tagline = opp.tagline;
    }

    let threatLevel: OpponentThreatProfile['threatLevel'] = 'normal';
    let threatDeduction = '靜觀桌面牌池，伺機收分。';

    const tableHasAce = state.table.some(
      (c) => (isRed(c) && c.rank === 1) || (blackAces && c.rank === 1),
    );
    const tableHasRedFive =
      state.rules.doubleRedFive &&
      state.table.some((c) => isRed(c) && c.rank === 5);

    if (tableHasAce) {
      threatLevel = 'high';
      threatDeduction = '桌面有大分王牌 A！對家隨時可能出 9 截擊奪分，務必警惕。';
    } else if (tableHasRedFive) {
      threatLevel = 'high';
      threatDeduction = '桌面有紅 5 誘餌，謹防對家吃進並觸發過紅五連擊！';
    } else if (person?.id === 'aceChaser') {
      threatLevel = 'medium';
      threatDeduction = '追 A 手專注於 A 與 9 牌，對大分紅牌嗅覺極其敏銳。';
    } else if (person?.id === 'miser') {
      threatLevel = 'normal';
      threatDeduction = '守財奴滴水不漏，習慣用黑牌當工具，鮮少白送紅牌。';
    } else if (person?.id === 'feeder') {
      threatLevel = 'normal';
      threatDeduction = '浪子出牌大膽，常將紅牌直接打入牌池，可留意撿漏。';
    }

    profiles.push({
      seat,
      name,
      personalityId: person?.id ?? null,
      personalityName: person?.name ?? '牌友',
      tagline,
      currentScore,
      threatLevel,
      threatDeduction,
    });
  }

  return profiles;
}

/**
 * Generates grandmaster strategic wisdom based on the overarching game state.
 */
export function getGrandmasterWisdom(
  state: GameState,
  leverage: ScoreLeverage,
): GrandmasterWisdom {
  const blackAces = state.rules.blackAces;

  if (state.phase === 'over') {
    if (leverage.margin >= 0) {
      return {
        title: '大師祝捷 · 妙手通關',
        blurb: `本局收穫 ${leverage.myScore} 分（超標 ${leverage.margin.toFixed(0)} 分），落子嚴謹，換分效率高超！`,
        tag: 'attack',
      };
    }
    return {
      title: '大師複盤 · 重整旗鼓',
      blurb: `本局獲得 ${leverage.myScore} 分，差 ${(leverage.par - leverage.myScore).toFixed(0)} 分達標。留意下局序盤多用黑牌護住紅牌。`,
      tag: 'defense',
    };
  }

  // Already safely ahead
  if (leverage.status === 'safe_lead') {
    return {
      title: '鎖定勝局 · 靜水流深',
      blurb: `你已斬獲 ${leverage.myScore} 分超過標準分！此時不必強行冒險吃牌，以黑牌或同點牌安全墊桌即可鎖定勝局。`,
      tag: 'defense',
    };
  }

  // Table has big Ace
  const tableHasBigAce = state.table.some(
    (c) => (isRed(c) && c.rank === 1) || (blackAces && c.rank === 1),
  );
  if (tableHasBigAce) {
    return {
      title: '大分現身 · 兵家必爭',
      blurb: '桌面現有大分 A（20 分起）！若手中有 9 務必即刻出手收牌，切勿將 9 牌棄置桌上拱手讓人。',
      tag: 'alert',
    };
  }

  // Double red five threat
  if (state.rules.doubleRedFive) {
    const tableRedFive = state.table.some((c) => isRed(c) && c.rank === 5);
    if (tableRedFive) {
      return {
        title: '過紅五警戒 · 防守要衝',
        blurb: '桌面正有紅 5！若對家此回合連吃兩張紅 5，各家將扣 20 籌碼；手握 5 牌時應優先配對清場。',
        tag: 'alert',
      };
    }
  }

  // Endgame phase
  if (state.pile.length <= 4) {
    return {
      title: '殘局收斂 · 謹慎孤張',
      blurb: '牌庫即將見底，桌牌逐漸收斂。注意 5 號牌與大同點對子若無配對容易沉底，宜及早處理。',
      tag: 'tactics',
    };
  }

  // Opening phase
  if (state.pile.length >= 18) {
    return {
      title: '序盤佈局 · 以黑換紅',
      blurb: '開局牌池深厚，首選無分黑牌打入牌池換取紅點；將紅 9 與大點數保留手中作為決勝籌碼。',
      tag: 'tactics',
    };
  }

  // Midgame
  if (leverage.tableRedPoints >= 20) {
    return {
      title: '牌池充盈 · 集中收割',
      blurb: `桌面累積了 ${leverage.tableRedPoints} 分紅點！檢視手牌是否有能湊十的配對，優先執行大分收割。`,
      tag: 'attack',
    };
  }

  return {
    title: '推弈有道 · 算子為先',
    blurb: '出牌前先算下家能否吃牌。無可吃時，丟黑桃或梅花 0 分牌永遠比丟紅牌安全。',
    tag: 'tactics',
  };
}
