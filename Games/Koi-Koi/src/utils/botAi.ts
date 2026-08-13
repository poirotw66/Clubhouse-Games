import { Card, CardType } from '../types';
import { calculateYaku, getMatchingCards, WIN_SCORE } from './gameLogic';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

const TYPE_VALUE: Record<CardType, number> = {
  hikari: 4,
  tane: 3,
  tanzaku: 2,
  kasu: 1,
};

type DifficultyConfig = {
  /** Chance of ignoring scoring and picking a random legal play. */
  randomRate: number;
  /** Prefer dumping low-value cards when no match exists. */
  dumpLowValue: boolean;
  /** Weight on projected yaku points after the capture. */
  yakuWeight: number;
  /** Koi-Koi if points are below this threshold (easy/normal). */
  koiKoiPointCap: number;
};

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { randomRate: 0.45, dumpLowValue: false, yakuWeight: 0, koiKoiPointCap: 8 },
  normal: { randomRate: 0.08, dumpLowValue: true, yakuWeight: 10, koiKoiPointCap: 5 },
  hard: { randomRate: 0, dumpLowValue: true, yakuWeight: 100, koiKoiPointCap: 3 },
};

export type Rng = () => number;

function defaultRng(): number {
  return Math.random();
}

function pickRandom<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

/** Bonus for cards that complete or approach named yaku pieces. */
function subtypeBonus(card: Card): number {
  switch (card.subType) {
    case 'crane':
    case 'curtain':
    case 'moon':
      return 6;
    case 'boar':
    case 'deer':
    case 'butterfly':
      return 5;
    case 'sake':
      return 5;
    case 'akatan':
    case 'aotan':
      return 4;
    case 'rain_man':
      return 2;
    default:
      return 0;
  }
}

/**
 * Score a prospective capture for yaku-building value.
 * Higher is better. Dumping to the field (no match) scores near zero / negative.
 */
export function scoreCapture(
  handCard: Card,
  fieldCards: Card[],
  captured: Card[],
  yakuWeight: number,
): number {
  const typeScore =
    TYPE_VALUE[handCard.type] + fieldCards.reduce((sum, c) => sum + TYPE_VALUE[c.type], 0);
  const bonus =
    subtypeBonus(handCard) + fieldCards.reduce((sum, c) => sum + subtypeBonus(c), 0);

  if (fieldCards.length === 0) {
    // Dumping: lower value is better when dumpLowValue is on (caller inverts).
    return -(typeScore + bonus);
  }

  const after = [...captured, handCard, ...fieldCards];
  const { totalPoints } = calculateYaku(after);
  // Taking three of a month is usually strong.
  const tripleBonus = fieldCards.length >= 3 ? 8 : fieldCards.length === 2 ? 1 : 0;
  return totalPoints * yakuWeight + typeScore * 2 + bonus + tripleBonus;
}

export interface HandPlayChoice {
  handCard: Card;
  /** Best single field card to take when two match; null when dumping. */
  fieldMatch: Card | null;
  matches: Card[];
}

function bestFieldMatch(
  handCard: Card,
  matches: Card[],
  captured: Card[],
  yakuWeight: number,
): Card | null {
  if (matches.length === 0) return null;
  if (matches.length === 1 || matches.length === 3) return matches[0];

  let best = matches[0];
  let bestScore = -Infinity;
  for (const fieldCard of matches) {
    const score = scoreCapture(handCard, [fieldCard], captured, yakuWeight);
    if (score > bestScore) {
      bestScore = score;
      best = fieldCard;
    }
  }
  return best;
}

/**
 * Choose which hand card the bot plays (and which field card to take if two match).
 */
