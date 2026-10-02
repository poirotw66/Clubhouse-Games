import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { GameCanvas } from './components/GameCanvas';
import { CASCADE_MIN, COST, DROP_COOLDOWN_TICKS, FIXED_DT, SHELF_LEN, SHELF_W, TIMING_WAVE_MAX, WALL_X0, WALL_X1 } from './game/constants';
import { createRun, dropTimingQuality, isWindingDown, pusherDirection, step, triangleWave } from './game/engine';
import {
  MODE_PACK,
  applyModeResult,
  continueModeIndex,
  evaluateModeGoal,
  isModeUnlocked,
  loadModeProgress,
  modeAt,
  modeById,
  modeCount,
  modeCreateOptions,
  modeIndexOf,
  saveModeProgress,
  type ModeProgress,
} from './game/modes';
import { randomSeedCode } from './game/rng';
import type { PlayerInput, RunState } from './game/types';
import * as audio from './audio';

type Screen = 'menu' | 'playing';
type Special = PlayerInput['special'];

const BEST_KEY = 'coin-cascade:best';
const BEST_CASCADE_KEY = 'coin-cascade:best-cascade';

const SPECIAL_LABEL: Record<Special, string> = {
  normal: '一般幣',
  heavy: '重幣',
  ball: '滾珠',
  vibrate: '震動',
};

function cascadeLabel(size: number): string {
  if (size >= 8) return `雪崩 x${size}！`;
  if (size >= 5) return `大連鎖 x${size}！`;
  return `連鎖 x${size}！`;
}

