import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  PlayerStance,
  EnemyState,
  CounterResult,
  GameStats,
  ProjectileType,
  PlayMode,
  ReactionRecord,
  emptyStats,
} from '../types';
import {
  DURATION_SHURIKEN,
  DURATION_KUNAI,
  DURATION_BOMB,
  DURATION_SICKLE,
  HIT_STOP_DURATION,
  DAMAGE_PLAYER_HIT,
  DAMAGE_PLAYER_BLOCK,
  DAMAGE_EARLY,
  DAMAGE_FEINT,
  DAMAGE_WRONG_SIDE,
  DAMAGE_ENEMY_PERFECT,
  DAMAGE_ENEMY_GOOD,
  HEAL_PERFECT,
  SCORE_PERFECT,
  SCORE_GOOD,
  SCORE_FEINT_PATIENCE,
  MAX_HP,
  FEINT_VANISH_AT,
  VERSUS_POINTS_TO_WIN,
  INTENSITY_LABELS,
  SIDE_LABELS,
  getTimingWindows,
  getAttackDelayRange,
  getProjectileDurationScale,
  type PracticeIntensity,
  type PracticeScenario,
} from '../constants';
import {
  createPatternState,
  nextAttackEvent,
  nextEndlessEvent,
  noteEventResolved,
  type AttackEvent,
  type ParrySide,
  type PatternState,
} from '../patterns';
import type { OpponentDef } from '../opponents';
import { resolveCounter } from '../resolveCounter';
import { computeReactionRank } from '../ranks';
import { createRng } from '../rng';
import { loadBest, loadLadder } from '../storage';
import { computeDanRankStatus } from '../danRank';
import { ZenFlowWaveform } from './ZenFlowWaveform';
import { ReactionSpectrumRadar } from './ReactionSpectrumRadar';
import { DanRankBadge } from './DanRankBadge';
import { OpponentDossierCard } from './OpponentDossierCard';
import { BushidoScrolls } from './BushidoScrolls';
import { KeyboardHud } from './KeyboardHud';
import { TacticalTicker } from './TacticalTicker';
import { X } from 'lucide-react';
import { haptic } from '@clubhouse/shared/juice';
import {
  playCapture,
  playCombo,
  playError,
  playGoal,
  playImpact,
  playMove,
  playScore,
} from '@clubhouse/shared/synthAudio';

const PROJECTILE_DURATION: Record<
  'SHURIKEN' | 'KUNAI' | 'BOMB' | 'SICKLE',
  number
> = {
  SHURIKEN: DURATION_SHURIKEN,
  KUNAI: DURATION_KUNAI,
  BOMB: DURATION_BOMB,
  SICKLE: DURATION_SICKLE,
};

const COUNTER_FEEDBACK_LABEL: Record<CounterResult, string> = {
  [CounterResult.NONE]: '',
  [CounterResult.PERFECT]: '完美',
  [CounterResult.GOOD]: '不錯',
  [CounterResult.EARLY]: '太早',
  [CounterResult.LATE]: '太晚',
  [CounterResult.MISS]: '失誤',
  [CounterResult.FEINT]: '佯攻！',
  [CounterResult.WRONG_SIDE]: '錯邊',
};

interface GameCanvasProps {
  onGameOver: (stats: GameStats) => void;
  gameActive: boolean;
  playMode: PlayMode;
  baseTier?: PracticeIntensity;
  scenario?: PracticeScenario;
  opponent?: OpponentDef | null;
  /** Seeded RNG for daily / deterministic duels. */
  seed?: number | null;
  onRestart?: () => void;
  onBackToMenu?: () => void;
}

