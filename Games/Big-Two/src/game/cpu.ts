import { isDeuce, power } from './cards';
import { canPass, playsFor } from './engine';
import { canAnyoneBeat, finishingSeats } from './memory';
import { legalPlays } from './plays';
import { seedFromCode, streamRng } from './rng';
import type {
  Card,
  DifficultyId,
  GameState,
  Personality,
  PersonalityId,
  Play,
  Seat,
} from './types';

export interface DifficultyInfo {
  id: DifficultyId;
  label: string;
  blurb: string;
}

/**
 * Three difficulty tiers stay ordered by measured win rate. Each CPU seat also
 * wears a named personality so the table reads as three opponents — on Hard the
 * personalities actually pull decisions apart; on Normal they only break ties.
 */
export const DIFFICULTIES: DifficultyInfo[] = [
  { id: 'easy', label: '簡單', blurb: '常亂出；對手不太記牌、也不會卡人' },
  { id: 'normal', label: '普通', blurb: '永遠出能壓的最小一手；個性只破平手' },
  { id: 'hard', label: '困難', blurb: '顧拆法＋記牌；三位對手各有控場／衝刺／記牌風格' },
];

/** Chance the easy CPU declines a trick it could take. */
export const EASY_PASS_RATE = 0.38;

/** Seat 1/2/3 personalities — fixed so rematches stay readable. */
export const SEAT_PERSONALITIES: Record<1 | 2 | 3, PersonalityId> = {
  1: 'rusher',
  2: 'controller',
  3: 'counter',
};

export const PERSONALITIES: Personality[] = [
  { id: 'rusher', name: '衝刺俠', blurb: '能出就出，節奏優先' },
  { id: 'controller', name: '控場手', blurb: '留 2 與大獎控領出權' },
  { id: 'counter', name: '記牌師', blurb: '盯已出牌，專壓快出完的人' },
];

export function difficultyInfo(id: DifficultyId): DifficultyInfo {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

export function personalityInfo(id: PersonalityId): Personality {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0];
}

export function personalityForSeat(seat: Seat): Personality | null {
  if (seat !== 1 && seat !== 2 && seat !== 3) return null;
  return personalityInfo(SEAT_PERSONALITIES[seat]);
}

/**
 * How many turns it would take to empty this hand if nobody interfered.
 *
 * Greedy rather than optimal on purpose — an exact minimum partition is a
 * set-cover search, and this runs on every candidate move.
 */
export function turnsToEmpty(hand: readonly Card[]): number {
  let remaining = [...hand];
  let turns = 0;

  for (const size of [5, 2]) {
    for (;;) {
      const options = legalPlays(remaining, null).filter((p) => p.cards.length === size);
      if (options.length === 0) break;
      const chosen = options[0];
      const ids = new Set(chosen.cards.map((c) => c.id));
      remaining = remaining.filter((card) => !ids.has(card.id));
      turns += 1;
    }
  }

  return turns + remaining.length;
}

function spend(play: Play): number {
  return play.cards.reduce((total, card) => total + power(card), 0) / play.cards.length;
}

function controlCost(play: Play): number {
  let cost = 0;
  for (const card of play.cards) {
    if (isDeuce(card)) cost += 3;
    else if (card.rank === 1) cost += 1.5;
    else if (card.suit === 'spades' && power(card) >= 40) cost += 1;
  }
  return cost;
}

function afterHand(hand: readonly Card[], play: Play): Card[] {
  const ids = new Set(play.cards.map((c) => c.id));
  return hand.filter((card) => !ids.has(card.id));
}

/**
 * Pick among hard options without ever increasing turns-to-empty.
 *
 * Stage 1 is the measured hard brain (minimise remaining turns). Stage 2 is
 * the original ammunition tie-break (`spend/200 + key/1e9`). Personality is a
 * tertiary rearrange of that equal-efficiency set for CPU seats only — never
 * applied to seat 0, so the strength ladder stays measurable.
 */
function pickHard(
  state: GameState,
  options: Play[],
  personality: PersonalityId | null,
): Play {
  const hand = state.hands[state.turn];
  const threat = finishingSeats(state).filter((seat) => seat !== state.turn);
  const mustAnswer = threat.length > 0 && state.table !== null;

  const ranked = options.map((playOption) => {
    const rest = afterHand(hand, playOption);
    return {
      play: playOption,
      turns: turnsToEmpty(rest),
      spend: spend(playOption),
      key: playOption.key,
      control: controlCost(playOption),
      unbeatable: !canAnyoneBeat(state, state.turn, playOption),
    };
  });

  const minTurns = Math.min(...ranked.map((entry) => entry.turns));
  const efficient = ranked.filter((entry) => entry.turns === minTurns);

  const costOf = (entry: (typeof ranked)[number]): number => {
    // Seat 0 (tests / no personality): exact original ammunition tie-break.
    if (!personality) return entry.spend / 200 + entry.key / 1e9;

    // CPU seats: still refuse worse tempo, but among equal-tempo plays the
    // personality is allowed to rearrange freely — that is what makes the
    // three opponents readable.
    let cost = entry.spend / 400 + entry.key / 1e9;
    if (personality === 'rusher') {
      cost -= entry.play.cards.length * 0.15;
    } else if (personality === 'controller') {
      if (!mustAnswer) cost += entry.control * 0.55;
      if (state.table === null && entry.play.cards.some(isDeuce) && hand.length > 4) {
        cost += 1.2;
      }
    } else {
      if (mustAnswer) cost -= 1.1;
      if (threat.some((seat) => seat === state.tableOwner)) cost -= 0.6;
      if (entry.unbeatable) cost -= 0.8;
    }
    return cost;
  };

  let best = efficient[0];
  let bestCost = Number.POSITIVE_INFINITY;
  for (const entry of efficient) {
    const cost = costOf(entry);
    if (cost < bestCost) {
      bestCost = cost;
      best = entry;
    }
  }
  return best.play;
}

/**
 * Pick a move, or null to pass.
 *
 * Never pass when holding the lead. A play that empties the hand is taken
 * immediately. Hard never declines a takeable trick — measured earlier that
 * "pass to protect shape" collapses win rate below normal.
 */
export function chooseMove(state: GameState): Play | null {
  const options = playsFor(state);
  const hand = state.hands[state.turn];

  if (options.length === 0) return null;

  const finisher = options.find((p) => p.cards.length === hand.length);
  if (finisher) return finisher;

  const difficulty = state.difficulty;
  const personality = personalityForSeat(state.turn)?.id ?? null;

  if (difficulty === 'easy') {
    const r = streamRng(seedFromCode(state.seedCode), `cpu:${state.turn}:${state.log.length}`);
    if (canPass(state) && r() < EASY_PASS_RATE) return null;
    // Light seat tint: among random picks, prefer the personality's favourite
    // shape ~40% of the time so Easy seats are not identical noise.
    if (personality && r() < 0.4) {
      return pickHard(state, options, personality);
    }
    return options[Math.floor(r() * options.length)];
  }

  if (difficulty === 'normal') {
    // Always answer with the cheapest legal play (original normal policy).
    // Personality only breaks exact key ties so the three seats are not clones.
    const cheapestKey = options[0].key;
    const tied = options.filter((p) => p.key === cheapestKey);
    if (tied.length === 1) return tied[0];
    return pickHard(state, tied, personality);
  }

  return pickHard(state, options, personality);
}
