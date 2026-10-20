import { Card, CardType, YakuId } from '../types';
import { calculateYaku, getMatchingCards, WIN_SCORE } from './gameLogic';
import type { PersonalityStyle } from './personalities';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

/** Short player-facing blurbs so the three tiers feel distinct on the setup screen. */
export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: '常亂出手，愛喊 Koi-Koi',
  normal: '會湊役，適度結算',
  hard: '少失誤，懂得及時收分',
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
  /** Flat bonus for any capture over dumping — lower on easy so dumps compete. */
  captureBias: number;
};

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { randomRate: 0.55, dumpLowValue: false, yakuWeight: 0, koiKoiPointCap: 9, captureBias: 15 },
  normal: { randomRate: 0.1, dumpLowValue: true, yakuWeight: 20, koiKoiPointCap: 5, captureBias: 50 },
  hard: { randomRate: 0, dumpLowValue: true, yakuWeight: 100, koiKoiPointCap: 3, captureBias: 80 },
};

/** Exported for check harnesses that assert the three tiers stay spread apart. */
export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTY[difficulty];
}

export type Rng = () => number;

function defaultRng(): number {
  return Math.random();
}

function pickRandom<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function effectiveConfig(
  difficulty: Difficulty,
  personality?: PersonalityStyle | null,
): DifficultyConfig {
  const base = DIFFICULTY[difficulty];
  if (!personality) return base;
  return {
    ...base,
    randomRate: Math.min(1, Math.max(0, base.randomRate * personality.randomRateMul)),
    koiKoiPointCap: Math.max(1, base.koiKoiPointCap + personality.koiKoiCapDelta),
    captureBias: Math.max(0, base.captureBias + personality.captureBiasDelta),
  };
}

/** Bonus for cards that complete or approach named yaku pieces. */
function subtypeBonus(card: Card, personality?: PersonalityStyle | null): number {
  let base = 0;
  switch (card.subType) {
    case 'crane':
    case 'curtain':
    case 'moon':
      base = 6;
      break;
    case 'boar':
    case 'deer':
    case 'butterfly':
      base = 5;
      break;
    case 'sake':
      base = 5;
      break;
    case 'akatan':
    case 'aotan':
      base = 4;
      break;
    case 'rain_man':
      base = 2;
      break;
    default:
      base = 0;
  }
  if (!card.subType || !personality?.subtypeBias) return base;
  const mul = personality.subtypeBias[card.subType];
  return mul === undefined ? base : base * mul;
}

