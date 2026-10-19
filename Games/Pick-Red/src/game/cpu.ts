import { isRed, pointsOf } from './cards';
import { bestCapture } from './engine';
import { seedFromCode, streamRng } from './rng';
import { HUMAN } from './types';
import type {
  Card,
  CpuBrain,
  DifficultyId,
  GameState,
  Personality,
  PersonalityId,
  Seat,
} from './types';

export interface CpuMove {
  card: Card;
  taken: Card | null;
}

/**
 * Difficulty is **where you sit**, not how clever the CPU is — with a light
 * blunder axis on top so Easy / Normal / Hard still feel three steps apart
 * even when the seat axis is held fixed.
 *
 * Personalities ride on top of that: they rearrange *which* legal capture or
 * discard the seat prefers among near-equal options, so the table reads as
 * three distinct opponents rather than three copies of the same bot. They do
 * not replace the measured seat ladder.
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
    blurb: '換你先出；對手精準撿分，個性風格可辨',
    brain: 'sharp',
    humanLast: false,
    captureBlunderRate: 0,
  },
];

/** Seat 1/2/3 personalities — fixed so rematches stay readable. */
export const SEAT_PERSONALITIES: Record<1 | 2 | 3, PersonalityId> = {
  1: 'feeder',
  2: 'miser',
  3: 'aceChaser',
};

