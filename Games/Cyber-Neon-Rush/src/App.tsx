import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { playCapture, playGoal, playLose, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { GameCanvas } from './components/GameCanvas';
import { Scoreboard } from './components/Scoreboard';
import { TouchControls } from './components/TouchControls';
import type { GameWorld } from './engine/GameWorld';
import { BEST_DISTANCE_KEY, BEST_SCORE_KEY } from './engine/constants';
import type { HudSnapshot, RunResult } from './engine/scoreSystem';
import type { Screen } from './types';

function readStoredBest(key: string): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

const EMPTY_HUD: HudSnapshot = {
  score: 0,
  distance: 0,
  combo: 0,
  multiplier: 1,
  speed: 0,
  nearMissFlash: 0,
  bestScore: 0,
  bestDistance: 0,
  fever: false,
  boostT: 0,
  toast: null,
  pickups: 0,
};

export default function App(): ReactElement {
  const [screen, setScreen] = useState<Screen>('menu');
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    ...EMPTY_HUD,
    bestScore: readStoredBest(BEST_SCORE_KEY),
    bestDistance: readStoredBest(BEST_DISTANCE_KEY),
  }));
  const [result, setResult] = useState<RunResult | null>(null);
  const [runId, setRunId] = useState(0);
  const worldRef = useRef<GameWorld | null>(null);

  const toastRef = useRef<string | null>(null);

  const onHud = useCallback((next: HudSnapshot) => {
    if (next.toast && next.toast !== toastRef.current) {
      if (next.toast === 'perfect' || next.toast === 'fever') playGoal();
      else if (next.toast === 'boost') playCapture();
      else playScore();
    }
    toastRef.current = next.toast;
    setHud(next);
  }, []);

  const onGameOver = useCallback((r: RunResult) => {
    setResult(r);
    setScreen('gameover');
    if (r.isNewBest || r.score >= 5000) playWin();
    else playLose();
  }, []);

  const startRun = () => {
    setResult(null);
    setHud(EMPTY_HUD);
    setRunId((n) => n + 1);
    setScreen('playing');
  };

  const nudge = useCallback((dir: -1 | 1) => {
    worldRef.current?.nudgeLane(dir);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (screen === 'menu' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        startRun();
        return;
      }
      if (screen === 'playing' || screen === 'paused') {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          e.preventDefault();
          nudge(-1);
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          e.preventDefault();
          nudge(1);
        } else if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          setScreen((s) => (s === 'paused' ? 'playing' : 'paused'));
        }
      }
      if (screen === 'gameover' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        startRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, nudge]);

  const showCanvas = screen !== 'menu';
  const showBoard = screen === 'playing' || screen === 'paused' || screen === 'gameover';

  return (
    <div className="relative w-full h-dvh overflow-hidden select-none">
      <BackToMenu />

      {showCanvas && (
        <GameCanvas
          key={runId}
          running={screen === 'playing' || screen === 'paused' || screen === 'gameover'}
          paused={screen === 'paused' || screen === 'gameover'}
          onHud={onHud}
          onGameOver={onGameOver}
          worldRef={worldRef}
        />
      )}

      {/* Idle neon backdrop on menu before WebGL mounts */}
      {screen === 'menu' && (
        <div
          className="absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, #1e1b4b 0%, #050816 55%), linear-gradient(160deg, #083344 0%, #050816 50%, #3b0764 100%)',
          }}
        />
      )}

      <Scoreboard hud={hud} visible={showBoard} />

      {screen === 'menu' && (
        <div className="menu-shell">
          <div className="menu-card">
            <p className="font-display text-xs tracking-[0.35em] text-cyan-300/90 mb-3">
              CLUBHOUSE ARCADE
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold neon-text mb-2">
              霓虹疾馳
            </h1>
            <p className="font-display text-sm tracking-[0.28em] text-fuchsia-300/90 mb-4">
              CYBER NEON RUSH
            </p>
            <p className="hint">
              左右切道閃避障礙，擦身而過可累積連擊；鑽過霓虹加速環可爆發 NITRO。
              連擊滿 5 進入 FEVER，倍率與車速一起狂飆。
            </p>
            <button type="button" className="cta" onClick={startRun}>
              開始疾馳
            </button>
            <p className="hint">
              鍵盤 ← → 或 A D 切道・P / Esc 暫停
              <br />
              最佳分數 {hud.bestScore || '—'} ・ 最遠 {hud.bestDistance || '—'} m
            </p>
          </div>
        </div>
      )}

      {screen === 'paused' && (
        <div className="menu-shell" style={{ background: 'rgba(5,8,22,0.55)' }}>
          <div className="menu-card">
            <h2 className="font-display text-3xl neon-text mb-2">暫停</h2>
            <p className="hint">按 P 或 Esc 繼續</p>
            <button type="button" className="cta" onClick={() => setScreen('playing')}>
              繼續疾馳
            </button>
          </div>
        </div>
      )}

      <TouchControls
        visible={screen === 'playing'}
        onLeft={() => nudge(-1)}
        onRight={() => nudge(1)}
      />

      {screen === 'gameover' && result && (
        <div
          className="fixed inset-0 z-[9500] flex items-center justify-center bg-[#020617]/92 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="衝撞出局"
        >
          <div className="w-full max-w-sm rounded-2xl border border-cyan-400/40 bg-slate-950/95 p-6 sm:p-8 shadow-[0_0_40px_rgba(34,211,238,0.25)] text-center">
            {result.isNewBest && (
              <p className="mb-2 text-sm font-semibold tracking-wide text-amber-300 uppercase font-display">
                NEW BEST
              </p>
            )}
            <h2 className="font-display text-3xl font-bold mb-2 text-fuchsia-300 neon-text">衝撞出局</h2>
            <p className="text-slate-300 text-sm mb-4">
              {result.isNewBest ? '新紀錄！霓虹夜空記住了你的車軌。' : '再來一趟，閃得更漂亮。'}
            </p>
            <dl className="mb-6 grid gap-2 text-sm">
              {[
                { label: '分數', value: result.score.toLocaleString('zh-Hant') },
                { label: '距離', value: `${result.distance} m` },
                { label: '閃避', value: String(result.avoids) },
                { label: 'NITRO', value: String(result.pickups) },
                { label: '最高連擊', value: String(result.maxCombo) },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex justify-between rounded-lg bg-slate-900/90 px-3 py-2 border border-cyan-500/20"
                >
                  <dt className="text-slate-400">{stat.label}</dt>
                  <dd className="font-mono font-semibold text-white tabular-nums">{stat.value}</dd>
                </div>
              ))}
            </dl>
            <button type="button" className="cta" onClick={startRun}>
              再玩一局
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
