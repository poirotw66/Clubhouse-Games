/**
 * Tin Cup tournament — fixed buy-in, fixed hands, named CPU rivals.
 * Free recovery is disabled inside a tournament session.
 */
import type { Card } from '../types.ts';
import { hashString } from './rng.ts';
import {
  blackjackPayout,
  calculateScore,
  dealerShouldHit,
  isBlackjack,
} from './rules.ts';
import {
  createSeededShoe,
  drawCard,
  drawCards,
  maybeReshuffle,
  type ShoeState,
} from './shoe.ts';
import {
  playPlayerHands,
  settle,
  type SimHand,
  type SimRules,
} from './simulateRound.ts';

export const TOURNAMENT_STORAGE_KEY = 'clubhouse-blackjack-tournament:v1';

export const TIN_BUY_IN = 500;
export const TIN_START_CHIPS = 1000;
export const TIN_HANDS = 15;
export const TIN_MIN_BET = 25;
export const TIN_MAX_BET = 200;
export const TIN_CHIP_VALUES = [25, 50, 100, 200] as const;
export const TIN_DECK_COUNT = 6;
export const TIN_PENETRATION = 0.75;

export const TIN_SIM_RULES: SimRules = {
  dealerRule: 'H17',
  bjPayout: '3:2',
  maxSplitHands: 4,
  doubleAfterSplit: true,
  resplitAces: false,
  surrender: 'early',
};

export type BetStyleId = 'flat' | 'conservative' | 'aggressive' | 'chaser';

export interface RivalDef {
  id: string;
  name: string;
  style: BetStyleId;
  /** Short Traditional Chinese blurb shown in lobby. */
  blurb: string;
}

export const TIN_RIVALS: RivalDef[] = [
  {
    id: 'mei',
    name: '小梅',
    style: 'flat',
    blurb: '固定下限附近平注',
  },
  {
    id: 'kang',
    name: '阿剛',
    style: 'conservative',
    blurb: '少輸為贏，籌碼緊',
  },
  {
    id: 'fei',
    name: '飛仔',
    style: 'aggressive',
    blurb: '敢於拉高注碼',
  },
  {
    id: 'hua',
    name: '花姐',
    style: 'chaser',
    blurb: '輸了就加注追',
  },
];

export interface RivalState {
  id: string;
  name: string;
  style: BetStyleId;
  balance: number;
  /** Last hand profit (for chaser). */
  lastProfit: number;
  eliminated: boolean;
  shoe: ShoeState;
}

export interface StandingRow {
  id: string;
  name: string;
  balance: number;
  isPlayer: boolean;
  rank: number;
  eliminated: boolean;
}

/** Prize fractions of the total pot by finishing place (1-indexed). */
export const TIN_PRIZE_SHARES = [0.5, 0.3, 0.15, 0.05, 0] as const;

export function tinPotSize(entrantCount: number = TIN_RIVALS.length + 1): number {
  return TIN_BUY_IN * entrantCount;
}

export function prizeForRank(rank: number, pot: number = tinPotSize()): number {
  const share = TIN_PRIZE_SHARES[rank - 1] ?? 0;
  return Math.floor(pot * share);
}

export function tournamentSeed(salt: string = String(Date.now())): number {
  return hashString(`blackjack-tin:${salt}`);
}

export function createRivalStates(seed: number, sharedShoe?: ShoeState): RivalState[] {
  const tableShoe =
    sharedShoe ?? createSeededShoe(TIN_DECK_COUNT, seed, TIN_PENETRATION);
  return TIN_RIVALS.map(rival => ({
    id: rival.id,
    name: rival.name,
    style: rival.style,
    balance: TIN_START_CHIPS,
    lastProfit: 0,
    eliminated: false,
    shoe: tableShoe,
  }));
}

/**
 * Choose a bet for a CPU given style + bankroll.
 * Returns 0 when the rival cannot meet the minimum (eliminated next).
 */
