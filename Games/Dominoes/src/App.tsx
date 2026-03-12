import { useState, useCallback, useEffect, useRef } from 'react';
import type { DominoesState, PlayerId } from './utils/dominoesLogic';
import {
  createInitialState,
  playTile,
  drawTiles,
  getChainEnds,
  getPlayableTiles,
  getValidMoves,
  pickBotMove,
  handSum,
} from './utils/dominoesLogic';
import { DominoTile, PlacedDominoTile } from './components/DominoTile';
import { RefreshCw, BookOpen, Users, Bot } from 'lucide-react';

type GameMode = 'two' | 'bot';

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('two');
  const [state, setState] = useState<DominoesState>(createInitialState);
  const [showRules, setShowRules] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const botScheduled = useRef(false);

  const currentHand = state.hands[state.currentPlayer];
  const playable = getPlayableTiles(currentHand, state.chain);
  const playableIds = new Set(playable.map((t) => t.id));
  const ends = getChainEnds(state.chain);
  const canPlayAny = playable.length > 0;
  const mustDraw =
    state.phase === 'playing' &&
    !canPlayAny &&
    state.boneyard.length > 2;

  const isBotTurn =
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentPlayer === 1;

  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const timer = setTimeout(() => {
      const hand = state.hands[1];
      if (canPlay(hand, state.chain)) {
        const move = pickBotMove(hand, state.chain);
        if (move) {
          const next = playTile(state, 1, move.tileId, move.end);
          if (next) setState(next);
        }
      } else if (state.boneyard.length > 2) {
        setState(drawTiles(state, 1));
      } else {
        setState(drawTiles(state, 1));
      }
      botScheduled.current = false;
    }, 600);
    return () => clearTimeout(timer);
  }, [isBotTurn, state.phase, state.currentPlayer, state.chain, state.hands[1], state.boneyard.length]);

  const handlePlayAt = useCallback(
    (end: 'left' | 'right') => {
      if (state.phase !== 'playing' || !selectedTileId) return;
      if (gameMode === 'bot' && state.currentPlayer !== 0) return;
      const next = playTile(state, state.currentPlayer, selectedTileId, end);
      if (next) {
        setState(next);
        setSelectedTileId(null);
      }
    },
    [state, selectedTileId, gameMode]
  );

  const handleDraw = useCallback(() => {
    if (state.phase !== 'playing' || canPlayAny || state.boneyard.length <= 2) return;
    setState(drawTiles(state, state.currentPlayer));
  }, [state, canPlayAny]);

  const handleNewGame = useCallback(() => {
    setState(createInitialState());
    setSelectedTileId(null);
    botScheduled.current = false;
  }, []);

  const isValidEnd = useCallback(
    (tileId: number, end: 'left' | 'right') => {
      const moves = getValidMoves(state.hands[state.currentPlayer], state.chain);
      return moves.some((m) => m.tileId === tileId && m.end === end);
    },
    [state.hands, state.currentPlayer, state.chain]
  );

  const statusMessage =
    state.phase === 'won'
      ? `玩家 ${(state.winner! as number) + 1} 出完手牌獲勝`
      : state.phase === 'blocked'
        ? `阻塞：玩家 ${(state.winner! as number) + 1} 手牌點數較少獲勝（${handSum(state.hands[0])} vs ${handSum(state.hands[1])}）`
        : gameMode === 'bot'
          ? state.currentPlayer === 0
            ? '輪到你'
            : '電腦思考中…'
          : `玩家 ${state.currentPlayer + 1} 的回合`;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 min-w-0">
      <header className="w-full max-w-2xl flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">西洋骨牌 Dominoes</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {gameMode === 'bot' ? '對戰電腦' : '雙人'}
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
            onClick={handleNewGame}
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
          onClick={() => {
            setGameMode('two');
            handleNewGame();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
            gameMode === 'two' ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>雙人</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setGameMode('bot');
            handleNewGame();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${
            gameMode === 'bot' ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>對戰電腦</span>
        </button>
      </div>

      <p className="text-slate-200 text-sm mb-4">{statusMessage}</p>

      {/* Board: chain with left/right drop targets */}
      <div className="w-full max-w-2xl overflow-x-auto py-4">
        <div className="flex items-center justify-center gap-0 min-h-[5rem]">
          {ends && (
            <button
              type="button"
              onClick={() => handlePlayAt('left')}
              disabled={
                state.phase !== 'playing' ||
                !selectedTileId ||
                (gameMode === 'bot' && state.currentPlayer !== 0) ||
                !isValidEnd(selectedTileId, 'left')
              }
              className="flex flex-col items-center justify-center w-10 h-20 rounded border-2 border-dashed border-slate-500 bg-slate-800/50 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed hover:border-amber-500 hover:bg-slate-700/50 hover:text-amber-400 transition-colors"
              title="Play on left"
              aria-label={`Play selected tile on left (${ends.left})`}
            >
              <span className="text-lg font-bold">{ends.left}</span>
              <span className="text-xs">左</span>
            </button>
          )}
          <div className="flex items-center gap-0.5 flex-nowrap">
            {state.chain.map((placed) => (
              <PlacedDominoTile key={placed.tile.id} placed={placed} size="small" />
            ))}
          </div>
          {ends && (
            <button
              type="button"
              onClick={() => handlePlayAt('right')}
              disabled={
                state.phase !== 'playing' ||
                !selectedTileId ||
                (gameMode === 'bot' && state.currentPlayer !== 0) ||
                !isValidEnd(selectedTileId, 'right')
              }
              className="flex flex-col items-center justify-center w-10 h-20 rounded border-2 border-dashed border-slate-500 bg-slate-800/50 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed hover:border-amber-500 hover:bg-slate-700/50 hover:text-amber-400 transition-colors"
              title="Play on right"
              aria-label={`Play selected tile on right (${ends.right})`}
            >
              <span className="text-lg font-bold">{ends.right}</span>
              <span className="text-xs">右</span>
            </button>
          )}
        </div>
      </div>

      {/* Boneyard count */}
      <p className="text-slate-400 text-xs mb-2">牌堆：{state.boneyard.length} 張</p>

      {/* Current player hand */}
      <div className="w-full max-w-2xl">
        <p className="text-slate-300 text-sm mb-2">
          {gameMode === 'bot' && state.currentPlayer === 1
            ? '電腦手牌'
            : `玩家 ${state.currentPlayer + 1} 手牌`}
          {state.phase === 'playing' && state.currentPlayer === 0 && gameMode === 'bot' && (
            <span className="ml-2 text-amber-400">
              {canPlayAny ? '選一張牌再點左/右端出牌' : '無法出牌，請抽牌'}
            </span>
          )}
        </p>
        {state.phase === 'playing' &&
          (gameMode === 'bot' && state.currentPlayer === 1 ? (
            <div className="flex gap-1 flex-wrap justify-center">
              {currentHand.map((t) => (
                <div key={t.id} className="rounded border-2 border-slate-600 bg-slate-700 w-12 h-24 flex items-center justify-center text-slate-500">
                  ?
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap justify-center">
              {currentHand.map((t) => (
                <DominoTile
                  key={t.id}
                  tile={t}
                  vertical={false}
                  highlight={playableIds.has(t.id) && selectedTileId === t.id}
                  size="normal"
                  onClick={() => {
                    if (!playableIds.has(t.id)) return;
                    setSelectedTileId(selectedTileId === t.id ? null : t.id);
                  }}
                />
              ))}
            </div>
          ))}
      </div>

      {/* Draw button: current player cannot play and boneyard > 2 */}
      {state.phase === 'playing' &&
        !canPlayAny &&
        state.boneyard.length > 2 &&
        (gameMode === 'two' || state.currentPlayer === 0) && (
          <button
            type="button"
            onClick={handleDraw}
            className="mt-4 px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium transition-colors"
          >
            抽牌
          </button>
        )}

      {state.phase !== 'playing' && (
        <div className="mt-6 text-center">
          <p className="text-lg font-medium text-slate-200">
            {state.phase === 'won'
              ? `玩家 ${(state.winner as PlayerId) + 1} 獲勝`
              : `阻塞：玩家 ${(state.winner as PlayerId) + 1} 手牌點數較少獲勝`}
          </p>
          <button
            type="button"
            onClick={handleNewGame}
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
          aria-labelledby="dominoes-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="dominoes-rules-title" className="text-lg font-bold mb-3">
              規則說明（阻擋／抽牌型）
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>雙六組 28 張牌，每人 7 張，其餘為牌堆。</li>
              <li>輪流出牌：選一張手牌與桌面線的「左端」或「右端」點數相同的一邊相接。</li>
              <li>無法出牌時從牌堆抽牌，直到能出或牌堆剩 2 張不抽。</li>
              <li>先出完手牌者勝；若阻塞（雙方皆無法出牌），手牌點數和較少者勝。</li>
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

function canPlay(hand: DominoesState['hands'][0], chain: DominoesState['chain']): boolean {
  return getPlayableTiles(hand, chain).length > 0;
}
