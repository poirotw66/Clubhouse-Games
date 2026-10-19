/**
 * Series match: first to N game wins (best-of style).
 */

export type MatchLength = 2 | 3 | 4;

export const MATCH_LENGTHS: MatchLength[] = [2, 3, 4];

export const MATCH_LENGTH_LABELS: Record<MatchLength, string> = {
  2: '兩勝制',
  3: '三勝制',
  4: '四勝制',
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

export function createMatch(target: MatchLength = 2): MatchState {
  return {
    target,
    scoreA: 0,
    scoreB: 0,
    gameIndex: 1,
    matchOver: false,
    matchWinner: null,
  };
}

export function applyGameResult(
  match: MatchState,
  winner: 'a' | 'b' | 'draw',
): MatchState {
  if (match.matchOver) return match;
  let { scoreA, scoreB } = match;
  if (winner === 'a') scoreA += 1;
  else if (winner === 'b') scoreB += 1;

  const matchWinner =
    scoreA >= match.target ? 'a' : scoreB >= match.target ? 'b' : null;

  return {
    ...match,
    scoreA,
    scoreB,
    gameIndex: match.gameIndex + (matchWinner ? 0 : 1),
    matchOver: matchWinner !== null,
    matchWinner,
  };
}
