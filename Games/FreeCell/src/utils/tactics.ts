import type { GameState, Position, Suit } from '../types.ts';
import type { FreeCellSlots } from './storage.ts';
import { canMove, getSafeFoundationMoves, isValidSequence } from './gameLogic.ts';

export interface SupermoveCapacity {
  emptyFreeCells: number;
  emptyTableaus: number;
  capacityToTableau: number;
  capacityToEmptyTableau: number;
  formulaString: string;
  statusLevel: 'ultra' | 'high' | 'dual' | 'single';
  statusLabel: string;
}

export function getSupermoveCapacity(
  emptyFreeCells: number,
  emptyTableaus: number,
): SupermoveCapacity {
  const capacityToTableau = (emptyFreeCells + 1) * Math.pow(2, emptyTableaus);
  const capacityToEmptyTableau =
    (emptyFreeCells + 1) * Math.pow(2, Math.max(0, emptyTableaus - 1));

  let statusLevel: SupermoveCapacity['statusLevel'] = 'single';
  let statusLabel = '空間告急';
  if (capacityToTableau >= 6) {
    statusLevel = 'ultra';
    statusLabel = '極致超能';
  } else if (capacityToTableau >= 3) {
    statusLevel = 'high';
    statusLabel = '靈活中轉';
  } else if (capacityToTableau === 2) {
    statusLevel = 'dual';
    statusLabel = '雙牌借位';
  }

  const formulaString = `(1 + ${emptyFreeCells}) × 2^${emptyTableaus} = ${capacityToTableau}`;

  return {
    emptyFreeCells,
    emptyTableaus,
    capacityToTableau,
    capacityToEmptyTableau,
    formulaString,
    statusLevel,
    statusLabel,
  };
}

export interface TacticalAssessment {
  legalMovesCount: number;
  hasSafeFoundationMove: boolean;
  mobilityLevel: 'deadlock' | 'critical' | 'safe_ready' | 'fluid';
  message: string;
}

export function evaluateTactics(
  state: GameState,
  freeCellSlots: FreeCellSlots = 4,
): TacticalAssessment {
  const safeMove = getSafeFoundationMoves(state);
  const hasSafeFoundationMove = Boolean(safeMove);

  let legalMovesCount = 0;
  const isSlotLocked = (idx: number) => freeCellSlots === 2 && idx >= 2;

  // 1. From FreeCells
  for (let i = 0; i < 4; i++) {
    if (isSlotLocked(i)) continue;
    const card = state.freeCells[i];
    if (!card) continue;
    const source: Position = { zone: 'freeCell', index: i };

    if (canMove(state, source, { zone: 'foundation', index: 0 })) {
      legalMovesCount++;
    }

    for (let t = 0; t < 8; t++) {
      if (canMove(state, source, { zone: 'tableau', index: t })) {
        legalMovesCount++;
      }
    }
  }

  // 2. From Tableaus
  for (let t = 0; t < 8; t++) {
    const col = state.tableaus[t];
    if (!col || col.length === 0) continue;

    const topIdx = col.length - 1;
    const topSource: Position = { zone: 'tableau', index: t, cardIndex: topIdx };

    if (canMove(state, topSource, { zone: 'foundation', index: 0 })) {
      legalMovesCount++;
    }

    for (let f = 0; f < 4; f++) {
      if (isSlotLocked(f)) continue;
      if (canMove(state, topSource, { zone: 'freeCell', index: f })) {
        legalMovesCount++;
      }
    }

    for (let c = col.length - 1; c >= 0; c--) {
      const seq = col.slice(c);
      if (!isValidSequence(seq)) break;
      const seqSource: Position = { zone: 'tableau', index: t, cardIndex: c };
      for (let destT = 0; destT < 8; destT++) {
        if (destT === t) continue;
        if (canMove(state, seqSource, { zone: 'tableau', index: destT })) {
          legalMovesCount++;
        }
      }
    }
  }

  if (legalMovesCount === 0) {
    return {
      legalMovesCount,
      hasSafeFoundationMove,
      mobilityLevel: 'deadlock',
      message: '死局警報：無合法步數，請按 Z 悔棋或同局重發',
    };
  }

  if (hasSafeFoundationMove) {
    return {
      legalMovesCount,
      hasSafeFoundationMove,
      mobilityLevel: 'safe_ready',
      message: '安全收牌就緒：可按 A 自動送入回收區',
    };
  }

  if (legalMovesCount <= 2) {
    return {
      legalMovesCount,
      hasSafeFoundationMove,
      mobilityLevel: 'critical',
      message: `局勢受限：僅餘 ${legalMovesCount} 種合法移動，請謹慎保留空位`,
    };
  }

  return {
    legalMovesCount,
    hasSafeFoundationMove,
    mobilityLevel: 'fluid',
    message: `動能充裕：有 ${legalMovesCount} 種可行移動，穩步推進中`,
  };
}

