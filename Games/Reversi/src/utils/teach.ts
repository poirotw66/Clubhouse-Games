/**
 * Opening / midgame teaching hints: corners, mobility, parity.
 */

import {
  CORNERS,
  X_SQUARES,
  countEmpties,
  getLegalMoves,
  type Board,
  type Piece,
} from './reversiLogic';

export interface TeachHint {
  id: string;
  title: string;
  detail: string;
  /** Board cells to highlight, if any. */
  cells?: [number, number][];
}

function hasCornerMove(board: Board, side: Piece): [number, number] | null {
  const legal = getLegalMoves(board, side);
  for (const [r, c] of CORNERS) {
    if (legal.some(([lr, lc]) => lr === r && lc === c)) return [r, c];
  }
  return null;
}

function hasXSquareMove(board: Board, side: Piece): [number, number] | null {
  const legal = getLegalMoves(board, side);
  for (const [r, c] of X_SQUARES) {
    const corner: [number, number] =
      r === 1 && c === 1
        ? [0, 0]
        : r === 1 && c === 6
          ? [0, 7]
          : r === 6 && c === 1
            ? [7, 0]
            : [7, 7];
    if (board[corner[0]][corner[1]] !== null) continue;
    if (legal.some(([lr, lc]) => lr === r && lc === c)) return [r, c];
  }
  return null;
}

/**
 * Pick at most one contextual tip for the current position.
 * Priority: free corner > avoid X-square > low mobility > parity endgame.
 */
export function teachingHint(board: Board, side: Piece): TeachHint | null {
  const legal = getLegalMoves(board, side);
  if (legal.length === 0) {
    return {
      id: 'pass',
      title: '無合法手',
      detail: '必須 Pass。被逼 Pass 通常代表機動權落在對手手上。',
    };
  }

  const corner = hasCornerMove(board, side);
  if (corner) {
    return {
      id: 'corner',
      title: '角地可取',
      detail: '角不會被翻轉。能安全佔角時，優先考慮角。',
      cells: [corner],
    };
  }

  const xMove = hasXSquareMove(board, side);
  if (xMove) {
    return {
      id: 'x-square',
      title: '小心 X 格',
      detail: '角旁斜對角的格子（X 格）常會把角拱手讓人，除非角已是你的。',
      cells: [xMove],
    };
  }

  const empties = countEmpties(board);
  const oppLegal = getLegalMoves(
    board,
    side === 'black' ? 'white' : 'black',
  ).length;

  if (empties <= 12) {
    return {
      id: 'parity',
      title: '殘局奇偶',
      detail: `還剩 ${empties} 空格。數一數各區域空格是奇是偶——奇數區的最後一手通常更有價值。`,
    };
  }

  if (legal.length <= 2 && oppLegal >= 4) {
    return {
      id: 'mobility',
      title: '機動告急',
      detail: `你只有 ${legal.length} 手下，對手有 ${oppLegal}。優先下能減少對手選擇、或拉開自己出路的手。`,
      cells: legal.slice(0, 2),
    };
  }

  if (empties >= 50) {
    return {
      id: 'opening',
      title: '開局原則',
      detail: '開局少翻子、多佔中央與穩邊；過早搶邊角旁格，容易被對手借力。',
    };
  }

  return null;
}

/** Static strategy primer shown on the menu / rules panel. */
export const STRATEGY_PRIMER: TeachHint[] = [
  {
    id: 'primer-corner',
    title: '角地',
    detail: '四角永遠安全。對局中後期，搶角往往比多翻幾子更重要。',
  },
  {
    id: 'primer-mobility',
    title: '機動',
    detail: '可下點數比當下子數更能預測中盤優勢。逼對手 Pass 是強勢訊號。',
  },
  {
    id: 'primer-parity',
    title: '奇偶',
    detail: '殘局把盤面切成幾個空格區，奇數區的最後一手常能吃下整條邊。',
  },
];