export function chooseRivalBet(
  style: BetStyleId,
  balance: number,
  handIndex: number,
  lastProfit: number,
): number {
  if (balance < TIN_MIN_BET) return 0;

  const clamp = (n: number) =>
    Math.min(TIN_MAX_BET, Math.max(TIN_MIN_BET, Math.min(balance, n)));

  switch (style) {
    case 'flat':
      return clamp(TIN_MIN_BET);
    case 'conservative': {
      // ~5–8% of stack, rounded to chip.
      const raw = Math.floor(balance * 0.06);
      const stepped = Math.round(raw / 25) * 25;
      return clamp(stepped || TIN_MIN_BET);
    }
    case 'aggressive': {
      const wave = handIndex % 3 === 0 ? 0.18 : 0.12;
      const raw = Math.floor(balance * wave);
      const stepped = Math.round(raw / 25) * 25;
      return clamp(stepped || TIN_MIN_BET * 2);
    }
    case 'chaser': {
      const base = Math.floor(balance * 0.08);
      const boost = lastProfit < 0 ? Math.floor(balance * 0.1) : 0;
      const stepped = Math.round((base + boost) / 25) * 25;
      return clamp(stepped || TIN_MIN_BET);
    }
    default:
      return clamp(TIN_MIN_BET);
  }
}

export interface TournamentRoundContext {
  /** Table shoe shared with all rivals in the tournament round. */
  tableShoe?: ShoeState;
  /**
   * Final dealer cards resolved on the table.
   * If provided, all rivals settle against this shared dealer hand outcome.
   */
  dealerCards?: Card[];
}

/**
 * Advance every non-eliminated rival by one round.
 * All rivals share the table shoe and settle against the single round dealer hand.
 */
export function advanceRivalsOneHand(
  rivals: RivalState[],
  handIndex: number,
  rules: SimRules = TIN_SIM_RULES,
  context?: TournamentRoundContext,
): RivalState[] {
  // Use the shared table shoe if provided, or the first active rival's shoe
  let shoe = maybeReshuffle(
    context?.tableShoe ??
      rivals.find(r => !r.eliminated)?.shoe ??
      rivals[0]?.shoe ??
      createSeededShoe(TIN_DECK_COUNT, 0, TIN_PENETRATION),
  );

  // Determine dealer hand: reuse table dealer if provided, or deal from shared shoe
  let dealerUp: Card;
  let finalDealerCards: Card[];
  const providedDealerCards =
    context?.dealerCards && context.dealerCards.length >= 2
      ? context.dealerCards.map(c => ({ ...c, isHidden: false }))
      : null;

  if (providedDealerCards) {
    dealerUp = providedDealerCards[0];
    finalDealerCards = providedDealerCards;
  } else {
    const dDrawn = drawCards(shoe, 2);
    shoe = dDrawn.shoe;
    dealerUp = dDrawn.cards[0];
    finalDealerCards = [dealerUp, dDrawn.cards[1]];
  }

  const dealerBJ = isBlackjack(finalDealerCards.slice(0, 2));

  interface PendingRival {
    profit: number;
    nextBalance: number;
    eliminated: boolean;
    hands?: SimHand[];
    bet?: number;
    spent?: number;
  }

  const allPlayedHands: SimHand[] = [];
  const rivalResults: Map<string, PendingRival> = new Map();

  for (const rival of rivals) {
    if (rival.eliminated || rival.balance < TIN_MIN_BET) {
      rivalResults.set(rival.id, {
        profit: 0,
        nextBalance: rival.balance,
        eliminated: true,
      });
      continue;
    }

    const bet = chooseRivalBet(rival.style, rival.balance, handIndex, rival.lastProfit);
    if (bet <= 0) {
      rivalResults.set(rival.id, {
        profit: 0,
        nextBalance: rival.balance,
        eliminated: true,
      });
      continue;
    }

    // Deal 2 initial cards from shared shoe for this rival
    const drawn = drawCards(shoe, 2);
    shoe = drawn.shoe;
    const playerCards = drawn.cards;

    // Check blackjack
    if (isBlackjack(playerCards)) {
      if (dealerBJ) {
        rivalResults.set(rival.id, {
          profit: 0,
          nextBalance: rival.balance,
          eliminated: false,
        });
      } else {
        const profit = blackjackPayout(bet, rules.bjPayout) - bet;
        const nextBalance = rival.balance + profit;
        rivalResults.set(rival.id, {
          profit,
          nextBalance,
          eliminated: nextBalance < TIN_MIN_BET,
        });
      }
      continue;
    }

    // If dealer has natural blackjack and player doesn't: player loses bet
    if (dealerBJ) {
      const nextBalance = rival.balance - bet;
      rivalResults.set(rival.id, {
        profit: -bet,
        nextBalance: Math.max(0, nextBalance),
        eliminated: nextBalance < TIN_MIN_BET,
      });
      continue;
    }

    // Play player hands against dealer upcard
    const played = playPlayerHands(
      { cards: playerCards, bet, status: 'playing' },
      dealerUp,
      shoe,
      rival.balance - bet,
      rules,
    );
    shoe = played.shoe;
    allPlayedHands.push(...played.hands);

    rivalResults.set(rival.id, {
      profit: 0,
      nextBalance: rival.balance,
      eliminated: false,
      hands: played.hands,
      bet,
      spent: played.spent,
    });
  }

  // If dealer was NOT provided externally, dealer draws cards if needed
  if (!providedDealerCards) {
    const needsDealer = allPlayedHands.some(
      h => h.status === 'stood' || h.status === 'playing' || h.status === 'blackjack',
    );
    if (needsDealer) {
      const hitSoft17 = rules.dealerRule === 'H17';
      while (dealerShouldHit(finalDealerCards, hitSoft17)) {
        const hit = drawCard(shoe);
        shoe = hit.shoe;
        finalDealerCards.push(hit.card);
      }
    }
  }

  // Settle each active rival against finalDealerCards
  return rivals.map(rival => {
    const res = rivalResults.get(rival.id);
    if (!res) return { ...rival, shoe };

    if (res.hands && res.bet !== undefined && res.spent !== undefined) {
      const returned = settle(res.hands, finalDealerCards, rules);
      const profit = returned - res.bet - res.spent;
      const nextBalance = Math.max(0, rival.balance + profit);
      return {
        ...rival,
        shoe,
        balance: nextBalance,
        lastProfit: profit,
        eliminated: nextBalance < TIN_MIN_BET,
      };
    }

    return {
      ...rival,
      shoe,
      balance: Math.max(0, res.nextBalance),
      lastProfit: res.profit,
      eliminated: res.eliminated,
    };
  });
}

