/**
 * Yahtzee: 5 dice, up to 3 rolls per turn, fill 13 categories.
 * Upper section (1-6) + bonus 35 if upper sum >= 63.
 * Lower: Three of a Kind, Four of a Kind, Full House, Small Straight, Large Straight, Yahtzee, Chance.
 * Yahtzee bonus: +100 per extra Yahtzee after first 50. Joker rules for Yahtzee when upper slot used.
 */

export const UPPER_BONUS_THRESHOLD = 63;
export const UPPER_BONUS_POINTS = 35;

export type UpperCategory = 1 | 2 | 3 | 4 | 5 | 6;
export type LowerCategoryKey =
  | 'threeOfAKind'
  | 'fourOfAKind'
  | 'fullHouse'
  | 'smallStraight'
  | 'largeStraight'
  | 'yahtzee'
  | 'chance';

export type CategoryKey = { type: 'upper'; value: UpperCategory } | { type: 'lower'; value: LowerCategoryKey };

export interface ScoreCard {
  upper: Record<UpperCategory, number | null>;
  lower: Record<LowerCategoryKey, number | null>;
  /** Count of Yahtzee bonuses (100 each) after first Yahtzee scored 50. */
  yahtzeeBonusCount: number;
}

export interface YahtzeeState {
  numPlayers: number;
  /** currentRound 0..12; each round every player takes one turn. */
  currentRound: number;
  /** Index of player whose turn it is within this round. */
  currentPlayerIndex: number;
  dice: number[];
  rollCount: number;
  kept: boolean[];
  phase: 'rolling' | 'choosingCategory' | 'gameOver';
  scoreCards: ScoreCard[];
  /** This turn we rolled a Yahtzee (for Joker / bonus). */
  rolledYahtzeeThisTurn: boolean;
}

const DICE_COUNT = 5;
const MAX_ROLLS = 3;
const TOTAL_ROUNDS = 13;

function sum(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0);
}

function counts(dice: number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (let i = 1; i <= 6; i++) m.set(i, 0);
  for (const d of dice) m.set(d, (m.get(d) ?? 0) + 1);
  return m;
}

/** Score for upper category (e.g. Threes = sum of 3s). */
export function scoreUpper(dice: number[], face: UpperCategory): number {
  return dice.filter((d) => d === face).reduce((a, b) => a + b, 0);
}

/** At least 3 same → sum of all; else 0. */
export function scoreThreeOfAKind(dice: number[]): number {
  const c = counts(dice);
  const has3 = [...c.values()].some((n) => n >= 3);
  return has3 ? sum(dice) : 0;
}

/** At least 4 same → sum of all; else 0. */
export function scoreFourOfAKind(dice: number[]): number {
  const c = counts(dice);
  const has4 = [...c.values()].some((n) => n >= 4);
  return has4 ? sum(dice) : 0;
}

/** 3 of one + 2 of another → 25; else 0. */
export function scoreFullHouse(dice: number[]): number {
  const c = counts(dice);
  const vals = [...c.values()].filter((n) => n > 0).sort((a, b) => b - a);
  return vals.length >= 2 && vals[0] >= 3 && vals[1] >= 2 ? 25 : 0;
}

/** Small straight 1-2-3-4, 2-3-4-5, or 3-4-5-6 → 30. */
export function scoreSmallStraight(dice: number[]): number {
  const s = new Set(dice);
  const run =
    (s.has(1) && s.has(2) && s.has(3) && s.has(4)) ||
    (s.has(2) && s.has(3) && s.has(4) && s.has(5)) ||
    (s.has(3) && s.has(4) && s.has(5) && s.has(6));
  return run ? 30 : 0;
}

/** Large straight 1-2-3-4-5 or 2-3-4-5-6 → 40. */
export function scoreLargeStraight(dice: number[]): number {
  const s = [...dice].sort((a, b) => a - b).join('');
  return s === '12345' || s === '23456' ? 40 : 0;
}

/** All 5 same → 50; else 0. */
export function scoreYahtzee(dice: number[]): number {
  const c = counts(dice);
  const has5 = [...c.values()].some((n) => n === 5);
  return has5 ? 50 : 0;
}

