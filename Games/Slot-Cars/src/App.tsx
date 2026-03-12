import { useEffect, useRef, useState } from 'react';
import { BookOpen, Play, RefreshCw } from 'lucide-react';
import {
  TRACK_WIDTH,
  TRACK_HEIGHT,
  createInitialState,
  startRace,
  updateState,
  sampleCarPosition,
  type SlotCarsState,
  type SlotCarsInput,
} from './utils/slotCarsLogic';

function formatSeconds(seconds: number): string {
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<SlotCarsState>(createInitialState);
  const [showRules, setShowRules] = useState(false);
  const inputRef = useRef<SlotCarsInput>({ throttle: 0 });
  const lastTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        inputRef.current.throttle = 1;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        inputRef.current.throttle = 0;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const loop = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;
      setState((prev) => updateState(prev, inputRef.current, dt));
      rafIdRef.current = requestAnimationFrame(loop);
    };
    rafIdRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawScene(ctx, state);
  }, [state]);

  const handleStart = () => {
    lastTimeRef.current = null;
    inputRef.current.throttle = 0;
    setState((prev) => startRace(prev));
  };

  const handleReset = () => {
    lastTimeRef.current = null;
    inputRef.current.throttle = 0;
    setState(createInitialState());
  };

  const playerSpeed = Math.round(state.player.speed);
  const cpuSpeed = Math.round(state.cpu.speed);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
      <header className="w-full max-w-3xl flex justify-between items-center mb-3">
        <h1 className="text-xl font-bold tracking-tight">軌道車 Slot Cars</h1>
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

      <div className="w-full max-w-3xl mb-3 grid grid-cols-3 gap-3 text-xs text-slate-300">
        <div className="bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
          <div className="flex justify-between">
            <span>玩家圈數</span>
            <span>
              {state.player.lap}/{state.lapTarget}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>速度</span>
            <span>{playerSpeed} u/s</span>
          </div>
        </div>
        <div className="bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
          <div className="flex justify-between">
            <span>電腦圈數</span>
            <span>
              {state.cpu.lap}/{state.lapTarget}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>速度</span>
            <span>{cpuSpeed} u/s</span>
          </div>
        </div>
        <div className="bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
          <div className="flex justify-between">
            <span>經過時間</span>
            <span>{formatSeconds(state.timeElapsed)}</span>
          </div>
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border-4 border-emerald-700 shadow-xl bg-emerald-950/60">
        <canvas
          ref={canvasRef}
          width={TRACK_WIDTH}
          height={TRACK_HEIGHT}
          className="block"
        />
        {state.player.crashed && state.phase === 'running' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2">
            <span className="px-3 py-1 rounded-full bg-red-600/90 text-xs font-bold shadow">
              脫軌！稍後自動回到賽道
            </span>
          </div>
        )}
      </div>

      <p className="mt-3 text-slate-300 text-sm text-center">
        長按空白鍵或 ↑ 加速，鬆開則減速。彎道前記得收油，避免脫軌！
      </p>

      {state.phase === 'menu' && (
        <div
          className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center gap-6 z-10"
          role="dialog"
          aria-label="Start race"
        >
          <h2 className="text-2xl font-bold">軌道車起跑準備</h2>
          <p className="text-slate-300 text-sm max-w-sm text-center">
            你與電腦在同一條橢圓賽道上競速，先完成 {state.lapTarget} 圈者獲勝。直線全力加速，彎道前適度減速，避免脫軌失速。
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold transition-colors"
          >
            <Play className="w-5 h-5" />
            開始比賽
          </button>
        </div>
      )}

      {state.phase === 'results' && (
        <div
          className="fixed inset-0 bg-black/75 flex flex-col items-center justify-center gap-4 z-10"
          role="dialog"
          aria-label="Race results"
        >
          <h2 className="text-2xl font-bold">
            {state.winner === 'player'
              ? '你贏了！'
              : state.winner === 'cpu'
                ? '電腦獲勝'
                : '平手'}
          </h2>
          <div className="text-sm text-slate-200 space-y-1 text-center">
            <p>
              玩家：{state.player.lap} 圈 · 最佳單圈{' '}
              {state.player.bestLapTime ? formatSeconds(state.player.bestLapTime) : '--:--'}
            </p>
            <p>
              電腦：{state.cpu.lap} 圈 · 最佳單圈{' '}
              {state.cpu.bestLapTime ? formatSeconds(state.cpu.bestLapTime) : '--:--'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            再跑一場
          </button>
        </div>
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-20"
          role="dialog"
          aria-modal="true"
          aria-labelledby="slot-cars-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="slot-cars-rules-title" className="text-lg font-bold mb-3">
              規則說明
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>你與電腦各自駕駛一輛軌道車，在同一條封閉橢圓賽道上競速。</li>
              <li>長按空白鍵或 ↑ 增加油門，鬆開則減速；速度越高前進越快。</li>
              <li>直線可大膽加速，但彎道前若速度過高，車輛將脫軌並短暫失控。</li>
              <li>先完成設定圈數的一方獲勝；若同時完成則依實際位置判定，完全相同則平手。</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function drawScene(ctx: CanvasRenderingContext2D, state: SlotCarsState): void {
  ctx.clearRect(0, 0, TRACK_WIDTH, TRACK_HEIGHT);

  ctx.fillStyle = '#022c22';
  ctx.fillRect(0, 0, TRACK_WIDTH, TRACK_HEIGHT);

  ctx.strokeStyle = '#1f2933';
  ctx.lineWidth = 40;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * 2 * Math.PI;
    const x = TRACK_WIDTH / 2 + Math.cos(t) * 220;
    const y = TRACK_HEIGHT / 2 + Math.sin(t) * 130;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  ctx.setLineDash([14, 10]);
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * 2 * Math.PI;
    const x = TRACK_WIDTH / 2 + Math.cos(t) * 220;
    const y = TRACK_HEIGHT / 2 + Math.sin(t) * 130;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const startPos = sampleCarPosition(0, 0);
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(startPos.x - 12, startPos.y - 20);
  ctx.lineTo(startPos.x - 12, startPos.y + 20);
  ctx.moveTo(startPos.x + 12, startPos.y - 20);
  ctx.lineTo(startPos.x + 12, startPos.y + 20);
  ctx.stroke();

  drawCar(ctx, state.cpu.progress, -8, '#f97316', 'CPU');
  drawCar(ctx, state.player.progress, 22, '#3b82f6', 'YOU');
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  progress: number,
  laneOffset: number,
  color: string,
  label: string
): void {
  const pos = sampleCarPosition(progress, laneOffset);
  ctx.save();
  const angle = (progress / 1000) * 2 * Math.PI;
  ctx.translate(pos.x, pos.y);
  ctx.rotate(angle);

  ctx.fillStyle = '#020617';
  ctx.fillRect(-10, -7, 20, 14);

  ctx.fillStyle = color;
  ctx.fillRect(-12, -6, 24, 12);

  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(-4, -4, 8, 8);

  ctx.restore();

  ctx.fillStyle = '#e5e7eb';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, pos.x, pos.y - 14);
}
