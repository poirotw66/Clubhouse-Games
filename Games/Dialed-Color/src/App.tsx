import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, animate } from 'motion/react';
import { Play, Layers, RotateCcw, ChevronRight, Info, Shield, Eye } from 'lucide-react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { GameState, GameMode, Color } from './types';

const SHOW_DURATION = 2000;

let lastHue = -1;

const generateRandomColor = (): Color => {
  let h = Math.floor(Math.random() * 360);
  if (lastHue !== -1) {
    while (Math.abs(h - lastHue) < 45 || Math.abs(h - lastHue) > 315) {
      h = Math.floor(Math.random() * 360);
    }
  }
  lastHue = h;
  return {
    h,
    s: Math.floor(Math.random() * 85) + 10,
    l: Math.floor(Math.random() * 75) + 15,
  };
};

const colorToCss = (c: Color) => `hsl(${c.h}, ${c.s}%, ${c.l}%)`;

const hslToHsb = (h: number, s: number, l: number) => {
  const s1 = s / 100;
  const l1 = l / 100;
  const v = l1 + s1 * Math.min(l1, 1 - l1);
  const s_hsb = v === 0 ? 0 : 2 * (1 - l1 / v);
  return {
    h: Math.round(h),
    s: Math.round(s_hsb * 100),
    b: Math.round(v * 100),
  };
};

const scoreVerdict = (score: number): string => {
  if (score >= 950) return '色感近乎完美。';
  if (score >= 850) return '設計師等級的眼睛。';
  if (score >= 700) return '穩穩在平均之上。';
  if (score >= 500) return '還行，再練幾局會更準。';
  if (score >= 300) return '色相飄了不少，慢慢來。';
  return '這局偏離很大，再試一次。';
};

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.35,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value]);

  return <span>{displayValue}</span>;
}

function calculateScore(c1: Color, c2: Color): number {
  const dh = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h)) / 180;
  const ds = Math.abs(c1.s - c2.s) / 100;
  const dl = Math.abs(c1.l - c2.l) / 100;
  const distance = Math.sqrt(dh * dh + ds * ds + dl * dl);
  return Math.max(0, Math.floor(999 * (1 - distance)));
}

function ColorComparison({ target, guess }: { target: Color; guess: Color }) {
  const [sliderPos, setSliderPos] = useState(50);

  return (
    <div className="relative aspect-square rounded-xl overflow-hidden border border-[var(--color-line)] group cursor-ew-resize touch-manipulation">
      <div className="absolute inset-0" style={{ backgroundColor: colorToCss(target) }} />
      <div
        className="absolute inset-0 z-10 border-r border-white/50"
        style={{ backgroundColor: colorToCss(guess), width: `${sliderPos}%` }}
      />
      <div
        className="absolute inset-y-0 w-0.5 bg-white/90 z-20 pointer-events-none"
        style={{ left: `${sliderPos}%` }}
      />
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPos}
        onChange={(e) => setSliderPos(parseInt(e.target.value, 10))}
        className="absolute inset-0 opacity-0 cursor-ew-resize z-30"
        aria-label="比較猜測與目標"
      />
      <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[10px] font-medium tracking-wide pointer-events-none z-20">
        <span className="px-1.5 py-0.5 rounded bg-black/45">猜測</span>
        <span className="px-1.5 py-0.5 rounded bg-black/45">目標</span>
      </div>
    </div>
  );
}

