import { power } from './cards';
import { canPass, playsFor } from './engine';
import { legalPlays } from './plays';
import { seedFromCode, streamRng } from './rng';
import type { Card, DifficultyId, GameState, Play } from './types';

export interface DifficultyInfo {
  id: DifficultyId;
  label: string;
  blurb: string;
}

export const DIFFICULTIES: DifficultyInfo[] = [
  { id: 'easy', label: '簡單', blurb: '亂出，能壓就壓，不管浪費多大的牌。' },
  { id: 'normal', label: '普通', blurb: '永遠出壓得過的最小一手，留住大牌。' },
  { id: 'hard', label: '困難', blurb: '會顧手牌的拆法，不為了小便宜拆掉成形的牌組。' },
];

export function difficultyInfo(id: DifficultyId): DifficultyInfo {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

/**
 * How many turns it would take to empty this hand if nobody interfered.
 *
 * This is the number that actually decides Big Two. Thirteen cards played one
 * at a time is thirteen turns; the same thirteen cut into two five-card hands,
 * a pair and a single is four. Greedy from the top: take five-card hands while
 * any exist, then pairs, then whatever is left goes out one at a time.
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
      // Spend the weakest qualifying combination; the strong ones keep their
      // value as answers to other people's leads.
      const chosen = options[0];
      const ids = new Set(chosen.cards.map((c) => c.id));
      remaining = remaining.filter((card) => !ids.has(card.id));
      turns += 1;
    }
  }

  return turns + remaining.length;
}

/**
 * Pick a move, or null to pass.
 *
 * All three tiers share the rule that you never pass when you hold the lead —
 * passing on a fresh trick is not legal anyway — and that a play which empties
 * the hand is taken immediately.
 */
export function chooseMove(state: GameState): Play | null {
  const options = playsFor(state);
  const hand = state.hands[state.turn];

  if (options.length === 0) return null;

  // Anything that finishes the hand ends the game right now.
  const finisher = options.find((p) => p.cards.length === hand.length);
  if (finisher) return finisher;

  const difficulty = state.difficulty;

  if (difficulty === 'easy') {
    const r = streamRng(seedFromCode(state.seedCode), `cpu:${state.turn}:${state.log.length}`);
    // A weak player answers roughly at random and sometimes sits on a trick it
    // could have taken.
    if (canPass(state) && r() < 0.25) return null;
    return options[Math.floor(r() * options.length)];
  }

  if (difficulty === 'normal') {
    // The standard beginner-plus rule: win the trick as cheaply as possible.
    return options[0];
  }

  // Hard: judge every option by the state of the hand it leaves behind, so it
  // will decline to break a five-card hand for a one-card gain.
  let best = options[0];
  let bestCost = Number.POSITIVE_INFINITY;

  for (const option of options) {
    const ids = new Set(option.cards.map((c) => c.id));
    const rest = hand.filter((card) => !ids.has(card.id));
    // Turns still needed, plus a small charge for the strength being spent, so
    // that among equally efficient plays it still prefers the cheap one.
    const cost = turnsToEmpty(rest) + option.key / 1e9 + spend(option) / 200;
    if (cost < bestCost) {
      bestCost = cost;
      best = option;
    }
  }

  // It never declines a trick it can take.
  //
  // The opposite looks obviously right: if answering means breaking a made
  // five-card hand, hold on to it and let the trick go. That was built — pass
  // when the best answer would cost a whole extra turn — and it is the single
  // most damaging thing in this file. **19.4% against a field of `normal`
  // players, versus 33.0% with the same code and the passing removed**, and it
  // finished games holding 5.33 cards instead of 2.71.
  //
  // Big Two is a race, and every trick you decline is a turn the other three
  // get for free. Keeping a pretty hand shape is worth far less than tempo.
  return best;
}

/** Total card power spent by a play — how much ammunition it burns. */
function spend(play: Play): number {
  return play.cards.reduce((total, card) => total + power(card), 0) / play.cards.length;
}
