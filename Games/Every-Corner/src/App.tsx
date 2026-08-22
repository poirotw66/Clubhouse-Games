import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { Board } from './components/Board';
import { DAILY_DIFFICULTY, dailySeed, dateKey, formatDuration, summarise } from './game/daily';
import { DIFFICULTIES, DIFFICULTY_ORDER, generate } from './game/generate';
import { cellCount, colOf, rowOf, wallKey } from './game/grid';
import { HINT_SEQUENCE, computeHint } from './game/hint';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { clearGame, loadDaily, loadGame, recordDaily, saveGame } from './game/storage';
import type { CellId, DifficultyId, Puzzle } from './game/types';

type Screen = 'title' | 'play';

function seedFromUrl(): string {
  try {
    const param = new URLSearchParams(window.location.search).get('seed');
    return param ? normalizeSeedCode(param) : randomSeedCode();
  } catch {
    return randomSeedCode();
  }
}

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('title');
  const [seedCode, setSeedCode] = useState(seedFromUrl);
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [isDaily, setIsDaily] = useState(false);
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
  const [resumable, setResumable] = useState(() => loadGame());

  const today = dateKey();
  const stats = useMemo(() => summarise(dailyRecords, today), [dailyRecords, today]);
  const startedAt = useRef<number>(0);

  const total = puzzle ? cellCount(puzzle.size) : 0;
  const complete = puzzle !== null && path.length === total && path.length > 0;
  /** Filling the board only counts as solving it if the player was not shown the answer. */
  const solved = complete && !gaveUp;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  // Tick only while a puzzle is open and unsolved.
  //
  // The clock is derived from a single anchor rather than accumulated tick by
  // tick. Accumulating (`elapsed += now - lastTick`) ran at exactly half speed:
  // measured against wall time it showed 0:07 after 15 seconds, gaining one
  // second per two. Anything that mounts the effect twice, fires two intervals
  // against one shared `lastTick`, or drops a tick corrupts a running total,
  // and the error only ever loses time. Storing the instant the clock reads
  // zero and subtracting has none of those failure modes: a missed tick costs
  // nothing, and re-mounting recomputes the same anchor.
  useEffect(() => {
    if (screen !== 'play' || complete) return;
    startedAt.current = Date.now() - elapsedMs;
    const tick = () => setElapsedMs(Date.now() - startedAt.current);
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
    // elapsedMs is deliberately not a dependency: it is what this effect
    // writes, and re-anchoring on every write is how the old version lost time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, complete]);

  useEffect(() => {
    if (screen === 'play' && puzzle && !complete) {
      saveGame({
        seedCode: puzzle.seedCode,
        difficulty: puzzle.difficulty,
        isDaily,
        progress: { path, hintsUsed, elapsedMs, solved: false },
      });
    }
  }, [screen, puzzle, path, hintsUsed, elapsedMs, isDaily, solved]);

  // Record the daily result once, the moment it is finished.
  const recorded = useRef(false);
  useEffect(() => {
    if (!solved) return;
    clearGame();
    setResumable(null);
    if (isDaily && !recorded.current) {
      recorded.current = true;
      setDailyRecords(recordDaily({ date: today, elapsedMs, hintsUsed }));
    }
  }, [solved, isDaily, today, elapsedMs, hintsUsed]);

  const open = useCallback(
    (code: string, level: DifficultyId, daily: boolean, restore?: { path: CellId[]; hintsUsed: number; elapsedMs: number }) => {
      const built = generate({ seedCode: code, difficulty: level });
      setPuzzle(built);
      setPath(restore?.path ?? []);
      setHintsUsed(restore?.hintsUsed ?? 0);
      setElapsedMs(restore?.elapsedMs ?? 0);
      setHintStep(0);
      setHintMessage(null);
      setRevealed([]);
      setGaveUp(false);
      recorded.current = false;
      setSeedCode(code);
      setDifficulty(level);
      setIsDaily(daily);
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
  }, [puzzle, path, hintStep]);

  // Keyboard: arrows extend the path, Backspace steps back.
  useEffect(() => {
    if (screen !== 'play' || !puzzle) return;
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
        if (current.length >= 2 && next === current[current.length - 2]) return current.slice(0, -1);
        if (current.includes(next)) return current;
        if (puzzle.walls.includes(wallKey(last, next))) return current;
        return [...current, next];
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, puzzle, useHint]);

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
          </header>

          <section className="ec-card p-4">
            <h2 className="text-sm font-bold text-slate-200">每日挑戰</h2>
            <p className="mt-1 text-xs text-slate-400">
              {today}・所有人今天解同一題
              {stats.streak > 0 && <span className="ml-2 text-violet-300">連續 {stats.streak} 天</span>}
              {stats.bestMs > 0 && (
                <span className="ml-2 text-slate-500">最佳 {formatDuration(stats.bestMs)}</span>
              )}
            </p>
            <TouchButton
              label={dailyRecords.some((r) => r.date === today) ? '今天已完成，再玩一次' : '開始今日挑戰'}
              ariaLabel="開始今日挑戰"
              onClick={() => open(dailySeed(today), DAILY_DIFFICULTY, true)}
              className="mt-3 w-full rounded-xl bg-violet-500 px-4 text-base font-black text-slate-950"
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
              onClick={() => open(normalizeSeedCode(seedCode), difficulty, false)}
              className="mt-3 w-full rounded-xl border border-violet-400/60 bg-violet-500/20 px-4 text-base font-bold text-violet-100"
            />
          </section>

          {resumable && (
            <TouchButton
              label="繼續上次那一題"
              ariaLabel="繼續上次那一題"
              onClick={() =>
                open(resumable.seedCode, resumable.difficulty, resumable.isDaily, resumable.progress)
              }
              className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 text-base font-bold text-slate-100"
            />
          )}
        </div>
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
              {isDaily ? '今日挑戰' : DIFFICULTIES[puzzle.difficulty].label}
              <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                {formatDuration(elapsedMs)}
              </span>
            </h1>
            <p className="text-[11px] text-slate-500">
              種子碼 <span className="font-mono text-violet-300/80">{puzzle.seedCode}</span>
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
              setPath(next);
              setRevealed([]);
            }}
            solved={solved}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            已走 <span className="font-mono text-slate-200">{path.length}</span> / {total} 格
            {hintsUsed > 0 && <span className="ml-2 text-slate-500">提示 {hintsUsed} 次</span>}
          </p>
          <div className="flex gap-2">
            <TouchButton
              label="退一步"
              ariaLabel="退回上一步"
              onClick={() => setPath((p) => p.slice(0, -1))}
              disabled={path.length === 0}
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

        {gaveUp && (
          <section className="mt-4 rounded-2xl border border-slate-600 bg-slate-800/60 p-4 text-center">
            <p className="text-lg font-black text-slate-200">這是答案</p>
            <p className="mt-1 text-sm text-slate-400">
              沒有計入紀錄。看一遍它怎麼繞過去，下一題會好一點。
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <TouchButton
                label="再試同一題"
                ariaLabel="重畫同一題"
                onClick={() => open(puzzle.seedCode, puzzle.difficulty, isDaily)}
                className="flex-1 rounded-xl bg-violet-500 px-4 text-sm font-black text-slate-950"
              />
              <TouchButton
                label="換一題"
                ariaLabel="換一題"
                onClick={() => open(randomSeedCode(), puzzle.difficulty, false)}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-100"
              />
              <TouchButton
                label="回選單"
                ariaLabel="回到選單"
                onClick={() => setScreen('title')}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-100"
              />
            </div>
          </section>
        )}

        {solved && (
          <section className="mt-4 rounded-2xl border border-emerald-400/50 bg-emerald-500/10 p-4 text-center">
            <p className="text-lg font-black text-emerald-200">走透透了！</p>
            <p className="mt-1 text-sm text-emerald-100/80">
              {formatDuration(elapsedMs)}
              {hintsUsed > 0 ? `・用了 ${hintsUsed} 次提示` : '・沒有用提示'}
            </p>
            {isDaily && stats.streak > 0 && (
              <p className="mt-1 text-xs text-emerald-200/70">連續 {stats.streak} 天完成每日挑戰</p>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <TouchButton
                label="換一題"
                ariaLabel="換一題"
                onClick={() => open(randomSeedCode(), puzzle.difficulty, false)}
                className="flex-1 rounded-xl bg-emerald-500 px-4 text-sm font-black text-slate-950"
              />
              <TouchButton
                label="回選單"
                ariaLabel="回到選單"
                onClick={() => setScreen('title')}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-100"
              />
            </div>
          </section>
        )}

        <p className="mt-4 hidden text-center text-[10px] text-slate-500 sm:block">
          拖曳畫線・往回拖可擦除・方向鍵延伸・Backspace 退一步・H 提示
        </p>
      </div>
    </>
  );
}
