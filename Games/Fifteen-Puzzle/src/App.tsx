import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playLose, playWin } from '@clubhouse/shared/synthAudio';
import {
  CAMPAIGN_STAGES,
  clearStageAndPersist,
  continueStageIndex,
  isStageUnlocked,
  loadCampaignProgress,
  moveLimitFor,
  stageSeed,
  type CampaignProgress,
  type CampaignStage,
} from './campaign.ts';
import {
  computeStreak,
  dailyConfig,
  dailySeedNumber,
  dateKey,
} from './daily.ts';
import {
  BOARD_SIZES,
  PAR_LABEL,
  SPRINT_LIMIT_SEC,
  THEME_CONFIGS,
  cellCount,
  countInPlace,
  harmonyPct,
  hintTileIndex,
  isSolved,
  manhattanSum,
  parGrade,
  scrambleFromSeed,
  sizeLabel,
  slideByDirection,
  tileManhattan,
  type Board,
  type BoardSize,
  type ParGrade,
  type PlayMode,
  type ScrambleTier,
  type SlideDir,
  type ThemeId,
  type VisualStyle,
} from './fifteenLogic.ts';
import {
  isHapticsEnabled,
  isSoundEnabled,
  playGearLatchLock,
  playMechanicalSlide,
  playSpeedCombo,
  setHapticsEnabled,
  setSoundEnabled,
  triggerHaptic,
} from './mechanicalAudio.ts';
import { PuzzleBoard } from './PuzzleBoard.tsx';
import { hashString } from './rng.ts';
import { optimalMoves } from './solver.ts';
import {
  loadBestMoves,
  loadBestSprintSec,
  loadDaily,
  loadHeatmapEnabled,
  loadMaxSps,
  loadUserTheme,
  recordDaily,
  saveBestMoves,
  saveBestSprintSec,
  saveHeatmapEnabled,
  saveMaxSps,
  saveUserTheme,
  type DailyRecord,
} from './storage.ts';

const TIER_OPTIONS: { id: ScrambleTier; label: string }[] = [
  { id: 'easy', label: '簡單' },
  { id: 'normal', label: '普通' },
  { id: 'hard', label: '困難' },
];

const THEME_CYCLE: ThemeId[] = ['walnut', 'obsidian', 'cyber'];

type Screen = 'title' | 'play' | 'campaign';

type Session = {
  mode: PlayMode;
  size: BoardSize;
  tier: ScrambleTier;
  style: VisualStyle;
  board: Board;
  scrambleMoves: number | null;
  optimal: number;
  optimalExact: boolean;
  stageIndex: number | null;
  moveLimit: number | null;
  timeLimitSec: number | null;
  seed: number;
};

