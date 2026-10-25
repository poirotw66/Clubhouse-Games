import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { GameCanvas } from './components/GameCanvas';
import {
  CASCADE_MIN,
  COST,
  DROP_COOLDOWN_TICKS,
  FIXED_DT,
  SHELF_LEN,
  SHELF_W,
  TIMING_WAVE_MAX,
  WALL_X0,
  WALL_X1,
} from './game/constants';
import {
  createRun,
  dropTimingQuality,
  isWindingDown,
  pusherDirection,
  step,
  triangleWave,
} from './game/engine';
import {
  dailyChallengeFor,
  dailyStreak,
  evaluateDailyClear,
  loadDailyProgress,
  recordDailyAttempt,
  saveDailyProgress,
  todayDateKey,
  type DailyChallenge,
  type DailyProgress,
} from './game/daily';
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
import {
  COIN_SETS,
  SPECIAL_UNLOCKS,
  applyRunToMeta,
  coinSetById,
  isCoinSetUnlocked,
  isSpecialUnlocked,
  loadMetaProgress,
  milestoneDefs,
  saveMetaProgress,
  setActiveCoinSet,
  type CoinSetId,
  type MetaProgress,
} from './game/progress';
import { randomSeedCode } from './game/rng';
import {
  TABLE_PACK,
  isTableUnlocked,
  tableById,
  type TableId,
} from './game/tables';
import type { PlayerInput, RunState } from './game/types';
import * as audio from './audio';

type Screen = 'menu' | 'playing';
type Special = PlayerInput['special'];
type MenuPanel = null | 'modes' | 'tables' | 'collection' | 'daily';

const BEST_KEY = 'coin-cascade:best';
const BEST_CASCADE_KEY = 'coin-cascade:best-cascade';

const SPECIAL_LABEL: Record<Special, string> = {
  normal: '一般幣',
  heavy: '重幣',
  ball: '滾珠',
  vibrate: '震動',
  magnet: '磁吸',
};

function cascadeLabel(size: number): string {
  if (size >= 8) return `雪崩 x${size}！`;
  if (size >= 5) return `大連鎖 x${size}！`;
  return `連鎖 x${size}！`;
}