export interface SafeCardItem {
  card: { id: string; suit: Suit; rank: number; color: 'red' | 'black' };
  source: Position;
  label: string;
}

export interface TrappedKeyCard {
  suit: Suit;
  rank: number;
  columnIndex: number;
  depth: number;
  symbol: string;
  label: string;
}

export interface SolutionRouteTelemetry {
  supermove: SupermoveCapacity;
  assessment: TacticalAssessment;
  safeCards: SafeCardItem[];
  trappedKeyCards: TrappedKeyCard[];
  mobilityPercent: number;
  riskIndex: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskLabel: string;
  recommendedRoute: string;
}

const SUIT_GLYPHS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_NAMES: Record<Suit, string> = {
  spades: '黑桃',
  hearts: '紅心',
  diamonds: '方塊',
  clubs: '梅花',
};

export function getAllSafeFoundationCards(
  state: GameState,
  freeCellSlots: FreeCellSlots = 4,
): SafeCardItem[] {
  const isSlotLocked = (idx: number) => freeCellSlots === 2 && idx >= 2;
  const safeList: SafeCardItem[] = [];

  const getMinOppositeRank = (color: 'red' | 'black') => {
    if (color === 'red') {
      return Math.min(state.foundations.spades, state.foundations.clubs);
    } else {
      return Math.min(state.foundations.hearts, state.foundations.diamonds);
    }
  };

  const isSafe = (card: { suit: Suit; rank: number; color: 'red' | 'black' }) => {
    if (card.rank === state.foundations[card.suit] + 1) {
      return card.rank <= getMinOppositeRank(card.color) + 1 || card.rank <= 2;
    }
    return false;
  };

  // Check free cells
  for (let i = 0; i < 4; i++) {
    if (isSlotLocked(i)) continue;
    const card = state.freeCells[i];
    if (card && isSafe(card)) {
      safeList.push({
        card,
        source: { zone: 'freeCell', index: i },
        label: `暫存${i + 1} ${SUIT_GLYPHS[card.suit]}${card.rank === 1 ? 'A' : card.rank}`,
      });
    }
  }

  // Check tableau tops
  for (let t = 0; t < 8; t++) {
    const col = state.tableaus[t];
    if (!col || col.length === 0) continue;
    const topIdx = col.length - 1;
    const topCard = col[topIdx];
    if (topCard && isSafe(topCard)) {
      safeList.push({
        card: topCard,
        source: { zone: 'tableau', index: t, cardIndex: topIdx },
        label: `第${t + 1}列 ${SUIT_GLYPHS[topCard.suit]}${topCard.rank === 1 ? 'A' : topCard.rank}`,
      });
    }
  }

  return safeList;
}