function buildSession(opts: {
  mode: PlayMode;
  size: BoardSize;
  tier: ScrambleTier;
  style: VisualStyle;
  seed: number;
  stageIndex?: number | null;
  stage?: CampaignStage | null;
}): Session {
  const { board, scrambleMoves } = scrambleFromSeed(opts.size, opts.tier, opts.seed);
  const solved = optimalMoves(board, opts.size, scrambleMoves);
  let moveLimit: number | null = null;
  let timeLimitSec: number | null = null;
  if (opts.mode === 'sprint') timeLimitSec = SPRINT_LIMIT_SEC;
  if (opts.stage) {
    if (opts.stage.limit.kind === 'moves') {
      moveLimit = moveLimitFor(solved.moves, opts.stage.limit.slack);
    } else {
      timeLimitSec = opts.stage.limit.seconds;
    }
  }
  return {
    mode: opts.mode,
    size: opts.size,
    tier: opts.tier,
    style: opts.style,
    board,
    scrambleMoves,
    optimal: solved.moves,
    optimalExact: solved.exact,
    stageIndex: opts.stageIndex ?? null,
    moveLimit,
    timeLimitSec,
    seed: opts.seed,
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [size, setSize] = useState<BoardSize>(4);
  const [tier, setTier] = useState<ScrambleTier>('normal');
  const [style, setStyle] = useState<VisualStyle>('number');
  const [theme, setTheme] = useState<ThemeId>(() => loadUserTheme());
  const [showHeatmap, setShowHeatmap] = useState<boolean>(() => loadHeatmapEnabled());
  const [highlightedTile, setHighlightedTile] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  const [hapticsOn, setHapticsOn] = useState<boolean>(() => isHapticsEnabled());
  const [mobileHudOpen, setMobileHudOpen] = useState(false);

  // Speedometer Telemetry
  const recentSlideTimes = useRef<number[]>([]);
  const lastSlideTime = useRef<number>(0);
  const [currentSps, setCurrentSps] = useState(0);
  const [maxSps, setMaxSps] = useState<number>(() => loadMaxSps());
  const [comboCount, setComboCount] = useState(0);

  const [session, setSession] = useState<Session | null>(null);
  const [board, setBoard] = useState<Board>(() => scrambleFromSeed(4, 'normal', 1).board);
  const [history, setHistory] = useState<{ board: Board; moves: number }[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [loseReason, setLoseReason] = useState<'time' | 'moves'>('time');
  const [elapsed, setElapsed] = useState(0);
  const [bestMoves, setBestMoves] = useState<number | null>(() => loadBestMoves(4, 'normal'));
  const [bestSprint, setBestSprint] = useState<number | null>(() => loadBestSprintSec(4, 'normal'));
  const [newRecord, setNewRecord] = useState(false);
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [showGhost, setShowGhost] = useState(false);
  const [grade, setGrade] = useState<ParGrade | null>(null);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>(() => loadDaily());
  const [campaign, setCampaign] = useState<CampaignProgress>(() => loadCampaignProgress());
  const settleRef = useRef(false);

  const today = dateKey();
  const streak = computeStreak(dailyRecords, today);
  const todayDone = dailyRecords.some((r) => r.date === today);
  const tileFaceUrl = `${import.meta.env.BASE_URL}tile-face.jpg`;
  const pictureUrl = `${import.meta.env.BASE_URL}puzzle-art.jpg`;

  useEffect(() => {
    setBestMoves(loadBestMoves(size, tier));
    setBestSprint(loadBestSprintSec(size, tier));
  }, [size, tier]);

  const handleSetTheme = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    saveUserTheme(nextTheme);
  };

  const handleToggleHeatmap = () => {
    setShowHeatmap((prev) => {
      const next = !prev;
      saveHeatmapEnabled(next);
      return next;
    });
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const handleToggleHaptics = () => {
    const next = !hapticsOn;
    setHapticsOn(next);
    setHapticsEnabled(next);
  };

  const begin = useCallback((next: Session) => {
    settleRef.current = false;
    setSession(next);
    setBoard(next.board);
    setHistory([]);
    setMoves(0);
    setWon(false);
    setLost(false);
    setElapsed(0);
    setNewRecord(false);
    setHintIndex(null);
    setGrade(null);
    setHighlightedTile(null);
    recentSlideTimes.current = [];
    lastSlideTime.current = 0;
    setCurrentSps(0);
    setComboCount(0);
    setBestMoves(loadBestMoves(next.size, next.tier));
    setBestSprint(loadBestSprintSec(next.size, next.tier));
    setMaxSps(loadMaxSps());
    setScreen('play');
  }, []);

  const startClassicOrSprint = (mode: 'classic' | 'sprint') => {
    const seed = (Math.random() * 0xffffffff) >>> 0;
    begin(
      buildSession({
        mode,
        size,
        tier,
        style,
        seed,
      }),
    );
  };

  const startDaily = () => {
    const cfg = dailyConfig(today);
    begin(
      buildSession({
        mode: 'daily',
        size: cfg.size,
        tier: cfg.tier,
        style: cfg.style,
        seed: dailySeedNumber(today),
      }),
    );
  };

  const startCampaignStage = (index: number) => {
    const stage = CAMPAIGN_STAGES[index];
    if (!stage || !isStageUnlocked(index, campaign.clearedCount)) return;
    begin(
      buildSession({
        mode: 'campaign',
        size: stage.size,
        tier: stage.tier,
        style: stage.style,
        seed: stageSeed(stage),
        stageIndex: index,
        stage,
      }),
    );
  };

  const restartSame = () => {
    if (!session) return;
    if (session.mode === 'daily') {
      startDaily();
      return;
    }
    if (session.mode === 'campaign' && session.stageIndex != null) {
      startCampaignStage(session.stageIndex);
      return;
    }
    begin(
      buildSession({
        mode: session.mode,
        size: session.size,
        tier: session.tier,
        style: session.style,
        seed: hashString(`reroll-${session.seed}-${Date.now()}`),
      }),
    );
  };

  useEffect(() => {
    if (screen !== 'play' || won || lost) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [screen, won, lost]);

  // Periodic SPS decay when idle
  useEffect(() => {
    if (screen !== 'play' || won || lost) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - lastSlideTime.current > 1200) {
        setCurrentSps((s) => (s > 0 ? Math.max(0, Math.round((s * 0.5) * 10) / 10) : 0));
        setComboCount(0);
      }
    }, 600);
    return () => window.clearInterval(id);
  }, [screen, won, lost]);

  useEffect(() => {
    if (screen !== 'play' || !session || won || lost) return;
    const limit = session.timeLimitSec;
    if (limit != null && elapsed >= limit) {
      setLost(true);
      setLoseReason('time');
      playLose();
      triggerHaptic([40, 60, 40]);
    }
  }, [elapsed, session, won, lost, screen]);

  useEffect(() => {
    if (screen !== 'play' || !session || won || lost || settleRef.current) return;
    if (!isSolved(board, session.size)) return;

    settleRef.current = true;
    setWon(true);
    setHintIndex(null);
    playWin();
    triggerHaptic([30, 50, 40, 60, 50]);
    const g = parGrade(moves, session.optimal);
    setGrade(g);

    if (session.mode === 'classic') {
      const saved = saveBestMoves(session.size, session.tier, moves);
      setBestMoves(saved);
      setNewRecord(saved === moves);
    } else if (session.mode === 'sprint') {
      const saved = saveBestSprintSec(session.size, session.tier, elapsed);
      setBestSprint(saved);
      setNewRecord(saved === elapsed);
    } else if (session.mode === 'daily') {
      setDailyRecords(
        recordDaily({
          date: today,
          moves,
          elapsedSec: elapsed,
          optimal: session.optimal,
          grade: g,
        }),
      );
    } else if (session.mode === 'campaign' && session.stageIndex != null) {
      setCampaign(clearStageAndPersist(session.stageIndex, moves, elapsed));
    }
  }, [board, won, lost, moves, elapsed, session, screen, today]);

  const onSlide = useCallback(
    (next: Board, _tileIndex: number, movedCount = 1) => {
      if (!session || won || lost) return;

      const prevInPlace = countInPlace(board, session.size);
      const nextInPlace = countInPlace(next, session.size);

      // Play rich mechanical audio & haptics
      playMechanicalSlide(movedCount);
      if (nextInPlace > prevInPlace) {
        playGearLatchLock();
      }

      // Calculate sliding speed & combo
      const now = Date.now();
      const times = recentSlideTimes.current;
      times.push(now);
      while (times.length > 0 && now - times[0] > 2400) {
        times.shift();
      }
      const durationSec = Math.max(0.6, (now - times[0]) / 1000);
      const spsVal = Math.round((times.length / durationSec) * 10) / 10;
      setCurrentSps(spsVal);

      const savedMax = saveMaxSps(spsVal);
      setMaxSps(savedMax);

      const delta = now - lastSlideTime.current;
      lastSlideTime.current = now;
      let nextCombo = 1;
      if (delta < 950) {
        nextCombo = comboCount + 1;
        setComboCount(nextCombo);
        if (nextCombo >= 3) {
          playSpeedCombo(nextCombo);
        }
      } else {
        setComboCount(1);
      }

      setHistory((h) => [...h, { board, moves }]);
      const nextMoves = moves + movedCount;
      setBoard(next);
      setMoves(nextMoves);
      setHintIndex(null);

      if (
        session.moveLimit != null &&
        nextMoves >= session.moveLimit &&
        !isSolved(next, session.size)
      ) {
        setLost(true);
        setLoseReason('moves');
        playLose();
        triggerHaptic([40, 60, 40]);
      }
    },
    [board, comboCount, moves, session, won, lost],
  );

  const handleUndo = useCallback(() => {
    if (won || lost || history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setBoard(prev.board);
    setMoves(prev.moves);
    setHintIndex(null);
    playMechanicalSlide(1);
  }, [history, won, lost]);

  const slideDir = useCallback(
    (dir: SlideDir) => {
      if (won || lost || !session) return;
      const next = slideByDirection(board, session.size, dir);
      if (!next) return;
      onSlide(next, -1, 1);
    },
    [board, onSlide, session, won, lost],
  );

  const handleHint = useCallback(() => {
    if (!session || won || lost) return;
    const idx = hintTileIndex(board, session.size);
    setHintIndex(idx);
    if (idx != null) {
      playSpeedCombo(1);
      triggerHaptic(12);
    }
  }, [board, session, won, lost]);

  useEffect(() => {
    if (screen !== 'play' || !session || won || lost) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Preserve browser shortcuts and native form/button keyboard controls.
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if ((e.key === 'Enter' || e.key === ' ') && target?.closest('button, a, [role="button"]')) return;
      if (e.key === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        slideDir('up');
      } else if (e.key === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        slideDir('down');
      } else if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        slideDir('left');
      } else if (e.key === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        slideDir('right');
      } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        handleHint();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        restartSame();
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        setShowGhost((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleHeatmap();
      } else if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        const curIdx = THEME_CYCLE.indexOf(theme);
        const next = THEME_CYCLE[(curIdx + 1) % THEME_CYCLE.length];
        handleSetTheme(next);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, session, won, lost, slideDir, handleUndo, handleHint, theme]);

  const canUndo = !won && !lost && history.length > 0;
  const remain =
    session?.timeLimitSec != null ? Math.max(0, session.timeLimitSec - elapsed) : null;

  if (screen === 'title') {
    const cfg = dailyConfig(today);
    return (
      <Shell>
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>⚙️ 奢華典藏機械推盤</span>
            <span>•</span>
            <span>{THEME_CONFIGS[theme].name}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wide text-white drop-shadow-md">
            數字推盤
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 text-center max-w-md mt-1">
            立體機械雕刻・曼哈頓熱力光暈・滑動衝刺波與即時時速儀表
          </p>
        </div>

        {/* Board & Theme Settings */}
        <section className="w-full max-w-md flex flex-col gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-700/60 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold">
              工坊工藝材質
            </h2>
            <span className="text-[11px] text-amber-300/90 font-mono">
              {THEME_CONFIGS[theme].desc}
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="材質主題">
            {THEME_CYCLE.map((tid) => (
              <button
                key={tid}
                type="button"
                onClick={() => handleSetTheme(tid)}
                className={`min-h-[44px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold touch-manipulation transition-all ${
                  theme === tid
                    ? 'border-amber-400 bg-amber-500/25 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                    : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {THEME_CONFIGS[tid].name}
              </button>
            ))}
          </div>

          <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold mt-1">
            盤面大小與打亂難度
          </h2>
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="盤面大小">
            {BOARD_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={chipClass(size === s, 'emerald')}
              >
                {sizeLabel(s)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="打亂難度">
            {TIER_OPTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTier(id)}
                className={chipClass(tier === id, 'sky')}
              >
                {label}
              </button>
            ))}
          </div>

          <h2 className="text-xs uppercase tracking-wider text-slate-400 font-bold mt-1">
            展示風格
          </h2>
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="樣式">
            {(
              [
                { id: 'number' as const, label: '刻字數字' },
                { id: 'picture' as const, label: '名畫拼圖' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setStyle(id)}
                className={chipClass(style === id, 'amber')}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Play Modes */}
        <div className="flex flex-col gap-2.5 w-full max-w-sm">
          <button
            type="button"
            className="w-full min-h-[46px] px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold text-white shadow-lg touch-manipulation transition-all"
            onClick={() => startClassicOrSprint('classic')}
          >
            經典挑戰
          </button>
          <button
            type="button"
            className={secondaryBtn}
            onClick={() => startClassicOrSprint('sprint')}
          >
            ⏱️ 衝刺限時 {SPRINT_LIMIT_SEC}s
          </button>
          <button type="button" className={secondaryBtn} onClick={startDaily}>
            📅 每日挑戰
            <span className="block text-xs font-normal text-slate-300 mt-0.5">
              {sizeLabel(cfg.size)}・{cfg.style === 'picture' ? '名畫' : '數字'}
              {todayDone ? '・今日已完成' : ''}
              {streak > 0 ? `・連續 ${streak} 天` : ''}
            </span>
          </button>
          <button type="button" className={secondaryBtn} onClick={() => setScreen('campaign')}>
            🪜 闖關階梯
            <span className="block text-xs font-normal text-slate-300 mt-0.5">
              進度 {campaign.clearedCount}/{CAMPAIGN_STAGES.length}
            </span>
          </button>
        </div>

        {(bestMoves != null || bestSprint != null || maxSps > 0) && (
          <div className="text-xs text-slate-400 bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-800 text-center">
            <span>本機紀錄（{sizeLabel(size)}／{TIER_OPTIONS.find((t) => t.id === tier)?.label}）：</span>
            {bestMoves != null && <span className="text-emerald-300 font-mono ml-1">最佳 {bestMoves} 步</span>}
            {bestSprint != null && <span className="text-sky-300 font-mono ml-2">衝刺 {bestSprint}s</span>}
            {maxSps > 0 && <span className="text-amber-300 font-mono ml-2">最速 {maxSps} SPS</span>}
          </div>
        )}
      </Shell>
    );
  }

  if (screen === 'campaign') {
    return (
      <Shell>
        <h1 className="text-2xl font-bold">闖關階梯</h1>
        <p className="text-sm text-slate-300">依序通關解鎖・步數或限時挑戰</p>
        <ul className="w-full max-w-md flex flex-col gap-2">
          {CAMPAIGN_STAGES.map((stage, i) => {
            const unlocked = isStageUnlocked(i, campaign.clearedCount);
            const best = campaign.bestMoves[stage.id];
            return (
              <li key={stage.id}>
                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={() => startCampaignStage(i)}
                  className={`w-full text-left min-h-[44px] px-4 py-3 rounded-xl border touch-manipulation ${
                    unlocked
                      ? 'border-emerald-500/40 bg-slate-800/80 hover:bg-slate-700/80'
                      : 'border-slate-700 bg-slate-900/50 opacity-50'
                  }`}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">
                      {i + 1}. {stage.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {sizeLabel(stage.size)}
                      {stage.style === 'picture' ? '・圖' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{stage.blurb}</p>
                  {best != null && (
                    <p className="text-xs text-emerald-300/90 mt-1">最佳 {best} 步</p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className={secondaryBtn} onClick={() => setScreen('title')}>
          回標題
        </button>
        <button
          type="button"
          className={primaryBtn}
          onClick={() => startCampaignStage(continueStageIndex(campaign.clearedCount))}
        >
          繼續挑戰
        </button>
      </Shell>
    );
  }

  // Play Screen
  const s = session!;
  const optimalLabel = s.optimalExact ? String(s.optimal) : `≤${s.optimal}`;
  const totalTiles = cellCount(s.size) - 1;
  const inPlaceCount = countInPlace(board, s.size);
  const harmony = harmonyPct(board, s.size);
  const manhattan = manhattanSum(board, s.size);
  const liveGrade = parGrade(moves, s.optimal);
  const parDelta = moves - s.optimal;

  return (
    <Shell>
      <div className="w-full flex flex-col items-center gap-3">
        {/* Header Title & Tag */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold uppercase tracking-wider mb-1">
            <span>{modeLabel(s.mode)}</span>
            <span>•</span>
            <span>{sizeLabel(s.size)}</span>
            <span>•</span>
            <span>{s.style === 'picture' ? '名畫拼圖' : '數字推盤'}</span>
            <span>•</span>
            <span className="text-amber-300">{THEME_CONFIGS[theme].name}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-wide text-white drop-shadow-sm">
            {s.stageIndex != null ? CAMPAIGN_STAGES[s.stageIndex]?.name : '數字推盤'}
          </h1>
        </div>

        {/* Mobile HUD Toggle & Bar (Visible under 1024px) */}
        <div className="lg:hidden w-full max-w-[440px] flex flex-col gap-2">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-300">
                步數: <strong className="text-emerald-400 font-mono text-sm">{moves}</strong>
              </span>
              <span className="text-amber-300 font-mono font-bold">
                ⚡ {currentSps} SPS
              </span>
              {comboCount >= 2 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold animate-pulse">
                  {comboCount}x 連推
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileHudOpen((v) => !v)}
              className="px-2.5 py-1 rounded-lg border border-slate-600 bg-slate-800 text-[11px] text-slate-200 font-medium touch-manipulation"
            >
              {mobileHudOpen ? '收起戰術盤 ▲' : '戰術儀表 ▼'}
            </button>
          </div>

          {/* Collapsible Mobile Drawer */}
          {mobileHudOpen && (
            <div className="p-3.5 rounded-xl bg-slate-950/95 border border-emerald-500/30 shadow-2xl flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">歸位和諧度</span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">{harmony}%</span>
                  <span className="text-slate-500 text-[10px] ml-1">({inPlaceCount}/{totalTiles})</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">預測評等</span>
                  <span className="text-amber-400 font-bold font-mono text-sm">
                    {liveGrade}（{PAR_LABEL[liveGrade]}）
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                <span className="text-slate-400">曼哈頓總偏距</span>
                <span className="text-amber-300 font-bold font-mono">{manhattan} 步</span>
              </div>

              {/* Theme & Heatmap Quick Toggles */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400 text-[11px]">材質主題</span>
                <div className="flex gap-1">
                  {THEME_CYCLE.map((tid) => (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => handleSetTheme(tid)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        theme === tid
                          ? 'border-amber-400 bg-amber-500/25 text-amber-200'
                          : 'border-slate-700 bg-slate-800 text-slate-400'
                      }`}
                    >
                      {THEME_CONFIGS[tid].name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cockpit Layout */}
        <div className="fp-cockpit-shell">
          {/* Left Wing: PUZZLE TELEMETRY */}
          <aside className="fp-wing fp-wing--left">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-emerald-500/20">
              <span className="text-xs font-bold text-emerald-300 tracking-wider uppercase flex items-center gap-1.5">
                <span>🧭</span>
                <span>解謎拓撲導航</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                TELEMETRY
              </span>
            </div>

            {/* Harmony Progress Gauge */}
            <div className="mb-3 p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">全盤歸位和諧度</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">
                  {harmony}%
                </span>
              </div>
              <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-slate-800 mb-1.5">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${harmony}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>已歸位方塊</span>
                <span className="font-mono text-emerald-300">
                  {inPlaceCount} / {totalTiles} 格
                </span>
              </div>
            </div>

            {/* Real-Time Speedometer (SPS & Combo) */}
            <div className="mb-3 p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  <span>⚡</span>
                  <span>即時推盤時速</span>
                </span>
                <span className="font-mono text-amber-300 font-bold text-sm">
                  {currentSps} SPS
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>連擊動態</span>
                <span className="font-mono font-bold text-emerald-300">
                  {comboCount >= 2 ? `🔥 ${comboCount}x COMBO` : '平穩推移'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                <span>最高時速紀錄</span>
                <span className="font-mono">{maxSps} 次/秒</span>
              </div>
            </div>

            {/* Predicted Par Grade */}
            <div className="mb-3 p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-300 font-medium">預測通關評等</span>
                <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {liveGrade}（{PAR_LABEL[liveGrade]}）
                </span>
              </div>
              <div className="text-[11px] text-slate-400 leading-snug">
                {parDelta <= 0
                  ? `🔥 步數保持在標準桿內（領先 ${Math.abs(parDelta)} 步）`
                  : `⚠️ 超出最佳標準桿 ${parDelta} 步`}
              </div>
            </div>

            {/* Manhattan Distance Sum */}
            <div className="mb-3 p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300 font-medium">曼哈頓總偏差距</span>
                <span className="font-mono text-amber-300 font-bold text-xs">
                  {manhattan} 步
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                全盤所有方塊距目標位置之總偏離格數，歸零即宣告通關。
              </p>
            </div>

            {/* Tactical Shortcuts Guide */}
            <div className="mt-auto pt-2 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>方向鍵 / WASD</span>
                <span className="text-slate-300 font-mono">推動方塊</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Z / Backspace</span>
                <span className="text-slate-300 font-mono">復原上步</span>
              </div>
              <div className="flex items-center justify-between">
                <span>H / G</span>
                <span className="text-slate-300 font-mono">提示 / 透視</span>
              </div>
              <div className="flex items-center justify-between">
                <span>M / T</span>
                <span className="text-slate-300 font-mono">熱力 / 主題</span>
              </div>
              <div className="flex items-center justify-between">
                <span>R 鍵</span>
                <span className="text-slate-300 font-mono">重新開局</span>
              </div>
            </div>
          </aside>

          {/* Center Main Board */}
          <main className="fp-board-center">
            {/* Quick status bar */}
            <div className="flex items-center justify-between w-full max-w-[440px] px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700/60 text-xs mb-3">
              <span className="text-slate-300">
                步數: <strong className="text-emerald-400 font-mono text-sm">{moves}</strong>
                {s.moveLimit != null ? ` / ${s.moveLimit}` : ''}
              </span>
              {remain != null && (
                <span className="text-amber-300 font-mono">
                  ⏱️ 剩餘 {remain}s
                </span>
              )}
              <span className="text-slate-400">
                標準桿: <strong className="text-slate-200 font-mono">{optimalLabel}</strong>
              </span>
              <span className="text-emerald-400/90 font-mono">
                ✓ {inPlaceCount}/{totalTiles}
              </span>
            </div>

            {/* Luxury Mechanical Board */}
            <PuzzleBoard
              board={board}
              size={s.size}
              style={s.style}
              theme={theme}
              showHeatmap={showHeatmap}
              highlightedTile={highlightedTile}
              hintIndex={hintIndex}
              disabled={won || lost}
              onSlide={onSlide}
              pictureUrl={s.style === 'picture' ? pictureUrl : tileFaceUrl}
              showGhost={showGhost}
              onTileHover={(t) => setHighlightedTile(t)}
            />

            {/* Quick Feature Chips (Ghost & Heatmap & Theme) */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 w-full max-w-[440px]">
              <button
                type="button"
                onClick={() => setShowGhost((g) => !g)}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold touch-manipulation border transition-all ${
                  showGhost
                    ? 'border-emerald-400/90 bg-emerald-500/25 text-emerald-200 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                }`}
                title="鍵盤快捷鍵: G"
              >
                {showGhost ? '👁️ 關閉透視' : '👻 目標透視 (G)'}
              </button>

              <button
                type="button"
                onClick={handleToggleHeatmap}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold touch-manipulation border transition-all ${
                  showHeatmap
                    ? 'border-amber-400/90 bg-amber-500/25 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700/80'
                }`}
                title="鍵盤快捷鍵: M"
              >
                {showHeatmap ? '🔥 關閉熱力' : '🔥 熱力光暈 (M)'}
              </button>

              <button
                type="button"
                onClick={() => {
                  const curIdx = THEME_CYCLE.indexOf(theme);
                  handleSetTheme(THEME_CYCLE[(curIdx + 1) % THEME_CYCLE.length]);
                }}
                className="min-h-[40px] px-3 rounded-xl text-xs font-semibold touch-manipulation border border-slate-700 bg-slate-800/80 text-amber-300 hover:bg-slate-700/80"
                title="鍵盤快捷鍵: T"
              >
                🎨 {THEME_CONFIGS[theme].name}
              </button>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap justify-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className={toolBtn}
                title="鍵盤快捷鍵: Z"
              >
                復原 (Z)
              </button>
              <button
                type="button"
                onClick={handleHint}
                disabled={won || lost}
                className={toolBtnAmber}
                title="鍵盤快捷鍵: H"
              >
                提示 (H)
              </button>
              <button
                type="button"
                onClick={restartSame}
                className={toolBtn}
                title="鍵盤快捷鍵: R"
              >
                重開 (R)
              </button>
              <button
                type="button"
                onClick={() => setScreen('title')}
                className={toolBtn}
              >
                選單
              </button>
            </div>
          </main>

          {/* Right Wing: BLUEPRINT & WORKSHOP */}
          <aside className="fp-wing fp-wing--right">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-sky-500/20">
              <span className="text-xs font-bold text-sky-300 tracking-wider uppercase flex items-center gap-1.5">
                <span>📐</span>
                <span>目標藍圖與工坊</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                WORKSHOP
              </span>
            </div>

            {/* Interactive Blueprint Mini-Map */}
            <div className="mb-3.5 p-3 rounded-xl bg-slate-900/80 border border-sky-500/20 flex flex-col items-center">
              <div className="text-[11px] text-slate-300 font-medium mb-2 w-full flex justify-between">
                <span>目標完成陣列縮圖</span>
                <span className="text-amber-300 font-mono text-[10px]">
                  懸停高亮方塊
                </span>
              </div>
              <div
                className="grid gap-1 p-1.5 rounded-lg bg-slate-950 border border-slate-800"
                style={{
                  gridTemplateColumns: `repeat(${s.size}, minmax(0, 1fr))`,
                  width: '144px',
                  height: '144px',
                }}
              >
                {Array.from({ length: s.size * s.size }).map((_, slot) => {
                  const targetNum = slot + 1;
                  const isLast = slot === s.size * s.size - 1;
                  const isLocked = board[slot] === targetNum;
                  const isHovered = highlightedTile === targetNum;
                  const dist = !isLast ? tileManhattan(targetNum, board.indexOf(targetNum), s.size) : 0;

                  return (
                    <button
                      key={`mini-${slot}`}
                      type="button"
                      onMouseEnter={() => !isLast && setHighlightedTile(targetNum)}
                      onMouseLeave={() => setHighlightedTile(null)}
                      onClick={() => !isLast && setHighlightedTile(targetNum)}
                      className={`rounded flex items-center justify-center text-[10px] font-mono transition-all ${
                        isLast
                          ? 'border border-dashed border-amber-500/30 bg-slate-900/40 text-amber-500/40'
                          : isHovered
                            ? 'bg-amber-500 text-black font-bold ring-2 ring-amber-300 scale-105 z-10'
                            : isLocked
                              ? 'bg-emerald-500/40 border border-emerald-400/80 text-emerald-200 font-bold'
                              : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                      title={!isLast ? `第 ${targetNum} 格（距目標 ${dist} 步）` : '終點空格'}
                    >
                      {isLast ? '•' : isLocked ? '✓' : targetNum}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Workshop Theme Selector */}
            <div className="mb-3 p-3 rounded-xl bg-slate-900/80 border border-sky-500/20 text-xs">
              <span className="font-bold text-sky-300 block mb-2">🎨 工坊材質切換</span>
              <div className="grid grid-cols-1 gap-1.5">
                {THEME_CYCLE.map((tid) => (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => handleSetTheme(tid)}
                    className={`px-3 py-1.5 rounded-lg border text-left text-[11px] font-semibold transition-all ${
                      theme === tid
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200 shadow-sm'
                        : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{THEME_CONFIGS[tid].name}</span>
                      {theme === tid && <span className="text-amber-400 text-[10px]">啟用中</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Audio & Haptic Controls */}
            <div className="mb-3 p-2.5 rounded-xl bg-slate-900/80 border border-sky-500/20 flex items-center justify-around text-xs">
              <button
                type="button"
                onClick={handleToggleSound}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                  soundOn
                    ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-700 bg-slate-800/80 text-slate-400'
                }`}
              >
                {soundOn ? '🔊 機械音效' : '🔇 靜音模式'}
              </button>
              <button
                type="button"
                onClick={handleToggleHaptics}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                  hapticsOn
                    ? 'border-sky-500/50 bg-sky-500/20 text-sky-200'
                    : 'border-slate-700 bg-slate-800/80 text-slate-400'
                }`}
              >
                {hapticsOn ? '📳 觸覺震動' : '📴 關閉震動'}
              </button>
            </div>

            {/* Personal Records Box */}
            <div className="mt-auto pt-2 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>經典最佳步數</span>
                <span className="text-emerald-300 font-mono font-bold">
                  {bestMoves != null ? `${bestMoves} 步` : '--'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>最速衝刺用時</span>
                <span className="text-sky-300 font-mono font-bold">
                  {bestSprint != null ? `${bestSprint}s` : '--'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>最高推盤時速</span>
                <span className="text-amber-300 font-mono font-bold">
                  {maxSps > 0 ? `${maxSps} SPS` : '--'}
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {won && (
        <ResultOverlay
          title="完成！"
          variant="win"
          badge={newRecord ? '新紀錄' : grade ? PAR_LABEL[grade] : undefined}
          subtitle={
            s.mode === 'daily' && streak > 0
              ? `連續 ${computeStreak(dailyRecords, today)} 天完成每日挑戰`
              : grade
                ? `評等 ${grade}・${PAR_LABEL[grade]}`
                : undefined
          }
          stats={[
            { label: '步數', value: moves },
            { label: '標準桿', value: optimalLabel },
            { label: '用時', value: `${elapsed}s` },
            { label: '最高時速', value: `${maxSps} SPS` },
            ...(grade ? [{ label: '評等', value: `${grade}（${PAR_LABEL[grade]}）` }] : []),
          ]}
          primaryLabel={s.mode === 'campaign' ? '下一關' : '再玩一局'}
          onPrimary={() => {
            if (s.mode === 'campaign' && s.stageIndex != null) {
              const next = s.stageIndex + 1;
              if (next < CAMPAIGN_STAGES.length && isStageUnlocked(next, campaign.clearedCount)) {
                startCampaignStage(next);
                return;
              }
              setScreen('campaign');
              return;
            }
            restartSame();
          }}
          secondaryLabel="回選單"
          onSecondary={() => setScreen('title')}
        />
      )}
      {lost && (
        <ResultOverlay
          title={loseReason === 'moves' ? '步數用盡' : '時間到'}
          variant="lose"
          subtitle={
            loseReason === 'moves'
              ? `此關限 ${s.moveLimit} 步`
              : `限時 ${s.timeLimitSec ?? SPRINT_LIMIT_SEC} 秒`
          }
          stats={[
            { label: '步數', value: moves },
            { label: '標準桿', value: optimalLabel },
          ]}
          onPrimary={restartSame}
          secondaryLabel="回選單"
          onSecondary={() => setScreen('title')}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 gap-4"
      style={{
        backgroundColor: '#0f172a',
        backgroundImage: [
          'linear-gradient(rgba(15,23,42,0.65), rgba(15,23,42,0.85))',
          `url(${import.meta.env.BASE_URL}board-bg.jpg)`,
        ].join(', '),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <BackToMenu />
      {children}
    </div>
  );
}

function modeLabel(mode: PlayMode): string {
  switch (mode) {
    case 'classic':
      return '經典';
    case 'sprint':
      return '衝刺';
    case 'daily':
      return '每日';
    case 'campaign':
      return '闖關';
  }
}

function chipClass(active: boolean, tone: 'emerald' | 'sky' | 'amber'): string {
  const on =
    tone === 'emerald'
      ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100'
      : tone === 'sky'
        ? 'border-sky-400 bg-sky-500/25 text-sky-100'
        : 'border-amber-400 bg-amber-500/20 text-amber-100';
  return `min-h-[44px] px-4 rounded-full border touch-manipulation text-sm ${
    active ? on : 'border-slate-600 bg-slate-800/80 text-slate-300'
  }`;
}

const primaryBtn =
  'w-full min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold touch-manipulation';
const secondaryBtn =
  'w-full min-h-[44px] px-5 rounded-xl border border-slate-500 bg-slate-800/80 hover:bg-slate-700/80 font-medium touch-manipulation';
const toolBtn =
  'min-h-[44px] px-4 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 font-medium touch-manipulation';
const toolBtnAmber =
  'min-h-[44px] px-4 rounded-xl border border-amber-500/50 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 disabled:opacity-40 font-medium touch-manipulation';
