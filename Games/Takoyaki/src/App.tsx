import { useState, useCallback, useEffect, useRef } from 'react';
import {
  createInitialState,
  startGame,
  update,
  flipSlot,
  GRILL_COLS,
  GRILL_ROWS,
  GAME_DURATION,
  PERFECT_LOW,
  PERFECT_HIGH,
} from './utils/takoyakiLogic';
import type { TakoyakiState } from './utils/takoyakiLogic';
import { TakoyakiBall } from './components/TakoyakiBall';
import { BookOpen, Play, RefreshCw } from 'lucide-react';

export default function App() {
  const [state, setState] = useState<TakoyakiState>(createInitialState);
  const [showRules, setShowRules] = useState(false);
  const lastTick = useRef(0);
  const rafId = useRef(0);

  useEffect(() => {
    if (state.phase !== 'playing') return;
    const loop = (time: number) => {
      const dt = (time - lastTick.current) / 1000;
      lastTick.current = time;
      setState((s) => update(s, dt));
      rafId.current = requestAnimationFrame(loop);
    };
    lastTick.current = performance.now();
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, [state.phase]);

  const handleStart = useCallback(() => {
    setState(startGame(state));
  }, []);

  const handleFlip = useCallback((index: number) => {
    setState((s) => flipSlot(s, index));
  }, []);

  const handleReset = useCallback(() => {
    setState(createInitialState());
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 via-amber-900/30 to-amber-950 text-amber-100 flex flex-col items-center p-4">
      <header className="w-full max-w-2xl flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-amber-100 drop-shadow-sm">
          章魚燒 Takoyaki
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="p-2 rounded-xl hover:bg-amber-800/50 transition-colors"
            title="Rules"
            aria-label="Rules"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl hover:bg-amber-800/50 transition-colors"
            title="New game"
            aria-label="New game"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {state.phase === 'playing' && (
        <div className="flex flex-wrap justify-center gap-4 mb-5">
          <div className="bg-amber-900/70 px-5 py-2.5 rounded-xl border border-amber-700/80 shadow-lg">
            <span className="text-amber-400/90 text-xs font-medium uppercase tracking-wider">分數</span>
            <span className="text-3xl font-bold tabular-nums block text-amber-100">{state.score}</span>
          </div>
          <div className="bg-amber-900/70 px-5 py-2.5 rounded-xl border border-amber-700/80 shadow-lg">
            <span className="text-amber-400/90 text-xs font-medium uppercase tracking-wider">時間</span>
            <span className="text-3xl font-bold tabular-nums block text-amber-100">{formatTime(state.timeLeft)}</span>
          </div>
          {state.combo > 0 && (
            <div className="bg-emerald-800/50 px-5 py-2.5 rounded-xl border border-emerald-600/80 shadow-lg">
              <span className="text-emerald-300 text-xs font-medium uppercase tracking-wider">連擊</span>
              <span className="text-3xl font-bold tabular-nums block text-emerald-200">×{state.combo}</span>
            </div>
          )}
        </div>
      )}

      <div
        className="grill-pan inline-block p-5 rounded-3xl shadow-2xl"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRILL_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRILL_ROWS}, 1fr)`,
          gap: 14,
          width: Math.min(360, 88 * GRILL_COLS + 14 * (GRILL_COLS - 1) + 40),
          background: 'linear-gradient(145deg, #78350f 0%, #92400e 30%, #b45309 60%, #78350f 100%)',
          border: '4px solid #451a03',
          boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        {state.slots.map((slot, i) => (
          <TakoyakiBall
            key={i}
            slot={slot}
            onClick={() => handleFlip(i)}
            disabled={state.phase !== 'playing' || slot.type !== 'cooking'}
          />
        ))}
      </div>

      <p className="mt-5 text-amber-400/95 text-sm text-center max-w-sm leading-relaxed">
        球體由淺變金黃時即為烹煮中；在熟度約{' '}
        <span className="font-semibold text-amber-300">{Math.round(PERFECT_LOW * 100)}%～{Math.round(PERFECT_HIGH * 100)}%</span>{' '}
        （金黃色、冒蒸氣）時點擊翻面可得滿分
      </p>

      {state.phase === 'menu' && (
        <div
          className="fixed inset-0 bg-black/70 flex flex-col items-center justify-center gap-6 z-10"
          role="dialog"
          aria-label="Start game"
        >
          <h2 className="text-3xl font-bold text-amber-100">開始烤章魚燒</h2>
          <p className="text-amber-200/95 text-sm max-w-sm text-center leading-relaxed">
            {GAME_DURATION} 秒內盡量烤出完美章魚燒。每格會自動出現球，球體會隨時間從淺色變金黃再變深色；
            在<strong className="text-amber-300">金黃冒蒸氣</strong>時點擊翻面得分，太早未熟、太晚燒焦。
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 font-bold transition-colors text-amber-950 shadow-lg hover:shadow-amber-500/30"
          >
            <Play className="w-5 h-5 fill-current" />
            開始
          </button>
        </div>
      )}

      {state.phase === 'gameOver' && (
        <div
          className="fixed inset-0 bg-black/75 flex flex-col items-center justify-center gap-5 z-10"
          role="dialog"
          aria-label="Game over"
        >
          <h2 className="text-2xl font-bold text-amber-100">時間到！</h2>
          <p className="text-4xl font-bold text-amber-400 tabular-nums">總分 {state.score}</p>
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 font-medium text-amber-950 transition-colors"
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
          aria-labelledby="takoyaki-rules-title"
        >
          <div className="bg-amber-900/95 rounded-2xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left border-2 border-amber-700 shadow-2xl">
            <h2 id="takoyaki-rules-title" className="text-lg font-bold mb-3 text-amber-100">
              規則說明
            </h2>
            <ul className="text-sm text-amber-100 space-y-2 list-disc pl-4 leading-relaxed">
              <li>烤盤會自動出現章魚燒，球體顏色會隨熟度由淺變金黃再變深。</li>
              <li>點擊正在烤的格子可「翻面」：在最佳時機（金黃色、冒蒸氣，約 70%～88% 熟度）翻面得 15 分，連擊有加分。</li>
              <li>太早翻面＝未熟、太晚＝燒焦，該顆不計分。</li>
              <li>時間內盡量取得高分。</li>
            </ul>

            <div className="mt-5 pt-4 border-t border-amber-700/80">
              <p className="text-xs font-semibold text-amber-300/95 uppercase tracking-wider mb-2">
                熟度與顏色
              </p>
              <div className="relative">
                <div
                  className="h-8 rounded-lg overflow-hidden border border-amber-700/80 shadow-inner"
                  style={{
                    background: `linear-gradient(to right,
                      #fef9c3 0%,
                      #fef08a 25%,
                      #fde68a 40%,
                      #fcd34d 55%,
                      #fbbf24 70%,
                      #f59e0b 88%,
                      #d97706 92%,
                      #92400e 97%,
                      #451a03 100%
                    )`,
                  }}
                />
                <span
                  className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                  style={{ left: `${PERFECT_LOW * 100}%` }}
                  aria-hidden
                />
                <span
                  className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                  style={{ left: `${PERFECT_HIGH * 100}%` }}
                  aria-hidden
                />
                <span
                  className="absolute inset-y-0 bg-emerald-500/25 pointer-events-none"
                  style={{ left: `${PERFECT_LOW * 100}%`, width: `${(PERFECT_HIGH - PERFECT_LOW) * 100}%` }}
                  aria-hidden
                />
              </div>
              <div className="flex justify-between text-[10px] text-amber-500 mt-1 px-0.5">
                <span>0%</span>
                <span className="text-emerald-400 font-medium">{Math.round(PERFECT_LOW * 100)}%</span>
                <span className="text-emerald-400 font-medium">{Math.round(PERFECT_HIGH * 100)}%</span>
                <span>100%</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded shrink-0 border border-amber-700/60"
                    style={{ background: 'linear-gradient(135deg, #fef9c3, #fde68a)' }}
                  />
                  <span className="text-amber-300/90">未熟</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded shrink-0 border border-amber-600/80 ring-2 ring-emerald-400/80"
                    style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}
                  />
                  <span className="text-emerald-400 font-medium">完美區間</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-4 h-4 rounded shrink-0 border border-amber-800"
                    style={{ background: 'linear-gradient(135deg, #92400e, #451a03)' }}
                  />
                  <span className="text-amber-400/90">燒焦</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-medium text-amber-950 transition-colors"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
