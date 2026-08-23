import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { GameCanvas } from './components/GameCanvas';
import { COST, FIXED_DT, SHELF_LEN, SHELF_W, WALL_X0, WALL_X1 } from './game/constants';
import { createRun, step } from './game/engine';
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

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('menu');
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const [bestCascade, setBestCascade] = useState(0);
  const [special, setSpecial] = useState<Special>('normal');
  /** Mirrors the simulation for the HUD only; the canvas reads stateRef directly. */
  const [hud, setHud] = useState<RunState | null>(null);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);

  const reducedMotion = useReducedMotion();

  const stateRef = useRef<RunState | null>(null);
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

  const startRun = useCallback(() => {
    const s = createRun(randomSeedCode());
    stateRef.current = s;
    setHud(s);
    setSpecial('normal');
    specialRef.current = 'normal';
    chuteXRef.current = SHELF_W / 2;
    accRef.current = 0;
    lastRef.current = performance.now();
    setPaused(false);
    setBanner(null);
    setScreen('playing');
  }, []);

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
        const input: PlayerInput = {
          dropX: chuteXRef.current,
          drop: dropRequestRef.current,
          special: specialRef.current,
        };
        dropRequestRef.current = false;
        next = step(next, input, FIXED_DT);

        const ev = next.events;
        if (ev.fallen.length > 0) {
          const simultaneous = ev.fallen.filter((f) => f.kind !== 'trigger').length;
          if (simultaneous > 0) audio.playCoinFall(simultaneous);
        }
        if (ev.cascadeFinalized >= 1) {
          audio.playCascade(ev.cascadeFinalized);
          setBanner({ text: `連鎖 x${ev.cascadeFinalized}！`, key: next.tick });
        }
        if (ev.jackpotBurst > 0) {
          audio.playJackpot();
          setBanner({ text: `彩池爆開！+${Math.round(ev.jackpotBurst)}`, key: next.tick + 0.5 });
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

  // Record bests once a run ends.
  useEffect(() => {
    if (!hud || hud.phase !== 'ended') return;
    if (hud.score > best) {
      setBest(hud.score);
      localStorage.setItem(BEST_KEY, String(hud.score));
    }
    if (hud.longestCascade > bestCascade) {
      setBestCascade(hud.longestCascade);
      localStorage.setItem(BEST_CASCADE_KEY, String(hud.longestCascade));
    }
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
            <li>投下的幣被推板推向前緣；掉下去回收計分，沒掉下去就留在台面上。</li>
            <li>點擊台面上方任一橫向位置即在該處投幣；鍵盤用 ←→ 移動、空白鍵投幣。</li>
            <li>
              <b>1</b> 重幣（推力大但佔位）、<b>2</b> 滾珠（不易堆積）、<b>3</b> 震動（能鬆動死角，但也會搖散你自己的牆）。
            </li>
            <li>台面上有彩池觸發區——把觸發幣一路推下去，彩池整池爆開。</li>
            <li>一次推程掉落 3 枚以上觸發連鎖演出；沒有一種投法在所有情況下都最好。</li>
            <li>不設時間限制，投幣數用盡即結束。</li>
          </ul>
        </div>
        {best > 0 && (
          <p className="text-slate-400 text-sm">
            最佳分數 {best.toLocaleString('zh-Hant')} ・ 最長連鎖 {bestCascade}
          </p>
        )}
        <button type="button" onClick={startRun} className="cc-cta min-h-[44px] px-8 py-3 rounded-xl font-semibold">
          投幣開始
        </button>
      </div>
    );
  }

  const s = hud;
  const ended = s?.phase === 'ended';

  return (
    <div className="h-screen w-screen flex flex-col">
      <BackToMenu />

      {/* HUD */}
      <div className="cc-hud shrink-0 px-3 pt-14 pb-2 flex items-center justify-between text-xs sm:text-sm text-amber-50 flex-wrap gap-1">
        <div className="flex gap-2 flex-wrap">
          <span className="cc-hud-chip">
            投幣 <b className="text-amber-200">{s?.creditsRemaining ?? 0}</b>
          </span>
          <span className="cc-hud-chip">
            彩池 <b className="text-fuchsia-300">{Math.round(s?.pot ?? 0)}</b>
          </span>
          <span className="cc-hud-chip">
            連鎖 <b className="text-sky-300">{s?.longestCascade ?? 0}</b>
          </span>
        </div>
        <div className="cc-hud-chip cc-display tabular-nums text-base font-semibold text-amber-200">
          {(s?.score ?? 0).toLocaleString('zh-Hant')}
        </div>
      </div>

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
          title="投幣用盡"
          subtitle={`回收 ${s.coinsRecovered} 枚・彩池爆開 ${s.jackpotBursts} 次`}
          variant={s.score >= s.creditsSpent ? 'win' : 'neutral'}
          badge={s.score > best ? '新紀錄' : undefined}
          stats={[
            { label: '分數', value: s.score.toLocaleString('zh-Hant') },
            { label: '回收幣數', value: s.coinsRecovered },
            { label: '彩池爆開', value: `${s.jackpotBursts} 次 / +${Math.round(s.potAwarded)}` },
            { label: '最長連鎖', value: `${s.longestCascade} 枚` },
            { label: '近失次數', value: s.nearMissCount },
            { label: '種子碼', value: s.seedCode },
          ]}
          primaryLabel="再投一輪"
          onPrimary={startRun}
          secondaryLabel="回選單"
          onSecondary={() => setScreen('menu')}
        />
      )}
    </div>
  );
}