/** Chance: sum of all. */
export function scoreChance(dice: number[]): number {
  return sum(dice);
}

/** Is the current dice a Yahtzee (five of a kind)? */
export function isYahtzee(dice: number[]): boolean {
  return scoreYahtzee(dice) === 50;
}

export function createEmptyScoreCard(): ScoreCard {
  return {
    upper: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
    lower: {
      threeOfAKind: null,
      fourOfAKind: null,
      fullHouse: null,
      smallStraight: null,
      largeStraight: null,
      yahtzee: null,
      chance: null,
    },
    yahtzeeBonusCount: 0,
  };
}

export function createInitialState(numPlayers: number): YahtzeeState {
  return {
    numPlayers,
    currentRound: 0,
    currentPlayerIndex: 0,
    dice: [1, 1, 1, 1, 1],
    rollCount: 0,
    kept: [false, false, false, false, false],
    phase: 'rolling',
    scoreCards: Array.from({ length: numPlayers }, () => createEmptyScoreCard()),
    rolledYahtzeeThisTurn: false,
  };
}

/** Roll dice that are not kept; if no rolls left or first roll, roll all. */
export function rollDice(state: YahtzeeState): YahtzeeState {
  if (state.phase !== 'rolling') return state;
  const nextDice = state.dice.map((d, i) =>
    state.rollCount === 0 || !state.kept[i] ? 1 + Math.floor(Math.random() * 6) : d
  );
  const nextRollCount = Math.min(state.rollCount + 1, MAX_ROLLS);
  const rolledYahtzee = isYahtzee(nextDice);
  return {
    ...state,
    dice: nextDice,
    rollCount: nextRollCount,
    rolledYahtzeeThisTurn: state.rolledYahtzeeThisTurn || rolledYahtzee,
    phase: nextRollCount >= MAX_ROLLS ? 'choosingCategory' : 'rolling',
  };
}

export function toggleKept(state: YahtzeeState, index: number): YahtzeeState {
  if (state.phase !== 'rolling' || state.rollCount === 0) return state;
  const next = [...state.kept];
  next[index] = !next[index];
  return { ...state, kept: next };
}

/** Get score for a category with current dice. For Joker, allow lower straights/house with fixed score. */
export function getScoreForCategory(
  dice: number[],
  category: CategoryKey,
  card: ScoreCard,
  isJoker: boolean
): number {
  if (category.type === 'upper') {
    return scoreUpper(dice, category.value);
  }
  switch (category.value) {
    case 'threeOfAKind':
      return isJoker ? sum(dice) : scoreThreeOfAKind(dice);
    case 'fourOfAKind':
      return isJoker ? sum(dice) : scoreFourOfAKind(dice);
    case 'fullHouse':
      return isJoker ? 25 : scoreFullHouse(dice);
    case 'smallStraight':
      return isJoker ? 30 : scoreSmallStraight(dice);
    case 'largeStraight':
      return isJoker ? 40 : scoreLargeStraight(dice);
    case 'yahtzee':
      return scoreYahtzee(dice);
    case 'chance':
      return scoreChance(dice);
    default:
      return 0;
  }
}

/** Check if a category is already filled on the card. */
export function isCategoryFilled(card: ScoreCard, category: CategoryKey): boolean {
  if (category.type === 'upper') return card.upper[category.value] !== null;
  return card.lower[category.value] !== null;
}

/** When we have Yahtzee this turn and Yahtzee slot already has 50: can use Joker for Full/Small/Large? */
export function getJokerEligibleCategories(
  dice: number[],
  card: ScoreCard
): LowerCategoryKey[] {
  if (!isYahtzee(dice)) return [];
  const yahtzeeScore = card.lower.yahtzee;
  if (yahtzeeScore !== 50) return [];
  const face = dice[0];
  const upperUsed = card.upper[face as UpperCategory] !== null;
  if (!upperUsed) return [];
  const out: LowerCategoryKey[] = [];
  if (card.lower.fullHouse === null) out.push('fullHouse');
  if (card.lower.smallStraight === null) out.push('smallStraight');
  if (card.lower.largeStraight === null) out.push('largeStraight');
  return out;
}

