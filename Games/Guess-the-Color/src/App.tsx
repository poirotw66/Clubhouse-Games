import { useEffect, useRef, useState } from 'react';
import { BookOpen, Play, RefreshCw } from 'lucide-react';
import {
  PANEL_WIDTH,
  PANEL_HEIGHT,
  COLORS,
  createInitialState,
  startGame,
  updateState,
  submitAnswer,
  type GuessColorState,
} from './utils/slotCarsLogic';

function formatScore(score: number): string {
  return score.toString().padStart(4, '0');
}

export default function App() {
  const [state, setState] = useState<GuessColorState>(createInitialState);
  const [showRules, setShowRules] = useState(false);
  const rafRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const loop = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;
      setState((prev) => updateState(prev, dt));
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleStart = () => {
    lastTimeRef.current = null;
    setState(startGame());
  };

  const handleReset = () => {
    lastTimeRef.current = null;
    setState(createInitialState());
  };

  const handleChoice = (index: number) => {
    setState((prev) => submitAnswer(prev, index));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
      <header className="w-full max-w-md flex justify-between items-center mb-3">
        <h1 className="text-xl font-bold tracking-tight">猜顏色 Guess the Color</h1>
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

      <div className="w-full max-w-md mb-3 grid grid-cols-3 gap-3 text-xs text-slate-300">
        <div className="bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
          <div className="flex justify-between">
            <span>回合</span>
            <span>
              {state.round}/{state.maxRounds}
            </span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>分數</span>
            <span className="font-mono text-base">{formatScore(state.score)}</span>
          </div>
        </div>
        <div className="bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
          <div className="flex justify-between">
            <span>連擊</span>
            <span>{state.streak}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>這題狀態</span>
            <span>
              {state.lastCorrect === null
                ? '—'
                : state.lastCorrect
                  ? '答對！'
                  : '答錯／超時'}
            </span>
          </div>
        </div>
        <div className="bg-slate-800/80 px-3 py-2 rounded-lg border border-slate-700">
          <div className="flex justify-between">
            <span>剩餘時間</span>
            <span>{state.phase === 'answering' ? state.timeLeft.toFixed(1) : '—'}</span>
          </div>
        </div>
      </div>

      <div className="relative rounded-2xl overflow-hidden border-4 border-slate-700 shadow-xl bg-slate-900/80 w-[480px] max-w-full">
        <div className="h-[200px] flex items-center justify-center">
          <div className="w-40 h-40 rounded-2xl border border-slate-600 bg-slate-800 flex items-center justify-center">
            <div
              className="w-28 h-28 rounded-2xl shadow-lg transition-colors duration-150"
              style={{
                backgroundColor:
                  state.phase === 'showing' ? COLORS[state.targetIndex] : '#020617',
              }}
            />
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-3">
            {COLORS.map((color, index) => {
              const disabled =
                state.phase !== 'answering' && state.phase !== 'showing';
              return (
                <button
                  key={color}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleChoice(index)}
                  className={`h-16 rounded-xl border transition-transform duration-150 ${
                    disabled
                      ? 'opacity-60 cursor-default'
                      : 'cursor-pointer hover:scale-[1.03]'
                  }`}
                  style={{ backgroundColor: color, borderColor: '#020617' }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-3 text-slate-300 text-sm text-center">
        請先記住上方顏色，顯示消失後在限時內從下方色塊中選出正確顏色。連續答對會有連擊加分！
      </p>

      {state.phase === 'menu' && (
        <div
          className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center gap-6 z-10"
          role="dialog"
          aria-label="Start game"
        >
          <h2 className="text-2xl font-bold">開始猜顏色</h2>
          <p className="text-slate-300 text-sm max-w-sm text-center">
            每題會先顯示一塊顏色，稍後顏色會隱藏。請在限時內從六個顏色選項中點出剛才顯示的那一個，共 {state.maxRounds}{' '}
            題，盡量多答對、拚高分吧！
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold transition-colors"
          >
            <Play className="w-5 h-5" />
            開始遊戲
          </button>
        </div>
      )}

      {state.phase === 'results' && (
        <div
          className="fixed inset-0 bg-black/75 flex flex-col items-center justify-center gap-4 z-10"
          role="dialog"
          aria-label="Game results"
        >
          <h2 className="text-2xl font-bold">
            挑戰結束！
          </h2>
          <div className="text-sm text-slate-200 space-y-1 text-center">
            <p>
              總分：<span className="font-mono text-lg">{formatScore(state.score)}</span>
            </p>
            <p>
              最長連擊：{state.streak} 題
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            再玩一次
          </button>
        </div>
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-20"
          role="dialog"
          aria-modal="true"
          aria-labelledby="guess-color-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="guess-color-rules-title" className="text-lg font-bold mb-3">
              規則說明
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>遊戲會依序出 {state.maxRounds} 題，每題先顯示一塊顏色。</li>
              <li>
                顏色出現約 0.8 秒後會隱藏，你須在限時內從六個顏色按鈕中，點選剛才那個顏色。
              </li>
              <li>答對可得分，連續答對會有額外連擊加成；答錯或超時則該題 0 分且連擊歸零。</li>
              <li>所有題目結束後結算總分與最長連擊，挑戰自己能拿到多高分吧！</li>
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
