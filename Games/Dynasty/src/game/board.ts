import { EXPECTATIONS, EXPECTATION_ORDER, TRUST_DANGER } from './config';
import { ability } from './players';
import type { Expectation, GameState, Team } from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * What the board would ask for unprompted, given how the club actually looks.
 * A stacked roster is not allowed to coast on a rebuilding mandate.
 */
export function defaultExpectation(state: GameState, team: Team): Expectation {
  const lastFinish = state.history.length > 0 ? state.history[state.history.length - 1].finish : 4;
  const stars = team.players.filter((p) => p.level === 'major' && ability(p) >= 70).length;
  if (lastFinish <= 2 && stars >= 3) return 'title';
  if (lastFinish <= 3) return 'playoffs';
  if (stars >= 2) return 'hold';
  return 'rebuild';
}

/**
 * Negotiating the mandate is what makes rebuilding a legitimate line rather
 * than a punishment: you may tell the board to expect less, but you pay for
 * the privilege in trust up front, before you have shown them anything.
 */
export const NEGOTIATION_COST = -6;
export const NEGOTIATION_GAIN = 4;

export function negotiable(base: Expectation): { expectation: Expectation; trustDelta: number }[] {
  const index = EXPECTATION_ORDER.indexOf(base);
  const out: { expectation: Expectation; trustDelta: number }[] = [
    { expectation: base, trustDelta: 0 },
  ];
  if (index > 0) {
    out.unshift({ expectation: EXPECTATION_ORDER[index - 1], trustDelta: NEGOTIATION_COST });
  }
  if (index < EXPECTATION_ORDER.length - 1) {
    out.push({ expectation: EXPECTATION_ORDER[index + 1], trustDelta: NEGOTIATION_GAIN });
  }
  return out;
}

export interface ReviewInput {
  expectation: Expectation;
  wins: number;
  games: number;
  madePlayoffs: boolean;
  wonTitle: boolean;
  homegrownRegulars: number;
  net: number;
  heat: number;
}

export interface Review {
  met: boolean;
  trustDelta: number;
  bonus: number;
  note: string;
}

export function review(input: ReviewInput): Review {
  const info = EXPECTATIONS[input.expectation];
  let met: boolean;
  switch (input.expectation) {
    case 'rebuild':
      met = input.homegrownRegulars >= 3;
      break;
    case 'hold':
      met = input.wins / input.games >= 0.5;
      break;
    case 'playoffs':
      met = input.madePlayoffs;
      break;
    default:
      met = input.wonTitle;
      break;
  }

  // Money and the mood in the stands move the needle on their own, whatever
  // the mandate was.
  const financial = input.net >= 0 ? 4 : -6;
  // The floor on fan heat is 12, so a threshold of 30 meant a struggling club
  // took this penalty every single year with no way to escape it.
  const publicMood = input.heat >= 70 ? 3 : input.heat <= 20 ? -4 : 0;

  return {
    met,
    trustDelta: (met ? info.reward : info.penalty) + financial + publicMood,
    bonus: met ? info.bonus : 0,
    note: met ? `董事會認可：${info.demand}` : `未達成董事會期望：${info.demand}`,
  };
}

export function applyTrust(state: GameState, delta: number): void {
  state.board.trust = clamp(Math.round(state.board.trust + delta), 0, 100);
  state.board.dangerYears =
    state.board.trust < TRUST_DANGER ? state.board.dangerYears + 1 : 0;
}

export function shouldFire(state: GameState): boolean {
  return state.board.dangerYears >= 2;
}
