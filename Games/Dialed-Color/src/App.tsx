import { useState, useEffect } from 'react';
import { motion, AnimatePresence, animate } from 'motion/react';
import { Play, Users, RotateCcw, ChevronRight, Info, Volume2, Shield } from 'lucide-react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { GameState, GameMode, Color } from './types';

const SHOW_DURATION = 2000; // 2 seconds per color

let lastHue = -1;

const generateRandomColor = (): Color => {
  let h = Math.floor(Math.random() * 360);
  // If we have a previous hue, try to pick one at least 45 degrees away
  if (lastHue !== -1) {
    while (Math.abs(h - lastHue) < 45 || Math.abs(h - lastHue) > 315) {
      h = Math.floor(Math.random() * 360);
    }
  }
  lastHue = h;
  return {
    h,
    s: Math.floor(Math.random() * 85) + 10, // 10-95%
    l: Math.floor(Math.random() * 75) + 15, // 15-90%
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
    b: Math.round(v * 100)
  };
};

const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value]);

  return <span>{displayValue}</span>;
};

const calculateScore = (c1: Color, c2: Color): number => {
  const dh = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h)) / 180;
  const ds = Math.abs(c1.s - c2.s) / 100;
  const dl = Math.abs(c1.l - c2.l) / 100;
  const distance = Math.sqrt(dh * dh + ds * ds + dl * dl);
  return Math.max(0, Math.floor(999 * (1 - distance)));
};

const ColorComparison = ({ target, guess }: { target: Color; guess: Color }) => {
  const [sliderPos, setSliderPos] = useState(50);
  
  return (
    <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 group cursor-ew-resize">
      {/* Target Color (Right side) */}
      <div className="absolute inset-0" style={{ backgroundColor: colorToCss(target) }} />
      
      {/* Guess Color (Left side) */}
      <div 
        className="absolute inset-0 border-r border-white/40 z-10" 
        style={{ 
          backgroundColor: colorToCss(guess),
          width: `${sliderPos}%`
        }} 
      />
      
      {/* Slider Handle Line */}
      <div 
        className="absolute inset-y-0 w-px bg-white/80 z-20 pointer-events-none"
        style={{ left: `${sliderPos}%` }}
      />
      
      {/* Interactive Input */}
      <input
        type="range"
        min="0"
        max="100"
        value={sliderPos}
        onChange={(e) => setSliderPos(parseInt(e.target.value))}
        className="absolute inset-0 opacity-0 cursor-ew-resize z-30"
      />
      
      {/* Labels */}
      <div className="absolute top-2 left-2 text-[8px] font-mono uppercase bg-black/40 px-1 rounded pointer-events-none z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        Guess
      </div>
      <div className="absolute top-2 right-2 text-[8px] font-mono uppercase bg-black/40 px-1 rounded pointer-events-none z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        Target
      </div>
    </div>
  );
};

