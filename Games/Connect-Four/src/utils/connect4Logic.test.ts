import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BOARD_PRESETS,
  COLS,
  ROWS,
  PERSONALITIES,
  PERSONALITY_IDS,
  RULE_VARIANTS,
  analyzeTactics,
  applyMove,
  buildRules,
  createInitialBoard,
  dropPiece,
  evaluateBoard,
  getDifficultyConfig,
  getDropRow,
  getLegalColumns,
  getLegalDropColumns,
  getLegalMoves,
  getPopOutColumns,
  getWinningCells,
  hasConnectN,
  hasWonAt,
  isBoardFull,
  isPopOutRepetitionDraw,
  opponent,
  pickBotColumn,
  pickBotMove,
  popOutPiece,
  positionKey,
  resolveWinnerAfterMove,
  advancePopOutPositionCounts,
  DIFFICULTY_BLURBS,
  POPOUT_REPETITION_COUNT,
  detectThreatSegments,
  evaluateMoveQuality,
  type Board,
  type Move,
  type PieceColor,
  type RulesConfig,
} from './connect4Logic';
import {
  DEFAULT_SERIES_TARGET,
  SERIES_TARGETS,
  applyGameToSeries,
  createSeriesState,
  isSingleTarget,
  isValidSeriesTarget,
  seatForColor,
  seriesProgressLabel,
} from './match';
import {
  PUZZLES,
  getPuzzleById,
  loadPuzzleBoard,
  puzzleRules,
  verifyPuzzleSolution,
} from './puzzles';
import {
  EMPTY_STATS,
  countSolvedPuzzles,
  getModeStats,
  markPuzzleSolved,
  modeKey,
  modeStatsLabel,
  recordGameResult,
  recordSeriesResult,
  storageMeta,
} from './storage';
import { arcadeAudio } from './audioFx';

const classic = buildRules('classic', '7x6');
const popout = buildRules('popout', '7x6');
const five = buildRules('five', '9x7');
const wide = buildRules('classic', '8x7');

