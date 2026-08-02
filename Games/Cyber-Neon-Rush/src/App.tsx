import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playLose, playWin } from '@clubhouse/shared/synthAudio';
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

  const onHud = useCallback((next: HudSnapshot) => {
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
        } else if (e.code === 'Space' || e.code === 'KeyP') {
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
              在彎曲霓虹賽道上無限狂奔。左右切道閃避障礙，擦身而過可累積連擊倍率。
              攝影機會隨賽道曲率平滑晃動。
            </p>
            <button type="button" className="cta" onClick={startRun}>
              開始疾馳
            </button>
            <p className="hint">
              鍵盤 ← → 或 A D 切道・空白鍵暫停
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
            <p className="hint">空白鍵或 P 繼續</p>
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
        <ResultOverlay
          title="衝撞出局"
          subtitle={result.isNewBest ? '新紀錄！霓虹夜空記住了你的車軌。' : '再來一趟，閃得更漂亮。'}
          badge={result.isNewBest ? 'NEW BEST' : undefined}
          variant={result.isNewBest ? 'win' : 'lose'}
          stats={[
            { label: '分數', value: result.score.toLocaleString('zh-Hant') },
            { label: '距離', value: `${result.distance} m` },
            { label: '閃避', value: result.avoids },
            { label: '最高連擊', value: result.maxCombo },
          ]}
          primaryLabel="再玩一局"
          onPrimary={startRun}
        />
      )}
    </div>
  );
}
