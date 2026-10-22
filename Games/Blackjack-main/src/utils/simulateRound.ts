/**
 * Headless one-round blackjack for CPU rivals (basic strategy, no insurance).
 * Keeps splits/doubles within the same rule surface as the player table.
 */
import type { Card } from '../types.ts';
import { recommendAction } from './basicStrategy.ts';
import {
  blackjackPayout,
  calculateScore,
  dealerShouldHit,
  isAcePair,
  isBlackjack,
  isPairHand,
  surrenderRefund,
  type BjPayout,
  type DealerRule,
} from './rules.ts';
import { drawCard, drawCards, maybeReshuffle, type ShoeState } from './shoe.ts';

export interface SimRules {
  dealerRule: DealerRule;
  bjPayout: BjPayout;
  maxSplitHands: number;
  doubleAfterSplit: boolean;
  resplitAces: boolean;
  /** 'early' | 'late' | 'none' — CPUs use early when enabled. */
  surrender: 'early' | 'late' | 'none';
}

export interface SimHand {
  cards: Card[];
  bet: number;
  status: 'playing' | 'busted' | 'stood' | 'blackjack' | 'surrendered';
  fromSplit?: boolean;
  fromSplitAces?: boolean;
}

export interface SimRoundResult {
  shoe: ShoeState;
  /** Net chip change for this seat (negative when lost). */
  profit: number;
  hands: SimHand[];
}

function playPlayerHands(
  initial: SimHand,
  dealerUp: Card,
  shoeIn: ShoeState,
  balanceIn: number,
  rules: SimRules,
): { hands: SimHand[]; shoe: ShoeState; spent: number } {
  let shoe = shoeIn;
  let spent = 0;
  let balance = balanceIn;
  const hands: SimHand[] = [
    { ...initial, cards: initial.cards.map(c => ({ ...c })) },
  ];
  let index = 0;

  while (index < hands.length) {
    const hand = hands[index];
    if (hand.status !== 'playing') {
      index += 1;
      continue;
    }

    if (hand.fromSplitAces && hand.cards.length >= 2) {
      hand.status = 'stood';
      index += 1;
      continue;
    }

    let splitOccurred = false;
    let guard = 0;
    while (hand.status === 'playing' && guard++ < 32) {
      const canDouble =
        hand.cards.length === 2 &&
        !hand.fromSplitAces &&
        !(hand.fromSplit && !rules.doubleAfterSplit) &&
        balance >= hand.bet;
      const canSplit =
        hand.cards.length === 2 &&
        isPairHand(hand.cards) &&
        hands.length < rules.maxSplitHands &&
        balance >= hand.bet &&
        !(hand.fromSplitAces && !rules.resplitAces) &&
        !(isAcePair(hand.cards) && hand.fromSplit && !rules.resplitAces);
      const canSurrender =
        rules.surrender !== 'none' && hand.cards.length === 2 && !hand.fromSplit;

      const action = recommendAction({
        phase: 'playing',
        playerCards: hand.cards,
        dealerUpcard: dealerUp,
        canDouble,
        canSplit,
        canSurrender,
      });

      if (action === 'surrender' && canSurrender) {
        hand.status = 'surrendered';
        break;
      }

      if (action === 'split' && canSplit) {
        balance -= hand.bet;
        spent += hand.bet;
        const drawn = drawCards(shoe, 2);
        shoe = drawn.shoe;
        const splittingAces = isAcePair(hand.cards);
        const h1: SimHand = {
          cards: [hand.cards[0], drawn.cards[0]],
          bet: hand.bet,
          status: splittingAces && !rules.resplitAces ? 'stood' : 'playing',
          fromSplit: true,
          fromSplitAces: splittingAces,
        };
        const h2: SimHand = {
          cards: [hand.cards[1], drawn.cards[1]],
          bet: hand.bet,
          status: splittingAces && !rules.resplitAces ? 'stood' : 'playing',
          fromSplit: true,
          fromSplitAces: splittingAces,
        };
        hands.splice(index, 1, h1, h2);
        splitOccurred = true;
        break;
      }

      if (action === 'double' && canDouble) {
        balance -= hand.bet;
        spent += hand.bet;
        hand.bet *= 2;
        const hit = drawCard(shoe);
        shoe = hit.shoe;
        hand.cards.push(hit.card);
        hand.status = calculateScore(hand.cards) > 21 ? 'busted' : 'stood';
        break;
      }

      if (action === 'stand') {
        hand.status = 'stood';
        break;
      }

      const hit = drawCard(shoe);
      shoe = hit.shoe;
      hand.cards.push(hit.card);
      if (calculateScore(hand.cards) > 21) {
        hand.status = 'busted';
        break;
      }
      if (hand.fromSplitAces) {
        hand.status = 'stood';
        break;
      }
    }

    if (splitOccurred) {
      // Re-process the hand now sitting at `index` (first split child).
      continue;
    }
    if (hand.status === 'playing') hand.status = 'stood';
    index += 1;
  }

  return { hands, shoe, spent };
}

