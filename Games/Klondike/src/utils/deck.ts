import { CardType, Suit, Rank, GameState } from '../types';

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const createDeck = (): CardType[] => {
  const deck: CardType[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black',
        faceUp: false,
      });
    }
  }
  return deck;
};

export const shuffleDeck = (deck: CardType[]): CardType[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const dealGame = (): GameState => {
  const deck = shuffleDeck(createDeck());
  const tableau: CardType[][] = Array.from({ length: 7 }, () => []);
  
  for (let i = 0; i < 7; i++) {
    for (let j = i; j < 7; j++) {
      const card = deck.pop()!;
      if (i === j) {
        card.faceUp = true;
      }
      tableau[j].push(card);
    }
  }
  
  return {
    tableau,
    foundation: [[], [], [], []],
    stock: deck,
    waste: [],
    history: [],
  };
};
