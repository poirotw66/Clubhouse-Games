import { useState, useCallback, useEffect, useRef } from 'react';
import type { Board, PieceColor } from './utils/connect4Logic';
import {
  createInitialBoard,
  getLegalColumns,
  getDropRow,
  dropPiece,
  hasWonAt,
  isBoardFull,
  COLS,
  ROWS,
} from './utils/connect4Logic';
import { pickBotColumn } from './utils/connect4Logic';
import { RefreshCw, BookOpen, Users } from 'lucide-react';

type GamePhase = 'playing' | 'over';
type GameMode = 'two' | 'bot';

interface GameState {
  board: Board;
  currentTurn: PieceColor;
  phase: GamePhase;
  winner: PieceColor | 'draw' | null;
}

function getInitialState(): GameState {
  return {
    board: createInitialBoard(),
    currentTurn: 'red',
    phase: 'playing',
    winner: null,
  };
}

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('two');
  const [playerSide, setPlayerSide] = useState<PieceColor>('red');
  const [state, setState] = useState<GameState>(getInitialState);
  const [showRules, setShowRules] = useState(false);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const botScheduled = useRef(false);

  const legalCols = state.phase === 'playing' ? getLegalColumns(state.board) : [];
  const legalSet = new Set(legalCols);

  const isBotTurn =
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentTurn !== playerSide;

  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const timer = setTimeout(() => {
      const botColor: PieceColor = playerSide === 'red' ? 'yellow' : 'red';
      const col = pickBotColumn(state.board, botColor);
      if (col === null) {
        botScheduled.current = false;
        return;
      }
      // Reuse click handler logic
      const dropRow = getDropRow(state.board, col);
      const nextBoard = dropPiece(state.board, col, botColor);
      if (!nextBoard || dropRow === null) {
        botScheduled.current = false;
        return;
      }
      const won = hasWonAt(nextBoard, dropRow, col, botColor);
      const full = isBoardFull(nextBoard);
      const nextTurn: PieceColor = botColor === 'red' ? 'yellow' : 'red';
      setState({
        board: nextBoard,
        currentTurn: nextTurn,
        phase: won || full ? 'over' : 'playing',
        winner: won ? botColor : full ? 'draw' : null,
      });
      botScheduled.current = false;
    }, 500);
    return () => clearTimeout(timer);
  }, [isBotTurn, state.board, playerSide]);

  const handleColumnClick = useCallback(
    (col: number) => {
      if (state.phase !== 'playing' || !legalSet.has(col)) return;
      if (gameMode === 'bot' && state.currentTurn !== playerSide) return;
      const dropRow = getDropRow(state.board, col);
      const nextBoard = dropPiece(state.board, col, state.currentTurn);
      if (!nextBoard || dropRow === null) return;
      const won = hasWonAt(nextBoard, dropRow, col, state.currentTurn);
      const full = isBoardFull(nextBoard);
      const nextTurn: PieceColor = state.currentTurn === 'red' ? 'yellow' : 'red';
      setState({
        board: nextBoard,
        currentTurn: nextTurn,
        phase: won || full ? 'over' : 'playing',
        winner: won ? state.currentTurn : full ? 'draw' : null,
      });
    },
    [state.phase, state.board, state.currentTurn, legalSet, gameMode, playerSide]
  );

  const handleNewGame = useCallback(() => {
    setState(getInitialState());
    setHoverCol(null);
    botScheduled.current = false;
  }, []);

  const statusMessage =
    state.phase === 'over'
      ? state.winner === 'draw'
        ? '和局'
        : state.winner === 'red'
          ? '紅方獲勝'
          : '黃方獲勝'
      : gameMode === 'bot'
        ? state.currentTurn === playerSide
          ? '輪到你下子'
          : '電腦思考中…'
        : state.currentTurn === 'red'
          ? '紅方下子'
          : '黃方下子';

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 min-w-0">
      <header className="w-full max-w-lg flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">四子棋 Connect Four</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {gameMode === 'bot' ? '對戰電腦' : '雙人對戰'}
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

      <div className="flex items-center justify-center gap-6 mb-4 text-sm">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'red'
              ? 'bg-red-600/30 ring-2 ring-red-400'
              : 'bg-slate-700/50'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-red-500 ring-2 ring-red-400" />
          <span>紅</span>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'yellow'
              ? 'bg-yellow-500/30 ring-2 ring-yellow-400'
              : 'bg-slate-700/50'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-yellow-400 ring-2 ring-yellow-300" />
          <span>黃</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <button
          type="button"
          onClick={() => {
            setGameMode('two');
            setState(getInitialState());
            setHoverCol(null);
            botScheduled.current = false;
          }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border ${
            gameMode === 'two'
              ? 'border-sky-400 bg-sky-500/20 text-sky-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <Users className="w-3 h-3" />
          <span>雙人對戰</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setGameMode('bot');
            setPlayerSide('red');
            setState(getInitialState());
            setHoverCol(null);
            botScheduled.current = false;
          }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border ${
            gameMode === 'bot' && playerSide === 'red'
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span>電腦（你執紅）</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setGameMode('bot');
            setPlayerSide('yellow');
            setState(getInitialState());
            setHoverCol(null);
            botScheduled.current = false;
          }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border ${
            gameMode === 'bot' && playerSide === 'yellow'
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>電腦（你執黃）</span>
        </button>
      </div>

      <p className="text-slate-200 text-sm mb-4">{statusMessage}</p>

      <div
        className="inline-block p-3 rounded-xl bg-blue-900 shadow-lg"
        style={{ width: 320, minWidth: 280 }}
      >
        {/* Column headers (drop targets) */}
        <div
          className="grid gap-1 mb-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        >
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleColumnClick(c)}
              onMouseEnter={() => setHoverCol(c)}
              onMouseLeave={() => setHoverCol(null)}
              disabled={state.phase !== 'playing' || !legalSet.has(c)}
              className={`
                h-10 rounded-t-lg flex items-center justify-center transition-colors
                ${legalSet.has(c) ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-800 cursor-not-allowed'}
                ${hoverCol === c && legalSet.has(c) ? 'ring-2 ring-white/50' : ''}
              `}
              aria-label={`Drop in column ${c + 1}`}
            >
              {state.phase === 'playing' && legalSet.has(c) && (
                <span
                  className={`w-6 h-6 rounded-full ${
                    state.currentTurn === 'red' ? 'bg-red-500/80' : 'bg-yellow-400/80'
                  }`}
                />
              )}
            </button>
          ))}
        </div>
        {/* Grid: row 0 at top */}
        <div
          className="grid gap-1 rounded-b-lg overflow-hidden bg-blue-800 p-1"
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            aspectRatio: `${COLS}/${ROWS}`,
          }}
        >
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const row = Math.floor(i / COLS);
            const col = i % COLS;
            const cell = state.board[row][col];
            return (
              <div
                key={`${row}-${col}`}
                className="rounded-full bg-slate-800 flex items-center justify-center aspect-square max-w-full"
                style={{ minHeight: 0 }}
              >
                {cell && (
                  <span
                    className={`w-[90%] h-[90%] rounded-full ${
                      cell === 'red' ? 'bg-red-500 ring-2 ring-red-400' : 'bg-yellow-400 ring-2 ring-yellow-300'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {state.phase === 'over' && (
        <div className="mt-6 text-center">
          <p className="text-lg font-medium text-slate-200">
            {state.winner === 'draw' ? '和局' : state.winner === 'red' ? '紅方獲勝' : '黃方獲勝'}
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
          aria-labelledby="connect4-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="connect4-rules-title" className="text-lg font-bold mb-3">規則說明</h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>7 列×6 行，輪流選擇一列投入己色棋子，棋子落至該列最低空位。</li>
              <li>先在橫、豎或斜線連成四枚己色者獲勝。</li>
              <li>42 格全部下滿無人連四則和局。</li>
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
