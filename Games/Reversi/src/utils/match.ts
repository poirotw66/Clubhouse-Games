/** Best-of series match state for vs-bot / ladder games. */

import {
  applyWinSeriesResult,
  bestOfLabel,
  createWinSeries,
  winSeriesScoreLine as sharedScoreLine,
  type WinSeriesState,
} from '@clubhouse/shared/MatchSession';

export type SeriesLength = 1 | 3 | 5;

export const SERIES_OPTIONS: SeriesLength[] = [1, 3, 5];

export interface SeriesMatch {
  /** Games needed to win the series (1, 2, or 3). */
  winsNeeded: number;
  /** Total games in the series (1, 3, or 5). */
  length: SeriesLength;
  playerWins: number;
  cpuWins: number;
  draws: number;
  gameIndex: number;
  over: boolean;
  winner: 'player' | 'cpu' | null;
}

function toPublic(state: WinSeriesState): SeriesMatch {
  return {
    winsNeeded: state.winsNeeded as 1 | 2 | 3,
    length: (state.length ?? 1) as SeriesLength,
    playerWins: state.scores[0],
    cpuWins: state.scores[1],
    draws: state.draws,
    gameIndex: state.gameIndex,
    over: state.over,
    winner: state.winner === 0 ? 'player' : state.winner === 1 ? 'cpu' : null,
  };
}

function toShared(match: SeriesMatch): WinSeriesState {
  return {
    kind: 'bestOf',
    winsNeeded: match.winsNeeded,
    length: match.length,
    scores: [match.playerWins, match.cpuWins],
    draws: match.draws,
    gameIndex: match.gameIndex,
    over: match.over,
    winner: match.winner === 'player' ? 0 : match.winner === 'cpu' ? 1 : null,
  };
}

export function createSeries(length: SeriesLength): SeriesMatch {
  return toPublic(createWinSeries({ kind: 'bestOf', value: length }));
}

export function seriesLabel(length: SeriesLength): string {
  return bestOfLabel(length);
}

export function applySeriesResult(
  match: SeriesMatch,
  result: 'player' | 'cpu' | 'draw',
): SeriesMatch {
  const side = result === 'player' ? 0 : result === 'cpu' ? 1 : 'draw';
  return toPublic(applyWinSeriesResult(toShared(match), side));
}

export function seriesScoreLine(match: SeriesMatch): string {
  return sharedScoreLine(toShared(match), { includeDraws: true });
}
