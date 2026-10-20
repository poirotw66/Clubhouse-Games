import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import {
  playCombo,
  playError,
  playLose,
  playMove,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';
import { GameCanvas } from './components/GameCanvas';
import { GaragePanel } from './components/GaragePanel';
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
import { type RunnerId } from './game/profiles';
import { randomSeedCode } from './game/rng';
import { type ThemeId } from './game/themes';
import type { PlayerInput, RunConfig, RunState } from './game/types';

type Screen = 'menu' | 'playing';

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
    }
    if (next.branchesCleared > prev.branches) {
      playScore();
    }
    if (!prev.active && next.activeBranch) {
      triggerSwitch(fx, px, py - 40, '#34d399');
      playMove();
    }
    if (next.scoreMult > prev.scoreMult) {
      triggerPickup(fx, px, py - 20, 'score');
      playScore();
    }
    if (next.buffer > prev.buffer + 20 && next.hitsTotal === prev.hits) {
      // Supply pickup (buffer jump without a hit).
      triggerPickup(fx, px, py - 20, 'supply');
      playScore();
    }
    if (resolvedObs > prev.resolvedObs && next.hitsTotal === prev.hits) {
      triggerNearMiss(fx, px, py);
    }
    if (next.noHitStreak > prev.streak && next.noHitStreak >= 2) {
      triggerCombo(fx, next.noHitStreak);
      setComboFlash(next.noHitStreak);
      playCombo(next.noHitStreak);
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
  }, []);

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

  if (screen === 'menu') {
    return (
      <div
        className="sr-title-shell min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center"
        style={{
          backgroundImage: [
            'linear-gradient(rgba(5, 9, 10, 0.55), rgba(5, 9, 10, 0.92))',
            `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
          ].join(', '),
        }}
      >
        <BackToMenu />
        <header className="sr-title-hero">
          <h1 className="sr-display sr-glow-title text-4xl font-extrabold tracking-wide text-emerald-200">
            岔道疾走
          </h1>
          <p className="mt-2 text-slate-400 text-sm">Switchpoint Run</p>
        </header>
        <div className="sr-panel rounded-2xl p-5 max-w-md text-left text-sm leading-relaxed text-slate-300">
          <p className="mb-3 text-slate-200 font-semibold">距離不是靠跑，是靠選對路線。</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              每個道岔的支線內容都<b>提前預覽</b>：速度、障礙密度、有無補給一目瞭然。
            </li>
            <li>
              <b>沒有一條支線是全面最優</b>——速度與收益都要用密度（更多障礙）來換。
            </li>
            <li>撞到障礙不會立即結束，而是大幅降速，讓後方列車更接近。</li>
            <li>← → 換股道／扳道，↑ 跳過低欄，↓ 滑過高架，P／Esc 暫停。</li>
            <li>觸控：左右滑動換道、上滑跳躍、下滑滑行。</li>
          </ul>
        </div>
        <p className="text-slate-400 text-sm">
          鐵道螺栓 <b className="text-amber-300">{meta.bolts.toLocaleString('zh-Hant')}</b>
          {(bestDistance > 0 || bestScore > 0) && (
            <>
              {' '}
              ・ 最佳距離 {bestDistance.toLocaleString('zh-Hant')} ・ 最佳分數{' '}
              {bestScore.toLocaleString('zh-Hant')}
            </>
          )}
        </p>
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
            className="sr-cta min-h-[44px] px-8 py-3 rounded-xl font-semibold text-white"
          >
            扳道出發
          </button>
          <button
            type="button"
            onClick={startDaily}
            className="min-h-[44px] px-8 py-3 rounded-xl border border-amber-500/50 bg-amber-500/15 font-semibold text-amber-100"
            aria-label={`今日挑戰種子 ${daily.seedCode}`}
          >
            今日挑戰
          </button>
          <p className="text-[11px] text-slate-500">
            種子 {daily.seedCode}
            {daily.best
              ? `・今日最佳 ${daily.best.bestDistance.toLocaleString('zh-Hant')} / ${daily.best.bestScore.toLocaleString('zh-Hant')}`
              : '・尚無今日紀錄'}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setShowGarage(true)}
              className="min-h-[44px] px-6 py-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-100"
            >
              車庫與解鎖
            </button>
            <button
              type="button"
              onClick={() => setShowChallenges(true)}
              className="min-h-[44px] px-6 py-3 rounded-xl border border-sky-500/50 bg-sky-500/15 font-semibold text-sky-100"
              aria-label={`開啟挑戰種子包。${packSubtitle}`}
            >
              挑戰種子包
            </button>
          </div>
          <p className="text-[11px] text-slate-500">{packSubtitle}</p>
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
  const bufferTone =
    bufferPct < 22 ? 'text-red-400' : bufferPct < 50 ? 'text-amber-300' : 'text-emerald-400';
  const bufferFill =
    bufferPct < 22 ? '#f87171' : bufferPct < 50 ? '#fbbf24' : '#34d399';

  const modeLabel =
    runMode === 'daily' ? '每日挑戰' : runMode === 'challenge' ? '挑戰包' : '自由遊玩';

  return (
    <div
      className={`h-screen w-screen flex flex-col${fxRef.current.shake > 4 ? ' sr-shake-hard' : fxRef.current.shake > 1.5 ? ' sr-shake' : ''}`}
    >
      <BackToMenu />

      <div className="sr-hud shrink-0 px-3 pt-14 pb-2 flex items-center justify-between text-xs sm:text-sm text-slate-300">
        <div className="flex gap-2 flex-wrap">
          <span className="sr-hud-chip">
            距離{' '}
            <b className="text-slate-100 tabular-nums">{Math.round(s?.distance ?? 0)}</b>
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
        <div className="flex gap-2 flex-wrap justify-end">
          <span className="sr-hud-chip">
            倍率 <b className="text-amber-300">×{(s?.scoreMult ?? 1).toFixed(2)}</b>
          </span>
          <span className={`sr-hud-chip${comboFlash > 0 ? ' sr-combo-pop' : ''}`}>
            連擊 <b className="text-sky-300 tabular-nums">{s?.noHitStreak ?? 0}</b>
          </span>
        </div>
      </div>

      <div className="shrink-0 px-3 pb-2">
        <div className="mb-1 flex justify-between text-[10px] text-slate-500">
          <span>與列車間距</span>
          <span className={bufferTone}>{Math.round(bufferPct)}%</span>
        </div>
        <div className="sr-buffer">
          <div
            className="sr-buffer-fill"
            style={{ width: `${bufferPct}%`, background: bufferFill, color: bufferFill }}
          />
        </div>
      </div>

      <div
        className="flex-1 min-h-0 relative"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <GameCanvas stateRef={stateRef} fxRef={fxRef} paused={paused || challengeWon} />

        {comboFlash >= 2 && (
          <div className="sr-combo-banner pointer-events-none absolute left-1/2 top-8 -translate-x-1/2">
            連擊 ×{comboFlash}
          </div>
        )}

        {paused && !ended && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="sr-panel rounded-2xl px-6 py-4 text-center">
              <p className="text-lg font-semibold mb-1">暫停</p>
              <p className="text-slate-400 text-sm">按 P 或 Esc 繼續</p>
            </div>
          </div>
        )}
      </div>

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
