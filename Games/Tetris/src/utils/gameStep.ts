import type {
  ActivePiece,
  Cell,
  LastAction,
  Mode,
  ScoreBreakdown,
  TetrominoType,
  TSpinKind,
} from './tetrisLogic.ts';
import {
  clearLines,
  collides,
  createEmptyBoard,
  createSevenBag,
  detectTSpin,
  findFullRows,
  isBoardEmpty,
  isGoalMet,
  mergePiece,
  scoreClear,
  spawnPiece,
} from './tetrisLogic.ts';

export interface PuzzleGoal {
  tSpin: TSpinKind | 'full-or-mini';
  minLines: number;
}

export interface FieldState {
  board: Cell[][];
  active: ActivePiece | null;
  queue: TetrominoType[];
  hold: TetrominoType | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  combo: number;
  backToBackReady: boolean;
  lastAction: LastAction;
  lastKickIndex: number;
  gameOver: boolean;
  paused: boolean;
  cleared: boolean;
  elapsedMs: number;
  clearing: number[] | null;
  incomingGarbage: number;
  /** Pending clear breakdown while rows flash. */
  pendingBreakdown: ScoreBreakdown | null;
  pendingTSpin: TSpinKind;
  /** T-Spin puzzle objective; null for normal modes. */
  puzzleGoal: PuzzleGoal | null;
  /** Locks since start (practice stars). */
  locks: number;
  /** When false, empty queue ends the run (puzzles / finite bags). */
  refillBags: boolean;
  /** When false, Hold stays disabled for the whole run. */
  holdEnabled: boolean;
}

export interface CreateFieldOptions {
  board?: Cell[][];
  /** Full piece list: first becomes active, rest is queue. */
  pieces?: TetrominoType[];
  puzzleGoal?: PuzzleGoal | null;
  /** When false, hold is disabled (some puzzles). Default true. */
  allowHold?: boolean;
  /** Default true; set false for finite puzzle queues. */
  refillBags?: boolean;
}

export function nextFromQueue(
  queue: TetrominoType[],
  refillBags: boolean = true,
): {
  type: TetrominoType | null;
  remaining: TetrominoType[];
} {
  if (queue.length === 0) {
    if (!refillBags) return { type: null, remaining: [] };
    const bag = createSevenBag();
    return { type: bag[0], remaining: bag.slice(1) };
  }
  const [head, ...rest] = queue;
  let remaining = rest;
  if (refillBags && remaining.length < 7) {
    remaining = [...remaining, ...createSevenBag()];
  }
  return { type: head, remaining };
}

export function createInitialField(options: CreateFieldOptions = {}): FieldState {
  const pieces = options.pieces ?? createSevenBag();
  const [first, ...rest] = pieces;
  const board = options.board ?? createEmptyBoard();
  const active = spawnPiece(first);
  const blocked = collides(board, active);
  return {
    board,
    active: blocked ? null : active,
    queue: rest,
    hold: null,
    canHold: options.allowHold !== false,
    holdEnabled: options.allowHold !== false,
    score: 0,
    lines: 0,
    level: 1,
    combo: 0,
    backToBackReady: false,
    lastAction: 'spawn',
    lastKickIndex: -1,
    gameOver: blocked,
    paused: false,
    cleared: false,
    elapsedMs: 0,
    clearing: null,
    incomingGarbage: 0,
    pendingBreakdown: null,
    pendingTSpin: 'none',
    puzzleGoal: options.puzzleGoal ?? null,
    locks: 0,
    refillBags: options.refillBags !== false,
  };
}

export function spawnNext(
  board: Cell[][],
  queue: TetrominoType[],
  refillBags: boolean = true,
): { board: Cell[][]; active: ActivePiece | null; queue: TetrominoType[]; gameOver: boolean } {
  const { type, remaining } = nextFromQueue(queue, refillBags);
  if (type === null) {
    return { board, active: null, queue: remaining, gameOver: true };
  }
  const active = spawnPiece(type);
  if (collides(board, active)) {
    return { board, active: null, queue: remaining, gameOver: true };
  }
  return { board, active, queue: remaining, gameOver: false };
}

export interface LockOutcome {
  field: FieldState;
  breakdown: ScoreBreakdown | null;
  attack: number;
  linesCleared: number;
}

