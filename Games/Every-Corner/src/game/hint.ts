import type { CellId, Hint, HintKind, Puzzle } from './types';

export interface Analysis {
  /** How many of the drawn cells match the canonical answer from the start. */
  correctLength: number;
  /** 1-based step at which the player first went wrong, or null if still on track. */
  firstWrongStep: number | null;
}

export function analyse(puzzle: Puzzle, path: CellId[]): Analysis {
  let correct = 0;
  while (
    correct < path.length &&
    correct < puzzle.solution.length &&
    path[correct] === puzzle.solution[correct]
  ) {
    correct += 1;
  }
  return {
    correctLength: correct,
    firstWrongStep: path.length > correct ? correct + 1 : null,
  };
}

/**
 * Hints escalate rather than jumping straight to the answer. The first one
 * names the mistake without fixing it, which is usually all a stuck player
 * needs — the board has been wrong for ten moves and they are staring at the
 * wrong end of it.
 */
export function computeHint(puzzle: Puzzle, path: CellId[], kind: HintKind): Hint {
  const { correctLength, firstWrongStep } = analyse(puzzle, path);

  if (kind === 'locate') {
    return {
      kind,
      message:
        firstWrongStep === null
          ? '目前為止都是對的。問題在於接下來要往哪走。'
          : `你的路線從第 ${firstWrongStep} 步開始就偏掉了，後面都是白走的。`,
      keepLength: path.length,
      nextCell: null,
    };
  }

  if (kind === 'rewind') {
    return {
      kind,
      message:
        firstWrongStep === null
          ? '路線沒有錯，維持原樣。'
          : `已經退回第 ${correctLength} 步，也就是最後一個正確的位置。`,
      keepLength: correctLength,
      nextCell: null,
    };
  }

  const nextCell = puzzle.solution[correctLength] ?? null;
  return {
    kind,
    message: nextCell === null ? '這一題已經走完了。' : '下一格已經標出來了。',
    keepLength: correctLength,
    nextCell,
  };
}

/** The order hints are offered in, cheapest first. */
export const HINT_SEQUENCE: HintKind[] = ['locate', 'rewind', 'reveal'];
