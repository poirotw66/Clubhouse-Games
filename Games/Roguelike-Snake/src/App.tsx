import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import {
  playCapture,
  playError,
  playGoal,
  playLose,
  playMove,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';
import { TouchButton, touchControlsWrapClass } from '@clubhouse/shared/TouchButton';
import { Copy, Home, Pause, Play, RefreshCw, Trophy } from 'lucide-react';
import { Arena, type ArenaHandle } from './components/Arena';
import { Hud, type HudSnapshot } from './components/Hud';
import { RelicPicker } from './components/RelicPicker';
import { TitleScreen, type StartOptions } from './components/TitleScreen';
import { achievementById } from './game/achievements';
import { DEFAULT_BUILD_ID, buildById } from './game/builds';
import {
  applyChallengeResult,
  challengeById,
  challengeIndexById,
} from './game/challenges';
import type { ChallengeProgress, SeedChallenge } from './game/challenges';
import { MAX_FLOOR } from './game/config';
import {
  buildDailyShareText,
  computeDailyStreak,
  copyText,
  todaySeedKey,
} from './game/daily';
import {
  buyHeal,
  chooseRelic,
  continueEndless,
  createRun,
  dash,
  queueDir,
  rerollRelics,
  tick,
} from './game/engine';
import { LAYOUT_NAME, type LayoutId } from './game/level';
import { parseSeed } from './game/rng';
import {
  loadChallengeProgress,
  loadMeta,
  saveChallengeProgress,
  selectBuild,
  settleRun,
  type MetaProgress,
} from './game/storage';
import type { Dir, GameState, RelicId } from './game/types';

type Screen = 'title' | 'run';

const KEY_TO_DIR: Record<string, Dir> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function snapshot(state: GameState): HudSnapshot {
  const build = buildById(state.buildId);
  return {
    phase: state.phase,
    floor: state.floor,
    layoutName: LAYOUT_NAME[state.layout as LayoutId] ?? state.layout,
    hp: state.hp,
    maxHp: state.maxHp,
    energy: Math.floor(state.energy),
    maxEnergy: state.maxEnergy,
    coins: state.coins,
    score: state.score,
    kills: state.kills,
    eaten: state.eaten,
    quota: state.quota,
    length: state.snake.length,
    relics: state.relics,
    bossHp: state.boss?.hp ?? 0,
    bossMaxHp: state.boss?.maxHp ?? 0,
    exitOpen: state.exit !== null,
    dashReady: state.time >= state.dashReadyAt,
    endless: state.endless,
    ironsnake: state.ironsnake,
    daily: state.daily,
    buildName: build?.name ?? state.buildId,
  };
}

function signatureOf(hud: HudSnapshot): string {
  return [
    hud.phase,
    hud.floor,
    hud.hp,
    hud.maxHp,
    hud.energy,
    hud.maxEnergy,
    hud.coins,
    hud.score,
    hud.eaten,
    hud.quota,
    hud.length,
    hud.relics.length,
    hud.bossHp,
    hud.exitOpen,
    hud.dashReady,
    hud.endless,
    hud.ironsnake,
    hud.daily,
    hud.buildName,
  ].join('|');
}

export default function App() {
  const stateRef = useRef<GameState | null>(null);
  const arenaRef = useRef<ArenaHandle | null>(null);
  const pausedRef = useRef(false);
  const signatureRef = useRef('');
  const swipeRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const challengeSettledRef = useRef(false);
  const runSettledRef = useRef(false);
  const runOptsRef = useRef<{ ironsnake: boolean; daily: boolean; buildId: string }>({
    ironsnake: false,
    daily: false,
    buildId: DEFAULT_BUILD_ID,
  });

  const [screen, setScreen] = useState<Screen>('title');
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [meta, setMeta] = useState<MetaProgress>(() => loadMeta());
  const [challengeProgress, setChallengeProgress] = useState<ChallengeProgress>(() =>
    loadChallengeProgress(),
  );
  const [activeChallenge, setActiveChallenge] = useState<SeedChallenge | null>(null);
  const [challengeCleared, setChallengeCleared] = useState<boolean | null>(null);
  const [seedLabel, setSeedLabel] = useState('');
  const [floorPulse, setFloorPulse] = useState(false);
  const [flash, setFlash] = useState<{ text: string; tone: 'good' | 'bad' | 'neutral'; key: number } | null>(
    null,
  );
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const settleChallenge = useCallback((state: GameState) => {
    if (challengeSettledRef.current) return;
    if (!state.challengeId) {
      setChallengeCleared(null);
      return;
    }
    const challenge = challengeById(state.challengeId);
    if (!challenge) {
      setChallengeCleared(null);
      return;
    }
    challengeSettledRef.current = true;
    const index = challengeIndexById(challenge.id);
    const applied = applyChallengeResult(loadChallengeProgress(), index, state);
    saveChallengeProgress(applied.progress);
    setChallengeProgress(applied.progress);
    setChallengeCleared(applied.cleared);
  }, []);

  const settleMeta = useCallback((state: GameState, escaped: boolean) => {
    if (runSettledRef.current) return;
    runSettledRef.current = true;
    const result = settleRun({
      score: state.score,
      floor: state.floor,
      escaped,
      ironsnake: state.ironsnake,
      daily: state.daily,
      dailyDate: state.daily ? state.seedInput || todaySeedKey() : undefined,
    });
    setMeta(result.meta);

    if (result.newBuilds.length > 0) {
      const names = result.newBuilds
        .map((id) => buildById(id)?.name)
        .filter(Boolean)
        .join('、');
      setFlash({ text: `解鎖身分：${names}`, tone: 'good', key: Date.now() });
    } else if (result.newAchievements.length > 0) {
      const first = achievementById(result.newAchievements[0]);
      setFlash({
        text: first ? `成就：${first.name}` : '成就解鎖',
        tone: 'good',
        key: Date.now(),
      });
    }
  }, []);

  const startRun = useCallback(
    (
      seedInput: string,
      challengeId: string | null = null,
      extras: { ironsnake?: boolean; daily?: boolean } = {},
    ) => {
      const challenge = challengeId ? challengeById(challengeId) : undefined;
      const input = challenge?.seedInput ?? seedInput;
      const seed = parseSeed(input);
      const buildId = loadMeta().selectedBuildId || DEFAULT_BUILD_ID;
      const ironsnake = Boolean(extras.ironsnake) && !challenge;
      const daily = Boolean(extras.daily) && !challenge;
      const state = createRun(seed, {
        challengeId: challenge?.id ?? null,
        seedInput: input.trim(),
        ironsnake,
        daily,
        buildId,
      });
      stateRef.current = state;
      signatureRef.current = '';
      challengeSettledRef.current = false;
      runSettledRef.current = false;
      runOptsRef.current = { ironsnake, daily, buildId };
      setActiveChallenge(challenge ?? null);
      setChallengeCleared(null);
      setSeedLabel(input.trim() || String(seed));
      setHud(snapshot(state));
      setPaused(false);
      setShareCopied(false);
      setFlash(
        ironsnake
          ? { text: 'Ironsnake・一擊即死', tone: 'bad', key: Date.now() }
          : daily
            ? { text: '今日挑戰開始', tone: 'neutral', key: Date.now() }
            : null,
      );
      setFloorPulse(false);
      setScreen('run');
    },
    [],
  );

  const handleTitleStart = useCallback(
    (options: StartOptions) => {
      startRun(options.seedInput, null, {
        ironsnake: options.ironsnake,
        daily: options.daily,
      });
    },
    [startRun],
  );

  const startChallenge = useCallback(
    (challengeId: string) => {
      startRun('', challengeId);
    },
    [startRun],
  );

  const handleSelectBuild = useCallback((buildId: string) => {
    setMeta(selectBuild(buildId));
  }, []);

  const drainEvents = useCallback(
    (state: GameState) => {
      if (state.events.length === 0) return;
      const events = state.events.splice(0, state.events.length);

      for (const event of events) {
        switch (event.type) {
          case 'eat':
            playMove();
            break;
          case 'golden':
            playScore();
            setFlash({ text: '金蘋果 +3 金幣', tone: 'neutral', key: Date.now() });
            break;
          case 'cursed':
            playError();
            break;
          case 'kill':
            playCapture();
            break;
          case 'hurt':
            playError();
            if (state.ironsnake) {
              setFlash({ text: '一擊！', tone: 'bad', key: Date.now() });
            }
            break;
          case 'bossHit':
            playCapture();
            break;
          case 'bossDown':
            playGoal();
            setFlash({ text: '首領擊破！', tone: 'good', key: Date.now() });
            break;
          case 'exit':
            playGoal();
            break;
          case 'floor':
            playScore();
            if (!prefersReducedMotion()) {
              setFloorPulse(true);
              window.setTimeout(() => setFloorPulse(false), 420);
            }
            if (event.text) {
              setFlash({ text: event.text, tone: 'neutral', key: Date.now() });
            }
            break;
          case 'win':
            playWin();
            settleMeta(state, true);
            settleChallenge(state);
            if (!prefersReducedMotion()) {
              setFlash({
                text: state.ironsnake ? '鐵蛇脫殼！' : '逃出蛇窟！',
                tone: 'good',
                key: Date.now(),
              });
            }
            break;
          case 'die':
            playLose();
            settleMeta(state, false);
            settleChallenge(state);
            if (!prefersReducedMotion()) {
              setFlash({ text: '蛇窟吞噬了你', tone: 'bad', key: Date.now() });
            }
            break;
          default:
            break;
        }
      }
    },
    [settleChallenge, settleMeta],
  );

  useEffect(() => {
    if (screen !== 'run') return;

    let frameId = 0;
    let last = performance.now();
    let accumulator = 0;

    const frame = (now: number) => {
      frameId = requestAnimationFrame(frame);
      const delta = Math.min(200, now - last);
      last = now;

      const state = stateRef.current;
      if (!state) return;

      if (!pausedRef.current && state.phase === 'playing') {
        accumulator += delta;
        let steps = 0;
        while (accumulator >= state.moveInterval && steps < 4) {
          tick(state);
          accumulator -= state.moveInterval;
          steps += 1;
          if (state.phase !== 'playing') {
            accumulator = 0;
            break;
          }
        }
      } else {
        accumulator = 0;
      }

      drainEvents(state);

      const alpha =
        state.phase === 'playing' && !pausedRef.current
          ? Math.min(1, accumulator / state.moveInterval)
          : 1;
      arenaRef.current?.draw(state, alpha);

      const next = snapshot(state);
      const signature = signatureOf(next);
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setHud(next);
      }
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [screen, drainEvents]);

  useEffect(() => {
    if (screen !== 'run') return;

    const onKeyDown = (event: KeyboardEvent) => {
      const state = stateRef.current;
      if (!state) return;
      const key = event.key.toLowerCase();

      if (KEY_TO_DIR[key]) {
        event.preventDefault();
        if (!pausedRef.current) queueDir(state, KEY_TO_DIR[key]);
        return;
      }
      if (key === ' ' || event.code === 'Space') {
        event.preventDefault();
        if (!pausedRef.current) dash(state);
        return;
      }
      if (key === 'p' || key === 'escape') {
        event.preventDefault();
        if (state.phase === 'playing') setPaused((value) => !value);
        return;
      }
      if (key === 'r' && (state.phase === 'dead' || state.phase === 'won')) {
        if (activeChallenge) startRun(activeChallenge.seedInput, activeChallenge.id);
        else {
          startRun(state.seedInput || '', null, {
            ironsnake: runOptsRef.current.ironsnake,
            daily: runOptsRef.current.daily,
          });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, startRun, activeChallenge]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    swipeRef.current = { x: event.clientX, y: event.clientY, time: performance.now() };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeRef.current;
    const state = stateRef.current;
    swipeRef.current = null;
    if (!start || !state || pausedRef.current) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      dash(state);
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) queueDir(state, dx > 0 ? 'right' : 'left');
    else queueDir(state, dy > 0 ? 'down' : 'up');
  };

  const withState = (action: (state: GameState) => void) => () => {
    const state = stateRef.current;
    if (state) action(state);
  };

  const handleChoose = (id: RelicId) => {
    const state = stateRef.current;
    if (!state) return;
    chooseRelic(state, id);
    playScore();
  };

  const retryRun = () => {
    if (activeChallenge) startRun(activeChallenge.seedInput, activeChallenge.id);
    else {
      startRun(stateRef.current?.seedInput || '', null, {
        ironsnake: runOptsRef.current.ironsnake,
        daily: runOptsRef.current.daily,
      });
    }
  };

  const returnToTitle = () => {
    stateRef.current = null;
    setHud(null);
    setActiveChallenge(null);
    setChallengeCleared(null);
    setChallengeProgress(loadChallengeProgress());
    setMeta(loadMeta());
    setScreen('title');
  };

  const copyDailyShare = async (cleared: boolean) => {
    if (!hud || !runOptsRef.current.daily) return;
    const date = seedLabel || todaySeedKey();
    const streak = computeDailyStreak(meta.dailyRecords, todaySeedKey());
    const text = buildDailyShareText({
      date,
      cleared,
      score: hud.score,
      floor: hud.floor,
      streak,
      buildName: hud.buildName,
    });
    const ok = await copyText(text);
    setShareCopied(ok);
    if (ok) {
      setFlash({ text: '已複製分享文案', tone: 'good', key: Date.now() });
      window.setTimeout(() => setShareCopied(false), 1800);
    } else {
      setFlash({ text: '無法複製', tone: 'bad', key: Date.now() });
    }
  };

  if (screen === 'title' || !hud) {
    return (
      <div
        className="min-h-screen text-slate-50 flex flex-col items-center justify-center p-4 pt-16 bg-cover bg-center"
        style={{
          backgroundColor: '#020617',
          backgroundImage: [
            'linear-gradient(rgba(2,6,23,0.72), rgba(2,6,23,0.88))',
            `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
          ].join(', '),
        }}
      >
        <BackToMenu />
        <TitleScreen
          meta={meta}
          challengeProgress={challengeProgress}
          onStart={handleTitleStart}
          onStartChallenge={startChallenge}
          onSelectBuild={handleSelectBuild}
        />
      </div>
    );
  }

  const state = stateRef.current;
  const challengeBanner = activeChallenge
    ? `挑戰・${activeChallenge.name}｜目標：${activeChallenge.goalLabel}`
    : hud.ironsnake
      ? 'Ironsnake 硬派・HP=1・遺物四選一'
      : hud.daily
        ? `每日挑戰・種子 ${seedLabel || todaySeedKey()}`
        : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-3 pt-14 sm:pt-4">
      <BackToMenu />

      <header className="w-full max-w-xl flex items-center justify-between gap-2 mb-3">
        <h1 className="text-lg font-bold tracking-tight">
          蛇窟迴廊
          <span className="ml-2 text-xs font-normal text-slate-400">Roguelike Snake</span>
        </h1>
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 hover:bg-slate-700"
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {paused ? '繼續' : '暫停'}
          </button>
          <button
            type="button"
            onClick={retryRun}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 hover:bg-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            新的一局
          </button>
          <button
            type="button"
            onClick={returnToTitle}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 hover:bg-slate-700"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {challengeBanner && (
        <p
          className={`mb-2 w-full max-w-xl rounded-xl border px-3 py-2 text-center text-xs ${
            hud.ironsnake && !activeChallenge
              ? 'border-rose-700/50 bg-rose-950/50 text-rose-100'
              : hud.daily && !activeChallenge
                ? 'border-emerald-700/50 bg-emerald-950/50 text-emerald-100'
                : 'border-sky-700/50 bg-sky-950/50 text-sky-100'
          }`}
        >
          {challengeBanner}
        </p>
      )}

      <Hud hud={hud} seedLabel={seedLabel} />

      <div
        className={`relative mt-3 w-full max-w-xl ${floorPulse ? 'snake-floor-pulse' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <Arena ref={arenaRef} />
        {flash && (
          <ScoreFlash
            text={flash.text}
            tone={flash.tone}
            flashKey={flash.key}
            onDone={() => setFlash(null)}
          />
        )}
        {paused && hud.phase === 'playing' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-slate-950/80">
            <p className="text-xl font-bold">暫停中（P 繼續）</p>
          </div>
        )}
      </div>

      <div className={touchControlsWrapClass}>
        <div className="flex w-full justify-center">
          <TouchButton label="↑" ariaLabel="向上" onClick={withState((s) => queueDir(s, 'up'))} />
        </div>
        <div className="flex w-full justify-center gap-2">
          <TouchButton label="←" ariaLabel="向左" onClick={withState((s) => queueDir(s, 'left'))} />
          <TouchButton label="衝刺" ariaLabel="衝刺" accent onClick={withState((s) => dash(s))} />
          <TouchButton label="→" ariaLabel="向右" onClick={withState((s) => queueDir(s, 'right'))} />
        </div>
        <div className="flex w-full justify-center">
          <TouchButton label="↓" ariaLabel="向下" onClick={withState((s) => queueDir(s, 'down'))} />
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-slate-500">
        方向鍵／WASD 轉向 · Space 衝刺 · P 暫停 ·{' '}
        <span className="md:hidden">畫面滑動轉向、輕點衝刺</span>
        <span className="hidden md:inline">
          {activeChallenge
            ? `目標：${activeChallenge.goalLabel}`
            : hud.ironsnake
              ? '硬派：一擊即死'
              : hud.daily
                ? '今日挑戰・同種子可比'
                : `目標：抵達第 ${MAX_FLOOR} 層並擊敗首領`}
        </span>
      </p>

      {hud.phase === 'relic' && state && (
        <RelicPicker
          floor={state.floor}
          choices={state.relicChoices}
          coins={state.coins}
          hp={state.hp}
          maxHp={state.maxHp}
          picksLeft={state.pendingPicks}
          ironsnake={state.ironsnake}
          onChoose={handleChoose}
          onReroll={withState(rerollRelics)}
          onHeal={withState(buyHeal)}
        />
      )}

      {hud.phase === 'dead' && (
        <ResultOverlay
          title={
            activeChallenge
              ? challengeCleared
                ? '挑戰通關！'
                : '挑戰未達成'
              : hud.ironsnake
                ? '鐵蛇折斷'
                : hud.daily
                  ? '今日挑戰結束'
                  : '蛇窟吞噬了你'
          }
          variant={activeChallenge && challengeCleared ? 'win' : 'lose'}
          badge={
            activeChallenge
              ? challengeCleared
                ? activeChallenge.name
                : `目標：${activeChallenge.goalLabel}`
              : `第 ${hud.floor} 層${hud.ironsnake ? ' · 鐵蛇' : ''}${hud.daily ? ' · 每日' : ''}`
          }
          subtitle={
            activeChallenge
              ? challengeCleared
                ? `已記入通關・最佳分數可重刷`
                : `再試一次・${activeChallenge.goalLabel}`
              : hud.daily
                ? `今日最佳已更新・連勝 ${computeDailyStreak(meta.dailyRecords, todaySeedKey())} 天`
                : `最佳紀錄：${meta.score} 分 · 第 ${meta.floor} 層`
          }
          stats={[
            { label: '分數', value: hud.score },
            { label: '抵達樓層', value: hud.floor },
            { label: '擊殺', value: hud.kills },
            { label: '遺物', value: hud.relics.length },
          ]}
          primaryLabel={activeChallenge ? '再挑戰一次' : '再玩一局'}
          onPrimary={retryRun}
          secondaryLabel={
            hud.daily
              ? shareCopied
                ? '已複製'
                : '複製分享結果'
              : activeChallenge || hud.ironsnake
                ? '返回標題'
                : undefined
          }
          onSecondary={
            hud.daily
              ? () => void copyDailyShare(false)
              : activeChallenge || hud.ironsnake
                ? returnToTitle
                : undefined
          }
        />
      )}

      {hud.phase === 'won' && state && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="逃出蛇窟"
        >
          <div
            className={`w-full max-w-sm rounded-2xl border bg-slate-900/95 p-6 text-center shadow-2xl ${
              hud.ironsnake ? 'border-rose-500/40 snake-clear-glow' : 'border-amber-500/40 snake-clear-glow'
            }`}
          >
            <Trophy
              className={`mx-auto mb-2 h-10 w-10 ${hud.ironsnake ? 'text-rose-300' : 'text-amber-300'}`}
            />
            <h2
              className={`mb-1 text-2xl font-bold ${hud.ironsnake ? 'text-rose-200' : 'text-amber-200'}`}
            >
              {activeChallenge && challengeCleared
                ? '挑戰通關！'
                : hud.ironsnake
                  ? '鐵蛇脫殼！'
                  : '逃出蛇窟！'}
            </h2>
            <p className="mb-4 text-sm text-slate-300">
              {activeChallenge
                ? challengeCleared
                  ? `「${activeChallenge.name}」達成・${activeChallenge.goalLabel}`
                  : `逃出了，但挑戰目標未達成：${activeChallenge.goalLabel}`
                : hud.ironsnake
                  ? `以一命撐過第 ${MAX_FLOOR} 層，帶著 ${hud.relics.length} 件遺物脫殼而出。`
                  : `你帶著 ${hud.relics.length} 件遺物走出第 ${MAX_FLOOR} 層。`}
            </p>
            <dl className="mb-5 grid gap-2 text-sm">
              {[
                ['分數', hud.score],
                ['剩餘 HP', hud.hp],
                ['擊殺', hud.kills],
                ...(hud.ironsnake ? [['鐵蛇通關', meta.ironsnakeClears]] : []),
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex justify-between rounded-lg border border-white/5 bg-slate-800/80 px-3 py-2"
                >
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-mono font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-2">
              {!activeChallenge && !hud.daily && (
                <button
                  type="button"
                  onClick={withState(continueEndless)}
                  className="w-full rounded-xl bg-amber-600 px-6 py-3 font-semibold hover:bg-amber-500"
                >
                  繼續深入（無盡模式）
                </button>
              )}
              {hud.daily && (
                <button
                  type="button"
                  onClick={() => void copyDailyShare(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-600/60 bg-emerald-950/50 px-6 py-3 font-semibold text-emerald-100 hover:bg-emerald-900/60"
                >
                  <Copy className="h-4 w-4" />
                  {shareCopied ? '已複製分享文案' : '複製分享結果'}
                </button>
              )}
              <button
                type="button"
                onClick={retryRun}
                className="w-full rounded-xl bg-slate-800 px-6 py-3 font-semibold hover:bg-slate-700"
              >
                {activeChallenge ? '再挑戰一次' : '重新開始'}
              </button>
              <button
                type="button"
                onClick={returnToTitle}
                className="w-full rounded-xl border border-slate-600 bg-slate-900 px-6 py-3 font-semibold hover:bg-slate-800"
              >
                返回標題
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
