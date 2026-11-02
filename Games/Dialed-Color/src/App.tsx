import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Layers,
  RotateCcw,
  ChevronRight,
  Info,
  Shield,
  Eye,
  TrendingUp,
  Calendar,
  Blend,
  Contrast,
  Timer,
  Infinity as InfinityIcon,
  Share2,
  BarChart3,
  Accessibility,
  Palette,
  Zap,
  Radio,
  Sliders,
} from 'lucide-react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playLose, playScore, playWin, playGoal, playMove } from '@clubhouse/shared/synthAudio';
import { calculateScore, scoreToAccuracy, scoreEmoji } from './score.mjs';
import {
  ASCENT_LEVELS,
  ASCENT_PASS,
  ASCENT_SHOW_MS,
  BLITZ_DURATION_MS,
  BLITZ_SHOW_MS,
  HARMONY_SHOW_MS,
  MIX_SHOW_MS,
  buildTargets,
  looseRand,
  survivalParams,
} from './colors.mjs';
import { computeStreak, dailyTargets, dateKey } from './daily.mjs';
import {
  loadBests,
  saveBests,
  loadStats,
  recordGame,
  overallAverage,
  modeAverage,
  loadDailyRecords,
  upsertDaily,
  loadPrefs,
  savePrefs,
} from './storage.mjs';
import { buildDailyShareText, copyText } from './share.mjs';
import { GameState, GameMode, Color, BestRecords, GameStats, Prefs, ShowMs, MODE_LABELS } from './types';
import { ColorComparison } from './components/ColorComparison';
import { FeedbackReveal } from './components/FeedbackReveal';
import { Swatch } from './components/Swatch';
import { AnimatedNumber } from './components/AnimatedNumber';
import { ChromaRadar } from './components/ChromaRadar';
import { ChromaStarMap } from './components/ChromaStarMap';
import { ChromaWheelDial } from './components/ChromaWheelDial';
import { MatrixLights } from './components/MatrixLights';
import { TacticalMobileBar, MobileTab } from './components/TacticalMobileBar';

const SHOW_MS_OPTIONS: ShowMs[] = [3000, 2000, 1000];
const SHOW_MS_LABELS: Record<ShowMs, string> = {
  3000: '3 秒',
  2000: '2 秒',
  1000: '1 秒',
};

const scoreVerdict = (score: number): string => {
  if (score >= 950) return '色感近乎完美。';
  if (score >= 850) return '設計師等級的眼睛。';
  if (score >= 700) return '穩穩在平均之上。';
  if (score >= 500) return '還行，再練幾局會更準。';
  if (score >= 300) return '色相飄了不少，慢慢來。';
  return '這局偏離很大，再試一次。';
};

