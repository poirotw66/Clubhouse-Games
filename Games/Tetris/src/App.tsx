import { useCallback, useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import { playLose, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { TouchButton, touchControlsWrapClass } from '@clubhouse/shared/TouchButton';
import { RefreshCw, Pause, Play, RotateCw, ChevronLeft } from 'lucide-react';
import { PieceIcon } from './components/PieceIcon';
import type { Cell, ActivePiece, TetrominoType, Mode } from './utils/tetrisLogic';
import {
  BOARD_SIZE,
  createEmptyBoard,
  createSevenBag,
  spawnPiece,
  mergePiece,
  clearLines,
  collides,
  movePiece,
  tryRotateWithKick,
  getCellsForActive,
  TETROMINO_COLOR,
  tetrominoBlockUrl,
  MODES,
  isGoalMet,
} from './utils/tetrisLogic';

const MODE_ORDER: Mode[] = ['marathon', 'sprint', 'ultra'];

interface GameState {
  board: Cell[][];
  active: ActivePiece | null;
  queue: TetrominoType[];
  hold: TetrominoType | null;
  canHold: boolean;
  score: number;
  lines: number;
  level: number;
  gameOver: boolean;
  paused: boolean;
  /** Set when a mode's goal is met, as opposed to topping out. */
  cleared: boolean;
  /** Playing time in ms, excluding anything spent paused. */
  elapsedMs: number;
  /** Rows that are complete and flashing, before they collapse. */
  clearing: number[] | null;
}

const GRAVITY_LEVEL_INTERVAL = 800;
const BEST_KEY = 'clubhouse:tetris-best';

/** Delay before a held direction starts repeating. */
const DAS_MS = 150;
/** Repeat interval once it does. */
const ARR_MS = 35;
const SOFT_DROP_MS = 40;
/** How long a piece rests on the stack before it locks. */
const LOCK_DELAY_MS = 500;
/** Cap on lock-delay refreshes, so a piece cannot be stalled indefinitely. */
const LOCK_RESET_LIMIT = 15;
/** How long completed rows stay on screen, flashing, before they collapse. */
const CLEAR_ANIM_MS = 220;

/** m:ss.s — tenths matter when the whole point is beating your last run. */
function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function readBest(): Partial<Record<Mode, number>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBest(next: Partial<Record<Mode, number>>) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable; records are a nice-to-have */
  }
}

function nextFromQueue(queue: TetrominoType[]): { type: TetrominoType; remaining: TetrominoType[] } {
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

function getInitialGameState(): GameState {
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
    gameOver: false,
    paused: false,
    cleared: false,
    elapsedMs: 0,
    clearing: null,
  };
}

/** Row indices that are completely filled. */
function findFullRows(board: Cell[][]): number[] {
  const rows: number[] = [];
  for (let r = 0; r < board.length; r++) {
    if (board[r].every((cell) => cell !== null)) rows.push(r);
  }
  return rows;
}

/**
 * Merge the active piece into the board and score it. Both the gravity path and
 * the hard-drop path land here, so the two cannot drift apart.
 *
 * When rows complete, they are left standing and flagged in `clearing` so the
 * board can flash them; finishClearing collapses them a beat later. Score and
 * line count update immediately — only the collapse waits.
 */