export const PERSONALITIES: Personality[] = [
  { id: 'feeder', name: '浪子', blurb: '常丟紅牌；撿牌不挑工具' },
  { id: 'miser', name: '守財奴', blurb: '絕少白送紅牌；優先用黑牌當工具' },
  { id: 'aceChaser', name: '追A手', blurb: '特別盯 A 與 9，搶大分' },
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

export function personalityInfo(id: PersonalityId): Personality {
  return PERSONALITIES.find((p) => p.id === id) ?? PERSONALITIES[0];
}

export function personalityForSeat(seat: Seat): Personality | null {
  if (seat !== 1 && seat !== 2 && seat !== 3) return null;
  return personalityInfo(SEAT_PERSONALITIES[seat]);
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
 * brains actually differ — and where personalities show on the felt.
 */
function chooseDiscard(state: GameState, brain: CpuBrain, personality: PersonalityId | null): Card {
  const hand = state.hands[state.turn];
  const blackAces = state.rules.blackAces;

  // Easy (careless) brain: random discard. Feeder on Easy also leans toward dumping
  // reds so the style is visible — but only while the brain is already careless,
  // so the measured sharp/careless ladder is not collapsed by personality.
  if (brain === 'careless') {
    if (personality === 'feeder') {
      const reds = hand.filter((c) => pointsOf(c, blackAces) > 0);
      if (reds.length > 0) {
        const r = streamRng(
          seedFromCode(state.seedCode),
          `feeder-discard:${state.turn}:${state.log.length}`,
        );
        return reds[Math.floor(r() * reds.length)];
      }
    }
    const r = streamRng(seedFromCode(state.seedCode), `discard:${state.turn}:${state.log.length}`);
    return hand[Math.floor(r() * hand.length)];
  }

  // Sharp: never hand over a scoring card while a zero-point one will do.
  // Personality only reorders equal-value discards (ties), matching Big-Two.
  return [...hand].sort((a, b) => {
    const pa = pointsOf(a, blackAces);
    const pb = pointsOf(b, blackAces);
    if (pa !== pb) return pa - pb;
    if (personality === 'aceChaser') {
      const key = (c: Card) => (c.rank === 1 || c.rank === 9 ? 1 : 0);
      return key(a) - key(b) || a.rank - b.rank;
    }
    if (personality === 'miser') {
      // Prefer discarding the lowest black rank among zeros.
      return a.rank - b.rank;
    }
    if (personality === 'feeder') {
      // Among zeros, feeder still prefers "any" — slight reverse rank for flavour.
      return b.rank - a.rank;
    }
    return a.rank - b.rank;
  })[0];
}

function captureValue(card: Card, taken: Card, blackAces: boolean): number {
  return pointsOf(card, blackAces) + pointsOf(taken, blackAces);
}

function aceAffinity(card: Card, taken: Card): number {
  let score = 0;
  for (const c of [card, taken]) {
    if (c.rank === 1) score += 3;
    else if (c.rank === 9) score += 2;
  }
  return score;
}

function toolCost(card: Card, blackAces: boolean): number {
  // Prefer spending a black (0-point) card as the tool when points are equal.
  return pointsOf(card, blackAces);
}

function bestCapturingMove(
  moves: CpuMove[],
  blackAces: boolean,
  personality: PersonalityId | null,
): CpuMove {
  return [...moves].sort((a, b) => {
    const va = captureValue(a.card, a.taken!, blackAces);
    const vb = captureValue(b.card, b.taken!, blackAces);
    if (va !== vb) return vb - va;

    if (personality === 'aceChaser') {
      const aa = aceAffinity(a.card, a.taken!);
      const ab = aceAffinity(b.card, b.taken!);
      if (aa !== ab) return ab - aa;
    }

    if (personality === 'miser') {
      const ta = toolCost(a.card, blackAces);
      const tb = toolCost(b.card, blackAces);
      if (ta !== tb) return ta - tb;
    }

    // Feeder: when tied, happily spend a red tool — opposite of miser.
    if (personality === 'feeder') {
      const ta = toolCost(a.card, blackAces);
      const tb = toolCost(b.card, blackAces);
      if (ta !== tb) return tb - ta;
    }

    return b.taken!.rank - a.taken!.rank;
  })[0];
}

/**
 * Pick a hand card to play. **Always capture when you can.**
 *
 * Softening Easy / Normal never skips a capture: it only misfires which
 * capturing line to take (via `captureBlunderRate`). Personality only rearranges
 * equal-value ties (and discard flavour) so the measured ladder stays intact.
 */
export function chooseMove(
  state: GameState,
  brain: CpuBrain,
  captureBlunderRate = 0,
  personality: PersonalityId | null = null,
): CpuMove {
  const blackAces = state.rules.blackAces;
  const person =
    personality ??
    (state.turn === HUMAN ? null : personalityForSeat(state.turn)?.id ?? null);

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
    return bestCapturingMove(capturing, blackAces, person);
  }

  return { card: chooseDiscard(state, brain, person), taken: null };
}

/** Convenience for callers that only hold a difficulty. */
export function chooseMoveFor(state: GameState): CpuMove {
  const info = difficultyInfo(state.difficulty);
  const person = personalityForSeat(state.turn)?.id ?? null;
  return chooseMove(state, info.brain, info.captureBlunderRate, person);
}

/**
 * Resolve a multi-way pick for a CPU seat. Same blunder / personality axes as
 * `chooseMove`, but the parked card is already known.
 */
export function chooseCaptureTarget(
  state: GameState,
  pending: Card,
  options: readonly Card[],
  captureBlunderRate = 0,
  personality: PersonalityId | null = null,
): Card {
  if (options.length === 0) throw new Error('chooseCaptureTarget: no options');
  if (options.length === 1) return options[0];

  const person =
    personality ??
    (state.turn === HUMAN ? null : personalityForSeat(state.turn)?.id ?? null);
  const blackAces = state.rules.blackAces;

  if (captureBlunderRate > 0) {
    const r = streamRng(
      seedFromCode(state.seedCode),
      `pick-blunder:${state.turn}:${state.log.length}`,
    );
    if (r() < captureBlunderRate) {
      return options[Math.floor(r() * options.length)];
    }
  }

  const fakeMoves: CpuMove[] = options.map((taken) => ({ card: pending, taken }));
  return bestCapturingMove(fakeMoves, blackAces, person).taken!;
}

/** True when a discard visibly "feeds" a red card onto the table. */
export function isFlashyDiscard(card: Card, taken: Card | null, blackAces: boolean): boolean {
  return taken === null && pointsOf(card, blackAces) >= 10;
}

/** True when a capture deserves a combo callout. */
export function isFlashyCapture(card: Card, taken: Card, blackAces: boolean): boolean {
  const pts = captureValue(card, taken, blackAces);
  if (pts >= 20) return true;
  if (card.rank === 1 || taken.rank === 1) return true;
  if (isRed(card) && card.rank === 5 && isRed(taken) && taken.rank === 5) return true;
  return false;
}