/** Fill a category and advance turn. Handles Yahtzee bonus and Joker. */
export function fillCategory(
  state: YahtzeeState,
  category: CategoryKey,
  useJoker: boolean
): YahtzeeState {
  if (state.phase !== 'choosingCategory') return state;
  const card = state.scoreCards[state.currentPlayerIndex];
  if (isCategoryFilled(card, category)) return state;

  const isJoker =
    useJoker &&
    state.rolledYahtzeeThisTurn &&
    category.type === 'lower' &&
    ['fullHouse', 'smallStraight', 'largeStraight'].includes(category.value);
  const score = getScoreForCategory(state.dice, category, card, isJoker);

  const newCards = state.scoreCards.map((c, i) => {
    if (i !== state.currentPlayerIndex) return c;
    const next = { ...c, upper: { ...c.upper }, lower: { ...c.lower } };
    if (category.type === 'upper') {
      next.upper[category.value] = score;
    } else {
      next.lower[category.value] = score;
    }
    if (
      state.rolledYahtzeeThisTurn &&
      card.lower.yahtzee === 50
    ) {
      next.yahtzeeBonusCount = (c.yahtzeeBonusCount ?? 0) + 1;
    }
    return next;
  });

  let nextPlayer = state.currentPlayerIndex + 1;
  let nextRound = state.currentRound;
  if (nextPlayer >= state.numPlayers) {
    nextPlayer = 0;
    nextRound = state.currentRound + 1;
  }
  const gameOver = nextRound >= TOTAL_ROUNDS;
  return {
    ...state,
    scoreCards: newCards,
    currentPlayerIndex: nextPlayer,
    currentRound: nextRound,
    dice: [1, 1, 1, 1, 1],
    rollCount: 0,
    kept: [false, false, false, false, false],
    phase: gameOver ? 'gameOver' : 'rolling',
    rolledYahtzeeThisTurn: false,
  };
}

/** Upper section sum for one card. */
export function upperSum(card: ScoreCard): number {
  return (card.upper[1] ?? 0) + (card.upper[2] ?? 0) + (card.upper[3] ?? 0) +
    (card.upper[4] ?? 0) + (card.upper[5] ?? 0) + (card.upper[6] ?? 0);
}

/** Upper bonus (35) if upper sum >= 63. */
export function upperBonus(card: ScoreCard): number {
  return upperSum(card) >= UPPER_BONUS_THRESHOLD ? UPPER_BONUS_POINTS : 0;
}

/** Lower section sum for one card. */
export function lowerSum(card: ScoreCard): number {
  const l = card.lower;
  return (l.threeOfAKind ?? 0) + (l.fourOfAKind ?? 0) + (l.fullHouse ?? 0) +
    (l.smallStraight ?? 0) + (l.largeStraight ?? 0) + (l.yahtzee ?? 0) + (l.chance ?? 0);
}

/** Yahtzee bonus points (100 per extra Yahtzee). */
export function yahtzeeBonusPoints(card: ScoreCard): number {
  return (card.yahtzeeBonusCount ?? 0) * 100;
}

/** Total score for one player. */
export function totalScore(card: ScoreCard): number {
  return upperSum(card) + upperBonus(card) + lowerSum(card) + yahtzeeBonusPoints(card);
}

/** All category keys in order (upper 1-6, then lower). */
export const ALL_CATEGORIES: CategoryKey[] = [
  { type: 'upper', value: 1 },
  { type: 'upper', value: 2 },
  { type: 'upper', value: 3 },
  { type: 'upper', value: 4 },
  { type: 'upper', value: 5 },
  { type: 'upper', value: 6 },
  { type: 'lower', value: 'threeOfAKind' },
  { type: 'lower', value: 'fourOfAKind' },
  { type: 'lower', value: 'fullHouse' },
  { type: 'lower', value: 'smallStraight' },
  { type: 'lower', value: 'largeStraight' },
  { type: 'lower', value: 'yahtzee' },
  { type: 'lower', value: 'chance' },
];

export const LOWER_CATEGORY_LABELS: Record<LowerCategoryKey, string> = {
  threeOfAKind: '三條',
  fourOfAKind: '四條',
  fullHouse: '葫蘆',
  smallStraight: '小順',
  largeStraight: '大順',
  yahtzee: '快艇',
  chance: '機會',
};
