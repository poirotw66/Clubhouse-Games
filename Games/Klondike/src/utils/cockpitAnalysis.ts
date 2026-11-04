import type { CardType, Rank, GameState } from '../types.ts';
import {
  canMoveToFoundation,
  canMoveToTableau,
  findFoundationIndex,
  foundationTop,
  isValidTableauStack,
  type DrawCount,
} from './gameLogic.ts';
import { canRecycle, pointsRecycle, type ScoreMode } from './scoring.ts';
import type { KlondikeStats } from './storage.ts';

export interface StockTelemetry {
  stockCount: number;
  wasteCount: number;
  totalPool: number;
  passesAllowed: number | 'infinite';
  currentPass: number;
  passesRemaining: number | 'infinite';
  canRecycleNow: boolean;
  recyclePenaltyNext: number;
  recycleCount: number;
}

export interface HiddenCardsTelemetry {
  hiddenByColumn: number[];
  totalHidden: number;
  revealedCount: number;
  totalStartingHidden: number; // 21 total hidden cards at deal
  revealedPercent: number;
  deepestColIndex: number;
  deepestColCount: number;
  isAllRevealed: boolean;
}

export interface FoundationSuitTelemetry {
  suit: 'spades' | 'hearts' | 'clubs' | 'diamonds';
  symbol: string;
  name: string;
  color: 'red' | 'black';
  count: number;
  topRank: Rank | '—';
  percent: number;
}

export interface FoundationTelemetry {
  suits: FoundationSuitTelemetry[];
  totalCards: number;
  isBalanced: boolean;
  minCount: number;
  maxCount: number;
  laggingSuitName: string | null;
}

export interface VegasYieldTelemetry {
  dealCost: number;
  payout: number;
  netProfit: number;
  breakEvenCardsNeeded: number;
  projectedBankroll: number;
  streakFeverMultiplier: number;
  streakFeverTitle: string;
}

export interface FoundationTargetCard {
  suit: 'spades' | 'hearts' | 'clubs' | 'diamonds';
  symbol: string;
  rank: Rank;
  inStockOrWaste: boolean;
  location: 'stock' | 'waste' | 'tableau' | 'done';
}

export interface StockXRayTelemetry {
  redCount: number;
  blackCount: number;
  suitCounts: {
    spades: number;
    hearts: number;
    clubs: number;
    diamonds: number;
  };
  foundationTargetsInStock: number;
  targets: FoundationTargetCard[];
}

export interface FoundationVelocityTelemetry {
  ratePerMinute: number;
  tier: 'charging' | 'steady' | 'rush';
  tierLabel: string;
  progressPercent: number;
}

export interface StepEfficiencyTelemetry {
  parMoves: number;
  efficiencyPercent: number;
  rating: 'S' | 'A' | 'B' | 'C';
  ratingTitle: string;
  moveCount: number;
}

export interface MovableAnalysis {
  movableCardIds: Set<string>;
  totalMovableCount: number;
  wasteMovable: boolean;
}

export function getStockTelemetry(
  gameState: GameState,
  scoreMode: ScoreMode,
  drawCount: DrawCount,
  recycleCount: number,
): StockTelemetry {
  const stockCount = gameState.stock.length;
  const wasteCount = gameState.waste.length;
  const totalPool = stockCount + wasteCount;

  let passesAllowed: number | 'infinite' = 'infinite';
  let passesRemaining: number | 'infinite' = 'infinite';
  const currentPass = recycleCount + 1;

  if (scoreMode === 'vegas') {
    if (drawCount === 1) {
      passesAllowed = 1;
      passesRemaining = Math.max(0, 1 - recycleCount);
    } else {
      passesAllowed = 3;
      passesRemaining = Math.max(0, 3 - recycleCount);
    }
  }

  const canRecycleNow = canRecycle(scoreMode, drawCount, recycleCount);
  const recyclePenaltyNext = pointsRecycle(scoreMode, drawCount);

  return {
    stockCount,
    wasteCount,
    totalPool,
    passesAllowed,
    currentPass,
    passesRemaining,
    canRecycleNow,
    recyclePenaltyNext,
    recycleCount,
  };
}