export function buildStandings(
  playerBalance: number,
  playerName: string,
  rivals: RivalState[],
): StandingRow[] {
  const rows: Omit<StandingRow, 'rank'>[] = [
    {
      id: 'player',
      name: playerName,
      balance: playerBalance,
      isPlayer: true,
      eliminated: playerBalance < TIN_MIN_BET,
    },
    ...rivals.map(r => ({
      id: r.id,
      name: r.name,
      balance: r.balance,
      isPlayer: false,
      eliminated: r.eliminated || r.balance < TIN_MIN_BET,
    })),
  ];
  rows.sort((a, b) => {
    if (b.balance !== a.balance) return b.balance - a.balance;
    // Stable: player wins ties on equal chips for display rank preference.
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-Hant');
  });
  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

export interface TournamentBest {
  bestRank: number;
  bestBalance: number;
  wins: number;
  entries: number;
}

export function loadTournamentBest(): TournamentBest {
  try {
    const raw = localStorage.getItem(TOURNAMENT_STORAGE_KEY);
    if (!raw) return { bestRank: 99, bestBalance: 0, wins: 0, entries: 0 };
    const parsed = JSON.parse(raw) as Partial<TournamentBest>;
    return {
      bestRank: Math.max(1, Math.floor(Number(parsed.bestRank) || 99)),
      bestBalance: Math.max(0, Math.floor(Number(parsed.bestBalance) || 0)),
      wins: Math.max(0, Math.floor(Number(parsed.wins) || 0)),
      entries: Math.max(0, Math.floor(Number(parsed.entries) || 0)),
    };
  } catch {
    return { bestRank: 99, bestBalance: 0, wins: 0, entries: 0 };
  }
}

export function saveTournamentBest(best: TournamentBest): void {
  try {
    localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(best));
  } catch {
    // ignore
  }
}

export function mergeTournamentResult(
  prev: TournamentBest,
  rank: number,
  endingBalance: number,
): TournamentBest {
  return {
    bestRank: Math.min(prev.bestRank, rank),
    bestBalance: Math.max(prev.bestBalance, endingBalance),
    wins: prev.wins + (rank === 1 ? 1 : 0),
    entries: prev.entries + 1,
  };
}

export function formatTournamentShare(
  rank: number,
  balance: number,
  prize: number,
): string {
  return [
    `【俱樂部二十一點 · 錫標賽】`,
    `名次第 ${rank} · 終點籌碼 $${balance}`,
    prize > 0 ? `獎金 $${prize}` : '未進獎',
    `買入 $${TIN_BUY_IN} · ${TIN_HANDS} 手 · 對戰 ${TIN_RIVALS.map(r => r.name).join('、')}`,
    `#ClubhouseBlackjack #錫標賽`,
  ].join('\n');
}