export function getTrappedKeyCards(state: GameState): TrappedKeyCard[] {
  const trapped: TrappedKeyCard[] = [];
  const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

  for (const suit of suits) {
    const targetRanks = [1, 2].filter((r) => state.foundations[suit] < r);
    for (const rank of targetRanks) {
      for (let t = 0; t < 8; t++) {
        const col = state.tableaus[t];
        if (!col) continue;
        const cardIndex = col.findIndex((c) => c.suit === suit && c.rank === rank);
        if (cardIndex >= 0) {
          const depth = col.length - 1 - cardIndex;
          if (depth > 0) {
            trapped.push({
              suit,
              rank,
              columnIndex: t,
              depth,
              symbol: SUIT_GLYPHS[suit],
              label: `${SUIT_NAMES[suit]} ${rank === 1 ? 'A' : '2'}（列${t + 1} 壓 ${depth} 張）`,
            });
          }
        }
      }
    }
  }

  return trapped.sort((a, b) => b.depth - a.depth);
}

export function getSolutionRouteTelemetry(
  state: GameState,
  freeCellSlots: FreeCellSlots = 4,
): SolutionRouteTelemetry {
  const isSlotLocked = (idx: number) => freeCellSlots === 2 && idx >= 2;
  const emptyFreeCells = state.freeCells.filter(
    (c, idx) => c === null && !isSlotLocked(idx),
  ).length;
  const emptyTableaus = state.tableaus.filter((col) => col.length === 0).length;

  const supermove = getSupermoveCapacity(emptyFreeCells, emptyTableaus);
  const assessment = evaluateTactics(state, freeCellSlots);
  const safeCards = getAllSafeFoundationCards(state, freeCellSlots);
  const trappedKeyCards = getTrappedKeyCards(state);

  // Mobility percentage: baseline calibrated to 10 moves = 100%
  const mobilityPercent = Math.min(100, Math.round((assessment.legalMovesCount / 10) * 100));

  // Risk computation
  let riskIndex = 15;
  if (assessment.mobilityLevel === 'deadlock') {
    riskIndex = 100;
  } else if (assessment.mobilityLevel === 'critical') {
    riskIndex = 80;
  } else {
    if (emptyFreeCells === 0) riskIndex += 35;
    else if (emptyFreeCells === 1) riskIndex += 18;

    if (emptyTableaus === 0) riskIndex += 20;

    const severeTrapped = trappedKeyCards.filter((t) => t.depth >= 4).length;
    riskIndex += severeTrapped * 6;
  }
  riskIndex = Math.min(100, Math.max(5, riskIndex));

  let riskLevel: SolutionRouteTelemetry['riskLevel'] = 'low';
  let riskLabel = '暢行無阻';
  if (riskIndex >= 85) {
    riskLevel = 'critical';
    riskLabel = '極限險局';
  } else if (riskIndex >= 60) {
    riskLevel = 'high';
    riskLabel = '空間緊縮';
  } else if (riskIndex >= 35) {
    riskLevel = 'medium';
    riskLabel = '謹慎借位';
  }

  // Recommended route
  let recommendedRoute = '穩步推進：尋找長串交替接牌機會';
  if (assessment.mobilityLevel === 'deadlock') {
    recommendedRoute = '死局警報：無合法步數，請按 Z 悔棋';
  } else if (safeCards.length > 0) {
    recommendedRoute = `安全雷達：可直收 ${safeCards.length} 張牌至回收區（按 A 一鍵收牌）`;
  } else if (emptyTableaus === 0) {
    // Find column closest to being cleared
    let minColIdx = -1;
    let minLen = 999;
    state.tableaus.forEach((col, idx) => {
      if (col.length > 0 && col.length < minLen) {
        minLen = col.length;
        minColIdx = idx;
      }
    });
    if (minColIdx >= 0 && minLen <= 3) {
      recommendedRoute = `空列倍增：優先清空第 ${minColIdx + 1} 列（僅剩 ${minLen} 張），解鎖 2 倍 Supermove 連鎖動能`;
    }
  } else if (trappedKeyCards.length > 0) {
    const deepest = trappedKeyCards[0];
    if (deepest && deepest.depth >= 3) {
      recommendedRoute = `破局進攻：聚焦打通第 ${deepest.columnIndex + 1} 列，解救深埋之 ${deepest.label}`;
    }
  }

  return {
    supermove,
    assessment,
    safeCards,
    trappedKeyCards,
    mobilityPercent,
    riskIndex,
    riskLevel,
    riskLabel,
    recommendedRoute,
  };
}

