import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playLose, playMove, playScore, playWin } from '@clubhouse/shared/synthAudio';
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
  hintTileIndex,
  isSolved,
  parGrade,
  scrambleFromSeed,
  sizeLabel,
  type Board,
  type BoardSize,
  type ParGrade,
  type PlayMode,
  type ScrambleTier,
  type VisualStyle,
} from './fifteenLogic.ts';
import { PuzzleBoard } from './PuzzleBoard.tsx';
import { hashString } from './rng.ts';
import { optimalMoves } from './solver.ts';
import {
  loadBestMoves,
  loadBestSprintSec,
  loadDaily,
  recordDaily,
  saveBestMoves,
  saveBestSprintSec,
  type DailyRecord,
} from './storage.ts';

const TIER_OPTIONS: { id: ScrambleTier; label: string }[] = [
  { id: 'easy', label: '簡單' },
  { id: 'normal', label: '普通' },
  { id: 'hard', label: '困難' },
];

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
  const [session, setSession] = useState<Session | null>(null);
  const [board, setBoard] = useState<Board>(() => scrambleFromSeed(4, 'normal', 1).board);
  const [history, setHistory] = useState<Board[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [loseReason, setLoseReason] = useState<'time' | 'moves'>('time');
  const [elapsed, setElapsed] = useState(0);
  const [bestMoves, setBestMoves] = useState<number | null>(() => loadBestMoves(4, 'normal'));
  const [bestSprint, setBestSprint] = useState<number | null>(() => loadBestSprintSec(4, 'normal'));
  const [newRecord, setNewRecord] = useState(false);
  const [hintIndex, setHintIndex] = useState<number | null>(null);
  const [grade, setGrade] = useState<ParGrade | null>(null);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>(() => loadDaily());
  const [campaign, setCampaign] = useState<CampaignProgress>(() => loadCampaignProgress());
  const settleRef = useRef(false);

  const today = dateKey();
  const streak = computeStreak(dailyRecords, today);
  const todayDone = dailyRecords.some((r) => r.date === today);
  const pictureUrl = `${import.meta.env.BASE_URL}tile-face.jpg`;

  useEffect(() => {
    setBestMoves(loadBestMoves(size, tier));
    setBestSprint(loadBestSprintSec(size, tier));
  }, [size, tier]);

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
    setBestMoves(loadBestMoves(next.size, next.tier));
    setBestSprint(loadBestSprintSec(next.size, next.tier));
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
  }, [screen, won, lost, board]);

  useEffect(() => {
    if (screen !== 'play' || !session || won || lost) return;
    const limit = session.timeLimitSec;
    if (limit != null && elapsed >= limit) {
      setLost(true);
      setLoseReason('time');
      playLose();
    }
  }, [elapsed, session, won, lost, screen]);

  useEffect(() => {
    if (screen !== 'play' || !session || won || lost || settleRef.current) return;
    if (!isSolved(board, session.size)) return;
    settleRef.current = true;
    setWon(true);
    setHintIndex(null);
    playWin();
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

  const onSlide = (next: Board, _tileIndex: number) => {
    if (!session || won || lost) return;
    playScore();
    setHistory((h) => [...h, board]);
    const nextMoves = moves + 1;
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
    }
  };

  const handleUndo = () => {
    if (won || lost || history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setBoard(prev);
    setMoves((m) => Math.max(0, m - 1));
    setHintIndex(null);
    playMove();
  };

  const handleHint = () => {
    if (!session || won || lost) return;
    const idx = hintTileIndex(board, session.size);
    setHintIndex(idx);
    if (idx != null) playMove();
  };

  const canUndo = !won && !lost && history.length > 0;
  const remain =
    session?.timeLimitSec != null ? Math.max(0, session.timeLimitSec - elapsed) : null;

  if (screen === 'title') {
    const cfg = dailyConfig(today);
    return (
      <Shell>
        <h1 className="text-3xl font-bold tracking-wide">數字推盤</h1>
        <p className="text-sm text-slate-300 text-center max-w-sm">
          多種盤面與圖片拼圖・對照最佳解評等・每日挑戰與闖關階梯
        </p>

        <section className="w-full max-w-md flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-wider text-slate-400">盤面與樣式</h2>
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
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="樣式">
            {(
              [
                { id: 'number' as const, label: '數字' },
                { id: 'picture' as const, label: '圖片拼圖' },
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

        <div className="flex flex-col gap-2 w-full max-w-sm">
          <button type="button" className={primaryBtn} onClick={() => startClassicOrSprint('classic')}>
            經典模式
          </button>
          <button type="button" className={secondaryBtn} onClick={() => startClassicOrSprint('sprint')}>
            衝刺 {SPRINT_LIMIT_SEC}s
          </button>
          <button type="button" className={secondaryBtn} onClick={startDaily}>
            每日挑戰
            <span className="block text-xs font-normal text-slate-300 mt-0.5">
              {sizeLabel(cfg.size)}・{cfg.style === 'picture' ? '圖片' : '數字'}
              {todayDone ? '・今日已完成' : ''}
              {streak > 0 ? `・連續 ${streak} 天` : ''}
            </span>
          </button>
          <button type="button" className={secondaryBtn} onClick={() => setScreen('campaign')}>
            闖關階梯
            <span className="block text-xs font-normal text-slate-300 mt-0.5">
              進度 {campaign.clearedCount}/{CAMPAIGN_STAGES.length}
            </span>
          </button>
        </div>

        {(bestMoves != null || bestSprint != null) && (
          <p className="text-xs text-slate-400">
            本機 {sizeLabel(size)}／{TIER_OPTIONS.find((t) => t.id === tier)?.label}：
            {bestMoves != null ? ` 最佳 ${bestMoves} 步` : ''}
            {bestSprint != null ? ` ・衝刺 ${bestSprint}s` : ''}
          </p>
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

  // play
  const s = session!;
  const optimalLabel = s.optimalExact ? String(s.optimal) : `≤${s.optimal}`;

  return (
    <Shell>
      <h1 className="text-xl font-bold tracking-wide">數字推盤</h1>
      <p className="text-xs text-slate-400">
        {modeLabel(s.mode)}
        {s.stageIndex != null ? `・${CAMPAIGN_STAGES[s.stageIndex]?.name}` : ''}
        ・{sizeLabel(s.size)}
        ・{s.style === 'picture' ? '圖片' : '數字'}
      </p>
      <p className="text-sm text-slate-300">
        步數：{moves}
        {s.moveLimit != null ? ` / ${s.moveLimit}` : ''}
        {remain != null ? ` · 剩餘 ${remain}s` : ''}
        {' · '}標準桿 {optimalLabel}
        {s.mode === 'classic' && bestMoves != null ? ` · 最佳 ${bestMoves}` : ''}
        {s.mode === 'sprint' && bestSprint != null ? ` · 最佳 ${bestSprint}s` : ''}
      </p>

      <PuzzleBoard
        board={board}
        size={s.size}
        style={s.style}
        hintIndex={hintIndex}
        disabled={won || lost}
        onSlide={onSlide}
        pictureUrl={pictureUrl}
      />

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={handleUndo} disabled={!canUndo} className={toolBtn}>
          復原
        </button>
        <button type="button" onClick={handleHint} disabled={won || lost} className={toolBtnAmber}>
          提示
        </button>
        <button type="button" onClick={restartSame} className={toolBtn}>
          重開
        </button>
        <button type="button" onClick={() => setScreen('title')} className={toolBtn}>
          選單
        </button>
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
        backgroundColor: '#1e293b',
        backgroundImage: [
          'linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.75))',
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
