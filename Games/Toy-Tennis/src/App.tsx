import { useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import { playError, playScore, playWin, playLose } from '@clubhouse/shared/synthAudio';
import { BookOpen, Play, RefreshCw } from 'lucide-react';
import { GameEngine, CANVAS_WIDTH, CANVAS_HEIGHT } from './utils/gameEngine';
import type { CpuDifficulty, GameState } from './utils/gameEngine';

const DIFFICULTY_OPTIONS: { id: CpuDifficulty; label: string }[] = [
  { id: 'easy', label: '簡單' },
  { id: 'normal', label: '普通' },
  { id: 'hard', label: '困難' },
];

function TouchButton({
  label,
  ariaLabel,
  onPress,
  onRelease,
}: {
  label: string;
  ariaLabel: string;
  onPress: () => void;
  onRelease: () => void;
}) {
  const release = () => onRelease();
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className="min-w-11 min-h-11 px-5 rounded-xl bg-slate-700 active:bg-slate-500 text-white text-xl font-bold touch-manipulation select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      {label}
    </button>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<GameState>(() => {
    const e = new GameEngine(() => {});
    return e.getInitialState();
  });
  const [showRules, setShowRules] = useState(false);
  const [difficulty, setDifficulty] = useState<CpuDifficulty>('normal');
  const [flash, setFlash] = useState<{
    text: string;
    tone: 'good' | 'bad';
    key: number;
  } | null>(null);

  const keysRef = useRef({ up: false, down: false });
  const prevScoresRef = useRef({ player: 0, cpu: 0 });
  const prevModeRef = useRef<GameState['mode']>('menu');

  useEffect(() => {
    const handleStateChange = (state: GameState) => {
      if (state.mode === 'playing') {
        if (state.scorePlayer > prevScoresRef.current.player) {
          setFlash({ text: '+1', tone: 'good', key: Date.now() });
          playScore();
        } else if (state.scoreCpu > prevScoresRef.current.cpu) {
          setFlash({ text: '對手得分', tone: 'bad', key: Date.now() });
          playError();
        }
      }
      if (state.mode === 'gameOver' && prevModeRef.current !== 'gameOver') {
        if (state.scorePlayer > state.scoreCpu) playWin();
        else playLose();
      }
      prevScoresRef.current = {
        player: state.scorePlayer,
        cpu: state.scoreCpu,
      };
      prevModeRef.current = state.mode;
      setGameState({ ...state });
    };

    const engine = new GameEngine(handleStateChange);
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

  const handleStart = () => {
    prevScoresRef.current = { player: 0, cpu: 0 };
    prevModeRef.current = 'menu';
    setFlash(null);
    engineRef.current?.setDifficulty(difficulty);
    engineRef.current?.start();
  };
  const handleReset = () => {
    prevScoresRef.current = { player: 0, cpu: 0 };
    prevModeRef.current = 'menu';
    setFlash(null);
    engineRef.current?.reset();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
      <BackToMenu />
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

        {flash && (
          <ScoreFlash
            text={flash.text}
            tone={flash.tone}
            flashKey={flash.key}
            onDone={() => setFlash(null)}
          />
        )}

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
            <div className="flex gap-2" role="group" aria-label="Difficulty">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setDifficulty(option.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    difficulty === option.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
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
          <ResultOverlay
            title={gameState.scorePlayer > gameState.scoreCpu ? '你贏了！' : '電腦獲勝'}
            variant={gameState.scorePlayer > gameState.scoreCpu ? 'win' : 'lose'}
            stats={[
              { label: '比分', value: `${gameState.scorePlayer} : ${gameState.scoreCpu}` },
              {
                label: '難度',
                value: DIFFICULTY_OPTIONS.find((o) => o.id === difficulty)?.label ?? '普通',
              },
            ]}
            onPrimary={handleReset}
          />
        )}
      </div>

      <div className="flex justify-center gap-6 mt-4 md:hidden">
        <TouchButton
          label="↑"
          ariaLabel="Move paddle up"
          onPress={() => {
            keysRef.current.up = true;
          }}
          onRelease={() => {
            keysRef.current.up = false;
          }}
        />
        <TouchButton
          label="↓"
          ariaLabel="Move paddle down"
          onPress={() => {
            keysRef.current.down = true;
          }}
          onRelease={() => {
            keysRef.current.down = false;
          }}
        />
      </div>

      <p className="mt-4 text-slate-400 text-sm text-center">
        <span className="hidden md:inline">↑ ↓ 或 W / S 移動球拍</span>
        <span className="md:hidden">使用下方按鈕移動球拍</span>
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
              <li>開始前可選電腦難度：簡單、普通或困難。</li>
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