function lockPiece(
  prev: GameState,
  mode: Mode,
  hardDropRows: number,
  spawnNext: (
    board: Cell[][],
    queue: TetrominoType[],
    _hold: TetrominoType | null,
  ) => { board: Cell[][]; active: ActivePiece | null; queue: TetrominoType[]; gameOver: boolean },
  onClear: (linesCleared: number, addScore: number) => void,
): GameState {
  if (!prev.active) return prev;
  const merged = mergePiece(prev.board, prev.active);
  const fullRows = findFullRows(merged);
  const linesCleared = fullRows.length;
  const newLines = prev.lines + linesCleared;
  const newLevel = 1 + Math.floor(newLines / 10);

  let addScore = 0;
  if (linesCleared === 1) addScore += 100 * newLevel;
  else if (linesCleared === 2) addScore += 300 * newLevel;
  else if (linesCleared === 3) addScore += 500 * newLevel;
  else if (linesCleared === 4) addScore += 800 * newLevel;
  if (hardDropRows > 0) addScore += hardDropRows * 2;

  const scored: GameState = {
    ...prev,
    board: merged,
    score: prev.score + addScore,
    lines: newLines,
    level: newLevel,
    canHold: true,
  };

  if (linesCleared > 0) {
    onClear(linesCleared, addScore);
    // Hold here; the active piece is off the board while the rows flash.
    return { ...scored, active: null, clearing: fullRows };
  }

  const goalMet = isGoalMet(mode, newLines, prev.elapsedMs);
  const spawned = spawnNext(merged, prev.queue, prev.hold);
  return {
    ...scored,
    board: spawned.board,
    active: goalMet ? null : spawned.active,
    queue: spawned.queue,
    cleared: goalMet,
    gameOver: goalMet || spawned.gameOver,
  };
}

/** Collapse the flashing rows and bring in the next piece. */
function finishClearing(
  prev: GameState,
  mode: Mode,
  spawnNext: (
    board: Cell[][],
    queue: TetrominoType[],
    hold: TetrominoType | null,
  ) => { board: Cell[][]; active: ActivePiece | null; queue: TetrominoType[]; gameOver: boolean },
): GameState {
  if (!prev.clearing) return prev;
  const collapsed = clearLines(prev.board).board;
  const goalMet = isGoalMet(mode, prev.lines, prev.elapsedMs);
  const spawned = spawnNext(collapsed, prev.queue, prev.hold);
  return {
    ...prev,
    board: spawned.board,
    active: goalMet ? null : spawned.active,
    queue: spawned.queue,
    clearing: null,
    cleared: goalMet,
    gameOver: goalMet || spawned.gameOver,
  };
}