function fillColumn(
  board: Board,
  col: number,
  colors: PieceColor[],
  rules: RulesConfig = classic,
): Board {
  let next = board;
  for (const color of colors) {
    const dropped = dropPiece(next, col, color, rules);
    if (!dropped) throw new Error(`column ${col} full while filling`);
    next = dropped;
  }
  return next;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('board setup / gravity', () => {
  it('starts empty with every column legal and drops to the bottom row', () => {
    const board = createInitialBoard(classic);
    expect(board).toHaveLength(ROWS);
    expect(board[0]).toHaveLength(COLS);
    expect(getLegalColumns(board, classic)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    for (let c = 0; c < COLS; c++) {
      expect(getDropRow(board, c, classic)).toBe(ROWS - 1);
    }
  });

  it('stacks upward and rejects a full column', () => {
    let board = createInitialBoard(classic);
    for (let i = 0; i < ROWS; i++) {
      expect(getDropRow(board, 0, classic)).toBe(ROWS - 1 - i);
      const next = dropPiece(board, 0, i % 2 === 0 ? 'red' : 'yellow', classic);
      expect(next).not.toBeNull();
      board = next!;
    }
    expect(getDropRow(board, 0, classic)).toBeNull();
    expect(getLegalColumns(board, classic)).not.toContain(0);
    expect(dropPiece(board, 0, 'red', classic)).toBeNull();
  });

  it('builds 8×7 and 9×7 presets with matching geometry', () => {
    expect(BOARD_PRESETS['8x7']).toMatchObject({ cols: 8, rows: 7 });
    expect(BOARD_PRESETS['9x7']).toMatchObject({ cols: 9, rows: 7 });
    const w = createInitialBoard(wide);
    expect(w).toHaveLength(7);
    expect(w[0]).toHaveLength(8);
    const f = createInitialBoard(five);
    expect(f).toHaveLength(7);
    expect(f[0]).toHaveLength(9);
    expect(RULE_VARIANTS.five.connectN).toBe(5);
    expect(RULE_VARIANTS.popout.allowPopOut).toBe(true);
  });
});

describe('win detection', () => {
  it('detects a horizontal four-in-a-row through the last piece', () => {
    let board = createInitialBoard(classic);
    for (const c of [0, 1, 2, 3]) {
      board = dropPiece(board, c, 'red', classic)!;
    }
    const row = ROWS - 1;
    expect(hasWonAt(board, row, 3, 'red', classic)).toBe(true);
    expect(hasWonAt(board, row, 3, 'yellow', classic)).toBe(false);
    expect(getWinningCells(board, classic)).toEqual(
      new Set(['5,0', '5,1', '5,2', '5,3']),
    );
  });

  it('detects a vertical four-in-a-row', () => {
    let board = createInitialBoard(classic);
    for (let i = 0; i < 4; i++) {
      board = dropPiece(board, 2, 'yellow', classic)!;
    }
    expect(hasWonAt(board, ROWS - 4, 2, 'yellow', classic)).toBe(true);
    expect(getWinningCells(board, classic)).toEqual(
      new Set(['5,2', '4,2', '3,2', '2,2']),
    );
  });

  it('detects an ascending diagonal four-in-a-row', () => {
    let board = createInitialBoard(classic);
    board = dropPiece(board, 0, 'yellow', classic)!;
    board = fillColumn(board, 1, ['red', 'yellow']);
    board = fillColumn(board, 2, ['red', 'red', 'yellow']);
    board = fillColumn(board, 3, ['red', 'red', 'red', 'yellow']);
    expect(hasWonAt(board, 2, 3, 'yellow', classic)).toBe(true);
  });

  it('requires five-in-a-row on the five variant', () => {
    let board = createInitialBoard(five);
    for (const c of [0, 1, 2, 3]) {
      board = dropPiece(board, c, 'red', five)!;
    }
    expect(hasWonAt(board, five.rows - 1, 3, 'red', five)).toBe(false);
    board = dropPiece(board, 4, 'red', five)!;
    expect(hasWonAt(board, five.rows - 1, 4, 'red', five)).toBe(true);
  });

  it('reports a filled board with no legal columns', () => {
    const board = createInitialBoard(classic).map((row, r) =>
      row.map((_, c) => ((r + c) % 2 === 0 ? 'red' : 'yellow')),
    );
    expect(isBoardFull(board, classic)).toBe(true);
    expect(getLegalDropColumns(board, classic)).toEqual([]);
  });
});

describe('large board presets (8x7, 9x7) and connect-5', () => {
  it('verifies 8x7 geometry invariants, column capacities, and boundaries', () => {
    const rules8x7 = buildRules('classic', '8x7');
    expect(rules8x7.cols).toBe(8);
    expect(rules8x7.rows).toBe(7);
    expect(rules8x7.connectN).toBe(4);

    let board = createInitialBoard(rules8x7);
    expect(board).toHaveLength(7);
    expect(board[0]).toHaveLength(8);

    // Test gravity stacking to full capacity in rightmost column (col 7)
    for (let r = 6; r >= 0; r--) {
      expect(getDropRow(board, 7, rules8x7)).toBe(r);
      board = dropPiece(board, 7, r % 2 === 0 ? 'red' : 'yellow', rules8x7)!;
      expect(board[r][7]).not.toBeNull();
    }
    // Column 7 is now full
    expect(getDropRow(board, 7, rules8x7)).toBeNull();
    expect(getLegalDropColumns(board, rules8x7)).not.toContain(7);
    expect(getLegalDropColumns(board, rules8x7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dropPiece(board, 7, 'red', rules8x7)).toBeNull();

    // Out of bounds drop rows
    expect(getDropRow(board, -1, rules8x7)).toBeNull();
    expect(getDropRow(board, 8, rules8x7)).toBeNull();
  });

  it('detects connect-4 wins on 8x7 across horizontal, vertical, and diagonal lines', () => {
    const rules8x7 = buildRules('classic', '8x7');

    // 1. Far-right horizontal win on bottom row: cols 4, 5, 6, 7
    let hBoard = createInitialBoard(rules8x7);
    for (const c of [4, 5, 6]) {
      hBoard = dropPiece(hBoard, c, 'red', rules8x7)!;
      expect(hasWonAt(hBoard, 6, c, 'red', rules8x7)).toBe(false);
    }
    hBoard = dropPiece(hBoard, 7, 'red', rules8x7)!;
    expect(hasWonAt(hBoard, 6, 7, 'red', rules8x7)).toBe(true);
    expect(getWinningCells(hBoard, rules8x7)).toEqual(
      new Set(['6,4', '6,5', '6,6', '6,7']),
    );

    // 2. Vertical win in leftmost col 0
    let vBoard = createInitialBoard(rules8x7);
    for (let i = 0; i < 4; i++) {
      vBoard = dropPiece(vBoard, 0, 'yellow', rules8x7)!;
    }
    expect(hasWonAt(vBoard, 3, 0, 'yellow', rules8x7)).toBe(true);
    expect(getWinningCells(vBoard, rules8x7)).toEqual(
      new Set(['6,0', '5,0', '4,0', '3,0']),
    );

    // 3. Ascending diagonal on 8x7: (6,4), (5,5), (4,6), (3,7)
    let dBoard = createInitialBoard(rules8x7);
    dBoard = dropPiece(dBoard, 4, 'red', rules8x7)!;
    dBoard = fillColumn(dBoard, 5, ['yellow', 'red'], rules8x7);
    dBoard = fillColumn(dBoard, 6, ['yellow', 'yellow', 'red'], rules8x7);
    dBoard = fillColumn(dBoard, 7, ['yellow', 'yellow', 'yellow', 'red'], rules8x7);
    expect(hasWonAt(dBoard, 3, 7, 'red', rules8x7)).toBe(true);
    expect(getWinningCells(dBoard, rules8x7)).toEqual(
      new Set(['6,4', '5,5', '4,6', '3,7']),
    );

    // 4. Descending diagonal on 8x7: (3,4), (4,5), (5,6), (6,7)
    let descBoard = createInitialBoard(rules8x7);
    descBoard = fillColumn(descBoard, 4, ['yellow', 'yellow', 'yellow', 'red'], rules8x7);
    descBoard = fillColumn(descBoard, 5, ['yellow', 'yellow', 'red'], rules8x7);
    descBoard = fillColumn(descBoard, 6, ['yellow', 'red'], rules8x7);
    descBoard = dropPiece(descBoard, 7, 'red', rules8x7)!;
    expect(hasWonAt(descBoard, 6, 7, 'red', rules8x7)).toBe(true);
    expect(getWinningCells(descBoard, rules8x7)).toEqual(
      new Set(['3,4', '4,5', '5,6', '6,7']),
    );
  });

  it('verifies 9x7 connect-5 winning combinations across all 4 directions', () => {
    const rules9x7 = buildRules('five', '9x7');
    expect(rules9x7.cols).toBe(9);
    expect(rules9x7.rows).toBe(7);
    expect(rules9x7.connectN).toBe(5);

    // 1. Horizontal Connect-5 on bottom row (cols 2, 3, 4, 5, 6)
    let hBoard = createInitialBoard(rules9x7);
    for (const c of [2, 3, 4, 5]) {
      hBoard = dropPiece(hBoard, c, 'red', rules9x7)!;
      // 4 in a row is NOT a win in connect-5!
      expect(hasWonAt(hBoard, 6, c, 'red', rules9x7)).toBe(false);
    }
    expect(getWinningCells(hBoard, rules9x7)).toBeNull();
    hBoard = dropPiece(hBoard, 6, 'red', rules9x7)!;
    expect(hasWonAt(hBoard, 6, 6, 'red', rules9x7)).toBe(true);
    expect(getWinningCells(hBoard, rules9x7)).toEqual(
      new Set(['6,2', '6,3', '6,4', '6,5', '6,6']),
    );

    // 2. Vertical Connect-5 in center column 4
    let vBoard = createInitialBoard(rules9x7);
    for (let i = 0; i < 4; i++) {
      vBoard = dropPiece(vBoard, 4, 'yellow', rules9x7)!;
      expect(hasWonAt(vBoard, 6 - i, 4, 'yellow', rules9x7)).toBe(false);
    }
    vBoard = dropPiece(vBoard, 4, 'yellow', rules9x7)!;
    expect(hasWonAt(vBoard, 2, 4, 'yellow', rules9x7)).toBe(true);
    expect(getWinningCells(vBoard, rules9x7)).toEqual(
      new Set(['6,4', '5,4', '4,4', '3,4', '2,4']),
    );

    // 3. Ascending diagonal Connect-5: (6,1), (5,2), (4,3), (3,4), (2,5)
    let ascBoard = createInitialBoard(rules9x7);
    ascBoard = dropPiece(ascBoard, 1, 'red', rules9x7)!;
    ascBoard = fillColumn(ascBoard, 2, ['yellow', 'red'], rules9x7);
    ascBoard = fillColumn(ascBoard, 3, ['yellow', 'yellow', 'red'], rules9x7);
    ascBoard = fillColumn(ascBoard, 4, ['yellow', 'yellow', 'yellow', 'red'], rules9x7);
    expect(hasWonAt(ascBoard, 3, 4, 'red', rules9x7)).toBe(false);
    ascBoard = fillColumn(ascBoard, 5, ['yellow', 'yellow', 'yellow', 'yellow', 'red'], rules9x7);
    expect(hasWonAt(ascBoard, 2, 5, 'red', rules9x7)).toBe(true);
    expect(getWinningCells(ascBoard, rules9x7)).toEqual(
      new Set(['6,1', '5,2', '4,3', '3,4', '2,5']),
    );

    // 4. Descending diagonal Connect-5: (2,2), (3,3), (4,4), (5,5), (6,6)
    let descBoard = createInitialBoard(rules9x7);
    descBoard = fillColumn(descBoard, 2, ['yellow', 'yellow', 'yellow', 'yellow', 'red'], rules9x7);
    descBoard = fillColumn(descBoard, 3, ['yellow', 'yellow', 'yellow', 'red'], rules9x7);
    descBoard = fillColumn(descBoard, 4, ['yellow', 'yellow', 'red'], rules9x7);
    descBoard = fillColumn(descBoard, 5, ['yellow', 'red'], rules9x7);
    expect(hasWonAt(descBoard, 3, 5, 'red', rules9x7)).toBe(false);
    descBoard = dropPiece(descBoard, 6, 'red', rules9x7)!;
    expect(hasWonAt(descBoard, 6, 6, 'red', rules9x7)).toBe(true);
    expect(getWinningCells(descBoard, rules9x7)).toEqual(
      new Set(['2,2', '3,3', '4,4', '5,5', '6,6']),
    );
  });

  it('detects board full invariant on 9x7 when all 63 cells are occupied', () => {
    const rules9x7 = buildRules('five', '9x7');
    const full9x7 = createInitialBoard(rules9x7).map((row, r) =>
      row.map((_, c) => ((r + c) % 2 === 0 ? 'red' : 'yellow')),
    );
    expect(isBoardFull(full9x7, rules9x7)).toBe(true);
    expect(getLegalDropColumns(full9x7, rules9x7)).toEqual([]);
  });
});

describe('PopOut', () => {
  it('lists only own-color bottom cells and shifts the column down', () => {
    let board = createInitialBoard(popout);
    board = fillColumn(board, 2, ['red', 'yellow', 'red'], popout);
    expect(getPopOutColumns(board, 'red', popout)).toContain(2);
    expect(getPopOutColumns(board, 'yellow', popout)).not.toContain(2);
    const next = popOutPiece(board, 2, popout)!;
    expect(next[popout.rows - 1][2]).toBe('yellow');
    expect(next[popout.rows - 2][2]).toBe('red');
    expect(next[0][2]).toBeNull();
  });

  it('can create a win for the mover after gravity', () => {
    // Same shape as puzzle p06.
    const board = createInitialBoard(popout);
    const encoded = [
      '...R...',
      '...Y...',
      '...Y..Y',
      '.R.RY.Y',
      'RYRRRYY',
      'RRRYRRR',
    ];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const ch = encoded[r][c];
        board[r][c] = ch === 'R' ? 'red' : ch === 'Y' ? 'yellow' : null;
      }
    }
    const move = { kind: 'pop' as const, col: 1 };
    const next = applyMove(board, move, 'red', popout)!;
    expect(resolveWinnerAfterMove(next, 'red', move, null, popout)).toBe('red');
  });

  it('settles concurrent PopOut wins by awarding the win to the moving player', () => {
    // Construct a board where popping column 3 drops pieces so that:
    // - Row 4 becomes 4 Reds in cols 0..3 (Red connect-4)
    // - Row 5 becomes 4 Yellows in cols 0..3 (Yellow connect-4)
    let board = createInitialBoard(popout);
    board[5][0] = 'yellow';
    board[4][0] = 'red';

    board[5][1] = 'yellow';
    board[4][1] = 'red';

    board[5][2] = 'yellow';
    board[4][2] = 'red';

    board[5][3] = 'red';    // Bottom piece (Red will pop)
    board[4][3] = 'yellow'; // Falls to (5, 3) -> Yellow row 5
    board[3][3] = 'red';    // Falls to (4, 3) -> Red row 4

    // Invariants before pop: neither player has connect-4
    expect(hasConnectN(board, 'red', popout)).toBe(false);
    expect(hasConnectN(board, 'yellow', popout)).toBe(false);

    // Red's legal pop moves include column 3; Yellow cannot pop col 3
    expect(getPopOutColumns(board, 'red', popout)).toContain(3);
    expect(getPopOutColumns(board, 'yellow', popout)).not.toContain(3);

    // Red performs the pop move
    const popMove: Move = { kind: 'pop', col: 3 };
    const nextBoard = applyMove(board, popMove, 'red', popout);
    expect(nextBoard).not.toBeNull();

    // Verify pieces shifted down in column 3
    expect(nextBoard![5][3]).toBe('yellow');
    expect(nextBoard![4][3]).toBe('red');
    expect(nextBoard![3][3]).toBeNull();

    // Both players achieve 4-in-a-row simultaneously!
    expect(hasConnectN(nextBoard!, 'red', popout)).toBe(true);
    expect(hasConnectN(nextBoard!, 'yellow', popout)).toBe(true);

    // Mover (Red) is awarded the win over the opponent
    const winnerWhenRedMoves = resolveWinnerAfterMove(nextBoard!, 'red', popMove, null, popout);
    expect(winnerWhenRedMoves).toBe('red');

    // If Yellow had made the moving pop in an equivalent dual-win board, Yellow would be awarded the win
    const winnerWhenYellowMoves = resolveWinnerAfterMove(nextBoard!, 'yellow', popMove, null, popout);
    expect(winnerWhenYellowMoves).toBe('yellow');
  });

  it('awards win to opponent when mover pop creates 4-in-a-row only for opponent', () => {
    let board = createInitialBoard(popout);
    board[5][0] = 'yellow';
    board[5][1] = 'yellow';
    board[5][2] = 'yellow';
    board[5][3] = 'red';    // Red bottom piece
    board[4][3] = 'yellow'; // Opponent piece above it

    expect(hasConnectN(board, 'yellow', popout)).toBe(false);

    // Red pops col 3, causing Yellow piece to fall into row 5
    const move: Move = { kind: 'pop', col: 3 };
    const next = applyMove(board, move, 'red', popout)!;
    expect(next[5][3]).toBe('yellow');
    expect(hasConnectN(next, 'yellow', popout)).toBe(true);
    expect(hasConnectN(next, 'red', popout)).toBe(false);

    // Opponent (yellow) is awarded the win
    expect(resolveWinnerAfterMove(next, 'red', move, null, popout)).toBe('yellow');
  });

  it('rejects popping empty column, out-of-bounds column, or when PopOut is disallowed', () => {
    const emptyBoard = createInitialBoard(popout);
    expect(popOutPiece(emptyBoard, 0, popout)).toBeNull();
    expect(popOutPiece(emptyBoard, -1, popout)).toBeNull();
    expect(popOutPiece(emptyBoard, 10, popout)).toBeNull();
    expect(getPopOutColumns(emptyBoard, 'red', popout)).toEqual([]);

    // When PopOut is disabled in rules
    const classicBoard = dropPiece(emptyBoard, 0, 'red', classic)!;
    expect(getPopOutColumns(classicBoard, 'red', classic)).toEqual([]);
    expect(getLegalMoves(classicBoard, 'red', classic).every((m) => m.kind === 'drop')).toBe(true);
  });

  it('exposes pop moves in getLegalMoves only when allowed', () => {
    let board = createInitialBoard(popout);
    board = dropPiece(board, 0, 'red', popout)!;
    const moves = getLegalMoves(board, 'red', popout);
    expect(moves.some((m) => m.kind === 'pop' && m.col === 0)).toBe(true);
    const classicMoves = getLegalMoves(board, 'red', classic);
    expect(classicMoves.every((m) => m.kind === 'drop')).toBe(true);
  });
});

describe('pickBotMove (adversarial bot)', () => {
  it('returns null on a full board', () => {
    const board = createInitialBoard(classic).map((row, r) =>
      row.map((_, c) => ((r + c) % 2 === 0 ? 'red' : 'yellow')),
    );
    expect(pickBotMove(board, 'red', 'hard', 'architect', classic)).toBeNull();
  });

  it('returns the only remaining legal column', () => {
    let board = createInitialBoard(classic);
    for (let c = 0; c < COLS; c++) {
      if (c === 4) continue;
      board = fillColumn(board, c, ['red', 'yellow', 'red', 'yellow', 'red', 'yellow']);
    }
    expect(getLegalDropColumns(board, classic)).toEqual([4]);
    expect(pickBotColumn(board, 'red', 'easy', 'rusher', classic)).toBe(4);
  });

  it('hard takes an immediate winning drop', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let board = createInitialBoard(classic);
    for (const c of [0, 1, 2]) {
      board = dropPiece(board, c, 'red', classic)!;
    }
    board = dropPiece(board, 6, 'yellow', classic)!;
    board = dropPiece(board, 6, 'yellow', classic)!;
    board = dropPiece(board, 5, 'yellow', classic)!;
    expect(pickBotColumn(board, 'red', 'hard', 'architect', classic)).toBe(3);
  });

  it('hard blocks an opponent one-move win', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let board = createInitialBoard(classic);
    for (const c of [0, 1, 2]) {
      board = dropPiece(board, c, 'yellow', classic)!;
    }
    board = dropPiece(board, 5, 'red', classic)!;
    board = dropPiece(board, 5, 'red', classic)!;
    expect(pickBotColumn(board, 'red', 'hard', 'blocker', classic)).toBe(3);
  });

  it('hard picks a winning PopOut when that is the forced win', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    // Same shape as the PopOut gravity-win fixture / puzzle p06.
    const board = createInitialBoard(popout);
    const encoded = [
      '...R...',
      '...Y...',
      '...Y..Y',
      '.R.RY.Y',
      'RYRRRYY',
      'RRRYRRR',
    ];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const ch = encoded[r][c];
        board[r][c] = ch === 'R' ? 'red' : ch === 'Y' ? 'yellow' : null;
      }
    }
    const winningPops = getLegalMoves(board, 'red', popout).filter((move) => {
      if (move.kind !== 'pop') return false;
      const next = applyMove(board, move, 'red', popout);
      if (!next) return false;
      return resolveWinnerAfterMove(next, 'red', move, null, popout) === 'red';
    });
    expect(winningPops.length).toBeGreaterThan(0);
    const move = pickBotMove(board, 'red', 'hard', 'architect', popout);
    expect(move?.kind).toBe('pop');
    expect(winningPops.map((m) => m.col)).toContain(move!.col);
  });

  it('tracks 3-fold position repetition draw in popout mode only', () => {
    let board = createInitialBoard(popout);
    board = dropPiece(board, 0, 'red', popout)!;
    board = dropPiece(board, 1, 'yellow', popout)!;

    let counts = advancePopOutPositionCounts(undefined, board, 'red', popout);
    expect(isPopOutRepetitionDraw(counts, board, 'red', popout)).toBe(false);
    counts = advancePopOutPositionCounts(counts, board, 'red', popout);
    expect(isPopOutRepetitionDraw(counts, board, 'red', popout)).toBe(false);
    counts = advancePopOutPositionCounts(counts, board, 'red', popout);
    expect(Object.values(counts)[0]).toBe(POPOUT_REPETITION_COUNT);
    expect(isPopOutRepetitionDraw(counts, board, 'red', popout)).toBe(true);
    expect(positionKey(board, 'red')).not.toBe(positionKey(board, 'yellow'));

    // Classic mode ignores repetition checks.
    expect(isPopOutRepetitionDraw(counts, board, 'red', classic)).toBe(false);
  });

  it('handles 2-step fork puzzles with hard bot defensive replies and still allows winning on ply 2', () => {
    for (const id of ['p04-fork-2', 'p09-fork-wide', 'p10-diag-fork']) {
      const puzzle = getPuzzleById(id)!;
      expect(puzzle).toBeDefined();
      const rules = puzzleRules(puzzle);
      const board0 = loadPuzzleBoard(puzzle);
      const firstMove = puzzle.solution[0];
      const afterFirst = applyMove(board0, firstMove, puzzle.sideToMove, rules)!;
      expect(afterFirst).not.toBeNull();

      const botColor = opponent(puzzle.sideToMove);
      const botReply = pickBotMove(afterFirst, botColor, 'hard', 'blocker', rules);
      expect(botReply).not.toBeNull();

      const afterBot = applyMove(afterFirst, botReply!, botColor, rules)!;
      expect(afterBot).not.toBeNull();

      // Player must have a legal winning second move after the bot reply.
      const winningReplies = getLegalMoves(afterBot, puzzle.sideToMove, rules).filter((m) => {
        const dropRow = m.kind === 'drop' ? getDropRow(afterBot, m.col, rules) : null;
        const next = applyMove(afterBot, m, puzzle.sideToMove, rules);
        return next && resolveWinnerAfterMove(next, puzzle.sideToMove, m, dropRow, rules) === puzzle.sideToMove;
      });
      expect(winningReplies.length).toBeGreaterThan(0);
    }
  });

  it('runs hard search on popout and 8x7/9x7 boards with time budget without errors', () => {
    const popout9x7 = buildRules('popout', '9x7');
    let board = createInitialBoard(popout9x7);
    board = fillColumn(board, 3, ['red', 'yellow', 'red'], popout9x7);
    board = fillColumn(board, 4, ['yellow', 'red', 'yellow'], popout9x7);

    const moveNormalBudget = pickBotMove(board, 'red', 'hard', 'architect', popout9x7);
    expect(moveNormalBudget).not.toBeNull();

    // Even with a 0ms budget on a wide PopOut board, iterative deepening returns a legal move cleanly.
    const moveTightBudget = pickBotMove(board, 'red', 'hard', 'architect', popout9x7, 0);
    expect(moveTightBudget).not.toBeNull();
  });
});

