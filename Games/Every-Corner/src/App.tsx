import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playGoal, playLose, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { AchievementToast } from './components/AchievementToast';
import { Board } from './components/Board';
import {
  ACHIEVEMENTS,
  applyClear,
  markWeeklyCompletion,
  sizeKeyOf,
} from './game/achievements';
import {
  isAudioMuted,
  playCircuitExtend,
  playCircuitRetract,
  playFullGridDischarge,
  playOverloadAlarm,
  playSafeRollback,
  setAudioMuted,
} from './game/circuitAudio';
import { DAILY_DIFFICULTY, dailySeed, dateKey, formatDuration, summarise } from './game/daily';
import { DIFFICULTIES, DIFFICULTY_ORDER, generate } from './game/generate';
import { analyzeCircuit } from './game/circuit';
import { buildNeighbours, colOf, playableCount, rowOf, wallKey } from './game/grid';
import { HINT_SEQUENCE, computeHint } from './game/hint';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import {
  clearGame,
  loadDaily,
  loadGame,
  loadStats,
  loadWeekly,
  recordDaily,
  recordWeeklyDay,
  saveGame,
  saveStats,
} from './game/storage';
import type { CellId, DifficultyId, Puzzle } from './game/types';
import {
  WEEKLY_DAYS,
  dayCleared,
  todayWeekDayIndex,
  weekKey,
  weeklyDayBlurb,
  weeklyDaySpec,
  weeklyProgressCount,
  weeklySeed,
} from './game/weekly';

type Screen = 'title' | 'play' | 'achievements' | 'weekly';

function seedFromUrl(): string {
  try {
    const param = new URLSearchParams(window.location.search).get('seed');
    return param ? normalizeSeedCode(param) : randomSeedCode();
  } catch {
    return randomSeedCode();
  }
}

