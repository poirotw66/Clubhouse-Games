import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playGoal, playLose, playMove, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { AchievementToast } from './components/AchievementToast';
import { Board } from './components/Board';
import {
  ACHIEVEMENTS,
  applyClear,
  markWeeklyCompletion,
  sizeKeyOf,
} from './game/achievements';
import { DAILY_DIFFICULTY, dailySeed, dateKey, formatDuration, summarise } from './game/daily';
import { DIFFICULTIES, DIFFICULTY_ORDER, generate } from './game/generate';
import { colOf, playableCount, rowOf, wallKey } from './game/grid';
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

  const today = dateKey();
  const currentWeek = weekKey();
  const dailyStats = useMemo(() => summarise(dailyRecords, today), [dailyRecords, today]);
  const startedAt = useRef<number>(0);

  const total = puzzle ? playableCount(puzzle.size, puzzle.blocked) : 0;
  const complete = puzzle !== null && path.length === total && path.length > 0;
  /** Filling the board only counts as solving it if the player was not shown the answer. */
  const solved = complete && !gaveUp;

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
    playGoal();
    window.setTimeout(() => {
      playWin();
      setShowResult(true);
    }, 180);
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

      if (event.key === 'Backspace') {
        event.preventDefault();
        setPath((p) => p.slice(0, -1));
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
          return start ? [Number(start[0])] : current;
        }
        const last = current[current.length - 1];
        const row = rowOf(puzzle.size, last) + delta[0];
        const col = colOf(puzzle.size, last) + delta[1];
        if (row < 0 || col < 0 || row >= puzzle.size.rows || col >= puzzle.size.cols) return current;
        const next = row * puzzle.size.cols + col;
        if (holes.has(next)) return current;
        if (current.length >= 2 && next === current[current.length - 2]) return current.slice(0, -1);
        if (current.includes(next)) return current;
        if (puzzle.walls.includes(wallKey(last, next))) return current;
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
            <p className="text-sm tracking-[0.4em] text-slate-400">EVERY CORNER</p>
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
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-14">
        <header className="mt-3 mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <h1 className="text-lg font-black text-slate-100">
              {modeLabel()}
              <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                {formatDuration(elapsedMs)}
              </span>
            </h1>
            <p className="text-[11px] text-slate-500">
              種子碼 <span className="font-mono text-violet-300/80">{puzzle.seedCode}</span>
              {puzzle.blocked.length > 0 && (
                <span className="ml-2 text-pink-300/80">缺口 {puzzle.blocked.length}</span>
              )}
            </p>
          </div>
          <TouchButton
            label="回選單"
            ariaLabel="回到選單"
            onClick={() => setScreen('title')}
            className="rounded-lg border border-slate-700 bg-slate-800/70 px-3 text-xs font-semibold text-slate-400"
          />
        </header>

        <div className="ec-card p-3">
          <Board
            puzzle={puzzle}
            path={path}
            revealed={revealed}
            onPathChange={(next) => {
              if (next.length > path.length) playMove();
              setPath(next);
              setRevealed([]);
            }}
            solved={solved}
            onTraceComplete={onTraceComplete}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            已走 <span className="font-mono text-slate-200">{path.length}</span> / {total} 格
            {puzzle.blocked.length > 0 && (
              <span className="ml-2 text-slate-500">空洞 {puzzle.blocked.length}</span>
            )}
            {hintsUsed > 0 && <span className="ml-2 text-slate-500">提示 {hintsUsed} 次</span>}
          </p>
          <div className="flex gap-2">
            <TouchButton
              label="退一步"
              ariaLabel="退回上一步"
              onClick={() => setPath((p) => p.slice(0, -1))}
              disabled={path.length === 0 || complete}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-bold text-slate-200"
            />
            <TouchButton
              label="重畫"
              ariaLabel="清空路線重畫"
              onClick={() => {
                setPath([]);
                setRevealed([]);
                setHintMessage(null);
              }}
              disabled={complete}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-bold text-slate-200"
            />
            <TouchButton
              label="提示"
              ariaLabel="給我提示"
              onClick={useHint}
              disabled={complete}
              className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-3 text-xs font-bold text-amber-200"
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
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-bold text-slate-400"
            />
          </div>
        </div>

        {hintMessage && !complete && (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            {hintMessage}
          </p>
        )}

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
                    : '沒有用提示'
            }
            variant="win"
            stats={[
              { label: '用時', value: formatDuration(elapsedMs) },
              { label: '提示', value: hintsUsed },
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
          拖曳畫線・往回拖可擦除・方向鍵延伸・Backspace 退一步・H 提示
        </p>
      </div>
      <AchievementToast ids={toastIds} onDismiss={() => setToastIds([])} />
    </>
  );
}
