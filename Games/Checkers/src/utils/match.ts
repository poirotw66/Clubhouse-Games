/**
 * Series match: first to N game wins (best-of style).
 */

import {
  applyWinSeriesResult,
  createWinSeries,
  firstToLabel,
  type WinSeriesState,
} from '@clubhouse/shared/MatchSession';

export type MatchLength = 2 | 3 | 4;

export const MATCH_LENGTHS: MatchLength[] = [2, 3, 4];

export const MATCH_LENGTH_LABELS: Record<MatchLength, string> = {
  2: firstToLabel(2),
  3: firstToLabel(3),
  4: firstToLabel(4),
};

export type MatchState = {
  target: MatchLength;
  /** Games won by human (bot mode) / black (two-player). */
  scoreA: number;
  /** Games won by CPU / white. */
  scoreB: number;
  gameIndex: number;
  matchOver: boolean;
  /** 'a' = human/black, 'b' = cpu/white */
  matchWinner: 'a' | 'b' | null;
};

function toPublic(state: WinSeriesState, target: MatchLength): MatchState {
  return {
    target,
    scoreA: state.scores[0],
    scoreB: state.scores[1],
    gameIndex: state.gameIndex,
    matchOver: state.over,
    matchWinner: state.winner === 0 ? 'a' : state.winner === 1 ? 'b' : null,
  };
}

function toShared(match: MatchState): WinSeriesState {
  return {
    kind: 'firstTo',
    winsNeeded: match.target,
    length: null,
    scores: [match.scoreA, match.scoreB],
    draws: 0,
    gameIndex: match.gameIndex,
    over: match.matchOver,
    winner: match.matchWinner === 'a' ? 0 : match.matchWinner === 'b' ? 1 : null,
  };
}

export function createMatch(target: MatchLength = 2): MatchState {
  return toPublic(
    createWinSeries({ kind: 'firstTo', value: target, gameIndexStart: 1 }),
    target,
  );
}

export function applyGameResult(
  match: MatchState,
  winner: 'a' | 'b' | 'draw',
): MatchState {
  const side = winner === 'a' ? 0 : winner === 'b' ? 1 : 'draw';
  return toPublic(
    applyWinSeriesResult(toShared(match), side, {
      gameIndexMode: 'untilOver',
      settleOnExhaust: false,
    }),
    match.target,
  );
}
