/** Best-of series match state for vs-bot / ladder games. */

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

export function createSeries(length: SeriesLength): SeriesMatch {
  const winsNeeded = Math.ceil(length / 2) as 1 | 2 | 3;
  return {
    winsNeeded,
    length,
    playerWins: 0,
    cpuWins: 0,
    draws: 0,
    gameIndex: 0,
    over: false,
    winner: null,
  };
}

export function seriesLabel(length: SeriesLength): string {
  if (length === 1) return '單局';
  if (length === 3) return '三戰兩勝';
  return '五戰三勝';
}

export function applySeriesResult(
  match: SeriesMatch,
  result: 'player' | 'cpu' | 'draw',
): SeriesMatch {
  if (match.over) return match;
  const next: SeriesMatch = {
    ...match,
    gameIndex: match.gameIndex + 1,
    playerWins: match.playerWins + (result === 'player' ? 1 : 0),
    cpuWins: match.cpuWins + (result === 'cpu' ? 1 : 0),
    draws: match.draws + (result === 'draw' ? 1 : 0),
  };

  if (next.playerWins >= match.winsNeeded) {
    return { ...next, over: true, winner: 'player' };
  }
  if (next.cpuWins >= match.winsNeeded) {
    return { ...next, over: true, winner: 'cpu' };
  }
  // Exhausted all games without either reaching winsNeeded (draw-heavy series).
  if (next.gameIndex >= match.length) {
    if (next.playerWins > next.cpuWins) return { ...next, over: true, winner: 'player' };
    if (next.cpuWins > next.playerWins) return { ...next, over: true, winner: 'cpu' };
    return { ...next, over: true, winner: null };
  }
  return next;
}

export function seriesScoreLine(match: SeriesMatch): string {
  return `${match.playerWins} — ${match.cpuWins}` + (match.draws ? `（和 ${match.draws}）` : '');
}