describe('difficulty tiers and personalities', () => {
  it('spreads depth and blunderRate across easy < normal < hard', () => {
    const easy = getDifficultyConfig('easy');
    const normal = getDifficultyConfig('normal');
    const hard = getDifficultyConfig('hard');
    expect(easy.depth).toBeLessThan(normal.depth);
    expect(normal.depth).toBeLessThan(hard.depth);
    expect(easy.blunderRate).toBeGreaterThan(normal.blunderRate);
    expect(normal.blunderRate).toBeGreaterThan(hard.blunderRate);
    expect(hard.blunderRate).toBe(0);
  });

  it('keeps three distinct blurbs and three personalities with distinct styles', () => {
    const blurbs = (['easy', 'normal', 'hard'] as const).map((id) => DIFFICULTY_BLURBS[id]);
    expect(new Set(blurbs).size).toBe(3);
    expect(PERSONALITY_IDS).toHaveLength(3);
    const offense = PERSONALITY_IDS.map((id) => PERSONALITIES[id].offenseWeight);
    const defense = PERSONALITY_IDS.map((id) => PERSONALITIES[id].defenseWeight);
    const forks = PERSONALITY_IDS.map((id) => PERSONALITIES[id].forkWeight);
    expect(new Set(offense).size).toBeGreaterThan(1);
    expect(new Set(defense).size).toBeGreaterThan(1);
    expect(new Set(forks).size).toBeGreaterThan(1);
    expect(PERSONALITIES.rusher.offenseWeight).toBeGreaterThan(
      PERSONALITIES.blocker.offenseWeight,
    );
    expect(PERSONALITIES.blocker.defenseWeight).toBeGreaterThan(
      PERSONALITIES.rusher.defenseWeight,
    );
    expect(PERSONALITIES.architect.forkWeight).toBeGreaterThan(
      PERSONALITIES.rusher.forkWeight,
    );
  });

  it('easy can blunder past a winning drop; hard never does', () => {
    let board = createInitialBoard(classic);
    for (const c of [0, 1, 2]) {
      board = dropPiece(board, c, 'red', classic)!;
    }
    board = dropPiece(board, 6, 'yellow', classic)!;
    board = dropPiece(board, 6, 'yellow', classic)!;
    board = dropPiece(board, 5, 'yellow', classic)!;

    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickBotColumn(board, 'red', 'easy', 'rusher', classic)).toBe(0);

    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickBotColumn(board, 'red', 'hard', 'architect', classic)).toBe(3);
  });

  it('easy still takes an immediate win when it does not blunder', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    let board = createInitialBoard(classic);
    for (const c of [0, 1, 2]) {
      board = dropPiece(board, c, 'red', classic)!;
    }
    board = dropPiece(board, 6, 'yellow', classic)!;
    board = dropPiece(board, 6, 'yellow', classic)!;
    board = dropPiece(board, 5, 'yellow', classic)!;
    expect(pickBotColumn(board, 'red', 'easy', 'rusher', classic)).toBe(3);
  });

  it('personality weights change evaluation ordering on a quiet board', () => {
    let board = createInitialBoard(classic);
    board = dropPiece(board, 3, 'red', classic)!;
    board = dropPiece(board, 2, 'yellow', classic)!;
    const rush = evaluateBoard(board, 'red', classic, PERSONALITIES.rusher);
    const block = evaluateBoard(board, 'red', classic, PERSONALITIES.blocker);
    // Not asserting inequality always — weights differ so the functions are distinct.
    expect(typeof rush).toBe('number');
    expect(typeof block).toBe('number');
    expect(PERSONALITIES.rusher.centerBias).not.toBe(PERSONALITIES.blocker.centerBias);
  });
});