function finalizeRank(stats: GameStats): void {
  const scored = stats.history.filter(
    (h) => h.result === CounterResult.PERFECT || h.result === CounterResult.GOOD,
  );
  const attempts = stats.history.length;
  if (scored.length === 0) {
    stats.avgReactionMs = null;
    stats.bestReactionMs = null;
    stats.rank = computeReactionRank({
      avgAbsTimingMs: 999,
      accuracy: 0,
      sampleSize: 0,
    });
    return;
  }
  const sum = scored.reduce((acc, h) => acc + Math.abs(h.timing), 0);
  stats.avgReactionMs = Math.round(sum / scored.length);
  stats.bestReactionMs = Math.round(
    Math.min(...scored.map((h) => Math.abs(h.timing))),
  );
  const accuracy = scored.length / Math.max(1, attempts);
  stats.rank = computeReactionRank({
    avgAbsTimingMs: stats.avgReactionMs,
    accuracy,
    sampleSize: scored.length,
  });
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  onGameOver,
  gameActive,
  playMode,
  baseTier = 0,
  scenario = 'mixed',
  opponent = null,
  seed = null,
  onRestart,
  onBackToMenu,
}) => {
  const lastFrameTime = useRef<number>(0);
  const nextAttackTime = useRef<number>(0);
  const warningStartTime = useRef<number>(0);
  const impactTime = useRef<number>(0);
  const enemyState = useRef<EnemyState>(EnemyState.IDLE);
  const playerStance = useRef<PlayerStance>(PlayerStance.IDLE);
  const sheathedSide = useRef<ParrySide | null>(null);
  const hitStopTimer = useRef<number>(0);
  const hp = useRef<number>(MAX_HP);
  const enemyHp = useRef<number>(opponent?.enemyHp ?? MAX_HP);
  const patternState = useRef<PatternState>(createPatternState());
  const currentEvent = useRef<AttackEvent | null>(null);
  const feintResolved = useRef(false);
  const rngRef = useRef<() => number>(Math.random);
  const versusSheathed = useRef<{ p1: boolean; p2: boolean }>({ p1: false, p2: false });
  const versusFouled = useRef<{ p1: boolean; p2: boolean }>({ p1: false, p2: false });
  const currentProjectileType = useRef<ProjectileType>(ProjectileType.SHURIKEN);
  const currentProjectileDuration = useRef<number>(DURATION_SHURIKEN);
  const projectileProgress = useRef<number>(0);

  const baseTierRef = useRef<PracticeIntensity>(baseTier);
  baseTierRef.current = baseTier;
  const scenarioRef = useRef<PracticeScenario>(scenario);
  scenarioRef.current =
    playMode === 'practice'
      ? scenario
      : opponent
        ? opponent.scenario
        : 'mixed';
  const playModeRef = useRef(playMode);
  playModeRef.current = playMode;
  const opponentRef = useRef(opponent);
  opponentRef.current = opponent;

  const isPractice = playMode === 'practice';
  const isDuel = playMode === 'duel' || playMode === 'daily';
  const isVersus = playMode === 'versus';
  const effectiveBaseTier: PracticeIntensity = isDuel
    ? ((opponent?.baseTier ?? 0) as PracticeIntensity)
    : baseTier;

  const [feedback, setFeedback] = useState<{ text: string; type: CounterResult } | null>(
    null,
  );
  const [screenShake, setScreenShake] = useState(false);
  const [bgInvert, setBgInvert] = useState(false);
  const [slashBurst, setSlashBurst] = useState(false);
  const [perfectShockwave, setPerfectShockwave] = useState(false);
  const [latestRecord, setLatestRecord] = useState<ReactionRecord | null>(null);
  const [mobileDrawer, setMobileDrawer] = useState<'left' | 'right' | null>(null);
  const [ladder] = useState(() => loadLadder());
  const [best] = useState(() => loadBest());
  const [, setRenderTrigger] = useState(0);

  const stats = useRef<GameStats>(emptyStats());

  useEffect(() => {
    rngRef.current =
      seed != null && Number.isFinite(seed) ? createRng(seed >>> 0) : Math.random;
    patternState.current = createPatternState();
    hp.current = MAX_HP;
    enemyHp.current = opponent?.enemyHp ?? MAX_HP;
    stats.current = emptyStats();
    versusSheathed.current = { p1: false, p2: false };
    versusFouled.current = { p1: false, p2: false };
    setLatestRecord(null);
    setPerfectShockwave(false);
    setMobileDrawer(null);
  }, [seed, opponent, playMode, gameActive]);

  const showFeedback = useCallback((result: CounterResult, extra?: string) => {
    const text = extra ?? COUNTER_FEEDBACK_LABEL[result];
    setFeedback({ text, type: result });
    setTimeout(() => setFeedback(null), 800);
  }, []);

  const endRun = useCallback(
    (partial?: Partial<GameStats>) => {
      if (partial) Object.assign(stats.current, partial);
      finalizeRank(stats.current);
      if (isDuel) {
        stats.current.enemyHpLeft = enemyHp.current;
        if (stats.current.duelWon == null) {
          stats.current.duelWon = enemyHp.current <= 0 && hp.current > 0;
        }
      }
      onGameOver({ ...stats.current });
    },
    [onGameOver, isDuel],
  );

  const takePlayerDamage = useCallback(
    (amount: number) => {
      hp.current = Math.max(0, hp.current - amount);
      if (hp.current <= 0) {
        if (isPractice) {
          hp.current = MAX_HP;
          return;
        }
        if (isDuel) {
          stats.current.duelWon = false;
          stats.current.enemyHpLeft = enemyHp.current;
          endRun();
          return;
        }
        if (!isVersus) {
          endRun();
        }
      }
    },
    [endRun, isPractice, isDuel, isVersus],
  );

  const damageEnemy = useCallback(
    (amount: number) => {
      if (!isDuel) return;
      enemyHp.current = Math.max(0, enemyHp.current - amount);
      if (enemyHp.current <= 0) {
        stats.current.duelWon = true;
        stats.current.enemyHpLeft = 0;
        endRun();
      }
    },
    [endRun, isDuel],
  );

  const triggerHitAnimation = useCallback(() => {
    playerStance.current = PlayerStance.HIT;
    setTimeout(() => {
      if (hp.current > 0 && playerStance.current === PlayerStance.HIT) {
        playerStance.current = PlayerStance.IDLE;
      }
    }, 500);
  }, []);

  const scheduleNextAttack = useCallback(() => {
    const now = performance.now();
    const mode = playModeRef.current;
    const opp = opponentRef.current;
    const tier = effectiveBaseTier;
    let event: AttackEvent;

    if ((mode === 'duel' || mode === 'daily') && opp) {
      event = nextAttackEvent(opp, patternState.current, rngRef.current);
    } else {
      const delayRange = getAttackDelayRange(stats.current.score, tier);
      const endless = nextEndlessEvent(
        scenarioRef.current,
        patternState.current,
        rngRef.current,
        mode === 'challenge' ? 0.12 : 0.08,
      );
      // Blend score-based delay with pattern delay for challenge/practice.
      const scoreDelay =
        Math.random() * (delayRange.max - delayRange.min) + delayRange.min;
      endless.preDelayMs = Math.min(endless.preDelayMs, scoreDelay);
      event = endless;
    }

    currentEvent.current = event;
    feintResolved.current = false;
    nextAttackTime.current = now + event.preDelayMs;
    enemyState.current = EnemyState.IDLE;
    projectileProgress.current = 0;

    const durationScale =
      event.durationScale *
      getProjectileDurationScale(stats.current.score, tier);
    currentProjectileType.current = ProjectileType[event.projectile];
    currentProjectileDuration.current =
      PROJECTILE_DURATION[event.projectile] * durationScale;
    versusFouled.current = { p1: false, p2: false };
  }, [effectiveBaseTier]);

  const recordHistory = useCallback(
    (timing: number, result: CounterResult, side?: ParrySide) => {
      const rec: ReactionRecord = {
        id: Date.now() + stats.current.history.length,
        timing,
        result,
        side,
      };
      stats.current.history.push(rec);
      setLatestRecord(rec);
    },
    [],
  );

  const applyCounterResult = useCallback(
    (result: CounterResult, timingDiff: number, side: ParrySide | null) => {
      const abs = Math.abs(timingDiff);

      if (result === CounterResult.PERFECT) {
        playGoal();
        playCombo(stats.current.combo + 1);
        haptic('combo', Math.min(1.2, 0.55 + stats.current.combo * 0.06));
        stats.current.score += SCORE_PERFECT + stats.current.combo * 100;
        stats.current.combo++;
        stats.current.perfects++;
        hp.current = Math.min(MAX_HP, hp.current + HEAL_PERFECT);
        damageEnemy(DAMAGE_ENEMY_PERFECT);
        setBgInvert(true);
        setTimeout(() => setBgInvert(false), 150);
        setSlashBurst(true);
        setTimeout(() => setSlashBurst(false), 200);
        setPerfectShockwave(true);
        setTimeout(() => setPerfectShockwave(false), 450);
        hitStopTimer.current = HIT_STOP_DURATION;
      } else if (result === CounterResult.GOOD) {
        playScore();
        playImpact(0.45);
        haptic('success', 0.55);
        stats.current.score += SCORE_GOOD + stats.current.combo * 10;
        stats.current.combo++;
        stats.current.goods++;
        takePlayerDamage(DAMAGE_PLAYER_BLOCK);
        damageEnemy(DAMAGE_ENEMY_GOOD);
        setSlashBurst(true);
        setTimeout(() => setSlashBurst(false), 160);
        hitStopTimer.current = HIT_STOP_DURATION / 2;
      } else if (result === CounterResult.EARLY) {
        playError();
        haptic('error', 0.7);
        stats.current.combo = 0;
        stats.current.earlies++;
        stats.current.misses++;
        takePlayerDamage(DAMAGE_EARLY);
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 300);
        triggerHitAnimation();
      } else if (result === CounterResult.FEINT) {
        playError();
        playImpact(0.7);
        haptic('impact', 0.85);
        stats.current.combo = 0;
        stats.current.feints++;
        stats.current.misses++;
        takePlayerDamage(DAMAGE_FEINT);
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 300);
        triggerHitAnimation();
      } else if (result === CounterResult.WRONG_SIDE) {
        playError();
        haptic('error', 0.75);
        stats.current.combo = 0;
        stats.current.wrongSides++;
        stats.current.misses++;
        takePlayerDamage(DAMAGE_WRONG_SIDE);
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 300);
        triggerHitAnimation();
      } else {
        // LATE / MISS
        playError();
        haptic('impact');
        stats.current.combo = 0;
        stats.current.misses++;
        takePlayerDamage(DAMAGE_PLAYER_HIT);
        setScreenShake(true);
        setTimeout(() => setScreenShake(false), 300);
        triggerHitAnimation();
      }

      stats.current.maxCombo = Math.max(stats.current.maxCombo, stats.current.combo);
      recordHistory(timingDiff, result, side ?? undefined);
      showFeedback(result);
      if (currentEvent.current) {
        noteEventResolved(patternState.current, currentEvent.current);
      }
      if (hp.current > 0 && !(isDuel && enemyHp.current <= 0)) {
        scheduleNextAttack();
      }
      void abs;
    },
    [
      damageEnemy,
      takePlayerDamage,
      triggerHitAnimation,
      recordHistory,
      showFeedback,
      scheduleNextAttack,
      isDuel,
    ],
  );

  const handleParryRelease = useCallback(
    (side: ParrySide) => {
      if (!gameActive || hp.current <= 0) return;
      if (isVersus) return;
      if (
        playerStance.current === PlayerStance.HIT ||
        playerStance.current === PlayerStance.RECOVERING
      ) {
        return;
      }
      if (playerStance.current !== PlayerStance.SHEATHED) return;
      if (sheathedSide.current !== side) return;

      playerStance.current = PlayerStance.SLASHING;
      playCapture();
      setSlashBurst(true);
      setTimeout(() => setSlashBurst(false), 180);

      const now = performance.now();
      const evt = currentEvent.current;
      const attacking =
        enemyState.current === EnemyState.WARNING ||
        enemyState.current === EnemyState.ATTACKING;

      const { result, absTimingMs } = resolveCounter({
        timingDiffMs: attacking ? now - impactTime.current : -9999,
        playerSide: side,
        attackSide: evt?.side ?? 'left',
        isFeint: Boolean(evt && evt.kind === 'feint' && attacking),
        noAttack: !attacking,
        score: stats.current.score,
        combo: stats.current.combo,
        baseTier: effectiveBaseTier,
      });
      void absTimingMs;

      applyCounterResult(result, attacking ? now - impactTime.current : -9999, side);

      setTimeout(() => {
        if (hp.current > 0 && playerStance.current !== PlayerStance.HIT) {
          playerStance.current = PlayerStance.IDLE;
          sheathedSide.current = null;
        }
      }, 300);
    },
    [gameActive, isVersus, applyCounterResult, effectiveBaseTier],
  );

  const handleParryDown = useCallback(
    (side: ParrySide) => {
      if (!gameActive || hp.current <= 0 || isVersus) return;
      if (
        playerStance.current === PlayerStance.HIT ||
        playerStance.current === PlayerStance.RECOVERING ||
        playerStance.current === PlayerStance.SLASHING
      ) {
        return;
      }
      playerStance.current = PlayerStance.SHEATHED;
      sheathedSide.current = side;
      playMove();
    },
    [gameActive, isVersus],
  );

  // --- Versus (same-device quick-draw) ---
  const resolveVersusPoint = useCallback(
    (winner: 1 | 2 | 'foul-both' | 'miss') => {
      if (winner === 1) {
        stats.current.versusP1 += 1;
        playGoal();
        haptic('success');
        showFeedback(CounterResult.PERFECT, 'P1 得分');
      } else if (winner === 2) {
        stats.current.versusP2 += 1;
        playGoal();
        haptic('success');
        showFeedback(CounterResult.GOOD, 'P2 得分');
      } else if (winner === 'foul-both') {
        playError();
        haptic('error');
        showFeedback(CounterResult.EARLY, '雙雙犯規');
      } else {
        playError();
        haptic('tap', 0.5);
        showFeedback(CounterResult.MISS, '無人出刀');
      }

      if (stats.current.versusP1 >= VERSUS_POINTS_TO_WIN) {
        stats.current.versusWinner = 1;
        endRun();
        return;
      }
      if (stats.current.versusP2 >= VERSUS_POINTS_TO_WIN) {
        stats.current.versusWinner = 2;
        endRun();
        return;
      }
      scheduleNextAttack();
    },
    [endRun, scheduleNextAttack, showFeedback],
  );

  const handleVersusDown = useCallback(
    (player: 1 | 2) => {
      if (!gameActive || !isVersus) return;
      if (player === 1) versusSheathed.current.p1 = true;
      else versusSheathed.current.p2 = true;
      playMove();
    },
    [gameActive, isVersus],
  );

  const handleVersusUp = useCallback(
    (player: 1 | 2) => {
      if (!gameActive || !isVersus) return;
      const sheathed =
        player === 1 ? versusSheathed.current.p1 : versusSheathed.current.p2;
      if (!sheathed) return;
      if (player === 1) versusSheathed.current.p1 = false;
      else versusSheathed.current.p2 = false;

      const now = performance.now();
      const attacking =
        enemyState.current === EnemyState.WARNING ||
        enemyState.current === EnemyState.ATTACKING;

      if (!attacking) {
        if (player === 1) versusFouled.current.p1 = true;
        else versusFouled.current.p2 = true;
        playError();
        if (versusFouled.current.p1 && versusFouled.current.p2) {
          resolveVersusPoint('foul-both');
        }
        return;
      }

      const windows = getTimingWindows(0, 0, 0);
      const diff = now - impactTime.current;
      if (Math.abs(diff) > windows.good) {
        if (diff < 0) {
          if (player === 1) versusFouled.current.p1 = true;
          else versusFouled.current.p2 = true;
          playError();
          return;
        }
      }

      // First valid release in window wins the point.
      const otherFouled =
        player === 1 ? versusFouled.current.p2 : versusFouled.current.p1;
      if (otherFouled) {
        resolveVersusPoint(player);
        return;
      }
      resolveVersusPoint(player);
    },
    [gameActive, isVersus, resolveVersusPoint],
  );

  const handleQuickDown = useCallback(() => {
    if (!gameActive || hp.current <= 0) return;
    if (isVersus) {
      handleVersusDown(1);
      return;
    }
    const targetSide: ParrySide = currentEvent.current?.side ?? 'left';
    handleParryDown(targetSide);
  }, [gameActive, isVersus, handleVersusDown, handleParryDown]);

  const handleQuickUp = useCallback(() => {
    if (!gameActive) return;
    if (isVersus) {
      handleVersusUp(1);
      return;
    }
    if (sheathedSide.current) {
      handleParryRelease(sheathedSide.current);
    }
  }, [gameActive, isVersus, handleVersusUp, handleParryRelease]);

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (['ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'KeyR') {
        e.preventDefault();
        onRestart?.();
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        onBackToMenu?.();
        return;
      }
      if (e.code === 'Space' || e.code === 'KeyJ') {
        e.preventDefault();
        handleQuickDown();
        return;
      }
      if (isVersus) {
        if (e.code === 'KeyA' || e.code === 'KeyS') handleVersusDown(1);
        if (e.code === 'KeyL' || e.code === 'ArrowRight') handleVersusDown(2);
        return;
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') handleParryDown('left');
      if (e.code === 'KeyD' || e.code === 'ArrowRight') handleParryDown('right');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'KeyJ') {
        e.preventDefault();
        handleQuickUp();
        return;
      }
      if (isVersus) {
        if (e.code === 'KeyA' || e.code === 'KeyS') handleVersusUp(1);
        if (e.code === 'KeyL' || e.code === 'ArrowRight') handleVersusUp(2);
        return;
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') handleParryRelease('left');
      if (e.code === 'KeyD' || e.code === 'ArrowRight') handleParryRelease('right');
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    isVersus,
    handleParryDown,
    handleParryRelease,
    handleVersusDown,
    handleVersusUp,
    handleQuickDown,
    handleQuickUp,
    onRestart,
    onBackToMenu,
  ]);

  // Game loop
  useEffect(() => {
    if (!gameActive) return;
    scheduleNextAttack();
    lastFrameTime.current = performance.now();
    let raf = 0;

    const loop = (time: number) => {
      const deltaTime = time - lastFrameTime.current;
      lastFrameTime.current = time;

      if (hitStopTimer.current > 0) {
        hitStopTimer.current -= deltaTime;
        raf = requestAnimationFrame(loop);
        return;
      }

      if (enemyState.current === EnemyState.IDLE) {
        projectileProgress.current = 0;
        if (time >= nextAttackTime.current) {
          enemyState.current = EnemyState.WARNING;
          warningStartTime.current = time;
          impactTime.current = time + currentProjectileDuration.current;
        }
      } else if (
        enemyState.current === EnemyState.WARNING ||
        enemyState.current === EnemyState.ATTACKING
      ) {
        const evt = currentEvent.current;
        const progress =
          (time - warningStartTime.current) / currentProjectileDuration.current;
        projectileProgress.current = Math.min(progress, 1.2);

        // Feint: vanish mid-flight — patience scores; no release needed.
        if (
          evt?.kind === 'feint' &&
          !feintResolved.current &&
          progress >= FEINT_VANISH_AT
        ) {
          feintResolved.current = true;
          stats.current.score += SCORE_FEINT_PATIENCE;
          playScore();
          haptic('success', 0.5);
          showFeedback(CounterResult.PERFECT, '看破');
          noteEventResolved(patternState.current, evt);
          scheduleNextAttack();
          raf = requestAnimationFrame(loop);
          return;
        }

        if (time >= impactTime.current) {
          enemyState.current = EnemyState.ATTACKING;
        }

        const missWindow = getTimingWindows(
          stats.current.score,
          stats.current.combo,
          effectiveBaseTier,
        ).good;

        if (evt?.kind !== 'feint' && time > impactTime.current + missWindow) {
          if (isVersus) {
            resolveVersusPoint('miss');
          } else {
            takePlayerDamage(DAMAGE_PLAYER_HIT);
            stats.current.combo = 0;
            stats.current.misses++;
            recordHistory(missWindow + 1, CounterResult.MISS);
            showFeedback(CounterResult.MISS, '命中');
            setScreenShake(true);
            setTimeout(() => setScreenShake(false), 300);
            playError();
            haptic('impact');
            triggerHitAnimation();
            if (currentEvent.current) {
              noteEventResolved(patternState.current, currentEvent.current);
            }
            if (hp.current > 0) scheduleNextAttack();
          }
        }
      }

      setRenderTrigger((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [
    gameActive,
    scheduleNextAttack,
    takePlayerDamage,
    triggerHitAnimation,
    showFeedback,
    recordHistory,
    effectiveBaseTier,
    isVersus,
    resolveVersusPoint,
  ]);

  const isSheathed = playerStance.current === PlayerStance.SHEATHED;
  const isSlashing = playerStance.current === PlayerStance.SLASHING;
  const isHit = playerStance.current === PlayerStance.HIT;
  const isEnemyAttacking =
    enemyState.current === EnemyState.WARNING ||
    enemyState.current === EnemyState.ATTACKING;
  const activeSide = currentEvent.current?.side;
  const isFeintFlight =
    currentEvent.current?.kind === 'feint' &&
    isEnemyAttacking &&
    !feintResolved.current;

  const renderProjectile = () => {
    if (!isEnemyAttacking || !currentEvent.current) return null;
    if (
      currentEvent.current.kind === 'feint' &&
      projectileProgress.current >= FEINT_VANISH_AT
    ) {
      return null;
    }

    const progress = projectileProgress.current;
    const type = currentProjectileType.current;
    const side = currentEvent.current.side;
    const leftPos = 90 - progress * 80;
    let topOffset = side === 'left' ? -36 : 36;
    let rotation = progress * 1000;

    if (type === ProjectileType.BOMB) {
      topOffset += -Math.sin(progress * Math.PI) * 80;
      rotation = progress * 360;
    } else if (type === ProjectileType.SICKLE) {
      topOffset += Math.sin(progress * 15) * 28;
    }

    return (
      <div
        className="absolute z-30 pointer-events-none"
        style={{
          left: `${leftPos}%`,
          top: `calc(50% + ${topOffset}px)`,
          transform:
            type === ProjectileType.KUNAI
              ? `rotate(180deg)`
              : `rotate(${rotation}deg)`,
        }}
      >
        {type === ProjectileType.SHURIKEN && (
          <div className="w-10 h-10 relative">
            <div className="absolute inset-0 bg-red-500 blur-md opacity-50" />
            <img
              src={`${import.meta.env.BASE_URL}projectiles/shuriken.jpg`}
              alt=""
              className="w-full h-full object-contain drop-shadow"
              draggable={false}
            />
          </div>
        )}
        {type === ProjectileType.KUNAI && (
          <div className="w-14 h-14 relative">
            <div className="absolute inset-0 bg-blue-300 blur-sm opacity-35" />
            <img
              src={`${import.meta.env.BASE_URL}projectiles/kunai.jpg`}
              alt=""
              className="w-full h-full object-contain drop-shadow"
              draggable={false}
            />
          </div>
        )}
        {type === ProjectileType.BOMB && (
          <div className="w-12 h-12 relative">
            <img
              src={`${import.meta.env.BASE_URL}projectiles/bomb.jpg`}
              alt=""
              className="w-full h-full object-contain drop-shadow"
              draggable={false}
            />
            <div className="absolute -top-1 right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse blur-[1px]" />
          </div>
        )}
        {type === ProjectileType.SICKLE && (
          <div className="w-16 h-16 relative -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-0 bg-teal-500/25 blur-md rounded-full" />
            <img
              src={`${import.meta.env.BASE_URL}projectiles/sickle.jpg`}
              alt=""
              className="w-full h-full object-contain drop-shadow"
              draggable={false}
            />
          </div>
        )}
      </div>
    );
  };

  const onSidePointerDown = (side: ParrySide, e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isVersus) {
      handleVersusDown(side === 'left' ? 1 : 2);
    } else {
      handleParryDown(side);
    }
  };

  const onSidePointerUp = (side: ParrySide, e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isVersus) {
      handleVersusUp(side === 'left' ? 1 : 2);
    } else {
      handleParryRelease(side);
    }
  };

  const danRankStatus = useMemo(
    () => computeDanRankStatus(best, ladder, stats.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [best, ladder, stats.current.score, stats.current.combo, stats.current.history.length],
  );

  const timingWindows = getTimingWindows(
    stats.current.score,
    stats.current.combo,
    effectiveBaseTier,
  );

  const scoredRecords = stats.current.history.filter(
    (h) => h.result === CounterResult.PERFECT || h.result === CounterResult.GOOD,
  );
  const currentBestReactionMs =
    scoredRecords.length > 0
      ? Math.round(Math.min(...scoredRecords.map((h) => Math.abs(h.timing))))
      : null;
  const currentAvgReactionMs =
    scoredRecords.length > 0
      ? Math.round(
          scoredRecords.reduce((acc, h) => acc + Math.abs(h.timing), 0) /
            scoredRecords.length,
        )
      : null;

  const containerClass = `relative w-full h-full overflow-hidden flex flex-col justify-between transition-colors duration-75 touch-none ${
    bgInvert ? 'bg-slate-200 filter invert' : 'bg-[#1a2238]'
  } ${screenShake ? 'animate-shake' : ''}`;

  const modeLabel = (() => {
    if (isVersus) return '雙人拔刀';
    if (playMode === 'daily') return '每日對決';
    if (playMode === 'duel' && opponent) return `對決 · ${opponent.name}`;
    if (isPractice) return `練習 · ${INTENSITY_LABELS[baseTier]} · 無限生命`;
    return '挑戰 · HP';
  })();

  return (
    <div className={containerClass}>
      {/* Background scenery */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-45"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}dojo-bg.jpg)` }}
        />
        <div className="w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-600/40 via-slate-900/50 to-slate-950/80" />
        <div className="absolute bottom-0 w-full h-1/3 bg-gradient-to-t from-slate-950 to-transparent opacity-80" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-400/15 rounded-full blur-3xl" />
      </div>

      <div
        className="absolute bottom-0 w-full h-32 bg-cover bg-bottom border-t border-slate-500/20 pointer-events-none"
        style={{
          backgroundImage: [
            'linear-gradient(to top, rgba(12,16,28,0.92), rgba(12,16,28,0.35) 55%, transparent)',
            `url(${import.meta.env.BASE_URL}floor.jpg)`,
          ].join(', '),
        }}
      />

      {/* Top Tactical Ticker */}
      <TacticalTicker
        danRank={danRankStatus}
        bestReactionMs={currentBestReactionMs}
        combo={stats.current.combo}
        onToggleLeftWing={() => setMobileDrawer((d) => (d === 'left' ? null : 'left'))}
        onToggleRightWing={() => setMobileDrawer((d) => (d === 'right' ? null : 'right'))}
      />

      {/* Touch / mouse side zones */}
      <button
        type="button"
        aria-label={isVersus ? '玩家一待機／出刀' : SIDE_LABELS.left}
        className={`absolute left-0 top-10 w-1/2 h-[calc(100%-2.5rem)] z-10 border-r border-white/5 ${
          sheathedSide.current === 'left' || versusSheathed.current.p1
            ? 'bg-cyan-400/10'
            : 'bg-transparent'
        }`}
        onMouseDown={(e) => onSidePointerDown('left', e)}
        onMouseUp={(e) => onSidePointerUp('left', e)}
        onMouseLeave={() => {
          if (!isVersus && sheathedSide.current === 'left') {
            handleParryRelease('left');
          }
        }}
        onTouchStart={(e) => onSidePointerDown('left', e)}
        onTouchEnd={(e) => onSidePointerUp('left', e)}
      />
      <button
        type="button"
        aria-label={isVersus ? '玩家二待機／出刀' : SIDE_LABELS.right}
        className={`absolute right-0 top-10 w-1/2 h-[calc(100%-2.5rem)] z-10 ${
          sheathedSide.current === 'right' || versusSheathed.current.p2
            ? 'bg-amber-400/10'
            : 'bg-transparent'
        }`}
        onMouseDown={(e) => onSidePointerDown('right', e)}
        onMouseUp={(e) => onSidePointerUp('right', e)}
        onMouseLeave={() => {
          if (!isVersus && sheathedSide.current === 'right') {
            handleParryRelease('right');
          }
        }}
        onTouchStart={(e) => onSidePointerDown('right', e)}
        onTouchEnd={(e) => onSidePointerUp('right', e)}
      />

      {/* Central Cockpit Layout (Left Wing, Battlefield Center, Right Wing) */}
      <div className="relative flex-1 w-full flex items-center justify-between px-3 md:px-6 z-20 pointer-events-none">
        {/* Left Wing (Desktop xl) */}
        <div className="hidden xl:flex flex-col w-72 gap-2.5 z-30 pointer-events-auto max-h-[82vh] overflow-y-auto cockpit-scroll my-auto">
          <ReactionSpectrumRadar
            history={stats.current.history}
            perfectWindowMs={timingWindows.perfect}
            goodWindowMs={timingWindows.good}
            bestReactionMs={currentBestReactionMs}
            avgReactionMs={currentAvgReactionMs}
            latestRecord={latestRecord}
          />
          <ZenFlowWaveform
            combo={stats.current.combo}
            isSheathed={isSheathed}
            isSlashing={isSlashing}
            reactionRank={stats.current.rank}
          />
        </div>

        {/* Center Arena */}
        <div className="relative flex-1 max-w-4xl h-full flex flex-col justify-between items-center py-2">
          {/* Top In-Arena HUD */}
          <div className="w-full flex justify-between items-start pointer-events-none px-2 md:px-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <div className="w-36 md:w-56 h-5 md:h-6 bg-slate-800 border border-slate-600 skew-x-[-10deg] relative overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ease-out ${
                      hp.current < 30
                        ? 'bg-red-500 animate-pulse'
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-300'
                    }`}
                    style={{ width: `${(hp.current / MAX_HP) * 100}%` }}
                  />
                </div>
                <span
                  className={`font-display font-bold text-lg md:text-xl ${
                    hp.current < 30 ? 'text-red-500' : 'text-emerald-400'
                  }`}
                >
                  {Math.ceil(hp.current)}
                </span>
              </div>
              {isDuel && opponent && (
                <div className="flex items-center gap-2">
                  <div className="w-36 md:w-56 h-3.5 bg-slate-800 border border-rose-700/50 skew-x-[-10deg] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-rose-600 to-orange-400 transition-all duration-300"
                      style={{
                        width: `${(enemyHp.current / Math.max(1, opponent.enemyHp)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-rose-300 text-xs font-display">{opponent.name}</span>
                </div>
              )}
              {isVersus && (
                <div className="text-sm font-display tracking-wider text-slate-300">
                  <span className="text-cyan-300">P1 {stats.current.versusP1}</span>
                  <span className="text-slate-500"> — </span>
                  <span className="text-amber-300">P2 {stats.current.versusP2}</span>
                  <span className="text-slate-500 text-xs ml-2">
                    先得 {VERSUS_POINTS_TO_WIN}
                  </span>
                </div>
              )}
              <div className="text-slate-400 text-[10px] md:text-xs font-display tracking-widest">
                {modeLabel}
              </div>
            </div>

            <div className="text-right">
              {!isVersus && (
                <>
                  <div className="font-display text-3xl md:text-5xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">
                    {stats.current.score.toLocaleString()}
                  </div>
                  {stats.current.combo > 1 && (
                    <div className="text-amber-400 font-display font-bold text-lg md:text-2xl animate-bounce">
                      {stats.current.combo} 連段
                    </div>
                  )}
                </>
              )}
              {isEnemyAttacking && activeSide && !isVersus && (
                <div
                  className={`mt-1 text-sm font-display font-bold tracking-widest ${
                    activeSide === 'left' ? 'text-cyan-300' : 'text-amber-300'
                  } ${isFeintFlight ? 'opacity-70' : ''}`}
                >
                  {SIDE_LABELS[activeSide]}
                  {isFeintFlight ? '？' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Duel stage characters */}
          <div className="relative w-full max-w-2xl h-[380px] md:h-[420px] flex items-end justify-between px-6 md:px-12 pb-16 pointer-events-none">
            {/* Player */}
            <div
              className={`relative group transition-all duration-75 ${
                isSlashing
                  ? sheathedSide.current === 'right'
                    ? 'translate-x-32 -translate-y-4 md:translate-x-44'
                    : 'translate-x-36 translate-y-2 md:translate-x-52'
                  : ''
              } ${isHit ? 'animate-hit grayscale sepia text-red-500' : ''}`}
            >
              {isHit && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500/50 blur-3xl rounded-full z-0 animate-ping" />
              )}
              {/* Zanshin aura when sheathed */}
              {isSheathed && (
                <div className="absolute inset-0 -m-6 rounded-full bg-gradient-to-t from-cyan-500/25 via-emerald-400/20 to-transparent blur-xl animate-zanshin pointer-events-none" />
              )}
              {/* Perfect shockwave ring */}
              {perfectShockwave && (
                <div className="absolute top-1/2 left-1/2 w-48 h-48 border-4 border-cyan-300 rounded-full animate-shockwave pointer-events-none z-50 shadow-[0_0_25px_#22d3ee]" />
              )}

              <div
                className={`relative w-24 md:w-28 h-48 md:h-52 flex flex-col items-center transition-all duration-200 origin-bottom ${
                  isSheathed ? 'scale-y-[0.92] translate-y-3 rotate-2' : ''
                } ${isHit ? 'opacity-80' : ''}`}
              >
                <img
                  src={`${import.meta.env.BASE_URL}player.jpg`}
                  alt=""
                  draggable={false}
                  className={`w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(16,185,129,0.35)] select-none ${
                    isSheathed ? 'brightness-110 contrast-110' : ''
                  }`}
                />

                {/* Blade hilt gleam when holding stance */}
                {isSheathed && (
                  <div className="absolute top-20 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_#ffffff] animate-ping" />
                )}

                {/* Neon Dynamic Blade Slash Arcs & Sparks */}
                {(isSlashing || slashBurst) && (
                  <div className="absolute top-0 left-0 w-[420px] h-[320px] -translate-y-32 -translate-x-12 z-50 pointer-events-none">
                    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="neon-left" x1="0%" y1="100%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#ffffff" />
                          <stop offset="50%" stopColor="#22d3ee" />
                          <stop offset="100%" stopColor="#0284c7" />
                        </linearGradient>
                        <linearGradient id="neon-right" x1="0%" y1="100%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#ffffff" />
                          <stop offset="50%" stopColor="#fbbf24" />
                          <stop offset="100%" stopColor="#ea580c" />
                        </linearGradient>
                      </defs>

                      {/* Wide bloom */}
                      <path
                        d={sheathedSide.current === 'right' ? "M 10 15 Q 60 45 90 85" : "M 10 90 Q 50 10 90 20"}
                        stroke={sheathedSide.current === 'right' ? '#f59e0b' : '#38bdf8'}
                        strokeWidth="10"
                        fill="none"
                        opacity="0.45"
                        className="animate-slash-path"
                      />
                      {/* Mid core */}
                      <path
                        d={sheathedSide.current === 'right' ? "M 10 15 Q 60 45 90 85" : "M 10 90 Q 50 10 90 20"}
                        stroke={sheathedSide.current === 'right' ? 'url(#neon-right)' : 'url(#neon-left)'}
                        strokeWidth="4"
                        fill="none"
                        className="animate-slash-path"
                      />
                      {/* White-hot center */}
                      <path
                        d={sheathedSide.current === 'right' ? "M 10 15 Q 60 45 90 85" : "M 10 90 Q 50 10 90 20"}
                        stroke="#ffffff"
                        strokeWidth="1.8"
                        fill="none"
                        className="animate-slash-path"
                      />
                    </svg>

                    {/* Sparks particle burst */}
                    <div className="absolute top-1/3 left-2/3 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                      <div className="w-3 h-3 bg-white rounded-full animate-ping" />
                      <div className="w-10 h-0.5 bg-cyan-300 absolute top-1/2 left-0 -translate-y-1/2 rotate-45 shadow-[0_0_8px_#22d3ee]" />
                      <div className="w-10 h-0.5 bg-amber-300 absolute top-1/2 left-0 -translate-y-1/2 -rotate-45 shadow-[0_0_8px_#fbbf24]" />
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/50 blur-md rounded-full scale-y-50" />
              <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-44 text-center">
                {isSheathed && sheathedSide.current ? (
                  <span
                    className={`font-display text-xs md:text-sm tracking-widest animate-pulse drop-shadow-md font-bold ${
                      sheathedSide.current === 'left' ? 'text-cyan-300' : 'text-amber-300'
                    }`}
                  >
                    集中·{SIDE_LABELS[sheathedSide.current]}
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px] font-display tracking-widest">
                    長按左／右待機
                  </span>
                )}
              </div>
            </div>

            {renderProjectile()}

            {/* Enemy */}
            <div className="relative">
              <div
                className={`relative w-24 md:w-28 h-48 md:h-52 flex flex-col items-center transition-all duration-200 ${
                  isEnemyAttacking ? 'translate-x-8 skew-x-6' : ''
                }`}
              >
                <img
                  src={`${import.meta.env.BASE_URL}enemy.jpg`}
                  alt=""
                  draggable={false}
                  className={`w-full h-full object-contain drop-shadow-[0_8px_24px_rgba(239,68,68,0.4)] select-none ${
                    isEnemyAttacking ? 'brightness-125 saturate-150' : ''
                  }`}
                />
                {isEnemyAttacking && (
                  <div
                    className={`absolute top-6 w-3 h-3 rounded-full animate-ping ${
                      activeSide === 'left'
                        ? 'left-[30%] bg-cyan-400 shadow-[0_0_12px_#22d3ee]'
                        : 'right-[30%] bg-amber-400 shadow-[0_0_12px_#fbbf24]'
                    }`}
                  />
                )}
                <div
                  className={`absolute top-16 -left-2 w-20 h-3 bg-rose-900/90 origin-right transition-transform duration-100 border border-rose-700/40 rounded-full ${
                    isEnemyAttacking ? 'rotate-[160deg]' : 'rotate-45'
                  }`}
                >
                  <div className="absolute left-0 w-3.5 h-3.5 bg-rose-200 rounded-full -translate-y-0.5" />
                </div>
              </div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-4 bg-black/50 blur-md rounded-full scale-y-50" />
              {opponent && (
                <div
                  className="absolute -bottom-14 left-1/2 -translate-x-1/2 text-xs font-display tracking-wider whitespace-nowrap"
                  style={{ color: opponent.accent }}
                >
                  {opponent.name}
                </div>
              )}
            </div>

            {/* Feedback floating banner */}
            {feedback && (
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 text-center pointer-events-none z-50 mix-blend-screen">
                <h2
                  className={`font-display text-5xl md:text-7xl font-black italic tracking-tighter scale-150 transition-all duration-75 ${
                    feedback.type === CounterResult.PERFECT
                      ? 'text-white drop-shadow-[0_0_15px_#38bdf8] scale-[2]'
                      : ''
                  } ${feedback.type === CounterResult.GOOD ? 'text-amber-300 drop-shadow-[0_0_10px_#fbbf24]' : ''} ${
                    feedback.type === CounterResult.FEINT ||
                    feedback.type === CounterResult.WRONG_SIDE ||
                    feedback.type === CounterResult.EARLY ||
                    feedback.type === CounterResult.MISS ||
                    feedback.type === CounterResult.LATE
                      ? 'text-rose-500 shake'
                      : ''
                  }`}
                >
                  {feedback.text}
                </h2>
              </div>
            )}
          </div>

          {/* Bottom Center: Practice / Versus exit button + Keyboard HUD */}
          <div className="w-full flex flex-col items-center gap-2 pointer-events-auto">
            {(isPractice || isVersus) && gameActive && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  finalizeRank(stats.current);
                  if (isVersus && stats.current.versusWinner == null) {
                    if (stats.current.versusP1 > stats.current.versusP2) {
                      stats.current.versusWinner = 1;
                    } else if (stats.current.versusP2 > stats.current.versusP1) {
                      stats.current.versusWinner = 2;
                    }
                  }
                  onGameOver({ ...stats.current });
                }}
                className="px-5 py-1.5 rounded-lg bg-slate-800/90 border border-emerald-500/50 text-emerald-300 font-display text-xs tracking-wider hover:bg-slate-700 transition-colors"
              >
                {isVersus ? '結束對戰' : '結束練習'}
              </button>
            )}

            <KeyboardHud isVersus={isVersus} />
          </div>
        </div>

        {/* Right Wing (Desktop xl) */}
        <div className="hidden xl:flex flex-col w-72 gap-2.5 z-30 pointer-events-auto max-h-[82vh] overflow-y-auto cockpit-scroll my-auto">
          <DanRankBadge status={danRankStatus} />
          <OpponentDossierCard
            opponent={opponent}
            playMode={playMode}
            stats={opponent ? ladder.opponentBests[opponent.id] : undefined}
            difficultyTier={effectiveBaseTier}
          />
          <BushidoScrolls />
        </div>
      </div>

      {/* Mobile / Tablet Slide-in Drawers */}
      {mobileDrawer === 'left' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in pointer-events-auto">
          <div className="relative w-full max-w-sm bg-slate-900 border border-cyan-500/40 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-display text-sm font-bold text-cyan-300">
                居合反應神經光譜儀
              </span>
              <button
                type="button"
                onClick={() => setMobileDrawer(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="關閉"
              >
                <X size={18} />
              </button>
            </div>
            <ReactionSpectrumRadar
              history={stats.current.history}
              perfectWindowMs={timingWindows.perfect}
              goodWindowMs={timingWindows.good}
              bestReactionMs={currentBestReactionMs}
              avgReactionMs={currentAvgReactionMs}
              latestRecord={latestRecord}
            />
            <ZenFlowWaveform
              combo={stats.current.combo}
              isSheathed={isSheathed}
              isSlashing={isSlashing}
              reactionRank={stats.current.rank}
            />
          </div>
        </div>
      )}

      {mobileDrawer === 'right' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in pointer-events-auto">
          <div className="relative w-full max-w-sm bg-slate-900 border border-emerald-500/40 rounded-2xl p-4 shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-display text-sm font-bold text-emerald-300">
                天下劍豪錄與武士心法
              </span>
              <button
                type="button"
                onClick={() => setMobileDrawer(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="關閉"
              >
                <X size={18} />
              </button>
            </div>
            <DanRankBadge status={danRankStatus} />
            <OpponentDossierCard
              opponent={opponent}
              playMode={playMode}
              stats={opponent ? ladder.opponentBests[opponent.id] : undefined}
              difficultyTier={effectiveBaseTier}
            />
            <BushidoScrolls />
          </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
