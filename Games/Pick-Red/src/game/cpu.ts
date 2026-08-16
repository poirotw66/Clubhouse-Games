import { pointsOf } from './cards';
import { bestCapture } from './engine';
import { seedFromCode, streamRng } from './rng';
import { HUMAN } from './types';
import type { Card, CpuBrain, DifficultyId, GameState, Seat } from './types';

export interface CpuMove {
  card: Card;
  taken: Card | null;
}

/**
 * Difficulty is **where you sit**, not how clever the CPU is.
 *
 * That is not the design this started with. Three brains were built — greedy,
 * greedy-plus-safe-discard, and a card counter tracking which ranks each
 * opponent has proved it cannot take — and measured head to head over 800 deals
 * per pairing. The first step is worth about 3.5 points. **The second is worth
 * zero**: the counter finished at 100.8 where the plain one finished at 101.1,
 * and sweeping its one free parameter across 0–25 never moved it off that line.
 *
 * Meanwhile the seat is worth seven points. With identical brains the seat that
 * plays *later* wins 55–58% of the time, because playing earlier means
 * committing a card to a table the later seats then get to answer. That is a
 * bigger effect than every strategy difference put together, so it is what the
 * difficulty selector controls, with discard quality riding along on the easy
 * end.
 */
export interface DifficultyInfo {
  id: DifficultyId;
  label: string;
  blurb: string;
  brain: CpuBrain;
  /** true seats the human last in the order — the better seat. */
  humanLast: boolean;
}

export const DIFFICULTIES: DifficultyInfo[] = [
  { id: 'easy', label: '簡單', blurb: '你最後出牌，對手沒得撿時亂丟。', brain: 'careless', humanLast: true },
  { id: 'normal', label: '普通', blurb: '你最後出牌，但對手不會白送紅牌。', brain: 'sharp', humanLast: true },
  { id: 'hard', label: '困難', blurb: '換你先出——每一張都要先攤給別人看。', brain: 'sharp', humanLast: false },
];

export function difficultyInfo(id: DifficultyId): DifficultyInfo {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

/**
 * Who plays first. Seating the human last means every other seat commits before
 * they do; seating them first means the reverse.
 */
export function leaderFor(id: DifficultyId, players: number): Seat {
  return difficultyInfo(id).humanLast ? (HUMAN + 1) % players : HUMAN;
}

/**
 * Which card to give up when nothing on the table can be taken. Roughly a
 * quarter of all hand plays are this decision, so it is the one place the two
 * brains actually differ.
 */
function chooseDiscard(state: GameState, brain: CpuBrain): Card {
  const hand = state.hands[state.turn];

  if (brain === 'careless') {
    const r = streamRng(seedFromCode(state.seedCode), `discard:${state.turn}:${state.log.length}`);
    return hand[Math.floor(r() * hand.length)];
  }

  // Never hand over a red card while a black one will do. Everything more
  // elaborate than this measured the same or worse.
  return [...hand].sort(
    (a, b) =>
      pointsOf(a, state.rules.blackAces) - pointsOf(b, state.rules.blackAces) || a.rank - b.rank,
  )[0];
}

/**
 * Pick a hand card to play. **Always capture when you can.**
 *
 * The obvious refinement is to let the CPU decline a capture — taking a black 3
 * with your only 7 banks zero points and burns the card that was going to take a
 * red 3 later. That was built, scored against the risk of what each move left
 * behind, and swept over both its weights across 400 deals per cell. **Every
 * combination played worse than plain greedy**, by 8 to 20 points, and the trend
 * ran monotonically toward "never decline" — which is the sweep answering the
 * question. Declining only pays when your model of the other hands is good, and
 * with two dozen cards unseen it is not.
 */
export function chooseMove(state: GameState, brain: CpuBrain): CpuMove {
  const blackAces = state.rules.blackAces;
  const capturing = state.hands[state.turn]
    .map((card) => ({ card, taken: bestCapture(card, state.table, blackAces) }))
    .filter((move): move is CpuMove => move.taken !== null);

  if (capturing.length > 0) {
    return [...capturing].sort(
      (a, b) =>
        pointsOf(b.taken!, blackAces) +
        pointsOf(b.card, blackAces) -
        (pointsOf(a.taken!, blackAces) + pointsOf(a.card, blackAces)) ||
        b.taken!.rank - a.taken!.rank,
    )[0];
  }

  return { card: chooseDiscard(state, brain), taken: null };
}

/** Convenience for callers that only hold a difficulty. */
export function chooseMoveFor(state: GameState): CpuMove {
  return chooseMove(state, difficultyInfo(state.difficulty).brain);
}