function settle(hands: SimHand[], dealerCards: Card[], rules: SimRules): number {
  const dScore = calculateScore(dealerCards);
  const dBusted = dScore > 21;
  const dBJ = isBlackjack(dealerCards);
  let returned = 0;

  for (const hand of hands) {
    if (hand.status === 'surrendered') {
      returned += surrenderRefund(hand.bet);
      continue;
    }
    if (hand.status === 'busted') continue;

    const pBJ = !hand.fromSplit && isBlackjack(hand.cards);
    const pScore = calculateScore(hand.cards);

    if (pBJ && !dBJ) {
      hand.status = 'blackjack';
      returned += blackjackPayout(hand.bet, rules.bjPayout);
    } else if (dBusted || pScore > dScore) {
      returned += hand.bet * 2;
    } else if (pScore === dScore && !dBJ) {
      returned += hand.bet;
    } else if (pScore === dScore && dBJ && pBJ) {
      returned += hand.bet;
    }
    // else loss — nothing returned
  }
  return returned;
}

/**
 * Play one round. `bet` is the initial main wager (must be ≤ balance).
 * Returns profit relative to the balance before the round.
 */
export function simulateRound(
  shoeIn: ShoeState,
  bet: number,
  balance: number,
  rules: SimRules,
): SimRoundResult {
  if (bet <= 0 || balance < bet) {
    return { shoe: shoeIn, profit: 0, hands: [] };
  }

  let shoe = maybeReshuffle(shoeIn);
  const drawn = drawCards(shoe, 4);
  shoe = drawn.shoe;
  const [p1, d1, p2, dHole] = drawn.cards;
  const dealerCards: Card[] = [d1, { ...dHole, isHidden: true }];
  const playerCards = [p1, p2];

  if (isBlackjack(playerCards)) {
    const revealed = dealerCards.map((c, idx) =>
      idx === 1 ? { ...c, isHidden: false } : c,
    );
    if (isBlackjack(revealed)) {
      return {
        shoe,
        profit: 0,
        hands: [{ cards: playerCards, bet, status: 'blackjack' }],
      };
    }
    return {
      shoe,
      profit: blackjackPayout(bet, rules.bjPayout) - bet,
      hands: [{ cards: playerCards, bet, status: 'blackjack' }],
    };
  }

  const upIsAce = d1.rank === 'A';
  const upIsTen = ['10', 'J', 'Q', 'K'].includes(d1.rank);
  if (upIsAce || upIsTen) {
    const revealed = dealerCards.map((c, idx) =>
      idx === 1 ? { ...c, isHidden: false } : c,
    );
    if (isBlackjack(revealed)) {
      return {
        shoe,
        profit: -bet,
        hands: [{ cards: playerCards, bet, status: 'busted' }],
      };
    }
    dealerCards[1] = { ...dHole, isHidden: false };
  }

  const played = playPlayerHands(
    { cards: playerCards, bet, status: 'playing' },
    d1,
    shoe,
    balance - bet,
    rules,
  );
  shoe = played.shoe;

  const needsDealer = played.hands.some(
    h => h.status === 'stood' || h.status === 'playing' || h.status === 'blackjack',
  );
  const revealedDealer = dealerCards.map((c, idx) =>
    idx === 1 ? { ...c, isHidden: false } : c,
  );
  if (needsDealer) {
    const hitSoft17 = rules.dealerRule === 'H17';
    while (dealerShouldHit(revealedDealer, hitSoft17)) {
      const hit = drawCard(shoe);
      shoe = hit.shoe;
      revealedDealer.push(hit.card);
    }
  }

  const returned = settle(played.hands, revealedDealer, rules);
  const profit = returned - bet - played.spent;
  return { shoe, profit, hands: played.hands };
}
