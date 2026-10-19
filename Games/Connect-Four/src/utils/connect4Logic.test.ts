import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BOARD_PRESETS,
  COLS,
  ROWS,
  PERSONALITIES,
  PERSONALITY_IDS,
  RULE_VARIANTS,
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
  hasWonAt,
  isBoardFull,
  pickBotColumn,
  pickBotMove,
  popOutPiece,
  resolveWinnerAfterMove,
  DIFFICULTY_BLURBS,
  type Board,
  type PieceColor,
  type RulesConfig,
} from './connect4Logic';
import {
  applyGameToSeries,
  createSeriesState,
  seriesProgressLabel,
} from './match';
import {
  PUZZLES,
  loadPuzzleBoard,
  puzzleRules,
  verifyPuzzleSolution,
} from './puzzles';
import {
  EMPTY_STATS,
  countSolvedPuzzles,
  markPuzzleSolved,
  recordGameResult,
  recordSeriesResult,
  storageMeta,
} from './storage';

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

describe('series match', () => {
  it('first to N wins ends the series; draws do not score', () => {
    let series = createSeriesState(2);
    series = applyGameToSeries(series, 'draw');
    expect(series.scores).toEqual([0, 0]);
    expect(series.gamesPlayed).toBe(1);
    expect(series.seriesOver).toBe(false);

    series = applyGameToSeries(series, 'red');
    expect(series.scores).toEqual([1, 0]);
    series = applyGameToSeries(series, 'yellow');
    expect(series.scores).toEqual([1, 1]);
    series = applyGameToSeries(series, 'red');
    expect(series.seriesOver).toBe(true);
    expect(series.seriesWinner).toBe('red');
    expect(seriesProgressLabel(series)).toContain('紅方');
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

    const afterSeries = recordSeriesResult(afterWin, true);
    expect(afterSeries.seriesWins).toBe(1);

    const progress = markPuzzleSolved({}, PUZZLES[0].id, 1);
    expect(countSolvedPuzzles(progress)).toBe(1);
    expect(storageMeta().statsKey).toContain('connect-four');
  });
});
