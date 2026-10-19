/**
 * Hint move plus a short Traditional Chinese reason.
 */

import {
  applyMove,
  captureHopCount,
  getLegalMoves,
  isCaptureMove,
  pickBotMove,
  type Board,
  type Move,
  type PieceColor,
  type RulesetId,
} from './checkersLogic';

export type HintResult = {
  move: Move;
  reason: string;
};

function opponent(color: PieceColor): PieceColor {
  return color === 'black' ? 'white' : 'black';
}

function moveWouldPromote(board: Board, move: Move, color: PieceColor): boolean {
  const piece = board[move.from[0]][move.from[1]];
  if (!piece || piece.king) return false;
  const [lastR] = move.path[move.path.length - 1];
  const size = board.length;
  return (color === 'black' && lastR === 0) || (color === 'white' && lastR === size - 1);
}

function leavesOpponentCapture(
  board: Board,
  move: Move,
  color: PieceColor,
  ruleset: RulesetId,
): boolean {
  const next = applyMove(board, move, ruleset);
  const replies = getLegalMoves(next, opponent(color), ruleset);
  return replies.some((m) => isCaptureMove(m));
}

export function explainMove(
  board: Board,
  move: Move,
  color: PieceColor,
  ruleset: RulesetId,
): string {
  const hops = captureHopCount(move);
  if (hops >= 2) return `連跳 ${hops} 子，清場最快`;
  if (hops === 1) {
    if (moveWouldPromote(board, move, color)) return '跳吃並升王';
    return '強制吃子，必須跳';
  }
  if (moveWouldPromote(board, move, color)) return '前進升王，強化火力';
  if (!leavesOpponentCapture(board, move, color, ruleset)) {
    return '避開被跳，穩健推進';
  }
  const [fr, fc] = move.from;
  const [tr, tc] = move.path[move.path.length - 1];
  const towardCenter =
    Math.abs(tr - (board.length - 1) / 2) + Math.abs(tc - (board.length - 1) / 2) <
    Math.abs(fr - (board.length - 1) / 2) + Math.abs(fc - (board.length - 1) / 2);
  if (towardCenter) return '進佔中路，限制對手';
  return '保持機動，等待機會';
}

export function getHint(
  board: Board,
  color: PieceColor,
  continuationFrom: [number, number] | null,
  ruleset: RulesetId,
): HintResult | null {
  const move = pickBotMove(board, color, continuationFrom, 'hard', ruleset);
  if (!move) return null;
  return { move, reason: explainMove(board, move, color, ruleset) };
}
