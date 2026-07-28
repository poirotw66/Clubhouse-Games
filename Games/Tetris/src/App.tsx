import { useCallback, useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import { playLose, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { TouchButton, touchControlsWrapClass } from '@clubhouse/shared/TouchButton';
import { RefreshCw, Pause, Play, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
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
  getShapeMatrix,
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
}

const GRAVITY_LEVEL_INTERVAL = 800;
const BEST_KEY = 'clubhouse:tetris-best';

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
  };
}

/**
 * Merge the active piece, clear any full lines and spawn the next piece.
 * Both the gravity path and the hard-drop path land here, and it is also where
 * a mode's line goal is detected, so the two paths cannot drift apart.
 */
function lockPiece(
  prev: GameState,
  mode: Mode,
  hardDropRows: number,
  spawnNext: (
    board: Cell[][],
    queue: TetrominoType[],
    hold: TetrominoType | null,
  ) => { board: Cell[][]; active: ActivePiece | null; queue: TetrominoType[]; gameOver: boolean },
  onClear: (linesCleared: number, addScore: number) => void,
): GameState {
  if (!prev.active) return prev;
  const merged = mergePiece(prev.board, prev.active);
  const cleared = clearLines(merged);
  const linesCleared = cleared.linesCleared;
  const newLines = prev.lines + linesCleared;
  const newLevel = 1 + Math.floor(newLines / 10);

  let addScore = 0;
  if (linesCleared === 1) addScore += 100 * newLevel;
  else if (linesCleared === 2) addScore += 300 * newLevel;
  else if (linesCleared === 3) addScore += 500 * newLevel;
  else if (linesCleared === 4) addScore += 800 * newLevel;
  if (hardDropRows > 0) addScore += hardDropRows * 2;

  if (linesCleared > 0) onClear(linesCleared, addScore);

  const goalMet = isGoalMet(mode, newLines, prev.elapsedMs);

  const spawned = spawnNext(cleared.board, prev.queue, prev.hold);

  return {
    ...prev,
    board: spawned.board,
    active: goalMet ? null : spawned.active,
    queue: spawned.queue,
    hold: prev.hold,
    canHold: true,
    score: prev.score + addScore,
    lines: newLines,
    level: newLevel,
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

  const spawnNext = useCallback((board: Cell[][], queue: TetrominoType[], hold: TetrominoType | null) => {
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

  const lockPieceAndContinue = useCallback(
    (hardDropRows: number) => {
      setState((prev) => lockPiece(prev, mode, hardDropRows, spawnNext, showClearFlash));
      lastDropTimeRef.current = performance.now();
    },
    [mode, spawnNext, showClearFlash],
  );

  const handleSoftDrop = useCallback(() => {
    setState((prev) => {
      if (!prev.active || prev.gameOver || prev.paused) return prev;
      const moved = movePiece(prev.board, prev.active, 1, 0);
      lastDropTimeRef.current = performance.now();
      if (!moved) return lockPiece(prev, mode, 0, spawnNext, showClearFlash);
      return { ...prev, active: moved };
    });
  }, [mode, spawnNext, showClearFlash]);

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

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      setState((prev) => {
        if (prev.gameOver || prev.paused || !prev.active) return prev;
        const key = event.key;
        if (key === 'ArrowLeft') {
          const moved = movePiece(prev.board, prev.active, 0, -1);
          if (!moved) return prev;
          return { ...prev, active: moved };
        }
        if (key === 'ArrowRight') {
          const moved = movePiece(prev.board, prev.active, 0, 1);
          if (!moved) return prev;
          return { ...prev, active: moved };
        }
        if (key === 'ArrowDown') {
          event.preventDefault();
          const moved = movePiece(prev.board, prev.active, 1, 0);
          if (!moved) return prev;
          return { ...prev, active: moved };
        }
        if (key === 'ArrowUp' || key === 'x' || key === 'X') {
          event.preventDefault();
          const rotated = tryRotateWithKick(prev.board, prev.active, 1);
          return { ...prev, active: rotated };
        }
        if (key === 'z' || key === 'Z') {
          event.preventDefault();
          const rotated = tryRotateWithKick(prev.board, prev.active, -1);
          return { ...prev, active: rotated };
        }
        if (key === ' ') {
          event.preventDefault();
          let piece = prev.active;
          let rows = 0;
          while (true) {
            const moved = movePiece(prev.board, piece, 1, 0);
            if (!moved) break;
            piece = moved;
            rows += 1;
          }
          // Directly lock after hard drop
          lockPieceAndContinue(rows);
          return { ...prev, active: piece };
        }
        if (key === 'c' || key === 'C' || key === 'Shift') {
          event.preventDefault();
          if (!prev.canHold) return prev;
          const currentType = prev.active.type;
          if (prev.hold === null) {
            const next = nextFromQueue(prev.queue);
            const active = spawnPiece(next.type);
            if (collides(prev.board, active)) {
              return { ...prev, active: null, queue: next.remaining, hold: currentType, gameOver: true };
            }
            return {
              ...prev,
              active,
              queue: next.remaining,
              hold: currentType,
              canHold: false,
            };
          }
          const active = spawnPiece(prev.hold);
          if (collides(prev.board, active)) {
            return { ...prev, active: null, hold: currentType, gameOver: true };
          }
          return {
            ...prev,
            active,
            hold: currentType,
            canHold: false,
          };
        }
        return prev;
      });
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const tick = () => {
      if (state.gameOver || state.paused) return;
      const now = performance.now();
      const interval = Math.max(100, GRAVITY_LEVEL_INTERVAL - (state.level - 1) * 60);
      if (now - lastDropTimeRef.current >= interval) {
        handleSoftDrop();
      }
    };
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [state.gameOver, state.paused, state.level, handleSoftDrop]);

  const handleHardDropClick = () => {
    setState((prev) => {
      if (!prev.active || prev.gameOver || prev.paused) return prev;
      let piece = prev.active;
      let rows = 0;
      while (true) {
        const moved = movePiece(prev.board, piece, 1, 0);
        if (!moved) break;
        piece = moved;
        rows += 1;
      }
      lockPieceAndContinue(rows);
      return { ...prev, active: piece };
    });
  };

  const handleMoveLeft = () => {
    setState((prev) => {
      if (!prev.active || prev.gameOver || prev.paused) return prev;
      const moved = movePiece(prev.board, prev.active, 0, -1);
      return moved ? { ...prev, active: moved } : prev;
    });
  };

  const handleMoveRight = () => {
    setState((prev) => {
      if (!prev.active || prev.gameOver || prev.paused) return prev;
      const moved = movePiece(prev.board, prev.active, 0, 1);
      return moved ? { ...prev, active: moved } : prev;
    });
  };

  const handleRotateCW = () => {
    setState((prev) => {
      if (!prev.active || prev.gameOver || prev.paused) return prev;
      return { ...prev, active: tryRotateWithKick(prev.board, prev.active, 1) };
    });
  };

  const handleHoldPiece = () => {
    setState((prev) => {
      if (!prev.active || prev.gameOver || prev.paused || !prev.canHold) return prev;
      const currentType = prev.active.type;
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
  };

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
      : '使用方向鍵與空白鍵操作；C/Hold 暫存';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-4 min-w-0">
      <BackToMenu />
      <header className="w-full max-w-5xl flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">俄羅斯方塊 Tetris</h1>
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
            <h2 className="text-xs font-semibold text-slate-300 mb-2">Hold</h2>
            <div className="w-full aspect-square bg-slate-800 rounded-lg flex items-center justify-center">
              {state.hold ? (
                <span className="text-lg font-bold">
                  {state.hold}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">尚未暫存</span>
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
          <div className="inline-block rounded-xl bg-slate-900/90 p-2 border border-slate-800 shadow-lg">
            <div
              className="grid gap-0.5 bg-slate-900 rounded-lg p-1"
              style={{
                gridTemplateColumns: `repeat(${BOARD_SIZE.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${BOARD_SIZE.rows}, minmax(0, 1fr))`,
                width: 'min(70vw, 320px)',
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
                let bg = 'bg-slate-800';
                if (cell || isActive) {
                  const type = (cell || state.active?.type) as TetrominoType;
                  if (type === 'I') bg = 'bg-cyan-400';
                  else if (type === 'O') bg = 'bg-yellow-300';
                  else if (type === 'T') bg = 'bg-purple-400';
                  else if (type === 'S') bg = 'bg-emerald-400';
                  else if (type === 'Z') bg = 'bg-red-500';
                  else if (type === 'J') bg = 'bg-blue-500';
                  else if (type === 'L') bg = 'bg-orange-400';
                } else if (isGhost) {
                  bg = 'bg-slate-500/30';
                }
                return (
                  <div
                    key={`${row}-${col}`}
                    className={`aspect-square rounded-[3px] ${bg} border border-slate-900`}
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
              <span>Space：Hard Drop</span>
              <span>C：Hold</span>
            </div>
          </div>
        </main>

        {/* Right: Next queue */}
        <aside className="sm:w-32 flex flex-col gap-3 text-xs sm:text-sm">
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <h2 className="text-xs font-semibold text-slate-300 mb-2">Next</h2>
            <div className="space-y-2">
              {state.queue.slice(0, 5).map((t, index) => (
                <div
                  key={`${t}-${index}`}
                  className="w-full aspect-[4/3] bg-slate-800 rounded-lg flex items-center justify-center p-1"
                >
                  <div className="grid grid-cols-4 grid-rows-4 gap-[2px]">
                    {getShapeMatrix(t, 0).map((row, r) =>
                      row.map((val, c) => {
                        const key = `${r}-${c}`;
                        if (!val) {
                          return (
                            <div
                              key={key}
                              className="w-3 h-3 rounded-[2px] bg-slate-700"
                            />
                          );
                        }
                        let bg = 'bg-slate-500';
                        if (t === 'I') bg = 'bg-cyan-400';
                        else if (t === 'O') bg = 'bg-yellow-300';
                        else if (t === 'T') bg = 'bg-purple-400';
                        else if (t === 'S') bg = 'bg-emerald-400';
                        else if (t === 'Z') bg = 'bg-red-500';
                        else if (t === 'J') bg = 'bg-blue-500';
                        else if (t === 'L') bg = 'bg-orange-400';
                        return (
                          <div
                            key={key}
                            className={`w-3 h-3 rounded-[2px] ${bg}`}
                          />
                        );
                      }),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className={touchControlsWrapClass}>
        <div className="flex gap-2 w-full justify-center">
          <TouchButton label="←" ariaLabel="Move left" onClick={handleMoveLeft} />
          <TouchButton label="↓" ariaLabel="Soft drop" onClick={handleSoftDrop} />
          <TouchButton label="→" ariaLabel="Move right" onClick={handleMoveRight} />
        </div>
        <div className="flex gap-2 w-full justify-center flex-wrap">
          <TouchButton label="旋轉" ariaLabel="Rotate" onClick={handleRotateCW} />
          <TouchButton label="Hard" ariaLabel="Hard drop" onClick={handleHardDropClick} accent />
          <TouchButton label="Hold" ariaLabel="Hold piece" onClick={handleHoldPiece} />
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