export function getHiddenCardsTelemetry(tableau: CardType[][]): HiddenCardsTelemetry {
  const hiddenByColumn = tableau.map((col) => col.filter((c) => !c.faceUp).length);
  const totalHidden = hiddenByColumn.reduce((sum, n) => sum + n, 0);
  const totalStartingHidden = 21;
  const revealedCount = totalStartingHidden - totalHidden;
  const revealedPercent = Math.min(100, Math.round((revealedCount / totalStartingHidden) * 100));

  let deepestColIndex = 0;
  let deepestColCount = 0;
  hiddenByColumn.forEach((cnt, idx) => {
    if (cnt > deepestColCount) {
      deepestColCount = cnt;
      deepestColIndex = idx;
    }
  });

  return {
    hiddenByColumn,
    totalHidden,
    revealedCount,
    totalStartingHidden,
    revealedPercent,
    deepestColIndex,
    deepestColCount,
    isAllRevealed: totalHidden === 0,
  };
}

export function getFoundationTelemetry(foundation: CardType[][]): FoundationTelemetry {
  const suitConfigs: {
    suit: 'spades' | 'hearts' | 'clubs' | 'diamonds';
    symbol: string;
    name: string;
    color: 'red' | 'black';
  }[] = [
    { suit: 'spades', symbol: '♠', name: '黑桃', color: 'black' },
    { suit: 'hearts', symbol: '♥', name: '紅心', color: 'red' },
    { suit: 'clubs', symbol: '♣', name: '梅花', color: 'black' },
    { suit: 'diamonds', symbol: '♦', name: '方塊', color: 'red' },
  ];

  const suits: FoundationSuitTelemetry[] = suitConfigs.map((cfg) => {
    // Find foundation pile with this suit, or match by pile cards
    let pileCards: CardType[] = [];
    for (const pile of foundation) {
      if (pile.length > 0 && pile[0].suit === cfg.suit) {
        pileCards = pile;
        break;
      }
    }
    const count = pileCards.length;
    const topRank = count > 0 ? pileCards[count - 1].rank : '—';
    const percent = Math.round((count / 13) * 100);
    return {
      suit: cfg.suit,
      symbol: cfg.symbol,
      name: cfg.name,
      color: cfg.color,
      count,
      topRank,
      percent,
    };
  });

  const counts = suits.map((s) => s.count);
  const totalCards = counts.reduce((a, b) => a + b, 0);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const isBalanced = maxCount - minCount <= 2;

  let laggingSuitName: string | null = null;
  if (!isBalanced) {
    const lagging = suits.find((s) => s.count === minCount);
    if (lagging) laggingSuitName = lagging.name;
  }

  return {
    suits,
    totalCards,
    isBalanced,
    minCount,
    maxCount,
    laggingSuitName,
  };
}

export function computeMovableAnalysis(gameState: GameState): MovableAnalysis {
  const movableIds = new Set<string>();
  let totalCount = 0;
  let wasteMovable = false;

  // Waste card
  if (gameState.waste.length > 0) {
    const topWaste = gameState.waste[gameState.waste.length - 1];
    if (findFoundationIndex(topWaste, gameState.foundation) >= 0) {
      movableIds.add(topWaste.id);
      wasteMovable = true;
      totalCount++;
    } else {
      for (let c = 0; c < 7; c++) {
        const topCol = foundationTop(gameState.tableau[c]);
        if (canMoveToTableau(topWaste, topCol)) {
          movableIds.add(topWaste.id);
          wasteMovable = true;
          totalCount++;
          break;
        }
      }
    }
  }

  // Tableau columns
  for (let c = 0; c < 7; c++) {
    const col = gameState.tableau[c];
    if (col.length === 0) continue;

    // Check bottom card for foundation
    const bottomCard = col[col.length - 1];
    const canToFoundation = findFoundationIndex(bottomCard, gameState.foundation) >= 0;
    if (canToFoundation) {
      movableIds.add(bottomCard.id);
      totalCount++;
    }

    // Check tableau stacks moving to other tableau columns
    for (let cardIdx = 0; cardIdx < col.length; cardIdx++) {
      const card = col[cardIdx];
      if (!card.faceUp) continue;
      if (!isValidTableauStack(col, cardIdx)) continue;

      for (let tgtC = 0; tgtC < 7; tgtC++) {
        if (tgtC === c) continue;
        const tgtCol = gameState.tableau[tgtC];
        const topT = foundationTop(tgtCol);
        if (canMoveToTableau(card, topT)) {
          if (card.rank === 'K' && tgtCol.length === 0 && cardIdx === 0) continue;
          movableIds.add(card.id);
          totalCount++;
          break;
        }
      }
    }
  }

  return { movableCardIds: movableIds, totalMovableCount: totalCount, wasteMovable };
}

