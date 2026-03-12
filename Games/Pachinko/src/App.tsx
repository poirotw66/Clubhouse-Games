import { useEffect, useRef, useState } from 'react';
import {
  createInitialState,
  startGame,
  update,
  launch,
  setLaunchPower,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  BALL_RADIUS,
  PIN_RADIUS,
  LAUNCH_Y,
  SLOT_HEIGHT,
  INITIAL_BALLS,
} from './utils/pachinkoLogic';
import type { PachinkoState } from './utils/pachinkoLogic';
import { BookOpen, Play, RefreshCw } from 'lucide-react';

const BRONZE_TARGET = 150;
const SILVER_TARGET = 300;
const GOLD_TARGET = 450;

function getMedalLabel(score: number): string {
  if (score >= GOLD_TARGET) return '金牌';
  if (score >= SILVER_TARGET) return '銀牌';
  if (score >= BRONZE_TARGET) return '銅牌';
  return '再接再厲';
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<PachinkoState>(createInitialState);
  const [showRules, setShowRules] = useState(false);
  const lastTick = useRef(0);
  const rafId = useRef(0);

  useEffect(() => {
    if (state.phase !== 'playing') return;
    const loop = (time: number) => {
      const dt = Math.min((time - lastTick.current) / 1000, 0.02);
      lastTick.current = time;
      setState((s) => update(s, dt));
      rafId.current = requestAnimationFrame(loop);
    };
    lastTick.current = performance.now();
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, [state.phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx, state);
  }, [state]);

  const handleStart = () => setState(startGame(state));
  const handleReset = () => setState(createInitialState());
  const handleLaunch = () => setState((s) => launch(s));
  const handlePowerChange = (p: number) => setState((s) => setLaunchPower(s, p));

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
      <header className="w-full max-w-md flex justify-between items-center mb-2">
        <h1 className="text-xl font-bold tracking-tight">彈戲 Pachinko</h1>
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

      {state.phase !== 'menu' && (
        <div className="flex flex-col gap-1 mb-2 w-full max-w-md">
          <div className="flex gap-4">
            <div className="flex-1 bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-600">
              <span className="text-slate-400 text-xs">分數</span>
              <span className="text-2xl font-bold tabular-nums block">{state.score}</span>
            </div>
            <div className="w-32 bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-600">
              <span className="text-slate-400 text-xs">剩餘彈珠</span>
              <span className="text-2xl font-bold tabular-nums block">{state.ballsLeft}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              目標：{BRONZE_TARGET}（銅） / {SILVER_TARGET}（銀） / {GOLD_TARGET}（金）
            </span>
            <span className="text-amber-300 font-medium">
              評價：{getMedalLabel(state.score)}
            </span>
          </div>
        </div>
      )}

      <div className="relative rounded-2xl overflow-hidden border-4 border-amber-800 shadow-xl bg-amber-950/50">
        <canvas
          ref={canvasRef}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          className="block"
        />
        {state.lastScore !== null && state.phase === 'aiming' && (
          <div className="absolute top-2 left-0 right-0 text-center">
            <span className="inline-flex items-center gap-2 bg-emerald-600/90 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg shadow-emerald-900/50">
              {state.jackpotJustTriggered && (
                <span className="text-amber-300 text-xs uppercase tracking-wide">JACKPOT!</span>
              )}
              <span>+{state.lastScore}</span>
              {state.jackpotJustTriggered && (
                <span className="text-xs text-amber-100">+1 顆彈珠</span>
              )}
            </span>
          </div>
        )}
      </div>

      {state.phase === 'aiming' && (
        <div className="mt-4 w-full max-w-md space-y-3">
          <p className="text-slate-400 text-sm text-center">拉動滑桿設定力道，按下發射</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-8">弱</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={state.launchPower}
              onChange={(e) => handlePowerChange(parseFloat(e.target.value))}
              className="flex-1 h-3 rounded-full appearance-none bg-slate-700 accent-amber-500"
            />
            <span className="text-xs text-slate-500 w-8">強</span>
          </div>
          <button
            type="button"
            onClick={handleLaunch}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold transition-colors"
          >
            發射
          </button>
        </div>
      )}

      {state.phase === 'menu' && (
        <div
          className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center gap-6 z-10"
          role="dialog"
          aria-label="Start game"
        >
          <h2 className="text-2xl font-bold">彈珠台</h2>
          <p className="text-slate-300 text-sm max-w-sm text-center">
            共有 {INITIAL_BALLS} 顆彈珠。設定力道後發射，彈珠經釘柱落下，落入下方洞口即得分。中央洞口 100 分，兩側 25 分，最外 10 分。
          </p>
          <div className="text-xs text-slate-300 space-y-1">
            <p>
              目標分數：{BRONZE_TARGET}（銅牌）、{SILVER_TARGET}（銀牌）、{GOLD_TARGET}（金牌）。
            </p>
            <p>中央 100 分洞口若連續命中，第二顆起變為 Jackpot：雙倍得分並加送 1 顆彈珠。</p>
          </div>
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold transition-colors"
          >
            <Play className="w-5 h-5" />
            開始
          </button>
        </div>
      )}

      {state.phase === 'gameOver' && (
        <div
          className="fixed inset-0 bg-black/75 flex flex-col items-center justify-center gap-4 z-10"
          role="dialog"
          aria-label="Game over"
        >
          <h2 className="text-2xl font-bold">彈珠用盡</h2>
          <p className="text-3xl font-bold text-amber-400">總分 {state.score}</p>
          <p className="text-sm text-slate-200">
            本局評價：<span className="font-semibold text-amber-300">{getMedalLabel(state.score)}</span>
          </p>
          <div className="text-xs text-slate-400 text-center max-w-xs">
            <p>
              銅牌：{BRONZE_TARGET} 分以上／銀牌：{SILVER_TARGET} 分以上／金牌：{GOLD_TARGET} 分以上。
            </p>
            <p>多多利用中央洞 Jackpot，拚高分吧！</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            再玩一局
          </button>
        </div>
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-20"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pachinko-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="pachinko-rules-title" className="text-lg font-bold mb-3">
              規則說明
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>每局 {INITIAL_BALLS} 顆彈珠。用滑桿設定發射力道後按「發射」。</li>
              <li>彈珠向上射出後受重力落下，與釘柱碰撞會彈開，落入下方洞口即計分。</li>
              <li>洞口分數由左至右：10、25、100、25、10。中央洞口最高分。</li>
              <li>彈珠用盡後結算總分。</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function draw(ctx: CanvasRenderingContext2D, state: PachinkoState): void {
  const slotTop = BOARD_HEIGHT - SLOT_HEIGHT;

  ctx.fillStyle = '#1c1917';
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  ctx.fillStyle = '#292524';
  ctx.fillRect(0, 0, BOARD_WIDTH, slotTop);

  for (const pin of state.pins) {
    ctx.fillStyle = '#a8a29e';
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, PIN_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = '#0c0a09';
  ctx.fillRect(0, slotTop, BOARD_WIDTH, SLOT_HEIGHT);

  state.slots.forEach((slot, index) => {
    const isCenter = index === 2;
    const hasCenterBonus = isCenter && state.centerStreak > 0;

    ctx.lineWidth = 2;
    if (isCenter) {
      ctx.strokeStyle = state.jackpotJustTriggered ? '#fbbf24' : '#facc15';
      ctx.strokeRect(slot.x + 2, slotTop + 2, slot.width - 4, SLOT_HEIGHT - 4);
      if (hasCenterBonus) {
        const glowPadding = 6;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
        ctx.strokeRect(
          slot.x + glowPadding,
          slotTop + glowPadding,
          slot.width - glowPadding * 2,
          SLOT_HEIGHT - glowPadding * 2
        );
      }
    } else {
      ctx.strokeStyle = '#57534e';
      ctx.strokeRect(slot.x + 2, slotTop + 2, slot.width - 4, SLOT_HEIGHT - 4);
    }

    ctx.fillStyle = isCenter ? 'rgba(250,204,21,0.18)' : 'rgba(255,255,255,0.08)';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      String(slot.score),
      slot.x + slot.width / 2,
      slotTop + SLOT_HEIGHT / 2
    );
  });

  if (state.ball) {
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (state.phase === 'aiming') {
    ctx.fillStyle = 'rgba(254, 240, 138, 0.4)';
    ctx.beginPath();
    ctx.arc(BOARD_WIDTH / 2, LAUNCH_Y, BALL_RADIUS + 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
