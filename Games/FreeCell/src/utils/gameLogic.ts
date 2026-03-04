import { Card, GameState, Position, Suit } from "../types";

export const INITIAL_FOUNDATIONS: Record<Suit, number> = {
  spades: 0,
  hearts: 0,
  diamonds: 0,
  clubs: 0,
};

export function isValidSequence(cards: Card[]): boolean {
  if (cards.length <= 1) return true;
  for (let i = 1; i < cards.length; i++) {
    const prev = cards[i - 1];
    const curr = cards[i];
    if (prev.color === curr.color || prev.rank !== curr.rank + 1) {
      return false;
    }
  }
  return true;
}

export function getMaxMoveCount(
  emptyFreeCells: number,
  emptyTableaus: number,
  movingToEmptyTableau: boolean,
): number {
  const effectiveEmptyTableaus = movingToEmptyTableau
    ? Math.max(0, emptyTableaus - 1)
    : emptyTableaus;
  return (emptyFreeCells + 1) * Math.pow(2, effectiveEmptyTableaus);
}

export function canMove(
  state: GameState,
  source: Position,
  dest: Position,
): boolean {
  // Get cards to move
  let cardsToMove: Card[] = [];
  if (source.zone === "freeCell") {
    const card = state.freeCells[source.index];
    if (!card) return false;
    cardsToMove = [card];
  } else if (source.zone === "tableau") {
    const col = state.tableaus[source.index];
    if (
      source.cardIndex === undefined ||
      source.cardIndex < 0 ||
      source.cardIndex >= col.length
    )
      return false;
    cardsToMove = col.slice(source.cardIndex);
    if (!isValidSequence(cardsToMove)) return false;
  } else {
    return false; // Cannot move from foundation
  }

  if (cardsToMove.length === 0) return false;

  // Check destination
  if (dest.zone === "freeCell") {
    if (cardsToMove.length > 1) return false;
    if (state.freeCells[dest.index] !== null) return false;
    return true;
  }

  if (dest.zone === "foundation") {
    if (cardsToMove.length > 1) return false;
    const card = cardsToMove[0];
    const currentRank = state.foundations[card.suit];
    return card.rank === currentRank + 1;
  }

  if (dest.zone === "tableau") {
    const destCol = state.tableaus[dest.index];
    const emptyFreeCells = state.freeCells.filter((c) => c === null).length;
    const emptyTableaus = state.tableaus.filter((t) => t.length === 0).length;
    const isDestEmpty = destCol.length === 0;

    const maxMove = getMaxMoveCount(emptyFreeCells, emptyTableaus, isDestEmpty);
    if (cardsToMove.length > maxMove) return false;

    if (isDestEmpty) return true;

    const targetCard = destCol[destCol.length - 1];
    const bottomCard = cardsToMove[0];

    return (
      targetCard.color !== bottomCard.color &&
      targetCard.rank === bottomCard.rank + 1
    );
  }

  return false;
}

export function executeMove(
  state: GameState,
  source: Position,
  dest: Position,
): GameState {
  // Deep copy state
  const newState: GameState = {
    freeCells: [...state.freeCells],
    foundations: { ...state.foundations },
    tableaus: state.tableaus.map((col) => [...col]),
    history: [], // handle history outside
  };

  let cardsToMove: Card[] = [];

  // Remove from source
  if (source.zone === "freeCell") {
    cardsToMove = [newState.freeCells[source.index]!];
    newState.freeCells[source.index] = null;
  } else if (source.zone === "tableau") {
    const col = newState.tableaus[source.index];
    cardsToMove = col.splice(source.cardIndex!, col.length - source.cardIndex!);
  }

  // Add to dest
  if (dest.zone === "freeCell") {
    newState.freeCells[dest.index] = cardsToMove[0];
  } else if (dest.zone === "foundation") {
    newState.foundations[cardsToMove[0].suit] = cardsToMove[0].rank;
  } else if (dest.zone === "tableau") {
    newState.tableaus[dest.index].push(...cardsToMove);
  }

  return newState;
}

export function getSafeFoundationMoves(
  state: GameState,
): { source: Position; dest: Position } | null {
  const getMinOppositeRank = (color: "red" | "black") => {
    if (color === "red") {
      return Math.min(state.foundations.spades, state.foundations.clubs);
    } else {
      return Math.min(state.foundations.hearts, state.foundations.diamonds);
    }
  };

  const checkCard = (
    card: Card,
    source: Position,
  ): { source: Position; dest: Position } | null => {
    if (card.rank === state.foundations[card.suit] + 1) {
      if (card.rank <= getMinOppositeRank(card.color) + 1 || card.rank <= 2) {
        return { source, dest: { zone: "foundation", index: 0 } };
      }
    }
    return null;
  };

  for (let i = 0; i < 4; i++) {
    const card = state.freeCells[i];
    if (card) {
      const move = checkCard(card, { zone: "freeCell", index: i });
      if (move) return move;
    }
  }

  for (let i = 0; i < 8; i++) {
    const col = state.tableaus[i];
    if (col.length > 0) {
      const card = col[col.length - 1];
      const move = checkCard(card, {
        zone: "tableau",
        index: i,
        cardIndex: col.length - 1,
      });
      if (move) return move;
    }
  }

  return null;
}

