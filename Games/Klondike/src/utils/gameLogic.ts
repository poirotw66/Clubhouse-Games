import type { CardType, Rank, DragSource } from '../types';

export type DrawCount = 1 | 3;

export interface BoardSnapshot {
  tableau: CardType[][];
  foundation: CardType[][];
  stock: CardType[];
  waste: CardType[];
}

export type HintMove =
  | { kind: 'move'; source: DragSource; target: { type: 'tableau' | 'foundation'; index: number } }
  | { kind: 'draw' }
  | { kind: 'recycle' };

export interface FoundationAutoMove {
  source: DragSource;
  cards: CardType[];
  foundationIndex: number;
}

export const rankValues: Record<Rank, number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
};

export const canMoveToTableau = (
  movingCard: CardType,
  targetTopCard: CardType | undefined,
): boolean => {
  if (!targetTopCard) {
    return movingCard.rank === 'K';
  }
  return (
    targetTopCard.color !== movingCard.color &&
    rankValues[targetTopCard.rank] - 1 === rankValues[movingCard.rank]
  );
};

export const canMoveToFoundation = (
  movingCard: CardType,
  targetTopCard: CardType | undefined,
): boolean => {
  if (!targetTopCard) {
    return movingCard.rank === 'A';
  }
  return (
    targetTopCard.suit === movingCard.suit &&
    rankValues[targetTopCard.rank] + 1 === rankValues[movingCard.rank]
  );
};

/** Draw up to `drawCount` cards from stock onto waste (Draw-1 or Draw-3). */
export function applyDraw(
  stock: CardType[],
  waste: CardType[],
  drawCount: DrawCount,
): { stock: CardType[]; waste: CardType[] } {
  const nextStock = stock.map((c) => ({ ...c }));
  const nextWaste = waste.map((c) => ({ ...c }));
  const n = Math.min(drawCount, nextStock.length);
  for (let i = 0; i < n; i++) {
    const card = nextStock.pop()!;
    nextWaste.push({ ...card, faceUp: true });
  }
  return { stock: nextStock, waste: nextWaste };
}

export function isValidTableauStack(col: CardType[], startIndex: number): boolean {
  for (let i = startIndex; i < col.length; i++) {
    if (!col[i].faceUp) return false;
    if (i === startIndex) continue;
    const prev = col[i - 1];
    const curr = col[i];
    if (prev.color === curr.color) return false;
    if (rankValues[prev.rank] - 1 !== rankValues[curr.rank]) return false;
  }
  return true;
}

export function foundationTop(pile: CardType[]): CardType | undefined {
  return pile.length > 0 ? pile[pile.length - 1] : undefined;
}

export function findFoundationIndex(card: CardType, foundation: CardType[][]): number {
  for (let i = 0; i < 4; i++) {
    if (canMoveToFoundation(card, foundationTop(foundation[i]))) return i;
  }
  return -1;
}

/** True when every tableau card is face-up (no blockers left to reveal). */
export function canAutoComplete(tableau: CardType[][]): boolean {
  return tableau.every((col) => col.every((c) => c.faceUp));
}

export function isGameWon(foundation: CardType[][]): boolean {
  return foundation.every((pile) => pile.length === 13);
}

/** Next single-card move onto a foundation, if any. */
export function findFoundationAutoMove(state: BoardSnapshot): FoundationAutoMove | null {
  for (let c = 0; c < 7; c++) {
    const col = state.tableau[c];
    if (col.length === 0) continue;
    const card = col[col.length - 1];
    const f = findFoundationIndex(card, state.foundation);
    if (f >= 0) {
      return {
        source: { type: 'tableau', colIndex: c, cardIndex: col.length - 1 },
        cards: [card],
        foundationIndex: f,
      };
    }
  }

  if (state.waste.length > 0) {
    const card = state.waste[state.waste.length - 1];
    const f = findFoundationIndex(card, state.foundation);
    if (f >= 0) {
      return { source: { type: 'waste' }, cards: [card], foundationIndex: f };
    }
  }

  return null;
}

/** Prefer foundation plays, then tableau builds, then draw/recycle. */
export function findHint(state: BoardSnapshot): HintMove | null {
  for (let c = 0; c < 7; c++) {
    const col = state.tableau[c];
    if (col.length === 0) continue;
    const card = col[col.length - 1];
    const f = findFoundationIndex(card, state.foundation);
    if (f >= 0) {
      return {
        kind: 'move',
        source: { type: 'tableau', colIndex: c, cardIndex: col.length - 1 },
        target: { type: 'foundation', index: f },
      };
    }
  }

  if (state.waste.length > 0) {
    const card = state.waste[state.waste.length - 1];
    const f = findFoundationIndex(card, state.foundation);
    if (f >= 0) {
      return {
        kind: 'move',
        source: { type: 'waste' },
        target: { type: 'foundation', index: f },
      };
    }
    for (let t = 0; t < 7; t++) {
      const top = foundationTop(state.tableau[t]);
      if (canMoveToTableau(card, top)) {
        return {
          kind: 'move',
          source: { type: 'waste' },
          target: { type: 'tableau', index: t },
        };
      }
    }
  }

  for (let srcC = 0; srcC < 7; srcC++) {
    const srcCol = state.tableau[srcC];
    if (srcCol.length === 0) continue;

    for (let cardIdx = 0; cardIdx < srcCol.length; cardIdx++) {
      const card = srcCol[cardIdx];
      if (!card.faceUp || !isValidTableauStack(srcCol, cardIdx)) continue;

      const reveals = cardIdx > 0 && !srcCol[cardIdx - 1].faceUp;
      const kingToEmpty = card.rank === 'K' && cardIdx > 0;

      for (let tgtC = 0; tgtC < 7; tgtC++) {
        if (srcC === tgtC) continue;
        const tgtCol = state.tableau[tgtC];
        const topT = foundationTop(tgtCol);
        if (!canMoveToTableau(card, topT)) continue;

        // Skip no-op king shuffles between empty columns unless revealing.
        if (card.rank === 'K' && tgtCol.length === 0 && cardIdx === 0) continue;
        if (!reveals && !kingToEmpty && cardIdx === 0) continue;
        if (!reveals && !kingToEmpty) {
          // Still hint a build if the parent becomes free for foundation.
          if (cardIdx > 0 && srcCol[cardIdx - 1].faceUp) {
            const exposed = srcCol[cardIdx - 1];
            if (findFoundationIndex(exposed, state.foundation) < 0) continue;
          } else {
            continue;
          }
        }

        return {
          kind: 'move',
          source: { type: 'tableau', colIndex: srcC, cardIndex: cardIdx },
          target: { type: 'tableau', index: tgtC },
        };
      }
    }
  }

  if (state.stock.length > 0) return { kind: 'draw' };
  if (state.waste.length > 0) return { kind: 'recycle' };
  return null;
}