export default function App() {
  const [mode, setMode] = useState<Mode>('marathon');
  const [state, setState] = useState<GameState>(getInitialGameState);
  const [best, setBest] = useState<Partial<Record<Mode, number>>>(readBest);
  const [flash, setFlash] = useState<{
    text: string;
    tone: 'good' | 'neutral';
    key: number;
  } | null>(null);
  const lastDropTimeRef = useRef<number>(performance.now());
  const wasGameOverRef = useRef(false);
  // Wall-clock anchor for the run timer; reset on start and after each unpause.
  const runStartRef = useRef<number>(performance.now());

  const showClearFlash = useCallback((linesCleared: number, addScore: number) => {
    const popupText = linesCleared === 4 ? 'TETRIS!' : `+${addScore}`;
    queueMicrotask(() => {
      playScore();
      setFlash({
        text: popupText,
        tone: linesCleared >= 3 ? 'good' : 'neutral',
        key: Date.now(),
      });
    });
  }, []);

  // `hold` is part of the callback shape lockPiece expects; spawning does not
  // consult it, since a hold swap goes through holdPiece instead.
  const spawnNext = useCallback((board: Cell[][], queue: TetrominoType[], _hold: TetrominoType | null) => {
    const { type, remaining } = nextFromQueue(queue);
    const active = spawnPiece(type);
    if (collides(board, active)) {
      return {
        board,
        active: null,
        queue: remaining,
        gameOver: true,
      };
    }
    return {
      board,
      active,
      queue: remaining,
      gameOver: false,
    };
  }, []);

  useEffect(() => {
    if (state.gameOver && !wasGameOverRef.current) {
      // Finishing a sprint or running out ultra's clock also ends the game,
      // and neither of those deserves the topped-out sting.
      if (state.cleared) playWin();
      else playLose();
    }
    wasGameOverRef.current = state.gameOver;
  }, [state.gameOver, state.cleared]);

  const startRun = useCallback((nextMode: Mode) => {
    setMode(nextMode);
    setFlash(null);
    wasGameOverRef.current = false;
    setState(getInitialGameState());
    const now = performance.now();
    lastDropTimeRef.current = now;
    runStartRef.current = now;
  }, []);

  const handleRestart = () => startRun(mode);

  // Run timer. Ticks only while playing, so pausing does not burn ultra's clock.
  useEffect(() => {
    if (state.gameOver || state.paused) return;
    runStartRef.current = performance.now() - state.elapsedMs;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (prev.gameOver || prev.paused) return prev;
        const elapsedMs = performance.now() - runStartRef.current;
        if (isGoalMet(mode, prev.lines, elapsedMs)) {
          const limit = MODES[mode].timeLimitMs;
          return {
            ...prev,
            elapsedMs: limit ?? elapsedMs,
            active: null,
            cleared: true,
            gameOver: true,
          };
        }
        return { ...prev, elapsedMs };
      });
    }, 100);
    return () => window.clearInterval(id);
    // `elapsedMs` is deliberately not a dependency: it changes every tick and
    // would restart the interval each time. It is only read to re-anchor the
    // clock when play resumes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.gameOver, state.paused, mode]);

  // Record the run once it ends: fastest time for sprint, highest score elsewhere.
  useEffect(() => {
    if (!state.gameOver) return;
    const config = MODES[mode];
    const value = config.recordKind === 'time' ? state.elapsedMs : state.score;
    // A sprint only counts if the 40 lines were actually finished.
    if (config.recordKind === 'time' && !state.cleared) return;
    setBest((prev) => {
      const current = prev[mode];
      const better =
        current === undefined ||
        (config.rank === 'fastest' ? value < current : value > current);
      if (!better) return prev;
      const next = { ...prev, [mode]: value };
      writeBest(next);
      return next;
    });
  }, [state.gameOver, state.cleared, state.elapsedMs, state.score, mode]);

  /* ------------------------------------------------------------------ *
   * Input
   *
   * Horizontal movement used to ride on the OS key-repeat, which starts
   * after ~500ms and repeats at whatever rate the system feels like — the
   * piece would stall, then bolt. The game now owns the timing: an initial
   * shift, a delay (DAS), then a steady repeat (ARR).
   *
   * Pieces also used to lock the instant they touched down, so there was no
   * chance to slide or spin one into place. They now sit for a lock delay,
   * refreshed by each successful move, up to a cap so a piece cannot be held
   * unlocked forever.
   * ------------------------------------------------------------------ */

  const held = useRef({ left: false, right: false, down: false });
  const shift = useRef<{ dir: -1 | 0 | 1; nextAt: number }>({ dir: 0, nextAt: 0 });
  const softDropAt = useRef(0);
  const lock = useRef<{ groundedAt: number | null; resets: number }>({
    groundedAt: null,
    resets: 0,
  });

  /** Whether the piece is resting on something. */
  const isGrounded = (board: Cell[][], piece: ActivePiece) =>
    movePiece(board, piece, 1, 0) === null;

  /** A successful nudge while grounded buys more time, but only so many times. */
  const refreshLock = useCallback((board: Cell[][], piece: ActivePiece, now: number) => {
    if (!isGrounded(board, piece)) {
      lock.current.groundedAt = null;
      return;
    }
    if (lock.current.resets < LOCK_RESET_LIMIT) {
      lock.current.groundedAt = now;
      lock.current.resets += 1;
    }
  }, []);

  const resetLock = useCallback(() => {
    lock.current.groundedAt = null;
    lock.current.resets = 0;
  }, []);

  const applyMove = useCallback(
    (dRow: number, dCol: number) => {
      const now = performance.now();
      setState((prev) => {
        if (!prev.active || prev.gameOver || prev.paused || prev.clearing) return prev;
        const moved = movePiece(prev.board, prev.active, dRow, dCol);
        if (!moved) return prev;
        refreshLock(prev.board, moved, now);
        return { ...prev, active: moved };
      });
    },
    [refreshLock],
  );

  const applyRotate = useCallback(
    (dir: 1 | -1) => {
      const now = performance.now();
      setState((prev) => {
        if (!prev.active || prev.gameOver || prev.paused || prev.clearing) return prev;
        const rotated = tryRotateWithKick(prev.board, prev.active, dir);
        if (rotated === prev.active) return prev;
        refreshLock(prev.board, rotated, now);
        return { ...prev, active: rotated };
      });
    },
    [refreshLock],
  );

  const hardDrop = useCallback(() => {
    setState((prev) => {
      if (!prev.active || prev.gameOver || prev.paused || prev.clearing) return prev;
      let piece = prev.active;
      let rows = 0;
      for (;;) {
        const moved = movePiece(prev.board, piece, 1, 0);
        if (!moved) break;
        piece = moved;
        rows += 1;
      }
      resetLock();
      return lockPiece({ ...prev, active: piece }, mode, rows, spawnNext, showClearFlash);
    });
    lastDropTimeRef.current = performance.now();
  }, [mode, spawnNext, showClearFlash, resetLock]);

  const holdPiece = useCallback(() => {
    setState((prev) => {
      if (!prev.active || prev.gameOver || prev.paused || prev.clearing || !prev.canHold) return prev;
      const currentType = prev.active.type;
      resetLock();
      if (prev.hold === null) {
        const next = nextFromQueue(prev.queue);
        const active = spawnPiece(next.type);
        if (collides(prev.board, active)) {
          return { ...prev, active: null, queue: next.remaining, hold: currentType, gameOver: true };
        }
        return { ...prev, active, queue: next.remaining, hold: currentType, canHold: false };
      }
      const active = spawnPiece(prev.hold);
      if (collides(prev.board, active)) {
        return { ...prev, active: null, hold: currentType, gameOver: true };
      }
      return { ...prev, active, hold: currentType, canHold: false };
    });
  }, [resetLock]);

  const startShift = useCallback(
    (dir: -1 | 1) => {
      shift.current = { dir, nextAt: performance.now() + DAS_MS };
      applyMove(0, dir);
    },
    [applyMove],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      const handled = [
        'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ',
        'z', 'Z', 'x', 'X', 'c', 'C', 'Shift', 'p', 'P',
      ].includes(key);
      if (!handled) return;
      event.preventDefault();

      if (key === 'p' || key === 'P') {
        setState((prev) => (prev.gameOver ? prev : { ...prev, paused: !prev.paused }));
        return;
      }
      // Ignore the OS key-repeat entirely; the frame loop drives repeats.
      if (event.repeat) return;

      if (key === 'ArrowLeft') {
        held.current.left = true;
        startShift(-1);
      } else if (key === 'ArrowRight') {
        held.current.right = true;
        startShift(1);
      } else if (key === 'ArrowDown') {
        held.current.down = true;
        softDropAt.current = performance.now() + SOFT_DROP_MS;
        applyMove(1, 0);
      } else if (key === 'ArrowUp' || key === 'x' || key === 'X') {
        applyRotate(1);
      } else if (key === 'z' || key === 'Z') {
        applyRotate(-1);
      } else if (key === ' ') {
        hardDrop();
      } else if (key === 'c' || key === 'C' || key === 'Shift') {
        holdPiece();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key;
      if (key === 'ArrowLeft') {
        held.current.left = false;
        if (shift.current.dir === -1) {
          // Still holding the other way? Hand the charge over rather than stop.
          if (held.current.right) startShift(1);
          else shift.current.dir = 0;
        }
      } else if (key === 'ArrowRight') {
        held.current.right = false;
        if (shift.current.dir === 1) {
          if (held.current.left) startShift(-1);
          else shift.current.dir = 0;
        }
      } else if (key === 'ArrowDown') {
        held.current.down = false;
      }
    };

    const clearHeld = () => {
      held.current = { left: false, right: false, down: false };
      shift.current.dir = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    // A tab switch swallows the keyup, which would otherwise leave a key stuck.
    window.addEventListener('blur', clearHeld);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearHeld);
    };
  }, [startShift, applyMove, applyRotate, hardDrop, holdPiece]);

  // Collapse completed rows once they have had their moment on screen.
  useEffect(() => {
    if (!state.clearing || state.paused) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(
      () => {
        setState((prev) => finishClearing(prev, mode, spawnNext));
        lastDropTimeRef.current = performance.now();
      },
      reduceMotion ? 0 : CLEAR_ANIM_MS,
    );
    return () => window.clearTimeout(timer);
  }, [state.clearing, state.paused, mode, spawnNext]);

  // One frame loop for auto-shift, soft drop, gravity and the lock delay.
  useEffect(() => {
    if (state.gameOver || state.paused) return;
    let frame = 0;

    const step = () => {
      frame = requestAnimationFrame(step);
      const now = performance.now();

      // Auto-shift: hold a direction and it repeats on our schedule, not the OS's.
      if (shift.current.dir !== 0 && now >= shift.current.nextAt) {
        applyMove(0, shift.current.dir);
        shift.current.nextAt = now + ARR_MS;
      }

      if (held.current.down && now >= softDropAt.current) {
        applyMove(1, 0);
        softDropAt.current = now + SOFT_DROP_MS;
      }

      setState((prev) => {
        if (!prev.active || prev.gameOver || prev.paused || prev.clearing) return prev;

        if (isGrounded(prev.board, prev.active)) {
          if (lock.current.groundedAt === null) {
            lock.current.groundedAt = now;
            return prev;
          }
          if (now - lock.current.groundedAt < LOCK_DELAY_MS) return prev;
          lock.current.groundedAt = null;
          lock.current.resets = 0;
          lastDropTimeRef.current = now;
          return lockPiece(prev, mode, 0, spawnNext, showClearFlash);
        }

        lock.current.groundedAt = null;
        const interval = Math.max(60, GRAVITY_LEVEL_INTERVAL - (prev.level - 1) * 60);
        if (now - lastDropTimeRef.current < interval) return prev;
        lastDropTimeRef.current = now;
        const moved = movePiece(prev.board, prev.active, 1, 0);
        return moved ? { ...prev, active: moved } : prev;
      });
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [state.gameOver, state.paused, mode, spawnNext, showClearFlash, applyMove]);

  const handleTogglePause = () => {
    setState((prev) => ({ ...prev, paused: !prev.paused }));
  };

  const ghostCells = (() => {
    if (!state.active) return new Set<string>();
    let ghost = state.active;
    while (true) {
      const moved = movePiece(state.board, ghost, 1, 0);
      if (!moved) break;
      ghost = moved;
    }
    return new Set(getCellsForActive(ghost).map((p) => `${p.row},${p.col}`));
  })();

  const statusText = state.gameOver
    ? '遊戲結束'
    : state.paused
      ? '暫停中'
      : '使用方向鍵與空白鍵操作；C 暫存';

  return (
    <div
      className="min-h-screen text-slate-50 flex flex-col items-center p-4 min-w-0 bg-cover bg-center"
      style={{
        backgroundColor: '#020617',
        backgroundImage: [
          'linear-gradient(rgba(2,6,23,0.78), rgba(2,6,23,0.9))',
          `url(${import.meta.env.BASE_URL}menu-bg.jpg)`,
        ].join(', '),
      }}
    >
      <BackToMenu />
      <header className="w-full max-w-5xl flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">俄羅斯方塊</h1>
          <div className="flex flex-wrap gap-1" role="group" aria-label="遊戲模式">
            {MODE_ORDER.map((id) => {
              const selected = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => startRun(id)}
                  aria-pressed={selected}
                  title={MODES[id].blurb}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    selected
                      ? 'bg-sky-500/20 text-sky-100 border-sky-400'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {MODES[id].label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <button
            type="button"
            onClick={handleTogglePause}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600"
          >
            {state.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            <span>{state.paused ? '繼續' : '暫停'}</span>
          </button>
          <button
            type="button"
            onClick={handleRestart}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600"
          >
            <RefreshCw className="w-4 h-4" />
            <span>重新開始</span>
          </button>
        </div>
      </header>

      <div className="w-full max-w-5xl flex flex-col sm:flex-row gap-4">
        {/* Left: stats and hold */}
        <aside className="sm:w-40 flex flex-col gap-3 text-xs sm:text-sm">
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <h2 className="text-xs font-semibold text-slate-300 mb-1">狀態</h2>
            <p className="text-slate-200 leading-snug">{statusText}</p>
          </div>
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 space-y-1">
            <div className="flex justify-between">
              <span>分數</span>
              <span className="font-mono">{state.score}</span>
            </div>
            <div className="flex justify-between">
              <span>行數</span>
              <span className="font-mono">{state.lines}</span>
            </div>
            <div className="flex justify-between">
              <span>等級</span>
              <span className="font-mono">{state.level}</span>
            </div>
            <div className="flex justify-between">
              <span>{MODES[mode].timeLimitMs !== null ? '剩餘時間' : '用時'}</span>
              <span className="font-mono tabular-nums">
                {formatTime(
                  MODES[mode].timeLimitMs !== null
                    ? MODES[mode].timeLimitMs! - state.elapsedMs
                    : state.elapsedMs,
                )}
              </span>
            </div>
            {MODES[mode].lineGoal !== null && (
              <div className="flex justify-between">
                <span>剩餘行數</span>
                <span className="font-mono tabular-nums">
                  {Math.max(0, MODES[mode].lineGoal! - state.lines)}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-800 pt-1 mt-1 text-slate-400">
              <span>最佳</span>
              <span className="font-mono tabular-nums">
                {best[mode] === undefined
                  ? '—'
                  : MODES[mode].recordKind === 'time'
                    ? formatTime(best[mode]!)
                    : best[mode]}
              </span>
            </div>
          </div>
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <h2 className="text-xs font-semibold text-slate-300 mb-2">暫存</h2>
            <div
              className={`w-full aspect-square bg-slate-800 rounded-lg flex items-center justify-center transition-opacity ${
                state.canHold ? '' : 'opacity-40'
              }`}
              title={state.canHold ? undefined : '本回合已使用過暫存'}
            >
              {state.hold ? (
                <PieceIcon type={state.hold} cell={14} />
              ) : (
                <span className="text-[10px] text-slate-400">尚未暫存</span>
              )}
            </div>
          </div>
        </aside>

        {/* Center: board */}
        <main className="flex-1 flex justify-center relative">
          {flash && (
            <ScoreFlash
              text={flash.text}
              tone={flash.tone}
              flashKey={flash.key}
              onDone={() => setFlash(null)}
            />
          )}
          <div className="inline-block rounded-xl bg-slate-900/80 p-2 border border-slate-800 shadow-lg backdrop-blur-sm">
            <div
              className="grid gap-0.5 rounded-lg p-1 bg-cover bg-center"
              style={{
                gridTemplateColumns: `repeat(${BOARD_SIZE.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${BOARD_SIZE.rows}, minmax(0, 1fr))`,
                width: 'min(70vw, 320px)',
                backgroundColor: '#0f172a',
                backgroundImage: [
                  'linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.72))',
                  `url(${import.meta.env.BASE_URL}well-bg.jpg)`,
                ].join(', '),
              }}
            >
              {Array.from({ length: BOARD_SIZE.rows * BOARD_SIZE.cols }, (_, index) => {
                const row = Math.floor(index / BOARD_SIZE.cols);
                const col = index % BOARD_SIZE.cols;
                const cell = state.board[row][col];
                const isActive =
                  state.active &&
                  getCellsForActive(state.active).some((p) => p.row === row && p.col === col);
                const isGhost = ghostCells.has(`${row},${col}`) && !cell;
                const isClearing = state.clearing?.includes(row) ?? false;
                let bg = 'bg-slate-800/40';
                let tileStyle: { backgroundImage: string; backgroundSize: string; backgroundPosition: string } | undefined;
                if (cell || isActive) {
                  const type = (cell || state.active?.type) as TetrominoType;
                  bg = TETROMINO_COLOR[type];
                  tileStyle = {
                    backgroundImage: `url(${tetrominoBlockUrl(type)})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  };
                } else if (isGhost) {
                  bg = 'bg-slate-500/30';
                }
                return (
                  <div
                    key={`${row}-${col}`}
                    className={`aspect-square rounded-[3px] ${bg} border border-slate-900/80${
                      isClearing ? ' tetris-clearing' : ''
                    }`}
                    style={tileStyle}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex justify-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" />
                <span>左右：平移</span>
              </div>
              <div className="flex items-center gap-1">
                <RotateCw className="w-3 h-3" />
                <span>↑ / Z / X：旋轉</span>
              </div>
            </div>
            <div className="mt-1 flex justify-center gap-3 text-xs text-slate-400">
              <span>↓：加速落下</span>
              <span>空白鍵：瞬間落下</span>
              <span>C：暫存</span>
            </div>
          </div>
        </main>

        {/* Right: Next queue */}
        <aside className="sm:w-32 flex flex-col gap-3 text-xs sm:text-sm">
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <h2 className="text-xs font-semibold text-slate-300 mb-2">下一個</h2>
            <div className="space-y-2">
              {state.queue.slice(0, 5).map((t, index) => (
                <div
                  key={`${t}-${index}`}
                  className="w-full aspect-[4/3] bg-slate-800 rounded-lg flex items-center justify-center p-1"
                >
                  <PieceIcon type={t} cell={index === 0 ? 12 : 9} />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className={touchControlsWrapClass}>
        <div className="flex gap-2 w-full justify-center">
          <TouchButton label="←" ariaLabel="Move left" onClick={() => applyMove(0, -1)} />
          <TouchButton label="↓" ariaLabel="Soft drop" onClick={() => applyMove(1, 0)} />
          <TouchButton label="→" ariaLabel="Move right" onClick={() => applyMove(0, 1)} />
        </div>
        <div className="flex gap-2 w-full justify-center flex-wrap">
          <TouchButton label="旋轉" ariaLabel="Rotate" onClick={() => applyRotate(1)} />
          <TouchButton label="落下" ariaLabel="瞬間落下" onClick={hardDrop} accent />
          <TouchButton label="暫存" ariaLabel="暫存方塊" onClick={holdPiece} />
        </div>
      </div>
      <p className="md:hidden text-xs text-slate-500 mt-2 text-center">使用下方按鈕操作方塊</p>

      {state.gameOver && (
        <ResultOverlay
          title={
            state.cleared
              ? mode === 'sprint'
                ? `完成 40 行！${formatTime(state.elapsedMs)}`
                : '時間到'
              : '遊戲結束'
          }
          variant={state.cleared ? 'win' : 'lose'}
          stats={[
            { label: '分數', value: state.score },
            { label: '消除行數', value: state.lines },
            MODES[mode].recordKind === 'time'
              ? { label: '用時', value: formatTime(state.elapsedMs) }
              : { label: '等級', value: state.level },
            {
              label: '最佳',
              value:
                best[mode] === undefined
                  ? '—'
                  : MODES[mode].recordKind === 'time'
                    ? formatTime(best[mode]!)
                    : String(best[mode]),
            },
          ]}
          onPrimary={handleRestart}
        />
      )}
    </div>
  );
}