function blockedCountForDifficulty(difficulty: DifficultyId): number {
  if (difficulty === 'easy') return 2;
  if (difficulty === 'normal') return 3;
  if (difficulty === 'hard') return 4;
  return 5;
}

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('title');
  const [seedCode, setSeedCode] = useState(seedFromUrl);
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [useBlocked, setUseBlocked] = useState(false);
  const [isDaily, setIsDaily] = useState(false);
  const [isWeekly, setIsWeekly] = useState(false);
  const [weeklyDayIndex, setWeeklyDayIndex] = useState<number | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [path, setPath] = useState<CellId[]>([]);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintStep, setHintStep] = useState(0);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<CellId[]>([]);
  /** Set when the player asks to see the answer; the run then counts as unsolved. */
  const [gaveUp, setGaveUp] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [dailyRecords, setDailyRecords] = useState(() => loadDaily());
  const [stats, setStats] = useState(() => loadStats());
  const [thisWeek, setThisWeek] = useState(() => loadWeekly(weekKey()));
  const [resumable, setResumable] = useState(() => loadGame());
  const [toastIds, setToastIds] = useState<string[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [muted, setMuted] = useState(isAudioMuted);

  const today = dateKey();
  const currentWeek = weekKey();
  const dailyStats = useMemo(() => summarise(dailyRecords, today), [dailyRecords, today]);
  const startedAt = useRef<number>(0);
  const prevDeadEnd = useRef(false);

  const total = puzzle ? playableCount(puzzle.size, puzzle.blocked) : 0;
  const complete = puzzle !== null && path.length === total && path.length > 0;
  /** Filling the board only counts as solving it if the player was not shown the answer. */
  const solved = complete && !gaveUp;

  const neighbours = useMemo(() => {
    if (!puzzle) return [];
    return buildNeighbours(puzzle.size, puzzle.walls, puzzle.blocked);
  }, [puzzle]);

  const circuit = useMemo(() => {
    if (!puzzle) return null;
    return analyzeCircuit(puzzle.size, neighbours, path, puzzle.checkpoints, puzzle.blocked);
  }, [puzzle, neighbours, path]);

  // Audio mute toggle
  const toggleAudio = useCallback(() => {
    const next = !muted;
    setAudioMuted(next);
    setMuted(next);
  }, [muted]);

  // Trigger dead-end isolation overload buzzer on the exact step a trap occurs
  useEffect(() => {
    if (!circuit || complete) return;
    if (circuit.hasDeadEnd && !prevDeadEnd.current) {
      playOverloadAlarm();
    }
    prevDeadEnd.current = circuit.hasDeadEnd;
  }, [circuit?.hasDeadEnd, complete]);

  // Safe Rollback: 1-click rescue to last known safe prefix before isolation
  const rollbackToSafe = useCallback(() => {
    if (!circuit || circuit.safeRollbackLength === null) return;
    playSafeRollback();
    setPath((current) => current.slice(0, circuit.safeRollbackLength!));
    setRevealed([]);
    setHintMessage(null);
  }, [circuit]);

  // Rewind path directly to any reached checkpoint
  const rewindToCheckpoint = useCallback(
    (cell: CellId) => {
      const idx = path.indexOf(cell);
      if (idx !== -1 && idx < path.length - 1) {
        playCircuitRetract();
        setPath((current) => current.slice(0, idx + 1));
        setRevealed([]);
        setHintMessage(null);
      }
    },
    [path],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // Refresh weekly record when the calendar week rolls.
  useEffect(() => {
    setThisWeek(loadWeekly(currentWeek));
  }, [currentWeek]);

  // Tick only while a puzzle is open and unsolved.
  useEffect(() => {
    if (screen !== 'play' || complete) return;
    startedAt.current = Date.now() - elapsedMs;
    const tick = () => setElapsedMs(Date.now() - startedAt.current);
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, complete]);

  useEffect(() => {
    if (screen === 'play' && puzzle && !complete) {
      saveGame({
        seedCode: puzzle.seedCode,
        difficulty: puzzle.difficulty,
        isDaily,
        isWeekly,
        weeklyDayIndex,
        blockedCount: puzzle.blocked.length,
        progress: { path, hintsUsed, elapsedMs, solved: false },
      });
    }
  }, [screen, puzzle, path, hintsUsed, elapsedMs, isDaily, isWeekly, weeklyDayIndex, solved, complete]);

  const recorded = useRef(false);
  const sfxDone = useRef(false);

  const pushUnlocks = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setToastIds(ids);
  }, []);

  useEffect(() => {
    if (!solved || recorded.current || !puzzle) return;
    recorded.current = true;
    clearGame();
    setResumable(null);

    const clearEvent = {
      difficulty: puzzle.difficulty,
      sizeKey: sizeKeyOf(puzzle.size.rows, puzzle.size.cols),
      elapsedMs,
      hintsUsed,
      isDaily,
      isWeekly,
      variant: puzzle.variant,
      gaveUp: false as const,
    };

    let streak = dailyStats.streak;
    if (isDaily) {
      const updatedDaily = recordDaily({ date: today, elapsedMs, hintsUsed });
      setDailyRecords(updatedDaily);
      streak = summarise(updatedDaily, today).streak;
    }

    const priorWeeklyComplete = thisWeek.completed;
    let weeklyJustFinished = false;
    if (isWeekly && weeklyDayIndex !== null) {
      const updated = recordWeeklyDay(currentWeek, {
        dayIndex: weeklyDayIndex,
        elapsedMs,
        hintsUsed,
      });
      setThisWeek(updated);
      weeklyJustFinished = updated.completed && !priorWeeklyComplete;
    }

    setStats((prev) => {
      const applied = applyClear(prev, clearEvent, streak);
      let next = applied.stats;
      let unlocks = applied.newAchievements;
      if (weeklyJustFinished) {
        const weekly = markWeeklyCompletion(next, streak);
        next = weekly.stats;
        unlocks = [...unlocks, ...weekly.newAchievements.filter((id) => !unlocks.includes(id))];
      }
      saveStats(next);
      pushUnlocks(unlocks);
      return next;
    });
  }, [
    solved,
    isDaily,
    isWeekly,
    weeklyDayIndex,
    today,
    elapsedMs,
    hintsUsed,
    puzzle,
    dailyStats.streak,
    thisWeek.completed,
    currentWeek,
    pushUnlocks,
  ]);

  useEffect(() => {
    if (!gaveUp || sfxDone.current) return;
    sfxDone.current = true;
    playLose();
    setShowResult(true);
  }, [gaveUp]);

  const onTraceComplete = useCallback(() => {
    if (sfxDone.current) {
      setShowResult(true);
      return;
    }
    sfxDone.current = true;
    playFullGridDischarge();
    window.setTimeout(() => {
      playWin();
      setShowResult(true);
    }, 220);
  }, []);

  const open = useCallback(
    (
      code: string,
      level: DifficultyId,
      options: {
        daily?: boolean;
        weekly?: boolean;
        weeklyDay?: number | null;
        blocked?: number;
        restore?: { path: CellId[]; hintsUsed: number; elapsedMs: number };
      } = {},
    ) => {
      const holes = options.blocked ?? 0;
      const built = generate({
        seedCode: code,
        difficulty: level,
        blockedCount: holes,
      });
      setPuzzle(built);
      setPath(options.restore?.path ?? []);
      setHintsUsed(options.restore?.hintsUsed ?? 0);
      setElapsedMs(options.restore?.elapsedMs ?? 0);
      setHintStep(0);
      setHintMessage(null);
      setRevealed([]);
      setGaveUp(false);
      setShowResult(false);
      recorded.current = false;
      sfxDone.current = false;
      prevDeadEnd.current = false;
      setSeedCode(code);
      setDifficulty(level);
      setIsDaily(Boolean(options.daily));
      setIsWeekly(Boolean(options.weekly));
      setWeeklyDayIndex(options.weeklyDay ?? null);
      setBlockedCount(holes);
      setScreen('play');
    },
    [],
  );

  const useHint = useCallback(() => {
    if (!puzzle) return;
    const kind = HINT_SEQUENCE[Math.min(hintStep, HINT_SEQUENCE.length - 1)];
    const hint = computeHint(puzzle, path, kind);
    setHintMessage(hint.message);
    setPath(path.slice(0, hint.keepLength));
    setRevealed(hint.revealCells);
    setHintsUsed((n) => n + 1);
    setHintStep((s) => Math.min(s + 1, HINT_SEQUENCE.length - 1));
    playScore();
  }, [puzzle, path, hintStep]);

  // Keyboard: arrows extend the path, Backspace steps back.
  useEffect(() => {
    if (screen !== 'play' || !puzzle || complete) return;
    const holes = new Set(puzzle.blocked);
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.key === 'Backspace' || event.key === 'z' || event.key === 'Z') {
        event.preventDefault();
        playCircuitRetract();
        setPath((p) => p.slice(0, -1));
        return;
      }
      if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        playCircuitRetract();
        setPath([]);
        setRevealed([]);
        setHintMessage(null);
        return;
      }
      if (event.key === 'h' || event.key === 'H') {
        event.preventDefault();
        useHint();
        return;
      }
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const delta = deltas[event.key];
      if (!delta) return;
      event.preventDefault();

      setPath((current) => {
        if (current.length === 0) {
          const start = Object.entries(puzzle.checkpoints).find(([, n]) => n === 1);
          if (start) {
            const startCell = Number(start[0]);
            playCircuitExtend(1, true);
            return [startCell];
          }
          return current;
        }
        const last = current[current.length - 1];
        const row = rowOf(puzzle.size, last) + delta[0];
        const col = colOf(puzzle.size, last) + delta[1];
        if (row < 0 || col < 0 || row >= puzzle.size.rows || col >= puzzle.size.cols) return current;
        const next = row * puzzle.size.cols + col;
        if (holes.has(next)) return current;
        if (current.length >= 2 && next === current[current.length - 2]) {
          playCircuitRetract();
          return current.slice(0, -1);
        }
        if (current.includes(next)) return current;
        if (puzzle.walls.includes(wallKey(last, next))) return current;

        const isCp = puzzle.checkpoints[next] !== undefined;
        playCircuitExtend(current.length + 1, isCp);
        return [...current, next];
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, puzzle, useHint, complete]);

  const modeLabel = (): string => {
    if (!puzzle) return '';
    if (isDaily) return '今日挑戰';
    if (isWeekly && weeklyDayIndex !== null) return weeklyDaySpec(weeklyDayIndex).label;
    if (puzzle.variant === 'blocked') return `${DIFFICULTIES[puzzle.difficulty].label}・缺口盤`;
    return DIFFICULTIES[puzzle.difficulty].label;
  };

  if (screen === 'achievements') {
    return (
      <div className="ec-title-shell min-h-screen">
        <BackToMenu />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-16 pt-14">
          <header className="mt-3 flex items-baseline justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-violet-300">成就</h1>
              <p className="mt-1 text-xs text-slate-400">
                已解鎖 {stats.achievements.length} / {ACHIEVEMENTS.length}・累計完成 {stats.totalSolved} 題
              </p>
            </div>
            <TouchButton
              label="回選單"
              ariaLabel="回到選單"
              onClick={() => setScreen('title')}
              className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 text-xs font-semibold text-slate-300"
            />
          </header>
          <ul className="flex flex-col gap-2">
            {ACHIEVEMENTS.map((ach) => {
              const unlocked = stats.achievements.includes(ach.id);
              return (
                <li
                  key={ach.id}
                  className={`ec-card px-4 py-3 ${unlocked ? '' : 'opacity-45'}`}
                >
                  <p className="text-sm font-bold text-slate-100">
                    {unlocked ? ach.name : '？？？'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {unlocked ? ach.blurb : '尚未解鎖'}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
        <AchievementToast ids={toastIds} onDismiss={() => setToastIds([])} />
      </div>
    );
  }

  if (screen === 'weekly') {
    const progress = weeklyProgressCount(thisWeek);
    return (
      <div className="ec-title-shell min-h-screen">
        <BackToMenu />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-16 pt-14">
          <header className="mt-3 flex items-baseline justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-violet-300">本週挑戰</h1>
              <p className="mt-1 text-xs text-slate-400">
                週次 {currentWeek}・進度 {progress} / 7
                {thisWeek.completed && <span className="ml-2 text-emerald-300">本週已通關</span>}
              </p>
            </div>
            <TouchButton
              label="回選單"
              ariaLabel="回到選單"
              onClick={() => setScreen('title')}
              className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 text-xs font-semibold text-slate-300"
            />
          </header>
          <p className="text-xs leading-relaxed text-slate-400">
            七題由易到難，週六、週日是缺口盤變體。全部完成會記入週挑戰紀錄。
          </p>
          <ul className="flex flex-col gap-2">
            {WEEKLY_DAYS.map((day) => {
              const done = dayCleared(thisWeek, day.dayIndex);
              const todaySlot = todayWeekDayIndex() === day.dayIndex;
              const record = thisWeek.days.find((d) => d.dayIndex === day.dayIndex);
              return (
                <li key={day.dayIndex} className="ec-card flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-100">
                      {day.label}
                      {todaySlot && <span className="ml-2 text-[10px] font-semibold text-amber-300">今天</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {weeklyDayBlurb(day)}
                      {done && record && (
                        <span className="ml-2 text-emerald-300/90">
                          {formatDuration(record.elapsedMs)}
                          {record.hintsUsed > 0 ? `・提示 ${record.hintsUsed}` : ''}
                        </span>
                      )}
                    </p>
                  </div>
                  <TouchButton
                    label={done ? '再玩' : '開始'}
                    ariaLabel={`${done ? '再玩' : '開始'}${day.label}`}
                    onClick={() =>
                      open(weeklySeed(currentWeek, day.dayIndex), day.difficulty, {
                        weekly: true,
                        weeklyDay: day.dayIndex,
                        blocked: day.blockedCount,
                      })
                    }
                    className={`shrink-0 rounded-xl px-3 text-xs font-bold ${
                      done
                        ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                        : 'bg-violet-500 text-slate-950'
                    }`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
        <AchievementToast ids={toastIds} onDismiss={() => setToastIds([])} />
      </div>
    );
  }

  if (screen === 'title') {
    return (
      <div
        className="ec-title-shell min-h-screen"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(12, 9, 22, 0.52), rgba(12, 9, 22, 0.94))',
            `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
          ].join(', '),
        }}
      >
        <BackToMenu />
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-16 pt-14">
          <header className="ec-title-hero mt-3 text-center">
            <p className="text-sm tracking-[0.4em] text-cyan-400 font-mono">CYBER CIRCUIT OVERDRIVE</p>
            <h1 className="mt-2 text-4xl font-black text-violet-300 sm:text-5xl">走透透</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              從 1 開始畫一條線，依序經過每個數字，
              <br />
              而且要走滿每一格。不能交叉，不能穿牆。
            </p>
            <p className="mt-3 text-[11px] text-slate-500">
              累計 {stats.totalSolved} 題・成就 {stats.achievements.length}/{ACHIEVEMENTS.length}
              {dailyStats.streak > 0 && `・連勝 ${dailyStats.streak} 天`}
            </p>
          </header>

          <section className="ec-card p-4">
            <h2 className="text-sm font-bold text-slate-200">每日挑戰</h2>
            <p className="mt-1 text-xs text-slate-400">
              {today}・所有人今天解同一題
              {dailyStats.streak > 0 && <span className="ml-2 text-violet-300">連續 {dailyStats.streak} 天</span>}
              {dailyStats.bestMs > 0 && (
                <span className="ml-2 text-slate-500">最佳 {formatDuration(dailyStats.bestMs)}</span>
              )}
            </p>
            <TouchButton
              label={dailyRecords.some((r) => r.date === today) ? '今天已完成，再玩一次' : '開始今日挑戰'}
              ariaLabel="開始今日挑戰"
              onClick={() => open(dailySeed(today), DAILY_DIFFICULTY, { daily: true })}
              className="mt-3 w-full rounded-xl bg-violet-500 px-4 text-base font-black text-slate-950"
            />
          </section>

          <section className="ec-card p-4">
            <h2 className="text-sm font-bold text-slate-200">本週挑戰</h2>
            <p className="mt-1 text-xs text-slate-400">
              七題遞增・含缺口盤變體・進度 {weeklyProgressCount(thisWeek)} / 7
              {thisWeek.completed && <span className="ml-2 text-emerald-300">本週已通關</span>}
            </p>
            <TouchButton
              label="打開本週挑戰"
              ariaLabel="打開本週挑戰"
              onClick={() => setScreen('weekly')}
              className="mt-3 w-full rounded-xl border border-violet-400/60 bg-violet-500/20 px-4 text-base font-bold text-violet-100"
            />
          </section>

          <section className="ec-card p-4">
            <h2 className="text-sm font-bold text-slate-200">自由練習</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DIFFICULTY_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDifficulty(id)}
                  aria-pressed={difficulty === id}
                  className="ec-choice min-h-16 px-3 py-2 text-left"
                  style={
                    difficulty === id
                      ? { borderColor: '#a78bfa', background: 'rgba(76,29,149,0.4)' }
                      : undefined
                  }
                >
                  <span className="block text-base font-bold text-slate-100">
                    {DIFFICULTIES[id].label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">
                    {DIFFICULTIES[id].blurb}
                  </span>
                </button>
              ))}
            </div>

            <label className="mt-4 flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={useBlocked}
                onChange={(e) => setUseBlocked(e.target.checked)}
                className="h-4 w-4 accent-violet-400"
              />
              缺口盤變體（部分格子為空洞，不必走）
            </label>

            <label className="mt-4 block text-xs font-semibold tracking-wider text-slate-400" htmlFor="seed-input">
              種子碼
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="seed-input"
                value={seedCode}
                onChange={(e) => setSeedCode(e.target.value)}
                spellCheck={false}
                autoComplete="off"
                className="min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 font-mono text-base text-violet-200 outline-none focus:border-violet-400"
              />
              <TouchButton
                label="重骰"
                ariaLabel="隨機產生新的種子碼"
                onClick={() => setSeedCode(randomSeedCode())}
                className="shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-200"
              />
            </div>
            <TouchButton
              label="開始這一題"
              ariaLabel="用這組種子碼開始"
              onClick={() =>
                open(normalizeSeedCode(seedCode), difficulty, {
                  blocked: useBlocked ? blockedCountForDifficulty(difficulty) : 0,
                })
              }
              className="mt-3 w-full rounded-xl border border-violet-400/60 bg-violet-500/20 px-4 text-base font-bold text-violet-100"
            />
          </section>

          <div className="grid grid-cols-2 gap-2">
            <TouchButton
              label="成就"
              ariaLabel="查看成就"
              onClick={() => setScreen('achievements')}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-100"
            />
            {resumable ? (
              <TouchButton
                label="繼續上次"
                ariaLabel="繼續上次那一題"
                onClick={() =>
                  open(resumable.seedCode, resumable.difficulty, {
                    daily: resumable.isDaily,
                    weekly: resumable.isWeekly,
                    weeklyDay: resumable.weeklyDayIndex,
                    blocked: resumable.blockedCount,
                    restore: resumable.progress,
                  })
                }
                className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-100"
              />
            ) : (
              <div />
            )}
          </div>
        </div>
        <AchievementToast ids={toastIds} onDismiss={() => setToastIds([])} />
      </div>
    );
  }

  if (!puzzle) return <p className="p-8 text-slate-300">題目載入失敗。</p>;

  return (
    <>
      <BackToMenu />
      <div className="ec-cockpit-shell min-h-screen flex flex-col justify-start px-2 sm:px-4 pb-12 pt-14 w-full max-w-7xl mx-auto">
        {/* Top Header Row */}
        <header className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-violet-500/20 pb-3">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-100 flex items-center gap-2">
                <span>{modeLabel()}</span>
                <span className="font-mono text-xs font-bold text-violet-300 bg-violet-950/80 border border-violet-500/30 px-2 py-0.5 rounded-full">
                  {formatDuration(elapsedMs)}
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                電路種子碼 <span className="font-mono text-violet-300">{puzzle.seedCode}</span>
                {puzzle.blocked.length > 0 && (
                  <span className="ml-2 text-rose-300">缺口孔洞 {puzzle.blocked.length}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TouchButton
              label={muted ? '🔇 靜音' : '🔊 音效'}
              ariaLabel={muted ? '開啟電路音效' : '關閉電路音效'}
              onClick={toggleAudio}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                muted
                  ? 'border-slate-700 bg-slate-900/80 text-slate-500'
                  : 'border-cyan-500/50 bg-cyan-950/40 text-cyan-200'
              }`}
            />
            <TouchButton
              label="回選單"
              ariaLabel="回到選單"
              onClick={() => setScreen('title')}
              className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white"
            />
          </div>
        </header>

        {/* 3-Column Cockpit Layout on Desktop (Collapse to 1 col on mobile) */}
        <div className="flex-1 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-4 lg:gap-6 overflow-hidden">
          {/* Left Wing: 線路拓撲遙測 (Desktop Only) */}
          <aside className="ec-wing ec-wing--left hidden lg:flex flex-col justify-between w-64 xl:w-72 p-3.5 rounded-2xl border border-violet-500/25 bg-slate-950/85 backdrop-blur-md shadow-2xl shrink-0 select-none overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-violet-500/20">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-bold text-violet-200 tracking-wider">線路拓撲遙測</span>
                </div>
                <span className="text-[10px] text-violet-300/60 font-mono">TELEMETRY</span>
              </div>

              {/* Conductivity Gauge */}
              <div className="mb-3.5 p-2.5 rounded-xl bg-slate-900/80 border border-violet-500/20">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-violet-200/80 font-medium">電路導通率</span>
                  <span className="font-mono font-extrabold text-sm text-cyan-300">
                    {circuit?.conductedPct ?? 0}%
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/60">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 rounded-full transition-all duration-200"
                    style={{ width: `${circuit?.conductedPct ?? 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1.5">
                  <span>已通電: <b className="text-violet-200">{path.length}</b> 格</span>
                  <span>總需求: <b className="text-slate-200">{total}</b> 格</span>
                </div>
              </div>

              {/* Line Impedance & Corner Turns */}
              <div className="mb-3.5 p-2.5 rounded-xl bg-slate-900/80 border border-violet-500/20">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-violet-200/80 font-medium">走線等效阻抗</span>
                  <span className="font-mono font-bold text-xs text-violet-300">
                    {circuit?.impedanceOhms ?? 48} Ω
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>90° 轉折節點:</span>
                  <span className="font-mono text-slate-300 font-semibold">
                    {circuit?.turnsCount ?? 0} 次
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[9px]">
                  <span className="text-slate-500">超導狀態:</span>
                  <span className="px-1.5 py-0.5 rounded font-mono text-emerald-300 bg-emerald-500/15">
                    {(circuit?.impedanceOhms ?? 48) < 180 ? '超導良好' : '高負載迴路'}
                  </span>
                </div>
              </div>

              {/* Dead-End Isolation Detector with 1-Click Rescue */}
              <div className={`mb-3.5 p-2.5 rounded-xl border transition-all ${
                circuit?.hasDeadEnd
                  ? 'bg-rose-950/50 border-rose-500/60 text-rose-200 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                  : 'bg-slate-900/80 border-emerald-500/30 text-emerald-300'
              }`}>
                <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    <span>{circuit?.hasDeadEnd ? '⚠️' : '⚡'}</span>
                    <span>孤島斷路診斷</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    circuit?.hasDeadEnd ? 'bg-rose-500/30 text-rose-200 animate-pulse' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {circuit?.hasDeadEnd ? 'CIRCUIT BREAK' : 'ALL CLEAR'}
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed opacity-85">
                  {circuit?.hasDeadEnd
                    ? `警告：已有 ${circuit.isolatedCells.size} 格遭封閉形成斷路！線頭無法抵達。`
                    : '目前全盤所有未走格子均可連通，迴路通暢無阻。'}
                </p>

                {circuit?.hasDeadEnd && circuit.safeRollbackLength !== null && (
                  <button
                    type="button"
                    onClick={rollbackToSafe}
                    className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-black text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer animate-pulse"
                  >
                    <span>⚡</span>
                    <span>解除警報：倒回安全點</span>
                  </button>
                )}
              </div>

              {/* Distance & Compass Direction to Next Checkpoint Target */}
              <div className="mb-3.5 p-2.5 rounded-xl bg-slate-900/80 border border-violet-500/20">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-violet-200/80 font-medium">目標繼電器</span>
                  <span className="font-bold text-amber-300 font-mono text-xs">
                    #{circuit?.nextCheckpointNumber ?? 1}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>方位雷達:</span>
                  <span className="font-mono text-amber-200 font-bold">
                    {circuit?.directionToNext ?? '起點'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                  <span>線頭至目標距離:</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {circuit?.distanceToNext ?? 0} 格
                  </span>
                </div>
              </div>

              {/* Board Topology Specs */}
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-violet-500/20">
                <div className="text-[11px] font-medium text-violet-200/80 mb-1.5">電路板規格</div>
                <div className="grid grid-cols-2 gap-1.5 text-center text-[10px]">
                  <div className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800">
                    <span className="text-slate-400 block">網格矩陣</span>
                    <span className="font-mono font-bold text-slate-200">{puzzle.size.rows} × {puzzle.size.cols}</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800">
                    <span className="text-slate-400 block">阻隔雷射牆</span>
                    <span className="font-mono font-bold text-rose-300">{puzzle.walls.length} 道</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-violet-500/20 text-[10px] text-slate-400 flex items-center justify-between">
              <span>快捷: Z 復原・R 重畫</span>
              <span>H 提示</span>
            </div>
          </aside>

          {/* Center Column: 核心電路板與行動端戰術條 */}
          <div className="flex-1 w-full max-w-lg flex flex-col justify-center">
            {/* Mobile Tactical Telemetry Strip (Visible on mobile/tablet) */}
            <div className="lg:hidden mb-2.5 flex items-center justify-between gap-1.5 text-[11px] bg-slate-950/80 border border-violet-500/25 px-3 py-1.5 rounded-xl shadow-lg">
              <div className="flex items-center gap-1.5">
                <span className="text-violet-300 font-medium">導通:</span>
                <span className="font-mono font-extrabold text-cyan-300">{circuit?.conductedPct ?? 0}%</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-slate-400">
                <span>阻抗:</span>
                <span className="text-violet-200 font-bold">{circuit?.impedanceOhms ?? 48}Ω</span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <span className="text-slate-400">目標:</span>
                <span className="text-amber-300 font-bold">#{circuit?.nextCheckpointNumber}</span>
                <span className="text-amber-200/80 text-[10px]">({circuit?.directionToNext})</span>
              </div>
            </div>

            {/* Mobile Dead-end Warning Banner with 1-Click Rescue */}
            {circuit?.hasDeadEnd && (
              <div className="lg:hidden mb-2.5 flex items-center justify-between gap-2 p-2 rounded-xl bg-rose-950/80 border border-rose-500/70 text-rose-200 animate-pulse shadow-lg">
                <div className="flex items-center gap-1.5 text-xs font-bold min-w-0">
                  <span>⚠️</span>
                  <span className="truncate">斷路：{circuit.isolatedCells.size} 格遭隔離</span>
                </div>
                <button
                  type="button"
                  onClick={rollbackToSafe}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-xs active:scale-95 transition-all shadow"
                >
                  ⚡ 倒回安全點
                </button>
              </div>
            )}

            {/* Board Container */}
            <div className="ec-card p-3 shadow-2xl relative border border-violet-500/30">
              <Board
                puzzle={puzzle}
                path={path}
                revealed={revealed}
                onPathChange={(next) => {
                  if (next.length > path.length) {
                    const lastCell = next[next.length - 1];
                    const isCp = puzzle.checkpoints[lastCell] !== undefined;
                    playCircuitExtend(next.length, isCp);
                  } else if (next.length < path.length) {
                    playCircuitRetract();
                  }
                  setPath(next);
                  setRevealed([]);
                }}
                solved={solved}
                onTraceComplete={onTraceComplete}
                isolatedCells={circuit?.isolatedCells}
                targetCheckpointCell={circuit?.nextCheckpointCell}
              />
            </div>

            {/* Status & Control Row below Board */}
            <div className="mt-3 flex items-center justify-between gap-2 flex-wrap text-xs">
              <p className="text-slate-400">
                導通 <span className="font-mono text-cyan-300 font-bold">{path.length}</span> / {total} 格
                <span className="ml-2 font-mono text-violet-300">({circuit?.conductedPct ?? 0}%)</span>
                {circuit?.hasDeadEnd && (
                  <span className="ml-2 text-rose-400 font-bold animate-pulse">⚠️ 孤島斷路</span>
                )}
                {hintsUsed > 0 && <span className="ml-2 text-slate-500">提示 {hintsUsed} 次</span>}
              </p>
              <div className="flex gap-1.5 sm:gap-2">
                {circuit?.hasDeadEnd && circuit.safeRollbackLength !== null && (
                  <TouchButton
                    label="倒回安全"
                    ariaLabel="倒退回無斷路的安全點"
                    onClick={rollbackToSafe}
                    className="rounded-lg border border-amber-500/60 bg-amber-500/20 px-2 sm:px-2.5 py-1.5 text-xs font-black text-amber-200 animate-pulse"
                  />
                )}
                <TouchButton
                  label="退一步"
                  ariaLabel="退回上一步"
                  onClick={() => {
                    playCircuitRetract();
                    setPath((p) => p.slice(0, -1));
                  }}
                  disabled={path.length === 0 || complete}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-2 sm:px-3 py-1.5 text-xs font-bold text-slate-200"
                />
                <TouchButton
                  label="重畫"
                  ariaLabel="清空路線重畫"
                  onClick={() => {
                    playCircuitRetract();
                    setPath([]);
                    setRevealed([]);
                    setHintMessage(null);
                  }}
                  disabled={complete}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-2 sm:px-3 py-1.5 text-xs font-bold text-slate-200"
                />
                <TouchButton
                  label="提示"
                  ariaLabel="給我提示"
                  onClick={useHint}
                  disabled={complete}
                  className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-2 sm:px-3 py-1.5 text-xs font-bold text-amber-200"
                />
                <TouchButton
                  label="看答案"
                  ariaLabel="放棄並看答案"
                  onClick={() => {
                    setGaveUp(true);
                    setPath(puzzle.solution);
                    setRevealed([]);
                    setHintMessage(null);
                  }}
                  disabled={complete}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-2 sm:px-3 py-1.5 text-xs font-bold text-slate-400"
                />
              </div>
            </div>

            {hintMessage && !complete && (
              <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {hintMessage}
              </p>
            )}
          </div>

          {/* Right Wing: 繼電節點與指令 (Desktop Only) */}
          <aside className="ec-wing ec-wing--right hidden lg:flex flex-col justify-between w-64 xl:w-72 p-3.5 rounded-2xl border border-violet-500/25 bg-slate-950/85 backdrop-blur-md shadow-2xl shrink-0 select-none overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-violet-500/20">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-bold text-violet-200 tracking-wider">繼電節點矩陣</span>
                </div>
                <span className="text-[10px] text-violet-300/60 font-mono">RELAY MATRIX</span>
              </div>

              {/* Checkpoint Sequence Nodes (Interactive rewinding) */}
              <div className="mb-3.5 p-2.5 rounded-xl bg-slate-900/80 border border-violet-500/20">
                <div className="flex items-center justify-between text-[11px] font-medium text-violet-200/80 mb-2">
                  <span>節點導通清單</span>
                  <span className="text-[10px] text-slate-400">可點擊已導通節點倒帶</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {circuit?.checkpointStatus.map((cp) => (
                    <button
                      key={cp.number}
                      type="button"
                      disabled={!cp.reached}
                      onClick={() => rewindToCheckpoint(cp.cell)}
                      title={cp.reached ? '點擊倒帶至此節點' : undefined}
                      className={`p-1.5 rounded-lg border text-xs font-bold font-mono transition-all text-center ${
                        cp.reached
                          ? 'bg-violet-900/50 border-violet-400 text-violet-200 shadow-[0_0_8px_rgba(167,139,250,0.3)] hover:brightness-125 cursor-pointer active:scale-95'
                          : cp.isCurrentTarget
                          ? 'bg-amber-950/60 border-amber-400 text-amber-300 animate-pulse cursor-default'
                          : 'bg-slate-950/70 border-slate-800 text-slate-500 cursor-default'
                      }`}
                    >
                      <span>#{cp.number}</span>
                      <span className="block text-[9px] font-normal opacity-80">
                        {cp.reached ? '已導通' : cp.isCurrentTarget ? '目標' : '待連接'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Operations & Tactics Guide */}
              <div className="mb-3.5 p-2.5 rounded-xl bg-slate-900/80 border border-violet-500/20">
                <div className="text-[11px] font-medium text-violet-200/80 mb-1.5">通電操作秘笈</div>
                <div className="space-y-1.5 text-[10px] text-slate-300/80 leading-relaxed">
                  <div className="flex items-start gap-1.5">
                    <span className="text-cyan-400 font-bold shrink-0">🖱️ 拖曳連線:</span>
                    <span>單指或滑鼠連續劃過格子，往回拖可即時擦除。</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold shrink-0">🎯 數字倒帶:</span>
                    <span>點擊任何已連線的數字，路線自動倒帶至該處！</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold shrink-0">⚡ 安全急救:</span>
                    <span>觸發斷路警報時，點擊「倒回安全點」秒解死局。</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-violet-500/20 text-[10px] text-slate-400 flex items-center justify-between">
              <span>方向鍵可延伸電路</span>
              <span>已通電: {circuit?.conductedPct ?? 0}%</span>
            </div>
          </aside>
        </div>

        {gaveUp && showResult && (
          <ResultOverlay
            title="這是答案"
            subtitle="沒有計入紀錄。看一遍它怎麼繞過去，下一題會好一點。"
            variant="neutral"
            stats={[
              { label: '用時', value: formatDuration(elapsedMs) },
              { label: '提示', value: hintsUsed },
              { label: '難度', value: modeLabel() },
            ]}
            primaryLabel="再試同一題"
            onPrimary={() =>
              open(puzzle.seedCode, puzzle.difficulty, {
                daily: isDaily,
                weekly: isWeekly,
                weeklyDay: weeklyDayIndex,
                blocked: blockedCount,
              })
            }
            secondaryLabel="換一題"
            onSecondary={() =>
              open(randomSeedCode(), puzzle.difficulty, {
                blocked: puzzle.variant === 'blocked' ? blockedCount : 0,
              })
            }
          />
        )}

        {solved && showResult && (
          <ResultOverlay
            title="走透透了！"
            subtitle={
              isWeekly
                ? `本週進度 ${weeklyProgressCount(thisWeek)} / 7`
                : isDaily && dailyStats.streak > 0
                  ? `連續 ${dailyStats.streak} 天完成每日挑戰`
                  : hintsUsed > 0
                    ? `用了 ${hintsUsed} 次提示`
                    : '沒有用提示・完美閉環！'
            }
            variant="win"
            stats={[
              { label: '用時', value: formatDuration(elapsedMs) },
              { label: '提示', value: hintsUsed },
              { label: '阻抗', value: `${circuit?.impedanceOhms ?? 48} Ω` },
              { label: '難度', value: modeLabel() },
            ]}
            primaryLabel={isWeekly ? '回本週挑戰' : '換一題'}
            onPrimary={() => {
              if (isWeekly) setScreen('weekly');
              else
                open(randomSeedCode(), puzzle.difficulty, {
                  blocked: puzzle.variant === 'blocked' ? blockedCount : 0,
                });
            }}
            secondaryLabel="回選單"
            onSecondary={() => setScreen('title')}
          />
        )}

        <p className="mt-4 hidden text-center text-[10px] text-slate-500 sm:block">
          拖曳畫線・往回拖可擦除・方向鍵延伸・Backspace/Z 退一步・R 重畫・H 提示・⚡ 孤島斷路可一鍵倒回安全點
        </p>
      </div>
      <AchievementToast ids={toastIds} onDismiss={() => setToastIds([])} />
    </>
  );
}