export function getVegasYieldTelemetry(
  foundation: CardType[][],
  currentScore: number,
  stats: KlondikeStats,
): VegasYieldTelemetry {
  const totalFoundationCards = foundation.reduce((acc, p) => acc + p.length, 0);
  const dealCost = 52;
  const payout = totalFoundationCards * 5;
  const netProfit = payout - dealCost;
  const breakEvenCardsNeeded = Math.max(0, 11 - totalFoundationCards);
  const projectedBankroll = stats.vegasBankroll + currentScore;

  let streakFeverMultiplier = 1.0;
  let streakFeverTitle = '標準賭局';
  if (stats.currentStreak >= 3) {
    streakFeverMultiplier = 2.0;
    streakFeverTitle = '維加斯傳奇 x2.0';
  } else if (stats.currentStreak >= 2) {
    streakFeverMultiplier = 1.5;
    streakFeverTitle = '連勝狂熱 x1.5';
  } else if (stats.currentStreak === 1) {
    streakFeverMultiplier = 1.2;
    streakFeverTitle = '連勝起勢 x1.2';
  }

  return {
    dealCost,
    payout,
    netProfit,
    breakEvenCardsNeeded,
    projectedBankroll,
    streakFeverMultiplier,
    streakFeverTitle,
  };
}

export function getMasterAdvice(
  gameState: GameState,
  hiddenTel: HiddenCardsTelemetry,
  foundationTel: FoundationTelemetry,
  stockTel: StockTelemetry,
  movableCount: number,
): { title: string; detail: string; badge: string; tone: 'gold' | 'emerald' | 'amber' | 'blue' } {
  const isWon = foundationTel.totalCards === 52;
  if (isWon) {
    return {
      title: '四組牌全數歸位',
      detail: '恭喜大獲全勝！完美征服牌局。',
      badge: '大獲全勝',
      tone: 'emerald',
    };
  }

  if (hiddenTel.isAllRevealed) {
    return {
      title: '暗牌全數解開！',
      detail: '桌面所有暗牌已全部解鎖！可隨時使用【一鍵自動收牌 (A)】迅速完局。',
      badge: '全解就緒',
      tone: 'gold',
    };
  }

  // Check empty column availability
  const hasEmptyCol = gameState.tableau.some((c) => c.length === 0);
  if (hasEmptyCol) {
    // Check if there is an unplaced King
    let kingReady = false;
    if (gameState.waste.length > 0 && gameState.waste[gameState.waste.length - 1].rank === 'K') {
      kingReady = true;
    }
    for (const col of gameState.tableau) {
      for (let i = 1; i < col.length; i++) {
        if (col[i].faceUp && col[i].rank === 'K') {
          kingReady = true;
          break;
        }
      }
    }

    if (kingReady) {
      return {
        title: '空列調度契機',
        detail: '發現空牌列！可將 K（或以 K 為首之連牌串）移入以釋放後續暗牌。',
        badge: '空列啟用',
        tone: 'emerald',
      };
    }
  }

  if (hiddenTel.deepestColCount >= 3) {
    return {
      title: `重點突破第 ${hiddenTel.deepestColIndex + 1} 列`,
      detail: `該列深埋 ${hiddenTel.deepestColCount} 張蓋牌，建議優先安排接牌移位，早日翻開暗牌。`,
      badge: '深層暗牌',
      tone: 'gold',
    };
  }

  if (!foundationTel.isBalanced && foundationTel.laggingSuitName) {
    return {
      title: `花色天秤失衡提醒`,
      detail: `【${foundationTel.laggingSuitName}】收牌進度落後較多，請留意避免過快收其他花色導致牌列接牌中斷。`,
      badge: '花色天秤',
      tone: 'amber',
    };
  }

  if (stockTel.stockCount <= 3 && stockTel.stockCount > 0) {
    return {
      title: `牌庫餘量告急`,
      detail: `牌庫僅存 ${stockTel.stockCount} 張，翻牌前請先盤點桌面是否有可串聯之交替接牌。`,
      badge: '牌庫巡檢',
      tone: 'blue',
    };
  }

  if (movableCount === 0 && stockTel.stockCount === 0 && !stockTel.canRecycleNow) {
    return {
      title: '無合法移動路徑',
      detail: '牌面已無可行動牌，建議使用【復原 (Z)】回溯嘗試其他分支，或點擊新局。',
      badge: '陷入僵局',
      tone: 'amber',
    };
  }

  return {
    title: '靈活調度紅黑陣列',
    detail: '保持紅黑交替遞減排列，優先翻開深層蓋牌以擴充空列與操作彈性。',
    badge: '穩健破局',
    tone: 'blue',
  };
}

const ORDERED_RANKS: Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