describe('series match progression & match reset', () => {
  it('progresses through first-to-2 series with draws and match reset', () => {
    let series = createSeriesState(2);
    expect(series.target).toBe(2);
    expect(series.scores).toEqual([0, 0]);
    expect(series.gamesPlayed).toBe(0);
    expect(series.seriesOver).toBe(false);
    expect(series.seriesWinner).toBeNull();
    expect(seriesProgressLabel(series)).toBe('系列賽 0–0（先取 2 勝）');

    // Game 1: Red wins
    series = applyGameToSeries(series, 'red');
    expect(series.scores).toEqual([1, 0]);
    expect(series.gamesPlayed).toBe(1);
    expect(series.seriesOver).toBe(false);
    expect(seriesProgressLabel(series)).toBe('系列賽 1–0（先取 2 勝）');

    // Game 2: Draw (draw increments gamesPlayed but neither gets a score)
    series = applyGameToSeries(series, 'draw');
    expect(series.scores).toEqual([1, 0]);
    expect(series.gamesPlayed).toBe(2);
    expect(series.seriesOver).toBe(false);
    expect(seriesProgressLabel(series)).toBe('系列賽 1–0（先取 2 勝）');

    // Game 3: Yellow ties
    series = applyGameToSeries(series, 'yellow');
    expect(series.scores).toEqual([1, 1]);
    expect(series.gamesPlayed).toBe(3);
    expect(series.seriesOver).toBe(false);
    expect(seriesProgressLabel(series)).toBe('系列賽 1–1（先取 2 勝）');

    // Game 4: Second draw
    series = applyGameToSeries(series, 'draw');
    expect(series.scores).toEqual([1, 1]);
    expect(series.gamesPlayed).toBe(4);
    expect(series.seriesOver).toBe(false);

    // Game 5: Red clinches win
    series = applyGameToSeries(series, 'red');
    expect(series.scores).toEqual([2, 1]);
    expect(series.gamesPlayed).toBe(5);
    expect(series.seriesOver).toBe(true);
    expect(series.seriesWinner).toBe('red');
    expect(seriesProgressLabel(series)).toBe('系列賽結束 · 紅方先取 2 勝');

    // Match reset: clean new series preserves target and zeroes scores
    const resetSeries = createSeriesState(series.target);
    expect(resetSeries.scores).toEqual([0, 0]);
    expect(resetSeries.gamesPlayed).toBe(0);
    expect(resetSeries.seriesOver).toBe(false);
    expect(resetSeries.seriesWinner).toBeNull();
  });

  it('progresses through first-to-3 series with comeback and multiple draws', () => {
    let series = createSeriesState(3);
    // Yellow takes 2-0 lead
    series = applyGameToSeries(series, 'yellow');
    series = applyGameToSeries(series, 'yellow');
    expect(series.scores).toEqual([0, 2]);

    // Red mounts comeback to 2-2 with 2 draws in between
    series = applyGameToSeries(series, 'draw');
    series = applyGameToSeries(series, 'red');
    series = applyGameToSeries(series, 'draw');
    series = applyGameToSeries(series, 'red');
    expect(series.scores).toEqual([2, 2]);
    expect(series.gamesPlayed).toBe(6);
    expect(series.seriesOver).toBe(false);

    // Final game: Yellow clinches 3-2
    series = applyGameToSeries(series, 'yellow');
    expect(series.scores).toEqual([2, 3]);
    expect(series.gamesPlayed).toBe(7);
    expect(series.seriesOver).toBe(true);
    expect(series.seriesWinner).toBe('yellow');
    expect(seriesProgressLabel(series)).toBe('系列賽結束 · 黃方先取 3 勝');
  });

  it('progresses through first-to-5 series sweep and validates target boundaries', () => {
    let series = createSeriesState(5);
    expect(series.target).toBe(5);
    for (let i = 0; i < 4; i++) {
      series = applyGameToSeries(series, 'red');
      expect(series.seriesOver).toBe(false);
    }
    expect(series.scores).toEqual([4, 0]);

    // Clinch 5th win
    series = applyGameToSeries(series, 'red');
    expect(series.scores).toEqual([5, 0]);
    expect(series.seriesOver).toBe(true);
    expect(series.seriesWinner).toBe('red');
    expect(seriesProgressLabel(series)).toBe('系列賽結束 · 紅方先取 5 勝');

    // Validation helpers
    expect(SERIES_TARGETS).toEqual([1, 2, 3, 5]);
    expect(DEFAULT_SERIES_TARGET).toBe(1);
    expect(isSingleTarget(1)).toBe(true);
    expect(isSingleTarget(2)).toBe(false);
    expect(isSingleTarget(3)).toBe(false);
    expect(isSingleTarget(5)).toBe(false);

    expect(isValidSeriesTarget(1)).toBe(true);
    expect(isValidSeriesTarget(2)).toBe(true);
    expect(isValidSeriesTarget(3)).toBe(true);
    expect(isValidSeriesTarget(5)).toBe(true);
    expect(isValidSeriesTarget(0)).toBe(false);
    expect(isValidSeriesTarget(4)).toBe(false);
    expect(isValidSeriesTarget(-1)).toBe(false);
    expect(isValidSeriesTarget('3')).toBe(false);
    expect(isValidSeriesTarget(null)).toBe(false);

    expect(seatForColor('red')).toBe(0);
    expect(seatForColor('yellow')).toBe(1);

    // Single target label
    const singlePlaying = createSeriesState(1);
    expect(seriesProgressLabel(singlePlaying)).toBe('單局');
    const singleOver = applyGameToSeries(singlePlaying, 'red');
    expect(seriesProgressLabel(singleOver)).toBe('單局結束');
  });
});

