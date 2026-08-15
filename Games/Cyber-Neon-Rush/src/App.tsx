import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactElement } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playCapture, playGoal, playLose, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { GameCanvas } from './components/GameCanvas';
import { Scoreboard } from './components/Scoreboard';
import { TouchControls } from './components/TouchControls';
import type { GameWorld } from './engine/GameWorld';
import {
  RUSH_DIFFICULTIES,
  RUSH_DIFFICULTY_LABELS,
  TIP_SEEN_KEY,
  type RushDifficulty,
} from './engine/constants';
import { loadBests, type HudSnapshot, type RunResult } from './engine/scoreSystem';
import type { Screen } from './types';

function hasSeenTip(): boolean {
  try {
    return localStorage.getItem(TIP_SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

function markTipSeen(): void {
  try {
    localStorage.setItem(TIP_SEEN_KEY, '1');
  } catch {
    /* private mode */
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
  const [difficulty, setDifficulty] = useState<RushDifficulty>('normal');
  const [bests, setBests] = useState(() => loadBests());
  const modeBest = bests[difficulty];
  const [hud, setHud] = useState<HudSnapshot>(() => ({
    ...EMPTY_HUD,
    bestScore: modeBest.score,
    bestDistance: modeBest.distance,
  }));
  const [result, setResult] = useState<RunResult | null>(null);
  const [runId, setRunId] = useState(0);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showTip, setShowTip] = useState(false);
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
    setShowTip(false);
    setBests(loadBests());
    if (r.isNewBest || r.score >= 5000) playWin();
    else playLose();
  }, []);

  const dismissTip = useCallback(() => {
    markTipSeen();
    setShowTip(false);
  }, []);

  const startRun = () => {
    setResult(null);
    const b = loadBests()[difficulty];
    setHud({ ...EMPTY_HUD, bestScore: b.score, bestDistance: b.distance });
    setShowHowTo(false);
    setRunId((n) => n + 1);
    setScreen('playing');
    if (!hasSeenTip()) setShowTip(true);
  };

  const nudge = useCallback((dir: -1 | 1) => {
    worldRef.current?.nudgeLane(dir);
  }, []);

  const swipeStartX = useRef<number | null>(null);

  const onSwipePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (screen !== 'playing') return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a, [role="dialog"]')) return;
    swipeStartX.current = e.clientX;
  }, [screen]);

  const onSwipePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (swipeStartX.current == null) return;
      const dx = e.clientX - swipeStartX.current;
      swipeStartX.current = null;
      if (Math.abs(dx) < 48) return;
      nudge(dx < 0 ? -1 : 1);
    },
    [nudge],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (showHowTo && e.code === 'Escape') {
        e.preventDefault();
        setShowHowTo(false);
        return;
      }
      if (showTip && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) {
        e.preventDefault();
        dismissTip();
        return;
      }
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
  }, [screen, nudge, showHowTo, showTip, dismissTip, difficulty]);

  const showCanvas = screen !== 'menu';
  const showBoard = screen === 'playing' || screen === 'paused' || screen === 'gameover';
  const flashOpacity = Math.min(0.55, hud.nearMissFlash * 0.5);

  return (
    <div
      className="relative w-full h-dvh overflow-hidden select-none"
      onPointerDown={onSwipePointerDown}
      onPointerUp={onSwipePointerUp}
      onPointerCancel={() => {
        swipeStartX.current = null;
      }}
    >
      <BackToMenu />

      {showCanvas && (
        <GameCanvas
          key={runId}
          difficulty={difficulty}
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
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundColor: '#050816',
            backgroundImage: [
              'linear-gradient(160deg, rgba(5,8,22,0.55) 0%, rgba(5,8,22,0.78) 55%, rgba(59,7,100,0.72) 100%)',
              `url(${import.meta.env.BASE_URL}menu-bg.jpg)`,
            ].join(', '),
          }}
        />
      )}

      {/* Near-miss / fever screen punch */}
      {showBoard && flashOpacity > 0.02 && (
        <div
          className={`feedback-vignette ${hud.fever ? 'is-fever' : ''} ${hud.toast === 'perfect' ? 'is-perfect' : ''}`}
          style={{ opacity: flashOpacity }}
          aria-hidden="true"
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
            <div className="mode-chips" role="group" aria-label="難度">
              {RUSH_DIFFICULTIES.map((id) => {
                const selected = difficulty === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`mode-chip${selected ? ' is-active' : ''}`}
                    aria-pressed={selected}
                    onClick={() => setDifficulty(id)}
                  >
                    {RUSH_DIFFICULTY_LABELS[id]}
                  </button>
                );
              })}
            </div>
            <button type="button" className="cta" onClick={startRun}>
              開始疾馳
            </button>
            <button type="button" className="cta-secondary" onClick={() => setShowHowTo(true)}>
              操作教學
            </button>
            <p className="hint">
              鍵盤 ← → 或 A D 切道・P / Esc 暫停
              <br />
              {RUSH_DIFFICULTY_LABELS[difficulty]} ・ 最佳分數 {modeBest.score || '—'} ・ 最遠{' '}
              {modeBest.distance || '—'} m
            </p>
          </div>
        </div>
      )}

      {showHowTo && (
        <div
          className="howto-shell"
          role="dialog"
          aria-modal="true"
          aria-label="操作教學"
          onClick={() => setShowHowTo(false)}
        >
          <div className="howto-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-2xl neon-text mb-3">操作教學</h2>
            <ol className="howto-list">
              <li>
                <strong>切道</strong>
                ：鍵盤 ← → / A D，或螢幕下方左右鍵；亦可左右滑動切換三車道。
              </li>
              <li>
                <strong>NITRO</strong>
                ：鑽過霓虹加速環獲得短暫爆發加速與加分。
              </li>
              <li>
                <strong>擦身連擊</strong>
                ：貼近障礙閃過可加分並累積連擊；更近的完美閃避分數更高。
              </li>
              <li>
                <strong>FEVER</strong>
                ：連擊滿 5 進入狂熱狀態，倍率與車速同時提升。
              </li>
            </ol>
            <p className="hint" style={{ marginTop: '0.75rem' }}>
              暫停：P 或 Esc
            </p>
            <button type="button" className="cta" onClick={() => setShowHowTo(false)}>
              知道了
            </button>
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

      {showTip && screen === 'playing' && (
        <div className="run-tip" role="status">
          <p>
            貼近障礙擦身而過可累積連擊；滿 5 進入 <span className="text-fuchsia-300">FEVER</span>。
            鑽過加速環可爆發 <span className="text-amber-300">NITRO</span>。
          </p>
          <button type="button" className="run-tip-dismiss" onClick={dismissTip}>
            知道了
          </button>
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
          subtitle={
            result.isNewBest ? '新紀錄！霓虹夜空記住了你的車軌。' : '再來一趟，閃得更漂亮。'
          }
          badge={result.isNewBest ? '新紀錄' : undefined}
          variant={result.isNewBest ? 'win' : 'lose'}
          stats={[
            { label: '難度', value: RUSH_DIFFICULTY_LABELS[difficulty] },
            { label: '分數', value: result.score.toLocaleString('zh-Hant') },
            { label: '距離', value: `${result.distance} m` },
            { label: '閃避', value: String(result.avoids) },
            { label: 'NITRO', value: String(result.pickups) },
            { label: '最高連擊', value: String(result.maxCombo) },
          ]}
          primaryLabel="再試一次"
          onPrimary={startRun}
        />
      )}
    </div>
  );
}