export function getStockXRayTelemetry(gameState: GameState): StockXRayTelemetry {
  const pool = [...gameState.stock, ...gameState.waste];
  let redCount = 0;
  let blackCount = 0;
  const suitCounts = { spades: 0, hearts: 0, clubs: 0, diamonds: 0 };

  for (const c of pool) {
    if (c.color === 'red') redCount++;
    else blackCount++;
    if (c.suit in suitCounts) {
      suitCounts[c.suit as keyof typeof suitCounts]++;
    }
  }

  const suitsMeta: {
    suit: 'spades' | 'hearts' | 'clubs' | 'diamonds';
    symbol: string;
  }[] = [
    { suit: 'spades', symbol: '♠' },
    { suit: 'hearts', symbol: '♥' },
    { suit: 'clubs', symbol: '♣' },
    { suit: 'diamonds', symbol: '♦' },
  ];

  const targets: FoundationTargetCard[] = [];
  let foundationTargetsInStock = 0;

  for (const meta of suitsMeta) {
    // Find foundation pile for this suit
    let pileCards: CardType[] = [];
    for (const pile of gameState.foundation) {
      if (pile.length > 0 && pile[0].suit === meta.suit) {
        pileCards = pile;
        break;
      }
    }

    if (pileCards.length >= 13) {
      targets.push({
        suit: meta.suit,
        symbol: meta.symbol,
        rank: 'K',
        inStockOrWaste: false,
        location: 'done',
      });
      continue;
    }

    const nextRank = ORDERED_RANKS[pileCards.length];
    // Find where nextRank is located
    let location: 'stock' | 'waste' | 'tableau' | 'done' = 'tableau';
    let inStockOrWaste = false;

    if (gameState.stock.some((c) => c.suit === meta.suit && c.rank === nextRank)) {
      location = 'stock';
      inStockOrWaste = true;
      foundationTargetsInStock++;
    } else if (gameState.waste.some((c) => c.suit === meta.suit && c.rank === nextRank)) {
      location = 'waste';
      inStockOrWaste = true;
      foundationTargetsInStock++;
    }

    targets.push({
      suit: meta.suit,
      symbol: meta.symbol,
      rank: nextRank,
      inStockOrWaste,
      location,
    });
  }

  return {
    redCount,
    blackCount,
    suitCounts,
    foundationTargetsInStock,
    targets,
  };
}

export function getFoundationVelocityTelemetry(
  totalFoundationCards: number,
  elapsedSec: number,
): FoundationVelocityTelemetry {
  const safeSec = Math.max(1, elapsedSec);
  const ratePerMinute = Math.round((totalFoundationCards / safeSec) * 60 * 10) / 10;
  const progressPercent = Math.min(100, Math.round((totalFoundationCards / 52) * 100));

  let tier: 'charging' | 'steady' | 'rush' = 'charging';
  let tierLabel = '蓄力中';

  if (ratePerMinute >= 12 || (totalFoundationCards >= 20 && safeSec <= 90)) {
    tier = 'rush';
    tierLabel = '極速連收';
  } else if (ratePerMinute >= 4 || totalFoundationCards >= 6) {
    tier = 'steady';
    tierLabel = '穩定推進';
  }

  return {
    ratePerMinute,
    tier,
    tierLabel,
    progressPercent,
  };
}

export function getStepEfficiencyTelemetry(
  moveCount: number,
  totalFoundationCards: number,
  hiddenRevealed: number,
): StepEfficiencyTelemetry {
  const parMoves = 80;
  // Progress metric: combination of foundation progress and hidden revealed
  const progressWeight = totalFoundationCards * 1.5 + hiddenRevealed * 2.5; // up to ~130
  const expectedMovesForProgress = Math.max(1, Math.round((progressWeight / 130) * parMoves));

  let efficiencyPercent = 100;
  if (moveCount > 0) {
    efficiencyPercent = Math.min(
      100,
      Math.max(30, Math.round((expectedMovesForProgress / Math.max(1, moveCount)) * 100)),
    );
  }

  let rating: 'S' | 'A' | 'B' | 'C' = 'B';
  let ratingTitle = 'B級 穩健前行';

  if (efficiencyPercent >= 90 || (moveCount <= 40 && totalFoundationCards >= 16)) {
    rating = 'S';
    ratingTitle = 'S級 傳奇指揮';
  } else if (efficiencyPercent >= 75 || moveCount <= 75) {
    rating = 'A';
    ratingTitle = 'A級 精準調度';
  } else if (efficiencyPercent >= 55) {
    rating = 'B';
    ratingTitle = 'B級 穩健前行';
  } else {
    rating = 'C';
    ratingTitle = 'C級 迂迴摸索';
  }

  return {
    parMoves,
    efficiencyPercent,
    rating,
    ratingTitle,
    moveCount,
  };
}

