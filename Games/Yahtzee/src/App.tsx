import { useState, useCallback } from 'react';
import type { YahtzeeState, CategoryKey } from './utils/yahtzeeLogic';
import {
  createInitialState,
  rollDice,
  toggleKept,
  fillCategory,
  totalScore,
  isYahtzee,
} from './utils/yahtzeeLogic';
import { ScoreSheet } from './components/ScoreSheet';
import { RefreshCw, BookOpen, User, Users } from 'lucide-react';

type GameMode = 'solo' | 'two';

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('solo');
  const [state, setState] = useState<YahtzeeState>(() =>
    createInitialState(1)
  );
  const [showRules, setShowRules] = useState(false);

  const handleNewGame = useCallback((mode: GameMode) => {
    setGameMode(mode);
    setState(createInitialState(mode === 'solo' ? 1 : 2));
  }, []);

  const handleRoll = useCallback(() => {
    setState(rollDice(state));
  }, [state]);

  const handleToggleKept = useCallback(
    (index: number) => {
      setState(toggleKept(state, index));
    },
    [state]
  );

  const handleChooseCategory = useCallback(
    (category: CategoryKey, useJoker: boolean) => {
      setState(fillCategory(state, category, useJoker));
    },
    [state]
  );

  const canRoll =
    state.phase === 'rolling' &&
    state.rollCount < 3 &&
    (state.rollCount === 0 || state.kept.some((k) => !k));
  const canEndRollEarly =
    state.phase === 'rolling' && state.rollCount >= 1 && state.rollCount < 3;

  const statusMessage =
    state.phase === 'gameOver'
      ? `遊戲結束！${state.numPlayers === 1 ? `你的總分 ${totalScore(state.scoreCards[0])}` : `玩家 1：${totalScore(state.scoreCards[0])} 分 · 玩家 2：${totalScore(state.scoreCards[1])} 分`}`
      : state.phase === 'choosingCategory'
        ? `選擇一個計分格填入（可填 0）`
        : state.numPlayers === 1
          ? `擲骰 ${state.rollCount}/3 · 點擊骰子保留／重擲`
          : `玩家 ${state.currentPlayerIndex + 1} 的回合 · 擲骰 ${state.rollCount}/3`;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 min-w-0">
      <header className="w-full max-w-3xl flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">快艇骰子 Yahtzee</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {gameMode === 'solo' ? '單人' : '雙人'}
          </span>
        </div>
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
            onClick={() => handleNewGame(gameMode)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="New game"
            aria-label="New game"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex items-center gap-4 mb-2 text-sm">
        <button
          type="button"
          onClick={() => handleNewGame('solo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
            gameMode === 'solo' ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <User className="w-4 h-4" />
          <span>單人</span>
        </button>
        <button
          type="button"
          onClick={() => handleNewGame('two')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
            gameMode === 'two' ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>雙人</span>
        </button>
      </div>

      <p className="text-slate-200 text-sm mb-4">{statusMessage}</p>

      {state.phase !== 'gameOver' && (
        <section className="mb-6" aria-label="骰子">
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {state.dice.map((value, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleToggleKept(i)}
                disabled={state.phase !== 'rolling' || state.rollCount === 0}
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                  state.kept[i]
                    ? 'border-amber-400 bg-amber-500/30 text-amber-100'
                    : 'border-slate-500 bg-slate-700 text-white'
                } ${state.phase === 'rolling' && state.rollCount > 0 ? 'cursor-pointer hover:border-amber-500' : 'cursor-default'}`}
                aria-label={`骰子 ${i + 1}：${value}，${state.kept[i] ? '已保留' : '未保留'}`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-3 mt-3 flex-wrap">
            <button
              type="button"
              onClick={handleRoll}
              disabled={!canRoll}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition-colors"
            >
              擲骰 {state.rollCount > 0 && `(${state.rollCount}/3)`}
            </button>
            {canEndRollEarly && (
              <button
                type="button"
                onClick={() =>
                  setState((s) => ({ ...s, phase: 'choosingCategory' as const }))
                }
                className="px-4 py-2 rounded-lg border border-slate-500 bg-slate-700 hover:bg-slate-600 font-medium transition-colors"
              >
                選擇計分格
              </button>
            )}
          </div>
          {state.rollCount === 0 && state.phase === 'rolling' && (
            <p className="text-slate-400 text-xs text-center mt-1">先擲骰開始此回合</p>
          )}
          {state.rollCount > 0 && state.phase === 'rolling' && (
            <p className="text-slate-400 text-xs text-center mt-1">點擊骰子保留，再按擲骰重擲其餘</p>
          )}
        </section>
      )}

      {isYahtzee(state.dice) && state.phase === 'choosingCategory' && (
        <p className="text-amber-400 text-sm mb-2">快艇！可選 Joker 填小順／大順／葫蘆（若上段該點數已填）</p>
      )}

      <section className="flex flex-wrap justify-center gap-4" aria-label="計分表">
        {state.scoreCards.map((card, i) => (
          <ScoreSheet
            key={i}
            card={card}
            playerIndex={i}
            dice={state.dice}
            isCurrentPlayer={state.currentPlayerIndex === i}
            phase={state.phase}
            onChooseCategory={handleChooseCategory}
          />
        ))}
      </section>

      {state.phase === 'gameOver' && (
        <div className="mt-6 text-center">
          {state.numPlayers === 2 && (
            <p className="text-lg font-medium text-slate-200">
              {totalScore(state.scoreCards[0]) > totalScore(state.scoreCards[1])
                ? '玩家 1 獲勝'
                : totalScore(state.scoreCards[0]) < totalScore(state.scoreCards[1])
                  ? '玩家 2 獲勝'
                  : '平手'}
            </p>
          )}
          <button
            type="button"
            onClick={() => handleNewGame(gameMode)}
            className="mt-3 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium transition-colors"
          >
            再玩一局
          </button>
        </div>
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="yahtzee-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="yahtzee-rules-title" className="text-lg font-bold mb-3">
              規則說明
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>每回合最多擲骰 3 次，可保留部分骰子後重擲其餘。</li>
              <li>擲完後須選一個計分格填入（每格整局只能用一次），未達條件可填 0。</li>
              <li>上段（1～6 點）：只計該點數的骰子總和；上段總和 ≥ 63 加 35 分。</li>
              <li>下段：三條／四條（點數總和）、葫蘆 25、小順 30、大順 40、快艇 50、機會（總和）。</li>
              <li>快艇加分：若快艇格已得 50 分，之後再擲出五顆同點可加 100 分（仍須選一格填分）。</li>
              <li>Joker：擲出快艇時若對應上段格已用，可將本次當 Joker 填小順／大順／葫蘆（30／40／25）。</li>
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
