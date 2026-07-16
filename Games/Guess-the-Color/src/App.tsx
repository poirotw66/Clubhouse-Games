import { useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playError, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { BookOpen, Play, RefreshCw } from 'lucide-react';
import {
  createInitialState,
  startGame,
  updateState,
  submitAnswer,
  getRoundDifficulty,
  type GuessColorState,
} from './utils/slotCarsLogic';

function formatScore(score: number): string {
  return score.toString().padStart(4, '0');
}

const BRONZE_TARGET = 400;
const SILVER_TARGET = 700;
const GOLD_TARGET = 1000;

function getMedalLabel(score: number): string {
  if (score >= GOLD_TARGET) return '金牌';
  if (score >= SILVER_TARGET) return '銀牌';
  if (score >= BRONZE_TARGET) return '銅牌';
  return '再接再厲';
}

export default function App() {
  const [state, setState] = useState<GuessColorState>(createInitialState);
  const [showRules, setShowRules] = useState(false);
  const rafRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const lastPhaseRef = useRef(state.phase);
  const lastCorrectRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (state.phase !== 'showing' && state.phase !== 'answering') {
      return;
    }
    const loop = (time: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = time;
      }
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;
      setState((prev) => updateState(prev, dt));
      rafRef.current = requestAnimationFrame(loop);
    };
    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === 'results' && lastPhaseRef.current !== 'results') {
      if (state.score >= BRONZE_TARGET) playWin();
    }
    lastPhaseRef.current = state.phase;
  }, [state.phase, state.score]);

  useEffect(() => {
    if (state.lastCorrect === true && lastCorrectRef.current !== true) playScore();
    else if (state.lastCorrect === false && lastCorrectRef.current !== false) playError();
    lastCorrectRef.current = state.lastCorrect;
  }, [state.lastCorrect]);

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

  const roundConfig =
    state.round > 0 ? getRoundDifficulty(state.round) : getRoundDifficulty(1);
  const gridCols =
    roundConfig.choiceCount <= 6 ? 3 : roundConfig.choiceCount <= 8 ? 4 : 3;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4">
      <BackToMenu />
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
                  state.phase === 'showing'
                    ? state.choiceColors[state.targetIndex]
                    : '#020617',
              }}
            />
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
            {state.choiceColors.map((color, index) => {
              const disabled =
                state.phase !== 'answering' && state.phase !== 'showing';
              return (
                <button
                  key={color}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleChoice(index)}
                  className={`h-16 min-h-[48px] rounded-xl border transition-transform duration-150 touch-manipulation active:scale-95 ${
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
            每題會先顯示一塊顏色，稍後顏色會隱藏。請在限時內從選項中點出剛才顯示的那一個，共 {state.maxRounds}{' '}
            題；越後面顯示時間越短、選項越多且更相似，盡量多答對、拚高分吧！
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
        <ResultOverlay
          title="挑戰結束！"
          badge={getMedalLabel(state.score)}
          variant={state.score >= BRONZE_TARGET ? 'win' : 'neutral'}
          stats={[
            { label: '總分', value: formatScore(state.score) },
            { label: '最長連擊', value: `${state.streak} 題` },
          ]}
          subtitle={`銅牌 ${BRONZE_TARGET}／銀牌 ${SILVER_TARGET}／金牌 ${GOLD_TARGET}`}
          onPrimary={handleReset}
        />
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
                顏色出現時間會隨回合縮短，答題限時也會變緊；後期選項增至 8～9 個且含相似色干擾。
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