function puzzleGoalMet(
  goal: PuzzleGoal | null,
  tSpin: TSpinKind,
  linesCleared: number,
): boolean {
  if (!goal || linesCleared < goal.minLines) return false;
  if (goal.tSpin === 'full-or-mini') return tSpin === 'full' || tSpin === 'mini';
  return tSpin === goal.tSpin;
}

function modeGoalMet(
  mode: Mode,
  lines: number,
  elapsedMs: number,
  puzzleGoal: PuzzleGoal | null,
  tSpin: TSpinKind,
  linesCleared: number,
): boolean {
  if (mode === 'tspin') {
    return puzzleGoalMet(puzzleGoal, tSpin, linesCleared);
  }
  return isGoalMet(mode, lines, elapsedMs);
}

/**
 * Merge the active piece, score it, and either start a clear flash or spawn the next piece.
 */
export function lockPiece(
  prev: FieldState,
  mode: Mode,
  hardDropRows: number,
  softDropRows: number,
): LockOutcome {
  if (!prev.active) {
    return { field: prev, breakdown: null, attack: 0, linesCleared: 0 };
  }

  const tSpin = detectTSpin(
    prev.board,
    prev.active,
    prev.lastAction,
    prev.lastKickIndex,
  );
  const merged = mergePiece(prev.board, prev.active);
  const fullRows = findFullRows(merged);
  const linesCleared = fullRows.length;
  const newLines = prev.lines + linesCleared;
  const newLevel = 1 + Math.floor(newLines / 10);
  const locks = prev.locks + 1;

  // Perfect clear is evaluated after the lines collapse conceptually.
  const collapsedPreview = linesCleared > 0 ? clearLines(merged).board : merged;
  const perfectClear = linesCleared > 0 && isBoardEmpty(collapsedPreview);

  const breakdown = scoreClear({
    linesCleared,
    level: newLevel,
    tSpin,
    backToBackReady: prev.backToBackReady,
    combo: prev.combo,
    perfectClear,
    softDropRows,
    hardDropRows,
  });

  const scored: FieldState = {
    ...prev,
    board: merged,
    score: prev.score + breakdown.total,
    lines: newLines,
    level: newLevel,
    canHold: prev.holdEnabled,
    combo: breakdown.nextCombo,
    backToBackReady: breakdown.nextBackToBackReady,
    lastAction: 'spawn',
    lastKickIndex: -1,
    pendingBreakdown: linesCleared > 0 ? breakdown : null,
    pendingTSpin: tSpin,
    locks,
  };

  if (linesCleared > 0) {
    return {
      field: { ...scored, active: null, clearing: fullRows },
      breakdown,
      attack: breakdown.attack,
      linesCleared,
    };
  }

  const goalMet = modeGoalMet(
    mode,
    newLines,
    prev.elapsedMs,
    prev.puzzleGoal,
    tSpin,
    linesCleared,
  );
  const spawned = spawnNext(merged, prev.queue, prev.refillBags);
  return {
    field: {
      ...scored,
      board: spawned.board,
      active: goalMet ? null : spawned.active,
      queue: spawned.queue,
      cleared: goalMet,
      gameOver: goalMet || spawned.gameOver,
      pendingBreakdown: null,
      pendingTSpin: 'none',
    },
    breakdown,
    attack: 0,
    linesCleared: 0,
  };
}

export function finishClearing(prev: FieldState, mode: Mode): FieldState {
  if (!prev.clearing) return prev;
  const collapsed = clearLines(prev.board).board;
  const tSpin = prev.pendingTSpin;
  const linesCleared = prev.clearing.length;
  const goalMet = modeGoalMet(
    mode,
    prev.lines,
    prev.elapsedMs,
    prev.puzzleGoal,
    tSpin,
    linesCleared,
  );
  const spawned = spawnNext(collapsed, prev.queue, prev.refillBags);
  return {
    ...prev,
    board: spawned.board,
    active: goalMet ? null : spawned.active,
    queue: spawned.queue,
    clearing: null,
    cleared: goalMet,
    gameOver: goalMet || spawned.gameOver,
    pendingBreakdown: null,
    pendingTSpin: 'none',
  };
}
