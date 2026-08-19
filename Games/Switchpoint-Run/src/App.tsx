import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { GameCanvas } from './components/GameCanvas';
import { FIXED_DT,
  MAX_BUFFER,
} from './game/constants';
import { createRun, finalScore, step } from './game/engine';
import { randomSeedCode } from './game/rng';
import type { PlayerInput, RunState } from './game/types';

type Screen = 'menu' | 'playing';

const BEST_DIST_KEY = 'switchpoint-run:best-distance';
const BEST_SCORE_KEY = 'switchpoint-run:best-score';

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('menu');
  const [paused, setPaused] = useState(false);
  const [bestDistance, setBestDistance] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [seedInput, setSeedInput] = useState('');
  /** Mirrors the simulation for the HUD only; the canvas reads the ref directly. */
  const [hud, setHud] = useState<RunState | null>(null);

  const stateRef = useRef<RunState | null>(null);
  const laneStepRef = useRef<-1 | 0 | 1>(0);
  const jumpRef = useRef(false);
  const slideRef = useRef(false);
  const rafRef = useRef(0);
  const accRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => {
    const d = Number(localStorage.getItem(BEST_DIST_KEY));
    if (d) setBestDistance(d);
    const sc = Number(localStorage.getItem(BEST_SCORE_KEY));
    if (sc) setBestScore(sc);
  }, []);

  const startRun = useCallback((seedCode?: string) => {
    const code = (seedCode ?? seedInput).trim().toUpperCase() || randomSeedCode();
    const s = createRun(code);
    stateRef.current = s;
    setHud(s);
    accRef.current = 0;
    lastRef.current = performance.now();
    setPaused(false);
    setScreen('playing');
  }, [seedInput]);

  // ── Input ──────────────────────────────────────────────────────────────────

  const readInput = useCallback((): PlayerInput => {
    const laneStep = laneStepRef.current;
    laneStepRef.current = 0;
    const jump = jumpRef.current;
    jumpRef.current = false;
    const slide = slideRef.current;
    slideRef.current = false;
    return { laneStep, jump, slide };
  }, []);

  useEffect(() => {
    if (screen !== 'playing') return;
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        laneStepRef.current = -1;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        laneStepRef.current = 1;
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        jumpRef.current = true;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        slideRef.current = true;
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [screen]);

  // ── Touch: swipe to steer ────────────────────────────────────────────────
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    touchStart.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const THRESH = 28;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > THRESH) {
      laneStepRef.current = dx > 0 ? 1 : -1;
    } else if (Math.abs(dy) > THRESH) {
      if (dy < 0) jumpRef.current = true;
      else slideRef.current = true;
    }
  }, []);

  // ── Fixed-timestep loop ────────────────────────────────────────────────────

  useEffect(() => {
    if (screen !== 'playing') return;

    let hudClock = 0;
    const frame = (now: number): void => {
      rafRef.current = requestAnimationFrame(frame);
      const s = stateRef.current;
      if (!s) return;

      const dtReal = Math.min(0.25, (now - lastRef.current) / 1000);
      lastRef.current = now;
      if (paused || s.phase !== 'playing') return;

      accRef.current += dtReal;
      let next = s;
      // Fixed steps only: the simulation must advance in whole FIXED_DT ticks
      // or the run stops being reproducible from its seed and inputs.
      let budget = 8;
      while (accRef.current >= FIXED_DT && budget-- > 0) {
        accRef.current -= FIXED_DT;
        next = step(next, readInput(), FIXED_DT);
        if (next.phase !== 'playing') break;
      }
      stateRef.current = next;

      hudClock += dtReal;
      if (hudClock > 0.08 || next.phase !== 'playing') {
        hudClock = 0;
        setHud(next);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, paused, readInput]);

  // Record bests once a run ends.
  useEffect(() => {
    if (!hud || hud.phase !== 'caught') return;
    const dist = Math.round(hud.distance);
    const score = finalScore(hud);
    if (dist > bestDistance) {
      setBestDistance(dist);
      localStorage.setItem(BEST_DIST_KEY, String(dist));
    }
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem(BEST_SCORE_KEY, String(score));
    }
  }, [hud, bestDistance, bestScore]);

  // ── Screens ────────────────────────────────────────────────────────────────

  if (screen === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center">
        <BackToMenu />
        <div>
          <h1 className="text-4xl font-bold tracking-wide text-emerald-200">岔道疾走</h1>
          <p className="mt-2 text-slate-400 text-sm">Switchpoint Run</p>
        </div>
        <div className="sr-panel rounded-2xl p-5 max-w-md text-left text-sm leading-relaxed text-slate-300">
          <p className="mb-3 text-slate-200 font-semibold">距離不是靠跑，是靠選對路線。</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>每個道岔的支線內容都<b>提前預覽</b>：速度、障礙密度、有無補給一目瞭然。</li>
            <li><b>沒有一條支線是全面最優</b>——速度與收益都要用密度（更多障礙）來換。</li>
            <li>撞到障礙不會立即結束，而是大幅降速，讓後方列車更接近。</li>
            <li>← → 換股道／扳道，↑ 跳過低欄，↓ 滑過高架，P／Esc 暫停。</li>
            <li>觸控：左右滑動換道、上滑跳躍、下滑滑行。</li>
          </ul>
        </div>
        {(bestDistance > 0 || bestScore > 0) && (
          <p className="text-slate-400 text-sm">
            最佳距離 {bestDistance.toLocaleString('zh-Hant')} ・ 最佳分數 {bestScore.toLocaleString('zh-Hant')}
          </p>
        )}
        <div className="flex flex-col items-center gap-2">
          <input
            value={seedInput}
            onChange={(e) => setSeedInput(e.target.value)}
            placeholder="種子碼（留空隨機）"
            maxLength={8}
            className="min-h-[40px] w-48 rounded-lg border border-white/15 bg-slate-900/70 px-3 text-center text-sm tracking-widest text-slate-100 uppercase placeholder:text-slate-500 placeholder:normal-case"
          />
          <button
            type="button"
            onClick={() => startRun()}
            className="min-h-[44px] px-8 py-3 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white"
          >
            扳道出發
          </button>
        </div>
      </div>
    );
  }

  const s = hud;
  const ended = s?.phase === 'caught';
  // Scaled against MAX_BUFFER, not a magic number. It was 260 while the buffer
  // could reach 430, so the bar saturated at 100% and stopped moving for the
  // top 40% of the player's only life-or-death resource.
  const bufferPct = s ? Math.max(0, Math.min(100, (s.buffer / MAX_BUFFER) * 100)) : 0;
  const bufferColor = bufferPct < 22 ? 'bg-red-500' : bufferPct < 50 ? 'bg-amber-400' : 'bg-emerald-400';

  return (
    <div className="h-screen w-screen flex flex-col">
      <BackToMenu />

      {/* HUD */}
      <div className="shrink-0 px-3 pt-14 pb-2 flex items-center justify-between text-xs sm:text-sm text-slate-300">
        <div className="flex gap-3">
          <span>距離 <b className="text-slate-100 tabular-nums">{Math.round(s?.distance ?? 0)}</b></span>
          <span>分數 <b className="text-emerald-300 tabular-nums">{s ? finalScore(s) : 0}</b></span>
        </div>
        <div className="flex gap-3">
          <span>倍率 <b className="text-amber-300">×{(s?.scoreMult ?? 1).toFixed(2)}</b></span>
          <span>連續無傷 <b className="text-sky-300 tabular-nums">{s?.noHitStreak ?? 0}</b></span>
        </div>
      </div>

      {/* Buffer gauge: the single number the whole game is played against. */}
      <div className="shrink-0 px-3 pb-2">
        <div className="h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full ${bufferColor} transition-[width] duration-150`}
            style={{ width: `${bufferPct}%` }}
          />
        </div>
      </div>

      {/* Field */}
      <div
        className="flex-1 min-h-0 relative"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <GameCanvas stateRef={stateRef} paused={paused} />

        {paused && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="sr-panel rounded-2xl px-6 py-4 text-center">
              <p className="text-lg font-semibold mb-1">暫停</p>
              <p className="text-slate-400 text-sm">按 P 或 Esc 繼續</p>
            </div>
          </div>
        )}
      </div>

      {ended && s && (
        <ResultOverlay
          title="被列車追上"
          subtitle={`跑了 ${Math.round(s.distance)} 距離，選了 ${s.branchesCleared} 次岔道。`}
          variant="lose"
          badge={finalScore(s) > bestScore ? '新紀錄' : undefined}
          stats={[
            { label: '距離', value: Math.round(s.distance).toLocaleString('zh-Hant') },
            { label: '分數', value: finalScore(s).toLocaleString('zh-Hant') },
            { label: '路線評價', value: s.routeScore },
            { label: '評分倍率', value: `×${s.scoreMult.toFixed(2)}` },
            { label: '撞擊次數', value: s.hitsTotal },
            { label: '最長連續無傷', value: s.maxNoHitStreak },
            { label: '種子碼', value: s.seedCode },
          ]}
          primaryLabel="再跑一次"
          onPrimary={() => startRun(s.seedCode)}
          secondaryLabel="回選單"
          onSecondary={() => setScreen('menu')}
        />
      )}
    </div>
  );
}
