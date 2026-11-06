import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { haptic } from '@clubhouse/shared/juice';
import {
  playCombo,
  playError,
  playLose,
  playMove,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';
import { DispatchDrawer } from './components/DispatchDrawer';
import { DispatchLeftWing } from './components/DispatchLeftWing';
import {
  DispatchRightWing,
  type BlackboxLogEntry,
} from './components/DispatchRightWing';
import { GameCanvas } from './components/GameCanvas';
import { GaragePanel } from './components/GaragePanel';
import { MobileControlsOverlay } from './components/MobileControlsOverlay';
import { MobileTacticalRibbon } from './components/MobileTacticalRibbon';
import {
  RUN_CHALLENGES,
  applyChallengeResult,
  challengeById,
  challengeCount,
  challengeIndexById,
  challengeMetric,
  continueChallengeIndex,
  isChallengeCleared,
  isChallengeUnlocked,
  loadChallengeProgress,
  saveChallengeProgress,
  type ChallengeProgress,
  type RunChallenge,
} from './game/challenges';
import { FIXED_DT, PLAYER_Y, laneCenterX } from './game/constants';
import { todayKey } from './game/daily';
import { createRun, finalScore, step } from './game/engine';
import {
  createFx,
  prefersReducedMotion,
  triggerCombo,
  triggerHit,
  triggerNearMiss,
  triggerPickup,
  triggerSwitch,
  type FxState,
} from './game/juice';
import { MODIFIERS, type ModifierId } from './game/modifiers';
import {
  boltsFromRun,
  buyRunner,
  buyTheme,
  dailyStatus,
  loadMeta,
  selectRunner,
  selectTheme,
  settleRun,
  toggleModifier,
  type MetaProgress,
  type RunMode,
} from './game/progress';
import { RUNNERS, type RunnerId } from './game/profiles';
import { randomSeedCode } from './game/rng';
import { THEMES, type ThemeId } from './game/themes';
import type { PlayerInput, RunConfig, RunState } from './game/types';

type Screen = 'menu' | 'playing';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('menu');
  const [paused, setPaused] = useState(false);
  const [meta, setMeta] = useState<MetaProgress>(() => loadMeta());
  const [seedInput, setSeedInput] = useState('');
  const [challengeProgress, setChallengeProgress] = useState<ChallengeProgress>(() => ({
    clearedCount: 0,
    bestMetric: {},
    cleared: {},
  }));
  const [showChallenges, setShowChallenges] = useState(false);
  const [showGarage, setShowGarage] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<RunChallenge | null>(null);
  const [runMode, setRunMode] = useState<RunMode>('free');
  const [dailyDate, setDailyDate] = useState('');
  const [challengeWon, setChallengeWon] = useState(false);
  const [lastBolts, setLastBolts] = useState(0);
  const [lastNewBest, setLastNewBest] = useState(false);
  const [hud, setHud] = useState<RunState | null>(null);
  const [comboFlash, setComboFlash] = useState(0);
  const [activeKeys, setActiveKeys] = useState({
    left: false,
    right: false,
    up: false,
    down: false,
  });
  const [blackboxLogs, setBlackboxLogs] = useState<BlackboxLogEntry[]>([]);
  const [showMobileControls, setShowMobileControls] = useState(true);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);

  const stateRef = useRef<RunState | null>(null);
  const fxRef = useRef<FxState>(createFx());
  const laneStepRef = useRef<-1 | 0 | 1>(0);
  const jumpRef = useRef(false);
  const slideRef = useRef(false);
  const rafRef = useRef(0);
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const activeChallengeRef = useRef<RunChallenge | null>(null);
  const challengeResolvedRef = useRef(false);
  const runModeRef = useRef<RunMode>('free');
  const dailyDateRef = useRef('');
  const settledRef = useRef(false);
  const juiceSnap = useRef<{
    hits: number;
    branches: number;
    streak: number;
    scoreMult: number;
    buffer: number;
    active: boolean;
    resolvedObs: number;
  } | null>(null);

  useEffect(() => {
    setMeta(loadMeta());
    setChallengeProgress(loadChallengeProgress());
  }, []);

  const buildConfig = useCallback(
    (forChallenge: boolean): RunConfig => {
      if (forChallenge) {
        return { runnerId: 'standard', themeId: 'tunnel', modifierIds: [] };
      }
      return {
        runnerId: meta.selectedRunnerId,
        themeId: meta.selectedThemeId,
        modifierIds: [...meta.equippedModifiers],
      };
    },
    [meta.selectedRunnerId, meta.selectedThemeId, meta.equippedModifiers],
  );

  const applyChallengeEnd = useCallback((state: RunState, challenge: RunChallenge) => {
    if (challengeResolvedRef.current) return;
    challengeResolvedRef.current = true;
    const index = challengeIndexById(challenge.id);
    setChallengeProgress((prev) => {
      const applied = applyChallengeResult(prev, index, state);
      saveChallengeProgress(applied.progress);
      return applied.progress;
    });
  }, []);

  const settleIfNeeded = useCallback(
    (state: RunState, mode: RunMode, date: string) => {
      if (settledRef.current) return;
      settledRef.current = true;
      const modBonus = mode === 'challenge'
        ? 0
        : state.config.modifierIds.reduce((sum, id) => {
            const m = MODIFIERS.find((x) => x.id === id);
            return sum + (m?.boltBonus ?? 0);
          }, 0);
      // Equip cost is paid at settle when modifiers with equipCost were active.
      let equipCost = 0;
      if (mode !== 'challenge') {
        for (const id of state.config.modifierIds) {
          const m = MODIFIERS.find((x) => x.id === id);
          if (m) equipCost += m.equipCost;
        }
      }
      setMeta((prev) => {
        const result = settleRun(prev, {
          state,
          mode,
          dailyDate: mode === 'daily' ? date : undefined,
          modifierBoltBonus: modBonus - equipCost,
        });
        setLastBolts(result.boltsEarned);
        setLastNewBest(result.newFreeBest || result.newDailyBest);
        return result.meta;
      });
    },
    [],
  );

  const addLog = useCallback(
    (text: string, kind: BlackboxLogEntry['kind'], timeSec: number) => {
      setBlackboxLogs((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          time: formatTime(timeSec),
          text,
          kind,
        },
        ...prev.slice(0, 19),
      ]);
    },
    [],
  );

  const startRun = useCallback(
    (
      seedCode?: string,
      challenge: RunChallenge | null = null,
      mode: RunMode = 'free',
      date = '',
    ) => {
      const code =
        (challenge?.seedCode ?? seedCode ?? seedInput).trim().toUpperCase() || randomSeedCode();
      const s = createRun(code, 0, undefined, buildConfig(Boolean(challenge)));
      stateRef.current = s;
      fxRef.current = createFx();
      juiceSnap.current = null;
      setHud(s);
      accRef.current = 0;
      lastRef.current = performance.now();
      setPaused(false);
      setChallengeWon(false);
      setLastBolts(0);
      setLastNewBest(false);
      setComboFlash(0);
      challengeResolvedRef.current = false;
      settledRef.current = false;
      activeChallengeRef.current = challenge;
      runModeRef.current = mode;
      dailyDateRef.current = date;
      setActiveChallenge(challenge);
      setRunMode(mode);
      setDailyDate(date);
      setBlackboxLogs([
        {
          id: 'init-0',
          time: '00:00',
          text: `調度指揮中心發車授權確認・種子 ${code}・全線運轉開始`,
          kind: 'switch',
        },
      ]);
      setScreen('playing');
    },
    [seedInput, buildConfig],
  );

  const startChallenge = useCallback(
    (challengeId: string) => {
      const challenge = challengeById(challengeId);
      if (!challenge) return;
      startRun(challenge.seedCode, challenge, 'challenge');
    },
    [startRun],
  );

  const startDaily = useCallback(() => {
    const status = dailyStatus(meta);
    startRun(status.seedCode, null, 'daily', status.date);
  }, [meta, startRun]);

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
    if (!paused) return;
    laneStepRef.current = 0;
    jumpRef.current = false;
    slideRef.current = false;
  }, [paused]);

  // Leaving the game is a pause, never an invitation to spend a life offscreen.
  useEffect(() => {
    if (screen !== 'playing') return;
    const pauseAway = () => {
      laneStepRef.current = 0;
      jumpRef.current = false;
      slideRef.current = false;
      setActiveKeys({ left: false, right: false, up: false, down: false });
      setPaused(true);
    };
    const onVisibility = () => {
      if (document.hidden) pauseAway();
    };
    window.addEventListener('blur', pauseAway);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', pauseAway);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing') return;
    const down = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button') && (e.code === 'Space' || e.code === 'Enter')) return;
      if (e.metaKey || e.ctrlKey || e.altKey || target?.isContentEditable ||
          (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        if (!e.repeat) setPaused((p) => !p);
        return;
      }
      if (paused) return;
      if (e.repeat) return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        laneStepRef.current = -1;
        setActiveKeys((k) => ({ ...k, left: true }));
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        laneStepRef.current = 1;
        setActiveKeys((k) => ({ ...k, right: true }));
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        jumpRef.current = true;
        setActiveKeys((k) => ({ ...k, up: true }));
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        slideRef.current = true;
        setActiveKeys((k) => ({ ...k, down: true }));
      }
    };
    const up = (e: KeyboardEvent): void => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        setActiveKeys((k) => ({ ...k, left: false }));
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        setActiveKeys((k) => ({ ...k, right: false }));
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        setActiveKeys((k) => ({ ...k, up: false }));
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        setActiveKeys((k) => ({ ...k, down: false }));
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [screen, paused]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (paused) return;
    touchStart.current = { x: e.clientX, y: e.clientY };
  }, [paused]);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || paused) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const THRESH = 28;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > THRESH) {
      laneStepRef.current = dx > 0 ? 1 : -1;
    } else if (Math.abs(dy) > THRESH) {
      if (dy < 0) jumpRef.current = true;
      else slideRef.current = true;
    }
  }, [paused]);

  // Juice: compare snapshots after HUD updates.
  const applyJuice = useCallback((prev: typeof juiceSnap.current, next: RunState) => {
    const fx = fxRef.current;
    const px = laneCenterX(next.lane);
    const py = PLAYER_Y;
    const resolvedObs = next.activeBranch
      ? next.activeBranch.obstacles.filter((o) => o.resolved).length
      : 0;

    if (!prev) {
      juiceSnap.current = {
        hits: next.hitsTotal,
        branches: next.branchesCleared,
        streak: next.noHitStreak,
        scoreMult: next.scoreMult,
        buffer: next.buffer,
        active: Boolean(next.activeBranch),
        resolvedObs,
      };
      return;
    }

    if (next.hitsTotal > prev.hits) {
      triggerHit(fx, px, py);
      playError();
      haptic('impact');
      addLog(
        `障礙擦撞制動！速度衰減至 ${Math.round(next.playerSpeed)} km/h`,
        'hazard',
        next.elapsed,
      );
    }
    if (next.branchesCleared > prev.branches) {
      playScore();
      haptic('success', 0.7);
    }
    if (!prev.active && next.activeBranch) {
      triggerSwitch(fx, px, py - 40, '#34d399');
      playMove();
      haptic('place', 0.85);
      const glyph =
        next.activeBranch.speedMult > 1.05
          ? '加速 ▲'
          : next.activeBranch.speedMult < 0.95
            ? '減速 ▼'
            : '維持 ▬';
      addLog(
        `道岔鎖定：進入 ${next.activeBranch.lane + 1} 股道・${next.activeBranch.name} (${glyph})`,
        'switch',
        next.elapsed,
      );
    }
    if (next.scoreMult > prev.scoreMult) {
      triggerPickup(fx, px, py - 20, 'score');
      playScore();
      haptic('success', 0.55);
      addLog(
        `路線評價提升！倍率升至 ×${next.scoreMult.toFixed(2)}`,
        'score',
        next.elapsed,
      );
    }
    if (next.buffer > prev.buffer + 20 && next.hitsTotal === prev.hits) {
      // Supply pickup (buffer jump without a hit).
      triggerPickup(fx, px, py - 20, 'supply');
      playScore();
      haptic('tap', 0.6);
      addLog('捕獲緊急物資節點！緩衝大幅回復 (+20%)', 'supply', next.elapsed);
    }
    if (resolvedObs > prev.resolvedObs && next.hitsTotal === prev.hits) {
      triggerNearMiss(fx, px, py);
      haptic('tap', 0.5);
    }
    if (next.noHitStreak > prev.streak && next.noHitStreak >= 2) {
      triggerCombo(fx, next.noHitStreak);
      setComboFlash(next.noHitStreak);
      playCombo(next.noHitStreak);
      haptic('combo', Math.min(1.2, 0.45 + next.noHitStreak * 0.08));
      addLog(`連續零擦撞達成 ×${next.noHitStreak}！`, 'combo', next.elapsed);
    }

    juiceSnap.current = {
      hits: next.hitsTotal,
      branches: next.branchesCleared,
      streak: next.noHitStreak,
      scoreMult: next.scoreMult,
      buffer: next.buffer,
      active: Boolean(next.activeBranch),
      resolvedObs,
    };
  }, [addLog]);

  useEffect(() => {
    if (screen !== 'playing') return;

    let hudClock = 0;
    const frame = (now: number): void => {
      rafRef.current = requestAnimationFrame(frame);
      const s = stateRef.current;
      if (!s) return;

      const dtReal = Math.min(0.25, (now - lastRef.current) / 1000);
      lastRef.current = now;
      if (paused || challengeWon || s.phase !== 'playing') return;

      // Hit-stop: hold the simulation briefly on hits (respects reduced motion).
      if (fxRef.current.hitStop > 0 && !prefersReducedMotion()) {
        return;
      }

      accRef.current += dtReal;
      let next = s;
      let budget = 8;
      let justCleared = false;
      while (accRef.current >= FIXED_DT && budget-- > 0) {
        accRef.current -= FIXED_DT;
        const before = next;
        next = step(next, readInput(), FIXED_DT);
        applyJuice(
          {
            hits: before.hitsTotal,
            branches: before.branchesCleared,
            streak: before.noHitStreak,
            scoreMult: before.scoreMult,
            buffer: before.buffer,
            active: Boolean(before.activeBranch),
            resolvedObs: before.activeBranch
              ? before.activeBranch.obstacles.filter((o) => o.resolved).length
              : 0,
          },
          next,
        );
        if (next.phase !== 'playing') break;
        const challenge = activeChallengeRef.current;
        if (challenge && isChallengeCleared(challenge, next)) {
          justCleared = true;
          setChallengeWon(true);
          applyChallengeEnd(next, challenge);
          break;
        }
      }
      stateRef.current = next;

      hudClock += dtReal;
      if (hudClock > 0.08 || next.phase !== 'playing' || justCleared) {
        hudClock = 0;
        setHud(next);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, paused, challengeWon, readInput, applyChallengeEnd, applyJuice]);

  // Settle meta once a run ends.
  useEffect(() => {
    if (!hud) return;
    const ended = hud.phase === 'caught' || challengeWon;
    if (!ended) return;
    settleIfNeeded(hud, runModeRef.current, dailyDateRef.current);
  }, [hud, challengeWon, settleIfNeeded]);

  useEffect(() => {
    if (!hud || hud.phase !== 'caught' || challengeWon) return;
    const challenge = activeChallengeRef.current;
    if (!challenge) return;
    applyChallengeEnd(hud, challenge);
  }, [hud, challengeWon, applyChallengeEnd]);

  const endSfxKey = useRef<string | null>(null);
  useEffect(() => {
    if (!hud) {
      endSfxKey.current = null;
      return;
    }
    if (challengeWon) {
      const key = `win:${hud.seedCode}:${Math.round(hud.distance)}`;
      if (endSfxKey.current === key) return;
      endSfxKey.current = key;
      playWin();
      haptic('win');
      return;
    }
    if (hud.phase !== 'caught') {
      endSfxKey.current = null;
      return;
    }
    const key = `${hud.seedCode}:${Math.round(hud.distance)}:${finalScore(hud)}`;
    if (endSfxKey.current === key) return;
    endSfxKey.current = key;
    playLose();
    haptic('error');
  }, [hud, challengeWon]);

  // Lane-change move SFX (not covered by applyJuice when no branch lock).
  const laneSnap = useRef<number | null>(null);
  useEffect(() => {
    if (!hud || hud.phase !== 'playing' || challengeWon) {
      laneSnap.current = null;
      return;
    }
    if (laneSnap.current === null) {
      laneSnap.current = hud.lane;
      return;
    }
    if (hud.lane !== laneSnap.current) {
      laneSnap.current = hud.lane;
      playMove();
    }
  }, [hud, challengeWon]);

  useEffect(() => {
    if (comboFlash <= 0) return;
    const t = window.setTimeout(() => setComboFlash(0), prefersReducedMotion() ? 400 : 700);
    return () => window.clearTimeout(t);
  }, [comboFlash]);

  const packTotal = challengeCount();
  const packContinue = continueChallengeIndex(challengeProgress.clearedCount);
  const packSubtitle =
    challengeProgress.clearedCount >= packTotal
      ? `已完成 ${packTotal}/${packTotal}`
      : challengeProgress.clearedCount > 0
        ? `進度 ${challengeProgress.clearedCount}/${packTotal}・繼續`
        : `挑戰種子包・${packTotal} 關`;

  const daily = dailyStatus(meta);
  const bestDistance = meta.free.bestDistance;
  const bestScore = meta.free.bestScore;
  const selectedRunner =
    RUNNERS.find((r) => r.id === meta.selectedRunnerId) ?? RUNNERS[0];
  const selectedTheme =
    THEMES.find((t) => t.id === meta.selectedThemeId) ?? THEMES[0];

  if (screen === 'menu') {
    return (
      <div
        className="sr-title-shell min-h-screen flex flex-col items-center justify-start gap-4 p-4 sm:p-6 text-center overflow-y-auto"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(5, 9, 10, 0.65), rgba(5, 9, 10, 0.94))',
            `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
          ].join(', '),
        }}
      >
        <BackToMenu />

        {/* Dispatch Operations Center Header */}
        <header className="sr-title-hero w-full max-w-3xl mt-12 sm:mt-8">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-mono tracking-widest text-emerald-300 uppercase">
                中央鐵道調度所 · 即時運轉監控中心
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">DISPATCH-HQ</span>
          </div>

          <h1 className="sr-display sr-glow-title text-3xl sm:text-5xl font-black tracking-wider text-emerald-200">
            岔道疾走
          </h1>
          <p className="mt-1 text-slate-400 text-xs sm:text-sm font-sans tracking-wide">
            SWITCHPOINT RUN · 鐵道路線抉擇與追越逃逸系統
          </p>
          <div className="mt-3 flex justify-center">
            <span className="text-xs text-emerald-300/90 font-medium bg-emerald-950/60 border border-emerald-500/30 rounded-full py-1 px-4 shadow-[0_0_12px_rgba(52,211,153,0.15)]">
              「距離不是靠跑，是靠選對路線。」
            </span>
          </div>
        </header>

        {/* Fleet & Resource Telemetry Bar */}
        <div className="sr-panel rounded-2xl px-5 py-3.5 w-full max-w-3xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 sm:gap-6">
            <div>
              <span className="text-slate-400 text-[10px] block">儲備鐵道螺栓</span>
              <span className="font-mono font-bold text-amber-300 text-base">
                {meta.bolts.toLocaleString('zh-Hant')}{' '}
                <span className="text-xs text-amber-400/80">螺栓</span>
              </span>
            </div>
            <div className="border-l border-white/10 pl-4 sm:pl-6">
              <span className="text-slate-400 text-[10px] block">自由最佳紀錄</span>
              <span className="font-mono text-slate-200">
                {bestDistance > 0 || bestScore > 0 ? (
                  <>
                    <b className="text-emerald-400">{bestDistance.toLocaleString('zh-Hant')}m</b>
                    {' / '}
                    <b className="text-sky-300">{bestScore.toLocaleString('zh-Hant')}分</b>
                  </>
                ) : (
                  '尚未發車'
                )}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
              車輛：{selectedRunner.name}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[11px] font-semibold">
              主題：{selectedTheme.name}
            </span>
            {meta.equippedModifiers.length > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-semibold">
                修飾：{meta.equippedModifiers.length} 項作用中
              </span>
            )}
          </div>
        </div>

        {/* Main Command Mode Cards (2x2 grid) */}
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-3.5 text-left">
          {/* Card 1: Free Dispatch Run */}
          <div className="sr-panel rounded-2xl p-4 flex flex-col justify-between border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-slate-900/60 to-slate-950/80">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  自由特快調度
                </span>
                <span className="text-[10px] font-mono text-slate-400">FREE RUN</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                全線開放無盡跑道，自由選擇道岔避開追越列車，賺取鐵道螺栓與刷新個人紀錄。
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                  placeholder="自訂種子（留空隨機）"
                  maxLength={8}
                  className="min-h-[40px] flex-1 rounded-xl border border-white/15 bg-slate-900/80 px-3 text-center text-xs tracking-widest text-slate-100 uppercase placeholder:text-slate-500 placeholder:normal-case font-mono"
                />
                <button
                  type="button"
                  onClick={() => setSeedInput(randomSeedCode())}
                  className="px-3 rounded-xl border border-white/15 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700"
                  title="產生隨機種子碼"
                >
                  隨機
                </button>
              </div>
              <button
                type="button"
                onClick={() => startRun()}
                className="sr-cta min-h-[44px] w-full rounded-xl font-bold text-white text-sm tracking-wide shadow-lg shadow-emerald-950/50"
              >
                扳道出發・開始調度
              </button>
            </div>
          </div>

          {/* Card 2: Daily Mission */}
          <div className="sr-panel rounded-2xl p-4 flex flex-col justify-between border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-slate-900/60 to-slate-950/80">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                  今日官方排程
                </span>
                <span className="text-[10px] font-mono text-amber-400/90">{daily.seedCode}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                由全球統一曆日種子生成，所有調度員同一賽道競技，當日最佳紀錄獨立結算保存。
              </p>
              <div className="mt-2 text-[11px] text-amber-200/90 bg-amber-950/40 border border-amber-500/20 rounded-lg p-2 font-mono">
                {daily.best ? (
                  <>
                    今日最佳：{daily.best.bestDistance.toLocaleString('zh-Hant')}m · {daily.best.bestScore.toLocaleString('zh-Hant')}分
                  </>
                ) : (
                  '今日尚無調度紀錄，等待你的首航！'
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={startDaily}
                className="min-h-[44px] w-full rounded-xl border border-amber-500/60 bg-amber-500/20 font-bold text-amber-200 text-sm hover:bg-amber-500/30 transition-colors shadow-lg shadow-amber-950/40"
              >
                挑戰今日排程・發車
              </button>
            </div>
          </div>

          {/* Card 3: Challenge Seed Pack */}
          <div className="sr-panel rounded-2xl p-4 flex flex-col justify-between border-sky-500/30 bg-gradient-to-br from-sky-950/20 via-slate-900/60 to-slate-950/80">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-sky-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_6px_#38bdf8]" />
                  調度員檢定包
                </span>
                <span className="text-[10px] font-mono text-sky-400">
                  {challengeProgress.clearedCount}/{packTotal} 關
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                固定種子的高難度檢定關卡，達成目標距離或分數即可通關解鎖下一關。
              </p>
              <div className="mt-2 text-[11px] text-sky-200/90 bg-sky-950/40 border border-sky-500/20 rounded-lg p-2">
                進度：{packSubtitle}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowChallenges(true)}
                className="min-h-[44px] w-full rounded-xl border border-sky-500/60 bg-sky-500/20 font-bold text-sky-200 text-sm hover:bg-sky-500/30 transition-colors shadow-lg shadow-sky-950/40"
              >
                檢視關卡包與出發
              </button>
            </div>
          </div>

          {/* Card 4: Fleet Garage */}
          <div className="sr-panel rounded-2xl p-4 flex flex-col justify-between border-slate-700/60 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-950/80">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  調度車庫與改裝整備
                </span>
                <span className="text-[10px] font-mono text-slate-400">GARAGE</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                以鐵道螺栓解鎖 4 款扳道車特性、4 款路線主題環境與特殊里程碑修飾規則。
              </p>
              <div className="mt-2 text-[11px] text-slate-300 bg-slate-950/50 border border-white/10 rounded-lg p-2 flex justify-between">
                <span>配屬：{selectedRunner.name}</span>
                <span className="text-amber-300">餘額：{meta.bolts} 螺栓</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowGarage(true)}
                className="min-h-[44px] w-full rounded-xl border border-white/20 bg-slate-800/80 font-bold text-slate-100 text-sm hover:bg-slate-750 transition-colors"
              >
                開啟車庫整備面板
              </button>
            </div>
          </div>
        </div>

        {/* Operational Heuristics & Control Protocol */}
        <div className="sr-panel rounded-2xl p-5 w-full max-w-3xl text-left text-xs leading-relaxed text-slate-300 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <span className="text-emerald-400">❖</span>
              調度運轉規範與核心法則
            </span>
            <span className="text-[10px] font-mono text-slate-500">OPERATIONAL RULES</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-900/60 rounded-xl p-3 border border-white/5 space-y-1">
              <span className="font-bold text-emerald-300 block text-xs">① 預覽抉擇</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                前方道岔支線提前於雷達與上方簡圖預告。速度、障礙密度、補給一目瞭然，永遠在已知資訊下決策。
              </p>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3 border border-white/5 space-y-1">
              <span className="font-bold text-amber-300 block text-xs">② 代價守則</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                沒有一條支線是全面最優的！加速與收益必須由密集障礙支付，安全支線速度必定衰減。
              </p>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3 border border-white/5 space-y-1">
              <span className="font-bold text-sky-300 block text-xs">③ 追越防線</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                撞擊障礙不會立即出局，而是大幅降速讓後方列車逼近。緩衝歸零才會被追及結束。
              </p>
            </div>
          </div>

          {/* Interactive Keymap Display */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-200 font-semibold">電競控制盤：</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 font-mono">A</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 font-mono">D</kbd> 或 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 font-mono">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 font-mono">→</kbd> 換股道</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 font-mono">W</kbd> 或 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 font-mono">↑</kbd> 跳躍</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 font-mono">S</kbd> 或 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 font-mono">↓</kbd> 鏟滑</span>
              <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 font-mono">P</kbd> 暫停</span>
            </div>
            <span className="text-[11px] text-slate-500">觸控：支援手勢滑動與螢幕虛擬按鈕</span>
          </div>

          <div className="pt-2">
            <JuiceSettingsPanel compact />
          </div>
        </div>

        {showGarage && (
          <GaragePanel
            meta={meta}
            onClose={() => setShowGarage(false)}
            onSelectRunner={(id: RunnerId) => {
              const next = selectRunner(meta, id);
              if (next) {
                setMeta(next);
                playMove();
              }
            }}
            onBuyRunner={(id: RunnerId) => {
              const next = buyRunner(meta, id);
              if (next) {
                setMeta(next);
                playWin();
              } else playError();
            }}
            onSelectTheme={(id: ThemeId) => {
              const next = selectTheme(meta, id);
              if (next) {
                setMeta(next);
                playMove();
              }
            }}
            onBuyTheme={(id: ThemeId) => {
              const next = buyTheme(meta, id);
              if (next) {
                setMeta(next);
                playWin();
              } else playError();
            }}
            onToggleModifier={(id: ModifierId) => {
              const next = toggleModifier(meta, id);
              if (next) {
                setMeta(next);
                playMove();
              }
            }}
          />
        )}

        {showChallenges && (
          <div
            className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/75 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sr-challenge-title"
            onClick={() => setShowChallenges(false)}
          >
            <div
              className="sr-panel flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl p-4 text-left"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="sr-challenge-title" className="text-xl font-black text-emerald-300">
                    挑戰種子包
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    固定種子・達成距離／分數門檻才算通關・進度獨立於自由遊玩
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChallenges(false)}
                  className="min-h-[40px] shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-bold text-slate-200"
                >
                  關閉
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const challenge = RUN_CHALLENGES[packContinue];
                  if (!challenge) return;
                  setShowChallenges(false);
                  startChallenge(challenge.id);
                }}
                className="mt-4 min-h-[44px] w-full rounded-xl bg-sky-500 px-4 text-sm font-black text-slate-950"
              >
                {challengeProgress.clearedCount >= packTotal
                  ? '重玩最終關'
                  : challengeProgress.clearedCount > 0
                    ? `繼續・${RUN_CHALLENGES[packContinue]?.name}`
                    : '開始第一關'}
              </button>

              <ul className="mt-4 space-y-2 overflow-y-auto pr-1">
                {RUN_CHALLENGES.map((challenge, index) => {
                  const unlocked = isChallengeUnlocked(index, challengeProgress.clearedCount);
                  const done = Boolean(challengeProgress.cleared[challenge.id]);
                  const best = challengeProgress.bestMetric[challenge.id];
                  return (
                    <li key={challenge.id}>
                      <button
                        type="button"
                        disabled={!unlocked}
                        onClick={() => {
                          if (!unlocked) return;
                          setShowChallenges(false);
                          startChallenge(challenge.id);
                        }}
                        className="flex min-h-16 w-full flex-col rounded-xl border border-white/10 bg-slate-900/50 px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
                        style={
                          done
                            ? {
                                borderColor: 'rgba(56,189,248,0.55)',
                                background: 'rgba(12,74,110,0.28)',
                              }
                            : undefined
                        }
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-100">
                            <span className="mr-2 font-mono text-[11px] text-slate-500">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            {unlocked ? challenge.name : '？？？'}
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                            {!unlocked ? '未解鎖' : done ? '已通關' : '挑戰'}
                          </span>
                        </span>
                        {unlocked && (
                          <>
                            <span className="mt-1 text-[11px] leading-snug text-slate-400">
                              {challenge.blurb}
                            </span>
                            <span className="mt-1 text-[11px] text-sky-200/90">
                              目標：{challenge.goalLabel}
                              <span className="ml-2 font-mono text-slate-500">
                                {challenge.seedCode}
                              </span>
                            </span>
                            {best !== undefined && (
                              <span className="mt-1 font-mono text-[10px] text-amber-300/80">
                                最佳{' '}
                                {challenge.goal.kind === 'distance' ? '距離' : '分數'}{' '}
                                {best.toLocaleString('zh-Hant')}
                              </span>
                            )}
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
  const ended = s?.phase === 'caught' || challengeWon;
  const maxBuf = s?.maxBuffer ?? 430;
  const bufferPct = s ? Math.max(0, Math.min(100, (s.buffer / maxBuf) * 100)) : 0;
  const isEmergency = bufferPct < 22;
  const bufferTone =
    bufferPct < 22 ? 'text-red-400' : bufferPct < 50 ? 'text-amber-300' : 'text-emerald-400';
  const bufferFill =
    bufferPct < 22 ? '#f87171' : bufferPct < 50 ? '#fbbf24' : '#34d399';

  const modeLabel =
    runMode === 'daily' ? '每日挑戰' : runMode === 'challenge' ? '挑戰包' : '自由遊玩';
  const estBolts = s ? boltsFromRun(s, runMode) : 0;

  return (
    <div
      className={`h-screen w-screen flex flex-col bg-slate-950 overflow-hidden ${
        isEmergency ? 'sr-alarm-border' : ''
      }${fxRef.current.shake > 4 ? ' sr-shake-hard' : fxRef.current.shake > 1.5 ? ' sr-shake' : ''}`}
    >
      <BackToMenu />

      {/* Top HUD Command Strip */}
      <div className="sr-hud shrink-0 px-3 pt-12 pb-2 flex items-center justify-between text-xs sm:text-sm text-slate-300">
        <div className="flex gap-2 flex-wrap items-center">
          <span className="sr-hud-chip">
            距離{' '}
            <b className="text-slate-100 tabular-nums">{Math.round(s?.distance ?? 0)}m</b>
          </span>
          <span className="sr-hud-chip">
            分數 <b className="text-emerald-300 tabular-nums">{s ? finalScore(s) : 0}</b>
          </span>
          <span className="sr-hud-chip text-slate-400">{modeLabel}</span>
          {activeChallenge && (
            <span className="sr-hud-chip text-sky-200">
              {activeChallenge.name}
              <span className="ml-1 text-slate-400">{activeChallenge.goalLabel}</span>
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end items-center">
          <span className="sr-hud-chip">
            倍率 <b className="text-amber-300">×{(s?.scoreMult ?? 1).toFixed(2)}</b>
          </span>
          <span className={`sr-hud-chip${comboFlash > 0 ? ' sr-combo-pop' : ''}`}>
            連擊 <b className="text-sky-300 tabular-nums">{s?.noHitStreak ?? 0}</b>
          </span>
          <span className="sr-hud-chip hidden sm:inline-flex text-amber-300 font-mono">
            +{estBolts} 螺栓
          </span>
        </div>
      </div>

      {/* Top Buffer Indicator Bar */}
      <div className="shrink-0 px-3 pb-1.5 bg-slate-950/70">
        <div className="mb-0.5 flex justify-between text-[10px] text-slate-400">
          <span className="font-semibold">後方列車追越緩衝</span>
          <span className={bufferTone}>{Math.round(bufferPct)}%</span>
        </div>
        <div className="sr-buffer">
          <div
            className="sr-buffer-fill"
            style={{ width: `${bufferPct}%`, background: bufferFill, color: bufferFill }}
          />
        </div>
      </div>

      {/* Mobile Tactical Ribbon (< lg) */}
      <MobileTacticalRibbon
        state={hud}
        onOpenDrawer={() => setShowMobileDrawer(true)}
      />

      {/* Main Center Area: Left Wing + Center Track + Right Wing */}
      <div className="flex-1 flex min-h-0 min-w-0 justify-center items-stretch relative overflow-hidden">
        {/* Left Wing (Cockpit Radar & Upcoming Branches) */}
        <DispatchLeftWing state={hud} />

        {/* Central Track Canvas Container */}
        <div
          className="flex-1 max-w-[500px] h-full relative flex items-center justify-center bg-slate-950/60"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { touchStart.current = null; }}
        >
          <GameCanvas stateRef={stateRef} fxRef={fxRef} paused={paused || challengeWon} />

          {comboFlash >= 2 && (
            <div className="sr-combo-banner pointer-events-none absolute left-1/2 top-8 -translate-x-1/2">
              連擊 ×{comboFlash}
            </div>
          )}

          {/* Virtual On-Screen Controls for Mobile */}
          <MobileControlsOverlay
            onLaneStep={(step) => {
              laneStepRef.current = step;
            }}
            onJump={() => {
              jumpRef.current = true;
            }}
            onSlide={() => {
              slideRef.current = true;
            }}
            visible={showMobileControls}
            onToggleVisible={() => setShowMobileControls((v) => !v)}
          />

          {paused && !ended && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-30">
              <div className="sr-panel rounded-2xl px-6 py-4 text-center">
                <p className="text-lg font-semibold mb-1 text-slate-100">調度運轉暫停</p>
                <p className="text-slate-400 text-sm">按 P 或 Esc 繼續</p>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setPaused(false)}
                  className="mt-4 rounded-xl border border-cyan-400/60 bg-slate-900 px-6 py-3 text-base font-bold text-cyan-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
                >
                  繼續遊戲
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Wing (Blackbox Flight Recorder & Multiplier Matrix) */}
        <DispatchRightWing
          state={hud}
          logs={blackboxLogs}
          activeKeys={activeKeys}
          estimatedBolts={estBolts}
        />
      </div>

      {/* Mobile Drawer */}
      {showMobileDrawer && (
        <DispatchDrawer
          state={hud}
          logs={blackboxLogs}
          onClose={() => setShowMobileDrawer(false)}
        />
      )}

      {ended && s && challengeWon && activeChallenge && (
        <ResultOverlay
          title="挑戰成功"
          subtitle={`${activeChallenge.name}・${activeChallenge.goalLabel}`}
          variant="win"
          badge="通關"
          stats={[
            { label: '距離', value: Math.round(s.distance).toLocaleString('zh-Hant') },
            { label: '分數', value: finalScore(s).toLocaleString('zh-Hant') },
            { label: '目標', value: activeChallenge.goalLabel },
            {
              label: '本次',
              value: challengeMetric(activeChallenge, s).toLocaleString('zh-Hant'),
            },
            { label: '鐵道螺栓', value: `+${lastBolts}` },
            { label: '種子碼', value: s.seedCode },
          ]}
          primaryLabel="再試一次"
          onPrimary={() => startRun(activeChallenge.seedCode, activeChallenge, 'challenge')}
          secondaryLabel="回選單"
          onSecondary={() => {
            setActiveChallenge(null);
            activeChallengeRef.current = null;
            setScreen('menu');
          }}
        />
      )}

      {ended && s && !challengeWon && (
        <ResultOverlay
          title={
            activeChallenge
              ? '挑戰未過'
              : runMode === 'daily'
                ? '今日挑戰結束'
                : '被列車追上'
          }
          subtitle={
            activeChallenge
              ? `${activeChallenge.name}・目標 ${activeChallenge.goalLabel}`
              : runMode === 'daily'
                ? `今日種子 ${s.seedCode}・${todayKey()}`
                : `跑了 ${Math.round(s.distance)} 距離，選了 ${s.branchesCleared} 次岔道。`
          }
          variant="lose"
          badge={lastNewBest ? '新紀錄' : undefined}
          stats={[
            { label: '距離', value: Math.round(s.distance).toLocaleString('zh-Hant') },
            { label: '分數', value: finalScore(s).toLocaleString('zh-Hant') },
            { label: '路線評價', value: s.routeScore },
            { label: '評分倍率', value: `×${s.scoreMult.toFixed(2)}` },
            { label: '撞擊次數', value: s.hitsTotal },
            { label: '最長連擊', value: s.maxNoHitStreak },
            { label: '鐵道螺栓', value: `+${lastBolts}` },
            { label: '種子碼', value: s.seedCode },
          ]}
          primaryLabel={
            activeChallenge ? '再試一次' : runMode === 'daily' ? '再挑戰今日' : '再跑一次'
          }
          onPrimary={() => {
            if (activeChallenge) startRun(activeChallenge.seedCode, activeChallenge, 'challenge');
            else if (runMode === 'daily') startRun(s.seedCode, null, 'daily', dailyDate);
            else startRun(s.seedCode, null, 'free');
          }}
          secondaryLabel="回選單"
          onSecondary={() => {
            setActiveChallenge(null);
            activeChallengeRef.current = null;
            setScreen('menu');
          }}
        />
      )}
    </div>
  );
}
