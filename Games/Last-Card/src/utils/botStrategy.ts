import type { CardType, Suit } from '../types';
import { getCardScore } from '../hooks/useGame';

export interface BotTurnContext {
  activeSuit: Suit;
  topCard: CardType;
  drawPenalty: number;
  hasDrawnThisTurn: boolean;
  direction: 1 | -1;
  currentPlayerIndex: number;
  players: { hand: CardType[] }[];
}

function nextOpponentHandSize(ctx: BotTurnContext): number {
  const count = ctx.players.length;
  const nextIndex = (ctx.currentPlayerIndex + ctx.direction + count) % count;
  return ctx.players[nextIndex].hand.length;
}

/** Pick the best card for a bot turn, or null if the bot should draw/pass. */
export function pickBotCard(
  hand: CardType[],
  validCards: CardType[],
  ctx: BotTurnContext,
): CardType | null {
  if (validCards.length === 0) return null;

  if (ctx.drawPenalty > 0) {
    const twos = validCards.filter((c) => c.rank === '2');
    return twos.length > 0 ? twos[0] : null;
  }

  if (hand.length === 1) {
    return validCards[0];
  }

  const oppHand = nextOpponentHandSize(ctx);

  if (oppHand <= 2) {
    const weapon = validCards.find((c) => c.rank === '2' || c.rank === 'Q');
    if (weapon) return weapon;
  }

  if (ctx.drawPenalty === 0 && oppHand <= 1) {
    const queen = validCards.find((c) => c.rank === 'Q');
    if (queen) return queen;
  }

  const withoutEight = validCards.filter((c) => c.rank !== '8');
  const pool = withoutEight.length > 0 ? withoutEight : validCards;

  if (hand.length <= 2) {
    const eight = pool.find((c) => c.rank === '8');
    if (eight) return eight;
  }

  return pool.reduce((best, card) => (getCardScore(card) > getCardScore(best) ? card : best));
}
