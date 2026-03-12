import { useEffect, useRef, useState } from 'react';
import { BookOpen, Play, RefreshCw } from 'lucide-react';
import { GameEngine, CANVAS_WIDTH, CANVAS_HEIGHT } from './utils/gameEngine';
import type { GameState, InputState } from './utils/gameEngine';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(() => {
    const e = new GameEngine(() => {});
    return e.getInitialState();
  });
  const [showRules, setShowRules] = useState(false);

  const keysRef = useRef<InputState>({
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
      if (e.code === 'KeyW') {
        e.preventDefault();
        keysRef.current.up = true;
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        keysRef.current.down = true;
      } else if (e.code === 'KeyA') {
        e.preventDefault();
        keysRef.current.left = true;
      } else if (e.code === 'KeyD') {
        e.preventDefault();
        keysRef.current.right = true;
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        keysRef.current.kickDirX = 0;
        keysRef.current.kickDirY = -1;
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        keysRef.current.kickDirX = 0;
        keysRef.current.kickDirY = 1;
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        keysRef.current.kickDirX = -1;
        keysRef.current.kickDirY = 0;
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        keysRef.current.kickDirX = 1;
        keysRef.current.kickDirY = 0;
      } else if (e.code === 'Space') {
        e.preventDefault();
        keysRef.current.kick = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW') keysRef.current.up = false;
      else if (e.code === 'KeyS') keysRef.current.down = false;
      else if (e.code === 'KeyA') keysRef.current.left = false;
      else if (e.code === 'KeyD') keysRef.current.right = false;
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
        <h1 className="text-xl font-bold tracking-tight">坦克對決 Tank Battle</h1>
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
            <span className="text-slate-400 text-sm block">玩家擊毀</span>
            <span className="text-3xl font-bold text-blue-400 tabular-nums">
              {gameState.player.kills}
            </span>
          </div>
          <div className="bg-slate-900/80 px-4 py-2 rounded-lg border border-white/20 text-center">
            <span className="text-slate-400 text-sm block">時間</span>
            <span className="text-2xl font-bold tabular-nums">
              {formatTime(gameState.timeElapsed)}
            </span>
          </div>
          <div className="bg-slate-900/80 px-4 py-2 rounded-lg border border-white/20 text-right">
            <span className="text-slate-400 text-sm block">電腦擊毀</span>
            <span className="text-3xl font-bold text-red-400 tabular-nums">
              {gameState.cpu.kills}
            </span>
          </div>
        </div>

        {gameState.mode === 'menu' && (
          <div
            className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-6"
            role="dialog"
              aria-label="Start game"
          >
            <h2 className="text-3xl font-bold">坦克準備開戰</h2>
            <p className="text-slate-300 text-sm max-w-sm text-center">
              操控藍色坦克與橘色坦克對戰，先擊毀對方 {3} 次者獲勝。WASD 控制坦克前進與轉向，方向鍵決定砲口方向，空白鍵發射砲彈。
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
              {gameState.winner === 'player'
                ? '你贏了！'
                : gameState.winner === 'cpu'
                  ? '電腦獲勝'
                  : '平手'}
            </h2>
            <p className="text-slate-300">
              玩家 {gameState.player.kills} : {gameState.cpu.kills} 電腦
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
        WASD 控制坦克前進／後退與轉向 · 方向鍵 瞄準砲塔方向 · 空白鍵 發射砲彈
      </p>

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tank-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="tank-rules-title" className="text-lg font-bold mb-3">
              規則說明
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>你操控藍色坦克，電腦操控橘色坦克，場地為封閉矩形戰場。</li>
              <li>WASD 控制坦克前進、後退與旋轉；方向鍵決定砲口指向，再按空白鍵發射砲彈。</li>
              <li>砲彈命中對方坦克即擊毀 1 次，坦克會在自家後方重生。</li>
              <li>先擊毀對方 {3} 次者獲勝；若雙方同時達成則比較擊毀數，多者勝。</li>
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