function chaseBonus(
  yakuIds: YakuId[],
  personality?: PersonalityStyle | null,
): number {
  if (!personality || personality.chaseYaku.length === 0 || personality.chaseYakuBonus <= 0) {
    return 0;
  }
  const chased = new Set(personality.chaseYaku);
  let hits = 0;
  for (const id of yakuIds) {
    if (chased.has(id)) hits += 1;
  }
  return hits * personality.chaseYakuBonus;
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
  personality?: PersonalityStyle | null,
): number {
  const typeScore =
    TYPE_VALUE[handCard.type] + fieldCards.reduce((sum, c) => sum + TYPE_VALUE[c.type], 0);
  const bonus =
    subtypeBonus(handCard, personality) +
    fieldCards.reduce((sum, c) => sum + subtypeBonus(c, personality), 0);

  if (fieldCards.length === 0) {
    // Dumping: lower value is better when dumpLowValue is on (caller inverts).
    return -(typeScore + bonus);
  }

  const after = [...captured, handCard, ...fieldCards];
  const { yaku, totalPoints } = calculateYaku(after);
  // Taking three of a month is usually strong.
  const tripleBonus = fieldCards.length >= 3 ? 8 : fieldCards.length === 2 ? 1 : 0;
  const chase = chaseBonus(
    yaku.map(entry => entry.id),
    personality,
  );
  return totalPoints * yakuWeight + typeScore * 2 + bonus + tripleBonus + chase;
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
  personality?: PersonalityStyle | null,
): Card | null {
  if (matches.length === 0) return null;
  if (matches.length === 1 || matches.length === 3) return matches[0];

  let best = matches[0];
  let bestScore = -Infinity;
  for (const fieldCard of matches) {
    const score = scoreCapture(handCard, [fieldCard], captured, yakuWeight, personality);
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
  personality?: PersonalityStyle | null,
): HandPlayChoice | null {
  if (hand.length === 0) return null;

  const config = effectiveConfig(difficulty, personality);
  const yakuWeight = Math.max(config.yakuWeight, 1);
  const options: HandPlayChoice[] = hand.map(handCard => {
    const matches = getMatchingCards(handCard, field);
    const fieldMatch =
      matches.length === 0
        ? null
        : matches.length === 3
          ? matches[0]
          : bestFieldMatch(handCard, matches, captured, yakuWeight, personality);
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
    let score = scoreCapture(
      option.handCard,
      fieldCards,
      captured,
      config.yakuWeight,
      personality,
    );
    if (fieldCards.length === 0 && !config.dumpLowValue) {
      // Easy: dumping is roughly random among non-matches — flatten dump scores.
      score = rng();
    }
    // Prefer any capture over dumping; bias is wider on harder tiers.
    if (fieldCards.length > 0) score += config.captureBias;

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
  personality?: PersonalityStyle | null,
): Card {
  if (matches.length === 0) {
    throw new Error('pickBotFieldMatch requires at least one match');
  }
  if (matches.length === 1) return matches[0];

  const config = effectiveConfig(difficulty, personality);
  if (config.randomRate > 0 && rng() < config.randomRate) {
    return pickRandom(matches, rng);
  }

  return (
    bestFieldMatch(
      playedCard,
      matches,
      captured,
      Math.max(config.yakuWeight, 1),
      personality,
    ) ?? matches[0]
  );
}

export interface KoiKoiContext {
  totalPoints: number;
  botHandLength: number;
  botScore: number;
  playerScore: number;
  playerKoiKoiCount: number;
  difficulty: Difficulty;
  winScore?: number;
  personality?: PersonalityStyle | null;
}

/**
 * Decide whether the bot should call Koi-Koi (continue) instead of ending the round.
 */
export function shouldBotKoiKoi(ctx: KoiKoiContext): boolean {
  if (ctx.botHandLength <= 0) return false;

  const personality = ctx.personality ?? null;
  const config = effectiveConfig(ctx.difficulty, personality);
  const winScore = ctx.winScore ?? WIN_SCORE;
  const risk = personality?.riskAppetite ?? 0.45;

  if (ctx.difficulty === 'hard') {
    // Bank if this finish wins the match, or points are already strong.
    const finishPoints =
      ctx.playerKoiKoiCount > 0 ? ctx.totalPoints * 2 : ctx.totalPoints;
    if (ctx.botScore + finishPoints >= winScore) return false;
    // High-risk personalities may still press with strong hands.
    if (ctx.totalPoints >= 7 && risk < 0.7) return false;
    if (ctx.totalPoints >= 10) return false;
    if (ctx.botHandLength <= 2 && ctx.totalPoints >= 3 && risk < 0.8) return false;
    // Opponent is close — take the points rather than risk a reverse.
    if (ctx.playerScore >= winScore - 3 && ctx.totalPoints >= 3 && risk < 0.85) return false;
    return ctx.totalPoints < config.koiKoiPointCap || (ctx.botHandLength >= 4 && risk >= 0.55);
  }

  // Easy / normal: personality shifts the continue threshold.
  if (ctx.totalPoints < config.koiKoiPointCap) return true;
  // Borderline: only greedy callers continue at/above the cap.
  if (ctx.totalPoints === config.koiKoiPointCap) return risk >= 0.7;
  return risk >= 0.9 && ctx.totalPoints <= config.koiKoiPointCap + 2;
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