function ColorSlider({
  label,
  value,
  min,
  max,
  onChange,
  suffix = '',
  gradient,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  suffix?: string;
  gradient: string;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-[var(--color-paper)]">{label}</span>
        <span className="font-mono text-xs text-[var(--color-muted)] tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="slider-track"
        style={{ background: gradient }}
        aria-label={label}
      />
    </div>
  );
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('landing');
  const [gameMode, setGameMode] = useState<GameMode>('single');
  const [targetColors, setTargetColors] = useState<Color[]>([]);
  const [userGuesses, setUserGuesses] = useState<Color[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentColor, setCurrentColor] = useState<Color>({ h: 180, s: 50, l: 50 });
  const [showTarget, setShowTarget] = useState(false);
  const [showModal, setShowModal] = useState<'privacy' | 'scoring' | null>(null);

  const totalColors = gameMode === 'single' ? 1 : 5;

  const ambientHue = useMemo(() => {
    if (gameState === 'showing' && targetColors[currentStep]) return targetColors[currentStep].h;
    if (gameState === 'guessing') return currentColor.h;
    if (gameState === 'results' && targetColors[0]) return targetColors[0].h;
    return 28;
  }, [gameState, targetColors, currentStep, currentColor.h]);

  const startGame = (mode: GameMode) => {
    const count = mode === 'single' ? 1 : 5;
    const colors = Array.from({ length: count }, generateRandomColor);
    setGameMode(mode);
    setTargetColors(colors);
    setUserGuesses([]);
    setCurrentStep(0);
    setCurrentColor({ h: 180, s: 50, l: 50 });
    setGameState('showing');
  };

  const flashTarget = () => {
    setShowTarget(true);
    window.setTimeout(() => setShowTarget(false), 500);
  };

  useEffect(() => {
    if (gameState !== 'showing') return;
    const timer = window.setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= totalColors - 1) {
          window.clearInterval(timer);
          setGameState('guessing');
          return 0;
        }
        return prev + 1;
      });
    }, SHOW_DURATION);
    return () => window.clearInterval(timer);
  }, [gameState, totalColors]);

  const handleGuess = () => {
    const newGuesses = [...userGuesses, currentColor];
    setUserGuesses(newGuesses);
    if (currentStep < totalColors - 1) {
      setCurrentStep(currentStep + 1);
      setCurrentColor({ h: 180, s: 50, l: 50 });
    } else {
      setGameState('results');
    }
  };

  const totalScore = userGuesses.reduce((acc, guess, i) => acc + calculateScore(targetColors[i], guess), 0);
  const averageScore = userGuesses.length ? Math.round(totalScore / totalColors) : 0;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 overflow-x-hidden"
      style={{ ['--ambient-h' as string]: String(ambientHue) }}
    >
      <div className="stage-bg" aria-hidden />
      <BackToMenu />

      <div className="stage-content w-full flex flex-col items-center justify-center py-10 sm:py-14">
        <AnimatePresence mode="wait">
          {gameState === 'landing' && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-lg w-full text-center space-y-10"
            >
              <div className="space-y-5">
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
                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg"
                      style={{ background: `hsl(${h} 55% 52%)` }}
                    />
                  ))}
                </motion.div>

                <h1 className="brand-mark text-[clamp(2.75rem,10vw,4.5rem)] text-[var(--color-paper)]">
                  色感記憶
                </h1>
                <p className="text-[var(--color-muted)] text-base sm:text-lg leading-relaxed max-w-sm mx-auto">
                  人很難精準記住顏色。看兩秒，再用滑桿重現——測測你的色感。
                </p>
              </div>

              <div className="flex flex-col gap-3 max-w-xs mx-auto w-full">
                <button type="button" onClick={() => startGame('single')} className="btn-primary w-full">
                  <Play size={17} fill="currentColor" />
                  單色挑戰
                </button>
                <button type="button" onClick={() => startGame('challenge')} className="btn-secondary w-full">
                  <Layers size={17} />
                  五色連續
                </button>
              </div>

              <div className="flex items-center justify-center gap-5">
                <button type="button" onClick={() => setShowModal('scoring')} className="link-quiet inline-flex items-center gap-1">
                  <Info size={12} /> 計分方式
                </button>
                <button type="button" onClick={() => setShowModal('privacy')} className="link-quiet inline-flex items-center gap-1">
                  <Shield size={12} /> 隱私
                </button>
              </div>
            </motion.div>
          )}

          {gameState === 'showing' && (
            <motion.div
              key="showing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-8 w-full max-w-md"
            >
              <p className="kicker">記住這顏色 · {currentStep + 1} / {totalColors}</p>
              <motion.div
                key={currentStep}
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                className="swatch w-[min(72vw,18rem)] aspect-square"
                style={{ backgroundColor: colorToCss(targetColors[currentStep]) }}
              />
              <div className="progress-rail">
                <motion.div
                  key={`bar-${currentStep}`}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: SHOW_DURATION / 1000, ease: 'linear' }}
                  className="progress-fill"
                />
              </div>
            </motion.div>
          )}

          {gameState === 'guessing' && (
            <motion.div
              key="guessing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="max-w-md w-full space-y-8"
            >
              <div className="flex justify-between items-center px-1">
                <p className="kicker">重現 · {currentStep + 1} / {totalColors}</p>
                <div className="flex gap-2" aria-hidden>
                  {targetColors.map((_, i) => (
                    <span
                      key={i}
                      className={`step-dot ${i === currentStep ? 'is-active' : i < currentStep ? 'is-done' : ''}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{
                    backgroundColor: showTarget
                      ? colorToCss(targetColors[currentStep])
                      : colorToCss(currentColor),
                  }}
                  transition={{ duration: 0.2 }}
                  className="swatch w-[min(56vw,14rem)] aspect-square"
                />
                <span className="text-xs font-medium text-[var(--color-muted)] tracking-wide">
                  {showTarget ? '目標色（提示）' : '你的猜測'}
                </span>
              </div>

              <div className="panel p-5 sm:p-6 space-y-6">
                <ColorSlider
                  label="色相"
                  min={0}
                  max={360}
                  value={currentColor.h}
                  suffix="°"
                  onChange={(h) => setCurrentColor({ ...currentColor, h })}
                  gradient="linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)"
                />
                <ColorSlider
                  label="飽和度"
                  min={0}
                  max={100}
                  value={currentColor.s}
                  suffix="%"
                  onChange={(s) => setCurrentColor({ ...currentColor, s })}
                  gradient={`linear-gradient(to right, hsl(${currentColor.h}, 0%, ${currentColor.l}%), hsl(${currentColor.h}, 100%, ${currentColor.l}%))`}
                />
                <ColorSlider
                  label="明度"
                  min={0}
                  max={100}
                  value={currentColor.l}
                  suffix="%"
                  onChange={(l) => setCurrentColor({ ...currentColor, l })}
                  gradient={`linear-gradient(to right, hsl(${currentColor.h}, ${currentColor.s}%, 0%), hsl(${currentColor.h}, ${currentColor.s}%, 50%), hsl(${currentColor.h}, ${currentColor.s}%, 100%))`}
                />

                <div className="flex gap-3 pt-1">
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
                    提示
                  </button>
                  <button type="button" onClick={handleGuess} className="btn-primary flex-[1.6]">
                    {currentStep < totalColors - 1 ? '下一色' : '看結果'}
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {gameState === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-2xl w-full space-y-10 text-center px-1"
            >
              <div className="space-y-3">
                <p className="kicker">本局平均分</p>
                <div className="flex items-baseline justify-center gap-3">
                  <div className="brand-mark text-[clamp(3.5rem,14vw,5.5rem)] tabular-nums leading-none">
                    <AnimatedNumber value={averageScore} />
                  </div>
                  <div className="font-mono text-xl text-[var(--color-muted)] tabular-nums">
                    <AnimatedNumber value={Math.round((averageScore / 999) * 100)} />
                    <span className="text-sm ml-0.5">%</span>
                  </div>
                </div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1 }}
                  className="text-[var(--color-muted)] text-base max-w-sm mx-auto"
                >
                  {scoreVerdict(averageScore)}
                </motion.p>
              </div>

              <div
                className={`grid gap-4 ${
                  gameMode === 'single'
                    ? 'grid-cols-1 max-w-[14rem] mx-auto'
                    : 'grid-cols-2 sm:grid-cols-5'
                }`}
              >
                {targetColors.map((target, i) => {
                  const guess = userGuesses[i];
                  const score = calculateScore(target, guess);
                  const targetHsb = hslToHsb(target.h, target.s, target.l);
                  const guessHsb = hslToHsb(guess.h, guess.s, guess.l);
                  return (
                    <div key={i} className="space-y-2 text-left">
                      <ColorComparison target={target} guess={guess} />
                      <div className="px-0.5 space-y-1">
                        <div className="text-sm font-semibold tabular-nums">
                          <AnimatedNumber value={score} />
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

              <div className="flex gap-3 max-w-xs mx-auto w-full">
                <button type="button" onClick={() => startGame(gameMode)} className="btn-primary flex-1">
                  <RotateCcw size={16} />
                  再玩一次
                </button>
                <button type="button" onClick={() => setGameState('landing')} className="btn-secondary flex-1">
                  回首頁
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            onClick={() => setShowModal(null)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="panel max-w-md w-full p-6 sm:p-8 space-y-5 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="brand-mark text-2xl">
                {showModal === 'privacy' ? '隱私' : '計分方式'}
              </h3>
              <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                {showModal === 'privacy'
                  ? '不蒐集個人資料。分數僅存在你的瀏覽器本機，不會上傳。'
                  : '分數依猜測色與目標色在 HSL 空間的距離計算。完全一致為 999 分；多色模式取各回合平均。'}
              </p>
              <button type="button" onClick={() => setShowModal(null)} className="btn-primary w-full">
                關閉
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="stage-content fixed bottom-5 left-0 right-0 text-center kicker pointer-events-none">
        Dialed Color
      </p>
    </div>
  );
}
