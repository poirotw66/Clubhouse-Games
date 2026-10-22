import { useCallback, useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import { playGoal, playImpact, playLose, playMove, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { TouchButton, touchControlsWrapClass } from '@clubhouse/shared/TouchButton';
import { RefreshCw, Pause, Play, RotateCw, ChevronLeft, CircleHelp, X } from 'lucide-react';
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
  isDailyMode,
  isGoalMet,
  isPracticeMode,
  isVersusMode,
  movePiece,
  spawnPiece,
  tryRotateWithKick,
} from './utils/tetrisLogic';
import {
  DIFFICULTY_PRESETS,
  PLAYER_GARBAGE_DROP_CAP,
  findBestPlacement,
  thinkDelayMs,
} from './utils/cpuAi';
import {
  createInitialField,
  finishClearing,
  lockPiece,
  nextFromQueue,
  type FieldState,
} from './utils/gameStep';
import {
  buildDailyShareText,
  computeDailyStreak,
  copyText,
  dailyProgressRatio,
  dailySeed,
  formatShareTime,
  generateSeededPieces,
  getDayRecord,
  loadDailyMeta,
  mergeDailyResult,
  saveDailyMeta,
  todayKeyUTC8,
  type DailyKind,
  type DailyMeta,
} from './utils/daily';
import {
  CHEESE_DEFAULT,
  TSPIN_PUZZLES,
  cheesePracticeSeed,
  cheeseStars,
  createCheeseBoard,
  loadPracticeMeta,
  mergeCheeseResult,
  mergeTspinResult,
  puzzleBoardFromRows,
  savePracticeMeta,
  tspinStars,
  type PracticeMeta,
  type TSpinPuzzle,
} from './utils/practice';
import {
  CPU_STYLE_ORDER,
  CPU_STYLES,
  applyCpuStyle,
  isStyleUnlocked,
  loadVersusMeta,
  recordSeriesGame,
  resetSeries,
  saveVersusMeta,
  seriesComplete,
  type CpuStyleId,
  type VersusMeta,
} from './utils/versusMeta';

const MODE_ORDER: Mode[] = ['marathon', 'sprint', 'ultra', 'versus'];
const DAILY_ORDER: Mode[] = ['dailySprint', 'dailyUltra'];
const PRACTICE_ORDER: Mode[] = ['cheese', 'tspin'];
const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];

const GRAVITY_LEVEL_INTERVAL = 800;
/** Solo personal bests — do not rename (save compatibility). */
const BEST_KEY = 'clubhouse:tetris-best';
/** Versus W/L streak — do not rename (save compatibility). */
const VERSUS_KEY = 'clubhouse-tetris-versus';
/** Coach panel dismissed flag — separate from score saves. */
const COACH_KEY = 'clubhouse:tetris-coach';

/** Guideline-ish DAS/ARR; soft drop closer to 1G so mobile hold feels responsive. */
const DAS_MS = 167;
const ARR_MS = 33;
const SOFT_DROP_MS = 20;
const LOCK_DELAY_MS = 500;
const LOCK_RESET_LIMIT = 15;
const CLEAR_ANIM_MS = 220;

function useNarrow(breakpointPx = 768): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpointPx : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [breakpointPx]);
  return narrow;
}

function readCoachDismissed(): boolean {
  try {
    const parsed = JSON.parse(localStorage.getItem(COACH_KEY) || '{}');
    return Boolean(parsed && parsed.dismissed);
  } catch {
    return false;
  }
}

function writeCoachDismissed(dismissed: boolean) {
  try {
    localStorage.setItem(COACH_KEY, JSON.stringify({ dismissed }));
  } catch {
    /* storage unavailable */
  }
}

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