function timingHint(tick: number): string {
  const q = dropTimingQuality(tick);
  if (q === 'perfect') return '完美時機';
  if (q === 'good') return '尚可';
  return '推程中';
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (): void => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('menu');
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const [bestCascade, setBestCascade] = useState(0);
  const [modeProgress, setModeProgress] = useState<ModeProgress>(() => loadModeProgress());
  const [showModes, setShowModes] = useState(false);
  const [special, setSpecial] = useState<Special>('normal');
  /** Mirrors the simulation for the HUD only; the canvas reads stateRef directly. */
  const [hud, setHud] = useState<RunState | null>(null);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);

  const reducedMotion = useReducedMotion();

  const stateRef = useRef<RunState | null>(null);
  const activeModeIdRef = useRef<string | null>(null);
  const modeResultAppliedRef = useRef<string | null>(null);
  const specialRef = useRef<Special>('normal');
  const chuteXRef = useRef<number>(SHELF_W / 2);
  const dropRequestRef = useRef(false);
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef(0);
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const teeterSlowRef = useRef(0);

  useEffect(() => {
    const b = Number(localStorage.getItem(BEST_KEY) ?? 0);
    const bc = Number(localStorage.getItem(BEST_CASCADE_KEY) ?? 0);
    if (b) setBest(b);
    if (bc) setBestCascade(bc);
  }, []);

  const beginRun = useCallback((state: RunState, modeId: string | null) => {
    activeModeIdRef.current = modeId;
    modeResultAppliedRef.current = null;
    stateRef.current = state;
    setHud(state);
    setSpecial('normal');
    specialRef.current = 'normal';
    chuteXRef.current = SHELF_W / 2;
    accRef.current = 0;
    lastRef.current = performance.now();
    setPaused(false);
    setBanner(null);
    setScreen('playing');
  }, []);

  const startRun = useCallback(() => {
    beginRun(createRun(randomSeedCode()), null);
  }, [beginRun]);

  const startMode = useCallback(
    (modeId: string) => {
      const mode = modeById(modeId);
      if (!mode) return;
      beginRun(createRun(mode.seedCode, modeCreateOptions(mode)), mode.id);
    },
    [beginRun],
  );

  const retryCurrent = useCallback(() => {
    const modeId = activeModeIdRef.current;
    if (modeId) startMode(modeId);
    else startRun();
  }, [startMode, startRun]);

  const packTotal = modeCount();
  const packContinue = continueModeIndex(modeProgress.clearedCount);
  const packSubtitle = useMemo(() => {
    if (modeProgress.clearedCount >= packTotal) return `已完成 ${packTotal}/${packTotal}`;
    if (modeProgress.clearedCount > 0) {
      const next = MODE_PACK[packContinue];
      return `進度 ${modeProgress.clearedCount}/${packTotal}・下一關 ${next?.name ?? ''}`;
    }
    return `六關可刷・進度 0/${packTotal}`;
  }, [modeProgress.clearedCount, packContinue, packTotal]);

  // ── Keyboard ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (screen !== 'playing') return;
    const toggleSpecial = (s: Special): void => {
      if (COST[s] > (stateRef.current?.creditsRemaining ?? 0)) return;
      const next = specialRef.current === s ? 'normal' : s;
      specialRef.current = next;
      setSpecial(next);
    };
    const down = (e: KeyboardEvent): void => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        chuteXRef.current = Math.max(WALL_X0, chuteXRef.current - 14);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        chuteXRef.current = Math.min(WALL_X1, chuteXRef.current + 14);
      } else if (e.code === 'Space') {
        e.preventDefault();
        dropRequestRef.current = true;
      } else if (e.code === 'Digit1') {
        toggleSpecial('heavy');
      } else if (e.code === 'Digit2') {
        toggleSpecial('ball');
      } else if (e.code === 'Digit3') {
        toggleSpecial('vibrate');
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [screen]);

  // ── Fixed-timestep loop ───────────────────────────────────────────────────

  useEffect(() => {
    if (screen !== 'playing') return;

    let hudClock = 0;
    const frame = (now: number): void => {
      rafRef.current = requestAnimationFrame(frame);
      const s = stateRef.current;
      if (!s) return;

      let dtReal = Math.min(0.25, (now - lastRef.current) / 1000);
      lastRef.current = now;
      if (paused || s.phase !== 'playing') return;

      // Near-miss slow-mo: a mild time dilation while a coin teeters on the
      // edge, purely a rendering-pace choice (it changes how many FIXED_DT
      // ticks are consumed per real frame, never what happens in them), so it
      // has no bearing on replay determinism. Skipped entirely under
      // prefers-reduced-motion.
      const anyTeetering = s.coins.some((c) => c.teeterSince >= 0);
      if (anyTeetering && !reducedMotion) {
        teeterSlowRef.current = Math.min(18, teeterSlowRef.current + 1);
      } else {
        teeterSlowRef.current = Math.max(0, teeterSlowRef.current - 1);
      }
      if (teeterSlowRef.current > 0) dtReal *= 0.45;

      accRef.current += dtReal;
      let next = s;
      let budget = 8;
      while (accRef.current >= FIXED_DT && budget-- > 0) {
        accRef.current -= FIXED_DT;
        const wantedDrop = dropRequestRef.current;
        const input: PlayerInput = {
          dropX: chuteXRef.current,
          drop: wantedDrop,
          special: specialRef.current,
        };
        dropRequestRef.current = false;
        next = step(next, input, FIXED_DT);

        const ev = next.events;
        if (wantedDrop && !ev.rejectedDrop && !ev.shook) audio.playDrop();
        if (ev.fallen.length > 0) {
          const simultaneous = ev.fallen.filter((f) => f.kind !== 'trigger').length;
          if (simultaneous > 0) audio.playCoinFall(simultaneous);
        }
        if (ev.cascadeFinalized >= CASCADE_MIN) {
          audio.playCascade(ev.cascadeFinalized);
          setBanner({ text: cascadeLabel(ev.cascadeFinalized), key: next.tick });
        }
        if (ev.jackpotBurst > 0) {
          audio.playJackpot();
          setBanner({ text: `彩池爆開！+${Math.round(ev.jackpotBurst)}`, key: next.tick + 0.5 });
        }
        if (ev.timingBonuses > 0) {
          audio.playBonus();
          setBanner({ text: `完美時機 +${ev.timingBonuses}`, key: next.tick + 0.25 });
        }
        if (ev.shook) audio.playShake();
        if (ev.rejectedDrop) audio.playReject();

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
  }, [screen, paused, reducedMotion]);

  // Drop the special selection as soon as the credits left can no longer cover
  // it. step() would fall back to a plain coin anyway; reverting here is what
  // makes that visible rather than silent, and it is what stops the selector
  // from sitting lit on an option the player can no longer buy.
  useEffect(() => {
    if (special !== 'normal' && hud && COST[special] > hud.creditsRemaining) {
      specialRef.current = 'normal';
      setSpecial('normal');
    }
  }, [hud, special]);

  // Record free-play bests, or apply mode progress, once a run ends.
  useEffect(() => {
    if (!hud || hud.phase !== 'ended') return;

    if (!hud.modeId) {
      if (hud.score > best) {
        setBest(hud.score);
        localStorage.setItem(BEST_KEY, String(hud.score));
      }
      if (hud.longestCascade > bestCascade) {
        setBestCascade(hud.longestCascade);
        localStorage.setItem(BEST_CASCADE_KEY, String(hud.longestCascade));
      }
      return;
    }

    const resultKey = `${hud.modeId}:${hud.score}:${hud.longestCascade}:${hud.creditsSpent}`;
    if (modeResultAppliedRef.current === resultKey) return;
    modeResultAppliedRef.current = resultKey;

    const index = modeIndexOf(hud.modeId);
    if (index < 0) return;
    setModeProgress((prev) => {
      const next = applyModeResult(prev, index, hud);
      saveModeProgress(next);
      return next;
    });
  }, [hud, best, bestCascade]);

  // ── Pointer: tap anywhere on the shelf strip to aim + drop there ─────────

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const toShelfX = useCallback((clientX: number): number => {
    const el = surfaceRef.current;
    if (!el) return SHELF_W / 2;
    const r = el.getBoundingClientRect();
    const fieldH = SHELF_LEN + 70;
    const scale = Math.min(r.width / SHELF_W, r.height / fieldH);
    const ox = (r.width - SHELF_W * scale) / 2;
    const x = (clientX - r.left - ox) / scale;
    return Math.max(WALL_X0, Math.min(WALL_X1, x));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const x = toShelfX(e.clientX);
      chuteXRef.current = x;
      dropRequestRef.current = true;
    },
    [toShelfX],
  );

  // ── Screens ────────────────────────────────────────────────────────────

  if (screen === 'menu') {
    return (
      <div
        className="cc-title-shell min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-center"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(11, 8, 6, 0.55), rgba(11, 8, 6, 0.92))',
            `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
          ].join(', '),
        }}
      >
        <BackToMenu />
        <header className="cc-title-hero">
          <h1 className="cc-display cc-glow-title text-4xl font-extrabold tracking-wide text-amber-200">幣潮</h1>
          <p className="mt-2 text-slate-400 text-sm">Coin Cascade</p>
        </header>
        <div className="cc-panel rounded-2xl p-5 max-w-md text-left text-sm leading-relaxed text-amber-50">
          <p className="mb-3 text-amber-200 font-semibold">沒掉下去的幣，就是你自己蓋的地形。</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>檯面一開始就是滿的——推落檯面上的幣回收計分；你投下的幣沒掉下去就留在檯面當地形。</li>
            <li>點擊檯面上方任一橫向位置即在該處投幣；鍵盤用 ←→ 移動、空白鍵投幣。</li>
            <li>
              <b>1</b> 重幣（推力大但佔位）、<b>2</b> 滾珠（不易堆積）、<b>3</b> 震動（能鬆動死角，但也會搖散你自己的牆）。
            </li>
            <li>台面上有彩池觸發區——把觸發幣一路推下去，彩池整池爆開。</li>
            <li>一次推程掉落 3 枚以上觸發連鎖；<b>推板在後方時投幣</b>可吃滿整段推程並獲得時機加分。</li>
            <li>靠邊緣落幣風險高、落幣率也高；沒有一種投法在所有情況下都最好。</li>
            <li>自由遊玩不設時間限制，投幣數用盡即結束；標題另有挑戰／模式包可刷。</li>
          </ul>
        </div>
        {best > 0 && (
          <p className="text-slate-400 text-sm">
            自由遊玩最佳 {best.toLocaleString('zh-Hant')} ・ 最長連鎖 {bestCascade}
          </p>
        )}
        <div className="flex flex-col gap-3 items-center w-full max-w-md">
          <button type="button" onClick={startRun} className="cc-cta min-h-[44px] w-full sm:w-auto px-8 py-3 rounded-xl font-semibold">
            投幣開始
          </button>
          <button
            type="button"
            onClick={() => setShowModes(true)}
            aria-label={`挑戰／模式包。${packSubtitle}`}
            className="min-h-[44px] w-full rounded-xl font-semibold text-amber-100 border border-amber-400/50 bg-amber-500/15 hover:bg-amber-500/25 transition-colors touch-manipulation px-6 py-3"
          >
            挑戰／模式包
          </button>
          <p className="-mt-1 text-center text-[11px] text-slate-500">{packSubtitle}</p>
        </div>

        {showModes && (
          <div
            className="fixed inset-0 z-40 flex items-end justify-center bg-[#0b0806]/80 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cc-modes-title"
            onClick={() => setShowModes(false)}
          >
            <div
              className="cc-panel flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl p-4 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="cc-modes-title" className="text-xl font-bold text-amber-100">
                    挑戰／模式包
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    分數門檻・連鎖目標・限時衝刺・分模式最佳・進度獨立於自由遊玩
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="關閉挑戰／模式包"
                  onClick={() => setShowModes(false)}
                  className="shrink-0 rounded-lg border border-amber-700/50 bg-slate-900/80 px-3 py-2 text-xs font-bold text-amber-100"
                >
                  關閉
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const mode = modeAt(packContinue);
                  if (!mode) return;
                  setShowModes(false);
                  startMode(mode.id);
                }}
                className="cc-cta mt-4 min-h-[44px] w-full rounded-xl px-4 text-sm font-black"
              >
                {modeProgress.clearedCount >= packTotal
                  ? '重玩最終關'
                  : modeProgress.clearedCount > 0
                    ? `繼續・${MODE_PACK[packContinue]?.name}`
                    : '開始第一關'}
              </button>

              <ul className="mt-3 space-y-2 overflow-y-auto pr-1">
                {MODE_PACK.map((mode, index) => {
                  const unlocked = isModeUnlocked(index, modeProgress.clearedCount);
                  const done = Boolean(modeProgress.cleared[mode.id]);
                  const modeBest = modeProgress.bestScore[mode.id];
                  const modeCasc = modeProgress.bestCascade[mode.id];
                  return (
                    <li key={mode.id}>
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => {
                          setShowModes(false);
                          startMode(mode.id);
                        }}
                        className="flex min-h-16 w-full flex-col rounded-xl border border-amber-700/40 bg-slate-900/70 px-3 py-3 text-left transition-colors hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-amber-50">
                            {index + 1}. {mode.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {!unlocked ? '未解鎖' : done ? '已通關' : '挑戰'}
                          </span>
                        </span>
                        {unlocked && (
                          <>
                            <span className="mt-1 text-xs text-slate-400">{mode.blurb}</span>
                            <span className="mt-1 text-[11px] text-amber-300/90">
                              目標：{mode.goalLabel}
                              {typeof modeBest === 'number'
                                ? `・最佳 ${modeBest.toLocaleString('zh-Hant')}`
                                : ''}
                              {typeof modeCasc === 'number' ? `・連鎖 ${modeCasc}` : ''}
                            </span>
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  const s = hud;
  const ended = s?.phase === 'ended';
  const activeMode = s?.modeId ? modeById(s.modeId) : undefined;
  const modeCleared = s && activeMode ? evaluateModeGoal(activeMode, s) : false;
  const freePlayBestBeat = s && !s.modeId && s.score > best;
  const modeBestPrev = activeMode ? modeProgress.bestScore[activeMode.id] ?? 0 : 0;
  const modeBestBeat = s && activeMode && s.score > modeBestPrev;
  const pusherWave = s ? triangleWave(s.tick) : 0;
  const pusherFwd = s ? pusherDirection(s.tick) === 1 : true;
  const timing = s ? dropTimingQuality(s.tick) : 'late';
  const cooldownPct = s ? 1 - s.cooldown / DROP_COOLDOWN_TICKS : 1;
  const strokeActive = s?.strokeWasForward && (s.strokeFallen > 0 || pusherFwd);
  const deadline = s?.config.deadlineTick ?? null;
  const timeLeftSec =
    s && deadline !== null ? Math.max(0, (deadline - s.tick) * FIXED_DT) : null;
  const winding = s ? isWindingDown(s) && s.phase === 'playing' : false;

  return (
    <div className="h-screen w-screen flex flex-col">
      <BackToMenu />

      {/* HUD */}
      <div className="cc-hud shrink-0 px-3 pt-14 pb-2 flex items-center justify-between text-xs sm:text-sm text-amber-50 flex-wrap gap-1">
        <div className="flex gap-2 flex-wrap">
          {activeMode && (
            <span className="cc-hud-chip text-amber-100">{activeMode.name}</span>
          )}
          <span className="cc-hud-chip">
            投幣 <b className="text-amber-200">{s?.creditsRemaining ?? 0}</b>
          </span>
          <span className="cc-hud-chip">
            彩池 <b className="text-fuchsia-300">{Math.round(s?.pot ?? 0)}</b>
          </span>
          <span className="cc-hud-chip">
            連鎖 <b className="text-sky-300">{s?.longestCascade ?? 0}</b>
            {activeMode?.goal.kind === 'cascade' ? (
              <span className="opacity-70">/{activeMode.goal.min}</span>
            ) : null}
          </span>
          {timeLeftSec !== null && (
            <span className={`cc-hud-chip ${timeLeftSec <= 10 ? 'text-rose-300' : ''}`}>
              剩餘 <b>{formatClock(timeLeftSec)}</b>
            </span>
          )}
          {strokeActive && (
            <span className="cc-hud-chip cc-stroke-meter">
              本推程 <b className="text-emerald-300">+{s?.strokeFallen ?? 0}</b>
            </span>
          )}
          {winding && (
            <span className="cc-hud-chip text-emerald-200">結算中…</span>
          )}
        </div>
        <div className="cc-hud-chip cc-display tabular-nums text-base font-semibold text-amber-200">
          {(s?.score ?? 0).toLocaleString('zh-Hant')}
          {activeMode?.goal.kind === 'score' ? (
            <span className="ml-1 text-xs font-normal opacity-70">/{activeMode.goal.min}</span>
          ) : null}
        </div>
      </div>

      {activeMode && !ended && (
        <div className="shrink-0 px-3 pb-1 text-[11px] text-amber-200/80">
          目標：{activeMode.goalLabel}
        </div>
      )}

      {/* Pusher cycle + drop readiness */}
      {s && !ended && (
        <div className="cc-cycle-row shrink-0 px-3 pb-1 flex items-center gap-2 text-[10px] sm:text-xs text-amber-100/90">
          <span className="shrink-0 opacity-80">推板</span>
          <div className="cc-cycle-track flex-1 relative h-2 rounded-full overflow-hidden">
            <div
              className="cc-cycle-sweet"
              style={{ width: `${(TIMING_WAVE_MAX * 100).toFixed(1)}%` }}
              aria-hidden
            />
            <div
              className={`cc-cycle-marker ${timing === 'perfect' ? 'is-perfect' : ''}`}
              style={{ left: `${(pusherWave * 100).toFixed(1)}%` }}
              aria-hidden
            />
          </div>
          <span className={`cc-timing-label shrink-0 ${timing === 'perfect' ? 'is-perfect' : timing === 'good' ? 'is-good' : ''}`}>
            {timingHint(s.tick)}
          </span>
          <span className={`cc-cooldown-dot shrink-0 ${cooldownPct >= 1 ? 'is-ready' : ''}`} title={cooldownPct >= 1 ? '可投幣' : '冷卻中'} />
        </div>
      )}

      {banner && (
        <div key={banner.key} className="cc-cascade-banner shrink-0 px-3 pb-1 text-center text-sm font-semibold text-amber-200">
          {banner.text}
        </div>
      )}

      {/* Shelf */}
      <div
        ref={surfaceRef}
        className="flex-1 min-h-0 relative"
        onPointerDown={onPointerDown}
      >
        <GameCanvas stateRef={stateRef} chuteXRef={chuteXRef} paused={paused} reducedMotion={reducedMotion} />

        {paused && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="cc-panel rounded-2xl px-6 py-4 text-center">
              <p className="text-lg font-semibold mb-1 text-amber-100">暫停</p>
              <p className="text-slate-400 text-sm">按 P 或 Esc 繼續</p>
            </div>
          </div>
        )}
      </div>

      {/* Special-coin selector */}
      <div className="shrink-0 flex justify-center gap-2 px-3 py-2 flex-wrap">
        {(['heavy', 'ball', 'vibrate'] as Special[]).map((k, i) => (
          <button
            key={k}
            type="button"
            disabled={COST[k] > (s?.creditsRemaining ?? 0)}
            onClick={() => {
              const next = specialRef.current === k ? 'normal' : k;
              specialRef.current = next;
              setSpecial(next);
            }}
            className={`cc-special min-h-[44px] min-w-[92px] px-3 rounded-xl font-semibold border text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800/80 ${
              special === k
                ? 'is-on bg-amber-500 border-amber-300 text-amber-950'
                : 'bg-slate-800/80 border-white/10 text-amber-100 hover:bg-slate-700/80'
            }`}
          >
            {i + 1}．{SPECIAL_LABEL[k]}
            <span className="block text-[10px] font-normal opacity-80">{COST[k]} 幣</span>
          </button>
        ))}
      </div>

      {ended && s && (
        <ResultOverlay
          title={
            activeMode
              ? modeCleared
                ? '關卡達成'
                : '未達標'
              : '投幣用盡'
          }
          subtitle={
            activeMode
              ? modeCleared
                ? activeMode.goalLabel
                : `未達成：${activeMode.goalLabel}`
              : `回收 ${s.coinsRecovered} 枚・彩池爆開 ${s.jackpotBursts} 次`
          }
          variant={
            activeMode
              ? modeCleared
                ? 'win'
                : 'lose'
              : s.score >= s.creditsSpent
                ? 'win'
                : 'neutral'
          }
          badge={freePlayBestBeat || modeBestBeat ? '新紀錄' : undefined}
          stats={[
            ...(activeMode ? [{ label: '模式', value: activeMode.name }] : []),
            { label: '分數', value: s.score.toLocaleString('zh-Hant') },
            { label: '回收幣數', value: s.coinsRecovered },
            { label: '彩池爆開', value: `${s.jackpotBursts} 次 / +${Math.round(s.potAwarded)}` },
            { label: '最長連鎖', value: `${s.longestCascade} 枚` },
            { label: '時機加分', value: s.timingBonusCount },
            { label: '近失次數', value: s.nearMissCount },
            { label: '種子碼', value: s.seedCode },
          ]}
          primaryLabel={activeMode ? '再挑戰' : '再投一輪'}
          onPrimary={retryCurrent}
          secondaryLabel="回選單"
          onSecondary={() => setScreen('menu')}
        />
      )}
    </div>
  );
}