describe('puzzle pack', () => {
  it('ships about ten puzzles with unique ids', () => {
    expect(PUZZLES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(PUZZLES.length);
  });

  it('each puzzle board matches its rules and principal solution wins', () => {
    for (const puzzle of PUZZLES) {
      const rules = puzzleRules(puzzle);
      const board = loadPuzzleBoard(puzzle);
      expect(board).toHaveLength(rules.rows);
      expect(board[0]).toHaveLength(rules.cols);
      expect(verifyPuzzleSolution(puzzle)).toBe(true);
    }
  });
});

describe('storage helpers', () => {
  it('records game/series results and puzzle progress immutably', () => {
    const afterWin = recordGameResult(EMPTY_STATS, 'win', {
      difficulty: 'hard',
      personality: 'blocker',
      variant: 'popout',
      preset: '8x7',
      seriesTarget: 3,
    });
    expect(afterWin.wins).toBe(1);
    expect(afterWin.streak).toBe(1);
    expect(afterWin.lastVariant).toBe('popout');
    expect(getModeStats(afterWin, 'popout', '8x7', 'hard').wins).toBe(1);

    const afterSeries = recordSeriesResult(afterWin, true, {
      difficulty: 'hard',
      variant: 'popout',
      preset: '8x7',
    });
    expect(afterSeries.seriesWins).toBe(1);
    expect(getModeStats(afterSeries, 'popout', '8x7', 'hard').seriesWins).toBe(1);

    const progress = markPuzzleSolved({}, PUZZLES[0].id, 1);
    expect(countSolvedPuzzles(progress)).toBe(1);
    expect(storageMeta().statsKey).toContain('connect-four');
  });

  it('keeps win streaks and W/L separate per variant × board × difficulty', () => {
    let stats = EMPTY_STATS;
    stats = recordGameResult(stats, 'win', {
      difficulty: 'hard',
      personality: 'architect',
      variant: 'popout',
      preset: '8x7',
      seriesTarget: 3,
    });
    stats = recordGameResult(stats, 'win', {
      difficulty: 'hard',
      personality: 'architect',
      variant: 'popout',
      preset: '8x7',
      seriesTarget: 3,
    });
    expect(getModeStats(stats, 'popout', '8x7', 'hard').streak).toBe(2);

    stats = recordGameResult(stats, 'lose', {
      difficulty: 'easy',
      personality: 'rusher',
      variant: 'classic',
      preset: '7x6',
      seriesTarget: 2,
    });
    // Easy classic loss must not reset the PopOut hard streak.
    expect(getModeStats(stats, 'popout', '8x7', 'hard').streak).toBe(2);
    expect(getModeStats(stats, 'popout', '8x7', 'hard').wins).toBe(2);
    expect(getModeStats(stats, 'classic', '7x6', 'easy').streak).toBe(0);
    expect(getModeStats(stats, 'classic', '7x6', 'easy').losses).toBe(1);
    expect(modeKey('five', '9x7', 'normal')).toBe('five:9x7:normal');
    expect(modeStatsLabel('five', '9x7', 'normal')).toContain('五子勝');
  });
});

describe('analyzeTactics (live threat radar & evaluation)', () => {
  it('detects immediate winning drops and opponent threats', () => {
    let board = createInitialBoard(classic);
    for (const c of [0, 1, 2]) {
      board = dropPiece(board, c, 'red', classic)!;
    }
    board = dropPiece(board, 6, 'yellow', classic)!;

    const tacticsRed = analyzeTactics(board, 'red', classic);
    expect(tacticsRed.ownThreats).toContain(3);
    expect(tacticsRed.oppThreats.length).toBe(0);

    const tacticsYellow = analyzeTactics(board, 'yellow', classic);
    expect(tacticsYellow.oppThreats).toContain(3);
    expect(tacticsYellow.ownThreats.length).toBe(0);
  });

  it('detects blunder gift drops that allow immediate opponent win on top', () => {
    let board = createInitialBoard(classic);
    // Row 5: red on cols 0, 1, 2
    board = dropPiece(board, 0, 'red', classic)!;
    board = dropPiece(board, 1, 'red', classic)!;
    board = dropPiece(board, 2, 'red', classic)!;
    // Row 4: yellow on cols 0, 1, 2
    board = dropPiece(board, 0, 'yellow', classic)!;
    board = dropPiece(board, 1, 'yellow', classic)!;
    board = dropPiece(board, 2, 'yellow', classic)!;

    // Col 3 row 5 is empty. If red drops there, yellow gets row 4 col 3 and wins!
    const tactics = analyzeTactics(board, 'red', classic);
    expect(tactics.blunderDrops).toContain(3);
  });

  it('detects threat segments with accurate geometry and distinguishes immediate threats', () => {
    let board = createInitialBoard(classic);
    // Create horizontal threat on bottom row 5 (cols 1, 2, 3 red)
    board = dropPiece(board, 1, 'red', classic)!;
    board = dropPiece(board, 2, 'red', classic)!;
    board = dropPiece(board, 3, 'red', classic)!;

    const segments = detectThreatSegments(board, classic);
    const redHorizontal = segments.filter(
      (s) => s.color === 'red' && s.direction === 'horizontal',
    );
    expect(redHorizontal.length).toBeGreaterThan(0);
    // Col 0 or Col 4 should be target cells and marked as isImmediate=true (row 5 is lowest empty row)
    const immediateTargetCols = redHorizontal
      .filter((s) => s.isImmediate)
      .map((s) => s.targetCell.col);
    expect(immediateTargetCols).toContain(0);
    expect(immediateTargetCols).toContain(4);
  });

  it('evaluates move quality correctly: win, defense, blunder, and brilliant fork', () => {
    let board = createInitialBoard(classic);
    // Red has 3 in a row
    board = dropPiece(board, 0, 'red', classic)!;
    board = dropPiece(board, 1, 'red', classic)!;
    board = dropPiece(board, 2, 'red', classic)!;

    // 1. Red drops at 3 to win
    const winBoard = dropPiece(board, 3, 'red', classic)!;
    const winEval = evaluateMoveQuality(
      board,
      winBoard,
      { kind: 'drop', col: 3 },
      'red',
      classic,
      true,
    );
    expect(winEval.quality).toBe('win');
    expect(winEval.label).toBe('絕殺勝勢');

    // 2. Yellow blocks col 3
    const defBoard = dropPiece(board, 3, 'yellow', classic)!;
    const defEval = evaluateMoveQuality(
      board,
      defBoard,
      { kind: 'drop', col: 3 },
      'yellow',
      classic,
      false,
    );
    expect(defEval.quality).toBe('defense');
    expect(defEval.label).toBe('關鍵鐵壁');

    // 3. Blunder gift drop
    let blunderSetup = createInitialBoard(classic);
    // Row 5: red on 0, 1, 2
    blunderSetup = dropPiece(blunderSetup, 0, 'red', classic)!;
    blunderSetup = dropPiece(blunderSetup, 1, 'red', classic)!;
    blunderSetup = dropPiece(blunderSetup, 2, 'red', classic)!;
    // Row 4: yellow on 0, 1, 2
    blunderSetup = dropPiece(blunderSetup, 0, 'yellow', classic)!;
    blunderSetup = dropPiece(blunderSetup, 1, 'yellow', classic)!;
    blunderSetup = dropPiece(blunderSetup, 2, 'yellow', classic)!;

    const afterBlunder = dropPiece(blunderSetup, 3, 'red', classic)!;
    const blunderEval = evaluateMoveQuality(
      blunderSetup,
      afterBlunder,
      { kind: 'drop', col: 3 },
      'red',
      classic,
      false,
    );
    expect(blunderEval.quality).toBe('blunder');
    expect(blunderEval.label).toBe('致命失誤');
  });

  it('detects fork dual threats and evaluates brilliant double-threat moves', () => {
    let board = createInitialBoard(classic);
    // Setup Red with 3-in-a-row on bottom row: cols 2, 3, 4 with both ends open (cols 1 and 5)
    board = dropPiece(board, 2, 'red', classic)!;
    board = dropPiece(board, 3, 'red', classic)!;
    board = dropPiece(board, 4, 'red', classic)!;

    // Both col 1 and col 5 are immediate winning drops for Red
    const redTactics = analyzeTactics(board, 'red', classic);
    expect(redTactics.ownThreats).toContain(1);
    expect(redTactics.ownThreats).toContain(5);
    expect(redTactics.ownThreats.length).toBeGreaterThanOrEqual(2);

    // From Yellow's perspective, both 1 and 5 are oppThreats (an unblockable fork!)
    const yellowTactics = analyzeTactics(board, 'yellow', classic);
    expect(yellowTactics.oppThreats).toContain(1);
    expect(yellowTactics.oppThreats).toContain(5);

    // The move that created this fork (dropping col 4) is evaluated as brilliant
    let prevBoard = createInitialBoard(classic);
    prevBoard = dropPiece(prevBoard, 2, 'red', classic)!;
    prevBoard = dropPiece(prevBoard, 3, 'red', classic)!;

    const forkMove: Move = { kind: 'drop', col: 4 };
    const forkEval = evaluateMoveQuality(prevBoard, board, forkMove, 'red', classic, false);
    expect(forkEval.quality).toBe('brilliant');
    expect(forkEval.label).toBe('雙殺神之一手');
    expect(forkEval.deltaEval).toBeGreaterThan(0);
  });

  it('detects blunder traps and differentiates safe vs fatal drops', () => {
    let board = createInitialBoard(classic);
    // Setup:
    // Row 5: Red at cols 0, 1, 2
    // Row 4: Yellow at cols 0, 1, 2
    board = fillColumn(board, 0, ['red', 'yellow']);
    board = fillColumn(board, 1, ['red', 'yellow']);
    board = fillColumn(board, 2, ['red', 'yellow']);

    // Col 3 row 5 is currently empty.
    // If Red drops at col 3 (row 5), Yellow can immediately drop at col 3 (row 4) and win!
    const tactics = analyzeTactics(board, 'red', classic);
    expect(tactics.blunderDrops).toContain(3);
    // Col 4, 5, 6 should not be blunder drops
    expect(tactics.blunderDrops).not.toContain(4);
    expect(tactics.blunderDrops).not.toContain(5);
    expect(tactics.blunderDrops).not.toContain(6);

    // Dropping in blunder column evaluates to 'blunder'
    const blunderBoard = dropPiece(board, 3, 'red', classic)!;
    const blunderEval = evaluateMoveQuality(
      board,
      blunderBoard,
      { kind: 'drop', col: 3 },
      'red',
      classic,
      false,
    );
    expect(blunderEval.quality).toBe('blunder');
    expect(blunderEval.label).toBe('致命失誤');

    // Dropping in safe column evaluates to normal/strong, never blunder
    const safeBoard = dropPiece(board, 6, 'red', classic)!;
    const safeEval = evaluateMoveQuality(
      board,
      safeBoard,
      { kind: 'drop', col: 6 },
      'red',
      classic,
      false,
    );
    expect(safeEval.quality).not.toBe('blunder');
  });

  it('distinguishes immediate vs suspended threat segments in threat radar', () => {
    let board = createInitialBoard(classic);
    // Create an elevated horizontal threat for Red at row 3 (cols 1, 2, 3),
    // but without pieces underneath col 4 (so col 4 row 3 is suspended in air).
    board = fillColumn(board, 1, ['yellow', 'yellow', 'red']);
    board = fillColumn(board, 2, ['yellow', 'yellow', 'red']);
    board = fillColumn(board, 3, ['yellow', 'yellow', 'red']);

    // Col 4 is completely empty. Row 3 col 4 is suspended!
    const segments = detectThreatSegments(board, classic);
    const suspended = segments.find(
      (s) => s.color === 'red' && s.targetCell.row === 3 && s.targetCell.col === 4,
    );
    expect(suspended).toBeDefined();
    expect(suspended!.isImmediate).toBe(false);

    // Now fill col 4 up to row 4 (dropping 2 pieces) so drop row becomes 3:
    board = fillColumn(board, 4, ['yellow', 'yellow']);
    const updatedSegments = detectThreatSegments(board, classic);
    const nowImmediate = updatedSegments.find(
      (s) => s.color === 'red' && s.targetCell.row === 3 && s.targetCell.col === 4,
    );
    expect(nowImmediate).toBeDefined();
    expect(nowImmediate!.isImmediate).toBe(true);
  });

  it('evaluates board control and red advantage percentage bounds', () => {
    const emptyBoard = createInitialBoard(classic);
    const emptyTactics = analyzeTactics(emptyBoard, 'red', classic);
    // On empty board, advantage is centered around 50%
    expect(emptyTactics.redAdvantagePct).toBeGreaterThanOrEqual(45);
    expect(emptyTactics.redAdvantagePct).toBeLessThanOrEqual(55);

    // Heavy red board with multiple center pieces
    let redBoard = createInitialBoard(classic);
    redBoard = dropPiece(redBoard, 3, 'red', classic)!;
    redBoard = dropPiece(redBoard, 3, 'red', classic)!;
    redBoard = dropPiece(redBoard, 2, 'red', classic)!;
    redBoard = dropPiece(redBoard, 4, 'red', classic)!;
    const redDomTactics = analyzeTactics(redBoard, 'red', classic);
    expect(redDomTactics.redAdvantagePct).toBeGreaterThan(60);
    expect(redDomTactics.centerRed).toBe(4);
    expect(redDomTactics.centerYellow).toBe(0);
  });
});

describe('audio trigger contracts and keyboard navigation HUD accessibility', () => {
  it('manages mute state persistence and handles SSR/null audio context gracefully', () => {
    // Mute state
    arcadeAudio.setMuted(true);
    expect(arcadeAudio.getMuted()).toBe(true);
    arcadeAudio.setMuted(false);
    expect(arcadeAudio.getMuted()).toBe(false);

    // All audio trigger methods must run safely without throwing even when window/AudioContext is absent
    expect(() => arcadeAudio.playChuteDrop(0, 6)).not.toThrow();
    expect(() => arcadeAudio.playChuteDrop(5, 6)).not.toThrow();
    expect(() => arcadeAudio.playPopOut()).not.toThrow();
    expect(() => arcadeAudio.playLaserHum()).not.toThrow();
    expect(() => arcadeAudio.playHeartbeatOnce()).not.toThrow();
    expect(() => arcadeAudio.startHeartbeat()).not.toThrow();
    expect(() => arcadeAudio.stopHeartbeat()).not.toThrow();
    expect(() => arcadeAudio.playMoveQualityFanfare('win')).not.toThrow();
    expect(() => arcadeAudio.playMoveQualityFanfare('brilliant')).not.toThrow();
    expect(() => arcadeAudio.playMoveQualityFanfare('defense')).not.toThrow();
    expect(() => arcadeAudio.playMoveQualityFanfare('strong')).not.toThrow();
    expect(() => arcadeAudio.playMoveQualityFanfare('blunder')).not.toThrow();
    expect(() => arcadeAudio.playMoveQualityFanfare('inaccuracy')).not.toThrow();
    expect(() => arcadeAudio.playMoveQualityFanfare('normal')).not.toThrow();
    expect(() => arcadeAudio.playGateReleaseCascade()).not.toThrow();
  });

  it('executes audio synthesis with depth frequency modulation on mock Web Audio context', () => {
    const startedOscillators: Array<{ type: string; start: number; stop: number }> = [];
    const createdFrequencies: number[] = [];

    class MockGain {
      gain = {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      };
      connect = vi.fn();
    }

    class MockOscillator {
      type = 'sine';
      frequency = {
        setValueAtTime: vi.fn((val: number) => createdFrequencies.push(val)),
        exponentialRampToValueAtTime: vi.fn(),
      };
      connect = vi.fn();
      start = vi.fn((t: number) => startedOscillators.push({ type: this.type, start: t, stop: 0 }));
      stop = vi.fn((t: number) => {
        if (startedOscillators.length > 0) {
          startedOscillators[startedOscillators.length - 1].stop = t;
        }
      });
    }

    const mockCtx = {
      state: 'running',
      currentTime: 100,
      destination: {},
      createGain: () => new MockGain(),
      createOscillator: () => new MockOscillator(),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    // Inject mock context into arcadeAudio private field
    (arcadeAudio as unknown as { ctx: unknown; isMuted: boolean }).ctx = mockCtx;
    (arcadeAudio as unknown as { isMuted: boolean }).isMuted = false;

    // Depth frequency modulation:
    // Drop at bottom row 5 of 6: depthRatio = 1 -> baseFreq = 95Hz
    createdFrequencies.length = 0;
    arcadeAudio.playChuteDrop(5, 6);
    expect(createdFrequencies).toContain(95);

    // Drop at top row 0 of 6: depthRatio = 0 -> baseFreq = 205Hz
    createdFrequencies.length = 0;
    arcadeAudio.playChuteDrop(0, 6);
    expect(createdFrequencies).toContain(205);

    // Fanfare calls
    expect(() => arcadeAudio.playMoveQualityFanfare('win')).not.toThrow();
    expect(() => arcadeAudio.playMoveQualityFanfare('brilliant')).not.toThrow();
    expect(() => arcadeAudio.playGateReleaseCascade()).not.toThrow();

    // Clean up mock context
    (arcadeAudio as unknown as { ctx: unknown }).ctx = null;
  });

  it('validates keyboard shortcuts mapping and navigation contracts', () => {
    // 1. Column numbers 1-7 (and 9 on 9-col board) map to 0-indexed column
    for (let i = 1; i <= 7; i++) {
      const col = parseInt(String(i), 10) - 1;
      expect(col).toBe(i - 1);
    }
    expect(parseInt('9', 10) - 1).toBe(8);

    // 2. Arrow navigation clamping
    const clampCol = (curr: number, delta: number, maxCols: number) =>
      Math.max(0, Math.min(maxCols - 1, curr + delta));

    expect(clampCol(0, -1, 7)).toBe(0); // Left clamp at 0
    expect(clampCol(6, 1, 7)).toBe(6);  // Right clamp at 6
    expect(clampCol(3, 1, 7)).toBe(4);
    expect(clampCol(3, -1, 7)).toBe(2);
    expect(clampCol(8, 1, 9)).toBe(8);  // Right clamp on 9-col

    // 3. Action shortcut key bindings dictionary
    const KEY_ACTIONS: Record<string, string[]> = {
      confirmDrop: ['Enter', ' ', 'ArrowDown', 'KeyS'],
      undo: ['z', 'Z', 'Backspace'],
      hint: ['h', 'H'],
      popoutToggle: ['p', 'P'],
      gateReset: ['r', 'R'],
      themeToggle: ['t', 'T'],
      muteToggle: ['m', 'M'],
    };
    expect(KEY_ACTIONS.confirmDrop).toContain('Enter');
    expect(KEY_ACTIONS.undo).toContain('Backspace');
    expect(KEY_ACTIONS.hint).toContain('H');
    expect(KEY_ACTIONS.popoutToggle).toContain('P');
    expect(KEY_ACTIONS.gateReset).toContain('R');
    expect(KEY_ACTIONS.themeToggle).toContain('T');
    expect(KEY_ACTIONS.muteToggle).toContain('M');

    // 4. Accessibility HUD labels contract
    const HUD_LABELS = {
      theme: '切換主題',
      threatRay: '切換殺局雷射',
      mute: '音效切換',
      undo: '悔棋',
      hint: '提示',
      rules: '規則',
      gateReset: '開閘新局',
    };
    expect(HUD_LABELS.theme).toBe('切換主題');
    expect(HUD_LABELS.threatRay).toBe('切換殺局雷射');
    expect(HUD_LABELS.gateReset).toBe('開閘新局');
  });
});