export interface LegendaryDeal {
  seed: number;
  title: string;
  subtitle: string;
  tag: string;
  description: string;
  difficulty: 'impossible' | 'expert' | 'hard' | 'classic';
}

export const LEGENDARY_DEALS: LegendaryDeal[] = [
  {
    seed: 11982,
    title: '#11982 傳奇無解',
    subtitle: '微軟 32,000 局中唯一無解名局',
    tag: '傳奇無解',
    description: '1994 年經電腦窮舉與全球玩家共同驗證，微軟原版經典 32,000 盤中唯一數學證明絕對無解之局。',
    difficulty: 'impossible',
  },
  {
    seed: 617,
    title: '#617 極限死鬥',
    subtitle: '頂級難關 · 考驗借位騰挪',
    tag: '極致考驗',
    description: '公認極高難度可解局之一，空位容錯率極低，需精準計算每一次中轉順序。',
    difficulty: 'expert',
  },
  {
    seed: 1941,
    title: '#1941 步步驚心',
    subtitle: '低點牌深埋 · 空列保留戰',
    tag: '戰術深局',
    description: '四色 A 與 2 深埋於牌列底層，唯有極致保護空列、成倍放大 Supermove 動能方能破局。',
    difficulty: 'hard',
  },
  {
    seed: 10692,
    title: '#10692 千迴百轉',
    subtitle: '長串拆解 · 連鎖超能',
    tag: '連鎖考驗',
    description: '需多次運用雙向 Supermove 進行長串轉移，是鍛鍊接龍空間調度的大師試煉場。',
    difficulty: 'hard',
  },
  {
    seed: 1,
    title: '#1 初代起點',
    subtitle: '微軟經典初代第一號局',
    tag: '經典初代',
    description: '伴隨無數人電腦啟蒙的第一盤新接龍，結構優雅，重溫最初的指尖成就感。',
    difficulty: 'classic',
  },
];

export interface MasterTip {
  id: number;
  title: string;
  core: string;
  detail: string;
}

export const MASTER_TIPS: MasterTip[] = [
  {
    id: 1,
    title: '保留空列勝於空暫存格',
    core: '空列是連鎖動能的乘法放大器',
    detail: '每多一列空列，Supermove 連鎖上限直接翻倍；而暫存格僅能線性 +1。非萬不得已，切勿隨意用單張雜牌填死空列。',
  },
  {
    id: 2,
    title: '優先解救深層 A 與 2',
    core: '四色 A 與 2 是回收區承重牆',
    detail: '開局應第一時間掃描 8 列底層，規劃優先打通路線，儘速將 A 與 2 送入回收區，及早啟動安全自動收牌。',
  },
  {
    id: 3,
    title: '謹防過早收牌斷鏈',
    core: '桌面接龍需要關鍵過渡中介',
    detail: '回收區的牌無法移回桌面。若桌面某張紅 6 是串聯黑 7 與紅 5 的唯一橋樑，過早回收會導致後續大牌斷鏈無處借位。',
  },
  {
    id: 4,
    title: '暫存格是旋轉門非倉庫',
    core: '進去前預先想好 2 步後的出路',
    detail: '暫存格應作為瞬間換手中繼站。盡量保持 2 個以上空置格，避免手牌塞死喪失多張牌移位的能力。',
  },
  {
    id: 5,
    title: '實體鍵盤極速操控',
    core: '數字鍵與 QWER 盲操如飛',
    detail: '按 1～8 鍵秒選牌列，Q/W/E/R 借位暫存，A 鍵一鍵安全收牌，H 鍵提示，Z 鍵悔棋，體驗專業級競技操控。',
  },
];
