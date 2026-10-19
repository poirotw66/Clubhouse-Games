import { useCallback, useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import { playGoal, playLose, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { TouchButton, touchControlsWrapClass } from '@clubhouse/shared/TouchButton';
import { RefreshCw, Pause, Play, RotateCw, ChevronLeft } from 'lucide-react';
import { BoardWell } from './components/BoardWell';
import { PieceIcon } from './components/PieceIcon';
import type { Difficulty, Mode, ScoreBreakdown, TetrominoType } from './utils/tetrisLogic';
import {
  BOARD_SIZE,
  MODES,
  applyGarbage,
  cancelGarbage,
  collides,
  formatClearCallouts,
  isGoalMet,
  movePiece,
  spawnPiece,
  tryRotateWithKick,
} from './utils/tetrisLogic';
import {
  DIFFICULTY_PRESETS,
  findBestPlacement,
  thinkDelayMs,
  type DifficultyPreset,
} from './utils/cpuAi';
import {
  createInitialField,
  finishClearing,
  lockPiece,
  nextFromQueue,
  type FieldState,
} from './utils/gameStep';

const MODE_ORDER: Mode[] = ['marathon', 'sprint', 'ultra', 'versus'];
const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];

const GRAVITY_LEVEL_INTERVAL = 800;
const BEST_KEY = 'clubhouse:tetris-best';
const VERSUS_KEY = 'clubhouse-tetris-versus';

const DAS_MS = 150;
const ARR_MS = 35;
const SOFT_DROP_MS = 40;
const LOCK_DELAY_MS = 500;
const LOCK_RESET_LIMIT = 15;
const CLEAR_ANIM_MS = 220;

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, ms) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function readBest(): Partial<Record<'marathon' | 'sprint' | 'ultra', number>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(BEST_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBest(next: Partial<Record<'marathon' | 'sprint' | 'ultra', number>>) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

interface VersusStats {
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
  lastDifficulty: Difficulty;
}

function readVersusStats(): VersusStats {
  try {
    const parsed = JSON.parse(localStorage.getItem(VERSUS_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object') {
      return { wins: 0, losses: 0, streak: 0, bestStreak: 0, lastDifficulty: 'normal' };
    }
    return {
      wins: Number(parsed.wins) || 0,
      losses: Number(parsed.losses) || 0,
      streak: Number(parsed.streak) || 0,
      bestStreak: Number(parsed.bestStreak) || 0,
      lastDifficulty:
        parsed.lastDifficulty === 'easy' ||
        parsed.lastDifficulty === 'normal' ||
        parsed.lastDifficulty === 'hard'
          ? parsed.lastDifficulty
          : 'normal',
    };
  } catch {
    return { wins: 0, losses: 0, streak: 0, bestStreak: 0, lastDifficulty: 'normal' };
  }
}

function writeVersusStats(next: VersusStats) {
  try {
    localStorage.setItem(VERSUS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

function playClearFeedback(breakdown: ScoreBreakdown) {
  if (breakdown.nextCombo >= 2 || breakdown.isBackToBack || breakdown.label.includes('T-SPIN')) {
    playGoal();
  } else {
    playScore();
  }
}

function flashTone(breakdown: ScoreBreakdown): 'good' | 'neutral' {
  if (
    breakdown.isBackToBack ||
    breakdown.label.includes('TETRIS') ||
    breakdown.label.includes('T-SPIN') ||
    breakdown.nextCombo >= 3
  ) {
    return 'good';
  }
  return 'neutral';
}

export default function App() {
  const [mode, setMode] = useState<Mode>('marathon');
  const [difficulty, setDifficulty] = useState<Difficulty>(readVersusStats().lastDifficulty);
  const [player, setPlayer] = useState<FieldState>(createInitialField);
  const [cpu, setCpu] = useState<FieldState>(createInitialField);
  const [best, setBest] = useState(readBest);
  const [versusStats, setVersusStats] = useState(readVersusStats);
  const [versusWinner, setVersusWinner] = useState<'player' | 'cpu' | null>(null);
  const [flash, setFlash] = useState<{
    text: string;
    tone: 'good' | 'neutral';
    key: number;
  } | null>(null);
  const [cpuFlash, setCpuFlash] = useState<{
    text: string;
    tone: 'good' | 'neutral';
    key: number;
  } | null>(null);

  const lastDropTimeRef = useRef(performance.now());
  const cpuDropTimeRef = useRef(performance.now());
  const wasGameOverRef = useRef(false);
  const runStartRef = useRef(performance.now());
  const softDropRowsRef = useRef(0);
  const cpuSoftDropRef = useRef(0);
  const cpuPlanRef = useRef<{
    rotation: number;
    col: number;
    readyAt: number;
    hardDrop: boolean;
  } | null>(null);
  const versusSettledRef = useRef(false);

  const isVersus = mode === 'versus';
  const preset: DifficultyPreset = DIFFICULTY_PRESETS[difficulty];

  const showPlayerFlash = useCallback((breakdown: ScoreBreakdown) => {
    const callouts = formatClearCallouts(breakdown);
    if (callouts.length === 0 && breakdown.total <= 0) return;
    const text =
      callouts.length > 0 ? callouts.join(' · ') : `+${breakdown.total}`;
    queueMicrotask(() => {
      playClearFeedback(breakdown);
      setFlash({ text, tone: flashTone(breakdown), key: Date.now() });
    });
  }, []);

  const showCpuFlash = useCallback((breakdown: ScoreBreakdown) => {
    const callouts = formatClearCallouts(breakdown);
    if (callouts.length === 0) return;
    queueMicrotask(() => {
      setCpuFlash({
        text: callouts.join(' · '),
        tone: flashTone(breakdown),
        key: Date.now(),
      });
    });
  }, []);

  const startRun = useCallback((nextMode: Mode, nextDifficulty: Difficulty = difficulty) => {
    setMode(nextMode);
    setDifficulty(nextDifficulty);
    setFlash(null);
    setCpuFlash(null);
    setVersusWinner(null);
    versusSettledRef.current = false;
    wasGameOverRef.current = false;
    softDropRowsRef.current = 0;
    cpuSoftDropRef.current = 0;
    cpuPlanRef.current = null;
    setPlayer(createInitialField());
    setCpu(createInitialField());
    const now = performance.now();
    lastDropTimeRef.current = now;
    cpuDropTimeRef.current = now;
    runStartRef.current = now;
  }, [difficulty]);

  const handleRestart = () => startRun(mode, difficulty);

  useEffect(() => {
    const ended =
      player.gameOver || (isVersus && (cpu.gameOver || versusWinner !== null));
    if (ended && !wasGameOverRef.current) {
      if (isVersus) {
        if (versusWinner === 'player') playWin();
        else playLose();
      } else if (player.cleared) {
        playWin();
      } else {
        playLose();
      }
    }
    wasGameOverRef.current = ended;
  }, [player.gameOver, player.cleared, cpu.gameOver, isVersus, versusWinner]);

  // Solo run timer.
  useEffect(() => {
    if (isVersus || player.gameOver || player.paused) return;
    runStartRef.current = performance.now() - player.elapsedMs;
    const id = window.setInterval(() => {
      setPlayer((prev) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.gameOver, player.paused, mode, isVersus]);

  // Solo personal bests.
  useEffect(() => {
    if (isVersus || !player.gameOver) return;
    const soloMode = mode as 'marathon' | 'sprint' | 'ultra';
    const config = MODES[soloMode];
    const value = config.recordKind === 'time' ? player.elapsedMs : player.score;
    if (config.recordKind === 'time' && !player.cleared) return;
    setBest((prev) => {
      const current = prev[soloMode];
      const better =
        current === undefined ||
        (config.rank === 'fastest' ? value < current : value > current);
      if (!better) return prev;
      const next = { ...prev, [soloMode]: value };
      writeBest(next);
      return next;
    });
  }, [player.gameOver, player.cleared, player.elapsedMs, player.score, mode, isVersus]);

  // Versus win/loss + streak.
  useEffect(() => {
    if (!isVersus || versusSettledRef.current) return;
    let winner: 'player' | 'cpu' | null = null;
    if (cpu.gameOver && !player.gameOver) winner = 'player';
    else if (player.gameOver && !cpu.gameOver) winner = 'cpu';
    else if (player.gameOver && cpu.gameOver) winner = 'cpu';
    if (!winner) return;
    versusSettledRef.current = true;
    setVersusWinner(winner);
    setVersusStats((prev) => {
      const wins = prev.wins + (winner === 'player' ? 1 : 0);
      const losses = prev.losses + (winner === 'cpu' ? 1 : 0);
      const streak = winner === 'player' ? prev.streak + 1 : 0;
      const bestStreak = Math.max(prev.bestStreak, streak);
      const next = {
        wins,
        losses,
        streak,
        bestStreak,
        lastDifficulty: difficulty,
      };
      writeVersusStats(next);
      return next;
    });
  }, [isVersus, player.gameOver, cpu.gameOver, difficulty]);

  const held = useRef({ left: false, right: false, down: false });
  const shift = useRef<{ dir: -1 | 0 | 1; nextAt: number }>({ dir: 0, nextAt: 0 });
  const softDropAt = useRef(0);
  const lock = useRef<{ groundedAt: number | null; resets: number }>({
    groundedAt: null,
    resets: 0,
  });

  const isGrounded = (board: FieldState['board'], piece: NonNullable<FieldState['active']>) =>
    movePiece(board, piece, 1, 0) === null;

  const refreshLock = useCallback(
    (board: FieldState['board'], piece: NonNullable<FieldState['active']>, now: number) => {
      if (!isGrounded(board, piece)) {
        lock.current.groundedAt = null;
        return;
      }
      if (lock.current.resets < LOCK_RESET_LIMIT) {
        lock.current.groundedAt = now;
        lock.current.resets += 1;
      }
    },
    [],
  );

  const resetLock = useCallback(() => {
    lock.current.groundedAt = null;
    lock.current.resets = 0;
    softDropRowsRef.current = 0;
  }, []);

  const deliverAttack = useCallback(
    (
      attacker: 'player' | 'cpu',
      attack: number,
    ) => {
      if (attack <= 0 || !isVersus) return;
      if (attacker === 'player') {
        setPlayer((p) => {
          const cancelled = cancelGarbage(p.incomingGarbage, attack);
          if (cancelled.outgoing > 0) {
            setCpu((c) => ({
              ...c,
              incomingGarbage: c.incomingGarbage + cancelled.outgoing,
            }));
          }
          return { ...p, incomingGarbage: cancelled.incoming };
        });
      } else {
        setCpu((c) => {
          const cancelled = cancelGarbage(c.incomingGarbage, attack);
          if (cancelled.outgoing > 0) {
            setPlayer((p) => ({
              ...p,
              incomingGarbage: p.incomingGarbage + cancelled.outgoing,
            }));
          }
          return { ...c, incomingGarbage: cancelled.incoming };
        });
      }
    },
    [isVersus],
  );

  const maybeDropGarbage = useCallback(
    (field: FieldState, cap: number): FieldState => {
      if (field.incomingGarbage <= 0 || field.active === null) return field;
      const drop = Math.min(field.incomingGarbage, cap);
      const hole = Math.floor(Math.random() * BOARD_SIZE.cols);
      const nextBoard = applyGarbage(field.board, drop, hole);
      if (!nextBoard) {
        return { ...field, gameOver: true, active: null };
      }
      if (field.active && collides(nextBoard, field.active)) {
        return {
          ...field,
          board: nextBoard,
          incomingGarbage: field.incomingGarbage - drop,
          gameOver: true,
          active: null,
        };
      }
      return {
        ...field,
        board: nextBoard,
        incomingGarbage: field.incomingGarbage - drop,
      };
    },
    [],
  );

  const applyMove = useCallback(
    (dRow: number, dCol: number) => {
      const now = performance.now();
      setPlayer((prev) => {
        if (!prev.active || prev.gameOver || prev.paused || prev.clearing) return prev;
        if (isVersus && versusWinner) return prev;
        const moved = movePiece(prev.board, prev.active, dRow, dCol);
        if (!moved) return prev;
        if (dRow > 0) softDropRowsRef.current += dRow;
        refreshLock(prev.board, moved, now);
        return { ...prev, active: moved, lastAction: 'move' };
      });
    },
    [refreshLock, isVersus, versusWinner],
  );

  const applyRotate = useCallback(
    (dir: 1 | -1) => {
      const now = performance.now();
      setPlayer((prev) => {
        if (!prev.active || prev.gameOver || prev.paused || prev.clearing) return prev;
        if (isVersus && versusWinner) return prev;
        const { piece: rotated, kickIndex } = tryRotateWithKick(
          prev.board,
          prev.active,
          dir,
        );
        if (kickIndex < 0) return prev;
        refreshLock(prev.board, rotated, now);
        return {
          ...prev,
          active: rotated,
          lastAction: 'rotate',
          lastKickIndex: kickIndex,
        };
      });
    },
    [refreshLock, isVersus, versusWinner],
  );

  const hardDrop = useCallback(() => {
    setPlayer((prev) => {
      if (!prev.active || prev.gameOver || prev.paused || prev.clearing) return prev;
      if (isVersus && versusWinner) return prev;
      let piece = prev.active;
      let rows = 0;
      for (;;) {
        const moved = movePiece(prev.board, piece, 1, 0);
        if (!moved) break;
        piece = moved;
        rows += 1;
      }
      const soft = softDropRowsRef.current;
      resetLock();
      const outcome = lockPiece(
        { ...prev, active: piece, lastAction: 'drop' },
        mode,
        rows,
        soft,
      );
      if (outcome.breakdown && outcome.linesCleared > 0) {
        showPlayerFlash(outcome.breakdown);
      }
      if (outcome.attack > 0) {
        queueMicrotask(() => deliverAttack('player', outcome.attack));
      }
      let field = outcome.field;
      if (isVersus && !field.clearing && field.active) {
        field = maybeDropGarbage(field, 99);
      }
      return field;
    });
    lastDropTimeRef.current = performance.now();
  }, [
    mode,
    resetLock,
    showPlayerFlash,
    deliverAttack,
    isVersus,
    versusWinner,
    maybeDropGarbage,
  ]);

  const holdPiece = useCallback(() => {
    setPlayer((prev) => {
      if (!prev.active || prev.gameOver || prev.paused || prev.clearing || !prev.canHold) {
        return prev;
      }
      if (isVersus && versusWinner) return prev;
      const currentType = prev.active.type;
      resetLock();
      if (prev.hold === null) {
        const next = nextFromQueue(prev.queue);
        const active = spawnPiece(next.type);
        if (collides(prev.board, active)) {
          return {
            ...prev,
            active: null,
            queue: next.remaining,
            hold: currentType,
            gameOver: true,
          };
        }
        return {
          ...prev,
          active,
          queue: next.remaining,
          hold: currentType,
          canHold: false,
          lastAction: 'spawn',
          lastKickIndex: -1,
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
        lastAction: 'spawn',
        lastKickIndex: -1,
      };
    });
  }, [resetLock, isVersus, versusWinner]);

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
        'ArrowLeft',
        'ArrowRight',
        'ArrowDown',
        'ArrowUp',
        ' ',
        'z',
        'Z',
        'x',
        'X',
        'c',
        'C',
        'Shift',
        'p',
        'P',
      ].includes(key);
      if (!handled) return;
      event.preventDefault();

      if (key === 'p' || key === 'P') {
        setPlayer((prev) => (prev.gameOver ? prev : { ...prev, paused: !prev.paused }));
        return;
      }
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
    window.addEventListener('blur', clearHeld);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearHeld);
    };
  }, [startShift, applyMove, applyRotate, hardDrop, holdPiece]);

  // Player clear animation finish.
  useEffect(() => {
    if (!player.clearing || player.paused) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(
      () => {
        setPlayer((prev) => {
          let next = finishClearing(prev, mode);
          if (isVersus && next.active && !next.gameOver) {
            next = maybeDropGarbage(next, 99);
          }
          return next;
        });
        lastDropTimeRef.current = performance.now();
      },
      reduceMotion ? 0 : CLEAR_ANIM_MS,
    );
    return () => window.clearTimeout(timer);
  }, [player.clearing, player.paused, mode, isVersus, maybeDropGarbage]);

  // CPU clear animation finish.
  useEffect(() => {
    if (!isVersus || !cpu.clearing || player.paused) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(
      () => {
        setCpu((prev) => {
          let next = finishClearing(prev, 'versus');
          if (next.active && !next.gameOver) {
            next = maybeDropGarbage(next, preset.garbageDropCap);
          }
          cpuPlanRef.current = null;
          return next;
        });
        cpuDropTimeRef.current = performance.now();
      },
      reduceMotion ? 0 : CLEAR_ANIM_MS,
    );
    return () => window.clearTimeout(timer);
  }, [cpu.clearing, player.paused, isVersus, maybeDropGarbage, preset.garbageDropCap]);

  // Player frame loop.
  useEffect(() => {
    if (player.gameOver || player.paused || (isVersus && versusWinner)) return;
    let frame = 0;

    const step = () => {
      frame = requestAnimationFrame(step);
      const now = performance.now();

      if (shift.current.dir !== 0 && now >= shift.current.nextAt) {
        applyMove(0, shift.current.dir);
        shift.current.nextAt = now + ARR_MS;
      }

      if (held.current.down && now >= softDropAt.current) {
        applyMove(1, 0);
        softDropAt.current = now + SOFT_DROP_MS;
      }

      setPlayer((prev) => {
        if (!prev.active || prev.gameOver || prev.paused || prev.clearing) return prev;
        if (isVersus && versusWinner) return prev;

        if (isGrounded(prev.board, prev.active)) {
          if (lock.current.groundedAt === null) {
            lock.current.groundedAt = now;
            return prev;
          }
          if (now - lock.current.groundedAt < LOCK_DELAY_MS) return prev;
          lock.current.groundedAt = null;
          lock.current.resets = 0;
          lastDropTimeRef.current = now;
          const soft = softDropRowsRef.current;
          softDropRowsRef.current = 0;
          const outcome = lockPiece(prev, mode, 0, soft);
          if (outcome.breakdown && outcome.linesCleared > 0) {
            showPlayerFlash(outcome.breakdown);
          }
          if (outcome.attack > 0) {
            queueMicrotask(() => deliverAttack('player', outcome.attack));
          }
          let field = outcome.field;
          if (isVersus && !field.clearing && field.active) {
            field = maybeDropGarbage(field, 99);
          }
          return field;
        }

        lock.current.groundedAt = null;
        const interval = Math.max(60, GRAVITY_LEVEL_INTERVAL - (prev.level - 1) * 60);
        if (now - lastDropTimeRef.current < interval) return prev;
        lastDropTimeRef.current = now;
        const moved = movePiece(prev.board, prev.active, 1, 0);
        return moved ? { ...prev, active: moved, lastAction: 'move' } : prev;
      });
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [
    player.gameOver,
    player.paused,
    mode,
    applyMove,
    showPlayerFlash,
    deliverAttack,
    isVersus,
    versusWinner,
    maybeDropGarbage,
  ]);

  // CPU think + act loop (versus only).
  useEffect(() => {
    if (!isVersus || player.paused || player.gameOver || cpu.gameOver || versusWinner) {
      return;
    }
    let frame = 0;

    const step = () => {
      frame = requestAnimationFrame(step);
      const now = performance.now();

      setCpu((prev) => {
        if (!prev.active || prev.gameOver || prev.clearing) return prev;

        if (!cpuPlanRef.current) {
          const plan = findBestPlacement(
            prev.board,
            prev.active.type,
            prev.queue[0] ?? null,
            preset,
            {
              backToBackReady: prev.backToBackReady,
              combo: prev.combo,
              level: prev.level,
            },
          );
          if (!plan) {
            // No legal placement — top out.
            return { ...prev, gameOver: true, active: null };
          }
          cpuPlanRef.current = {
            rotation: plan.rotation,
            col: plan.col,
            readyAt: now + thinkDelayMs(preset),
            hardDrop: false,
          };
          return prev;
        }

        const plan = cpuPlanRef.current;
        if (now < plan.readyAt) return prev;

        let piece = prev.active;
        let board = prev.board;
        let lastAction = prev.lastAction;
        let lastKickIndex = prev.lastKickIndex;

        // Rotate toward target.
        let rotGuard = 0;
        while (piece.rotation !== plan.rotation && rotGuard < 4) {
          const { piece: next, kickIndex } = tryRotateWithKick(board, piece, 1);
          if (kickIndex < 0) break;
          piece = next;
          lastAction = 'rotate';
          lastKickIndex = kickIndex;
          rotGuard += 1;
        }

        // Shift toward target column.
        const targetCol = plan.col;
        let shiftGuard = 0;
        while (piece.position.col !== targetCol && shiftGuard < 12) {
          const dir = targetCol > piece.position.col ? 1 : -1;
          const moved = movePiece(board, piece, 0, dir);
          if (!moved) break;
          piece = moved;
          lastAction = 'move';
          shiftGuard += 1;
        }

        // Hard drop.
        let rows = 0;
        for (;;) {
          const moved = movePiece(board, piece, 1, 0);
          if (!moved) break;
          piece = moved;
          rows += 1;
        }

        cpuPlanRef.current = null;
        cpuSoftDropRef.current = 0;
        const outcome = lockPiece(
          {
            ...prev,
            active: piece,
            lastAction: lastAction === 'rotate' ? 'rotate' : 'drop',
            lastKickIndex,
          },
          'versus',
          rows,
          0,
        );
        if (outcome.breakdown && outcome.linesCleared > 0) {
          showCpuFlash(outcome.breakdown);
        }
        if (outcome.attack > 0) {
          queueMicrotask(() => deliverAttack('cpu', outcome.attack));
        }
        let field = outcome.field;
        if (!field.clearing && field.active) {
          field = maybeDropGarbage(field, preset.garbageDropCap);
        }
        cpuDropTimeRef.current = now;
        return field;
      });
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [
    isVersus,
    player.paused,
    player.gameOver,
    cpu.gameOver,
    versusWinner,
    preset,
    showCpuFlash,
    deliverAttack,
    maybeDropGarbage,
  ]);

  const handleTogglePause = () => {
    setPlayer((prev) => ({ ...prev, paused: !prev.paused }));
  };

  const gameOver =
    player.gameOver || (isVersus && (cpu.gameOver || versusWinner !== null));

  const statusText = gameOver
    ? isVersus
      ? versusWinner === 'player'
        ? '勝利！'
        : '敗北…'
      : '遊戲結束'
    : player.paused
      ? '暫停中'
      : isVersus
        ? `對戰中（CPU：${preset.label}）`
        : '使用方向鍵與空白鍵操作；C 暫存';

  const wellWidth = isVersus ? 240 : 320;

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
      <header className="w-full max-w-6xl flex flex-col gap-2 mb-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight">俄羅斯方塊</h1>
            <div className="flex flex-wrap gap-1" role="group" aria-label="遊戲模式">
              {MODE_ORDER.map((id) => {
                const selected = mode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => startRun(id, difficulty)}
                    aria-pressed={selected}
                    title={MODES[id].blurb}
                    className={`text-xs min-h-[44px] px-3 py-2 rounded-full border transition-colors touch-manipulation ${
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
            {isVersus && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="CPU 難度">
                {DIFFICULTY_ORDER.map((id) => {
                  const selected = difficulty === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => startRun('versus', id)}
                      aria-pressed={selected}
                      className={`text-xs min-h-[44px] px-3 py-2 rounded-full border transition-colors touch-manipulation ${
                        selected
                          ? 'bg-amber-500/20 text-amber-100 border-amber-400'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {DIFFICULTY_PRESETS[id].label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <button
              type="button"
              onClick={handleTogglePause}
              className="inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 touch-manipulation"
            >
              {player.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              <span>{player.paused ? '繼續' : '暫停'}</span>
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 touch-manipulation"
            >
              <RefreshCw className="w-4 h-4" />
              <span>重新開始</span>
            </button>
          </div>
        </div>
      </header>

      <div className={`w-full max-w-6xl flex flex-col ${isVersus ? 'lg:flex-row' : 'sm:flex-row'} gap-4`}>
        <aside className="sm:w-40 flex flex-col gap-3 text-xs sm:text-sm">
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <h2 className="text-xs font-semibold text-slate-300 mb-1">狀態</h2>
            <p className="text-slate-200 leading-snug">{statusText}</p>
          </div>
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800 space-y-1">
            <div className="flex justify-between">
              <span>分數</span>
              <span className="font-mono">{player.score}</span>
            </div>
            <div className="flex justify-between">
              <span>行數</span>
              <span className="font-mono">{player.lines}</span>
            </div>
            <div className="flex justify-between">
              <span>等級</span>
              <span className="font-mono">{player.level}</span>
            </div>
            {player.combo > 0 && (
              <div className="flex justify-between text-amber-200">
                <span>連擊</span>
                <span className="font-mono">{player.combo}</span>
              </div>
            )}
            {player.backToBackReady && (
              <div className="text-[10px] text-sky-300 tracking-wide tetris-b2b-ready">
                B2B READY
              </div>
            )}
            {!isVersus && (
              <>
                <div className="flex justify-between">
                  <span>{MODES[mode].timeLimitMs !== null ? '剩餘時間' : '用時'}</span>
                  <span className="font-mono tabular-nums">
                    {formatTime(
                      MODES[mode].timeLimitMs !== null
                        ? MODES[mode].timeLimitMs! - player.elapsedMs
                        : player.elapsedMs,
                    )}
                  </span>
                </div>
                {MODES[mode].lineGoal !== null && (
                  <div className="flex justify-between">
                    <span>剩餘行數</span>
                    <span className="font-mono tabular-nums">
                      {Math.max(0, MODES[mode].lineGoal! - player.lines)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-800 pt-1 mt-1 text-slate-400">
                  <span>最佳</span>
                  <span className="font-mono tabular-nums">
                    {best[mode as 'marathon' | 'sprint' | 'ultra'] === undefined
                      ? '—'
                      : MODES[mode].recordKind === 'time'
                        ? formatTime(best[mode as 'sprint']!)
                        : best[mode as 'marathon' | 'ultra']}
                  </span>
                </div>
              </>
            )}
            {isVersus && (
              <>
                <div className="flex justify-between text-rose-300">
                  <span>垃圾佇列</span>
                  <span className="font-mono">{player.incomingGarbage}</span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-1 mt-1 text-slate-400">
                  <span>戰績</span>
                  <span className="font-mono tabular-nums">
                    {versusStats.wins}勝 {versusStats.losses}敗
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>連勝</span>
                  <span className="font-mono">{versusStats.streak}</span>
                </div>
              </>
            )}
          </div>
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <h2 className="text-xs font-semibold text-slate-300 mb-2">暫存</h2>
            <div
              className={`w-full aspect-square bg-slate-800 rounded-lg flex items-center justify-center transition-opacity ${
                player.canHold ? '' : 'opacity-40'
              }`}
            >
              {player.hold ? (
                <PieceIcon type={player.hold} cell={14} />
              ) : (
                <span className="text-[10px] text-slate-400">尚未暫存</span>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-wrap justify-center gap-4 relative">
          <div className="relative inline-block rounded-xl bg-slate-900/80 p-2 border border-slate-800 shadow-lg backdrop-blur-sm">
            <div className="text-center text-xs text-slate-300 mb-1 font-semibold">
              玩家
              {player.incomingGarbage > 0 && (
                <span className="ml-2 text-rose-300">↓{player.incomingGarbage}</span>
              )}
            </div>
            {flash && (
              <ScoreFlash
                text={flash.text}
                tone={flash.tone}
                flashKey={flash.key}
                onDone={() => setFlash(null)}
              />
            )}
            <BoardWell
              board={player.board}
              active={player.active}
              clearing={player.clearing}
              widthPx={wellWidth}
            />
            {!isVersus && (
              <>
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
              </>
            )}
          </div>

          {isVersus && (
            <div className="relative inline-block rounded-xl bg-slate-900/80 p-2 border border-slate-800 shadow-lg backdrop-blur-sm">
              <div className="text-center text-xs text-slate-300 mb-1 font-semibold">
                CPU · {preset.label}
                {cpu.incomingGarbage > 0 && (
                  <span className="ml-2 text-rose-300">↓{cpu.incomingGarbage}</span>
                )}
              </div>
              {cpuFlash && (
                <ScoreFlash
                  text={cpuFlash.text}
                  tone={cpuFlash.tone}
                  flashKey={cpuFlash.key}
                  onDone={() => setCpuFlash(null)}
                />
              )}
              <BoardWell
                board={cpu.board}
                active={cpu.active}
                clearing={cpu.clearing}
                widthPx={wellWidth}
                showGhost={false}
              />
              <div className="mt-2 text-center text-[10px] text-slate-500 font-mono">
                {cpu.score} 分 · {cpu.lines} 行
              </div>
            </div>
          )}
        </main>

        <aside className="sm:w-32 flex flex-col gap-3 text-xs sm:text-sm">
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <h2 className="text-xs font-semibold text-slate-300 mb-2">下一個</h2>
            <div className="space-y-2">
              {player.queue.slice(0, isVersus ? 3 : 5).map((t: TetrominoType, index: number) => (
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
          <TouchButton label="←" ariaLabel="向左" onClick={() => applyMove(0, -1)} />
          <TouchButton label="↓" ariaLabel="軟降" onClick={() => applyMove(1, 0)} />
          <TouchButton label="→" ariaLabel="向右" onClick={() => applyMove(0, 1)} />
        </div>
        <div className="flex gap-2 w-full justify-center flex-wrap">
          <TouchButton label="旋轉" ariaLabel="旋轉" onClick={() => applyRotate(1)} />
          <TouchButton label="落下" ariaLabel="瞬間落下" onClick={hardDrop} accent />
          <TouchButton label="暫存" ariaLabel="暫存方塊" onClick={holdPiece} />
        </div>
      </div>
      <p className="md:hidden text-xs text-slate-500 mt-2 text-center">使用下方按鈕操作方塊</p>

      {gameOver && (
        <ResultOverlay
          title={
            isVersus
              ? versusWinner === 'player'
                ? '對戰勝利！'
                : '對戰敗北'
              : player.cleared
                ? mode === 'sprint'
                  ? `完成 40 行！${formatTime(player.elapsedMs)}`
                  : '時間到'
                : '遊戲結束'
          }
          variant={
            isVersus
              ? versusWinner === 'player'
                ? 'win'
                : 'lose'
              : player.cleared
                ? 'win'
                : 'lose'
          }
          stats={
            isVersus
              ? [
                  { label: '你的分數', value: player.score },
                  { label: 'CPU 分數', value: cpu.score },
                  { label: '戰績', value: `${versusStats.wins}勝 ${versusStats.losses}敗` },
                  { label: '目前連勝', value: versusStats.streak },
                ]
              : [
                  { label: '分數', value: player.score },
                  { label: '消除行數', value: player.lines },
                  MODES[mode].recordKind === 'time'
                    ? { label: '用時', value: formatTime(player.elapsedMs) }
                    : { label: '等級', value: player.level },
                  {
                    label: '最佳',
                    value:
                      best[mode as 'marathon' | 'sprint' | 'ultra'] === undefined
                        ? '—'
                        : MODES[mode].recordKind === 'time'
                          ? formatTime(best[mode as 'sprint']!)
                          : String(best[mode as 'marathon' | 'ultra']),
                  },
                ]
          }
          onPrimary={handleRestart}
        />
      )}
    </div>
  );
}
