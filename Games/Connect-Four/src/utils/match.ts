/**
 * Series match: first player to N game wins takes the series.
 */

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

export function createSeriesState(target: SeriesTarget = DEFAULT_SERIES_TARGET): SeriesState {
  return {
    target,
    scores: [0, 0],
    gamesPlayed: 0,
    seriesOver: false,
    seriesWinner: null,
  };
}

export function seatForColor(color: PieceColor): 0 | 1 {
  return color === 'red' ? 0 : 1;
}

export function applyGameToSeries(
  series: SeriesState,
  winner: PieceColor | 'draw',
): SeriesState {
  if (series.seriesOver) return series;
  const scores: [number, number] = [...series.scores];
  let seriesWinner: PieceColor | null = null;
  let seriesOver = false;

  if (winner !== 'draw') {
    const seat = seatForColor(winner);
    scores[seat] += 1;
    if (scores[seat] >= series.target) {
      seriesOver = true;
      seriesWinner = winner;
    }
  }

  return {
    target: series.target,
    scores,
    gamesPlayed: series.gamesPlayed + 1,
    seriesOver,
    seriesWinner,
  };
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