function timingHint(tick: number, physics: RunState['config']['physics']): string {
  const q = dropTimingQuality(tick, physics);
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

function readBestScore(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY) ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function readBestCascade(): number {
  try {
    const n = Number(localStorage.getItem(BEST_CASCADE_KEY) ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('menu');
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(0);
  const [bestCascade, setBestCascade] = useState(0);
  const [modeProgress, setModeProgress] = useState<ModeProgress>(() => loadModeProgress());
  const [meta, setMeta] = useState<MetaProgress>(() => loadMetaProgress());
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>(() => loadDailyProgress());
  const [menuPanel, setMenuPanel] = useState<MenuPanel>(null);
  const [selectedTable, setSelectedTable] = useState<TableId>('classic');
  const [special, setSpecial] = useState<Special>('normal');
  const [hud, setHud] = useState<RunState | null>(null);
  const [banner, setBanner] = useState<{ text: string; key: number } | null>(null);
  const [earnToast, setEarnToast] = useState<string | null>(null);

  const reducedMotion = useReducedMotion();
  useEffect(() => {
    audio.setAudioReducedMotion(reducedMotion);
  }, [reducedMotion]);

  const stateRef = useRef<RunState | null>(null);
  const activeModeIdRef = useRef<string | null>(null);
  const activeDailyRef = useRef<DailyChallenge | null>(null);
  const modeResultAppliedRef = useRef<string | null>(null);
  const specialRef = useRef<Special>('normal');
  const chuteXRef = useRef<number>(SHELF_W / 2);
  const dropRequestRef = useRef(false);
  const rafRef = useRef(0);
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const teeterSlowRef = useRef(0);

  const today = todayDateKey();
  const todayChallenge = useMemo(() => dailyChallengeFor(today), [today]);
  const todayRecord = dailyProgress.records.find((r) => r.dateKey === today);
  const streak = dailyStreak(dailyProgress, today);

  useEffect(() => {
    setBest(readBestScore());
    setBestCascade(readBestCascade());
  }, []);

  // Keep selected table on an unlocked one.
  useEffect(() => {
    const table = tableById(selectedTable);
    if (
      table &&
      !isTableUnlocked(table, meta.tokens, modeProgress.clearedCount, meta.unlockedTables)
    ) {
      setSelectedTable('classic');
    }
  }, [meta, modeProgress.clearedCount, selectedTable]);

  const activeCoinSet = coinSetById(meta.activeCoinSet) ?? COIN_SETS[0]!;
  const selectedTableDef = tableById(selectedTable) ?? TABLE_PACK[0]!;

  const beginRun = useCallback((state: RunState, modeId: string | null, daily: DailyChallenge | null) => {
    activeModeIdRef.current = modeId;
    activeDailyRef.current = daily;
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
    setEarnToast(null);
    setMenuPanel(null);
    setScreen('playing');
  }, []);

  const startRun = useCallback(() => {
    beginRun(createRun(randomSeedCode(), { tableId: selectedTable }), null, null);
  }, [beginRun, selectedTable]);

  const startMode = useCallback(
    (modeId: string) => {
      const mode = modeById(modeId);
      if (!mode) return;
      beginRun(
        createRun(mode.seedCode, { ...modeCreateOptions(mode), tableId: 'classic' }),
        mode.id,
        null,
      );
    },
    [beginRun],
  );

  const startDaily = useCallback(() => {
    const challenge = dailyChallengeFor(todayDateKey());
    beginRun(
      createRun(challenge.seedCode, {
        tableId: challenge.tableId,
        startingCredits: challenge.startingCredits,
        clearScore: challenge.targetScore,
        isDaily: true,
        modeId: null,
      }),
      null,
      challenge,
    );
  }, [beginRun]);

  const retryCurrent = useCallback(() => {
    const modeId = activeModeIdRef.current;
    const daily = activeDailyRef.current;
    if (modeId) startMode(modeId);
    else if (daily) startDaily();
    else startRun();
  }, [startMode, startDaily, startRun]);

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
      if (s === 'magnet' && !isSpecialUnlocked('magnet', meta)) return;
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
      } else if (e.code === 'Digit4') {
        toggleSpecial('magnet');
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [screen, meta]);

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
          audio.playJackpot(ev.jackpotTideBonus);
          setBanner({
            text: ev.jackpotTideBonus
              ? `潮湧彩池！+${Math.round(ev.jackpotBurst)}`
              : `彩池爆開！+${Math.round(ev.jackpotBurst)}`,
            key: next.tick + 0.5,
          });
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

  useEffect(() => {
    if (special !== 'normal' && hud && COST[special] > hud.creditsRemaining) {
      specialRef.current = 'normal';
      setSpecial('normal');
    }
  }, [hud, special]);

  // Record free-play bests, mode progress, meta tokens, daily — once a run ends.
  useEffect(() => {
    if (!hud || hud.phase !== 'ended') return;

    const resultKey = `${hud.modeId ?? 'free'}:${hud.config.isDaily ? 'daily' : 'x'}:${hud.tableId}:${hud.score}:${hud.longestCascade}:${hud.creditsSpent}`;
    if (modeResultAppliedRef.current === resultKey) return;
    modeResultAppliedRef.current = resultKey;

    // Free-play global best (never written by modes / other keys).
    if (!hud.modeId && !hud.config.isDaily) {
      if (hud.score > best) {
        setBest(hud.score);
        try {
          localStorage.setItem(BEST_KEY, String(hud.score));
        } catch {
          /* ignore */
        }
      }
      if (hud.longestCascade > bestCascade) {
        setBestCascade(hud.longestCascade);
        try {
          localStorage.setItem(BEST_CASCADE_KEY, String(hud.longestCascade));
        } catch {
          /* ignore */
        }
      }
    }

    if (hud.modeId) {
      const index = modeIndexOf(hud.modeId);
      if (index >= 0) {
        setModeProgress((prev) => {
          const next = applyModeResult(prev, index, hud);
          saveModeProgress(next);
          return next;
        });
      }
    }

    if (hud.config.isDaily && activeDailyRef.current) {
      const challenge = activeDailyRef.current;
      setDailyProgress((prev) => {
        const next = recordDailyAttempt(prev, challenge, hud);
        saveDailyProgress(next);
        return next;
      });
    }

    setMeta((prev) => {
      const clears = modeProgress.clearedCount;
      const { meta: next, earned, newlyUnlocked } = applyRunToMeta(prev, hud, clears);
      saveMetaProgress(next);
      const bits = [`+${earned} 潮幣`];
      if (newlyUnlocked.length > 0) {
        bits.push(`解鎖 ${newlyUnlocked.slice(0, 3).join('、')}`);
        audio.playUnlock();
      }
      setEarnToast(bits.join('・'));
      return next;
    });
  }, [hud, best, bestCascade, modeProgress.clearedCount]);

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

  const specialButtons: Special[] = isSpecialUnlocked('magnet', meta)
    ? ['heavy', 'ball', 'vibrate', 'magnet']
    : ['heavy', 'ball', 'vibrate'];

  // ── Screens ────────────────────────────────────────────────────────────

  if (screen === 'menu') {
    const stickerSrc = `${import.meta.env.BASE_URL}title-bg.jpg`;
    const marqueeBits = [
      '沒掉下去的幣就是地形',
      '連鎖推潮',
      '完美時機加分',
      '彩池爆開',
      '三張主題台面',
      '潮幣解鎖收藏',
      '每日種子挑戰',
    ];
    return (
      <div
        className="cc-title-shell min-h-screen flex flex-col items-center justify-center py-6 text-left"
        style={{
          backgroundImage: `url(${stickerSrc})`,
        }}
      >
        <BackToMenu />
        <div className="cc-title-inner flex w-full flex-col">
          <header className="cc-hero">
            <div className="cc-hero__type">
              <h1 className="cc-display cc-glow-title cc-hero__title">幣潮</h1>
              <p className="cc-hero__sub">Coin Cascade・點擊檯面投幣・←→／空白・特殊幣 1–4</p>
            </div>
            <div className="cc-hero__sticker" aria-hidden="true">
              <img src={stickerSrc} alt="" />
              <span className="cc-hero__sticker-glow" />
            </div>
          </header>

          <div className="cc-claim">
            <p>沒掉下去的幣，就是你自己蓋的地形。</p>
            <span>經典／釘陣／潮汐三廳・機制不同，不只換皮</span>
          </div>

          <div className="cc-stats">
            {best > 0 && (
              <span className="cc-stat">
                自由最佳 {best.toLocaleString('zh-Hant')}・連鎖 {bestCascade}
              </span>
            )}
            <span className="cc-stat">潮幣 {meta.tokens}</span>
            {streak > 0 && <span className="cc-stat cc-stat--teal">每日連勝 {streak}</span>}
            <span className="cc-stat cc-stat--pink">
              {selectedTableDef.name}・{selectedTableDef.mechanicLabel}
            </span>
          </div>

          <div className="flex w-full flex-col gap-2.5">
            <button
              type="button"
              onClick={startRun}
              className="cc-cta min-h-[52px] w-full rounded-[0.35rem] px-8 py-3.5 text-lg font-black tracking-wide"
            >
              投幣開始
            </button>
            <div className="cc-action-grid">
              <button type="button" onClick={() => setMenuPanel('tables')} className="cc-sheet cc-sheet--amber">
                主題台面
                <small>三廳機制</small>
              </button>
              <button type="button" onClick={() => setMenuPanel('daily')} className="cc-sheet cc-sheet--teal">
                每日挑戰
                <small>固定種子</small>
              </button>
              <button
                type="button"
                onClick={() => setMenuPanel('modes')}
                aria-label={`挑戰／模式包。${packSubtitle}`}
                className="cc-sheet cc-sheet--rose"
              >
                挑戰／模式包
                <small>{packSubtitle}</small>
              </button>
              <button type="button" onClick={() => setMenuPanel('collection')} className="cc-sheet cc-sheet--cyan">
                收藏櫃
                <small>幣面與特殊幣</small>
              </button>
            </div>
          </div>
        </div>

        <div className="cc-marquee" aria-hidden="true">
          <div className="cc-marquee__track">
            <div className="cc-marquee__chunk">
              {marqueeBits.map((bit) => (
                <span key={`a-${bit}`}>{bit}</span>
              ))}
            </div>
            <div className="cc-marquee__chunk">
              {marqueeBits.map((bit) => (
                <span key={`b-${bit}`}>{bit}</span>
              ))}
            </div>
          </div>
        </div>

        {menuPanel === 'modes' && (
          <MenuDialog title="挑戰／模式包" subtitle="分數門檻・連鎖目標・限時衝刺・進度獨立於自由遊玩" onClose={() => setMenuPanel(null)}>
            <button
              type="button"
              onClick={() => {
                const mode = modeAt(packContinue);
                if (!mode) return;
                startMode(mode.id);
              }}
              className="cc-cta mt-2 min-h-[44px] w-full rounded-xl px-4 text-sm font-black"
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
                      onClick={() => startMode(mode.id)}
                      className="cc-row-btn flex min-h-16 w-full flex-col px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
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
                            {typeof modeBest === 'number' ? `・最佳 ${modeBest.toLocaleString('zh-Hant')}` : ''}
                            {typeof modeCasc === 'number' ? `・連鎖 ${modeCasc}` : ''}
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </MenuDialog>
        )}

        {menuPanel === 'tables' && (
          <MenuDialog title="主題台面" subtitle="機制不同・各自量測 RTP・潮幣或模式通關解鎖" onClose={() => setMenuPanel(null)}>
            <ul className="mt-3 space-y-2 overflow-y-auto pr-1">
              {TABLE_PACK.map((table) => {
                const unlocked = isTableUnlocked(
                  table,
                  meta.tokens,
                  modeProgress.clearedCount,
                  meta.unlockedTables,
                );
                const tableBest = meta.tableBest[table.id];
                const selected = selectedTable === table.id;
                return (
                  <li key={table.id}>
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        setSelectedTable(table.id);
                        setMenuPanel(null);
                      }}
                      className={`cc-row-btn flex min-h-16 w-full flex-col px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-45 ${
                        selected ? 'is-selected' : ''
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-amber-50">{table.name}</span>
                        <span className="text-[11px] text-slate-400">
                          {!unlocked
                            ? `潮幣 ${table.unlockTokens} 或通關 ${table.unlockModeClears}`
                            : selected
                              ? '使用中'
                              : '選擇'}
                        </span>
                      </span>
                      {unlocked && (
                        <>
                          <span className="mt-1 text-xs text-slate-400">{table.blurb}</span>
                          <span className="mt-1 text-[11px] text-amber-300/90">
                            {table.mechanicLabel}
                            {typeof tableBest === 'number'
                              ? `・本廳最佳 ${tableBest.toLocaleString('zh-Hant')}`
                              : ''}
                          </span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </MenuDialog>
        )}

        {menuPanel === 'daily' && (
          <MenuDialog
            title="每日挑戰"
            subtitle={`${todayChallenge.dateKey}・種子 ${todayChallenge.seedCode}`}
            onClose={() => setMenuPanel(null)}
          >
            <div className="mt-3 space-y-2 text-left text-sm text-amber-50">
              <p>
                台面：{tableById(todayChallenge.tableId)?.name ?? todayChallenge.tableId}
              </p>
              <p>投幣 {todayChallenge.startingCredits}・{todayChallenge.goalLabel}</p>
              <p className="text-xs text-slate-400">
                {todayRecord?.cleared
                  ? `今日已達標・最佳 ${todayRecord.bestScore.toLocaleString('zh-Hant')}・嘗試 ${todayRecord.attempts}`
                  : todayRecord
                    ? `尚未達標・最佳 ${todayRecord.bestScore.toLocaleString('zh-Hant')}・嘗試 ${todayRecord.attempts}`
                    : '尚未挑戰'}
                {streak > 0 ? `・連勝 ${streak}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={startDaily}
              className="cc-cta mt-4 min-h-[44px] w-full rounded-xl px-4 text-sm font-black"
            >
              {todayRecord?.cleared ? '再刷今日' : '開始每日挑戰'}
            </button>
          </MenuDialog>
        )}

        {menuPanel === 'collection' && (
          <MenuDialog title="收藏櫃" subtitle={`潮幣 ${meta.tokens}・累計 ${meta.lifetimeTokens}`} onClose={() => setMenuPanel(null)}>
            <section className="mt-3 text-left">
              <h3 className="text-sm font-bold text-amber-100">幣面</h3>
              <ul className="mt-2 space-y-2">
                {COIN_SETS.map((set) => {
                  const unlocked = isCoinSetUnlocked(set.id, meta);
                  const active = meta.activeCoinSet === set.id;
                  return (
                    <li key={set.id}>
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => {
                          const next = setActiveCoinSet(meta, set.id as CoinSetId);
                          setMeta(next);
                          saveMetaProgress(next);
                        }}
                        className={`cc-row-btn is-collection flex w-full flex-col px-3 py-2 text-left disabled:opacity-45 ${
                          active ? 'is-selected' : ''
                        }`}
                      >
                        <span className="font-semibold text-amber-50">
                          {set.name}
                          {active ? ' ・使用中' : unlocked ? '' : ` ・潮幣 ${set.unlockTokens}`}
                        </span>
                        <span className="text-xs text-slate-400">{set.blurb}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="mt-4 text-left">
              <h3 className="text-sm font-bold text-amber-100">特殊幣</h3>
              <ul className="mt-2 space-y-2">
                {SPECIAL_UNLOCKS.map((sp) => {
                  const unlocked = isSpecialUnlocked(sp.id, meta);
                  return (
                    <li
                      key={sp.id}
                      className={`rounded-xl border px-3 py-2 ${
                        unlocked ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-white/10 bg-slate-900/60 opacity-70'
                      }`}
                    >
                      <p className="font-semibold text-amber-50">
                        {sp.name}
                        {unlocked ? ' ・已解鎖' : ` ・潮幣 ${sp.unlockTokens}`}
                      </p>
                      <p className="text-xs text-slate-400">{sp.blurb}</p>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section className="mt-4 text-left">
              <h3 className="text-sm font-bold text-amber-100">里程碑</h3>
              <ul className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
                {milestoneDefs().map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-lg border px-2 py-1.5 ${
                      meta.milestones[m.id]
                        ? 'border-emerald-500/40 text-emerald-200'
                        : 'border-white/10 text-slate-500'
                    }`}
                  >
                    {meta.milestones[m.id] ? '✓ ' : ''}
                    {m.name}
                  </li>
                ))}
              </ul>
            </section>
            <section className="mt-4 text-left">
              <h3 className="text-sm font-bold text-amber-100">台面紀錄</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {TABLE_PACK.map((t) => (
                  <li key={t.id}>
                    {t.name}：
                    {typeof meta.tableBest[t.id] === 'number'
                      ? meta.tableBest[t.id]!.toLocaleString('zh-Hant')
                      : '—'}
                  </li>
                ))}
              </ul>
            </section>
          </MenuDialog>
        )}
      </div>
    );
  }

  const s = hud;
  const ended = s?.phase === 'ended';
  const activeMode = s?.modeId ? modeById(s.modeId) : undefined;
  const activeDaily = activeDailyRef.current;
  const isDaily = Boolean(s?.config.isDaily && activeDaily);
  const modeCleared = s && activeMode ? evaluateModeGoal(activeMode, s) : false;
  const dailyCleared = s && activeDaily && isDaily ? evaluateDailyClear(activeDaily, s) : false;
  const freePlayBestBeat = s && !s.modeId && !s.config.isDaily && s.score > best;
  const modeBestPrev = activeMode ? modeProgress.bestScore[activeMode.id] ?? 0 : 0;
  const modeBestBeat = s && activeMode && s.score > modeBestPrev;
  const physics = s?.config.physics;
  const pusherWave = s && physics ? triangleWave(s.tick, physics.pusherPeriodTicks) : 0;
  const pusherFwd = s && physics ? pusherDirection(s.tick, physics) === 1 : true;
  const timing = s && physics ? dropTimingQuality(s.tick, physics) : 'late';
  const cooldownPct = s ? 1 - s.cooldown / DROP_COOLDOWN_TICKS : 1;
  const strokeActive = s?.strokeWasForward && (s.strokeFallen > 0 || pusherFwd);
  const deadline = s?.config.deadlineTick ?? null;
  const timeLeftSec =
    s && deadline !== null ? Math.max(0, (deadline - s.tick) * FIXED_DT) : null;
  const winding = s ? isWindingDown(s) && s.phase === 'playing' : false;
  const tableDef = s ? tableById(s.tableId) : selectedTableDef;

  return (
    <div className="cc-play h-screen w-screen flex flex-col">
      <BackToMenu />

      <div className="cc-hud shrink-0 px-3 pt-14 pb-2 flex items-center justify-between text-xs sm:text-sm text-amber-50 flex-wrap gap-1">
        <div className="flex gap-2 flex-wrap">
          {tableDef && <span className="cc-hud-chip text-amber-100">{tableDef.name}</span>}
          {activeMode && <span className="cc-hud-chip text-amber-100">{activeMode.name}</span>}
          {isDaily && <span className="cc-hud-chip text-teal-200">每日</span>}
          <span className="cc-hud-chip">
            投幣 <b className="text-amber-200">{s?.creditsRemaining ?? 0}</b>
          </span>
          <span className="cc-hud-chip cc-hud-chip--pot">
            彩池 <b className="text-fuchsia-300">{Math.round(s?.pot ?? 0)}</b>
          </span>
          <span className="cc-hud-chip cc-hud-chip--cascade">
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
          {winding && <span className="cc-hud-chip text-emerald-200">結算中…</span>}
        </div>
        <div className="cc-hud-chip cc-hud-chip--score cc-display tabular-nums text-lg font-extrabold text-amber-200">
          {(s?.score ?? 0).toLocaleString('zh-Hant')}
          {activeMode?.goal.kind === 'score' ? (
            <span className="ml-1 text-xs font-normal opacity-70">/{activeMode.goal.min}</span>
          ) : null}
          {isDaily && activeDaily ? (
            <span className="ml-1 text-xs font-normal opacity-70">/{activeDaily.targetScore}</span>
          ) : null}
        </div>
      </div>

      {(activeMode || isDaily) && !ended && (
        <div className="shrink-0 px-3 pb-1 text-[11px] text-amber-200/80">
          目標：{activeMode ? activeMode.goalLabel : activeDaily?.goalLabel}
        </div>
      )}

      {earnToast && ended && (
        <div className="shrink-0 px-3 pb-1 text-center text-xs text-emerald-200">{earnToast}</div>
      )}

      {s && !ended && physics && (
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
          <span
            className={`cc-timing-label shrink-0 ${timing === 'perfect' ? 'is-perfect' : timing === 'good' ? 'is-good' : ''}`}
          >
            {timingHint(s.tick, physics)}
          </span>
          <span
            className={`cc-cooldown-dot shrink-0 ${cooldownPct >= 1 ? 'is-ready' : ''}`}
            title={cooldownPct >= 1 ? '可投幣' : '冷卻中'}
          />
        </div>
      )}

      {banner && (
        <div
          key={banner.key}
          className="cc-cascade-banner shrink-0 px-3 pb-1 text-center text-sm font-semibold text-amber-200"
        >
          {banner.text}
        </div>
      )}

      <div ref={surfaceRef} className="flex-1 min-h-0 relative" onPointerDown={onPointerDown}>
        <GameCanvas
          stateRef={stateRef}
          chuteXRef={chuteXRef}
          paused={paused}
          reducedMotion={reducedMotion}
          coinSet={activeCoinSet}
          cabinetHue={tableDef?.cabinetHue ?? 38}
        />

        {paused && (
          <div className="cc-pause-scrim absolute inset-0 flex items-center justify-center">
            <div className="cc-pause-card text-center">
              <p className="cc-display cc-glow-title mb-1 text-2xl text-amber-200">暫停</p>
              <p className="text-sm font-semibold text-amber-100/75">按 P 或 Esc 繼續</p>
            </div>
          </div>
        )}
      </div>

      <div className="cc-special-bar shrink-0 flex justify-center gap-2 px-3 py-2.5 flex-wrap">
        {specialButtons.map((k, i) => (
          <button
            key={k}
            type="button"
            disabled={COST[k] > (s?.creditsRemaining ?? 0)}
            onClick={() => {
              const next = specialRef.current === k ? 'normal' : k;
              specialRef.current = next;
              setSpecial(next);
            }}
            className={`cc-special min-h-[44px] min-w-[84px] px-3 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed ${
              special === k ? 'is-on' : ''
            }`}
          >
            {i + 1}．{SPECIAL_LABEL[k]}
            <span className="block text-[10px] font-semibold opacity-80">{COST[k]} 幣</span>
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
              : isDaily
                ? dailyCleared
                  ? '每日達標'
                  : '每日未達標'
                : '投幣用盡'
          }
          subtitle={
            activeMode
              ? modeCleared
                ? activeMode.goalLabel
                : `未達成：${activeMode.goalLabel}`
              : isDaily && activeDaily
                ? dailyCleared
                  ? activeDaily.goalLabel
                  : `未達成：${activeDaily.goalLabel}`
                : `回收 ${s.coinsRecovered} 枚・彩池爆開 ${s.jackpotBursts} 次`
          }
          variant={
            activeMode
              ? modeCleared
                ? 'win'
                : 'lose'
              : isDaily
                ? dailyCleared
                  ? 'win'
                  : 'lose'
                : s.score >= s.creditsSpent
                  ? 'win'
                  : 'neutral'
          }
          badge={freePlayBestBeat || modeBestBeat ? '新紀錄' : undefined}
          stats={[
            ...(tableDef ? [{ label: '台面', value: tableDef.name }] : []),
            ...(activeMode ? [{ label: '模式', value: activeMode.name }] : []),
            ...(isDaily ? [{ label: '每日', value: today }] : []),
            { label: '分數', value: s.score.toLocaleString('zh-Hant') },
            { label: '回收幣數', value: s.coinsRecovered },
            { label: '彩池爆開', value: `${s.jackpotBursts} 次 / +${Math.round(s.potAwarded)}` },
            { label: '最長連鎖', value: `${s.longestCascade} 枚` },
            { label: '時機加分', value: s.timingBonusCount },
            { label: '近失次數', value: s.nearMissCount },
            { label: '種子碼', value: s.seedCode },
          ]}
          primaryLabel={activeMode ? '再挑戰' : isDaily ? '再刷今日' : '再投一輪'}
          onPrimary={retryCurrent}
          secondaryLabel="回選單"
          onSecondary={() => setScreen('menu')}
        />
      )}
    </div>
  );
}

function MenuDialog({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className="cc-dialog-scrim fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="cc-dialog-panel flex max-h-[85vh] w-full max-w-lg flex-col p-4 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="cc-display text-xl font-extrabold text-amber-200">{title}</h2>
            <p className="mt-1 text-xs font-semibold text-amber-100/65">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="關閉"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-amber-400/45 bg-amber-500/15 px-3 py-2 text-xs font-black text-amber-100"
          >
            關閉
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