const ColorSlider = ({ 
  label, 
  value, 
  min, 
  max, 
  onChange, 
  suffix = "", 
  gradient 
}: { 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  onChange: (val: number) => void; 
  suffix?: string;
  gradient: string;
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <motion.div 
      className="space-y-2"
      animate={{ scale: isFocused ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="flex justify-between text-[10px] font-mono text-muted uppercase tracking-wider">
        <span className={isFocused ? "text-white transition-colors" : "transition-colors"}>{label}</span>
        <motion.span 
          key={value}
          initial={{ opacity: 0.5, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className={isFocused ? "text-white transition-colors" : "transition-colors"}
        >
          {value}{suffix}
        </motion.span>
      </div>
      <div className="relative group">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onMouseDown={() => setIsFocused(true)}
          onMouseUp={() => setIsFocused(false)}
          onTouchStart={() => setIsFocused(true)}
          onTouchEnd={() => setIsFocused(false)}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-white relative z-10"
          style={{ background: gradient }}
        />
        <AnimatePresence>
          {isFocused && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute inset-0 -inset-x-4 -inset-y-2 bg-white/5 blur-md rounded-full pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

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

  const startGame = (mode: GameMode) => {
    const count = mode === 'single' ? 1 : 5;
    const colors = Array.from({ length: count }, generateRandomColor);
    setGameMode(mode);
    setTargetColors(colors);
    setUserGuesses([]);
    setCurrentStep(0);
    setGameState('showing');
  };

  const flashTarget = () => {
    setShowTarget(true);
    setTimeout(() => setShowTarget(false), 500);
  };

  useEffect(() => {
    if (gameState === 'showing') {
      const timer = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= totalColors - 1) {
            clearInterval(timer);
            setGameState('guessing');
            setCurrentStep(0);
            return 0;
          }
          return prev + 1;
        });
      }, SHOW_DURATION);
      return () => clearInterval(timer);
    }
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

  const totalScore = userGuesses.reduce((acc, guess, i) => {
    return acc + calculateScore(targetColors[i], guess);
  }, 0);

  const averageScore = Math.round(totalScore / totalColors);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">
      <BackToMenu />
      <AnimatePresence mode="wait">
        {gameState === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="max-w-md w-full text-center space-y-8"
          >
            <div className="space-y-4">
              <h1 className="text-7xl font-bold tracking-tighter">color</h1>
              <p className="text-muted text-lg leading-relaxed">
                Humans can’t reliably recall colors. This is a simple game to see how good (or bad) you are at it.
              </p>
              <p className="text-muted text-sm">
                Choose a mode to test your color memory.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => startGame('single')} className="btn-primary w-full flex items-center justify-center gap-2">
                <Play size={18} fill="currentColor" /> Single Color
              </button>
              <button onClick={() => startGame('challenge')} className="btn-secondary w-full flex items-center justify-center gap-2">
                <Users size={18} /> Challenge Mode (5 Colors)
              </button>
            </div>

            <div className="flex items-center justify-center gap-6 pt-8">
              <button onClick={() => setShowModal('privacy')} className="text-xs text-muted hover:text-fg transition-colors flex items-center gap-1">
                <Shield size={12} /> Privacy
              </button>
              <button onClick={() => setShowModal('scoring')} className="text-xs text-muted hover:text-fg transition-colors flex items-center gap-1">
                <Info size={12} /> Scoring
              </button>
              <button className="text-xs text-muted hover:text-fg transition-colors flex items-center gap-1">
                <Volume2 size={12} /> Sound
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
            className="flex flex-col items-center gap-12"
          >
            <div className="text-sm font-mono tracking-widest text-muted uppercase">
              Memorize {currentStep + 1} / {totalColors}
            </div>
            <motion.div
              key={currentStep}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-64 h-64 rounded-3xl shadow-2xl"
              style={{ backgroundColor: colorToCss(targetColors[currentStep]) }}
            />
            <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: SHOW_DURATION / 1000, ease: "linear" }}
                className="h-full bg-white"
              />
            </div>
          </motion.div>
        )}

        {gameState === 'guessing' && (
          <motion.div
            key="guessing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="max-w-lg w-full space-y-12"
          >
            <div className="flex justify-between items-center">
              <div className="text-sm font-mono tracking-widest text-muted uppercase">
                Recreate {currentStep + 1} / {totalColors}
              </div>
              <div className="flex gap-2">
                {targetColors.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i === currentStep ? 'bg-white' : i < currentStep ? 'bg-white/40' : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-8">
              <div className="space-y-2 text-center">
                <motion.div
                  animate={{ backgroundColor: showTarget ? colorToCss(targetColors[currentStep]) : colorToCss(currentColor) }}
                  className="w-48 h-48 rounded-3xl border-2 border-white/10"
                />
                <span className="text-xs text-muted font-mono uppercase">
                  {showTarget ? 'Target Color' : 'Your Guess'}
                </span>
              </div>
            </div>

            <div className="space-y-8 glass-panel p-8">
              <div className="space-y-6">
                <ColorSlider
                  label="Hue"
                  min={0}
                  max={360}
                  value={currentColor.h}
                  suffix="°"
                  onChange={(h) => setCurrentColor({ ...currentColor, h })}
                  gradient="linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)"
                />
                <ColorSlider
                  label="Saturation"
                  min={0}
                  max={100}
                  value={currentColor.s}
                  suffix="%"
                  onChange={(s) => setCurrentColor({ ...currentColor, s })}
                  gradient={`linear-gradient(to right, hsl(${currentColor.h}, 0%, ${currentColor.l}%), hsl(${currentColor.h}, 100%, ${currentColor.l}%))`}
                />
                <ColorSlider
                  label="Lightness"
                  min={0}
                  max={100}
                  value={currentColor.l}
                  suffix="%"
                  onChange={(l) => setCurrentColor({ ...currentColor, l })}
                  gradient={`linear-gradient(to right, hsl(${currentColor.h}, ${currentColor.s}%, 0%), hsl(${currentColor.h}, ${currentColor.s}%, 50%), hsl(${currentColor.h}, ${currentColor.s}%, 100%))`}
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onMouseDown={flashTarget}
                  onMouseUp={() => setShowTarget(false)}
                  onTouchStart={flashTarget}
                  onTouchEnd={() => setShowTarget(false)}
                  className="btn-secondary flex-1 text-xs font-mono uppercase"
                >
                  Hint
                </button>
                <button onClick={handleGuess} className="btn-primary flex-[2] flex items-center justify-center gap-2">
                  Next <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'results' && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full space-y-12 text-center"
          >
            <div className="space-y-4">
              <h2 className="text-sm font-mono tracking-widest text-muted uppercase">Final Score</h2>
              <div className="flex items-baseline justify-center gap-4">
                <div className="text-8xl font-bold tracking-tighter">
                  <AnimatedNumber value={averageScore} />
                </div>
                <div className="text-2xl font-mono text-muted">
                  <AnimatedNumber value={Math.round((averageScore / 999) * 100)} />%
                </div>
              </div>
              <motion.p 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5 }}
                className="text-lg font-medium text-white italic"
              >
                {averageScore >= 950 ? "你是色感之神嗎？還是螢幕開了外掛？" :
                 averageScore >= 850 ? "這色感... 應該去當設計師，而不是在這邊玩遊戲。" :
                 averageScore >= 700 ? "還不錯，至少你分得出紅綠燈。" :
                 averageScore >= 500 ? "普通到讓人想打呵欠，再努力一點好嗎？" :
                 averageScore >= 300 ? "你的眼睛是裝飾品嗎？建議去掛個眼科。" :
                 "這不是色盲，這是心盲吧？隨便猜都比這準。"}
              </motion.p>
            </div>

            <div className={`grid gap-4 ${gameMode === 'single' ? 'grid-cols-1 max-w-xs mx-auto' : 'grid-cols-5'}`}>
              {targetColors.map((target, i) => {
                const guess = userGuesses[i];
                const score = calculateScore(target, guess);
                const targetHsb = hslToHsb(target.h, target.s, target.l);
                const guessHsb = hslToHsb(guess.h, guess.s, guess.l);
                return (
                  <div key={i} className="space-y-3">
                    <ColorComparison target={target} guess={guess} />
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-white uppercase">
                        <AnimatedNumber value={score} />
                      </div>
                      <div className="flex flex-col gap-0.5 text-[8px] font-mono text-muted uppercase">
                        <div className="flex justify-between px-1">
                          <span>Target HSB</span>
                          <span>H{targetHsb.h}, S{targetHsb.s}, B{targetHsb.b}</span>
                        </div>
                        <div className="flex justify-between px-1">
                          <span>Guess HSB</span>
                          <span>H{guessHsb.h}, S{guessHsb.s}, B{guessHsb.b}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-4 max-w-xs mx-auto">
              <button onClick={() => startGame(gameMode)} className="btn-primary flex-1 flex items-center justify-center gap-2">
                <RotateCcw size={18} /> Retry
              </button>
              <button onClick={() => setGameState('landing')} className="btn-secondary flex-1">
                Home
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full glass-panel p-8 space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold uppercase tracking-widest">
                {showModal === 'privacy' ? 'Privacy' : 'Scoring'}
              </h3>
              <div className="text-sm text-muted leading-relaxed space-y-4">
                {showModal === 'privacy' ? (
                  <p>
                    We don't collect any personal data. Your scores are stored locally in your browser. 
                    If you play multiplayer, only your display name and score are shared with other players.
                  </p>
                ) : (
                  <p>
                    Scoring is based on the distance between your guess and the target color in HSL space. 
                    A perfect match gives 999 points. The final score is the average of all rounds.
                  </p>
                )}
              </div>
              <button onClick={() => setShowModal(null)} className="btn-primary w-full">
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-8 text-[10px] font-mono text-muted uppercase tracking-widest">
        Dialed. Color v1.4
      </footer>
    </div>
  );
}
