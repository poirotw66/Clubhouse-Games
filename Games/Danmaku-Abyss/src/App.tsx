import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { GameCanvas } from './components/GameCanvas';
import { FIELD_H, FIELD_W, FIXED_DT, STAGE_COUNT } from './game/constants';
import { activeConditions, createRun, step, takeUpgrade } from './game/engine';
import { randomSeedCode } from './game/rng';
import { CONDITION_TEXT, UPGRADE_BY_ID } from './game/upgrades';
import type { PlayerInput, RunState } from './game/types';

type Screen = 'menu' | 'playing';

const BEST_KEY = 'danmaku-abyss:best';

const RARITY_STYLE: Record<string, string> = {
  common: 'border-slate-500/50 text-slate-200',
  rare: 'border-sky-400/60 text-sky-200',
  epic: 'border-fuchsia-400/70 text-fuchsia-200',
};

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('menu');
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  /** Mirrors the simulation for the HUD only; the canvas reads the ref directly. */
  const [hud, setHud] = useState<RunState | null>(null);

  const stateRef = useRef<RunState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const bombRef = useRef(false);
  const pointerRef = useRef<{ active: boolean; x: number; y: number; focus: boolean } | null>(null);
  const rafRef = useRef(0);
  const accRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => {
    const raw = localStorage.getItem(BEST_KEY);
    if (raw) setBest(Number(raw) || 0);
  }, []);

  const startRun = useCallback(() => {
    const s = createRun(randomSeedCode());
    stateRef.current = s;
    setHud(s);
    accRef.current = 0;
    lastRef.current = performance.now();
    setPaused(false);
    setScreen('playing');
  }, []);

  // ── Input ──────────────────────────────────────────────────────────────────

  const readInput = useCallback((s: RunState): PlayerInput => {
    const keys = keysRef.current;
    let dx = 0;
    let dy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
    let focus = keys.has('ShiftLeft') || keys.has('ShiftRight');

    const p = pointerRef.current;
    if (p?.active) {
      // Steer toward the finger rather than snapping to it: teleporting the
      // ship under the thumb makes the tiny hitbox impossible to place, which
      // is the one thing this game cannot afford to get wrong.
      const ddx = p.x - s.px;
      const ddy = p.y - s.py;
      const d = Math.hypot(ddx, ddy);
      if (d > 1.5) {
        dx = ddx / d;
        dy = ddy / d;
      }
      focus = focus || p.focus;
    }

    const bomb = bombRef.current;
    bombRef.current = false;
    return { dx, dy, focus, bomb };
  }, []);

  useEffect(() => {
    if (screen !== 'playing') return;
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }
      if (e.code === 'KeyZ') {
        e.preventDefault();
        bombRef.current = true;
        return;
      }
      if (e.code.startsWith('Arrow') || e.code.startsWith('Shift') || 'KeyAKeyDKeyWKeyS'.includes(e.code)) {
        e.preventDefault();
      }
      keysRef.current.add(e.code);
    };
    const up = (e: KeyboardEvent): void => {
      keysRef.current.delete(e.code);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [screen]);

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
        next = step(next, readInput(next), FIXED_DT);
        if (next.phase !== 'playing') break;
      }
      stateRef.current = next;

      hudClock += dtReal;
      if (hudClock > 0.1 || next.phase !== 'playing') {
        hudClock = 0;
        setHud(next);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, paused, readInput]);

  // Record the best score once a run is over.
  useEffect(() => {
    if (!hud || (hud.phase !== 'lost' && hud.phase !== 'won')) return;
    if (hud.score > best) {
      setBest(hud.score);
      localStorage.setItem(BEST_KEY, String(hud.score));
    }
  }, [hud, best]);

  const pick = useCallback((id: string) => {
    const s = stateRef.current;
    if (!s) return;
    const next = takeUpgrade(s, id);
    stateRef.current = next;
    setHud(next);
    accRef.current = 0;
    lastRef.current = performance.now();
  }, []);

  // ── Pointer steering ───────────────────────────────────────────────────────

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const toField = useCallback((clientX: number, clientY: number) => {
    const el = surfaceRef.current;
    if (!el) return { x: FIELD_W / 2, y: FIELD_H / 2 };
    const r = el.getBoundingClientRect();
    const scale = Math.min(r.width / FIELD_W, r.height / FIELD_H);
    const ox = (r.width - FIELD_W * scale) / 2;
    const oy = (r.height - FIELD_H * scale) / 2;
    return {
      x: (clientX - r.left - ox) / scale,
      // Lift the ship above the finger so the thumb never covers the hitbox.
      y: (clientY - r.top - oy) / scale - 46,
    };
  }, []);

  const holdTimer = useRef<number | null>(null);
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const p = toField(e.clientX, e.clientY);
      pointerRef.current = { active: true, x: p.x, y: p.y, focus: false };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      // A held finger means "thread this", matching Shift on a keyboard.
      holdTimer.current = window.setTimeout(() => {
        if (pointerRef.current) pointerRef.current.focus = true;
      }, 220);
    },
    [toField],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointerRef.current?.active) return;
      const p = toField(e.clientX, e.clientY);
      pointerRef.current.x = p.x;
      pointerRef.current.y = p.y;
    },
    [toField],
  );
  const endPointer = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    pointerRef.current = null;
  }, []);

  // ── Screens ────────────────────────────────────────────────────────────────

  if (screen === 'menu') {
    return (
      <div
        className="da-title-shell min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(5, 6, 15, 0.55), rgba(5, 6, 15, 0.92))',
            `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
          ].join(', '),
        }}
      >
        <BackToMenu />
        <header className="da-title-hero">
          <h1 className="da-display da-glow-title text-4xl font-extrabold tracking-wide text-fuchsia-200">彈幕深淵</h1>
          <p className="mt-2 text-slate-400 text-sm">Danmaku Abyss</p>
        </header>
        <div className="da-panel rounded-2xl p-5 max-w-md text-left text-sm leading-relaxed text-slate-300">
          <p className="mb-3 text-slate-200 font-semibold">靠得越近，打得越痛，也死得越快。</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>傷害隨距離衰減，擦彈倍率隨距離上升——站哪裡是唯一重要的問題。</li>
            <li><b>集中模式</b>（Shift／長按）大幅減速並顯示判定點，能穿針但無法換位。</li>
            <li><b>靈擊</b>（Z）清空子彈換命，但會把擦彈倍率歸零。</li>
            <li>死亡扣一條命、掉一級火力，碎片會撒在你死掉的地方。</li>
            <li>五個階段，每階段結束三選一強化。</li>
          </ul>
        </div>
        {best > 0 && <p className="text-slate-400 text-sm">最佳分數 {best.toLocaleString('zh-Hant')}</p>}
        <button
          type="button"
          onClick={startRun}
          className="da-cta min-h-[44px] px-8 py-3 rounded-xl font-semibold text-white"
        >
          潛入深淵
        </button>
      </div>
    );
  }

  const s = hud;
  const ended = s && (s.phase === 'lost' || s.phase === 'won');
  const boss = s?.enemies.find((e) => e.isBoss);
  // Only the conditions this run's picks actually key off are worth showing.
  const watched = new Set(
    (s?.upgrades ?? []).map((id) => UPGRADE_BY_ID[id]?.conditional?.when).filter(Boolean) as string[],
  );
  const liveConditions = s
    ? [...activeConditions(s)].filter((c) => watched.has(c))
    : [];

  return (
    <div className="h-screen w-screen flex flex-col">
      <BackToMenu />

      {/* HUD */}
      <div className="da-hud shrink-0 px-3 pt-14 pb-2 flex items-center justify-between text-xs sm:text-sm text-slate-300">
        <div className="flex gap-2 flex-wrap">
          <span className="da-hud-chip">階段 <b className="text-slate-100">{Math.min(s?.stage ?? 1, STAGE_COUNT)}/{STAGE_COUNT}</b></span>
          <span className="da-hud-chip">殘機 <b className="text-rose-300">{'♥'.repeat(Math.max(0, s?.lives ?? 0)) || '—'}</b></span>
          <span className="da-hud-chip">靈擊 <b className="text-amber-300">{'✦'.repeat(Math.max(0, s?.bombs ?? 0)) || '—'}</b></span>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <span className="da-hud-chip">火力 <b className="text-sky-300">{s?.powerTier ?? 1}</b></span>
          <span className="da-hud-chip">擦彈 <b className="text-fuchsia-300">×{(s?.grazeMult ?? 1).toFixed(2)}</b></span>
          <span className="da-hud-chip da-display tabular-nums text-slate-100">{(s?.score ?? 0).toLocaleString('zh-Hant')}</span>
        </div>
      </div>

      {/* Conditions your picks care about, lit only while they hold. A
          conditional upgrade is a decision about how to play, which needs the
          state to be visible — otherwise the bonus is invisible bookkeeping. */}
      {s && liveConditions.length > 0 && (
        <div className="shrink-0 px-3 pb-1 flex gap-2 flex-wrap text-[11px]">
          {liveConditions.map((c) => (
            <span key={c} className="px-2 py-0.5 rounded-full border border-fuchsia-400/50 text-fuchsia-200">
              {CONDITION_TEXT[c]}
            </span>
          ))}
        </div>
      )}

      {boss?.card && (
        <div className="da-card-banner shrink-0 px-3 pb-1 flex justify-between text-xs text-fuchsia-200">
          <span>{boss.card.name}</span>
          <span className="tabular-nums">{Math.max(0, boss.card.timeLimit - boss.cardElapsed).toFixed(1)}s</span>
        </div>
      )}

      {/* Field */}
      <div
        ref={surfaceRef}
        className="flex-1 min-h-0 relative"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <GameCanvas stateRef={stateRef} paused={paused} />

        {paused && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="da-panel rounded-2xl px-6 py-4 text-center">
              <p className="text-lg font-semibold mb-1">暫停</p>
              <p className="text-slate-400 text-sm">按 P 或 Esc 繼續</p>
            </div>
          </div>
        )}

        {s?.phase === 'upgrade' && (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/70">
            <div className="w-full max-w-md">
              <p className="text-center text-slate-300 mb-3 text-sm">第 {s.stage} 階段結束 — 選擇一項強化</p>
              <div className="grid gap-2">
                {s.offered.map((id) => {
                  const u = UPGRADE_BY_ID[id];
                  if (!u) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => pick(id)}
                      className={`min-h-[44px] w-full text-left px-4 py-3 rounded-xl border bg-slate-900/85 hover:bg-slate-800 ${RARITY_STYLE[u.rarity]}`}
                    >
                      <span className="font-semibold">{u.name}</span>
                      <span className="block text-slate-400 text-sm mt-0.5">{u.text}</span>
                      {u.conditional && (
                        <span className="block mt-1 text-[11px] text-fuchsia-300/80">
                          條件：{CONDITION_TEXT[u.conditional.when]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Touch bomb key: kept off the field so it can never be hit while steering. */}
      <div className="shrink-0 flex justify-end px-3 py-2">
        <button
          type="button"
          aria-label="靈擊"
          onPointerDown={() => {
            bombRef.current = true;
          }}
          disabled={!s || s.bombs <= 0}
          className="min-h-[44px] min-w-[88px] rounded-xl font-semibold bg-amber-600/80 hover:bg-amber-500 disabled:opacity-40 text-white"
        >
          靈擊 Z
        </button>
      </div>

      {ended && s && (
        <ResultOverlay
          title={s.phase === 'won' ? '穿過深淵' : '被吞沒'}
          subtitle={s.phase === 'won' ? '五個階段都撐過來了。' : `倒在第 ${s.stage} 階段。`}
          variant={s.phase === 'won' ? 'win' : 'lose'}
          badge={s.score > best ? '新紀錄' : undefined}
          stats={[
            { label: '分數', value: s.score.toLocaleString('zh-Hant') },
            { label: '到達階段', value: `${Math.min(s.stage, STAGE_COUNT)} / ${STAGE_COUNT}` },
            { label: 'Capture', value: String(s.captures) },
            { label: '擦彈', value: String(s.grazeCount) },
            { label: '最高倍率', value: `×${s.grazeMult.toFixed(2)}` },
            { label: '種子碼', value: s.seedCode },
          ]}
          primaryLabel="再潛一次"
          onPrimary={startRun}
          secondaryLabel="回標題"
          onSecondary={() => setScreen('menu')}
        />
      )}
    </div>
  );
}
