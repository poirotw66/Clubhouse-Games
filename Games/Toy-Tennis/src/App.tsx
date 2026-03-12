import { useEffect, useRef, useState } from 'react';
import { BookOpen, Play, RefreshCw } from 'lucide-react';
import { GameEngine, CANVAS_WIDTH, CANVAS_HEIGHT } from './utils/gameEngine';
import type { GameState } from './utils/gameEngine';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(() => {
    const e = new GameEngine(() => {});
    return e.getInitialState();
  });
  const [showRules, setShowRules] = useState(false);

  const keysRef = useRef({ up: false, down: false });

  useEffect(() => {
    const engine = new GameEngine((state) => setGameState({ ...state }));
    engineRef.current = engine;
    setGameState({ ...engine.state });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();
    let frameId: number;

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      engine.update(dt, keysRef.current);
      engine.draw(ctx);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        keysRef.current.up = true;
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        keysRef.current.down = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keysRef.current.up = false;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') keysRef.current.down = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const handleStart = () => engineRef.current?.start();
  const handleReset = () => engineRef.current?.reset();

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
      <header className="w-full max-w-4xl flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold tracking-tight">玩具網球 Toy Tennis</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Rules"
            aria-label="Rules"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="New game"
            aria-label="New game"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="relative bg-slate-800 rounded-xl overflow-hidden border border-white/10 shadow-xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block"
        />

        {/* Score overlay */}
        <div className="absolute top-4 left-0 right-0 flex justify-between px-8 pointer-events-none">
          <div className="bg-slate-900/80 px-4 py-2 rounded-lg border border-white/20">
            <span className="text-slate-400 text-sm block">玩家</span>
            <span className="text-3xl font-bold text-blue-400 tabular-nums">
              {gameState.scorePlayer}
            </span>
          </div>
          <div className="bg-slate-900/80 px-4 py-2 rounded-lg border border-white/20">
            <span className="text-slate-400 text-sm block">電腦</span>
            <span className="text-3xl font-bold text-red-400 tabular-nums">
              {gameState.scoreCpu}
            </span>
          </div>
        </div>

        {/* Menu */}
        {gameState.mode === 'menu' && (
          <div
            className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-6"
            role="dialog"
            aria-label="Start game"
          >
            <h2 className="text-3xl font-bold">開始比賽</h2>
            <p className="text-slate-300 text-sm max-w-xs text-center">
              使用 ↑↓ 或 W / S 移動球拍，先得 7 分且領先 2 分者獲勝
            </p>
            <button
              type="button"
              onClick={handleStart}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold transition-colors"
            >
              <Play className="w-5 h-5" />
              開始
            </button>
          </div>
        )}

        {/* Game over */}
        {gameState.mode === 'gameOver' && (
          <div
            className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4"
            role="dialog"
            aria-label="Game over"
          >
            <h2 className="text-2xl font-bold">
              {gameState.scorePlayer > gameState.scoreCpu ? '你贏了！' : '電腦獲勝'}
            </h2>
            <p className="text-slate-300">
              {gameState.scorePlayer} : {gameState.scoreCpu}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              再玩一局
            </button>
          </div>
        )}
      </div>

      <p className="mt-4 text-slate-400 text-sm">
        ↑ ↓ 或 W / S 移動球拍
      </p>

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tennis-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="tennis-rules-title" className="text-lg font-bold mb-3">
              規則說明
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>玩家控制左側球拍，電腦控制右側。將球擊回對方場內。</li>
              <li>球碰到己方球拍可反彈；未接到則對方得 1 分。</li>
              <li>先得 7 分且領先 2 分者贏得一局（例如 7-5、8-6）。</li>
              <li>使用鍵盤 ↑↓ 或 W / S 上下移動球拍。</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
