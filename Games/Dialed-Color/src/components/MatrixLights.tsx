import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, Lightbulb, Zap, Award, Sparkles } from 'lucide-react';
import { playMove, playWin, playGoal } from '@clubhouse/shared/synthAudio';
import { solveGf2LightsOut } from '../utils/gf2Solver';

interface MatrixLightsProps {
  onBack?: () => void;
  accentHue?: number;
}

export function MatrixLights({ onBack, accentHue = 180 }: MatrixLightsProps) {
  const [gridSize, setGridSize] = useState<3 | 4>(3);
  const [movesCount, setMovesCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [isVictory, setIsVictory] = useState(false);

  // Initialize a solvable random pattern by simulating random clicks from an all-off board
  const generateSolvableBoard = useCallback((size: number) => {
    const board = Array.from({ length: size }, () => new Array(size).fill(false));
    // Simulate between 3 to 7 clicks to guarantee solvability
    const clickCount = size === 3 ? 4 : 6;
    for (let i = 0; i < clickCount; i++) {
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      // Toggle (r, c) and neighbors
      board[r][c] = !board[r][c];
      if (r > 0) board[r - 1][c] = !board[r - 1][c];
      if (r < size - 1) board[r + 1][c] = !board[r + 1][c];
      if (c > 0) board[r][c - 1] = !board[r][c - 1];
      if (c < size - 1) board[r][c + 1] = !board[r][c + 1];
    }
    // If by chance all false, click center
    const hasAnyOn = board.some((row) => row.some((v) => v));
    if (!hasAnyOn) {
      board[1][1] = true;
      board[0][1] = true;
      board[2][1] = true;
      board[1][0] = true;
      board[1][2] = true;
    }
    return board;
  }, []);

  const [grid, setGrid] = useState<boolean[][]>(() => generateSolvableBoard(3));

  // Reset board
  const resetBoard = useCallback(() => {
    playMove();
    setGrid(generateSolvableBoard(gridSize));
    setMovesCount(0);
    setShowHint(false);
    setIsVictory(false);
  }, [generateSolvableBoard, gridSize]);

  // Handle changing grid size
  const switchSize = (size: 3 | 4) => {
    playMove();
    setGridSize(size);
    setGrid(generateSolvableBoard(size));
    setMovesCount(0);
    setShowHint(false);
    setIsVictory(false);
  };

  // Solve with GF(2)
  const solution = useMemo(() => solveGf2LightsOut(grid), [grid]);

  // Handle toggle cell
  const handleCellClick = (r: number, c: number) => {
    if (isVictory) return;
    playMove();

    const nextGrid = grid.map((row) => [...row]);
    // Toggle self and orthogonal neighbors
    nextGrid[r][c] = !nextGrid[r][c];
    if (r > 0) nextGrid[r - 1][c] = !nextGrid[r - 1][c];
    if (r < gridSize - 1) nextGrid[r + 1][c] = !nextGrid[r + 1][c];
    if (c > 0) nextGrid[r][c - 1] = !nextGrid[r][c - 1];
    if (c < gridSize - 1) nextGrid[r][c + 1] = !nextGrid[r][c + 1];

    setGrid(nextGrid);
    setMovesCount((m) => m + 1);

    // Check if all lights are off
    const allOff = nextGrid.every((row) => row.every((val) => !val));
    if (allOff) {
      setIsVictory(true);
      playGoal();
      window.setTimeout(() => playWin(), 400);
    }
  };

  // Keyboard shortcut for reset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        resetBoard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetBoard]);

  return (
    <div className="max-w-md w-full space-y-6 text-center">
      {/* Top Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-mono text-xs">
          <Zap size={14} className="text-cyan-400 animate-pulse" />
          <span>GF(2) 矩陣點燈光波模式</span>
        </div>
        <h2 className="brand-mark text-3xl sm:text-4xl text-[var(--color-paper)]">
          光矩陣解鎖
        </h2>
        <p className="text-sm text-[var(--color-muted)] max-w-xs mx-auto">
          點擊光點可反轉自身與十字鄰居。熄滅矩陣所有光源即可破譯光譜！
        </p>
      </div>

      {/* Grid Size Switcher & Moves Counter */}
      <div className="flex items-center justify-between px-2 text-xs font-mono">
        <div className="flex gap-1.5" role="group" aria-label="矩陣規模">
          <button
            type="button"
            onClick={() => switchSize(3)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              gridSize === 3
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-semibold'
                : 'border-white/10 text-white/50 hover:border-white/20'
            }`}
          >
            3 × 3 矩陣
          </button>
          <button
            type="button"
            onClick={() => switchSize(4)}
            className={`px-3 py-1.5 rounded-lg border transition-all ${
              gridSize === 4
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-semibold'
                : 'border-white/10 text-white/50 hover:border-white/20'
            }`}
          >
            4 × 4 高階
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-white/50">已走步數</span>
          <span className="text-cyan-300 font-bold tabular-nums text-sm bg-black/40 px-2 py-0.5 rounded border border-white/10">
            {movesCount}
          </span>
        </div>
      </div>

      {/* Interactive Matrix Grid */}
      <div className="panel p-6 flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-md">
        {/* Dynamic Matrix Neon Ambient Aura */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20 transition-all duration-700"
          style={{
            background: `radial-gradient(circle at 50% 50%, hsl(${accentHue}, 100%, 50%), transparent 70%)`,
          }}
        />

        <div
          className={`grid gap-3.5 relative z-10 ${
            gridSize === 3 ? 'grid-cols-3 w-64 h-64' : 'grid-cols-4 w-72 h-72'
          }`}
        >
          {grid.map((row, r) =>
            row.map((isOn, c) => {
              const isRecommended =
                showHint &&
                solution.nextRecommendedMove &&
                solution.nextRecommendedMove.row === r &&
                solution.nextRecommendedMove.col === c;

              const cellHue = (accentHue + (r * gridSize + c) * 25) % 360;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => handleCellClick(r, c)}
                  aria-label={`第 ${r + 1} 列第 ${c + 1} 行光點：${isOn ? '亮起' : '熄滅'}`}
                  className={`relative rounded-xl border transition-all duration-300 flex items-center justify-center overflow-hidden cursor-pointer active:scale-95 touch-manipulation ${
                    isOn
                      ? 'border-white/40 shadow-lg'
                      : 'bg-black/50 border-white/10 hover:border-white/25 opacity-70'
                  } ${isRecommended ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black animate-pulse' : ''}`}
                  style={{
                    backgroundColor: isOn ? `hsl(${cellHue}, 85%, 55%)` : undefined,
                    boxShadow: isOn
                      ? `0 0 20px hsl(${cellHue}, 90%, 50%), inset 0 1px 2px rgba(255,255,255,0.6)`
                      : undefined,
                  }}
                >
                  {/* Subtle inner core glow */}
                  {isOn && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-3 h-3 rounded-full bg-white shadow-[0_0_10px_#fff]"
                    />
                  )}

                  {/* Hint indicator ring */}
                  {isRecommended && (
                    <span className="absolute inset-1 rounded-lg border-2 border-dashed border-amber-300 animate-spin" />
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {/* GF(2) Diagnostics & Symmetry Totem Telemetry */}
      <div className="grid grid-cols-2 gap-2 text-left font-mono text-xs">
        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="text-[10px] text-white/50 flex items-center justify-between">
            <span>最小求解步數</span>
            <span className="text-cyan-400 font-semibold">GF(2)</span>
          </div>
          <div className="text-cyan-300 font-bold text-sm mt-0.5 tabular-nums">
            {solution.solvable ? `${solution.minMoves} 步` : '不可解'}
          </div>
        </div>

        <div className="bg-white/5 rounded-xl p-3 border border-white/5">
          <div className="text-[10px] text-white/50">對稱性圖騰分析</div>
          <div className="text-fuchsia-300 font-semibold text-xs mt-0.5 truncate">
            {solution.symmetry.totemName}
          </div>
        </div>
      </div>

      {/* Action Buttons: Hint, Reset, Back */}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setShowHint(!showHint)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border text-sm font-semibold transition-all ${
            showHint
              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
              : 'border-white/10 text-white/70 hover:border-white/30 hover:bg-white/5'
          }`}
        >
          <Lightbulb size={16} />
          {showHint ? '隱藏提示' : '求解提示'}
        </button>

        <button
          type="button"
          onClick={resetBoard}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl border border-white/10 text-white/70 hover:border-white/30 hover:bg-white/5 text-sm font-semibold transition-all"
        >
          <RotateCcw size={16} />
          重新整理
        </button>

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-3 rounded-xl border border-white/10 text-white/70 hover:border-white/30 hover:bg-white/5 text-sm font-semibold transition-all"
          >
            返回
          </button>
        )}
      </div>

      {/* Victory Celebration Modal */}
      <AnimatePresence>
        {isVictory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="p-5 rounded-2xl bg-cyan-950/80 border border-cyan-400/50 text-center space-y-3 backdrop-blur-lg shadow-2xl"
          >
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 text-cyan-300 mx-auto flex items-center justify-center border border-cyan-400/40">
              <Sparkles size={24} />
            </div>
            <h3 className="brand-mark text-2xl text-cyan-200">光矩陣破譯成功！</h3>
            <p className="text-xs text-white/80 font-mono">
              耗費步數：<span className="text-cyan-300 font-bold">{movesCount}</span> ·
              矩陣圖騰：<span className="text-fuchsia-300">{solution.symmetry.totemName}</span>
            </p>
            <button
              type="button"
              onClick={resetBoard}
              className="btn-primary w-full text-sm"
            >
              <Award size={16} />
              挑戰下一盤矩陣
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
