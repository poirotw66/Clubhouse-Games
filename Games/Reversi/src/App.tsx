import { useState, useCallback } from 'react';
import type { Board, Piece } from './utils/reversiLogic';
import {
  createInitialBoard,
  getLegalMoves,
  applyMove,
  countPieces,
  getWinner,
} from './utils/reversiLogic';
import { RefreshCw, BookOpen } from 'lucide-react';

const SIZE = 8;

type GamePhase = 'playing' | 'over';

interface GameState {
  board: Board;
  currentTurn: Piece;
  phase: GamePhase;
  winner: Piece | 'draw' | null;
  message: string;
}

function getInitialState(): GameState {
  const board = createInitialBoard();
  const legal = getLegalMoves(board, 'black');
  return {
    board,
    currentTurn: 'black',
    phase: 'playing',
    winner: null,
    message: legal.length > 0 ? '黑方下子' : '黑方無合法手，請按 Pass',
  };
}

function passTurn(state: GameState): GameState {
  const nextTurn: Piece = state.currentTurn === 'black' ? 'white' : 'black';
  const legal = getLegalMoves(state.board, nextTurn);
  if (legal.length > 0) {
    return {
      ...state,
      currentTurn: nextTurn,
      message: nextTurn === 'black' ? '黑方下子' : '白方下子',
    };
  }
  const otherLegal = getLegalMoves(state.board, state.currentTurn);
  if (otherLegal.length === 0) {
    const winner = getWinner(state.board);
    return {
      ...state,
      phase: 'over',
      winner,
      message:
        winner === 'draw'
          ? '和局'
          : winner === 'black'
            ? '黑方勝'
            : '白方勝',
    };
  }
  return passTurn({
    ...state,
    currentTurn: nextTurn,
    message: nextTurn === 'black' ? '黑方無合法手，跳過' : '白方無合法手，跳過',
  });
}

