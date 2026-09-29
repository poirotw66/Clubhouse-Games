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
 * Difficulty is **where you sit**, not how clever the CPU is — with a light
 * blunder axis on top so Easy / Normal / Hard still feel three steps apart
 * even when the seat axis is held fixed.
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
 * difficulty selector controls. Discard quality and a capture-pick blunder rate
 * ride along so the Easy→Normal rung is player-visible without inventing a
 * third brain that measured as worthless.
 */
export interface DifficultyInfo {
  id: DifficultyId;
  label: string;
  blurb: string;
  brain: CpuBrain;
  /** true seats the human last in the order — the better seat. */
  humanLast: boolean;
  /**
   * Chance, when several captures are available, to pick one at random instead
   * of the highest-value one. Legal play is preserved (never skip a capture).
   */
  captureBlunderRate: number;
}

export type DifficultyConfig = {
  brain: CpuBrain;
  humanLast: boolean;
  captureBlunderRate: number;
};

export const DIFFICULTIES: DifficultyInfo[] = [
  {
    id: 'easy',
    label: '簡單',
    blurb: '你最後出牌；對手亂丟，撿牌也常選錯',
    brain: 'careless',
    humanLast: true,
    captureBlunderRate: 0.45,
  },
  {
    id: 'normal',
    label: '普通',
    blurb: '你最後出牌；對手不白送，偶有失手',
    brain: 'sharp',
    humanLast: true,
    captureBlunderRate: 0.12,
  },
  {
    id: 'hard',
    label: '困難',
    blurb: '換你先出；對手精準撿分，不犯錯',
    brain: 'sharp',
    humanLast: false,
    captureBlunderRate: 0,
  },
];

export function difficultyInfo(id: DifficultyId): DifficultyInfo {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

/** Exported so `check` can pin the three tiers staying spread apart. */
export function getDifficultyConfig(id: DifficultyId): DifficultyConfig {
  const info = difficultyInfo(id);
  return {
    brain: info.brain,
    humanLast: info.humanLast,
    captureBlunderRate: info.captureBlunderRate,
  };
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

function bestCapturingMove(moves: CpuMove[], blackAces: boolean): CpuMove {
  return [...moves].sort(
    (a, b) =>
      pointsOf(b.taken!, blackAces) +
      pointsOf(b.card, blackAces) -
      (pointsOf(a.taken!, blackAces) + pointsOf(a.card, blackAces)) ||
      b.taken!.rank - a.taken!.rank,
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
 *
 * Softening Easy / Normal therefore never skips a capture: it only misfires
 * which capturing line to take (via `captureBlunderRate`).
 */
export function chooseMove(
  state: GameState,
  brain: CpuBrain,
  captureBlunderRate = 0,
): CpuMove {
  const blackAces = state.rules.blackAces;
  const capturing = state.hands[state.turn]
    .map((card) => ({ card, taken: bestCapture(card, state.table, blackAces) }))
    .filter((move): move is CpuMove => move.taken !== null);

  if (capturing.length > 0) {
    if (captureBlunderRate > 0 && capturing.length > 1) {
      const r = streamRng(
        seedFromCode(state.seedCode),
        `capture-blunder:${state.turn}:${state.log.length}`,
      );
      if (r() < captureBlunderRate) {
        return capturing[Math.floor(r() * capturing.length)];
      }
    }
    return bestCapturingMove(capturing, blackAces);
  }

  return { card: chooseDiscard(state, brain), taken: null };
}

/** Convenience for callers that only hold a difficulty. */
export function chooseMoveFor(state: GameState): CpuMove {
  const info = difficultyInfo(state.difficulty);
  return chooseMove(state, info.brain, info.captureBlunderRate);
}