function starsLabel(n: number): string {
  if (n <= 0) return '—';
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

export default function App() {
  const narrow = useNarrow();
  const [mode, setMode] = useState<Mode>('marathon');
  const [difficulty, setDifficulty] = useState<Difficulty>(readVersusStats().lastDifficulty);
  const [player, setPlayer] = useState<FieldState>(createInitialField);
  const [cpu, setCpu] = useState<FieldState>(createInitialField);
  const [best, setBest] = useState(readBest);
  const [versusStats, setVersusStats] = useState(readVersusStats);
  const [versusWinner, setVersusWinner] = useState<'player' | 'cpu' | null>(null);
  const [coachOpen, setCoachOpen] = useState(() => !readCoachDismissed());
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
  const [dailyMeta, setDailyMeta] = useState<DailyMeta>(loadDailyMeta);
  const [practiceMeta, setPracticeMeta] = useState<PracticeMeta>(loadPracticeMeta);
  const [versusMeta, setVersusMeta] = useState<VersusMeta>(loadVersusMeta);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [lastStars, setLastStars] = useState(0);
  const cheeseAttemptRef = useRef(0);
  const dailyRecordedRef = useRef(false);
  const practiceRecordedRef = useRef(false);

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

  const isVersus = isVersusMode(mode);
  const isDaily = isDailyMode(mode);
  const isPractice = isPracticeMode(mode);
  const today = todayKeyUTC8();
  const todayDaily = getDayRecord(dailyMeta, today);
  const dailyKind: DailyKind | null =
    mode === 'dailySprint' ? 'sprint' : mode === 'dailyUltra' ? 'ultra' : null;
  const todayKindBest =
    dailyKind === 'sprint' ? todayDaily.sprint : dailyKind === 'ultra' ? todayDaily.ultra : null;
  const dailyStreak = computeDailyStreak(dailyMeta, today);
  const activePuzzle: TSpinPuzzle = TSPIN_PUZZLES[puzzleIndex] ?? TSPIN_PUZZLES[0];
  const preset = applyCpuStyle(difficulty, versusMeta.style);

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

  const buildPlayerField = useCallback(
    (nextMode: Mode, puzzle: TSpinPuzzle): FieldState => {
      if (nextMode === 'dailySprint' || nextMode === 'dailyUltra') {
        const kind: DailyKind = nextMode === 'dailySprint' ? 'sprint' : 'ultra';
        const pieces = generateSeededPieces(dailySeed(todayKeyUTC8(), kind));
        return createInitialField({ pieces, refillBags: false });
      }
      if (nextMode === 'cheese') {
        cheeseAttemptRef.current += 1;
        const seed = cheesePracticeSeed(cheeseAttemptRef.current);
        return createInitialField({
          board: createCheeseBoard(CHEESE_DEFAULT.garbageRows, seed),
        });
      }
      if (nextMode === 'tspin') {
        return createInitialField({
          board: puzzleBoardFromRows(puzzle.rows),
          pieces: puzzle.queue,
          puzzleGoal: puzzle.require,
          refillBags: false,
          allowHold: false,
        });
      }
      return createInitialField();
    },
    [],
  );

  const startRun = useCallback(
    (
      nextMode: Mode,
      nextDifficulty: Difficulty = difficulty,
      options: { puzzleIndex?: number; keepSeries?: boolean } = {},
    ) => {
      const nextPuzzleIndex =
        options.puzzleIndex !== undefined ? options.puzzleIndex : puzzleIndex;
      const puzzle = TSPIN_PUZZLES[nextPuzzleIndex] ?? TSPIN_PUZZLES[0];
      setPuzzleIndex(nextPuzzleIndex);
      setMode(nextMode);
      setDifficulty(nextDifficulty);
      setFlash(null);
      setCpuFlash(null);
      setVersusWinner(null);
      setShareCopied(false);
      setLastStars(0);
      versusSettledRef.current = false;
      dailyRecordedRef.current = false;
      practiceRecordedRef.current = false;
      wasGameOverRef.current = false;
      softDropRowsRef.current = 0;
      cpuSoftDropRef.current = 0;
      cpuPlanRef.current = null;
      setPlayer(buildPlayerField(nextMode, puzzle));
      setCpu(createInitialField());
      if (nextMode === 'versus' && !options.keepSeries) {
        setVersusMeta((prev) => {
          const next = resetSeries(prev);
          saveVersusMeta(next);
          return next;
        });
      }
      const now = performance.now();
      lastDropTimeRef.current = now;
      cpuDropTimeRef.current = now;
      runStartRef.current = now;
    },
    [difficulty, puzzleIndex, buildPlayerField],
  );

  const handleRestart = () => startRun(mode, difficulty, { keepSeries: true });

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

  // Solo personal bests (classic modes only — daily/practice use their own stores).
  useEffect(() => {
    if (isVersus || isDaily || isPractice || !player.gameOver) return;
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
  }, [
    player.gameOver,
    player.cleared,
    player.elapsedMs,
    player.score,
    mode,
    isVersus,
    isDaily,
    isPractice,
  ]);

  // Daily challenge records.
  useEffect(() => {
    if (!isDaily || !player.gameOver || dailyRecordedRef.current) return;
    dailyRecordedRef.current = true;
    const kind: DailyKind = mode === 'dailySprint' ? 'sprint' : 'ultra';
    const value = kind === 'sprint' ? player.elapsedMs : player.score;
    const cleared = kind === 'sprint' ? player.cleared : true;
    setDailyMeta((prev) => {
      const next = mergeDailyResult(prev, today, kind, value, player.lines, cleared);
      saveDailyMeta(next);
      return next;
    });
  }, [isDaily, player.gameOver, player.cleared, player.elapsedMs, player.score, player.lines, mode, today]);

  // Practice stars.
  useEffect(() => {
    if (!isPractice || !player.gameOver || practiceRecordedRef.current) return;
    practiceRecordedRef.current = true;
    if (mode === 'cheese') {
      const stars = cheeseStars(player.elapsedMs, player.cleared);
      setLastStars(stars);
      setPracticeMeta((prev) => {
        const next = mergeCheeseResult(prev, stars, player.cleared);
        savePracticeMeta(next);
        return next;
      });
      return;
    }
    const stars = tspinStars(player.locks, player.cleared, activePuzzle);
    setLastStars(stars);
    setPracticeMeta((prev) => {
      const next = mergeTspinResult(prev, activePuzzle.id, stars);
      savePracticeMeta(next);
      return next;
    });
  }, [
    isPractice,
    player.gameOver,
    player.cleared,
    player.elapsedMs,
    player.locks,
    mode,
    activePuzzle,
  ]);

  // Versus win/loss + streak + optional BO3 series.
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
    setVersusMeta((prev) => {
      const next = recordSeriesGame(prev, winner);
      saveVersusMeta(next);
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
        queueMicrotask(() => playMove());
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
    playImpact(0.45);
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
        field = maybeDropGarbage(field, PLAYER_GARBAGE_DROP_CAP);
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
      if (
        !prev.active ||
        prev.gameOver ||
        prev.paused ||
        prev.clearing ||
        !prev.holdEnabled ||
        !prev.canHold
      ) {
        return prev;
      }
      if (isVersus && versusWinner) return prev;
      const currentType = prev.active.type;
      resetLock();
      if (prev.hold === null) {
        const next = nextFromQueue(prev.queue, prev.refillBags);
        if (next.type === null) {
          return {
            ...prev,
            active: null,
            queue: next.remaining,
            hold: currentType,
            gameOver: true,
          };
        }
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
            next = maybeDropGarbage(next, PLAYER_GARBAGE_DROP_CAP);
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
            field = maybeDropGarbage(field, PLAYER_GARBAGE_DROP_CAP);
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
        ? versusMeta.bo3 && seriesComplete(versusMeta)
          ? `系列賽勝利 ${versusMeta.seriesPlayer}–${versusMeta.seriesCpu}`
          : '勝利！'
        : versusMeta.bo3 && seriesComplete(versusMeta)
          ? `系列賽敗北 ${versusMeta.seriesPlayer}–${versusMeta.seriesCpu}`
          : '敗北…'
      : player.cleared
        ? isPractice
          ? `過關！${starsLabel(lastStars)}`
          : '完成！'
        : '遊戲結束'
    : player.paused
      ? '暫停中'
      : isVersus
        ? `對戰中（CPU：${preset.label}・${CPU_STYLES[versusMeta.style].label}${
            versusMeta.bo3
              ? `・BO3 ${versusMeta.seriesPlayer}–${versusMeta.seriesCpu}`
              : ''
          }）`
        : isDaily
          ? `每日挑戰 ${today}・連勝 ${dailyStreak} 天`
          : mode === 'tspin'
            ? `${activePuzzle.name}：${activePuzzle.blurb}`
            : mode === 'cheese'
              ? `挖掉 ${CHEESE_DEFAULT.lineGoal} 行垃圾`
              : narrow
                ? '按住左右／軟降可連續移動；下方有旋轉與暫存'
                : '使用方向鍵與空白鍵操作；C 暫存';

  const wellWidth = isVersus ? (narrow ? 148 : 240) : narrow ? 280 : 320;
  const nextPreviewCount = isVersus || narrow ? 3 : 5;

  const dailyBar =
    dailyKind === null
      ? null
      : dailyProgressRatio(
          dailyKind,
          player.lines,
          player.score,
          todayKindBest,
        );

  const handleShareDaily = async () => {
    if (!dailyKind) return;
    const value = dailyKind === 'sprint' ? player.elapsedMs : player.score;
    const text = buildDailyShareText({
      date: today,
      kind: dailyKind,
      value,
      lines: player.lines,
      cleared: dailyKind === 'sprint' ? player.cleared : true,
      streak: computeDailyStreak(dailyMeta, today),
    });
    const ok = await copyText(text);
    setShareCopied(ok);
  };

  const setBo3 = (bo3: boolean) => {
    setVersusMeta((prev) => {
      const next = resetSeries({ ...prev, bo3 });
      saveVersusMeta(next);
      return next;
    });
  };

  const setCpuStyle = (style: CpuStyleId) => {
    if (!isStyleUnlocked(style, versusStats.wins)) return;
    setVersusMeta((prev) => {
      const next = { ...prev, style };
      saveVersusMeta(next);
      return next;
    });
  };

  const classicBest =
    mode === 'marathon' || mode === 'sprint' || mode === 'ultra'
      ? best[mode]
      : undefined;

  const dismissCoach = () => {
    setCoachOpen(false);
    writeCoachDismissed(true);
  };

  const openCoach = () => {
    setCoachOpen(true);
    writeCoachDismissed(false);
  };

  const pressLeft = () => {
    held.current.left = true;
    startShift(-1);
  };
  const releaseLeft = () => {
    held.current.left = false;
    if (shift.current.dir === -1) {
      if (held.current.right) startShift(1);
      else shift.current.dir = 0;
    }
  };
  const pressRight = () => {
    held.current.right = true;
    startShift(1);
  };
  const releaseRight = () => {
    held.current.right = false;
    if (shift.current.dir === 1) {
      if (held.current.left) startShift(-1);
      else shift.current.dir = 0;
    }
  };
  const pressSoft = () => {
    held.current.down = true;
    softDropAt.current = performance.now() + SOFT_DROP_MS;
    applyMove(1, 0);
  };
  const releaseSoft = () => {
    held.current.down = false;
  };

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
            <div className="flex flex-wrap gap-1" role="group" aria-label="每日挑戰">
              {DAILY_ORDER.map((id) => {
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
                        ? 'bg-emerald-500/20 text-emerald-100 border-emerald-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {MODES[id].label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label="精通訓練">
              {PRACTICE_ORDER.map((id) => {
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
                        ? 'bg-violet-500/20 text-violet-100 border-violet-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {MODES[id].label}
                  </button>
                );
              })}
            </div>
            {isVersus && (
              <>
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
                <button
                  type="button"
                  onClick={() => setBo3(!versusMeta.bo3)}
                  aria-pressed={versusMeta.bo3}
                  className={`text-xs min-h-[44px] px-3 py-2 rounded-full border transition-colors touch-manipulation ${
                    versusMeta.bo3
                      ? 'bg-rose-500/20 text-rose-100 border-rose-400'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  BO3
                </button>
                <div className="flex flex-wrap gap-1" role="group" aria-label="CPU 打法">
                  {CPU_STYLE_ORDER.map((id) => {
                    const unlocked = isStyleUnlocked(id, versusStats.wins);
                    const selected = versusMeta.style === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => {
                          setCpuStyle(id);
                          startRun('versus', difficulty);
                        }}
                        aria-pressed={selected}
                        title={
                          unlocked
                            ? CPU_STYLES[id].blurb
                            : `勝場 ${CPU_STYLES[id].unlockWins} 解鎖`
                        }
                        className={`text-xs min-h-[44px] px-3 py-2 rounded-full border transition-colors touch-manipulation ${
                          !unlocked
                            ? 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed'
                            : selected
                              ? 'bg-amber-500/20 text-amber-100 border-amber-400'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        {unlocked ? CPU_STYLES[id].label : `${CPU_STYLES[id].label}（鎖）`}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {mode === 'tspin' && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="T-Spin 題目">
                {TSPIN_PUZZLES.map((puzzle, index) => {
                  const selected = puzzleIndex === index;
                  const bestStars = practiceMeta.tspinStars[puzzle.id] ?? 0;
                  return (
                    <button
                      key={puzzle.id}
                      type="button"
                      onClick={() => startRun('tspin', difficulty, { puzzleIndex: index })}
                      aria-pressed={selected}
                      title={puzzle.blurb}
                      className={`text-xs min-h-[44px] px-3 py-2 rounded-full border transition-colors touch-manipulation ${
                        selected
                          ? 'bg-violet-500/20 text-violet-100 border-violet-400'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {puzzle.name}
                      {bestStars > 0 ? ` ${starsLabel(bestStars)}` : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <button
              type="button"
              onClick={coachOpen ? dismissCoach : openCoach}
              aria-pressed={coachOpen}
              className="inline-flex items-center gap-1 min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 touch-manipulation"
            >
              <CircleHelp className="w-4 h-4" />
              <span>技巧</span>
            </button>
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
        {coachOpen && (
          <div
            className="rounded-xl border border-sky-700/50 bg-slate-950/90 p-3 text-xs sm:text-sm text-slate-200 leading-relaxed relative"
            role="region"
            aria-label="技巧說明"
          >
            <button
              type="button"
              onClick={dismissCoach}
              className="absolute top-2 right-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 touch-manipulation"
              aria-label="關閉技巧說明"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="font-semibold text-sky-200 mb-1 pr-10">得分與對戰怎麼來的</p>
            <ul className="space-y-1 list-disc pl-4 text-slate-300">
              <li>
                <span className="text-slate-100">T-Spin</span>
                ：用 T 塊原地旋轉卡進空隙（最後一步必須是旋轉）。畫面會跳出
                T-SPIN／T-SPIN DOUBLE，分數與垃圾行都比普通消行高。
              </li>
              <li>
                <span className="text-slate-100">Combo</span>
                ：連續每手都消至少 1 行；數字越高加分與垃圾越多。
              </li>
              <li>
                <span className="text-slate-100">Back-to-Back（B2B）</span>
                ：連續做出 Tetris 或 T-Spin（中間不要夾普通 Single／Double／Triple）。側欄出現
                B2B READY 時下一發困難消行會加成。
              </li>
              <li>
                消行時的 callout 會附上 <span className="text-slate-100">+分數</span>
                ；對戰中垃圾先進入「垃圾佇列」，下一個方塊生成時再推進場地（一次最多{' '}
                {PLAYER_GARBAGE_DROP_CAP} 行）。
              </li>
            </ul>
          </div>
        )}
      </header>

      <div
        className={`w-full max-w-6xl flex flex-col ${
          isVersus ? 'lg:flex-row' : 'sm:flex-row'
        } gap-3 sm:gap-4`}
      >
        <aside
          className={`${narrow ? 'w-full order-2' : 'sm:w-40'} flex flex-col gap-3 text-xs sm:text-sm`}
        >
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
                {isDaily && dailyBar && (
                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-emerald-200/90 text-[11px]">
                      <span>今日進度</span>
                      <span>連勝 {dailyStreak} 天</span>
                    </div>
                    <div
                      className="relative h-2 rounded-full bg-slate-800 overflow-hidden"
                      role="progressbar"
                      aria-valuenow={Math.round(dailyBar.current * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="每日挑戰進度"
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-emerald-500/70 tetris-daily-fill"
                        style={{ width: `${dailyBar.current * 100}%` }}
                      />
                      {dailyBar.ghost !== null && (
                        <div
                          className="absolute inset-y-0 w-0.5 bg-white/50"
                          style={{ left: `${dailyBar.ghost * 100}%` }}
                          title="今日最佳"
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>
                        今日最佳
                        {todayKindBest
                          ? dailyKind === 'sprint'
                            ? todayKindBest.cleared
                              ? ` ${formatShareTime(todayKindBest.value)}`
                              : ` ${todayKindBest.lines} 行`
                            : ` ${todayKindBest.value} 分`
                          : ' —'}
                      </span>
                    </div>
                  </div>
                )}
                {mode === 'cheese' && (
                  <div className="flex justify-between border-t border-slate-800 pt-1 mt-1 text-slate-400">
                    <span>Cheese 星級</span>
                    <span className="font-mono">{starsLabel(practiceMeta.cheeseBestStars)}</span>
                  </div>
                )}
                {mode === 'tspin' && (
                  <div className="flex justify-between border-t border-slate-800 pt-1 mt-1 text-slate-400">
                    <span>本題最佳</span>
                    <span className="font-mono">
                      {starsLabel(practiceMeta.tspinStars[activePuzzle.id] ?? 0)}
                    </span>
                  </div>
                )}
                {!isDaily && !isPractice && (
                  <div className="flex justify-between border-t border-slate-800 pt-1 mt-1 text-slate-400">
                    <span>最佳</span>
                    <span className="font-mono tabular-nums">
                      {classicBest === undefined
                        ? '—'
                        : MODES[mode].recordKind === 'time'
                          ? formatTime(classicBest)
                          : classicBest}
                    </span>
                  </div>
                )}
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
                {versusMeta.bo3 && (
                  <div className="flex justify-between text-rose-200">
                    <span>BO3</span>
                    <span className="font-mono">
                      {versusMeta.seriesPlayer}–{versusMeta.seriesCpu}
                    </span>
                  </div>
                )}
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

        <main
          className={`flex-1 flex flex-wrap justify-center gap-2 sm:gap-4 relative ${
            narrow ? 'order-1' : ''
          } ${isVersus && narrow ? 'flex-nowrap' : ''}`}
        >
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
            {!isVersus && !narrow && (
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
                {cpu.lines} 行
                {cpu.incomingGarbage > 0 ? ` · 佇列 ${cpu.incomingGarbage}` : ''}
              </div>
            </div>
          )}
        </main>

        <aside
          className={`${narrow ? 'w-full order-3' : 'sm:w-32'} flex flex-col gap-3 text-xs sm:text-sm`}
        >
          <div className="bg-slate-900/80 rounded-xl p-3 border border-slate-800">
            <h2 className="text-xs font-semibold text-slate-300 mb-2">下一個</h2>
            <div className={`gap-2 ${narrow ? 'flex flex-row justify-center' : 'space-y-2'}`}>
              {player.queue.slice(0, nextPreviewCount).map((t: TetrominoType, index: number) => (
                <div
                  key={`${t}-${index}`}
                  className={`${
                    narrow ? 'w-16' : 'w-full'
                  } aspect-[4/3] bg-slate-800 rounded-lg flex items-center justify-center p-1`}
                >
                  <PieceIcon type={t} cell={index === 0 ? 12 : 9} />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Spacer so fixed mobile controls do not cover the wells. */}
      <div className="md:hidden h-36 shrink-0" aria-hidden />
      <div
        className={`${touchControlsWrapClass} fixed bottom-0 left-0 right-0 z-30 md:static md:bg-transparent bg-slate-950/95 backdrop-blur-sm py-3 border-t border-slate-800 md:border-0`}
      >
        <div className="flex gap-2 w-full justify-center">
          <TouchButton
            label="←"
            ariaLabel="向左"
            onPress={pressLeft}
            onRelease={releaseLeft}
          />
          <TouchButton
            label="↓"
            ariaLabel="軟降"
            onPress={pressSoft}
            onRelease={releaseSoft}
          />
          <TouchButton
            label="→"
            ariaLabel="向右"
            onPress={pressRight}
            onRelease={releaseRight}
          />
        </div>
        <div className="flex gap-2 w-full justify-center flex-wrap">
          <TouchButton label="左轉" ariaLabel="逆時針旋轉" onClick={() => applyRotate(-1)} />
          <TouchButton label="右轉" ariaLabel="順時針旋轉" onClick={() => applyRotate(1)} />
          <TouchButton label="落下" ariaLabel="瞬間落下" onClick={hardDrop} accent />
          <TouchButton label="暫存" ariaLabel="暫存方塊" onClick={holdPiece} />
        </div>
        <p className="md:hidden text-[11px] text-slate-500 mt-2 text-center px-2">
          按住 ← → ↓ 可連續移動；左轉／右轉對應 Z／X
        </p>
      </div>

      {gameOver && (
        <ResultOverlay
          title={
            isVersus
              ? versusWinner === 'player'
                ? versusMeta.bo3 && seriesComplete(versusMeta)
                  ? '系列賽勝利！'
                  : '對戰勝利！'
                : versusMeta.bo3 && seriesComplete(versusMeta)
                  ? '系列賽敗北'
                  : '對戰敗北'
              : player.cleared
                ? mode === 'sprint' || mode === 'dailySprint'
                  ? `完成 40 行！${formatTime(player.elapsedMs)}`
                  : mode === 'cheese' || mode === 'tspin'
                    ? `過關 ${starsLabel(lastStars)}`
                    : mode === 'ultra' || mode === 'dailyUltra'
                      ? '時間到'
                      : '完成！'
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
                  ...(versusMeta.bo3
                    ? [
                        {
                          label: 'BO3',
                          value: `${versusMeta.seriesPlayer}–${versusMeta.seriesCpu}`,
                        },
                      ]
                    : []),
                ]
              : isDaily
                ? [
                    { label: '分數', value: player.score },
                    { label: '消除行數', value: player.lines },
                    dailyKind === 'sprint'
                      ? { label: '用時', value: formatTime(player.elapsedMs) }
                      : { label: '等級', value: player.level },
                    {
                      label: '今日最佳',
                      value: todayKindBest
                        ? dailyKind === 'sprint'
                          ? todayKindBest.cleared
                            ? formatShareTime(todayKindBest.value)
                            : `${todayKindBest.lines} 行`
                          : String(todayKindBest.value)
                        : '—',
                    },
                    { label: '連續天數', value: dailyStreak },
                  ]
                : isPractice
                  ? [
                      { label: '星級', value: starsLabel(lastStars) },
                      { label: '用時', value: formatTime(player.elapsedMs) },
                      { label: '鎖定次數', value: player.locks },
                      {
                        label: '最佳星級',
                        value:
                          mode === 'cheese'
                            ? starsLabel(practiceMeta.cheeseBestStars)
                            : starsLabel(practiceMeta.tspinStars[activePuzzle.id] ?? 0),
                      },
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
                          classicBest === undefined
                            ? '—'
                            : MODES[mode].recordKind === 'time'
                              ? formatTime(classicBest)
                              : String(classicBest),
                      },
                    ]
          }
          onPrimary={
            isVersus && versusMeta.bo3 && !seriesComplete(versusMeta)
              ? () => startRun('versus', difficulty, { keepSeries: true })
              : handleRestart
          }
          primaryLabel={
            isVersus && versusMeta.bo3 && !seriesComplete(versusMeta)
              ? '下一局'
              : undefined
          }
          onSecondary={
            isDaily
              ? () => {
                  void handleShareDaily();
                }
              : isVersus && versusMeta.bo3 && seriesComplete(versusMeta)
                ? () => startRun('versus', difficulty)
                : undefined
          }
          secondaryLabel={
            isDaily
              ? shareCopied
                ? '已複製分享文字'
                : '複製分享'
              : isVersus && versusMeta.bo3 && seriesComplete(versusMeta)
                ? '新系列賽'
                : undefined
          }
        />
      )}
    </div>
  );
}
