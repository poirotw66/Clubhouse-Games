/**
 * Post-game review: compare player moves against hard / exact recommendations.
 */

import {
  CORNERS,
  X_SQUARES,
  applyMove,
  getLegalMoves,
  scoreMoves,
  type Board,
  type Piece,
} from './reversiLogic';

export interface PlacedMove {
  boardBefore: Board;
  side: Piece;
  move: [number, number];
  /** True when this was the human player's move. */
  byPlayer: boolean;
}

export interface ReviewMistake {
  ply: number;
  move: [number, number];
  best: [number, number];
  reason: string;
  severity: 'mild' | 'blunder';
}

export interface GameReview {
  mistakes: ReviewMistake[];
  summary: string;
  lessons: Array<{ title: string; detail: string }>;
}

function sameMove(a: [number, number], b: [number, number]): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function isCorner(m: [number, number]): boolean {
  return CORNERS.some(([r, c]) => r === m[0] && c === m[1]);
}

function isDangerousX(board: Board, m: [number, number]): boolean {
  for (const [r, c] of X_SQUARES) {
    if (r !== m[0] || c !== m[1]) continue;
    const corner: [number, number] =
      r === 1 && c === 1
        ? [0, 0]
        : r === 1 && c === 6
          ? [0, 7]
          : r === 6 && c === 1
            ? [7, 0]
            : [7, 7];
    return board[corner[0]][corner[1]] === null;
  }
  return false;
}

function cellLabel(m: [number, number]): string {
  const file = 'abcdefgh'[m[1]];
  return `${file}${m[0] + 1}`;
}

/**
 * Analyze player moves. Caps mistakes so the overlay stays readable.
 */
export function buildGameReview(history: PlacedMove[]): GameReview {
  const mistakes: ReviewMistake[] = [];
  const lessons: Array<{ title: string; detail: string }> = [];
  let ply = 0;

  for (const entry of history) {
    if (!entry.byPlayer) continue;
    ply += 1;
    const legal = getLegalMoves(entry.boardBefore, entry.side);
    if (legal.length <= 1) continue;

    const scored = scoreMoves(entry.boardBefore, entry.side, 'hard');
    if (scored.length === 0) continue;
    const bestScore = scored[0].score;
    const best = scored[0].move;
    const played = scored.find((s) => sameMove(s.move, entry.move));
    const playedScore = played?.score ?? -Infinity;
    // Rough: heuristic scores differ a lot; treat large gaps as blunders.
    const gap = bestScore - playedScore;
    if (sameMove(entry.move, best) || gap < 30) {
      // Still flag giving away a free corner or playing X when best was elsewhere.
      if (isDangerousX(entry.boardBefore, entry.move) && !isDangerousX(entry.boardBefore, best)) {
        mistakes.push({
          ply,
          move: entry.move,
          best,
          reason: `在 ${cellLabel(entry.move)} 踩了危險 X 格；較好是 ${cellLabel(best)}。`,
          severity: 'blunder',
        });
      }
      continue;
    }

    let reason = `第 ${ply} 手 ${cellLabel(entry.move)} 偏離建議 ${cellLabel(best)}。`;
    let severity: 'mild' | 'blunder' = gap >= 80 ? 'blunder' : 'mild';

    if (isCorner(best) && !isCorner(entry.move)) {
      reason = `錯過角地 ${cellLabel(best)}，改下了 ${cellLabel(entry.move)}。`;
      severity = 'blunder';
    } else if (isDangerousX(entry.boardBefore, entry.move)) {
      reason = `危險 X 格 ${cellLabel(entry.move)} 可能送角；建議 ${cellLabel(best)}。`;
      severity = 'blunder';
    }

    mistakes.push({ ply, move: entry.move, best, reason, severity });
    if (mistakes.length >= 5) break;
  }

  if (mistakes.some((m) => m.reason.includes('角'))) {
    lessons.push({
      title: '角地意識',
      detail: '能取角時優先取角；對手威脅角時要想辦法封鎖。',
    });
  }
  if (mistakes.some((m) => m.reason.includes('X 格'))) {
    lessons.push({
      title: '避開 X 格',
      detail: '角還空著時，斜對角的 X 格常常是送分題。',
    });
  }
  if (mistakes.some((m) => m.severity === 'mild')) {
    lessons.push({
      title: '機動與勝差',
      detail: '中盤少翻子、多留選擇；殘局再拚子數與奇偶。',
    });
  }
  if (lessons.length === 0) {
    lessons.push({
      title: '表現穩健',
      detail: '這局沒有明顯大錯。可以挑戰更高階對手或殘局謎題。',
    });
  }

  const blunders = mistakes.filter((m) => m.severity === 'blunder').length;
  const summary =
    mistakes.length === 0
      ? '沒有抓到明顯失誤。'
      : `標記 ${mistakes.length} 處偏離建議${blunders ? `（含 ${blunders} 處嚴重）` : ''}。`;

  return { mistakes, summary, lessons: lessons.slice(0, 3) };
}

/** Record a move onto a review log (copies the board). */
export function appendReviewMove(
  log: PlacedMove[],
  boardBefore: Board,
  side: Piece,
  move: [number, number],
  byPlayer: boolean,
): PlacedMove[] {
  return [
    ...log,
    {
      boardBefore: boardBefore.map((row) => [...row]),
      side,
      move,
      byPlayer,
    },
  ];
}

export function applyLoggedMove(entry: PlacedMove): Board {
  return applyMove(entry.boardBefore, entry.move[0], entry.move[1], entry.side);
}
