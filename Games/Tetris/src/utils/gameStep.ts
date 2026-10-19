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
}

export function nextFromQueue(queue: TetrominoType[]): {
  type: TetrominoType;
  remaining: TetrominoType[];
} {
  if (queue.length === 0) {
    const bag = createSevenBag();
    return { type: bag[0], remaining: bag.slice(1) };
  }
  const [head, ...rest] = queue;
  let remaining = rest;
  if (remaining.length < 7) {
    remaining = [...remaining, ...createSevenBag()];
  }
  return { type: head, remaining };
}

export function createInitialField(): FieldState {
  const initialBag = createSevenBag();
  const [first, ...rest] = initialBag;
  return {
    board: createEmptyBoard(),
    active: spawnPiece(first),
    queue: rest,
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    combo: 0,
    backToBackReady: false,
    lastAction: 'spawn',
    lastKickIndex: -1,
    gameOver: false,
    paused: false,
    cleared: false,
    elapsedMs: 0,
    clearing: null,
    incomingGarbage: 0,
    pendingBreakdown: null,
    pendingTSpin: 'none',
  };
}

export function spawnNext(
  board: Cell[][],
  queue: TetrominoType[],
): { board: Cell[][]; active: ActivePiece | null; queue: TetrominoType[]; gameOver: boolean } {
  const { type, remaining } = nextFromQueue(queue);
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
    canHold: true,
    combo: breakdown.nextCombo,
    backToBackReady: breakdown.nextBackToBackReady,
    lastAction: 'spawn',
    lastKickIndex: -1,
    pendingBreakdown: linesCleared > 0 ? breakdown : null,
    pendingTSpin: tSpin,
  };

  if (linesCleared > 0) {
    return {
      field: { ...scored, active: null, clearing: fullRows },
      breakdown,
      attack: breakdown.attack,
      linesCleared,
    };
  }

  const goalMet = isGoalMet(mode, newLines, prev.elapsedMs);
  const spawned = spawnNext(merged, prev.queue);
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
  const goalMet = isGoalMet(mode, prev.lines, prev.elapsedMs);
  const spawned = spawnNext(collapsed, prev.queue);
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
