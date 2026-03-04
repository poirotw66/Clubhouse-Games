import { CardType, Rank } from '../types';

export const rankValues: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
};

export const canMoveToTableau = (movingCard: CardType, targetTopCard: CardType | undefined): boolean => {
  if (!targetTopCard) {
    return movingCard.rank === 'K'; // 只有 K 可以放到空列
  }
  // 必須紅黑交替且點數遞減
  return targetTopCard.color !== movingCard.color && rankValues[targetTopCard.rank] - 1 === rankValues[movingCard.rank];
};

export const canMoveToFoundation = (movingCard: CardType, targetTopCard: CardType | undefined): boolean => {
  if (!targetTopCard) {
    return movingCard.rank === 'A'; // 只有 A 可以開局
  }
  // 必須同花色且點數遞增
  return targetTopCard.suit === movingCard.suit && rankValues[targetTopCard.rank] + 1 === rankValues[movingCard.rank];
};