export function pickBotHandPlay(
  hand: Card[],
  field: Card[],
  captured: Card[],
  difficulty: Difficulty = 'normal',
  rng: Rng = defaultRng,
): HandPlayChoice | null {
  if (hand.length === 0) return null;

  const config = DIFFICULTY[difficulty];
  const options: HandPlayChoice[] = hand.map(handCard => {
    const matches = getMatchingCards(handCard, field);
    const fieldMatch =
      matches.length === 0
        ? null
        : matches.length === 3
          ? matches[0]
          : bestFieldMatch(handCard, matches, captured, Math.max(config.yakuWeight, 1));
    return { handCard, fieldMatch, matches };
  });

  if (config.randomRate > 0 && rng() < config.randomRate) {
    return pickRandom(options, rng);
  }

  let best: HandPlayChoice[] = [];
  let bestScore = -Infinity;

  for (const option of options) {
    const fieldCards =
      option.matches.length === 3
        ? option.matches
        : option.fieldMatch
          ? [option.fieldMatch]
          : [];
    let score = scoreCapture(option.handCard, fieldCards, captured, config.yakuWeight);
    if (fieldCards.length === 0 && !config.dumpLowValue) {
      // Easy: dumping is roughly random among non-matches — flatten dump scores.
      score = rng();
    }
    // Prefer any capture over dumping when scores are close.
    if (fieldCards.length > 0) score += 50;

    if (score > bestScore) {
      bestScore = score;
      best = [option];
    } else if (score === bestScore) {
      best.push(option);
    }
  }

  return best.length > 0 ? pickRandom(best, rng) : options[0];
}

/**
 * When the bot draws and two field cards match, pick which one to take.
 */
export function pickBotFieldMatch(
  playedCard: Card,
  matches: Card[],
  captured: Card[],
  difficulty: Difficulty = 'normal',
  rng: Rng = defaultRng,
): Card {
  if (matches.length === 0) {
    throw new Error('pickBotFieldMatch requires at least one match');
  }
  if (matches.length === 1) return matches[0];

  const config = DIFFICULTY[difficulty];
  if (config.randomRate > 0 && rng() < config.randomRate) {
    return pickRandom(matches, rng);
  }

  return bestFieldMatch(playedCard, matches, captured, Math.max(config.yakuWeight, 1)) ?? matches[0];
}

export interface KoiKoiContext {
  totalPoints: number;
  botHandLength: number;
  botScore: number;
  playerScore: number;
  playerKoiKoiCount: number;
  difficulty: Difficulty;
  winScore?: number;
}

/**
 * Decide whether the bot should call Koi-Koi (continue) instead of ending the round.
 */
export function shouldBotKoiKoi(ctx: KoiKoiContext): boolean {
  if (ctx.botHandLength <= 0) return false;

  const config = DIFFICULTY[ctx.difficulty];
  const winScore = ctx.winScore ?? WIN_SCORE;

  if (ctx.difficulty === 'hard') {
    // Bank if this finish wins the match, or points are already strong.
    const finishPoints =
      ctx.playerKoiKoiCount > 0 ? ctx.totalPoints * 2 : ctx.totalPoints;
    if (ctx.botScore + finishPoints >= winScore) return false;
    if (ctx.totalPoints >= 7) return false;
    if (ctx.botHandLength <= 2 && ctx.totalPoints >= 3) return false;
    // Opponent is close — take the points rather than risk a reverse.
    if (ctx.playerScore >= winScore - 3 && ctx.totalPoints >= 3) return false;
    return ctx.totalPoints < config.koiKoiPointCap || ctx.botHandLength >= 4;
  }

  return ctx.totalPoints < config.koiKoiPointCap;
}

export interface HintChoice {
  handCardId: string;
  fieldCardId: string | null;
}

/**
 * Recommend a hand card (and field match when two options) using hard-tier scoring.
 */
export function getPlayerHint(
  hand: Card[],
  field: Card[],
  captured: Card[],
): HintChoice | null {
  const choice = pickBotHandPlay(hand, field, captured, 'hard', () => 0);
  if (!choice) return null;
  return {
    handCardId: choice.handCard.id,
    fieldCardId: choice.fieldMatch?.id ?? null,
  };
}