function hslToHsb(h: number, s: number, l: number) {
  const s1 = s / 100;
  const l1 = l / 100;
  const v = l1 + s1 * Math.min(l1, 1 - l1);
  const sHsb = v === 0 ? 0 : 2 * (1 - l1 / v);
  return { h: Math.round(h), s: Math.round(sHsb * 100), b: Math.round(v * 100) };
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('landing');
  const [gameMode, setGameMode] = useState<GameMode>('single');
  const [showMs, setShowMs] = useState<ShowMs>(2000);
  const [targetColors, setTargetColors] = useState<Color[]>([]);
  const [mixPairs, setMixPairs] = useState<[Color, Color][] | null>(null);
  const [refs, setRefs] = useState<Color[] | null>(null);
  const [prompts, setPrompts] = useState<string[] | null>(null);
  const [userGuesses, setUserGuesses] = useState<Color[]>([]);
  const [roundScores, setRoundScores] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentColor, setCurrentColor] = useState<Color>({ h: 180, s: 50, l: 50 });
  const [showTarget, setShowTarget] = useState(false);
  const [showModal, setShowModal] = useState<'privacy' | 'scoring' | null>(null);
  const [bests, setBests] = useState<BestRecords>(() => loadBests());
  const [stats, setStats] = useState<GameStats>(() => loadStats());
  const [dailyRecords, setDailyRecords] = useState(() => loadDailyRecords());
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [ascentFailed, setAscentFailed] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [showGen, setShowGen] = useState(0);
  const [blitzLeftMs, setBlitzLeftMs] = useState(BLITZ_DURATION_MS);
  const [copied, setCopied] = useState(false);
  const [survivalCleared, setSurvivalCleared] = useState(0);
  const [activeSlider, setActiveSlider] = useState<'h' | 's' | 'l'>('h');
  const [mobileTab, setMobileTab] = useState<MobileTab>('cockpit');

  const blitzEndRef = useRef(0);
  const finishedRef = useRef(false);
  const todayKey = useMemo(() => dateKey(), []);
  const dailyStreak = useMemo(
    () => computeStreak(dailyRecords, todayKey),
    [dailyRecords, todayKey],
  );
  const todayDone = dailyRecords.some((r) => r.date === todayKey);

  const colorBlind = prefs.colorBlind;

  const totalColors = useMemo(() => {
    if (gameMode === 'single' || gameMode === 'mix' || gameMode === 'complement' || gameMode === 'analogous')
      return 1;
    if (gameMode === 'challenge' || gameMode === 'daily') return 5;
    if (gameMode === 'ascent') return ASCENT_LEVELS;
    return targetColors.length;
  }, [gameMode, targetColors.length]);

  const showDurationMs = useMemo(() => {
    if (gameMode === 'ascent') return ASCENT_SHOW_MS[Math.min(currentStep, ASCENT_LEVELS - 1)];
    if (gameMode === 'blitz') return BLITZ_SHOW_MS;
    if (gameMode === 'survival') return survivalParams(currentStep).showMs;
    if (gameMode === 'mix') return MIX_SHOW_MS;
    if (gameMode === 'complement' || gameMode === 'analogous') return HARMONY_SHOW_MS;
    if (gameMode === 'daily') return 2000;
    return showMs;
  }, [gameMode, currentStep, showMs]);

  const msKey = String(showMs);
  const bestScore = bests.bestScoreByMs[msKey] || 0;
  const bestAverage = bests.bestAverageByMs[msKey] || 0;

  const ambientHue = useMemo(() => {
    if (gameState === 'showing' && targetColors[currentStep]) return targetColors[currentStep].h;
    if (gameState === 'guessing' || gameState === 'feedback') return currentColor.h;
    if (gameState === 'results' && targetColors[0]) return targetColors[0].h;
    return 28;
  }, [gameState, targetColors, currentStep, currentColor.h]);

  const beginShowing = useCallback(() => {
    setShowGen((g) => g + 1);
    setGameState('showing');
  }, []);

  const startGame = useCallback((mode: GameMode) => {
    playMove();
    let pack;
    if (mode === 'daily') {
      pack = dailyTargets(todayKey);
    } else {
      pack = buildTargets(mode, looseRand);
    }
    setGameMode(mode);
    setTargetColors(pack.targets);
    setMixPairs(pack.mixPairs ?? null);
    setRefs(pack.refs ?? null);
    setPrompts(pack.prompts ?? null);
    setUserGuesses([]);
    setRoundScores([]);
    setCurrentStep(0);
    setCurrentColor({ h: 180, s: 50, l: 50 });
    setAscentFailed(false);
    setIsNewBest(false);
    setShowResultOverlay(false);
    setSurvivalCleared(0);
    setCopied(false);
    finishedRef.current = false;
    setMobileTab('cockpit');
    if (mode === 'blitz') {
      blitzEndRef.current = Date.now() + BLITZ_DURATION_MS;
      setBlitzLeftMs(BLITZ_DURATION_MS);
    }
    beginShowing();
  }, [todayKey, beginShowing]);

  const flashTarget = useCallback(() => {
    setShowTarget(true);
    window.setTimeout(() => setShowTarget(false), 500);
  }, []);

  const toggleColorBlind = () => {
    const next = { colorBlind: !prefs.colorBlind };
    setPrefs(next);
    savePrefs(next);
  };

  // Showing timer
  useEffect(() => {
    if (gameState !== 'showing') return;

    if (gameMode === 'challenge' || gameMode === 'daily') {
      setCurrentStep(0);
      let step = 0;
      const timer = window.setInterval(() => {
        step += 1;
        if (step >= 5) {
          window.clearInterval(timer);
          setCurrentStep(0);
          setGameState('guessing');
          return;
        }
        setCurrentStep(step);
      }, showDurationMs);
      return () => window.clearInterval(timer);
    }

    const timer = window.setTimeout(() => setGameState('guessing'), showDurationMs);
    return () => window.clearTimeout(timer);
  }, [gameState, showGen, gameMode, showDurationMs]);

  // Blitz countdown
  useEffect(() => {
    if (gameMode !== 'blitz' || gameState === 'landing' || gameState === 'results' || gameState === 'stats' || gameState === 'matrix')
      return;
    const id = window.setInterval(() => {
      setBlitzLeftMs(Math.max(0, blitzEndRef.current - Date.now()));
    }, 200);
    return () => window.clearInterval(id);
  }, [gameMode, gameState]);

  const finishRun = useCallback(
    (guesses: Color[], scores: number[], failed: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const maxRound = scores.length ? Math.max(...scores) : 0;
      const ascentLevel = failed ? Math.max(0, guesses.length - 1) : guesses.length;
      const survivalCount = failed ? Math.max(0, guesses.length - 1) : guesses.length;
      const blitzTotal = scores.reduce((a, b) => a + b, 0);

      const next: BestRecords = {
        ...bests,
        bestScoreByMs: { ...bests.bestScoreByMs },
        bestAverageByMs: { ...bests.bestAverageByMs },
        bestByMode: { ...bests.bestByMode },
      };
      let newBest = false;

      if (gameMode === 'single' || gameMode === 'challenge') {
        const key = String(showMs);
        if (maxRound > (next.bestScoreByMs[key] || 0)) {
          next.bestScoreByMs[key] = maxRound;
          newBest = true;
        }
        if (!failed && avg > (next.bestAverageByMs[key] || 0)) {
          next.bestAverageByMs[key] = avg;
          newBest = true;
        }
      }
      if (gameMode === 'ascent' && ascentLevel > next.bestAscentLevel) {
        next.bestAscentLevel = ascentLevel;
        newBest = true;
      }
      if (gameMode === 'survival' && survivalCount > next.bestSurvival) {
        next.bestSurvival = survivalCount;
        newBest = true;
      }
      if (gameMode === 'blitz' && blitzTotal > next.bestBlitz) {
        next.bestBlitz = blitzTotal;
        newBest = true;
      }
      const modeScore =
        gameMode === 'blitz' ? blitzTotal : gameMode === 'survival' ? survivalCount : avg;
      if (modeScore > (next.bestByMode[gameMode] || 0)) {
        next.bestByMode[gameMode] = modeScore;
        newBest = true;
      }

      setBests(next);
      saveBests(next);
      setStats(recordGame(stats, gameMode, avg));
      setIsNewBest(newBest);
      setAscentFailed(failed);
      setSurvivalCleared(survivalCount);
      setShowResultOverlay(true);
      setGameState('results');

      if (gameMode === 'daily' && scores.length === 5) {
        const updated = upsertDaily(dailyRecords, {
          date: todayKey,
          average: avg,
          scores,
        });
        setDailyRecords(updated);
      }

      if (failed) playLose();
      else if (newBest || avg >= 700) playWin();
      else playLose();
    },
    [bests, stats, gameMode, showMs, dailyRecords, todayKey],
  );

  // When blitz timer hits zero mid-round, finalize
  useEffect(() => {
    if (gameMode !== 'blitz' || blitzLeftMs > 0) return;
    if (gameState === 'results' || gameState === 'landing' || gameState === 'matrix') return;
    finishRun(userGuesses, roundScores, false);
  }, [blitzLeftMs, gameMode, gameState, userGuesses, roundScores, finishRun]);

  const continueAfterFeedback = useCallback(() => {
    playMove();
    if (gameMode === 'ascent') {
      const score = roundScores[roundScores.length - 1] ?? 0;
      if (score < ASCENT_PASS) {
        finishRun(userGuesses, roundScores, true);
        return;
      }
      if (currentStep >= ASCENT_LEVELS - 1) {
        finishRun(userGuesses, roundScores, false);
        return;
      }
      setCurrentStep(currentStep + 1);
      setCurrentColor({ h: 180, s: 50, l: 50 });
      beginShowing();
      return;
    }

    if (gameMode === 'survival') {
      const score = roundScores[roundScores.length - 1] ?? 0;
      const pass = survivalParams(currentStep).pass;
      if (score < pass) {
        finishRun(userGuesses, roundScores, true);
        return;
      }
      if (currentStep >= targetColors.length - 1) {
        finishRun(userGuesses, roundScores, false);
        return;
      }
      setCurrentStep(currentStep + 1);
      setCurrentColor({ h: 180, s: 50, l: 50 });
      beginShowing();
      return;
    }

    if (gameMode === 'blitz') {
      if (blitzLeftMs <= 0 || currentStep >= targetColors.length - 1) {
        finishRun(userGuesses, roundScores, false);
        return;
      }
      setCurrentStep(currentStep + 1);
      setCurrentColor({ h: 180, s: 50, l: 50 });
      beginShowing();
      return;
    }

    if (currentStep < totalColors - 1) {
      setCurrentStep(currentStep + 1);
      setCurrentColor({ h: 180, s: 50, l: 50 });
      if (gameMode === 'challenge' || gameMode === 'daily') {
        setGameState('guessing');
      } else {
        beginShowing();
      }
    } else {
      finishRun(userGuesses, roundScores, false);
    }
  }, [
    gameMode,
    roundScores,
    currentStep,
    totalColors,
    targetColors.length,
    blitzLeftMs,
    userGuesses,
    beginShowing,
    finishRun,
  ]);

  const handleGuess = useCallback(() => {
    playScore();
    const newGuesses = [...userGuesses, currentColor];
    const roundScore = calculateScore(targetColors[currentStep], currentColor);
    const newScores = [...roundScores, roundScore];
    setUserGuesses(newGuesses);
    setRoundScores(newScores);
    if (roundScore >= 850) playGoal();
    setGameState('feedback');
  }, [userGuesses, currentColor, targetColors, currentStep, roundScores]);

  const handleShare = async () => {
    const text = buildDailyShareText({
      date: todayKey,
      scores: roundScores,
      average: averageScore,
      streak: dailyStreak,
    });
    const ok = await copyText(text);
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  };

  const totalScore = roundScores.reduce((a, b) => a + b, 0);
  const averageScore = roundScores.length ? Math.round(totalScore / roundScores.length) : 0;
  const overlayVariant = ascentFailed ? 'lose' : averageScore >= 700 ? 'win' : 'neutral';
  const overlayTitle = ascentFailed
    ? gameMode === 'survival'
      ? `生存結束 · ${survivalCleared} 關`
      : `闖關失敗 · 第 ${userGuesses.length} 關`
    : gameMode === 'ascent'
      ? '闖關成功'
      : gameMode === 'daily'
        ? '每日挑戰完成'
        : gameMode === 'blitz'
          ? '閃擊結束'
          : '本局結果';

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;
      if (e.target instanceof HTMLTextAreaElement) return;

      if (gameState === 'guessing') {
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          setCurrentColor((prev) => {
            if (activeSlider === 'h') return { ...prev, h: (((prev.h - step) % 360) + 360) % 360 };
            if (activeSlider === 's') return { ...prev, s: Math.max(0, prev.s - step) };
            return { ...prev, l: Math.max(0, prev.l - step) };
          });
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          setCurrentColor((prev) => {
            if (activeSlider === 'h') return { ...prev, h: (prev.h + step) % 360 };
            if (activeSlider === 's') return { ...prev, s: Math.min(100, prev.s + step) };
            return { ...prev, l: Math.min(100, prev.l + step) };
          });
        } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          setActiveSlider((cur) => (cur === 'l' ? 's' : cur === 's' ? 'h' : 'l'));
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          setActiveSlider((cur) => (cur === 'h' ? 's' : cur === 's' ? 'l' : 'h'));
        } else if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          handleGuess();
        } else if (e.key === 'h' || e.key === 'H' || e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          flashTarget();
        } else if (e.key >= '1' && e.key <= '6') {
          const anchors = [0, 60, 120, 180, 240, 300];
          const idx = parseInt(e.key, 10) - 1;
          if (anchors[idx] != null) {
            setCurrentColor((prev) => ({ ...prev, h: anchors[idx] }));
          }
        }
      } else if (gameState === 'feedback') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          continueAfterFeedback();
        }
      }

      if (e.key === 'r' || e.key === 'R') {
        if (gameState === 'results' || gameState === 'feedback') {
          e.preventDefault();
          startGame(gameMode);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, activeSlider, gameMode, handleGuess, continueAfterFeedback, startGame, flashTarget]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start p-3 sm:p-6 overflow-x-hidden cockpit-grid"
      style={{ ['--ambient-h' as string]: String(ambientHue) }}
    >
      <div
        className="stage-bg"
        aria-hidden
        style={{
          backgroundImage: [
            'radial-gradient(ellipse 80% 60% at 15% 20%, hsl(var(--ambient-h, 28) 45% 22% / 0.55), transparent 55%)',
            'radial-gradient(ellipse 70% 50% at 85% 75%, hsl(calc(var(--ambient-h, 28) + 140) 40% 18% / 0.45), transparent 50%)',
            'radial-gradient(ellipse 50% 40% at 50% 100%, hsl(calc(var(--ambient-h, 28) + 40) 35% 14% / 0.35), transparent 45%)',
            'linear-gradient(165deg, rgba(16,13,20,0.85) 0%, rgba(10,8,14,0.92) 55%, rgba(12,10,18,0.95) 100%)',
            `url(${import.meta.env.BASE_URL}studio-bg.jpg)`,
          ].join(', '),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <BackToMenu />

      {/* Main Cockpit Stage Container */}
      <div className="stage-content w-full max-w-7xl flex flex-col items-center justify-center py-6 sm:py-10">
        {/* Mobile Tactical Bar (Visible < lg screens) */}
        <TacticalMobileBar
          activeTab={mobileTab}
          onTabChange={setMobileTab}
          currentColor={currentColor}
          hasMatrixMode={true}
        />

        {/* Triple-Wing Cockpit Layout: Left Wing (Radar), Center Core, Right Wing (Star Map) */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] xl:grid-cols-[320px_1fr_320px] items-start gap-6">
          {/* Left Wing HUD: Chroma Tactical Radar (Desktop or Mobile Tab) */}
          <aside
            className={`w-full flex-col gap-4 ${
              mobileTab === 'radar' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <ChromaRadar
              color={currentColor}
              targetColor={targetColors[currentStep] ?? null}
              showTargetGhost={showTarget || gameState === 'feedback' || gameState === 'results'}
              onColorChange={(c) => setCurrentColor(c)}
              interactive={gameState === 'guessing' || gameState === 'landing'}
              score={averageScore}
              streak={dailyStreak}
            />
          </aside>

          {/* Center Stage: Core Reactor Cockpit */}
          <main
            className={`w-full flex flex-col items-center justify-center ${
              mobileTab === 'cockpit' || (mobileTab === 'matrix' && gameState === 'matrix')
                ? 'flex'
                : 'hidden lg:flex'
            }`}
          >
            <AnimatePresence mode="wait">
              {/* Matrix Mode */}
              {gameState === 'matrix' && (
                <motion.div
                  key="matrix-mode"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="w-full flex justify-center"
                >
                  <MatrixLights
                    accentHue={currentColor.h}
                    onBack={() => setGameState('landing')}
                  />
                </motion.div>
              )}

              {/* Landing Page */}
              {gameState === 'landing' && (
                <motion.div
                  key="landing"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="max-w-lg w-full text-center space-y-7"
                >
                  <div className="space-y-4">
                    <motion.div
                      className="mx-auto flex gap-1.5 justify-center"
                      initial="hidden"
                      animate="show"
                      variants={{
                        hidden: {},
                        show: { transition: { staggerChildren: 0.08 } },
                      }}
                      aria-hidden
                    >
                      {[12, 48, 168, 210, 320].map((h) => (
                        <motion.span
                          key={h}
                          variants={{
                            hidden: { opacity: 0, y: 8 },
                            show: { opacity: 1, y: 0 },
                          }}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl relative overflow-hidden shadow-lg border border-white/20"
                          style={{
                            background: `hsl(${h} 75% 55%)`,
                            boxShadow: `0 0 16px hsl(${h} 90% 50% / 0.4)`,
                          }}
                        >
                          {colorBlind && (
                            <span className={`cb-pattern cb-pattern-${Math.floor(h / 60)}`} />
                          )}
                        </motion.span>
                      ))}
                    </motion.div>

                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-400/30 text-cyan-300 font-mono text-xs">
                      <Radio size={13} className="text-cyan-400 animate-pulse" />
                      <span>色相光譜戰情駕駛艙 · SYNTHWAVE LAB</span>
                    </div>

                    <h1 className="brand-mark text-[clamp(2.75rem,9vw,4.5rem)] text-[var(--color-paper)] tracking-tight">
                      色感記憶
                    </h1>
                    <p className="text-[var(--color-muted)] text-base sm:text-lg leading-relaxed max-w-sm mx-auto">
                      人眼很難精準定量色彩。記憶兩秒光譜，透過光波雷達與微調光軌重現色彩！
                    </p>

                    <div className="flex justify-center gap-2" role="group" aria-label="記憶秒數">
                      {SHOW_MS_OPTIONS.map((ms) => {
                        const selected = showMs === ms;
                        return (
                          <button
                            key={ms}
                            type="button"
                            onClick={() => setShowMs(ms)}
                            aria-pressed={selected}
                            className={`min-h-[44px] px-3.5 py-2 text-sm rounded-xl border transition-all ${
                              selected
                                ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-md font-semibold'
                                : 'border-white/10 text-[var(--color-muted)] hover:border-white/30'
                            }`}
                          >
                            {SHOW_MS_LABELS[ms]}
                          </button>
                        );
                      })}
                    </div>

                    <p className="font-mono text-xs text-[var(--color-muted)] tabular-nums">
                      最佳單分 {bestScore} · 最佳平均 {bestAverage}
                      {bests.bestAscentLevel > 0 ? ` · 闖關 ${bests.bestAscentLevel}/${ASCENT_LEVELS}` : ''}
                      {dailyStreak > 0 ? ` · 每日連勝 ${dailyStreak}` : ''}
                      <span className="opacity-70"> · {SHOW_MS_LABELS[showMs]}</span>
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5 max-w-sm mx-auto w-full">
                    {/* Matrix Lights Out Mode Entry */}
                    <button
                      type="button"
                      onClick={() => {
                        playMove();
                        setGameState('matrix');
                      }}
                      className="btn-primary w-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-black font-bold shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                    >
                      <Zap size={18} fill="currentColor" />
                      光矩陣點燈解鎖（GF(2) 線性波求解）
                    </button>

                    <button
                      type="button"
                      onClick={() => startGame('daily')}
                      className="btn-primary w-full bg-cyan-400 hover:bg-cyan-300 text-black font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                    >
                      <Calendar size={17} />
                      每日挑戰{todayDone ? '（已完成，可再練）' : ''}
                    </button>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button type="button" onClick={() => startGame('single')} className="btn-secondary w-full text-sm">
                        <Play size={16} fill="currentColor" />
                        單色挑戰
                      </button>
                      <button type="button" onClick={() => startGame('challenge')} className="btn-secondary w-full text-sm">
                        <Layers size={16} />
                        五色連續
                      </button>
                      <button type="button" onClick={() => startGame('ascent')} className="btn-secondary w-full text-sm">
                        <TrendingUp size={16} />
                        闖關模式
                      </button>
                      <button type="button" onClick={() => startGame('survival')} className="btn-secondary w-full text-sm">
                        <InfinityIcon size={16} />
                        無盡生存
                      </button>
                      <button type="button" onClick={() => startGame('mix')} className="btn-secondary w-full text-sm">
                        <Blend size={16} />
                        混色調配
                      </button>
                      <button type="button" onClick={() => startGame('complement')} className="btn-secondary w-full text-sm">
                        <Contrast size={16} />
                        互補色
                      </button>
                      <button type="button" onClick={() => startGame('analogous')} className="btn-secondary w-full text-sm">
                        <Palette size={16} />
                        類似色
                      </button>
                      <button type="button" onClick={() => startGame('blitz')} className="btn-secondary w-full text-sm">
                        <Timer size={16} />
                        限時閃擊
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={toggleColorBlind}
                      className="link-quiet inline-flex items-center gap-1"
                      aria-pressed={colorBlind}
                    >
                      <Accessibility size={13} />
                      色盲友善{colorBlind ? '：開' : '：關'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGameState('stats')}
                      className="link-quiet inline-flex items-center gap-1"
                    >
                      <BarChart3 size={13} /> 統計
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal('scoring')}
                      className="link-quiet inline-flex items-center gap-1"
                    >
                      <Info size={13} /> 計分
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal('privacy')}
                      className="link-quiet inline-flex items-center gap-1"
                    >
                      <Shield size={13} /> 隱私
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Stats View */}
              {gameState === 'stats' && (
                <motion.div
                  key="stats"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="max-w-md w-full space-y-6 text-left"
                >
                  <div className="text-center space-y-2">
                    <h2 className="brand-mark text-3xl">統計與紀錄</h2>
                    <p className="text-sm text-[var(--color-muted)]">
                      總平均準確度 {scoreToAccuracy(overallAverage(stats))}% · 已玩 {stats.gamesPlayed} 局
                    </p>
                    <p className="font-mono text-xs text-[var(--color-muted)]">
                      每日連勝 {dailyStreak} · 生存最佳 {bests.bestSurvival} · 閃擊最佳 {bests.bestBlitz}
                    </p>
                  </div>
                  <div className="panel p-4 space-y-2">
                    {(Object.keys(MODE_LABELS) as GameMode[]).map((m) => (
                      <div key={m} className="flex justify-between text-sm py-1 border-b border-[var(--color-line)] last:border-0">
                        <span className="text-[var(--color-muted)]">{MODE_LABELS[m]}</span>
                        <span className="font-mono tabular-nums">
                          均 {modeAverage(stats, m) || '—'} · 佳 {bests.bestByMode[m] || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {stats.history.length > 0 && (
                    <div className="panel p-4 space-y-2 max-h-48 overflow-y-auto">
                      <p className="kicker">近期對局</p>
                      {stats.history.slice(0, 12).map((h, i) => (
                        <div key={`${h.at}-${i}`} className="flex justify-between text-xs font-mono tabular-nums">
                          <span>{MODE_LABELS[h.mode as GameMode] ?? h.mode}</span>
                          <span>
                            {scoreEmoji(h.average)} {h.average}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => setGameState('landing')} className="btn-secondary w-full">
                    回首頁
                  </button>
                </motion.div>
              )}

              {/* Showing Phase */}
              {gameState === 'showing' && (
                <motion.div
                  key={`showing-${currentStep}-${gameMode}-${showGen}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-8 w-full max-w-md"
                >
                  <p className="kicker">
                    {gameMode === 'ascent' &&
                      `闖關 · 第 ${currentStep + 1} / ${ASCENT_LEVELS} 關 · ${(showDurationMs / 1000).toFixed(1)} 秒`}
                    {gameMode === 'survival' &&
                      `生存 · 第 ${currentStep + 1} 關 · ${(showDurationMs / 1000).toFixed(1)} 秒 · 需 ${survivalParams(currentStep).pass}+`}
                    {gameMode === 'blitz' && `閃擊 · 剩 ${(blitzLeftMs / 1000).toFixed(1)} 秒`}
                    {gameMode === 'mix' && '記住兩色，調出混色結果'}
                    {(gameMode === 'complement' || gameMode === 'analogous') && (prompts?.[0] ?? '記住參考色')}
                    {(gameMode === 'single' || gameMode === 'challenge' || gameMode === 'daily') &&
                      `記住這顏色 · ${currentStep + 1} / ${totalColors}`}
                  </p>

                  {gameMode === 'mix' && mixPairs?.[0] ? (
                    <div className="flex gap-3 w-full justify-center">
                      <Swatch color={mixPairs[0][0]} colorBlind={colorBlind} className="w-[min(36vw,9rem)] aspect-square shadow-2xl" />
                      <Swatch color={mixPairs[0][1]} colorBlind={colorBlind} className="w-[min(36vw,9rem)] aspect-square shadow-2xl" />
                    </div>
                  ) : (gameMode === 'complement' || gameMode === 'analogous') && refs?.[0] ? (
                    <Swatch
                      color={refs[0]}
                      colorBlind={colorBlind}
                      className="w-[min(72vw,18rem)] aspect-square shadow-2xl"
                      label="參考色"
                    />
                  ) : (
                    <Swatch
                      color={targetColors[currentStep]}
                      colorBlind={colorBlind}
                      className="w-[min(72vw,18rem)] aspect-square shadow-2xl"
                    />
                  )}

                  <div className="progress-rail">
                    <motion.div
                      key={`bar-${currentStep}-${showDurationMs}-${showGen}`}
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: showDurationMs / 1000, ease: 'linear' }}
                      className="progress-fill bg-gradient-to-r from-cyan-400 to-fuchsia-400"
                    />
                  </div>
                </motion.div>
              )}

              {/* Guessing Phase with Circular Wheel Dial */}
              {gameState === 'guessing' && (
                <motion.div
                  key="guessing"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="max-w-md w-full space-y-6"
                >
                  <div className="flex justify-between items-center px-1">
                    <p className="kicker">
                      {gameMode === 'ascent' && `重現 · 第 ${currentStep + 1} 關（需 ${ASCENT_PASS}+）`}
                      {gameMode === 'survival' &&
                        `重現 · 第 ${currentStep + 1} 關（需 ${survivalParams(currentStep).pass}+）`}
                      {gameMode === 'blitz' && `重現 · 剩 ${(blitzLeftMs / 1000).toFixed(1)}s`}
                      {gameMode === 'mix' && '調出混色'}
                      {(gameMode === 'complement' || gameMode === 'analogous') && (prompts?.[0] ?? '調出色相關係色')}
                      {(gameMode === 'single' || gameMode === 'challenge' || gameMode === 'daily') &&
                        `重現 · ${currentStep + 1} / ${totalColors}`}
                    </p>
                    {gameMode !== 'blitz' && gameMode !== 'survival' && (
                      <div className="flex gap-2" aria-hidden>
                        {Array.from({ length: Math.min(totalColors, 8) }).map((_, i) => (
                          <span
                            key={i}
                            className={`step-dot ${i === currentStep ? 'is-active bg-cyan-400' : i < currentStep ? 'is-done' : ''}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* High-Tech Circular Wheel & Sliders */}
                  <ChromaWheelDial
                    color={currentColor}
                    targetColor={targetColors[currentStep]}
                    showTarget={showTarget}
                    colorBlind={colorBlind}
                    onChange={(c) => setCurrentColor(c)}
                    activeSlider={activeSlider}
                    onSelectSlider={setActiveSlider}
                  />

                  {/* Actions: Peek & Submit */}
                  <div className="flex gap-3 pt-1">
                    {gameMode !== 'blitz' && (
                      <button
                        type="button"
                        onMouseDown={flashTarget}
                        onMouseUp={() => setShowTarget(false)}
                        onMouseLeave={() => setShowTarget(false)}
                        onTouchStart={flashTarget}
                        onTouchEnd={() => setShowTarget(false)}
                        className="btn-secondary flex-1"
                      >
                        <Eye size={16} />
                        透視提示
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleGuess}
                      className="btn-primary flex-[1.6] bg-cyan-400 hover:bg-cyan-300 text-black font-bold shadow-[0_0_20px_rgba(6,182,212,0.35)]"
                    >
                      確認提交
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Feedback Phase */}
              {gameState === 'feedback' && userGuesses.length > 0 && (
                <FeedbackReveal
                  key={`fb-${userGuesses.length}`}
                  target={targetColors[currentStep]}
                  guess={userGuesses[userGuesses.length - 1]}
                  score={roundScores[roundScores.length - 1]}
                  colorBlind={colorBlind}
                  onContinue={continueAfterFeedback}
                  continueLabel={
                    gameMode === 'single' ||
                    gameMode === 'mix' ||
                    gameMode === 'complement' ||
                    gameMode === 'analogous' ||
                    (gameMode !== 'blitz' &&
                      gameMode !== 'survival' &&
                      gameMode !== 'ascent' &&
                      currentStep >= totalColors - 1)
                      ? '看結果'
                      : '繼續'
                  }
                />
              )}

              {/* Results Phase */}
              {gameState === 'results' && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="max-w-2xl w-full space-y-10 text-center px-1"
                >
                  <div className="space-y-3">
                    <p className="kicker">
                      {gameMode === 'blitz' ? '閃擊總分' : gameMode === 'survival' ? '生存關數' : '本局平均分'}
                    </p>
                    <div className="flex items-baseline justify-center gap-3">
                      <div className="brand-mark text-[clamp(3.5rem,14vw,5.5rem)] tabular-nums leading-none">
                        <AnimatedNumber
                          value={gameMode === 'blitz' ? totalScore : gameMode === 'survival' ? survivalCleared : averageScore}
                        />
                      </div>
                      {gameMode !== 'survival' && (
                        <div className="font-mono text-xl text-[var(--color-muted)] tabular-nums">
                          <AnimatedNumber value={scoreToAccuracy(averageScore)} />
                          <span className="text-sm ml-0.5">%</span>
                        </div>
                      )}
                    </div>
                    {gameMode === 'daily' && roundScores.length > 0 && (
                      <p className="text-2xl tracking-widest" aria-label="分享色格">
                        {roundScores.map((s) => scoreEmoji(s)).join('')}
                      </p>
                    )}
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.1 }}
                      className="text-[var(--color-muted)] text-base max-w-sm mx-auto"
                    >
                      {ascentFailed
                        ? gameMode === 'survival'
                          ? `未達門檻，停在第 ${userGuesses.length} 關。`
                          : `未達 ${ASCENT_PASS} 分門檻，停在第 ${userGuesses.length} 關。`
                        : scoreVerdict(averageScore)}
                    </motion.p>
                    <p className="font-mono text-xs text-[var(--color-muted)] tabular-nums">
                      {MODE_LABELS[gameMode]}
                      {dailyStreak > 0 ? ` · 連勝 ${dailyStreak}` : ''}
                    </p>
                  </div>

                  <div
                    className={`grid gap-4 ${
                      userGuesses.length === 1
                        ? 'grid-cols-1 max-w-[14rem] mx-auto'
                        : userGuesses.length <= 3
                          ? 'grid-cols-2 sm:grid-cols-3'
                          : 'grid-cols-2 sm:grid-cols-5'
                    }`}
                  >
                    {userGuesses.map((guess, i) => {
                      const target = targetColors[i];
                      const score = roundScores[i] ?? calculateScore(target, guess);
                      const targetHsb = hslToHsb(target.h, target.s, target.l);
                      const guessHsb = hslToHsb(guess.h, guess.s, guess.l);
                      return (
                        <div key={i} className="space-y-2 text-left">
                          <ColorComparison target={target} guess={guess} colorBlind={colorBlind} />
                          <div className="px-0.5 space-y-1">
                            <div className="text-sm font-semibold tabular-nums">
                              {scoreEmoji(score)} <AnimatedNumber value={score} duration={0.9} />
                              <span className="text-[var(--color-muted)] font-normal text-xs ml-1">分</span>
                            </div>
                            <div className="font-mono text-[10px] text-[var(--color-muted)] leading-relaxed">
                              <div>目標 H{targetHsb.h} S{targetHsb.s} B{targetHsb.b}</div>
                              <div>猜測 H{guessHsb.h} S{guessHsb.s} B{guessHsb.b}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-3 max-w-xs mx-auto w-full">
                    {gameMode === 'daily' && (
                      <button type="button" onClick={handleShare} className="btn-primary w-full">
                        <Share2 size={16} />
                        {copied ? '已複製分享文案' : '複製分享結果'}
                      </button>
                    )}
                    <div className="flex gap-3">
                      <button type="button" onClick={() => startGame(gameMode)} className="btn-primary flex-1">
                        <RotateCcw size={16} />
                        再玩一次
                      </button>
                      <button type="button" onClick={() => setGameState('landing')} className="btn-secondary flex-1">
                        回首頁
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Right Wing HUD: Chroma Star Map & Resonance Compendium (Desktop or Mobile Tab) */}
          <aside
            className={`w-full flex-col gap-4 ${
              mobileTab === 'starmap' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <ChromaStarMap
              currentColor={currentColor}
              dailyColors={gameMode === 'daily' ? targetColors : targetColors.slice(0, 5)}
              recentScores={roundScores}
              onApplyHue={(h) => setCurrentColor((prev) => ({ ...prev, h }))}
              streak={dailyStreak}
            />
          </aside>
        </div>
      </div>

      {/* Result Overlay */}
      {gameState === 'results' && showResultOverlay && (
        <ResultOverlay
          title={overlayTitle}
          subtitle={scoreVerdict(averageScore)}
          badge={isNewBest ? '新紀錄' : gameMode === 'daily' ? '每日' : undefined}
          variant={overlayVariant}
          stats={[
            {
              label: gameMode === 'blitz' ? '總分' : gameMode === 'survival' ? '關數' : '平均分',
              value:
                gameMode === 'blitz' ? totalScore : gameMode === 'survival' ? survivalCleared : averageScore,
            },
            { label: '準確度', value: `${scoreToAccuracy(averageScore)}%` },
            ...(gameMode === 'daily' ? [{ label: '連勝', value: `${dailyStreak} 天` }] : []),
            ...(gameMode === 'ascent'
              ? [{ label: '本局關卡', value: `${userGuesses.length} / ${ASCENT_LEVELS}` }]
              : gameMode === 'survival'
                ? [{ label: '最佳生存', value: bests.bestSurvival }]
                : gameMode === 'blitz'
                  ? [{ label: '最佳閃擊', value: bests.bestBlitz }]
                  : [{ label: '記憶秒數', value: SHOW_MS_LABELS[showMs] }]),
          ]}
          primaryLabel={gameMode === 'daily' ? '查看並分享' : '查看色差'}
          onPrimary={() => setShowResultOverlay(false)}
        />
      )}

      {/* Info Modals */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowModal(null)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="panel max-w-md w-full p-6 sm:p-8 space-y-5 text-left max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="brand-mark text-2xl">{showModal === 'privacy' ? '隱私' : '計分方式'}</h3>
              <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                {showModal === 'privacy'
                  ? '不蒐集個人資料。分數、統計與每日連勝僅存在你的瀏覽器本機，不會上傳。'
                  : '分數依猜測色與目標色在 HSL 空間的距離計算。完全一致為 999 分。每日挑戰以台北時區日期種子產生，當天所有人同一組色。闖關與生存需達門檻才繼續；閃擊限時 60 秒累計分數。分享結果以 🟩🟨🟧⬛ 表示各回合精準度。亦可在戰情室體驗 360° 光譜調色雷達、波長估算與光矩陣點燈解鎖模式。'}
              </p>
              <button type="button" onClick={() => setShowModal(null)} className="btn-primary w-full">
                關閉
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="stage-content fixed bottom-3 left-0 right-0 text-center kicker pointer-events-none opacity-40">
        Dialed Color · Chromatic Lab
      </p>
    </div>
  );
}
