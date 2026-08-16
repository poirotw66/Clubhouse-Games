import { capturableBy, pointsOf } from './cards';
import { bestCapture } from './engine';
import { seedFromCode, streamRng } from './rng';
import type { Card, CpuBrain, DifficultyId, GameState, Side } from './types';

export interface CpuMove {
  card: Card;
  taken: Card | null;
}

/**
 * Difficulty is **which seat you get**, not how clever the CPU is.
 *
 * That is not the design this started with. Three brains were built — greedy,
 * greedy-plus-safe-discard, and a card counter that tracks which ranks the
 * opponent has proved it cannot take — and measured head to head over 800 deals
 * per pairing. The first step is worth about 3.5 points. **The second is worth
 * zero**: the counter finished at 100.8 where the plain one finished at 101.1,
 * and sweeping its one free parameter across 0–25 never moved it off that line.
 *
 * Meanwhile the seat is worth seven points. With identical brains the player who
 * moves *second* wins 55–58% of the time, because the first player has to commit
 * a card to a table the second player then gets to answer. That is a bigger
 * effect than every strategy difference put together, so it is what the
 * difficulty selector controls, with the discard quality riding along on the
 * easy end.
 */
export interface DifficultyInfo {
  id: DifficultyId;
  label: string;
  blurb: string;
  brain: CpuBrain;
  /** Who plays the first hand card. Moving second is the better seat. */
  leader: Side;
}

export const DIFFICULTIES: DifficultyInfo[] = [
  {
    id: 'easy',
    label: '簡單',
    blurb: '你後手，而且對手沒得撿時亂丟。',
    brain: 'careless',
    leader: 'cpu',
  },
  {
    id: 'normal',
    label: '普通',
    blurb: '你後手，但對手不會白送紅牌。',
    brain: 'sharp',
    leader: 'cpu',
  },
  {
    id: 'hard',
    label: '困難',
    blurb: '換你先手——每一張都要先攤給對手看。',
    brain: 'sharp',
    leader: 'player',
  },
];

export function difficultyInfo(id: DifficultyId): DifficultyInfo {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

/**
 * Which card to give up when nothing on the table can be taken. Roughly a
 * quarter of all hand plays are this decision, so it is the one place the two
 * brains actually differ.
 */
function chooseDiscard(state: GameState, brain: CpuBrain): Card {
  const hand = state.hands.cpu;

  if (brain === 'careless') {
    const r = streamRng(seedFromCode(state.seedCode), `cpu-discard:${state.log.length}`);
    return hand[Math.floor(r() * hand.length)];
  }

  // Never hand over a red card while a black one will do. Everything more
  // elaborate than this measured the same or worse.
  return [...hand].sort((a, b) => pointsOf(a) - pointsOf(b) || a.rank - b.rank)[0];
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
 * question. Declining only pays when your model of the opponent's hand is good,
 * and with two dozen cards unseen it is not.
 */
export function chooseMove(state: GameState, brain: CpuBrain): CpuMove {
  const capturing = state.hands.cpu
    .map((card) => ({ card, taken: bestCapture(card, state.table) }))
    .filter((move): move is CpuMove => move.taken !== null);

  if (capturing.length > 0) {
    return [...capturing].sort(
      (a, b) =>
        pointsOf(b.taken!) + pointsOf(b.card) - (pointsOf(a.taken!) + pointsOf(a.card)) ||
        b.taken!.rank - a.taken!.rank,
    )[0];
  }

  return { card: chooseDiscard(state, brain), taken: null };
}

/** Convenience for callers that only hold a difficulty. */
export function chooseMoveFor(state: GameState): CpuMove {
  return chooseMove(state, difficultyInfo(state.difficulty).brain);
}

/** Exposed so the UI can explain why a hand card is or is not playable. */
export function capturesFor(card: Card, table: readonly Card[]): Card[] {
  return capturableBy(card, table);
}