export default function App() {
  const [state, setState] = useState<GameState>(getInitialState);
  const [showRules, setShowRules] = useState(false);

  const legalMoves = state.phase === 'playing' ? getLegalMoves(state.board, state.currentTurn) : [];
  const legalSet = new Set(legalMoves.map(([r, c]) => `${r},${c}`));
  const { black, white } = countPieces(state.board);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (state.phase !== 'playing') return;
      if (!legalSet.has(`${r},${c}`)) return;
      const nextBoard = applyMove(state.board, r, c, state.currentTurn);
      const nextTurn: Piece = state.currentTurn === 'black' ? 'white' : 'black';
      const nextLegal = getLegalMoves(nextBoard, nextTurn);
      if (nextLegal.length > 0) {
        setState({
          board: nextBoard,
          currentTurn: nextTurn,
          phase: 'playing',
          winner: null,
          message: nextTurn === 'black' ? '黑方下子' : '白方下子',
        });
        return;
      }
      const otherTurn: Piece = nextTurn === 'black' ? 'white' : 'black';
      const otherLegal = getLegalMoves(nextBoard, otherTurn);
      if (otherLegal.length === 0) {
        const winner = getWinner(nextBoard);
        setState({
          board: nextBoard,
          currentTurn: nextTurn,
          phase: 'over',
          winner,
          message:
            winner === 'draw' ? '和局' : winner === 'black' ? '黑方勝' : '白方勝',
        });
        return;
      }
      setState({
        board: nextBoard,
        currentTurn: otherTurn,
        phase: 'playing',
        winner: null,
        message:
          nextTurn === 'black'
            ? '黑方無合法手，跳過；白方下子'
            : '白方無合法手，跳過；黑方下子',
      });
    },
    [state.phase, legalSet]
  );

  const handlePass = useCallback(() => {
    if (state.phase !== 'playing' || legalMoves.length > 0) return;
    setState((s) => passTurn(s));
  }, [state.phase, legalMoves.length]);

  const handleNewGame = useCallback(() => {
    setState(getInitialState());
  }, []);

  return (
    <div className="min-h-screen bg-emerald-950 text-white flex flex-col items-center p-4 min-w-0">
      <header className="w-full max-w-lg flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold tracking-tight">黑白棋 Reversi</h1>
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

      <div className="flex items-center justify-center gap-6 mb-4 text-sm">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'black'
              ? 'bg-amber-600/30 ring-2 ring-amber-400'
              : 'bg-stone-800/50'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-stone-900 ring-2 ring-stone-600" />
          <span>黑 {black}</span>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'white'
              ? 'bg-amber-600/30 ring-2 ring-amber-400'
              : 'bg-stone-800/50'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white ring-2 ring-stone-400" />
          <span>白 {white}</span>
        </div>
      </div>

      <p className="text-emerald-200 text-sm mb-4">{state.message}</p>

      <div
        className="inline-block p-2 rounded-xl bg-emerald-900/80 shadow-lg box-border"
        style={{
          width: 320,
          height: 320,
          minWidth: 280,
          minHeight: 280,
        }}
      >
        <div
          className="grid gap-0.5 bg-stone-800 rounded-lg p-1 w-full h-full"
          style={{
            gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const r = Math.floor(i / SIZE);
            const c = i % SIZE;
            const cell = state.board[r][c];
            const isLegal = legalSet.has(`${r},${c}`);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleCellClick(r, c)}
                disabled={state.phase !== 'playing' || !isLegal}
                className={`
                  w-full aspect-square rounded-md flex items-center justify-center
                  transition-colors duration-150
                  ${cell ? 'cursor-default' : ''}
                  ${isLegal && !cell ? 'bg-emerald-600/40 hover:bg-emerald-500/50' : 'bg-emerald-800/60'}
                  ${!isLegal && state.phase === 'playing' ? 'hover:bg-emerald-700/70' : ''}
                  ${state.phase !== 'playing' ? 'cursor-default' : ''}
                `}
                aria-label={
                  cell ? `Row ${r + 1} col ${c + 1} ${cell}` : isLegal ? `Place at ${r + 1},${c + 1}` : `Empty ${r + 1},${c + 1}`
                }
              >
                {cell && (
                  <span
                    className={`w-[85%] h-[85%] rounded-full shadow-inner ${
                      cell === 'black'
                        ? 'bg-stone-900 ring-2 ring-stone-600'
                        : 'bg-white ring-2 ring-stone-400'
                    }`}
                  />
                )}
                {!cell && isLegal && (
                  <span className="w-2 h-2 rounded-full bg-emerald-300/60" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {state.phase === 'playing' && legalMoves.length === 0 && (
        <button
          type="button"
          onClick={handlePass}
          className="mt-6 px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium transition-colors"
        >
          Pass（放棄本回合）
        </button>
      )}

      {state.phase === 'over' && (
        <div className="mt-6 text-center">
          <p className="text-lg font-medium text-amber-200">
            {state.winner === 'draw' ? '和局' : state.winner === 'black' ? '黑方獲勝' : '白方獲勝'}
          </p>
          <button
            type="button"
            onClick={handleNewGame}
            className="mt-3 px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium transition-colors"
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
          aria-labelledby="rules-title"
        >
          <div className="bg-stone-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="rules-title" className="text-lg font-bold mb-3">規則說明</h2>
            <ul className="text-sm text-stone-200 space-y-2 list-disc pl-4">
              <li>8×8 棋盤，黑方先手。開局中央 2×2 為兩黑兩白（斜線相對）。</li>
              <li>輪到的一方在空格下子，新子須與己方另一子「夾住」至少一條線上的對方子，並將該線上被夾住的對方子全部翻成己色。</li>
              <li>同一手可多方向翻子；至少須翻 1 枚才算合法。</li>
              <li>無合法手時須 Pass，改由對方下；若雙方都無合法手則終局。</li>
              <li>終局時己色子數多者勝，相同則和局。</li>
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
