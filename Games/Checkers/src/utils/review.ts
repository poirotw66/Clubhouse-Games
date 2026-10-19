/**
 * Post-game review: annotate each ply with simple quality labels.
 */

import {
  applyMove,
  captureHopCount,
  getLegalMoves,
  isCaptureMove,
  type Board,
  type Move,
  type PieceColor,
  type RulesetId,
} from './checkersLogic';
import { explainMove } from './hints';

export type ReviewTag = 'best' | 'good' | 'miss' | 'blunder' | 'ok';

export type ReviewEntry = {
  ply: number;
  color: PieceColor;
  move: Move;
  tag: ReviewTag;
  note: string;
};

export type PlayedPly = {
  color: PieceColor;
  move: Move;
  boardBefore: Board;
};

function maxCaptureLen(moves: Move[]): number {
  let max = 0;
  for (const m of moves) {
    if (isCaptureMove(m)) max = Math.max(max, captureHopCount(m));
  }
  return max;
}

function tagMove(
  board: Board,
  move: Move,
  color: PieceColor,
  ruleset: RulesetId,
): { tag: ReviewTag; note: string } {
  const legal = getLegalMoves(board, color, ruleset);
  const reason = explainMove(board, move, color, ruleset);

  if (isCaptureMove(move)) {
    const maxCap = maxCaptureLen(legal);
    const got = captureHopCount(move);
    if (got < maxCap) {
      return { tag: 'miss', note: `可連跳 ${maxCap} 子，只跳了 ${got}` };
    }
    if (got >= 2) return { tag: 'best', note: reason };
    return { tag: 'good', note: reason };
  }

  // Quiet move while a capture existed (should be impossible under forced capture).
  if (legal.some((m) => isCaptureMove(m))) {
    return { tag: 'blunder', note: '應吃未吃' };
  }

  // Walk into an immediate capture that was avoidable.
  const next = applyMove(board, move, ruleset);
  const opp = color === 'black' ? 'white' : 'black';
  const replies = getLegalMoves(next, opp, ruleset);
  const hung = replies.filter((m) => isCaptureMove(m));
  if (hung.length > 0) {
    const safer = legal.filter((m) => {
      if (m === move) return false;
      const n = applyMove(board, m, ruleset);
      return !getLegalMoves(n, opp, ruleset).some((r) => isCaptureMove(r));
    });
    if (safer.length > 0) {
      return { tag: 'blunder', note: '走進對方跳吃' };
    }
  }

  return { tag: 'ok', note: reason };
}

export function buildReview(plies: PlayedPly[], ruleset: RulesetId): ReviewEntry[] {
  return plies.map((ply, i) => {
    const { tag, note } = tagMove(ply.boardBefore, ply.move, ply.color, ruleset);
    return {
      ply: i + 1,
      color: ply.color,
      move: ply.move,
      tag,
      note,
    };
  });
}

export const REVIEW_TAG_LABELS: Record<ReviewTag, string> = {
  best: '佳手',
  good: '好棋',
  miss: '漏招',
  blunder: '失誤',
  ok: '普通',
};