export function checkWin(state: GameState): boolean {
  return Object.values(state.foundations).every((rank) => rank === 13);
}

export function getHintMove(state: GameState): { source: Position, dest: Position } | null {
  // 1. Safe foundation moves
  const safeMove = getSafeFoundationMoves(state);
  if (safeMove) return safeMove;

  const sources: Position[] = [];
  for (let i = 0; i < 4; i++) {
    if (state.freeCells[i] !== null) sources.push({ zone: 'freeCell', index: i });
  }
  for (let i = 0; i < 8; i++) {
    const col = state.tableaus[i];
    if (col.length > 0) {
      for (let j = col.length - 1; j >= 0; j--) {
        if (isValidSequence(col.slice(j))) {
          sources.push({ zone: 'tableau', index: i, cardIndex: j });
        } else {
          break;
        }
      }
    }
  }

  const destinations: Position[] = [
    ...[0, 1, 2, 3].map(i => ({ zone: 'foundation', index: i } as Position)),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ zone: 'tableau', index: i } as Position)),
    ...[0, 1, 2, 3].map(i => ({ zone: 'freeCell', index: i } as Position))
  ];

  const validMoves: { source: Position, dest: Position, score: number }[] = [];

  for (const source of sources) {
    for (const dest of destinations) {
      if (source.zone === dest.zone && source.index === dest.index) continue;
      if (canMove(state, source, dest)) {
        let score = 0;
        
        // Pointless move: empty column to empty column
        if (source.zone === 'tableau' && dest.zone === 'tableau') {
           const destCol = state.tableaus[dest.index];
           if (source.cardIndex === 0 && destCol.length === 0) continue;
        }
        
        // Pointless move: freecell to freecell
        if (source.zone === 'freeCell' && dest.zone === 'freeCell') continue;

        if (dest.zone === 'foundation') score = 100;
        else if (dest.zone === 'tableau') {
           if (source.zone === 'freeCell') score = 50; // Freeing up a cell is good
           else {
             // Moving from tableau to tableau
             if (source.cardIndex! > 0) score = 20; // Exposing a hidden card
             else if (source.cardIndex === 0) score = 10; // Freeing a column
             else score = 5;
           }
        }
        else if (dest.zone === 'freeCell') {
           score = 1;
        }

        validMoves.push({ source, dest, score });
      }
    }
  }

  if (validMoves.length === 0) return null;

  // Sort by score descending
  validMoves.sort((a, b) => b.score - a.score);

  // To prevent infinite loops, randomly pick from the top scoring moves
  const bestScore = validMoves[0].score;
  const topMoves = validMoves.filter(m => m.score >= bestScore - 5);
  
  // Try to avoid reversing the last move if possible (basic check)
  if (state.history.length > 0) {
    const lastState = state.history[state.history.length - 1];
    // A real loop prevention would be more complex, but this is a simple heuristic
  }

  const randomMove = topMoves[Math.floor(Math.random() * topMoves.length)];
  return { source: randomMove.source, dest: randomMove.dest };
}

export function checkLoss(state: GameState): boolean {
  if (checkWin(state)) return false;

  const sources: Position[] = [];
  
  // FreeCells as sources
  for (let i = 0; i < 4; i++) {
    if (state.freeCells[i] !== null) {
      sources.push({ zone: 'freeCell', index: i });
    }
  }
  
  // Tableaus as sources
  for (let i = 0; i < 8; i++) {
    const col = state.tableaus[i];
    if (col.length > 0) {
      for (let j = col.length - 1; j >= 0; j--) {
        if (isValidSequence(col.slice(j))) {
          sources.push({ zone: 'tableau', index: i, cardIndex: j });
        } else {
          break; // If a sequence is invalid, anything above it is also invalid
        }
      }
    }
  }

  // All possible destinations
  const destinations: Position[] = [
    ...[0, 1, 2, 3].map(i => ({ zone: 'freeCell', index: i } as Position)),
    ...[0, 1, 2, 3].map(i => ({ zone: 'foundation', index: i } as Position)),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ zone: 'tableau', index: i } as Position))
  ];

  // Check if any move is possible
  for (const source of sources) {
    for (const dest of destinations) {
      if (source.zone === dest.zone && source.index === dest.index) continue;
      if (canMove(state, source, dest)) {
        return false; // Found at least one valid move
      }
    }
  }

  return true; // No valid moves found
}
