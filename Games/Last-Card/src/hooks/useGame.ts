import { useState, useCallback } from 'react';
import { CardType, GameState, Player, Suit } from '../types';

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: CardType['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck(): CardType[] {
  const deck: CardType[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit}-${rank}-${Math.random().toString(36).substr(2, 9)}`, suit, rank });
    }
  }
  return shuffle(deck);
}

function shuffle(array: any[]) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const INITIAL_HAND_SIZE = 5;

export function getCardScore(card: CardType): number {
  if (card.rank === '8') return 50;
  if (['K', 'Q', 'J'].includes(card.rank)) return 10;
  if (card.rank === 'A') return 1;
  return parseInt(card.rank, 10);
}

const TARGET_SCORE = 100;

export function useGame() {
  const [gameState, setGameState] = useState<GameState>(() => initGame());

  function initGame(existingPlayers?: Player[], round: number = 1): GameState {
    let deck = createDeck();
    const players: Player[] = existingPlayers ? existingPlayers.map(p => ({ ...p, hand: [] })) : [
      { id: 'p1', name: 'You', isHuman: true, hand: [], score: 0 },
      { id: 'p2', name: 'Bot 1', isHuman: false, hand: [], score: 0 },
      { id: 'p3', name: 'Bot 2', isHuman: false, hand: [], score: 0 },
      { id: 'p4', name: 'Bot 3', isHuman: false, hand: [], score: 0 },
    ];

    for (let i = 0; i < INITIAL_HAND_SIZE; i++) {
      for (const player of players) {
        player.hand.push(deck.pop()!);
      }
    }

    let firstCard = deck.pop()!;
    while (firstCard.rank === '8') {
      deck.unshift(firstCard);
      firstCard = deck.pop()!;
    }

    return {
      deck,
      discardPile: [firstCard],
      players,
      currentPlayerIndex: 0,
      direction: 1,
      activeSuit: firstCard.suit,
      drawPenalty: 0,
      winner: null,
      roundWinner: null,
      status: 'playing',
      message: `Round ${round} started! Your turn.`,
      pendingCard: null,
      hasDrawnThisTurn: false,
      round,
      lastRoundPenalties: {},
    };
  }

  const resetGame = useCallback(() => {
    setGameState(initGame());
  }, []);

  const nextRound = useCallback(() => {
    setGameState(prev => initGame(prev.players, prev.round + 1));
  }, []);

  const drawCards = (deck: CardType[], discardPile: CardType[], count: number) => {
    let currentDeck = [...deck];
    let currentDiscard = [...discardPile];
    const drawn: CardType[] = [];

    for (let i = 0; i < count; i++) {
      if (currentDeck.length === 0) {
        if (currentDiscard.length <= 1) break;
        const topCard = currentDiscard.pop()!;
        currentDeck = shuffle(currentDiscard);
        currentDiscard = [topCard];
      }
      if (currentDeck.length > 0) {
        drawn.push(currentDeck.pop()!);
      }
    }
    return { drawn, newDeck: currentDeck, newDiscard: currentDiscard };
  };

  const isValidPlay = useCallback((card: CardType, activeSuit: Suit, topCard: CardType, drawPenalty: number) => {
    if (drawPenalty > 0) {
      return card.rank === '2';
    }
    if (card.rank === '8') return true;
    return card.suit === activeSuit || card.rank === topCard.rank;
  }, []);

  const playCard = useCallback((playerId: string, cardId: string, selectedSuit?: Suit) => {
    setGameState(prev => {
      if (prev.status !== 'playing' && prev.status !== 'suit-selection') return prev;
      if (prev.players[prev.currentPlayerIndex].id !== playerId) return prev;

      const player = prev.players[prev.currentPlayerIndex];
      const cardIndex = player.hand.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return prev;
      const card = player.hand[cardIndex];

      const topCard = prev.discardPile[prev.discardPile.length - 1];

      if (!isValidPlay(card, prev.activeSuit, topCard, prev.drawPenalty)) {
        return prev;
      }

      if (card.rank === '8' && !selectedSuit) {
        if (player.isHuman) {
          return { ...prev, status: 'suit-selection', pendingCard: card };
        } else {
          const suitCounts = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
          player.hand.forEach(c => { if (c.rank !== '8') suitCounts[c.suit as keyof typeof suitCounts]++; });
          selectedSuit = (Object.keys(suitCounts) as Suit[]).reduce((a, b) => suitCounts[a as keyof typeof suitCounts] > suitCounts[b as keyof typeof suitCounts] ? a : b) as Suit;
        }
      }

      const newHand = [...player.hand];
      newHand.splice(cardIndex, 1);
      const newPlayers = [...prev.players];
      newPlayers[prev.currentPlayerIndex] = { ...player, hand: newHand };

      if (newHand.length === 0) {
        const penalties: Record<string, number> = {};
        const finalPlayers = newPlayers.map(p => {
          if (p.id === player.id) {
            penalties[p.id] = 0;
            return p;
          }
          const penalty = p.hand.reduce((sum, c) => sum + getCardScore(c), 0);
          penalties[p.id] = penalty;
          return { ...p, score: p.score + penalty };
        });

        const isGameOver = finalPlayers.some(p => p.score >= TARGET_SCORE);
        let overallWinner = null;
        if (isGameOver) {
          overallWinner = finalPlayers.reduce((min, p) => p.score < min.score ? p : min).name;
        }

        return {
          ...prev,
          players: finalPlayers,
          discardPile: [...prev.discardPile, card],
          activeSuit: selectedSuit || card.suit,
          roundWinner: player.name,
          winner: overallWinner,
          status: isGameOver ? 'game-over' : 'round-over',
          message: isGameOver ? `Game Over! ${overallWinner} wins the game!` : `${player.name} won round ${prev.round}!`,
          lastRoundPenalties: penalties,
        };
      }

      let newDirection = prev.direction;
      let newPenalty = prev.drawPenalty;
      let skipNext = false;

      if (card.rank === 'A') {
        newDirection = (prev.direction * -1) as 1 | -1;
      } else if (card.rank === 'Q') {
        skipNext = true;
      } else if (card.rank === '2') {
        newPenalty += 2;
      }

      let nextPlayerIndex = (prev.currentPlayerIndex + newDirection + prev.players.length) % prev.players.length;
      if (skipNext) {
        nextPlayerIndex = (nextPlayerIndex + newDirection + prev.players.length) % prev.players.length;
      }

      return {
        ...prev,
        players: newPlayers,
        discardPile: [...prev.discardPile, card],
        activeSuit: selectedSuit || card.suit,
        direction: newDirection,
        drawPenalty: newPenalty,
        currentPlayerIndex: nextPlayerIndex,
        status: 'playing',
        pendingCard: null,
        hasDrawnThisTurn: false,
        message: `${player.name} played ${card.rank} of ${card.suit}.`,
      };
    });
  }, [isValidPlay]);

  const handleDraw = useCallback((playerId: string) => {
    setGameState(prev => {
      if (prev.status !== 'playing') return prev;
      if (prev.players[prev.currentPlayerIndex].id !== playerId) return prev;

      const player = prev.players[prev.currentPlayerIndex];

      if (prev.drawPenalty > 0) {
        const { drawn, newDeck, newDiscard } = drawCards(prev.deck, prev.discardPile, prev.drawPenalty);
        const newHand = [...player.hand, ...drawn];
        const newPlayers = [...prev.players];
        newPlayers[prev.currentPlayerIndex] = { ...player, hand: newHand };

        const nextPlayerIndex = (prev.currentPlayerIndex + prev.direction + prev.players.length) % prev.players.length;

        return {
          ...prev,
          deck: newDeck,
          discardPile: newDiscard,
          players: newPlayers,
          drawPenalty: 0,
          currentPlayerIndex: nextPlayerIndex,
          hasDrawnThisTurn: false,
          message: `${player.name} drew ${prev.drawPenalty} penalty cards.`,
        };
      } else {
        if (prev.hasDrawnThisTurn) return prev;

        const { drawn, newDeck, newDiscard } = drawCards(prev.deck, prev.discardPile, 1);
        const newHand = [...player.hand, ...drawn];
        const newPlayers = [...prev.players];
        newPlayers[prev.currentPlayerIndex] = { ...player, hand: newHand };

        return {
          ...prev,
          deck: newDeck,
          discardPile: newDiscard,
          players: newPlayers,
          hasDrawnThisTurn: true,
          message: `${player.name} drew a card.`,
        };
      }
    });
  }, []);

  const passTurn = useCallback((playerId: string) => {
    setGameState(prev => {
      if (prev.status !== 'playing') return prev;
      if (prev.players[prev.currentPlayerIndex].id !== playerId) return prev;
      if (!prev.hasDrawnThisTurn) return prev;

      const nextPlayerIndex = (prev.currentPlayerIndex + prev.direction + prev.players.length) % prev.players.length;

      return {
        ...prev,
        currentPlayerIndex: nextPlayerIndex,
        hasDrawnThisTurn: false,
        message: `${prev.players[prev.currentPlayerIndex].name} passed.`,
      };
    });
  }, []);

  return {
    gameState,
    playCard,
    handleDraw,
    passTurn,
    resetGame,
    nextRound,
    isValidPlay,
  };
}
