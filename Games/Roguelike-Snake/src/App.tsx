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
import { Home, Pause, Play, RefreshCw, Trophy } from 'lucide-react';
import { Arena, type ArenaHandle } from './components/Arena';
import { Hud, type HudSnapshot } from './components/Hud';
import { RelicPicker } from './components/RelicPicker';
import { TitleScreen } from './components/TitleScreen';
import { MAX_FLOOR } from './game/config';
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
import { loadBest, saveBest, type BestRecord } from './game/storage';
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

function snapshot(state: GameState): HudSnapshot {
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
  ].join('|');
}

export default function App() {
  const stateRef = useRef<GameState | null>(null);
  const arenaRef = useRef<ArenaHandle | null>(null);
  const pausedRef = useRef(false);
  const signatureRef = useRef('');
  const swipeRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const [screen, setScreen] = useState<Screen>('title');
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState<BestRecord>(() => loadBest());
  const [seedLabel, setSeedLabel] = useState('');
  const [flash, setFlash] = useState<{ text: string; tone: 'good' | 'bad' | 'neutral'; key: number } | null>(
    null,
  );

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const startRun = useCallback((seedInput: string) => {
    const seed = parseSeed(seedInput);
    const state = createRun(seed);
    stateRef.current = state;
    signatureRef.current = '';
    setSeedLabel(seedInput.trim() || String(seed));
    setHud(snapshot(state));
    setPaused(false);
    setFlash(null);
    setScreen('run');
  }, []);

  const drainEvents = useCallback((state: GameState) => {
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
        case 'win':
          playWin();
          setBest(saveBest({ score: state.score, floor: state.floor }));
          break;
        case 'die':
          playLose();
          setBest(saveBest({ score: state.score, floor: state.floor }));
          break;
        default:
          break;
      }
    }
  }, []);

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
        startRun('');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, startRun]);

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
        <TitleScreen best={best} onStart={startRun} />
      </div>
    );
  }

  const state = stateRef.current;

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
            onClick={() => startRun('')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 hover:bg-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            新的一局
          </button>
          <button
            type="button"
            onClick={() => setScreen('title')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 hover:bg-slate-700"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      <Hud hud={hud} seedLabel={seedLabel} />

      <div
        className="relative mt-3 w-full max-w-xl"
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
        <span className="hidden md:inline">目標：抵達第 {MAX_FLOOR} 層並擊敗首領</span>
      </p>

      {hud.phase === 'relic' && state && (
        <RelicPicker
          floor={state.floor}
          choices={state.relicChoices}
          coins={state.coins}
          hp={state.hp}
          maxHp={state.maxHp}
          picksLeft={state.pendingPicks}
          onChoose={handleChoose}
          onReroll={withState(rerollRelics)}
          onHeal={withState(buyHeal)}
        />
      )}

      {hud.phase === 'dead' && (
        <ResultOverlay
          title="蛇窟吞噬了你"
          variant="lose"
          badge={`第 ${hud.floor} 層`}
          subtitle={`最佳紀錄：${best.score} 分 · 第 ${best.floor} 層`}
          stats={[
            { label: '分數', value: hud.score },
            { label: '抵達樓層', value: hud.floor },
            { label: '擊殺', value: hud.kills },
            { label: '遺物', value: hud.relics.length },
          ]}
          primaryLabel="再玩一局"
          onPrimary={() => startRun('')}
        />
      )}

      {hud.phase === 'won' && state && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="逃出蛇窟"
        >
          <div className="w-full max-w-sm rounded-2xl border border-amber-500/40 bg-slate-900/95 p-6 text-center shadow-2xl">
            <Trophy className="mx-auto mb-2 h-10 w-10 text-amber-300" />
            <h2 className="mb-1 text-2xl font-bold text-amber-200">逃出蛇窟！</h2>
            <p className="mb-4 text-sm text-slate-300">
              你帶著 {hud.relics.length} 件遺物走出第 {MAX_FLOOR} 層。
            </p>
            <dl className="mb-5 grid gap-2 text-sm">
              {[
                ['分數', hud.score],
                ['剩餘 HP', hud.hp],
                ['擊殺', hud.kills],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex justify-between rounded-lg border border-white/5 bg-slate-800/80 px-3 py-2"
                >
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-mono font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={withState(continueEndless)}
                className="w-full rounded-xl bg-amber-600 px-6 py-3 font-semibold hover:bg-amber-500"
              >
                繼續深入（無盡模式）
              </button>
              <button
                type="button"
                onClick={() => startRun('')}
                className="w-full rounded-xl bg-slate-800 px-6 py-3 font-semibold hover:bg-slate-700"
              >
                重新開始
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
