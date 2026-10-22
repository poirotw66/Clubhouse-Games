/**
 * Series match: first player to N game wins takes the series.
 */

import {
  applyWinSeriesResult,
  createWinSeries,
  type WinSeriesState,
} from '@clubhouse/shared/MatchSession';
import {
  DEFAULT_SERIES_TARGET,
  SERIES_TARGETS,
  type PieceColor,
  type SeriesTarget,
} from './types';

export { DEFAULT_SERIES_TARGET, SERIES_TARGETS };
export type { SeriesTarget };

export interface SeriesState {
  target: SeriesTarget;
  /** Index 0 = red / human when vs bot; 1 = yellow / bot. */
  scores: [number, number];
  gamesPlayed: number;
  seriesOver: boolean;
  seriesWinner: PieceColor | null;
}

function toPublic(state: WinSeriesState, target: SeriesTarget): SeriesState {
  return {
    target,
    scores: [state.scores[0], state.scores[1]],
    gamesPlayed: state.gameIndex,
    seriesOver: state.over,
    seriesWinner:
      state.winner === 0 ? 'red' : state.winner === 1 ? 'yellow' : null,
  };
}

function toShared(series: SeriesState): WinSeriesState {
  return {
    kind: 'firstTo',
    winsNeeded: series.target,
    length: null,
    scores: [series.scores[0], series.scores[1]],
    draws: 0,
    gameIndex: series.gamesPlayed,
    over: series.seriesOver,
    winner:
      series.seriesWinner === 'red' ? 0 : series.seriesWinner === 'yellow' ? 1 : null,
  };
}

export function createSeriesState(target: SeriesTarget = DEFAULT_SERIES_TARGET): SeriesState {
  return toPublic(createWinSeries({ kind: 'firstTo', value: target }), target);
}

export function seatForColor(color: PieceColor): 0 | 1 {
  return color === 'red' ? 0 : 1;
}

export function applyGameToSeries(
  series: SeriesState,
  winner: PieceColor | 'draw',
): SeriesState {
  const side = winner === 'draw' ? 'draw' : seatForColor(winner);
  return toPublic(
    applyWinSeriesResult(toShared(series), side, { settleOnExhaust: false }),
    series.target,
  );
}

export function seriesProgressLabel(series: SeriesState): string {
  if (series.seriesOver && series.seriesWinner) {
    return series.seriesWinner === 'red'
      ? `系列賽結束 · 紅方先取 ${series.target} 勝`
      : `系列賽結束 · 黃方先取 ${series.target} 勝`;
  }
  return `系列賽 ${series.scores[0]}–${series.scores[1]}（先取 ${series.target} 勝）`;
}

export function isValidSeriesTarget(value: unknown): value is SeriesTarget {
  return typeof value === 'number' && (SERIES_TARGETS as number[]).includes(value);
}
