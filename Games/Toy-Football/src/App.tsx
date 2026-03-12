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

  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    kick: false,
    kickDirX: 0,
    kickDirY: 0,
  });

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
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        keysRef.current.left = true;
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        keysRef.current.right = true;
      } else if (e.code === 'Space') {
        e.preventDefault();
        const k = keysRef.current;
        k.kickDirX = (k.right ? 1 : 0) - (k.left ? 1 : 0);
        k.kickDirY = (k.down ? 1 : 0) - (k.up ? 1 : 0);
        k.kick = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') keysRef.current.up = false;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') keysRef.current.down = false;
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') keysRef.current.left = false;
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') keysRef.current.right = false;
      else if (e.code === 'Space') keysRef.current.kick = false;
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

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
      <header className="w-full max-w-4xl flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold tracking-tight">玩具足球 Toy Football</h1>
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

        <div className="absolute top-4 left-0 right-0 flex justify-between items-start px-8 pointer-events-none">
          <div className="bg-slate-900/80 px-4 py-2 rounded-lg border border-white/20">
            <span className="text-slate-400 text-sm block">玩家</span>
            <span className="text-3xl font-bold text-blue-400 tabular-nums">
              {gameState.scorePlayer}
            </span>
          </div>
          <div className="bg-slate-900/80 px-4 py-2 rounded-lg border border-white/20 text-center">
            <span className="text-slate-400 text-sm block">時間</span>
            <span className="text-2xl font-bold tabular-nums">
              {formatTime(gameState.timeLeft)}
            </span>
          </div>
          <div className="bg-slate-900/80 px-4 py-2 rounded-lg border border-white/20 text-right">
            <span className="text-slate-400 text-sm block">電腦</span>
            <span className="text-3xl font-bold text-red-400 tabular-nums">
              {gameState.scoreCpu}
            </span>
          </div>
        </div>

        {gameState.mode === 'menu' && (
          <div
            className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-6"
            role="dialog"
            aria-label="Start game"
          >
            <h2 className="text-3xl font-bold">開始比賽</h2>
            <p className="text-slate-300 text-sm max-w-sm text-center">
              90 秒內進球多者勝。方向鍵或 WASD 移動，空白鍵踢球；踢球方向由目前按住的方位決定（不按則朝對方球門）。
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

        {gameState.mode === 'gameOver' && (
          <div
            className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4"
            role="dialog"
            aria-label="Game over"
          >
            <h2 className="text-2xl font-bold">
              {gameState.scorePlayer > gameState.scoreCpu
                ? '你贏了！'
                : gameState.scorePlayer < gameState.scoreCpu
                  ? '電腦獲勝'
                  : '平手'}
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
        ↑↓←→ 或 WASD 移動／選擇踢球方向 · 空白鍵 踢球
      </p>

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="football-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="football-rules-title" className="text-lg font-bold mb-3">
              規則說明
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>玩家（藍）攻右側球門、守左側球門；電腦（紅）相反。</li>
              <li>方向鍵或 WASD 移動，靠近球時按空白鍵踢球；踢球方向由按住的方向鍵決定（可斜向），不按則朝對方球門。</li>
              <li>球進入對方球門即得 1 分，球重置至中場。</li>
              <li>90 秒結束後進球多者勝；平手則和局。</li>
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
